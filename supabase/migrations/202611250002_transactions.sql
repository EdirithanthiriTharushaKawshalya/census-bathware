create function public.submit_order(p_customer_id uuid,p_lines jsonb,p_key uuid,p_rep_id uuid default null,p_terms text default 'cash',p_notes text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; actor uuid := auth.uid(); v record; item jsonb; rep uuid; total bigint := 0;
begin
  if not public.has_role(array['customer','rep','office','management','admin']::public.app_role[]) or not public.can_customer(p_customer_id) then raise exception 'Access denied'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text||p_key::text,0));
  select id into result from public.orders where created_by=actor and idempotency_key=p_key;
  if result is not null then return result; end if;
  if not exists(select 1 from public.customers where id=p_customer_id and approved) then raise exception 'Customer is not approved'; end if;
  if p_terms not in ('cash','credit') or length(p_notes)>4000 then raise exception 'Invalid order'; end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Choose 1 to 100 variants'; end if;
  if public.current_role()='rep' then rep:=actor;
  elsif p_rep_id is not null then
    if not public.has_role(array['office','management','admin']::public.app_role[]) then raise exception 'Cannot set representative'; end if;
    if not exists(select 1 from public.customer_assignments a join public.profiles p on p.id=a.rep_id where a.customer_id=p_customer_id and a.rep_id=p_rep_id and p.role='rep' and p.active) then raise exception 'Representative is not assigned'; end if;
    rep:=p_rep_id;
  else select rep_id into rep from public.customer_assignments where customer_id=p_customer_id order by rep_id limit 1; end if;
  insert into public.orders(customer_id,rep_id,created_by,terms,notes,idempotency_key) values(p_customer_id,rep,actor,p_terms,p_notes,p_key) returning id into result;
  for item in select * from jsonb_array_elements(p_lines) loop
    if (item->>'quantity')::integer not between 1 and 100000 then raise exception 'Invalid quantity'; end if;
    select v2.*,p.name into v from public.variants v2 join public.products p on p.id=v2.product_id where v2.id=(item->>'variant_id')::uuid and v2.active and p.active for share of v2,p;
    if not found then raise exception 'Variant is unavailable'; end if;
    insert into public.order_lines(order_id,variant_id,sku,description,quantity,unit_price_minor)
    values(result,v.id,v.sku,v.name||' / '||v.label,(item->>'quantity')::integer,v.price_minor);
    total:=total+v.price_minor*(item->>'quantity')::integer;
  end loop;
  update public.orders set total_minor=total where id=result;
  insert into public.audit_records(actor_id,action,entity_id,after_data) values(actor,'order.submitted',result,jsonb_build_object('total_minor',total,'rep_id',rep));
  return result;
end $$;

create function public.issue_invoice(p_order_id uuid,p_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders; result uuid;
begin
  if not public.has_role(array['office','accounts','management','admin']::public.app_role[]) then raise exception 'Access denied'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  select id into result from public.invoices where order_id=p_order_id;
  if result is not null then return result; end if;
  insert into public.invoices(order_id,customer_id,issued_by,total_minor,idempotency_key) values(o.id,o.customer_id,auth.uid(),o.total_minor,p_key) returning id into result;
  insert into public.invoice_lines(invoice_id,order_line_id,sku,description,quantity,unit_price_minor)
    select result,id,sku,description,quantity,unit_price_minor from public.order_lines where order_id=o.id;
  insert into public.audit_records(actor_id,action,entity_id,after_data) values(auth.uid(),'invoice.issued',result,jsonb_build_object('order_id',o.id,'total_minor',o.total_minor));
  return result;
end $$;

create function public.record_payment(p_invoice_id uuid,p_amount_minor bigint,p_method text,p_paid_on date,p_cheque_number text,p_bank text,p_cheque_date date,p_note text,p_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; total bigint; committed bigint;
begin
  if not public.has_role(array['accounts','office','management','admin']::public.app_role[]) then raise exception 'Access denied'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_key::text,0));
  select id into result from public.payments where recorded_by=auth.uid() and idempotency_key=p_key;
  if result is not null then return result; end if;
  select total_minor into total from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  select coalesce(sum(amount_minor),0) into committed from public.payments where invoice_id=p_invoice_id and state in ('pending','cleared');
  if p_amount_minor is null or p_amount_minor<=0 or p_amount_minor>total-committed then raise exception 'Amount exceeds unallocated balance'; end if;
  if p_paid_on>current_date then raise exception 'Payment date cannot be in the future'; end if;
  insert into public.payments(invoice_id,amount_minor,method,state,paid_on,cheque_number,bank,cheque_date,note,recorded_by,idempotency_key)
    values(p_invoice_id,p_amount_minor,p_method,case when p_method='cheque' then 'pending' else 'cleared' end,p_paid_on,p_cheque_number,p_bank,p_cheque_date,p_note,auth.uid(),p_key) returning id into result;
  insert into public.audit_records(actor_id,action,entity_id,after_data) select auth.uid(),'payment.recorded',id,to_jsonb(p) from public.payments p where id=result;
  return result;
end $$;

