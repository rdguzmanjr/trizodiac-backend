alter table public.inventory_entries
  add column if not exists shipped_to text,
  add column if not exists price_given numeric(12, 2);

create index if not exists inventory_entries_shipped_to_idx on public.inventory_entries (shipped_to);

update public.inventory_entries as inventory
set shipped_to = orders.receiver
from public.orders as orders
where inventory.status = 'Sold'
  and inventory.shipped_to is null
  and inventory.id = any(orders.inventory_item_ids);

create or replace function public.create_order(
  p_order_date date,
  p_receiver text,
  p_contact text,
  p_address text,
  p_items text,
  p_inventory_item_ids uuid[],
  p_inventory_item_prices jsonb,
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
  v_item_prices jsonb := coalesce(p_inventory_item_prices, '{}'::jsonb);
  v_unique_item_count integer;
  v_priced_item_count integer;
  v_updated_item_count integer;
begin
  if p_order_date is null then
    raise exception 'order_date is required';
  end if;

  select count(distinct selected.item_id)
  into v_unique_item_count
  from unnest(v_item_ids) as selected(item_id);

  if v_unique_item_count > 0 then
    select count(distinct selected.item_id)
    into v_priced_item_count
    from unnest(v_item_ids) as selected(item_id)
    where v_item_prices ? selected.item_id::text
      and nullif(trim(v_item_prices ->> selected.item_id::text), '') is not null
      and (v_item_prices ->> selected.item_id::text)::numeric >= 0;

    if v_priced_item_count <> v_unique_item_count then
      raise exception 'Every selected inventory item requires a valid price given';
    end if;

    update public.inventory_entries as inventory
    set status = 'Sold',
        shipped_to = p_receiver,
        price_given = (v_item_prices ->> inventory.id::text)::numeric
    where inventory.id in (select distinct selected.item_id from unnest(v_item_ids) as selected(item_id))
      and inventory.status = 'Available';

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

grant execute on function public.create_order(date, text, text, text, text, uuid[], jsonb, text, numeric, text, uuid, uuid) to service_role;
revoke all on function public.create_order(date, text, text, text, text, uuid[], jsonb, text, numeric, text, uuid, uuid) from public, anon, authenticated;
