-- Lifecycle de publicação, superfícies YouTube e ações autenticadas.
-- Espelha a migration 021 já aplicada no projeto Supabase oficial.

create or replace function public.save_post_draft(
  p_brand_id uuid,
  p_internal_title text,
  p_base_caption text,
  p_targets jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_post_id uuid;
  v_target_id uuid;
  v_target jsonb;
  v_connection_id uuid;
  v_provider text;
  v_scheduled_at timestamptz;
  v_timezone text;
  v_caption text;
  v_title text;
  v_requested_action text;
  v_retention text;
  v_surface text;
  v_intent text;
  v_state text;
  v_file_size bigint;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_targets, '[]'::jsonb)) <> 'array' then
    raise exception 'targets must be a JSON array' using errcode = '22023';
  end if;

  select b.organization_id
    into v_org_id
  from public.brands b
  join public.memberships m
    on m.organization_id = b.organization_id
   and m.user_id = v_user_id
   and m.status = 'ACTIVE'
   and m.role in ('OWNER','ADMIN','MANAGER','CREATOR')
  where b.id = p_brand_id
    and b.status = 'ACTIVE'
    and b.deleted_at is null
  limit 1;

  if v_org_id is null then
    raise exception 'brand not found or not accessible' using errcode = '42501';
  end if;

  insert into public.posts (
    organization_id, brand_id, internal_title, base_caption, status, created_by
  )
  values (
    v_org_id, p_brand_id,
    coalesce(nullif(btrim(p_internal_title), ''), 'Nova publicação'),
    nullif(p_base_caption, ''), 'DRAFT', v_user_id
  )
  returning id into v_post_id;

  for v_target in
    select value from jsonb_array_elements(coalesce(p_targets, '[]'::jsonb))
  loop
    v_connection_id := nullif(v_target->>'connection_id', '')::uuid;
    v_provider := lower(coalesce(v_target->>'provider', ''));
    v_requested_action := lower(coalesce(nullif(v_target->>'requested_action', ''), 'draft'));
    v_retention := lower(coalesce(nullif(v_target->>'retention', ''), 'delete'));
    v_surface := lower(coalesce(nullif(v_target->>'surface', ''), ''));
    v_intent := upper(coalesce(nullif(v_target->>'content_intent', ''), 'AUTO'));
    v_file_size := nullif(v_target->>'file_size_bytes', '')::bigint;
    v_timezone := coalesce(nullif(v_target->>'scheduled_timezone', ''), 'UTC');
    v_caption := nullif(v_target->>'caption_override', '');
    v_title := nullif(v_target->>'title_override', '');

    if v_requested_action not in ('draft','schedule','publish_now') then
      raise exception 'invalid requested action' using errcode = '22023';
    end if;

    if v_retention not in ('delete','library') then
      raise exception 'invalid retention mode' using errcode = '22023';
    end if;

    if v_intent not in ('AUTO','SHORT_FORM','LONG_FORM','IMAGE','CAROUSEL','TEXT') then
      raise exception 'invalid content intent' using errcode = '22023';
    end if;

    if v_provider = 'youtube' and v_intent = 'LONG_FORM' and coalesce(v_file_size, 0) > 10737418240 then
      raise exception 'youtube long-form file exceeds 10 GB launch limit' using errcode = '22023';
    end if;

    if v_connection_id is null or v_provider = '' then
      raise exception 'target connection/provider is required' using errcode = '22023';
    end if;

    if not exists (
      select 1
      from public.social_connections sc
      where sc.id = v_connection_id
        and sc.organization_id = v_org_id
        and sc.provider = v_provider
        and sc.connection_status = 'CONNECTED'
    ) then
      raise exception 'target connection is unavailable or does not belong to organization/provider' using errcode = '42501';
    end if;

    if v_requested_action = 'publish_now' then
      v_scheduled_at := now();
      v_state := 'SCHEDULED';
    elsif v_requested_action = 'schedule' then
      v_scheduled_at := coalesce(nullif(v_target->>'scheduled_at', '')::timestamptz, now());
      v_state := 'SCHEDULED';
    else
      v_scheduled_at := coalesce(nullif(v_target->>'scheduled_at', '')::timestamptz, now());
      v_state := 'DRAFT';
    end if;

    insert into public.post_targets (
      organization_id, post_id, social_connection_id, provider, publish_mode,
      content_intent_override, state, scheduled_at, scheduled_timezone,
      provider_config, idempotency_key, caption_override, title_override
    )
    values (
      v_org_id, v_post_id, v_connection_id, v_provider, 'AUTO',
      v_intent, v_state, v_scheduled_at, v_timezone,
      jsonb_build_object(
        'requested_action', v_requested_action,
        'retention', v_retention,
        'surface', nullif(v_surface, ''),
        'file_size_bytes', v_file_size,
        'media_pipeline',
          case
            when v_provider = 'youtube'
             and v_intent = 'LONG_FORM'
             and coalesce(v_file_size, 0) > 2147483648
              then 'LARGE_FILE_TEMP'
            else 'STANDARD'
          end,
        'source', 'composer'
      ),
      'post:' || v_post_id::text || ':' || v_connection_id::text || ':' || v_intent,
      v_caption, v_title
    )
    returning id into v_target_id;

    if v_requested_action <> 'draft' then
      insert into public.scheduled_jobs (
        organization_id, post_target_id, job_type, run_at, status,
        attempts, max_attempts, dedupe_key, payload
      )
      values (
        v_org_id, v_target_id, 'PUBLISH_TARGET', v_scheduled_at, 'READY',
        0, 3, 'publish:v1:' || v_target_id::text || ':1',
        jsonb_build_object(
          'requested_action', v_requested_action,
          'provider', v_provider,
          'content_intent', v_intent,
          'surface', nullif(v_surface, '')
        )
      );
    end if;
  end loop;

  return v_post_id;
