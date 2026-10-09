-- Carrossel de imagens para Instagram/Facebook.
-- Mantém a posição 0 como mídia principal e posições 1..9 como itens adicionais.

create or replace function public.attach_media_items_to_post(
  p_post_id uuid,
  p_media_asset_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_brand_id uuid;
  v_count integer := 0;
  v_expected integer := coalesce(array_length(p_media_asset_ids, 1), 0);
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_expected < 2 or v_expected > 10 then
    raise exception 'carousel must contain between 2 and 10 items' using errcode = '22023';
  end if;

  select p.organization_id, p.brand_id into v_org_id, v_brand_id
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

  if (
    select count(*)
    from public.media_assets ma
    where ma.id = any(p_media_asset_ids)
      and ma.organization_id = v_org_id
      and (ma.brand_id is null or ma.brand_id = v_brand_id)
      and ma.processing_status = 'READY'
      and ma.deleted_at is null
      and ma.mime_type like 'image/%'
  ) <> v_expected then
    raise exception 'one or more carousel assets are unavailable' using errcode = '42501';
  end if;

  delete from public.post_target_media ptm
  where ptm.post_target_id in (
    select pt.id from public.post_targets pt
    where pt.post_id = p_post_id and pt.organization_id = v_org_id
  )
    and ptm.position between 0 and 9;

  insert into public.post_target_media (organization_id, post_target_id, media_asset_id, position, role)
  select pt.organization_id, pt.id, item.media_id, item.ord - 1,
         case when item.ord = 1 then 'PRIMARY' else 'CAROUSEL' end
  from public.post_targets pt
  cross join lateral unnest(p_media_asset_ids) with ordinality as item(media_id, ord)
  where pt.post_id = p_post_id
    and pt.organization_id = v_org_id
  on conflict (post_target_id, position)
  do update set media_asset_id = excluded.media_asset_id, role = excluded.role;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.attach_media_items_to_post(uuid,uuid[]) from public;
grant execute on function public.attach_media_items_to_post(uuid,uuid[]) to authenticated;

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
        'id', ma.id, 'object_key', ma.object_key, 'filename', ma.filename,
        'mime_type', ma.mime_type, 'size_bytes', ma.size_bytes,
        'duration_ms', ma.duration_ms, 'width', ma.width, 'height', ma.height,
        'storage_class', ma.storage_class, 'origin', ma.origin,
        'processing_status', ma.processing_status, 'metadata', ma.metadata
      )
    end,
    'media_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', carousel_ma.id, 'object_key', carousel_ma.object_key, 'filename', carousel_ma.filename,
        'mime_type', carousel_ma.mime_type, 'size_bytes', carousel_ma.size_bytes,
        'duration_ms', carousel_ma.duration_ms, 'width', carousel_ma.width, 'height', carousel_ma.height,
        'storage_class', carousel_ma.storage_class, 'origin', carousel_ma.origin,
        'processing_status', carousel_ma.processing_status, 'metadata', carousel_ma.metadata
      ) order by carousel_ptm.position)
      from public.post_target_media carousel_ptm
      join public.media_assets carousel_ma
        on carousel_ma.id = carousel_ptm.media_asset_id
       and carousel_ma.organization_id = carousel_ptm.organization_id
       and carousel_ma.deleted_at is null
      where carousel_ptm.post_target_id = pt.id
        and carousel_ptm.organization_id = pt.organization_id
        and carousel_ptm.position between 0 and 9
    ), '[]'::jsonb),
    'cover_media', case
      when cover_ma.id is null then null
      else jsonb_build_object(
        'id', cover_ma.id, 'object_key', cover_ma.object_key, 'filename', cover_ma.filename,
        'mime_type', cover_ma.mime_type, 'size_bytes', cover_ma.size_bytes,
        'duration_ms', cover_ma.duration_ms, 'width', cover_ma.width, 'height', cover_ma.height,
        'storage_class', cover_ma.storage_class, 'origin', cover_ma.origin,
        'processing_status', cover_ma.processing_status, 'metadata', cover_ma.metadata
      )
    end
  ) into v_context
  from public.post_targets pt
  join public.posts p on p.id = pt.post_id and p.organization_id = pt.organization_id
  join public.social_connections sc on sc.id = pt.social_connection_id and sc.organization_id = pt.organization_id
  left join private.oauth_credentials oc on oc.social_connection_id = sc.id
  left join public.post_target_media ptm
    on ptm.post_target_id = pt.id and ptm.organization_id = pt.organization_id and ptm.position = 0
  left join public.media_assets ma
    on ma.id = ptm.media_asset_id and ma.organization_id = pt.organization_id and ma.deleted_at is null
  left join public.post_target_media cover_ptm
    on cover_ptm.post_target_id = pt.id and cover_ptm.organization_id = pt.organization_id and cover_ptm.position = 100
  left join public.media_assets cover_ma
    on cover_ma.id = cover_ptm.media_asset_id and cover_ma.organization_id = pt.organization_id and cover_ma.deleted_at is null
  where pt.id = p_post_target_id
  limit 1;

  if v_context is null then
    raise exception 'publication target not found' using errcode = '22023';
  end if;
  return v_context;
end;
$function$;

revoke all on function public.worker_get_publication_context(uuid) from public, anon, authenticated;
grant execute on function public.worker_get_publication_context(uuid) to service_role;
