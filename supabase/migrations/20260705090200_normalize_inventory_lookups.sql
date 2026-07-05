create table if not exists public.inventory_bundles (
  id uuid primary key default gen_random_uuid(),
  bundle_name text not null unique,
  price text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_specifications (
  id uuid primary key default gen_random_uuid(),
  product_specification text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_bundles_bundle_name_idx on public.inventory_bundles (bundle_name);
create index if not exists product_specifications_name_idx on public.product_specifications (product_specification);

with latest_bundles as (
  select distinct on (lower(trim(bundle_name)))
    trim(bundle_name) as bundle_name,
    trim(price) as price
  from public.inventory_entries
  where trim(bundle_name) <> ''
    and trim(price) <> ''
  order by lower(trim(bundle_name)), updated_at desc, created_at desc
)
insert into public.inventory_bundles (bundle_name, price)
select bundle_name, price
from latest_bundles
on conflict (bundle_name) do update
set price = excluded.price,
    updated_at = now();

with existing_specs as (
  select distinct on (lower(trim(product_specification)))
    trim(product_specification) as product_specification
  from public.inventory_entries
  where trim(product_specification) <> ''
  order by lower(trim(product_specification)), updated_at desc, created_at desc
)
insert into public.product_specifications (product_specification)
select product_specification
from existing_specs
on conflict (product_specification) do nothing;

alter table public.inventory_entries
  add column if not exists bundle_id uuid references public.inventory_bundles(id) on delete restrict,
  add column if not exists product_specification_id uuid references public.product_specifications(id) on delete restrict;

update public.inventory_entries entries
set bundle_id = bundles.id
from public.inventory_bundles bundles
where entries.bundle_id is null
  and lower(trim(entries.bundle_name)) = lower(trim(bundles.bundle_name));

update public.inventory_entries entries
set product_specification_id = specs.id
from public.product_specifications specs
where entries.product_specification_id is null
  and lower(trim(entries.product_specification)) = lower(trim(specs.product_specification));

alter table public.inventory_entries
  alter column bundle_id set not null,
  alter column product_specification_id set not null;

create index if not exists inventory_entries_bundle_id_idx on public.inventory_entries (bundle_id);
create index if not exists inventory_entries_product_specification_id_idx on public.inventory_entries (product_specification_id);

alter table public.inventory_bundles enable row level security;
alter table public.product_specifications enable row level security;

drop trigger if exists inventory_bundles_touch_updated_at on public.inventory_bundles;
create trigger inventory_bundles_touch_updated_at
before update on public.inventory_bundles
for each row
execute function public.touch_updated_at();

drop trigger if exists product_specifications_touch_updated_at on public.product_specifications;
create trigger product_specifications_touch_updated_at
before update on public.product_specifications
for each row
execute function public.touch_updated_at();

grant usage on schema public to service_role;
grant select, insert, update, delete on public.inventory_bundles to service_role;
grant select, insert, update, delete on public.product_specifications to service_role;

revoke all on public.inventory_bundles from anon, authenticated;
revoke all on public.product_specifications from anon, authenticated;
