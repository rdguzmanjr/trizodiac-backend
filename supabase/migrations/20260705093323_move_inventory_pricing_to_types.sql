create table if not exists public.inventory_types (
  id uuid primary key default gen_random_uuid(),
  type_name text not null unique,
  price text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_types_type_name_idx on public.inventory_types (type_name);

with existing_prices as (
  select distinct trim(price) as price
  from public.inventory_entries
  where trim(price) <> ''
)
insert into public.inventory_types (type_name, price)
select 'Imported ' || price as type_name, price
from existing_prices
on conflict (type_name) do update
set price = excluded.price,
    updated_at = now();

alter table public.inventory_entries
  add column if not exists type_id uuid references public.inventory_types(id) on delete restrict,
  add column if not exists type_name text;

update public.inventory_entries entries
set type_id = types.id,
    type_name = types.type_name
from public.inventory_types types
where entries.type_id is null
  and trim(entries.price) <> ''
  and types.type_name = 'Imported ' || trim(entries.price);

alter table public.inventory_entries
  alter column type_id set not null,
  alter column type_name set not null;

create index if not exists inventory_entries_type_id_idx on public.inventory_entries (type_id);
create index if not exists inventory_entries_type_name_idx on public.inventory_entries (type_name);

alter table public.inventory_bundles
  drop column if exists price;

alter table public.inventory_types enable row level security;

drop trigger if exists inventory_types_touch_updated_at on public.inventory_types;
create trigger inventory_types_touch_updated_at
before update on public.inventory_types
for each row
execute function public.touch_updated_at();

grant usage on schema public to service_role;
grant select, insert, update, delete on public.inventory_types to service_role;

revoke all on public.inventory_types from anon, authenticated;
