create or replace function public.server_mark_instagram_meta_authorized(
  p_connection_id uuid,
  p_link_required boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_connection public.social_connections%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select * into v_connection
    from public.social_connections
   where id = p_connection_id;

  if v_connection.id is null or v_connection.provider <> 'instagram' then
    raise exception 'instagram connection not found' using errcode = 'P0002';
  end if;

  update public.social_connections
     set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
       'meta_authorized', true,
       'meta_link_required', coalesce(p_link_required, true),
       'meta_authorized_at', now()
     ),
     updated_at = now()
   where id = p_connection_id;

  return true;
end;
$function$;

revoke all on function public.server_mark_instagram_meta_authorized(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.server_mark_instagram_meta_authorized(uuid, boolean)
  to service_role;

create or replace function public.server_enable_instagram_advanced(
  p_connection_id uuid,
  p_meta_asset_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_connection public.social_connections%rowtype;
  v_asset public.meta_assets%rowtype;
  v_id_matches boolean;
  v_username_matches boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select * into v_connection from public.social_connections where id = p_connection_id;
  select * into v_asset from public.meta_assets where id = p_meta_asset_id and status = 'ACTIVE';

  if v_connection.id is null or v_connection.provider <> 'instagram' then
    raise exception 'instagram connection not found' using errcode = 'P0002';
  end if;

  v_id_matches := v_asset.instagram_business_account_id is not null
    and v_asset.instagram_business_account_id = v_connection.provider_account_id;

  v_username_matches := nullif(lower(trim(both '@' from coalesce(v_asset.instagram_username, ''))), '') is not null
    and nullif(lower(trim(both '@' from coalesce(v_connection.username, ''))), '') is not null
    and lower(trim(both '@' from v_asset.instagram_username)) = lower(trim(both '@' from v_connection.username));

  if v_asset.id is null
     or v_asset.organization_id <> v_connection.organization_id
     or v_asset.brand_id <> v_connection.brand_id
     or not (v_id_matches or v_username_matches) then
    raise exception 'meta asset does not match instagram connection' using errcode = '23514';
  end if;

  update public.social_connections
     set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
       'meta_authorized', true,
       'meta_link_required', false,
       'meta_advanced_enabled', true,
       'meta_asset_id', v_asset.id,
       'linked_page_id', v_asset.page_id,
       'linked_page_name', v_asset.page_name,
       'meta_advanced_enabled_at', now()
     ),
     updated_at = now()
   where id = p_connection_id;

  return true;
end;
$function$;

revoke all on function public.server_enable_instagram_advanced(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.server_enable_instagram_advanced(uuid, uuid)
  to service_role;
