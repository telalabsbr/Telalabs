alter table private.meta_asset_credentials
  add column if not exists user_access_token_ciphertext text,
  add column if not exists user_expires_at timestamptz;

create or replace function public.server_set_meta_asset_user_credential(
  p_meta_asset_id uuid,
  p_user_access_token_ciphertext text,
  p_user_expires_at timestamptz default null,
  p_key_version text default 'aes-gcm-v1'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if nullif(p_user_access_token_ciphertext, '') is null then
    raise exception 'user access token required' using errcode = '22023';
  end if;

  update private.meta_asset_credentials
     set user_access_token_ciphertext = p_user_access_token_ciphertext,
         user_expires_at = p_user_expires_at,
         key_version = coalesce(nullif(p_key_version, ''), key_version),
         updated_at = now()
   where meta_asset_id = p_meta_asset_id;

  if not found then
    raise exception 'meta asset credential not found' using errcode = 'P0002';
  end if;

  return true;
end;
$function$;

revoke all on function public.server_set_meta_asset_user_credential(uuid,text,timestamptz,text)
  from public, anon, authenticated;
grant execute on function public.server_set_meta_asset_user_credential(uuid,text,timestamptz,text)
  to service_role;

create or replace function public.server_get_meta_asset_audio_credential(
  p_meta_asset_id uuid
)
returns table(
  page_access_token_ciphertext text,
  page_expires_at timestamptz,
  user_access_token_ciphertext text,
  user_expires_at timestamptz,
  key_version text,
  instagram_business_account_id text
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  return query
    select
      c.access_token_ciphertext,
      c.expires_at,
      c.user_access_token_ciphertext,
      c.user_expires_at,
      c.key_version,
      a.instagram_business_account_id
    from private.meta_asset_credentials c
    join public.meta_assets a on a.id = c.meta_asset_id
    where c.meta_asset_id = p_meta_asset_id
      and a.status = 'ACTIVE';
end;
$function$;

revoke all on function public.server_get_meta_asset_audio_credential(uuid)
  from public, anon, authenticated;
grant execute on function public.server_get_meta_asset_audio_credential(uuid)
  to service_role;

create or replace function public.set_instagram_audio_config(
  p_post_id uuid,
  p_connection_id uuid,
  p_audio_id text default null,
  p_audio_volume integer default 100,
  p_video_volume integer default 100,
  p_audio_title text default null,
  p_audio_artist text default null,
  p_audio_type text default 'music'
)
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

  if p_audio_volume < 0 or p_audio_volume > 100
     or p_video_volume < 0 or p_video_volume > 100 then
    raise exception 'audio volumes must be between 0 and 100' using errcode = '22023';
  end if;

  if p_audio_type not in ('music', 'original_sound') then
    raise exception 'invalid audio type' using errcode = '22023';
  end if;

  select p.organization_id
    into v_org_id
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
    from public.social_connections sc
    where sc.id = p_connection_id
      and sc.organization_id = v_org_id
      and sc.provider = 'instagram'
      and sc.connection_status = 'CONNECTED'
  ) then
    raise exception 'instagram connection unavailable' using errcode = '42501';
  end if;

  update public.post_targets pt
     set provider_config =
       case
         when nullif(btrim(coalesce(p_audio_id, '')), '') is null then
           (coalesce(pt.provider_config, '{}'::jsonb)
             - 'audio_configuration'
             - 'audio_title'
             - 'audio_artist'
             - 'audio_type')
         else
           coalesce(pt.provider_config, '{}'::jsonb)
           || jsonb_build_object(
             'audio_configuration', jsonb_build_object(
               'audio_id', btrim(p_audio_id),
               'audio_volume', p_audio_volume,
               'video_volume', p_video_volume
             ),
             'audio_title', nullif(btrim(coalesce(p_audio_title, '')), ''),
             'audio_artist', nullif(btrim(coalesce(p_audio_artist, '')), ''),
             'audio_type', p_audio_type
           )
       end,
       updated_at = now()
   where pt.post_id = p_post_id
     and pt.organization_id = v_org_id
     and pt.social_connection_id = p_connection_id
     and pt.provider = 'instagram'
     and coalesce(pt.provider_config->>'surface', '') <> 'story'
     and coalesce(pt.content_intent_override, 'AUTO') <> 'CAROUSEL';

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.set_instagram_audio_config(uuid,uuid,text,integer,integer,text,text,text)
  from public, anon, authenticated;
grant execute on function public.set_instagram_audio_config(uuid,uuid,text,integer,integer,text,text,text)
  to authenticated;
