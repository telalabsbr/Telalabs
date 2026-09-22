-- Vincula uma mídia pronta aos destinos de uma publicação, com autorização por organização.
-- Espelha a migration 024 aplicada no Supabase oficial.

create or replace function public.attach_media_to_post(
  p_post_id uuid,
  p_media_asset_id uuid
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
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select p.organization_id, p.brand_id
    into v_org_id, v_brand_id
  from public.posts p
  join public.memberships m
    on m.organization_id = p.organization_id
   and m.user_id = v_user_id
   and m.status = 'ACTIVE'
   and m.role in ('OWNER','ADMIN','MANAGER','CREATOR')
  where p.id = p_post_id
    and p.deleted_at is null
  limit 1;

  if v_org_id is null then
    raise exception 'post not found or not accessible' using errcode = '42501';
  end if;

  if not exists (
    select 1
      from public.media_assets ma
     where ma.id = p_media_asset_id
       and ma.organization_id = v_org_id
       and (ma.brand_id is null or ma.brand_id = v_brand_id)
       and ma.processing_status = 'READY'
       and ma.deleted_at is null
  ) then
    raise exception 'media asset is not ready or not accessible' using errcode = '42501';
  end if;

  insert into public.post_target_media (
    organization_id, post_target_id, media_asset_id, position, role
  )
  select pt.organization_id, pt.id, p_media_asset_id, 0, 'PRIMARY'
  from public.post_targets pt
  where pt.post_id = p_post_id
    and pt.organization_id = v_org_id
  on conflict (post_target_id, position)
  do update set
    media_asset_id = excluded.media_asset_id,
    role = excluded.role;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.attach_media_to_post(uuid,uuid) from public;
grant execute on function public.attach_media_to_post(uuid,uuid) to authenticated;
