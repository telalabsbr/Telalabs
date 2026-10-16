-- Reconciliação server-only para resultados de publicação UNKNOWN.
-- Um job de reconciliação nunca republica por conta própria: ele apenas confirma
-- sucesso, determina que uma nova publicação é segura, reagenda a verificação
-- ou exige ação humana.

create or replace function public.worker_claim_reconcile_jobs_for_providers(
  p_providers text[],
  p_limit integer default 10,
  p_lock_seconds integer default 120
)
returns table (
  job_id uuid,
  organization_id uuid,
  post_target_id uuid,
  provider text,
  content_intent text,
  scheduled_at timestamptz,
  attempt_no integer,
  payload jsonb
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job record;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if p_providers is null or cardinality(p_providers) = 0 then
    return;
  end if;

  for v_job in
    select j.id,
           j.organization_id,
           j.post_target_id,
           j.attempts,
           j.max_attempts,
           j.payload,
           pt.provider,
           pt.content_intent_override,
           pt.scheduled_at
      from public.scheduled_jobs j
      join public.post_targets pt
        on pt.id = j.post_target_id
       and pt.organization_id = j.organization_id
     where j.job_type = 'RECONCILE_TARGET'
       and j.status in ('READY','RETRY_WAIT')
       and j.run_at <= now()
       and (j.locked_until is null or j.locked_until < now())
       and pt.state = 'UNKNOWN'
       and pt.provider = any(p_providers)
     order by j.run_at, j.created_at
     for update of j skip locked
     limit greatest(1, least(coalesce(p_limit, 10), 100))
  loop
    update public.scheduled_jobs
       set status = 'RUNNING',
           attempts = attempts + 1,
           locked_until = now() + make_interval(secs => greatest(30, least(coalesce(p_lock_seconds, 120), 900))),
           updated_at = now()
     where id = v_job.id;

    insert into public.publication_attempts (
      organization_id,
      post_target_id,
      job_id,
      attempt_no,
      operation,
      operation_key,
      outcome
    )
    values (
      v_job.organization_id,
      v_job.post_target_id,
      v_job.id,
      v_job.attempts + 1,
      'RECONCILE',
      'reconcile:' || v_job.id::text || ':' || (v_job.attempts + 1)::text,
      'STARTED'
    );

    job_id := v_job.id;
    organization_id := v_job.organization_id;
    post_target_id := v_job.post_target_id;
    provider := v_job.provider;
    content_intent := coalesce(v_job.content_intent_override, 'AUTO');
    scheduled_at := v_job.scheduled_at;
    attempt_no := v_job.attempts + 1;
    payload := v_job.payload;
    return next;
  end loop;
end;
$function$;

revoke all on function public.worker_claim_reconcile_jobs_for_providers(text[],integer,integer)
from public, anon, authenticated;
grant execute on function public.worker_claim_reconcile_jobs_for_providers(text[],integer,integer)
to service_role;

create or replace function public.worker_finish_reconcile_job(
  p_job_id uuid,
  p_outcome text,
  p_error_code text default null,
  p_error_message_safe text default null,
  p_http_status integer default null,
  p_provider_request_id text default null,
  p_retry_after_seconds integer default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job public.scheduled_jobs%rowtype;
  v_attempt public.publication_attempts%rowtype;
  v_retry_seconds integer;
  v_result text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select * into v_job
    from public.scheduled_jobs
   where id = p_job_id
   for update;

  if v_job.id is null then
    raise exception 'job not found' using errcode = '22023';
  end if;

  if v_job.job_type <> 'RECONCILE_TARGET' or v_job.status <> 'RUNNING' then
    raise exception 'reconcile job is not running' using errcode = '22023';
  end if;

  select * into v_attempt
    from public.publication_attempts
   where job_id = v_job.id
     and attempt_no = v_job.attempts
     and operation = 'RECONCILE'
   order by started_at desc
   limit 1
   for update;

  if v_attempt.id is null then
    raise exception 'reconcile attempt not found' using errcode = '22023';
  end if;

  if p_outcome not in (
    'SUCCEEDED',
    'SAFE_TO_RETRY',
    'TRANSIENT_FAILURE',
    'RATE_LIMIT',
    'AUTH_REQUIRED',
    'UNKNOWN',
    'FAILED_FINAL'
  ) then
    raise exception 'invalid reconcile outcome' using errcode = '22023';
  end if;

  update public.publication_attempts
     set outcome = case
       when p_outcome in ('SUCCEEDED','SAFE_TO_RETRY') then 'SUCCEEDED'
       when p_outcome = 'UNKNOWN' then 'UNKNOWN'
       else 'FAILED'
     end,
     http_status = p_http_status,
     error_code = p_error_code,
     error_message_safe = p_error_message_safe,
     provider_request_id = p_provider_request_id,
     finished_at = now()
   where id = v_attempt.id;

  if p_outcome = 'SUCCEEDED' then
    update public.scheduled_jobs
       set status = 'SUCCEEDED',
           locked_until = null,
           last_error_code = null,
           updated_at = now()
     where id = v_job.id;

    update public.post_targets
       set state = 'PUBLISHED',
           published_at = coalesce(published_at, now()),
           updated_at = now()
     where id = v_job.post_target_id
       and organization_id = v_job.organization_id;

    v_result := 'PUBLISHED';

  elsif p_outcome = 'SAFE_TO_RETRY' then
    update public.scheduled_jobs
       set status = 'SUCCEEDED',
           locked_until = null,
           last_error_code = null,
           updated_at = now()
     where id = v_job.id;

    update public.post_targets
       set state = 'RETRY_WAIT',
           updated_at = now()
     where id = v_job.post_target_id
       and organization_id = v_job.organization_id;

    insert into public.scheduled_jobs (
      organization_id,
      post_target_id,
      job_type,
      run_at,
      status,
      attempts,
      max_attempts,
      dedupe_key,
      payload
    )
    values (
      v_job.organization_id,
      v_job.post_target_id,
      'PUBLISH_TARGET',
      now(),
      'READY',
      0,
      3,
      'publish:reconciled:' || v_job.post_target_id::text || ':' || v_job.id::text,
      jsonb_build_object(
        'source_reconcile_job_id', v_job.id,
        'reason', 'provider_confirmed_safe_to_retry'
      )
    )
    on conflict (dedupe_key) do nothing;

    v_result := 'RETRY_WAIT';

  elsif p_outcome in ('TRANSIENT_FAILURE','RATE_LIMIT','UNKNOWN')
    and v_job.attempts < v_job.max_attempts then
    if p_outcome = 'RATE_LIMIT' and p_retry_after_seconds is not null then
      v_retry_seconds := greatest(30, least(p_retry_after_seconds, 86400));
    elsif p_outcome = 'TRANSIENT_FAILURE' and p_retry_after_seconds is not null then
      v_retry_seconds := greatest(30, least(p_retry_after_seconds, 3600));
    else
      v_retry_seconds := least(
        3600,
        (120 * power(2, greatest(v_job.attempts - 1, 0)))::integer
        + floor(random() * 31)::integer
      );
    end if;

    update public.scheduled_jobs
       set status = 'RETRY_WAIT',
           run_at = now() + make_interval(secs => v_retry_seconds),
           locked_until = null,
           last_error_code = p_error_code,
           updated_at = now()
     where id = v_job.id;

    update public.post_targets
       set state = 'UNKNOWN',
           updated_at = now()
     where id = v_job.post_target_id
       and organization_id = v_job.organization_id;

    v_result := 'UNKNOWN';

  elsif p_outcome = 'AUTH_REQUIRED' then
    update public.scheduled_jobs
       set status = 'FAILED',
           locked_until = null,
           last_error_code = coalesce(p_error_code, 'AUTH_REQUIRED'),
           updated_at = now()
     where id = v_job.id;

    update public.post_targets
       set state = 'NEEDS_ACTION',
           updated_at = now()
     where id = v_job.post_target_id
       and organization_id = v_job.organization_id;

    v_result := 'NEEDS_ACTION';

  elsif p_outcome = 'UNKNOWN' then
    update public.scheduled_jobs
       set status = 'FAILED',
           locked_until = null,
           last_error_code = coalesce(p_error_code, 'RECONCILE_UNRESOLVED'),
           updated_at = now()
     where id = v_job.id;

    update public.post_targets
       set state = 'NEEDS_ACTION',
           updated_at = now()
     where id = v_job.post_target_id
       and organization_id = v_job.organization_id;

    v_result := 'NEEDS_ACTION';

  else
    update public.scheduled_jobs
       set status = 'FAILED',
           locked_until = null,
           last_error_code = p_error_code,
           updated_at = now()
     where id = v_job.id;

    update public.post_targets
       set state = 'FAILED_FINAL',
           updated_at = now()
     where id = v_job.post_target_id
       and organization_id = v_job.organization_id;

    v_result := 'FAILED_FINAL';
  end if;

  return v_result;
end;
$function$;

revoke all on function public.worker_finish_reconcile_job(uuid,text,text,text,integer,text,integer)
from public, anon, authenticated;
grant execute on function public.worker_finish_reconcile_job(uuid,text,text,text,integer,text,integer)
to service_role;