create function public.correct_payment(p_id uuid,p_state text,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.payments; invoice uuid;
begin
  if not public.has_role(array['accounts','office','management','admin']::public.app_role[]) then raise exception 'Access denied'; end if;
  if length(trim(p_reason)) not between 5 and 2000 then raise exception 'Provide a correction reason'; end if;
  select invoice_id into invoice from public.payments where id=p_id;
  perform 1 from public.invoices where id=invoice for update;
  select * into p from public.payments where id=p_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if p.state=p_state then return p_id; end if;
  if not ((p.state='pending' and p.method='cheque' and p_state in ('cleared','bounced','void')) or (p.state='cleared' and p_state='void')) then raise exception 'Invalid payment transition'; end if;
  update public.payments set state=p_state where id=p_id;
  insert into public.audit_records(actor_id,action,entity_id,before_data,after_data)
  values(auth.uid(),'payment.corrected',p_id,to_jsonb(p),jsonb_build_object('state',p_state,'reason',p_reason));
  return p_id;
end $$;

create function public.assign_delivery(p_order_id uuid,p_assigned_to uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders; c public.customers; result uuid; old_data jsonb;
begin
  if not public.has_role(array['office','management','admin']::public.app_role[]) then raise exception 'Access denied'; end if;
  if not exists(select 1 from public.profiles where id=p_assigned_to and active and role='delivery') then raise exception 'Choose active delivery staff'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  select * into c from public.customers where id=o.customer_id;
  select to_jsonb(d) into old_data from public.deliveries d where order_id=o.id;
  insert into public.deliveries(order_id,customer_id,assigned_to,shop_name,address,items)
  values(o.id,c.id,p_assigned_to,c.shop_name,c.address,(select jsonb_agg(jsonb_build_object('order_line_id',id,'sku',sku,'description',description,'ordered',quantity,'fulfilled',0)) from public.order_lines where order_id=o.id))
  on conflict(order_id) do update set assigned_to=p_assigned_to,updated_at=now() returning id into result;
  insert into public.audit_records(actor_id,action,entity_id,before_data,after_data) values(auth.uid(),'delivery.assigned',result,old_data,jsonb_build_object('assigned_to',p_assigned_to));
  return result;
end $$;

create function public.update_delivery(p_id uuid,p_status text,p_items jsonb,p_collection boolean,p_notes text,p_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare d public.deliveries; item jsonb; expected jsonb; normalized jsonb:='[]';
begin
  if not public.has_role(array['delivery','office','management','admin']::public.app_role[]) then raise exception 'Access denied'; end if;
  select * into d from public.deliveries where id=p_id for update;
  if not found or (public.current_role()='delivery' and d.assigned_to<>auth.uid()) then raise exception 'Access denied'; end if;
  if exists(select 1 from public.delivery_events where actor_id=auth.uid() and idempotency_key=p_key) then return p_id; end if;
  if p_status not in ('out_for_delivery','partial','delivered','failed') or length(p_notes)>2000 then raise exception 'Invalid delivery update'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<>jsonb_array_length(d.items) then raise exception 'Every line is required'; end if;
  if (select count(distinct x->>'order_line_id') from jsonb_array_elements(p_items) x)<>jsonb_array_length(d.items) then raise exception 'Duplicate delivery line'; end if;
  for item in select * from jsonb_array_elements(p_items) loop
    select x into expected from jsonb_array_elements(d.items) x where x->>'order_line_id'=item->>'order_line_id';
    if expected is null or (item->>'fulfilled') is null or (item->>'fulfilled')::integer not between 0 and (expected->>'ordered')::integer then raise exception 'Invalid fulfilled quantity'; end if;
    if p_status='delivered' and (item->>'fulfilled')::integer<>(expected->>'ordered')::integer then raise exception 'Use partial for shortages'; end if;
    normalized:=normalized||jsonb_build_array(expected||jsonb_build_object('fulfilled',(item->>'fulfilled')::integer));
  end loop;
  update public.deliveries set status=p_status,items=normalized,collection_occurred=p_collection,updated_at=now() where id=p_id;
  insert into public.delivery_events(delivery_id,actor_id,data,idempotency_key) values(p_id,auth.uid(),jsonb_build_object('status',p_status,'items',normalized,'collection_occurred',p_collection,'notes',p_notes),p_key);
  insert into public.audit_records(actor_id,action,entity_id,before_data,after_data) values(auth.uid(),'delivery.updated',p_id,to_jsonb(d),jsonb_build_object('status',p_status,'items',normalized,'collection_occurred',p_collection));
  return p_id;
end $$;

create function public.submit_enquiry(p_contact_name text,p_email text,p_phone text,p_request text,p_quantity integer,p_notes text,p_key uuid) returns text
language plpgsql security definer set search_path='' as $$
declare result text; attempts integer; window_time timestamptz:=date_trunc('hour',now()); bucket_name text;
begin
  if not coalesce(public.can_catalogue(),false) and not (auth.uid() is null and (select guest_enquiries from public.app_settings where singleton)) then raise exception 'Enquiries require an approved account'; end if;
  if p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email'; end if;
  -- Serialize retries; never return an existing guest reference for a different payload.
  perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
  select reference into result from public.enquiries where idempotency_key=p_key and email=lower(trim(p_email)) and created_by is not distinct from auth.uid() and request=p_request;
  if result is not null then return result; end if;
  foreach bucket_name in array array['global',encode(sha256(convert_to(lower(trim(p_email)),'UTF8')),'hex')] loop
    insert into public.enquiry_rate_limits(bucket,window_start) values(bucket_name,window_time)
    on conflict(bucket,window_start) do update set attempts=public.enquiry_rate_limits.attempts+1 returning enquiry_rate_limits.attempts into attempts;
    if attempts > (case when bucket_name='global' then 100 else 5 end) then raise exception 'Enquiry limit reached. Please try later'; end if;
  end loop;
  delete from public.enquiry_rate_limits where window_start<now()-interval '2 days';
  insert into public.enquiries(created_by,contact_name,email,phone,request,quantity,notes,idempotency_key)
  values(auth.uid(),p_contact_name,lower(trim(p_email)),p_phone,p_request,p_quantity,p_notes,p_key) returning reference into result;
  return result;
end $$;

create function public.update_enquiry(p_id uuid,p_status text) returns uuid language plpgsql security definer set search_path='' as $$
declare old_data jsonb;
begin
  if not public.has_role(array['rep','office','management','admin']::public.app_role[]) then raise exception 'Access denied'; end if;
  select to_jsonb(e) into old_data from public.enquiries e where id=p_id for update;
  if old_data is null then raise exception 'Enquiry not found'; end if;
  update public.enquiries set status=p_status where id=p_id;
  insert into public.audit_records(actor_id,action,entity_id,before_data,after_data) values(auth.uid(),'enquiry.updated',p_id,old_data,jsonb_build_object('status',p_status));
  return p_id;
end $$;

create function public.save_catalogue(p_product_id uuid,p_variant_id uuid,p_name text,p_category text,p_brand text,p_description text,p_warranty text,p_sku text,p_label text,p_attributes jsonb,p_price_minor bigint,p_active boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; old_data jsonb;
begin
  if not public.has_role(array['office','management','admin']::public.app_role[]) then raise exception 'Access denied'; end if;
  if p_product_id is null then
    insert into public.products(name,category,brand,description,warranty,active) values(p_name,p_category,p_brand,p_description,p_warranty,p_active) returning id into result;
  else
    select to_jsonb(p) into old_data from public.products p where id=p_product_id for update;
    if old_data is null then raise exception 'Product not found'; end if;
    result:=p_product_id;
    update public.products set name=p_name,category=p_category,brand=p_brand,description=p_description,warranty=p_warranty,active=p_active where id=result;
  end if;
  if p_variant_id is null then
    insert into public.variants(product_id,sku,label,attributes,price_minor) values(result,p_sku,p_label,p_attributes,p_price_minor);
  else
    if not exists(select 1 from public.variants where id=p_variant_id and product_id=result) then raise exception 'Variant does not belong to product'; end if;
    old_data:=old_data||jsonb_build_object('variant',(select to_jsonb(v) from public.variants v where id=p_variant_id));
    update public.variants set sku=p_sku,label=p_label,attributes=p_attributes,price_minor=p_price_minor where id=p_variant_id;
  end if;
  insert into public.audit_records(actor_id,action,entity_id,before_data,after_data) values(auth.uid(),'catalogue.saved',result,old_data,jsonb_build_object('name',p_name,'sku',p_sku,'price_minor',p_price_minor,'active',p_active));
  return result;
end $$;
create function public.attach_image(p_product_id uuid,p_path text,p_alt text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if not public.has_role(array['office','management','admin']::public.app_role[]) then raise exception 'Access denied'; end if;
  if not exists(select 1 from storage.objects where bucket_id='catalogue' and name=p_path) then raise exception 'Upload image first'; end if;
  insert into public.product_images(product_id,path,alt) values(p_product_id,p_path,p_alt) returning id into result;
  insert into public.audit_records(actor_id,action,entity_id,after_data) values(auth.uid(),'catalogue.image_attached',p_product_id,jsonb_build_object('path',p_path,'alt',p_alt));
  return result;
end $$;

-- Remove PostgreSQL's default PUBLIC execute grant. Only explicit APIs are callable.
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.current_role(),public.has_role(public.app_role[]),public.can_customer(uuid),public.can_catalogue() to authenticated;
grant execute on function public.can_catalogue(),public.current_role(),public.has_role(public.app_role[]) to anon;
grant execute on function public.submit_enquiry(text,text,text,text,integer,text,uuid) to anon,authenticated;
grant execute on function public.submit_order(uuid,jsonb,uuid,uuid,text,text), public.issue_invoice(uuid,uuid), public.record_payment(uuid,bigint,text,date,text,text,date,text,uuid), public.correct_payment(uuid,text,text), public.assign_delivery(uuid,uuid), public.update_delivery(uuid,text,jsonb,boolean,text,uuid), public.update_enquiry(uuid,text), public.save_catalogue(uuid,uuid,text,text,text,text,text,text,text,jsonb,bigint,boolean), public.attach_image(uuid,text,text) to authenticated;
