-- Executor periódico do Tela Social.
--
-- Usa Supabase Cron + pg_net para chamar o worker mesmo quando nenhum usuário
-- está com o aplicativo aberto. O token de autenticação é gerado no banco e
-- permanece criptografado no Vault; ele não precisa ser copiado para o Vercel.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'worker_scheduler_token'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'worker_scheduler_token',
      'Token interno do executor periódico de publicações do Tela Social'
    );
  end if;

  if not exists (
    select 1 from vault.secrets where name = 'worker_scheduler_endpoint'
  ) then
    perform vault.create_secret(
      'https://telalabs-git-feat-ui-redesign-v1-thiagofti-2849.vercel.app/api/internal/worker/publications',
      'worker_scheduler_endpoint',
      'Endpoint estável do worker de publicações do Tela Social'
    );
  else
    perform vault.update_secret(
      (select id from vault.secrets where name = 'worker_scheduler_endpoint' limit 1),
      'https://telalabs-git-feat-ui-redesign-v1-thiagofti-2849.vercel.app/api/internal/worker/publications',
      'worker_scheduler_endpoint',
      'Endpoint estável do worker de publicações do Tela Social'
    );
  end if;
end
$$;

create or replace function public.server_validate_worker_scheduler_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_token text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'forbidden';
  end if;

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

select cron.schedule(
  'tela-social-publication-worker',
  '* * * * *',
  $cron$
    select net.http_post(
      url := (
        select ds.decrypted_secret
        from vault.decrypted_secrets as ds
        where ds.name = 'worker_scheduler_endpoint'
        limit 1
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select ds.decrypted_secret
          from vault.decrypted_secrets as ds
          where ds.name = 'worker_scheduler_token'
          limit 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 50000
    ) as request_id;
  $cron$
);
