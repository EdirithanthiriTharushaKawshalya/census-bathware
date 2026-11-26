-- DEMO DATABASE ONLY. Create all 11 Auth users first. Passwords are never stored here.
-- Run this COMPLETE block. All setup data stays inside one atomic statement.
do $census_demo$
declare
  demo_people jsonb;
  demo_shops jsonb;
  missing text;
begin
  select jsonb_agg(to_jsonb(v)) into demo_people from (values
('census.demo.admin@example.com','[DEMO] Administrator','admin'),
('census.demo.manager@example.com','[DEMO] Manager','management'),
('census.demo.office@example.com','[DEMO] Office Officer','office'),
('census.demo.accounts@example.com','[DEMO] Accounts Officer','accounts'),
('census.demo.rep.a@example.com','[DEMO] Sales Representative A','rep'),
('census.demo.rep.b@example.com','[DEMO] Sales Representative B','rep'),
('census.demo.driver.a@example.com','[DEMO] Delivery Worker A','delivery'),
('census.demo.driver.b@example.com','[DEMO] Delivery Worker B','delivery'),
('census.demo.buyer.a@example.com','[DEMO] Buyer A','customer'),
('census.demo.buyer.b@example.com','[DEMO] Buyer B','customer'),
('census.demo.pending@example.com','[DEMO] Unapproved Buyer','customer')
  ) v(email,full_name,role);
  select jsonb_agg(to_jsonb(v)) into demo_shops from (values
('de000000-0000-4000-8000-000000000001','[DEMO] Perera Hardware','Fictional demo address, Colombo','0000000001','census.demo.buyer.a@example.com',true),
('de000000-0000-4000-8000-000000000002','[DEMO] Southern Home Centre','Fictional demo address, Galle','0000000002','census.demo.buyer.b@example.com',true),
('de000000-0000-4000-8000-000000000003','[DEMO] Central Tile House','Fictional demo address, Kandy','0000000003',null,true),
('de000000-0000-4000-8000-000000000004','[DEMO] Eastern Bath Gallery','Fictional demo address, Batticaloa','0000000004',null,true),
('de000000-0000-4000-8000-000000000005','[DEMO] Pending Approval Shop','Fictional demo address, Kurunegala','0000000005','census.demo.pending@example.com',false),
('de000000-0000-4000-8000-000000000006','[DEMO] North Home Supplies','Fictional demo address, Jaffna','0000000006',null,true)
  ) v(id,shop_name,address,phone,buyer_email,approved);

  select string_agg(p.email,', ' order by p.email) into missing from jsonb_to_recordset(demo_people) as p(email text,full_name text,role text)
  where not exists(select 1 from auth.users u where lower(u.email)=p.email);
  if missing is not null then raise exception 'Create these users in Authentication > Users first: %',missing; end if;
  if exists(select 1 from public.profiles p join auth.users u on u.id=p.id join jsonb_to_recordset(demo_people) as d(email text,full_name text,role text) on lower(u.email)=d.email where p.full_name not like '[DEMO] %') then
    raise exception 'A demo email already belongs to a non-demo profile. Nothing has been changed.';
  end if;
  if exists(select 1 from public.customers where id between 'de000000-0000-4000-8000-000000000001'::uuid and 'de000000-0000-4000-8000-000000000006'::uuid and shop_name not like '[DEMO] %') then
    raise exception 'A planned demo shop ID belongs to a non-demo shop. Nothing has been changed.';
  end if;
  if exists(select 1 from public.customers c join auth.users u on u.id=c.user_id join jsonb_to_recordset(demo_people) as d(email text,full_name text,role text) on d.email=lower(u.email)
    where not exists(select 1 from jsonb_to_recordset(demo_shops) as s(id uuid,shop_name text,address text,phone text,buyer_email text,approved boolean) where s.id=c.id)) then
    raise exception 'A demo user is already linked to a different shop. Review that link first; nothing has been changed.';
  end if;

  insert into public.profiles(id,full_name,role,active)
  select u.id,d.full_name,d.role::public.app_role,true from jsonb_to_recordset(demo_people) as d(email text,full_name text,role text) join auth.users u on lower(u.email)=d.email
  on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,active=true;

  insert into public.customers(id,user_id,shop_name,address,phone,approved)
  select s.id,u.id,s.shop_name,s.address,s.phone,s.approved from jsonb_to_recordset(demo_shops) as s(id uuid,shop_name text,address text,phone text,buyer_email text,approved boolean) left join auth.users u on lower(u.email)=s.buyer_email
  on conflict(id) do update set user_id=excluded.user_id,shop_name=excluded.shop_name,address=excluded.address,phone=excluded.phone,approved=excluded.approved;

  insert into public.customer_assignments(customer_id,rep_id)
  select a.customer_id,u.id from (values
   ('de000000-0000-4000-8000-000000000001'::uuid,'census.demo.rep.a@example.com'),
   ('de000000-0000-4000-8000-000000000003'::uuid,'census.demo.rep.a@example.com'),
   ('de000000-0000-4000-8000-000000000006'::uuid,'census.demo.rep.a@example.com'),
   ('de000000-0000-4000-8000-000000000002'::uuid,'census.demo.rep.b@example.com'),
   ('de000000-0000-4000-8000-000000000004'::uuid,'census.demo.rep.b@example.com')
  ) a(customer_id,email) join auth.users u on lower(u.email)=a.email
  on conflict(customer_id,rep_id) do nothing;

  insert into public.audit_records(actor_id,action,entity_id,after_data)
  select null,'demo.profile_configured',u.id,jsonb_build_object('pack','census-demo-v1','role',d.role)
  from jsonb_to_recordset(demo_people) as d(email text,full_name text,role text) join auth.users u on lower(u.email)=d.email;
end $census_demo$;

-- Review the result: 11 active demo profiles. The pending buyer's shop is NOT approved.
select u.email,p.full_name,p.role,p.active,c.shop_name,c.approved
from public.profiles p join auth.users u on u.id=p.id left join public.customers c on c.user_id=p.id
where lower(u.email) in (
 'census.demo.admin@example.com','census.demo.manager@example.com','census.demo.office@example.com','census.demo.accounts@example.com',
 'census.demo.rep.a@example.com','census.demo.rep.b@example.com','census.demo.driver.a@example.com','census.demo.driver.b@example.com',
 'census.demo.buyer.a@example.com','census.demo.buyer.b@example.com','census.demo.pending@example.com'
) order by p.role,u.email;
