create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null,
  shipping_address text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_name_idx on public.customers (name);
create index if not exists customers_contact_idx on public.customers (contact);

alter table public.customers enable row level security;

drop trigger if exists customers_touch_updated_at on public.customers;
create trigger customers_touch_updated_at
before update on public.customers
for each row
execute function public.touch_updated_at();

alter table public.inventory_entries
  add column if not exists status text not null default 'Available';

update public.inventory_entries
set status = 'Available'
where status is null or trim(status) = '';

create index if not exists inventory_entries_status_idx on public.inventory_entries (status);

alter table public.orders
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists contact text not null default '',
  add column if not exists inventory_item_ids uuid[] not null default '{}';

create index if not exists orders_customer_id_idx on public.orders (customer_id);

create or replace function public.create_order(
  p_order_date date,
  p_receiver text,
  p_contact text,
  p_address text,
  p_items text,
  p_inventory_item_ids uuid[],
  p_payment text,
  p_total numeric,
  p_notes text,
  p_customer_id uuid,
  p_created_by uuid
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sequence integer;
  v_order_number text;
  v_order public.orders;
  v_item_ids uuid[] := coalesce(p_inventory_item_ids, '{}');
  v_unique_item_count integer;
  v_updated_item_count integer;
begin
  if p_order_date is null then
    raise exception 'order_date is required';
  end if;

  select count(distinct item_id)
  into v_unique_item_count
  from unnest(v_item_ids) as item_id;

  if v_unique_item_count > 0 then
    update public.inventory_entries
    set status = 'Sold'
    where id in (select distinct item_id from unnest(v_item_ids) as item_id)
      and status = 'Available';

    get diagnostics v_updated_item_count = row_count;

    if v_updated_item_count <> v_unique_item_count then
      raise exception 'One or more selected inventory items are no longer available';
    end if;
  end if;

  insert into public.order_counters (counter_date, last_sequence, updated_at)
  values (p_order_date, 1, now())
  on conflict (counter_date)
  do update
    set last_sequence = public.order_counters.last_sequence + 1,
        updated_at = now()
  returning last_sequence into v_sequence;

  v_order_number := 'TZ-' || to_char(p_order_date, 'YYYYMMDD') || '-' || lpad(v_sequence::text, 3, '0');

  insert into public.orders (
    order_number,
    order_date,
    customer_id,
    receiver,
    contact,
    address,
    items,
    inventory_item_ids,
    payment,
    total,
    notes,
    status,
    barcode_value,
    created_by
  )
  values (
    v_order_number,
    p_order_date,
    p_customer_id,
    p_receiver,
    p_contact,
    p_address,
    p_items,
    v_item_ids,
    p_payment,
    p_total,
    nullif(p_notes, ''),
    'Generated',
    v_order_number,
    p_created_by
  )
  returning * into v_order;

  return v_order;
end;
$$;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.customers to service_role;
grant execute on function public.create_order(date, text, text, text, text, uuid[], text, numeric, text, uuid, uuid) to service_role;

revoke all on public.customers from anon, authenticated;
revoke all on function public.create_order(date, text, text, text, text, uuid[], text, numeric, text, uuid, uuid) from public, anon, authenticated;
