-- Enforce brand isolation at the database boundary so a post from one
-- brand can never target a social connection owned by another brand.

create or replace function private.enforce_post_target_brand_connection()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_post_brand_id uuid;
  v_post_org_id uuid;
  v_connection_brand_id uuid;
  v_connection_org_id uuid;
begin
  select p.brand_id, p.organization_id
    into v_post_brand_id, v_post_org_id
  from public.posts p
  where p.id = new.post_id;

  if v_post_brand_id is null or v_post_org_id is null then
    raise exception 'post brand context unavailable' using errcode = '23503';
  end if;

  select sc.brand_id, sc.organization_id
    into v_connection_brand_id, v_connection_org_id
  from public.social_connections sc
  where sc.id = new.social_connection_id;

  if v_connection_brand_id is null or v_connection_org_id is null then
    raise exception 'connection brand context unavailable' using errcode = '23503';
  end if;

  if new.organization_id <> v_post_org_id
     or v_connection_org_id <> v_post_org_id
     or v_connection_brand_id <> v_post_brand_id then
    raise exception 'target connection must belong to the same brand as the post' using errcode = '42501';
  end if;

  return new;
end;
$function$;

drop trigger if exists post_targets_brand_connection_guard on public.post_targets;
create trigger post_targets_brand_connection_guard
before insert or update of organization_id, post_id, social_connection_id
on public.post_targets
for each row
execute function private.enforce_post_target_brand_connection();
