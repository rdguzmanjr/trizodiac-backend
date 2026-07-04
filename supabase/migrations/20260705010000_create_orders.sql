create table if not exists public.order_counters (
  counter_date date primary key,
  last_sequence integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.order_counters enable row level security;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  order_date date not null,
  receiver text not null,
  address text not null,
  items text not null,
  payment text not null,
  total numeric(12, 2) not null,
  notes text,
  status text not null default 'Generated',
  barcode_value text not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_order_date_idx on public.orders (order_date desc);
create index if not exists orders_created_by_idx on public.orders (created_by);
create index if not exists orders_receiver_idx on public.orders (receiver);
create index if not exists orders_status_idx on public.orders (status);

alter table public.orders enable row level security;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
before update on public.orders
for each row
execute function public.touch_updated_at();

create or replace function public.create_order(
  p_order_date date,
  p_receiver text,
  p_address text,
  p_items text,
  p_payment text,
  p_total numeric,
  p_notes text,
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
begin
  if p_order_date is null then
    raise exception 'order_date is required';
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
    receiver,
    address,
    items,
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
    p_receiver,
    p_address,
    p_items,
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
grant select, insert, update, delete on public.orders to service_role;
grant select, insert, update, delete on public.order_counters to service_role;
grant execute on function public.create_order(date, text, text, text, text, numeric, text, uuid) to service_role;

revoke all on public.orders from anon, authenticated;
revoke all on public.order_counters from anon, authenticated;
revoke all on function public.create_order(date, text, text, text, text, numeric, text, uuid) from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
