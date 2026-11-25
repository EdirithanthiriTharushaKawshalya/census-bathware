-- Census Bathware. Money is stored as integer minor units (LKR cents).
create extension if not exists pgcrypto;
create type public.app_role as enum ('customer','rep','office','delivery','accounts','management','admin');
create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null check (length(full_name) between 1 and 150),
  role public.app_role not null default 'customer', active boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.customers (
  id uuid primary key default gen_random_uuid(), user_id uuid unique references public.profiles(id),
  shop_name text not null check(length(shop_name) between 1 and 200), address text not null default '',
  phone text not null default '', approved boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.customer_assignments (
  customer_id uuid not null references public.customers(id), rep_id uuid not null references public.profiles(id),
  primary key(customer_id,rep_id)
);
create table public.products (
  id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 200),
  category text not null check(length(category) between 1 and 100), brand text not null check(length(brand) between 1 and 100),
  description text not null default '', warranty text, active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.variants (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id),
  sku text not null unique check(length(sku) between 1 and 80), label text not null,
  attributes jsonb not null default '{}' check(jsonb_typeof(attributes)='object'),
  price_minor bigint not null check(price_minor between 0 and 100000000000), active boolean not null default true
);
create table public.product_images (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id),
  path text not null unique, alt text not null check(length(alt) between 1 and 250)
);
create table public.app_settings (
  singleton boolean primary key default true check(singleton), guest_enquiries boolean not null default false
);
insert into public.app_settings default values;
create table public.enquiries (
  id uuid primary key default gen_random_uuid(), reference text not null unique default ('ENQ-' || upper(substr(gen_random_uuid()::text,1,8))),
  created_by uuid references public.profiles(id), contact_name text not null check(length(contact_name) between 2 and 150),
  email text not null check(length(email) between 3 and 254), phone text not null check(length(phone) between 5 and 40),
  request text not null check(length(request) between 3 and 2000), quantity integer check(quantity between 1 and 100000),
  notes text not null default '' check(length(notes)<=4000), status text not null default 'new' check(status in ('new','following_up','closed')),
  idempotency_key uuid not null unique, created_at timestamptz not null default now()
);
create table public.enquiry_rate_limits (
  bucket text not null, window_start timestamptz not null, attempts integer not null default 1,
  primary key(bucket,window_start)
);
create table public.orders (
  id uuid primary key default gen_random_uuid(), reference text not null unique default ('ORD-' || upper(substr(gen_random_uuid()::text,1,8))),
  customer_id uuid not null references public.customers(id), rep_id uuid references public.profiles(id),
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
  terms text not null check(terms in ('cash','credit')), notes text not null default '' check(length(notes)<=4000),
  total_minor bigint not null default 0 check(total_minor between 0 and 900000000000000),
  idempotency_key uuid not null, unique(created_by,idempotency_key)
);
create table public.order_lines (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
  variant_id uuid not null references public.variants(id), sku text not null, description text not null,
  quantity integer not null check(quantity between 1 and 100000), unit_price_minor bigint not null check(unit_price_minor>=0),
  unique(order_id,variant_id)
);
create table public.invoices (
  id uuid primary key default gen_random_uuid(), reference text not null unique default ('INV-' || upper(substr(gen_random_uuid()::text,1,8))),
  order_id uuid not null unique references public.orders(id), customer_id uuid not null references public.customers(id),
  issued_by uuid not null references public.profiles(id), issued_at timestamptz not null default now(),
  total_minor bigint not null check(total_minor between 0 and 900000000000000), idempotency_key uuid not null,
  unique(issued_by,idempotency_key)
);
create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.invoices(id),
  order_line_id uuid not null references public.order_lines(id), sku text not null, description text not null,
  quantity integer not null check(quantity>0), unit_price_minor bigint not null check(unit_price_minor>=0)
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.invoices(id),
  amount_minor bigint not null check(amount_minor between 1 and 900000000000000),
  method text not null check(method in ('cash','bank','cheque')),
  state text not null check(state in ('pending','cleared','void','bounced')),
  paid_on date not null default current_date, cheque_number text, bank text, cheque_date date,
  note text not null default '' check(length(note)<=2000), recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), idempotency_key uuid not null,
  unique(recorded_by,idempotency_key),
  check(method='cheque' or state in ('cleared','void')),
  check(method<>'cheque' or (cheque_number is not null and bank is not null and length(trim(cheque_number)) between 1 and 80 and length(trim(bank)) between 1 and 150 and cheque_date is not null))
);
create table public.deliveries (
  id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.orders(id),
  customer_id uuid not null references public.customers(id), assigned_to uuid not null references public.profiles(id),
  shop_name text not null, address text not null, status text not null default 'assigned' check(status in ('assigned','out_for_delivery','partial','delivered','failed')),
  collection_occurred boolean not null default false, items jsonb not null check(jsonb_typeof(items)='array'),
  updated_at timestamptz not null default now()
);
create table public.delivery_events (
  id uuid primary key default gen_random_uuid(), delivery_id uuid not null references public.deliveries(id),
  actor_id uuid not null references public.profiles(id), data jsonb not null, created_at timestamptz not null default now(),
  idempotency_key uuid not null, unique(actor_id,idempotency_key)
);
create table public.audit_records (
  id bigint generated always as identity primary key, actor_id uuid references auth.users(id),
  action text not null, entity_id uuid not null, before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);
