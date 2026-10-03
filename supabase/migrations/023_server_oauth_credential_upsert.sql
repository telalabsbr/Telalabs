-- Escrita atômica server-only de conexão social + credencial criptografada.
-- Espelha a migration 023 aplicada no projeto Supabase oficial.

create or replace function public.server_upsert_oauth_connection(
  p_organization_id uuid,
  p_brand_id uuid,
  p_provider text,
  p_provider_account_id text,
  p_display_name text,
  p_username text,
  p_scopes text[],
  p_token_expires_at timestamptz,
  p_metadata jsonb,
  p_access_token_ciphertext text,
  p_refresh_token_ciphertext text default null,
  p_key_version text default 'aes-gcm-v1'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_connection_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if not exists (
    select 1
      from public.brands b
     where b.id = p_brand_id
       and b.organization_id = p_organization_id
       and b.status = 'ACTIVE'
       and b.deleted_at is null
  ) then
    raise exception 'brand does not belong to organization' using errcode = '23503';
  end if;

  insert into public.social_connections (
    organization_id, brand_id, provider, provider_account_id,
    display_name, username, connection_status, scopes,
    token_expires_at, last_health_at, metadata
  )
  values (
    p_organization_id, p_brand_id, lower(p_provider), p_provider_account_id,
    p_display_name, nullif(p_username, ''), 'CONNECTED',
    coalesce(p_scopes, '{}'::text[]), p_token_expires_at, now(),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (provider, provider_account_id, organization_id)
  do update set
    brand_id = excluded.brand_id,
    display_name = excluded.display_name,
    username = excluded.username,
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
  )
  values (
    v_connection_id, null, null, p_access_token_ciphertext,
    p_refresh_token_ciphertext, p_token_expires_at, p_key_version
  )
  on conflict (social_connection_id)
  do update set
    access_token_ciphertext = excluded.access_token_ciphertext,
    refresh_token_ciphertext = excluded.refresh_token_ciphertext,
    expires_at = excluded.expires_at,
    key_version = excluded.key_version,
    updated_at = now();

  return v_connection_id;
end;
$function$;

revoke all on function public.server_upsert_oauth_connection(uuid,uuid,text,text,text,text,text[],timestamptz,jsonb,text,text,text)
from public, anon, authenticated;
grant execute on function public.server_upsert_oauth_connection(uuid,uuid,text,text,text,text,text[],timestamptz,jsonb,text,text,text)
to service_role;
