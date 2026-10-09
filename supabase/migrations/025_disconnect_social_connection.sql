-- Desconecta uma conta social localmente, removendo a credencial privada.
-- Espelha a migration 025 aplicada no Supabase oficial.

create or replace function public.disconnect_social_connection(p_connection_id uuid)
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

  select sc.organization_id into v_org_id
  from public.social_connections sc
  join public.memberships m
    on m.organization_id = sc.organization_id
   and m.user_id = v_user_id
   and m.status = 'ACTIVE'
   and m.role in ('OWNER','ADMIN','MANAGER')
  where sc.id = p_connection_id
  limit 1;

  if v_org_id is null then
    raise exception 'connection not found or not accessible' using errcode = '42501';
  end if;

  delete from private.oauth_credentials
   where social_connection_id = p_connection_id;

  update public.social_connections
     set connection_status = 'REVOKED',
         token_expires_at = null,
         last_health_at = now(),
         updated_at = now(),
         metadata = coalesce(metadata, '{}'::jsonb)
           || jsonb_build_object('disconnected_at', now(), 'disconnected_locally', true)
   where id = p_connection_id
     and organization_id = v_org_id;

  return true;
end;
$function$;

revoke all on function public.disconnect_social_connection(uuid) from public;
grant execute on function public.disconnect_social_connection(uuid) to authenticated;
