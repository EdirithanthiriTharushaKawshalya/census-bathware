-- Execute only through trusted SQL Editor/DB admin after creating the Auth user.
-- Configured for the initial Census administrator; never expose as an application RPC.
do $$
declare
  account_email text := 'info.censusbathware@gmail.com';
  account_name text := 'Census Administrator';
  account_role public.app_role := 'admin';
  account_id uuid;
begin
  select id into account_id from auth.users where lower(email)=lower(account_email);
  if account_id is null then raise exception 'Create this individual in Supabase Auth first'; end if;
  insert into public.profiles(id,full_name,role,active) values(account_id,account_name,account_role,true)
  on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,active=excluded.active;
  insert into public.audit_records(actor_id,action,entity_id,after_data)
  values(null,'trusted.profile_provisioned',account_id,jsonb_build_object('role',account_role,'source','trusted SQL administrator'));
end $$;

-- For customer roles, also create/approve a customer account:
-- insert into public.customers(user_id,shop_name,address,phone,approved)
-- select id,'REPLACE_SHOP','REPLACE_ADDRESS','REPLACE_PHONE',true
-- from public.profiles where id = 'REPLACE_AUTH_UUID';
-- Or attach an optional seeded shop: update public.customers set user_id='REPLACE_AUTH_UUID' where id='REPLACE_CUSTOMER_UUID';
-- Assign a rep using trusted IDs:
-- insert into public.customer_assignments(customer_id,rep_id) values('REPLACE_CUSTOMER_UUID','REPLACE_REP_AUTH_UUID');
