-- Fundação multi-tenant. Execute no Supabase somente ao ativar a persistência real.
-- Como o banco ainda não foi ativado, esta migration já incorpora as decisões mais recentes
-- sobre múltiplas contas sociais, agendamento por destino e auditoria de tentativas.

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
  provider_account_id text,
  account_label text,
  account_handle text,
  avatar_url text,
  -- Tokens devem ficar em cofre/coluna criptografada acessada somente pelo backend.
  token_reference text,
  updated_at timestamptz not null default now()
);

-- Permite várias contas da mesma plataforma no workspace, mas evita duplicar
-- a mesma conta externa depois que seu identificador oficial for conhecido.
create index social_connections_workspace_platform_idx
  on public.social_connections (workspace_id, platform);

create unique index social_connections_external_account_unique
  on public.social_connections (workspace_id, platform, provider_account_id)
  where provider_account_id is not null;

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  author_id uuid not null references auth.users,
  base_text text not null default '',
  media_type text check (media_type in ('image', 'video')),
  media_object_key text,
  status public.publication_status not null default 'draft',
  -- Horário comum/opcional. Cada destino pode sobrescrever em publication_destinations.scheduled_at.
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.publication_destinations (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications on delete cascade,
  social_connection_id uuid not null references public.social_connections on delete restrict,
  platform text not null,
  -- Superfície de publicação, por exemplo feed, reel, story, short ou video.
  surface text,
  title text,
  text text not null default '',
  -- Opções específicas validadas pelo provider, como privacidade, comentários,
  -- capa, thumbnail, localização e outras capacidades expostas pela API.
  provider_options jsonb not null default '{}'::jsonb,
  status public.publication_status not null default 'draft',
  scheduled_at timestamptz,
  idempotency_key text not null unique,
  external_id text,
  attempts integer not null default 0 check (attempts >= 0),
  last_error_code text,
  last_error text,
  next_attempt_at timestamptz,
  published_at timestamptz,
  unique (publication_id, social_connection_id)
);

create index publication_destinations_due_idx
  on public.publication_destinations (status, scheduled_at)
  where status in ('scheduled', 'failed');

create table public.publication_attempts (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.publication_destinations on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text not null check (outcome in ('processing', 'success', 'failed')),
  error_code text,
  error_message text,
  external_request_id text,
  created_at timestamptz not null default now(),
  unique (destination_id, attempt_number)
);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.social_connections enable row level security;
alter table public.publications enable row level security;
alter table public.publication_destinations enable row level security;
alter table public.publication_attempts enable row level security;

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.workspace_members where workspace_id = target_workspace and user_id = auth.uid()) $$;

create policy "members read workspaces" on public.workspaces
  for select using (public.is_workspace_member(id));

create policy "members read memberships" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));

create policy "members manage connections" on public.social_connections
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "members manage publications" on public.publications
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "members manage destinations" on public.publication_destinations
  for all using (
    exists(
      select 1
      from public.publications p
      where p.id = publication_id
        and public.is_workspace_member(p.workspace_id)
    )
  )
  with check (
    exists(
      select 1
      from public.publications p
      where p.id = publication_id
        and public.is_workspace_member(p.workspace_id)
    )
  );

create policy "members read publication attempts" on public.publication_attempts
  for select using (
    exists(
      select 1
      from public.publication_destinations d
      join public.publications p on p.id = d.publication_id
      where d.id = destination_id
        and public.is_workspace_member(p.workspace_id)
    )
  );

-- Inserção/atualização de tentativas deverá ser feita pelo backend/worker com credencial server-side.
