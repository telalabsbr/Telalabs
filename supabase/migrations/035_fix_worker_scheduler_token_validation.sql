-- A RPC já é privada para service_role. A checagem adicional de auth.role()
-- não é necessária e não funciona de forma consistente com as novas chaves
-- secret do Supabase, que não são JWTs.

create or replace function public.server_validate_worker_scheduler_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_token text;
begin
  select ds.decrypted_secret
    into expected_token
  from vault.decrypted_secrets as ds
  where ds.name = 'worker_scheduler_token'
  limit 1;

  return expected_token is not null
    and p_token is not null
    and p_token = expected_token;
end;
$$;

revoke all on function public.server_validate_worker_scheduler_token(text) from public;
revoke all on function public.server_validate_worker_scheduler_token(text) from anon;
revoke all on function public.server_validate_worker_scheduler_token(text) from authenticated;
grant execute on function public.server_validate_worker_scheduler_token(text) to service_role;
