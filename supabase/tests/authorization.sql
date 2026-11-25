\set ON_ERROR_STOP on
begin;
-- Distinct test identities; rolled back. Run as the LOCAL database owner.
insert into auth.users(id,email) values
('a0000000-0000-4000-8000-000000000001','census-test-customer-a@example.invalid'),
('a0000000-0000-4000-8000-000000000002','census-test-customer-b@example.invalid'),
('a0000000-0000-4000-8000-000000000003','census-test-rep@example.invalid'),
('a0000000-0000-4000-8000-000000000004','census-test-office@example.invalid'),
('a0000000-0000-4000-8000-000000000005','census-test-driver-a@example.invalid'),
('a0000000-0000-4000-8000-000000000006','census-test-driver-b@example.invalid'),
('a0000000-0000-4000-8000-000000000007','census-test-unapproved@example.invalid');
insert into public.profiles(id,full_name,role,active) values
('a0000000-0000-4000-8000-000000000001','Customer A','customer',true),
('a0000000-0000-4000-8000-000000000002','Customer B','customer',true),
('a0000000-0000-4000-8000-000000000003','Assigned Rep','rep',true),
('a0000000-0000-4000-8000-000000000004','Office','office',true),
('a0000000-0000-4000-8000-000000000005','Driver A','delivery',true),
('a0000000-0000-4000-8000-000000000006','Driver B','delivery',true),
('a0000000-0000-4000-8000-000000000007','Unapproved','customer',true);
insert into public.customers(id,user_id,shop_name,approved) values
('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Test Shop A',true),
('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','Test Shop B',true),
('b0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000007','Test Unapproved',false);
insert into public.customer_assignments values ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003');
insert into public.products(id,name,category,brand) values ('c0000000-0000-4000-8000-000000000001','Test basin','Basins','Test');
insert into public.variants(id,product_id,sku,label,price_minor) values ('d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','CENSUS-TEST-001','White',10000);
create function pg_temp.assert_true(condition boolean,message text) returns void language plpgsql as $$begin if condition is distinct from true then raise exception 'FAIL: %',message; end if; raise notice 'PASS: %',message; end$$;
create function pg_temp.denied(statement text,message text) returns void language plpgsql as $$begin
  begin execute statement; exception when others then raise notice 'PASS denied: %',message; return; end;
  raise exception 'FAIL allowed: %',message;
end$$;

