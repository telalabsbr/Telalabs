create or replace function public.worker_claim_publication_jobs_for_post(
  p_post_id uuid,
  p_providers text[],
  p_limit integer default 10,
  p_lock_seconds integer default 120
)
returns table(
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
as $$
declare
  v_job record;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if p_post_id is null or p_providers is null or cardinality(p_providers) = 0 then
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
      join public.posts p
        on p.id = pt.post_id
       and p.organization_id = pt.organization_id
     where p.id = p_post_id
       and p.deleted_at is null
       and j.job_type = 'PUBLISH_TARGET'
       and j.status in ('READY','RETRY_WAIT')
       and j.run_at <= now()
       and (j.locked_until is null or j.locked_until < now())
       and pt.state in ('SCHEDULED','RETRY_WAIT')
       and pt.provider = any(p_providers)
     order by j.run_at, j.created_at
     for update of j skip locked
     limit greatest(1, least(coalesce(p_limit, 10), 100))
  loop
    update public.scheduled_jobs sj
       set status = 'RUNNING',
           attempts = sj.attempts + 1,
           locked_until = now() + make_interval(secs => greatest(30, least(coalesce(p_lock_seconds, 120), 900))),
           updated_at = now()
     where sj.id = v_job.id;

    update public.post_targets pt2
       set state = 'PUBLISHING',
           updated_at = now()
     where pt2.id = v_job.post_target_id
       and pt2.organization_id = v_job.organization_id;

    insert into public.publication_attempts (
      organization_id,
      post_target_id,
      job_id,
      attempt_no,
      operation,
      operation_key,
      outcome
    ) values (
      v_job.organization_id,
      v_job.post_target_id,
      v_job.id,
      v_job.attempts + 1,
      'PUBLISH',
      'publish:' || v_job.id::text || ':' || (v_job.attempts + 1)::text,
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
$$;

revoke all on function public.worker_claim_publication_jobs_for_post(uuid, text[], integer, integer) from public;
grant execute on function public.worker_claim_publication_jobs_for_post(uuid, text[], integer, integer) to service_role;
