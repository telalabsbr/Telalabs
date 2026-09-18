-- Fundação multi-tenant. Execute no Supabase somente ao ativar a persistência real.
create type public.connection_status as enum ('disconnected', 'connected', 'expired', 'error');
create type public.publication_status as enum ('draft', 'scheduled', 'processing', 'published', 'failed', 'cancelled');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique,
  created_at timestamptz not null default now()
);
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create table public.social_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  platform text not null,
  status public.connection_status not null default 'disconnected',
  account_label text,
  -- Tokens devem ficar em cofre/coluna criptografada acessada somente pelo backend.
  token_reference text,
  updated_at timestamptz not null default now(),
  unique (workspace_id, platform)
);
create table public.publications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  author_id uuid not null references auth.users,
  base_text text not null default '',
  media_type text check (media_type in ('image', 'video')),
  media_object_key text,
  status public.publication_status not null default 'draft',
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.publication_destinations (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications on delete cascade,
  platform text not null,
  title text,
  text text not null default '',
  status public.publication_status not null default 'draft',
  idempotency_key text not null unique,
  external_id text,
  attempts integer not null default 0,
  last_error text,
  published_at timestamptz,
  unique (publication_id, platform)
);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.social_connections enable row level security;
alter table public.publications enable row level security;
alter table public.publication_destinations enable row level security;

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.workspace_members where workspace_id = target_workspace and user_id = auth.uid()) $$;

create policy "members read workspaces" on public.workspaces for select using (public.is_workspace_member(id));
create policy "members read memberships" on public.workspace_members for select using (public.is_workspace_member(workspace_id));
create policy "members manage connections" on public.social_connections for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members manage publications" on public.publications for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members manage destinations" on public.publication_destinations for all using (
  exists(select 1 from public.publications p where p.id = publication_id and public.is_workspace_member(p.workspace_id))
);
