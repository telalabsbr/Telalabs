-- O backend seguro usa a service_role para ler/atualizar os ativos Meta
-- antes de chamar as RPCs que conectam uma Página do Facebook.
-- A migration 038 concedia SELECT apenas ao papel authenticated e, por isso,
-- o endpoint server-side falhava com "permission denied for table meta_assets".

grant select, insert, update, delete on table public.meta_assets to service_role;
