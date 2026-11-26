-- Standalone PostgreSQL fixture test ONLY. Not a remote setup script.
-- Real login users must be created through Supabase Authentication, not SQL.
\set ON_ERROR_STOP on
insert into auth.users(id,email)
select ('dd000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,email from (values
 (1,'census.demo.admin@example.com'),(2,'census.demo.manager@example.com'),
 (3,'census.demo.office@example.com'),(4,'census.demo.accounts@example.com'),
 (5,'census.demo.rep.a@example.com'),(6,'census.demo.rep.b@example.com'),
 (7,'census.demo.driver.a@example.com'),(8,'census.demo.driver.b@example.com'),
 (9,'census.demo.buyer.a@example.com'),(10,'census.demo.buyer.b@example.com'),
 (11,'census.demo.pending@example.com')
) people(n,email);
create function pg_temp.assert_demo(condition boolean,message text) returns void language plpgsql as $$
begin if condition is distinct from true then raise exception 'DEMO FAIL: %',message; end if; raise notice 'DEMO PASS: %',message; end $$;
\ir ../demo/01-accounts-and-shops.sql
\ir ../demo/01-accounts-and-shops.sql
\ir ../demo/02-products.sql
update public.variants set price_minor=1550001 where id='da000000-0000-4000-8000-000000000002';
\ir ../demo/02-products.sql

select pg_temp.assert_demo((select count(*)=11 from public.profiles where id between 'dd000000-0000-4000-8000-000000000001'::uuid and 'dd000000-0000-4000-8000-000000000011'::uuid),'eleven profiles created without duplicates');
select pg_temp.assert_demo((select count(*)=6 from public.customers where id between 'de000000-0000-4000-8000-000000000001'::uuid and 'de000000-0000-4000-8000-000000000006'::uuid),'six shops created without duplicates');
select pg_temp.assert_demo((select count(*)=30 from public.products where id between 'df000000-0000-4000-8000-000000000001'::uuid and 'df000000-0000-4000-8000-000000000030'::uuid),'thirty products created without duplicates');
select pg_temp.assert_demo((select count(*)=60 from public.variants where id between 'da000000-0000-4000-8000-000000000001'::uuid and 'da000000-0000-4000-8000-000000000060'::uuid),'sixty variants created without duplicates');
select pg_temp.assert_demo((select price_minor=1550001 from public.variants where id='da000000-0000-4000-8000-000000000002'),'rerunning products preserves edited prices');
select pg_temp.assert_demo((select not approved from public.customers where id='de000000-0000-4000-8000-000000000005'),'pending shop remains unapproved');

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000009',true);
select pg_temp.assert_demo((public.catalogue_page('[DEMO]','','',1)->>'total')::integer=30,'buyer A can browse demo products');
select pg_temp.assert_demo((select count(*)=0 from public.customers where id='de000000-0000-4000-8000-000000000002'),'buyer A cannot read buyer B shop');
select public.submit_order('de000000-0000-4000-8000-000000000001','[{"variant_id":"da000000-0000-4000-8000-000000000001","quantity":10}]','dc000000-0000-4000-8000-000000000001') as demo_order_id \gset
select pg_temp.assert_demo((select total_minor=18000000 and rep_id='dd000000-0000-4000-8000-000000000005' from public.orders where id=:'demo_order_id'),'buyer order is LKR 180000 and attributed to representative A');
select set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000010',true);
select pg_temp.assert_demo((select count(*)=0 from public.orders where id=:'demo_order_id'),'buyer B cannot read buyer A order');
select set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000005',true);
select pg_temp.assert_demo((select count(*)=1 from public.orders where id=:'demo_order_id'),'representative A sees assigned buyer order');
select set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000006',true);
select pg_temp.assert_demo((select count(*)=0 from public.orders where id=:'demo_order_id'),'representative B cannot read representative A customer order');
select set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000003',true);
select public.assign_delivery(:'demo_order_id','dd000000-0000-4000-8000-000000000007') as demo_delivery_id \gset
select set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000007',true);
select pg_temp.assert_demo((select count(*)=1 from public.deliveries where id=:'demo_delivery_id'),'delivery worker A sees assigned delivery');
select set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000008',true);
select pg_temp.assert_demo((select count(*)=0 from public.deliveries where id=:'demo_delivery_id'),'delivery worker B cannot read worker A delivery');
select set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000004',true);
select public.issue_invoice(:'demo_order_id','dc000000-0000-4000-8000-000000000002') as demo_invoice_id \gset
select public.record_payment(:'demo_invoice_id',5000000,'cash',current_date,null,null,null,'Demo cash payment','dc000000-0000-4000-8000-000000000003');
select pg_temp.assert_demo((public.collections_report(current_date,current_date)->>'outstanding_minor')::bigint=13000000,'demo accounts workflow leaves LKR 130000 outstanding');
select set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000002',true);
select pg_temp.assert_demo((public.sales_report(current_date,current_date)->>'invoiced_minor')::bigint=18000000,'demo manager sees invoiced sales');
select set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000011',true);
select pg_temp.assert_demo(not public.can_catalogue(),'unapproved demo buyer remains blocked');
rollback;
\echo Demo setup checks passed. This did not create real Supabase Auth sessions or passwords.
