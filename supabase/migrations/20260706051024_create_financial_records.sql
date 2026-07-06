create table if not exists public.financial_records (
  id uuid primary key default gen_random_uuid(),
  price numeric(12, 2) not null,
  description text not null,
  record_date date not null,
  added_by uuid references public.users(id) on delete set null,
  added_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists financial_records_record_date_idx on public.financial_records (record_date desc);
create index if not exists financial_records_added_by_idx on public.financial_records (added_by);
create index if not exists financial_records_created_at_idx on public.financial_records (created_at desc);

alter table public.financial_records enable row level security;

drop trigger if exists financial_records_touch_updated_at on public.financial_records;
create trigger financial_records_touch_updated_at
before update on public.financial_records
for each row
execute function public.touch_updated_at();

grant select, insert, update, delete on public.financial_records to service_role;
revoke all on public.financial_records from anon, authenticated;
