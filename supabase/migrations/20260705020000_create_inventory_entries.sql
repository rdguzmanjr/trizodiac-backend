create table if not exists public.inventory_entries (
  id uuid primary key default gen_random_uuid(),
  bundle_name text not null,
  code_number text not null,
  product_specification text not null,
  size_inches text not null,
  length_inches text not null,
  price text not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_entries_bundle_name_idx on public.inventory_entries (bundle_name);
create index if not exists inventory_entries_code_number_idx on public.inventory_entries (code_number);
create index if not exists inventory_entries_created_by_idx on public.inventory_entries (created_by);

alter table public.inventory_entries enable row level security;

drop trigger if exists inventory_entries_touch_updated_at on public.inventory_entries;
create trigger inventory_entries_touch_updated_at
before update on public.inventory_entries
for each row
execute function public.touch_updated_at();

grant usage on schema public to service_role;
grant select, insert, update, delete on public.inventory_entries to service_role;

revoke all on public.inventory_entries from anon, authenticated;
