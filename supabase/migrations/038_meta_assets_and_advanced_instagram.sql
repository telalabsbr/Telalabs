create table public.meta_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid not null,
  page_id text not null,
  page_name text not null,
  page_tasks text[] not null default '{}'::text[],
  instagram_business_account_id text,
  instagram_username text,
  instagram_name text,
  scopes text[] not null default '{}'::text[],
  status text not null default 'ACTIVE' check (status in ('ACTIVE','REAUTH_REQUIRED','REVOKED','ERROR')),
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_assets_brand_org_fkey foreign key (brand_id, organization_id)
    references public.brands(id, organization_id) on delete cascade,
  constraint meta_assets_org_page_unique unique (organization_id, page_id)
);

create index meta_assets_brand_idx on public.meta_assets(brand_id);
create index meta_assets_brand_org_idx on public.meta_assets(brand_id, organization_id);
create index meta_assets_instagram_idx on public.meta_assets(organization_id, instagram_business_account_id)
  where instagram_business_account_id is not null;

alter table public.meta_assets enable row level security;
revoke all on table public.meta_assets from public, anon;
revoke insert, update, delete on table public.meta_assets from authenticated;
grant select on table public.meta_assets to authenticated;

create policy meta_assets_select on public.meta_assets
  for select to authenticated
  using (private.is_org_member(organization_id));

