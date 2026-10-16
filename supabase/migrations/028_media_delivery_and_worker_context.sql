-- Contexto server-only para publicação e tokens opacos de entrega de mídia.
-- Espelha a migration 028 aplicada no projeto Supabase oficial.

create or replace function public.worker_get_publication_context(
  p_post_target_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_context jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'target', jsonb_build_object(
      'id', pt.id,
      'organization_id', pt.organization_id,
      'post_id', pt.post_id,
      'social_connection_id', pt.social_connection_id,
      'provider', pt.provider,
      'content_intent', coalesce(pt.content_intent_override, 'AUTO'),
      'caption', coalesce(pt.caption_override, p.base_caption, ''),
      'title', coalesce(pt.title_override, p.internal_title, ''),
      'provider_config', pt.provider_config,
      'scheduled_at', pt.scheduled_at,
      'state', pt.state
    ),
    'connection', jsonb_build_object(
      'id', sc.id,
      'provider_account_id', sc.provider_account_id,
      'display_name', sc.display_name,
      'username', sc.username,
      'connection_status', sc.connection_status,
      'scopes', sc.scopes,
      'token_expires_at', sc.token_expires_at,
      'metadata', sc.metadata
    ),
    'credential', case
      when oc.social_connection_id is null then null
      else jsonb_build_object(
        'access_token_ciphertext', oc.access_token_ciphertext,
        'refresh_token_ciphertext', oc.refresh_token_ciphertext,
        'expires_at', oc.expires_at,
        'key_version', oc.key_version
      )
    end,
    'post', jsonb_build_object(
      'id', p.id,
      'brand_id', p.brand_id,
      'internal_title', p.internal_title,
      'base_caption', p.base_caption
    ),
    'media', case
      when ma.id is null then null
      else jsonb_build_object(
        'id', ma.id,
        'object_key', ma.object_key,
        'filename', ma.filename,
        'mime_type', ma.mime_type,
        'size_bytes', ma.size_bytes,
        'duration_ms', ma.duration_ms,
        'width', ma.width,
        'height', ma.height,
        'storage_class', ma.storage_class,
        'origin', ma.origin,
        'processing_status', ma.processing_status,
        'metadata', ma.metadata
      )
    end
  )
  into v_context
  from public.post_targets pt
  join public.posts p
    on p.id = pt.post_id
   and p.organization_id = pt.organization_id
  join public.social_connections sc
    on sc.id = pt.social_connection_id
   and sc.organization_id = pt.organization_id
  left join private.oauth_credentials oc
    on oc.social_connection_id = sc.id
  left join public.post_target_media ptm
    on ptm.post_target_id = pt.id
   and ptm.organization_id = pt.organization_id
   and ptm.position = 0
  left join public.media_assets ma
    on ma.id = ptm.media_asset_id
   and ma.organization_id = pt.organization_id
   and ma.deleted_at is null
  where pt.id = p_post_target_id
  limit 1;

  if v_context is null then
    raise exception 'publication target not found' using errcode = '22023';
  end if;

  return v_context;
end;
$function$;

revoke all on function public.worker_get_publication_context(uuid)
from public, anon, authenticated;
grant execute on function public.worker_get_publication_context(uuid)
to service_role;

create or replace function public.server_issue_media_delivery_token(
  p_post_target_id uuid,
  p_media_asset_id uuid,
  p_ttl_seconds integer default 21600,
  p_max_uses integer default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_token text;
  v_ttl integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if p_max_uses is not null and p_max_uses <= 0 then
    raise exception 'max uses must be positive' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.post_target_media ptm
    join public.media_assets ma
      on ma.id = ptm.media_asset_id
     and ma.organization_id = ptm.organization_id
    join public.post_targets pt
      on pt.id = ptm.post_target_id
     and pt.organization_id = ptm.organization_id
    where ptm.post_target_id = p_post_target_id
      and ptm.media_asset_id = p_media_asset_id
      and ma.processing_status = 'READY'
      and ma.deleted_at is null
  ) then
    raise exception 'media asset is not ready or not attached to target' using errcode = '42501';
  end if;

  v_ttl := greatest(60, least(coalesce(p_ttl_seconds, 21600), 86400));
  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into private.media_delivery_tokens (
    token_hash,
    media_asset_id,
    post_target_id,
    expires_at,
    max_uses
  )
  values (
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    p_media_asset_id,
    p_post_target_id,
    now() + make_interval(secs => v_ttl),
    p_max_uses
  );

  return v_token;
end;
$function$;

revoke all on function public.server_issue_media_delivery_token(uuid,uuid,integer,integer)
from public, anon, authenticated;
grant execute on function public.server_issue_media_delivery_token(uuid,uuid,integer,integer)
to service_role;

create or replace function public.server_consume_media_delivery_token(
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_media_asset_id uuid;
  v_post_target_id uuid;
  v_result jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  update private.media_delivery_tokens t
     set used_count = t.used_count + 1
   where t.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and t.revoked_at is null
     and t.expires_at > now()
     and (t.max_uses is null or t.used_count < t.max_uses)
  returning t.media_asset_id, t.post_target_id
       into v_media_asset_id, v_post_target_id;

  if v_media_asset_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'media_asset_id', ma.id,
    'post_target_id', v_post_target_id,
    'object_key', ma.object_key,
    'filename', ma.filename,
    'mime_type', ma.mime_type,
    'size_bytes', ma.size_bytes,
    'storage_class', ma.storage_class,
    'processing_status', ma.processing_status
  )
  into v_result
  from public.media_assets ma
  where ma.id = v_media_asset_id
    and ma.processing_status = 'READY'
    and ma.deleted_at is null
    and ma.object_key is not null;

  return v_result;
end;
$function$;

revoke all on function public.server_consume_media_delivery_token(text)
from public, anon, authenticated;
grant execute on function public.server_consume_media_delivery_token(text)
to service_role;

create or replace function public.server_revoke_media_delivery_tokens(
  p_post_target_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  update private.media_delivery_tokens
     set revoked_at = coalesce(revoked_at, now())
   where post_target_id = p_post_target_id
     and revoked_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.server_revoke_media_delivery_tokens(uuid)
from public, anon, authenticated;
grant execute on function public.server_revoke_media_delivery_tokens(uuid)
to service_role;