create index customer_assignments_rep_idx on public.customer_assignments(rep_id);
create index orders_customer_date_idx on public.orders(customer_id,created_at desc);
create index orders_rep_date_idx on public.orders(rep_id,created_at desc);
create index order_lines_order_idx on public.order_lines(order_id);
create index variants_product_idx on public.variants(product_id);
create index products_filter_idx on public.products(category,brand) where active;
create index images_product_idx on public.product_images(product_id);
create index enquiries_status_date_idx on public.enquiries(status,created_at desc);
create index invoices_customer_date_idx on public.invoices(customer_id,issued_at desc);
create index invoice_lines_invoice_idx on public.invoice_lines(invoice_id);
create index payments_invoice_idx on public.payments(invoice_id);
create index payments_date_idx on public.payments(paid_on);
create index deliveries_assigned_idx on public.deliveries(assigned_to,status);
create index delivery_events_delivery_idx on public.delivery_events(delivery_id);
create index audit_entity_idx on public.audit_records(entity_id,created_at desc);

-- These helpers have fixed search paths and never trust user metadata.
create function public.current_role() returns public.app_role language sql stable security definer set search_path='' as $$
  select role from public.profiles where id=auth.uid() and active
$$;
create function public.has_role(allowed public.app_role[]) returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(public.current_role()=any(allowed),false)
$$;
create function public.can_customer(target uuid) returns boolean language sql stable security definer set search_path='' as $$
  select public.has_role(array['office','accounts','management','admin']::public.app_role[])
  or exists(select 1 from public.customers c where c.id=target and (
    (public.current_role()='customer' and c.user_id=auth.uid() and c.approved)
    or (public.current_role()='rep' and exists(select 1 from public.customer_assignments a where a.customer_id=c.id and a.rep_id=auth.uid()))))
$$;
create function public.can_catalogue() returns boolean language sql stable security definer set search_path='' as $$
  select public.has_role(array['rep','office','accounts','management','admin']::public.app_role[])
  or (public.current_role()='customer' and exists(select 1 from public.customers where user_id=auth.uid() and approved))
$$;

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.customer_assignments enable row level security;
alter table public.products enable row level security;
alter table public.variants enable row level security;
alter table public.product_images enable row level security;
alter table public.app_settings enable row level security;
alter table public.enquiries enable row level security;
alter table public.enquiry_rate_limits enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.payments enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_events enable row level security;
alter table public.audit_records enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (id=auth.uid() or public.has_role(array['office','management','admin']::public.app_role[]));
create policy customers_read on public.customers for select to authenticated using(public.can_customer(id));
create policy assignments_read on public.customer_assignments for select to authenticated using(public.can_customer(customer_id));
create policy products_read on public.products for select to authenticated using(public.can_catalogue() and (active or public.has_role(array['office','management','admin']::public.app_role[])));
create policy variants_read on public.variants for select to authenticated using(public.can_catalogue() and ((active and exists(select 1 from public.products p where p.id=product_id and p.active)) or public.has_role(array['office','management','admin']::public.app_role[])));
create policy images_read on public.product_images for select to authenticated using(public.can_catalogue());
create policy settings_read on public.app_settings for select to anon,authenticated using(true);
create policy enquiries_read on public.enquiries for select to authenticated using((created_by=auth.uid() and public.can_catalogue()) or public.has_role(array['rep','office','management','admin']::public.app_role[]));
create policy orders_read on public.orders for select to authenticated using(public.can_customer(customer_id));
create policy order_lines_read on public.order_lines for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and public.can_customer(o.customer_id)));
create policy invoices_read on public.invoices for select to authenticated using(public.can_customer(customer_id));
create policy invoice_lines_read on public.invoice_lines for select to authenticated using(exists(select 1 from public.invoices i where i.id=invoice_id and public.can_customer(i.customer_id)));
create policy payments_read on public.payments for select to authenticated using(exists(select 1 from public.invoices i where i.id=invoice_id and public.can_customer(i.customer_id)));
create policy deliveries_read on public.deliveries for select to authenticated using((public.current_role()='delivery' and assigned_to=auth.uid()) or public.can_customer(customer_id));
create policy delivery_events_read on public.delivery_events for select to authenticated using(exists(select 1 from public.deliveries d where d.id=delivery_id and ((public.current_role()='delivery' and d.assigned_to=auth.uid()) or public.can_customer(d.customer_id))));
create policy audit_read on public.audit_records for select to authenticated using(public.has_role(array['management','admin']::public.app_role[]));

-- No direct mutations: RPC functions below are the only write entry points.
revoke all on all tables in schema public from anon,authenticated;
grant select on public.app_settings to anon,authenticated;
grant select on public.profiles,public.customers,public.customer_assignments,public.products,public.variants,public.product_images,public.enquiries,public.orders,public.order_lines,public.invoices,public.invoice_lines,public.payments,public.deliveries,public.delivery_events,public.audit_records to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('catalogue','catalogue',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy catalogue_images_read on storage.objects for select to authenticated using(bucket_id='catalogue' and public.can_catalogue());
create policy catalogue_images_insert on storage.objects for insert to authenticated with check(bucket_id='catalogue' and public.has_role(array['office','management','admin']::public.app_role[]));
create policy catalogue_images_delete on storage.objects for delete to authenticated using(bucket_id='catalogue' and public.has_role(array['office','management','admin']::public.app_role[]));