create table private.meta_asset_credentials (
  meta_asset_id uuid primary key references public.meta_assets(id) on delete cascade,
  access_token_ciphertext text not null,
  expires_at timestamptz,
  key_version text not null default 'aes-gcm-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on table private.meta_asset_credentials from public, anon, authenticated;

create or replace function public.server_upsert_meta_asset(
  p_organization_id uuid,
  p_brand_id uuid,
  p_page_id text,
  p_page_name text,
  p_page_tasks text[],
  p_instagram_business_account_id text,
  p_instagram_username text,
  p_instagram_name text,
  p_scopes text[],
  p_access_token_ciphertext text,
  p_expires_at timestamptz default null,
  p_key_version text default 'aes-gcm-v1'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_asset_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.brands b
    where b.id = p_brand_id
      and b.organization_id = p_organization_id
      and b.status = 'ACTIVE'
      and b.deleted_at is null
  ) then
    raise exception 'brand does not belong to organization' using errcode = '23503';
  end if;

  insert into public.meta_assets (
    organization_id, brand_id, page_id, page_name, page_tasks,
    instagram_business_account_id, instagram_username, instagram_name,
    scopes, status, discovered_at, updated_at
  ) values (
    p_organization_id, p_brand_id, p_page_id, p_page_name,
    coalesce(p_page_tasks, '{}'::text[]), nullif(p_instagram_business_account_id, ''),
    nullif(p_instagram_username, ''), nullif(p_instagram_name, ''),
    coalesce(p_scopes, '{}'::text[]), 'ACTIVE', now(), now()
  )
  on conflict (organization_id, page_id)
  do update set
    brand_id = excluded.brand_id,
    page_name = excluded.page_name,
    page_tasks = excluded.page_tasks,
    instagram_business_account_id = excluded.instagram_business_account_id,
    instagram_username = excluded.instagram_username,
    instagram_name = excluded.instagram_name,
    scopes = excluded.scopes,
    status = 'ACTIVE',
    discovered_at = now(),
    updated_at = now()
  returning id into v_asset_id;

  insert into private.meta_asset_credentials (
    meta_asset_id, access_token_ciphertext, expires_at, key_version
  ) values (
    v_asset_id, p_access_token_ciphertext, p_expires_at, p_key_version
  )
  on conflict (meta_asset_id)
  do update set
    access_token_ciphertext = excluded.access_token_ciphertext,
    expires_at = excluded.expires_at,
    key_version = excluded.key_version,
    updated_at = now();

  return v_asset_id;
end;
$function$;

revoke all on function public.server_upsert_meta_asset(uuid,uuid,text,text,text[],text,text,text,text[],text,timestamptz,text)
  from public, anon, authenticated;
grant execute on function public.server_upsert_meta_asset(uuid,uuid,text,text,text[],text,text,text,text[],text,timestamptz,text)
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
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select * into v_connection from public.social_connections where id = p_connection_id;
  select * into v_asset from public.meta_assets where id = p_meta_asset_id and status = 'ACTIVE';

  if v_connection.id is null or v_connection.provider <> 'instagram' then
    raise exception 'instagram connection not found' using errcode = 'P0002';
  end if;

  if v_asset.id is null
     or v_asset.organization_id <> v_connection.organization_id
     or v_asset.brand_id <> v_connection.brand_id
     or v_asset.instagram_business_account_id is null
     or v_asset.instagram_business_account_id <> v_connection.provider_account_id then
    raise exception 'meta asset does not match instagram connection' using errcode = '23514';
  end if;

  update public.social_connections
     set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
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

revoke all on function public.server_enable_instagram_advanced(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.server_enable_instagram_advanced(uuid,uuid)
  to service_role;

create or replace function public.server_connect_facebook_meta_asset(
  p_meta_asset_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_asset public.meta_assets%rowtype;
  v_credential private.meta_asset_credentials%rowtype;
  v_connection_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select * into v_asset from public.meta_assets where id = p_meta_asset_id and status = 'ACTIVE';
  select * into v_credential from private.meta_asset_credentials where meta_asset_id = p_meta_asset_id;

  if v_asset.id is null or v_credential.meta_asset_id is null then
    raise exception 'meta asset credential not found' using errcode = 'P0002';
  end if;

  insert into public.social_connections (
    organization_id, brand_id, provider, provider_account_id,
    display_name, username, connection_status, scopes,
    token_expires_at, last_health_at, metadata
  ) values (
    v_asset.organization_id, v_asset.brand_id, 'facebook', v_asset.page_id,
    v_asset.page_name, null, 'CONNECTED', v_asset.scopes,
    v_credential.expires_at, now(), jsonb_build_object(
      'source', 'meta_asset',
      'meta_asset_id', v_asset.id,
      'page_tasks', v_asset.page_tasks,
      'instagram_business_account_id', v_asset.instagram_business_account_id
    )
  )
  on conflict (provider, provider_account_id, organization_id)
  do update set
    brand_id = excluded.brand_id,
    display_name = excluded.display_name,
    connection_status = 'CONNECTED',
    scopes = excluded.scopes,
    token_expires_at = excluded.token_expires_at,
    last_health_at = now(),
    metadata = excluded.metadata,
    updated_at = now()
  returning id into v_connection_id;

  insert into private.oauth_credentials (
    social_connection_id, media_source_id, commerce_connection_id,
    access_token_ciphertext, refresh_token_ciphertext,
    expires_at, key_version
  ) values (
    v_connection_id, null, null,
    v_credential.access_token_ciphertext, null,
    v_credential.expires_at, v_credential.key_version
  )
  on conflict (social_connection_id)
  do update set
    access_token_ciphertext = excluded.access_token_ciphertext,
    refresh_token_ciphertext = null,
    expires_at = excluded.expires_at,
    key_version = excluded.key_version,
    updated_at = now();

  return v_connection_id;
end;
$function$;

revoke all on function public.server_connect_facebook_meta_asset(uuid)
  from public, anon, authenticated;
grant execute on function public.server_connect_facebook_meta_asset(uuid)
  to service_role;

create or replace function public.server_get_meta_asset_credential(
  p_meta_asset_id uuid
)
returns table(access_token_ciphertext text, expires_at timestamptz, key_version text)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  return query
    select c.access_token_ciphertext, c.expires_at, c.key_version
      from private.meta_asset_credentials c
      join public.meta_assets a on a.id = c.meta_asset_id
     where c.meta_asset_id = p_meta_asset_id
       and a.status = 'ACTIVE';
end;
$function$;

revoke all on function public.server_get_meta_asset_credential(uuid)
  from public, anon, authenticated;
grant execute on function public.server_get_meta_asset_credential(uuid)
  to service_role;