end;
$function$;

revoke all on function public.save_post_draft(uuid,text,text,jsonb) from public;
grant execute on function public.save_post_draft(uuid,text,text,jsonb) to authenticated;

create or replace function public.cancel_post(p_post_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select p.organization_id into v_org_id
  from public.posts p
  join public.memberships m
    on m.organization_id = p.organization_id
   and m.user_id = v_user_id
   and m.status = 'ACTIVE'
   and m.role in ('OWNER','ADMIN','MANAGER','CREATOR')
  where p.id = p_post_id and p.deleted_at is null
  limit 1;

  if v_org_id is null then
    raise exception 'post not found or not accessible' using errcode = '42501';
  end if;

  update public.scheduled_jobs j
     set status = 'CANCELLED', updated_at = now()
   where j.organization_id = v_org_id
     and j.post_target_id in (
       select pt.id from public.post_targets pt
       where pt.post_id = p_post_id and pt.organization_id = v_org_id
     )
     and j.status in ('READY','RETRY_WAIT');

  update public.post_targets pt
     set state = 'CANCELLED', updated_at = now()
   where pt.post_id = p_post_id
     and pt.organization_id = v_org_id
     and pt.state in ('DRAFT','VALIDATING','SCHEDULED','PREPARING','STAGED','RETRY_WAIT');

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.cancel_post(uuid) from public;
grant execute on function public.cancel_post(uuid) to authenticated;

create or replace function public.soft_delete_post(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select p.organization_id into v_org_id
  from public.posts p
  join public.memberships m
    on m.organization_id = p.organization_id
   and m.user_id = v_user_id
   and m.status = 'ACTIVE'
   and m.role in ('OWNER','ADMIN','MANAGER','CREATOR')
  where p.id = p_post_id and p.deleted_at is null
  limit 1;

  if v_org_id is null then
    raise exception 'post not found or not accessible' using errcode = '42501';
  end if;

  update public.scheduled_jobs j
     set status = 'CANCELLED', updated_at = now()
   where j.organization_id = v_org_id
     and j.post_target_id in (
       select pt.id from public.post_targets pt
       where pt.post_id = p_post_id and pt.organization_id = v_org_id
     )
     and j.status in ('READY','RETRY_WAIT');

  update public.post_targets pt
     set state = case
       when pt.state in ('DRAFT','VALIDATING','SCHEDULED','PREPARING','STAGED','RETRY_WAIT') then 'CANCELLED'
       else pt.state
     end,
     updated_at = now()
   where pt.post_id = p_post_id
     and pt.organization_id = v_org_id;

  update public.posts
     set deleted_at = now(), updated_at = now()
   where id = p_post_id and organization_id = v_org_id;

  return true;
end;
$function$;

revoke all on function public.soft_delete_post(uuid) from public;
grant execute on function public.soft_delete_post(uuid) to authenticated;

create or replace function public.retry_failed_targets(p_post_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_row record;
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select p.organization_id into v_org_id
  from public.posts p
  join public.memberships m
    on m.organization_id = p.organization_id
   and m.user_id = v_user_id
   and m.status = 'ACTIVE'
   and m.role in ('OWNER','ADMIN','MANAGER','CREATOR')
  where p.id = p_post_id and p.deleted_at is null
  limit 1;

  if v_org_id is null then
    raise exception 'post not found or not accessible' using errcode = '42501';
  end if;

  for v_row in
    update public.post_targets pt
       set state = 'SCHEDULED',
           scheduled_at = now(),
           schedule_version = pt.schedule_version + 1,
           provider_config = coalesce(pt.provider_config, '{}'::jsonb)
             || jsonb_build_object('requested_action','manual_retry'),
           updated_at = now()
     where pt.post_id = p_post_id
       and pt.organization_id = v_org_id
       and pt.state = 'FAILED_FINAL'
    returning pt.id, pt.provider, pt.content_intent_override, pt.schedule_version
  loop
    insert into public.scheduled_jobs (
      organization_id, post_target_id, job_type, run_at, status,
      attempts, max_attempts, dedupe_key, payload
    )
    values (
      v_org_id, v_row.id, 'PUBLISH_TARGET', now(), 'READY',
      0, 3,
      'manual-retry:' || v_row.id::text || ':' || v_row.schedule_version::text,
      jsonb_build_object(
        'requested_action','manual_retry',
        'provider',v_row.provider,
        'content_intent',v_row.content_intent_override
      )
    )
    on conflict (dedupe_key) do nothing;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

revoke all on function public.retry_failed_targets(uuid) from public;
grant execute on function public.retry_failed_targets(uuid) to authenticated;
