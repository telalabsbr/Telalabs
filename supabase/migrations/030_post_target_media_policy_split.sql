-- Remove duplicidade de policies permissivas de SELECT em post_target_media.
-- A policy antiga FOR ALL também participava de SELECT; mantemos a mesma autorização
-- para escrita separando INSERT/UPDATE/DELETE.

drop policy if exists "post_target_media_write" on public.post_target_media;

create policy "post_target_media_insert"
on public.post_target_media
for insert
to authenticated
with check (
  private.has_org_role(
    organization_id,
    array['OWNER','ADMIN','MANAGER','CREATOR']::text[]
  )
);

create policy "post_target_media_update"
on public.post_target_media
for update
to authenticated
using (
  private.has_org_role(
    organization_id,
    array['OWNER','ADMIN','MANAGER','CREATOR']::text[]
  )
)
with check (
  private.has_org_role(
    organization_id,
    array['OWNER','ADMIN','MANAGER','CREATOR']::text[]
  )
);

create policy "post_target_media_delete"
on public.post_target_media
for delete
to authenticated
using (
  private.has_org_role(
    organization_id,
    array['OWNER','ADMIN','MANAGER','CREATOR']::text[]
  )
);