set local role anon;
select pg_temp.denied($q$select public.submit_enquiry('Guest','guest@example.invalid','0110000000','A basin please',1,'','e0000000-0000-4000-8000-000000000001')$q$,'guest endpoint disabled by shared setting');
select pg_temp.denied('select * from public.variants','anonymous prices private');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000007',true);
select pg_temp.assert_true((select count(*)=0 from public.variants),'unapproved customer cannot read prices');
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
select pg_temp.denied($q$update public.profiles set role='admin' where id=auth.uid()$q$,'self privilege escalation');
select pg_temp.denied($q$select public.submit_order('b0000000-0000-4000-8000-000000000002','[{"variant_id":"d0000000-0000-4000-8000-000000000001","quantity":2}]','e0000000-0000-4000-8000-000000000002')$q$,'another customer order');
select pg_temp.denied($q$select public.submit_order('b0000000-0000-4000-8000-000000000001',null,'e0000000-0000-4000-8000-000000000002')$q$,'null order lines');
select public.submit_order('b0000000-0000-4000-8000-000000000001','[{"variant_id":"d0000000-0000-4000-8000-000000000001","quantity":2,"unit_price_minor":1}]','e0000000-0000-4000-8000-000000000003') as order_id \gset
select public.submit_order('b0000000-0000-4000-8000-000000000001','[{"variant_id":"d0000000-0000-4000-8000-000000000001","quantity":2}]','e0000000-0000-4000-8000-000000000003');
select pg_temp.assert_true((select count(*)=1 and max(total_minor)=20000 from public.orders where id=:'order_id'),'retry creates one order and ignores client price');
select pg_temp.denied(format('select public.issue_invoice(%L,gen_random_uuid())',:'order_id'),'customer cannot issue invoice');
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
select pg_temp.assert_true((select count(*)=0 from public.orders where id=:'order_id'),'other customer cannot read order');
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000003',true);
select pg_temp.assert_true((select count(*)=1 from public.orders where id=:'order_id'),'assigned representative can read order');
select pg_temp.assert_true((select count(*)=0 from public.customers where id='b0000000-0000-4000-8000-000000000002'),'rep cannot read unassigned customer');
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000004',true);
select public.issue_invoice(:'order_id','e0000000-0000-4000-8000-000000000004') as invoice_id \gset
select public.issue_invoice(:'order_id','e0000000-0000-4000-8000-000000000005');
select pg_temp.assert_true((select count(*)=1 from public.invoices where order_id=:'order_id'),'duplicate invoice prevented');
reset role;
update public.variants set price_minor=99999 where id='d0000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.assert_true((select unit_price_minor=10000 and quantity=2 from public.invoice_lines where invoice_id=:'invoice_id'),'invoice snapshot survives catalogue price changes');
select public.record_payment(:'invoice_id',5000,'cash',current_date,null,null,null,'Test cash','e0000000-0000-4000-8000-000000000006');
select public.record_payment(:'invoice_id',5000,'cash',current_date,null,null,null,'Test retry','e0000000-0000-4000-8000-000000000006');
select pg_temp.assert_true((select count(*)=1 from public.payments where invoice_id=:'invoice_id'),'duplicate payment prevented');
select pg_temp.denied(format('select public.record_payment(%L,20000,''cash'',current_date,null,null,null,'''',gen_random_uuid())',:'invoice_id'),'overpayment rejected');
select pg_temp.denied(format('select public.record_payment(%L,1000,''cheque'',current_date,null,null,null,'''',gen_random_uuid())',:'invoice_id'),'cheque details mandatory');
select public.record_payment(:'invoice_id',5000,'cheque',current_date,'TEST123','Test Bank',current_date,'Pending cheque','e0000000-0000-4000-8000-000000000007') as cheque_id \gset
select pg_temp.assert_true((public.collections_report(current_date,current_date)->>'outstanding_minor')::bigint=15000,'pending cheque does not reduce outstanding');
select public.correct_payment(:'cheque_id','cleared','Test cheque clearance');
select pg_temp.assert_true((public.collections_report(current_date,current_date)->>'outstanding_minor')::bigint=10000,'cleared cheque reduces outstanding');
select public.correct_payment(:'cheque_id','void','Test reversal');
select pg_temp.assert_true((public.collections_report(current_date,current_date)->>'outstanding_minor')::bigint=15000,'void payment restores balance');
select public.assign_delivery(:'order_id','a0000000-0000-4000-8000-000000000005') as delivery_id \gset
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000006',true);
select pg_temp.assert_true((select count(*)=0 from public.deliveries where id=:'delivery_id'),'other driver cannot read delivery');
select pg_temp.denied(format('select public.update_delivery(%L,''failed'',''[]'',false,'''',gen_random_uuid())',:'delivery_id'),'other driver cannot update delivery');
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000005',true);
select pg_temp.assert_true((select count(*)=0 from public.orders),'delivery staff cannot read prices or order totals');
select pg_temp.denied(format('select public.record_payment(%L,1000,''cash'',current_date,null,null,null,'''',gen_random_uuid())',:'invoice_id'),'driver cannot record payment');
select pg_temp.denied(format('select public.update_delivery(%L,''partial'',null,false,'''',gen_random_uuid())',:'delivery_id'),'null delivery items rejected');
select jsonb_build_array(jsonb_build_object('order_line_id',items->0->>'order_line_id','fulfilled',1))::text as fulfilled_items from public.deliveries where id=:'delivery_id' \gset
select public.update_delivery(:'delivery_id','partial',:'fulfilled_items',true,'One basin short','e0000000-0000-4000-8000-000000000008');
select pg_temp.assert_true((select (items->0->>'fulfilled')::integer=1 and status='partial' and collection_occurred from public.deliveries where id=:'delivery_id'),'assigned driver can record partial fulfilment');
reset role;
select pg_temp.assert_true((select count(*)>0 from public.audit_records where action='payment.corrected'),'financial corrections audited');
select pg_temp.assert_true((select count(*)=2 from public.payments where invoice_id=:'invoice_id'),'delivery collection flag creates no payment');
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000004',true);
select pg_temp.assert_true((public.sales_report(current_date,current_date)->>'ordered_minor')::bigint=20000,'sales report uses original order value');
select pg_temp.assert_true((public.sales_report(current_date,current_date)->>'fulfilled_minor')::bigint=10000,'fulfilled report uses actual quantity and historical price');
select pg_temp.denied(format('select public.void_invoice(%L,''Test void blocked'')',:'invoice_id'),'invoice with cleared payment cannot be voided');
reset role;
update public.orders set created_at=now()-interval '2 months' where id=:'order_id';
set local role authenticated;
select pg_temp.assert_true((public.sales_report(current_date,current_date)->'representatives'->0->>'invoiced_minor')::bigint=20000,'representative report includes invoices issued after order month');
select public.correct_payment(id,'void','Correct initial cash payment') from public.payments where invoice_id=:'invoice_id' and method='cash';
select public.void_invoice(:'invoice_id','Correct invoice entered for wrong quantities');
select pg_temp.assert_true((public.collections_report(current_date,current_date)->>'outstanding_minor')::bigint=0,'void invoice excluded from balances');
select pg_temp.denied(format('select public.record_payment(%L,1000,''cash'',current_date,null,null,null,'''',gen_random_uuid())',:'invoice_id'),'payment on void invoice rejected');
reset role;
update public.app_settings set guest_enquiries=true where singleton;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select public.submit_enquiry('Guest','census-guest@example.invalid','0110000000','Basin enquiry',1,'','e0000000-0000-4000-8000-000000000009') as enquiry_ref \gset
select pg_temp.assert_true(public.submit_enquiry('Guest','census-guest@example.invalid','0110000000','Basin enquiry',1,'','e0000000-0000-4000-8000-000000000009')=:'enquiry_ref','guest retry returns original reference');
select public.submit_enquiry('Guest','census-guest@example.invalid','0110000000','Basin enquiry',1,'',gen_random_uuid()) from generate_series(1,4);
select pg_temp.denied($q$select public.submit_enquiry('Guest','census-guest@example.invalid','0110000000','Basin enquiry',1,'',gen_random_uuid())$q$,'per-email rate limit');
select pg_temp.denied('select * from public.enquiries','guest cannot read enquiry queue');
reset role;
update public.enquiry_rate_limits set attempts=100 where bucket='global' and window_start=date_trunc('hour',now());
set local role anon;
select pg_temp.denied($q$select public.submit_enquiry('Guest','global-limit@example.invalid','0110000000','Basin enquiry',1,'',gen_random_uuid())$q$,'global enquiry rate limit');
reset role;
update public.app_settings set guest_enquiries=false where singleton;
set local role anon;
select pg_temp.denied($q$select public.submit_enquiry('Guest','another@example.invalid','0110000000','Basin enquiry',1,'',gen_random_uuid())$q$,'disabling shared setting closes direct RPC');
reset role;
-- Additive security/image migration regression checks.
reset role;
insert into storage.objects(bucket_id,name) values('catalogue','c0000000-0000-4000-8000-000000000001/'||repeat('a',64)||'/320.webp');
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000004',true);
select pg_temp.denied($q$insert into storage.objects(bucket_id,name) values('catalogue','c0000000-0000-4000-8000-000000000001/'||repeat('b',64)||'/320.webp')$q$,'staff cannot bypass server image processing through direct Storage inserts');
select public.attach_catalogue_image('c0000000-0000-4000-8000-000000000001',repeat('a',64),jsonb_build_array(jsonb_build_object('path','c0000000-0000-4000-8000-000000000001/'||repeat('a',64)||'/320.webp','width',320,'height',240,'bytes',1000)),'Test optimized image') as image_id \gset
select pg_temp.assert_true((select width=320 and height=240 and jsonb_array_length(variants)=1 from public.product_images where id=:'image_id'),'optimized image manifest recorded');
select pg_temp.assert_true(public.attach_catalogue_image('c0000000-0000-4000-8000-000000000001',repeat('a',64),jsonb_build_array(jsonb_build_object('path','c0000000-0000-4000-8000-000000000001/'||repeat('a',64)||'/320.webp','width',320,'height',240,'bytes',1000)),'Test retry')=:'image_id'::uuid,'duplicate image attachment idempotent');
select pg_temp.denied($q$select public.attach_image('c0000000-0000-4000-8000-000000000001','any.jpg','Bypass')$q$,'legacy image attachment cannot bypass validation');
select pg_temp.denied($q$select public.attach_catalogue_image('c0000000-0000-4000-8000-000000000001',repeat('b',64),jsonb_build_array(jsonb_build_object('path','https://evil.example/file.svg','width',320,'height',240,'bytes',1000)),'Invalid')$q$,'external or missing storage paths rejected');
select pg_temp.denied(format('select public.correct_payment(%L,''void'',null)',:'cheque_id'),'null correction reason rejected');
select pg_temp.denied(format('select public.void_invoice(%L,null)',:'invoice_id'),'null invoice reason rejected');
select pg_temp.denied(format('select public.correct_payment_internal(%L,''void'',''Bypass attempt'')',:'cheque_id'),'internal correction function cannot bypass wrapper');
select pg_temp.assert_true(public.allow_image_upload(),'office upload quota allowed');
select public.allow_image_upload() from generate_series(1,29);
select pg_temp.assert_true(not public.allow_image_upload(),'hourly upload quota enforced');
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
select pg_temp.denied('select public.allow_image_upload()','customer cannot consume upload capability');
select pg_temp.denied($q$select public.attach_catalogue_image('c0000000-0000-4000-8000-000000000001',repeat('a',64),'[]','Image')$q$,'customer cannot attach images');
reset role;
insert into public.products(name,category,brand) select 'Pagination fixture '||lpad(i::text,2,'0'),'Pagination','Fixture' from generate_series(1,32) i;
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true(jsonb_array_length(public.catalogue_page('Pagination fixture','','',1)->'products')=24,'catalogue first page bounded to 24');
select pg_temp.assert_true(jsonb_array_length(public.catalogue_page('Pagination fixture','','',2)->'products')=8,'catalogue second page contains remainder');
select pg_temp.assert_true((public.catalogue_page('Pagination fixture','','',99999)->>'page')::integer=2,'catalogue page clamped to last page');
select pg_temp.assert_true((public.catalogue_page('CENSUS-TEST-001','','',1)->>'total')::integer=1,'SKU filter evaluated in database');
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000007',true);
select pg_temp.denied('select public.catalogue_page()','unapproved customer cannot use paginated API');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select pg_temp.assert_true(public.allow_sign_in('limit@example.invalid'),'anonymous login budget allowed');
select public.allow_sign_in('limit@example.invalid') from generate_series(1,9);
select pg_temp.assert_true(not public.allow_sign_in('limit@example.invalid'),'login attempts limited per email');
select pg_temp.assert_true(not public.allow_sign_in(null),'null login identity denied');
select pg_temp.denied('select * from public.request_limits','rate limit records private');
select pg_temp.denied('select public.catalogue_page()','anonymous cannot use paginated catalogue');
reset role;
update public.request_limits set attempts=200 where bucket='login-global' and window_start=date_trunc('minute',now());
set local role anon;
select pg_temp.assert_true(not public.allow_sign_in('global-cap@example.invalid'),'global login quota enforced');
reset role;
select pg_temp.assert_true(not exists(select 1 from public.request_limits where bucket='login-email:'||encode(sha256(convert_to('global-cap@example.invalid','UTF8')),'hex')),'exhausted global quota creates no per-email rows');
rollback;
\echo All SQL assertions passed; fixture data rolled back.
