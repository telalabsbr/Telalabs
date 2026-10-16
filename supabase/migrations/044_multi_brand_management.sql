-- Multi-brand management: authenticated organization managers can create
-- additional brands while RLS keeps each organization isolated.

create or replace function public.create_brand(
  p_name text,
  p_timezone text default 'America/Sao_Paulo'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_brand_id uuid;
  v_name text := nullif(btrim(p_name), '');
  v_timezone text := coalesce(nullif(btrim(p_timezone), ''), 'America/Sao_Paulo');
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if v_name is null then
    raise exception 'brand name required' using errcode = '22023';
  end if;

  if char_length(v_name) > 80 then
    raise exception 'brand name too long' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names tz
    where tz.name = v_timezone
  ) then
    raise exception 'invalid timezone' using errcode = '22023';
  end if;

  select m.organization_id
    into v_org_id
  from public.memberships m
  where m.user_id = v_user_id
    and m.status = 'ACTIVE'
    and m.role in ('OWNER','ADMIN','MANAGER')
  order by m.created_at
  limit 1;

  if v_org_id is null then
    raise exception 'organization management permission required' using errcode = '42501';
  end if;

  insert into public.brands (
    organization_id,
    name,
    slug,
    timezone,
    locale,
    status
  )
  values (
    v_org_id,
    v_name,
    'brand-' || substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 16),
    v_timezone,
    'pt-BR',
    'ACTIVE'
  )
  returning id into v_brand_id;

  return v_brand_id;
end;
$function$;

revoke all on function public.create_brand(text,text) from public, anon;
grant execute on function public.create_brand(text,text) to authenticated;
