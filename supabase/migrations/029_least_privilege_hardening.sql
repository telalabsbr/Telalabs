-- Endurecimento de menor privilégio para papéis clientes.
-- Remove privilégios de tabela que não são necessários ao Data API e explicita
-- que tabelas internas/service-only não devem ser acessíveis por anon/authenticated.

-- RLS não protege TRUNCATE e papéis clientes não precisam de REFERENCES/TRIGGER/MAINTAIN.
revoke truncate, references, trigger, maintain
on all tables in schema public
from anon, authenticated;

-- Novas tabelas em public devem nascer sem privilégios implícitos para papéis clientes.
-- Cada migration deve conceder explicitamente apenas SELECT/INSERT/UPDATE/DELETE necessários.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;

-- Tabelas privadas/service-only: deny explícito como defesa em profundidade.
create policy "deny_client_access_integration_secrets"
on private.integration_secrets
for all
to anon, authenticated
using (false)
with check (false);

create policy "deny_client_access_media_delivery_tokens"
on private.media_delivery_tokens
for all
to anon, authenticated
using (false)
with check (false);

create policy "deny_client_access_oauth_credentials"
on private.oauth_credentials
for all
to anon, authenticated
using (false)
with check (false);

create policy "deny_client_access_api_watch_events"
on public.api_watch_events
for all
to anon, authenticated
using (false)
with check (false);

create policy "deny_client_access_provider_webhook_events"
on public.provider_webhook_events
for all
to anon, authenticated
using (false)
with check (false);
