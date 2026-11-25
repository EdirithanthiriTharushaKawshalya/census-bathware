alter table public.invoices add column state text not null default 'issued' check(state in ('issued','void'));
alter table public.invoices add column void_reason text;
create function public.void_invoice(p_id uuid,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare previous public.invoices;
begin
  if not public.has_role(array['office','accounts','management','admin']::public.app_role[]) then raise exception 'Access denied'; end if;
  if length(trim(p_reason)) not between 5 and 2000 then raise exception 'Provide a correction reason'; end if;
  select * into previous from public.invoices where id=p_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if previous.state='void' then return p_id; end if;
  if exists(select 1 from public.payments where invoice_id=p_id and state in ('pending','cleared')) then raise exception 'Void or bounce all payments before voiding the invoice'; end if;
  update public.invoices set state='void',void_reason=p_reason where id=p_id;
  insert into public.audit_records(actor_id,action,entity_id,before_data,after_data) values(auth.uid(),'invoice.voided',p_id,to_jsonb(previous),jsonb_build_object('state','void','reason',p_reason));
  return p_id;
end $$;

create function public.sales_report(p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.has_role(array['rep','office','accounts','management','admin']::public.app_role[]) then raise exception 'Access denied'; end if;
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>3660 then raise exception 'Invalid date range'; end if;
  with permitted as (
    select o.* from public.orders o where public.can_customer(o.customer_id) and (public.current_role()<>'rep' or o.rep_id=auth.uid())
  ), ordered as (
    select * from permitted where created_at>=p_from::timestamptz and created_at<(p_to+1)::timestamptz
  ), billed as (
    select i.*,o.rep_id from public.invoices i join permitted o on o.id=i.order_id where i.state='issued' and i.issued_at>=p_from::timestamptz and i.issued_at<(p_to+1)::timestamptz
  ), months as (
    select to_char(m,'YYYY-MM') as month from generate_series(date_trunc('month',p_from::timestamp),date_trunc('month',p_to::timestamp),interval '1 month') m
  ), monthly as (
    select m.month,coalesce((select sum(total_minor) from ordered o where to_char(o.created_at,'YYYY-MM')=m.month),0) ordered_minor,
    coalesce((select sum(total_minor) from billed b where to_char(b.issued_at,'YYYY-MM')=m.month),0) invoiced_minor from months m
  ), rep_ids as (
    select rep_id from ordered union select rep_id from billed
  ), representatives as (
    select coalesce(p.full_name,'Unassigned') name,r.rep_id,
    coalesce((select sum(o.total_minor) from ordered o where o.rep_id is not distinct from r.rep_id),0) ordered_minor,
    coalesce((select sum(b.total_minor) from billed b where b.rep_id is not distinct from r.rep_id),0) invoiced_minor
    from rep_ids r left join public.profiles p on p.id=r.rep_id
  )
  select jsonb_build_object(
    'ordered_minor',coalesce((select sum(total_minor) from ordered),0)::text,
    'invoiced_minor',coalesce((select sum(total_minor) from billed),0)::text,
    'fulfilled_minor',coalesce((select sum((x->>'fulfilled')::bigint*l.unit_price_minor) from ordered o join public.deliveries d on d.order_id=o.id cross join lateral jsonb_array_elements(d.items) x join public.order_lines l on l.id=(x->>'order_line_id')::uuid),0)::text,
    'monthly',coalesce((select jsonb_agg(jsonb_build_object('month',m.month,'ordered_minor',m.ordered_minor::text,'invoiced_minor',m.invoiced_minor::text) order by month) from monthly m),'[]'::jsonb),
    'representatives',coalesce((select jsonb_agg(jsonb_build_object('name',r.name,'rep_id',r.rep_id,'ordered_minor',r.ordered_minor::text,'invoiced_minor',r.invoiced_minor::text)) from representatives r),'[]'::jsonb)
  ) into result;
  return result;
end $$;

create function public.collections_report(p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.has_role(array['office','accounts','management','admin']::public.app_role[]) then raise exception 'Access denied'; end if;
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>3660 then raise exception 'Invalid date range'; end if;
  with balances as (
    select c.id,c.shop_name,
    coalesce((select sum(i.total_minor) from public.invoices i where i.customer_id=c.id and i.state='issued'),0) invoiced_minor,
    coalesce((select sum(p.amount_minor) from public.payments p join public.invoices i on i.id=p.invoice_id where i.customer_id=c.id and i.state='issued' and p.state='cleared'),0) paid_minor
    from public.customers c
  ), pending as (
    select p.id,p.invoice_id,p.amount_minor,p.cheque_number,p.bank,p.cheque_date,c.shop_name,i.reference
    from public.payments p join public.invoices i on i.id=p.invoice_id join public.customers c on c.id=i.customer_id
    where p.method='cheque' and p.state='pending' and i.state='issued'
  )
  select jsonb_build_object(
    'balances',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'shop_name',b.shop_name,'invoiced_minor',b.invoiced_minor::text,'paid_minor',b.paid_minor::text) order by shop_name) from balances b),'[]'::jsonb),
    'pending',coalesce((select jsonb_agg(to_jsonb(p) order by cheque_date) from pending p),'[]'::jsonb),
    'collection_minor',coalesce((select sum(p.amount_minor) from public.payments p join public.invoices i on i.id=p.invoice_id where p.state='cleared' and i.state='issued' and p.paid_on between p_from and p_to),0)::text,
    'outstanding_minor',coalesce((select sum(invoiced_minor-paid_minor) from balances),0)::text
  ) into result;
  return result;
end $$;
revoke execute on function public.void_invoice(uuid,text),public.sales_report(date,date),public.collections_report(date,date) from public,anon;
grant execute on function public.void_invoice(uuid,text),public.sales_report(date,date),public.collections_report(date,date) to authenticated;

-- A trigger protects invoice state even if a new administrative entry point is added.
create function public.reject_payment_on_void_invoice() returns trigger language plpgsql set search_path='' as $$
begin
  if exists(select 1 from public.invoices where id=new.invoice_id and state='void') then raise exception 'Invoice is void'; end if;
  return new;
end $$;
revoke execute on function public.reject_payment_on_void_invoice() from public,anon,authenticated;
create trigger payment_invoice_state before insert or update on public.payments for each row execute function public.reject_payment_on_void_invoice();
