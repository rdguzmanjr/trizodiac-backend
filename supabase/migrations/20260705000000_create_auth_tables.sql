create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  google_id text not null unique,
  email text not null unique,
  name text not null,
  avatar text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  last_login timestamptz
);

create index if not exists users_email_idx on public.users (email);
create index if not exists users_google_id_idx on public.users (google_id);
create index if not exists users_is_admin_idx on public.users (is_admin);

alter table public.users enable row level security;

create table if not exists public.sessions (
  sid text primary key,
  sess jsonb not null,
  expire timestamptz not null
);

create index if not exists sessions_expire_idx on public.sessions (expire);

alter table public.sessions enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.users to service_role;
grant select, insert, update, delete on public.sessions to service_role;

revoke all on public.users from anon, authenticated;
revoke all on public.sessions from anon, authenticated;
