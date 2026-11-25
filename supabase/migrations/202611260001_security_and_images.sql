-- Additive upgrade: existing catalogue images and financial records are preserved.
alter table public.product_images add column variants jsonb not null default '[]' check(jsonb_typeof(variants)='array' and jsonb_array_length(variants)<=3);
alter table public.product_images add column width integer check(width between 1 and 1600);
alter table public.product_images add column height integer check(height between 1 and 1600);
alter table public.product_images add column bytes integer check(bytes between 1 and 2097152);
alter table public.product_images add column content_hash text check(content_hash ~ '^[a-f0-9]{64}$');
alter table public.product_images add column created_at timestamptz not null default now();
create unique index product_images_content_idx on public.product_images(product_id,content_hash) where content_hash is not null;
create index product_images_recent_idx on public.product_images(product_id,created_at desc,id);

create table public.request_limits (
  bucket text not null, window_start timestamptz not null, attempts integer not null check(attempts>0),
  primary key(bucket,window_start)
);
alter table public.request_limits enable row level security;
revoke all on public.request_limits from public,anon,authenticated;

create function public.allow_sign_in(p_email text) returns boolean language plpgsql security definer set search_path='' as $$
declare count_attempts integer;
begin
  if p_email is null or length(p_email) not between 3 and 254 then return false; end if;
  insert into public.request_limits(bucket,window_start,attempts) values('login-global',date_trunc('minute',now()),1)
  on conflict(bucket,window_start) do update set attempts=least(public.request_limits.attempts+1,201) returning attempts into count_attempts;
  if count_attempts>200 then return false; end if;
  insert into public.request_limits(bucket,window_start,attempts) values('login-email:'||encode(sha256(convert_to(lower(trim(p_email)),'UTF8')),'hex'),date_trunc('minute',now()),1)
  on conflict(bucket,window_start) do update set attempts=least(public.request_limits.attempts+1,11) returning attempts into count_attempts;
  delete from public.request_limits where window_start<now()-interval '1 day';
  return count_attempts<=10;
end $$;

create function public.allow_image_upload() returns boolean language plpgsql security definer set search_path='' as $$
declare count_attempts integer;
begin
  if not public.has_role(array['office','management','admin']::public.app_role[]) then raise exception 'Access denied'; end if;
  insert into public.request_limits(bucket,window_start,attempts) values('upload:'||auth.uid()::text,date_trunc('hour',now()),1)
  on conflict(bucket,window_start) do update set attempts=public.request_limits.attempts+1 returning attempts into count_attempts;
  delete from public.request_limits where window_start<now()-interval '1 day';
  return count_attempts<=30;
end $$;

create function public.attach_catalogue_image(p_product_id uuid,p_hash text,p_variants jsonb,p_alt text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; item jsonb; largest jsonb; expected_path text;
begin
  if not public.has_role(array['office','management','admin']::public.app_role[]) then raise exception 'Access denied'; end if;
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_variants is null or jsonb_typeof(p_variants)<>'array' or jsonb_array_length(p_variants) not between 1 and 3 or p_alt is null or length(trim(p_alt)) not between 1 and 250 then raise exception 'Invalid image manifest'; end if;
  if not exists(select 1 from public.products where id=p_product_id) then raise exception 'Product not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_product_id::text||p_hash,0));
  select id into result from public.product_images where product_id=p_product_id and content_hash=p_hash;
  if result is not null then return result; end if;
  if (select count(distinct x->>'path') from jsonb_array_elements(p_variants) x)<>jsonb_array_length(p_variants) then raise exception 'Duplicate image sizes'; end if;
  for item in select * from jsonb_array_elements(p_variants) loop
    if item->>'width' is null or item->>'height' is null or item->>'bytes' is null or (item->>'width')::integer not between 1 and 1600 or (item->>'height')::integer not between 1 and 1600 or (item->>'bytes')::integer not between 1 and 2097152 then raise exception 'Invalid image dimensions'; end if;
    expected_path:=p_product_id::text||'/'||p_hash||'/'||(item->>'width')||'.webp';
    if item->>'path' is distinct from expected_path or not exists(select 1 from storage.objects where bucket_id='catalogue' and name=expected_path) then raise exception 'Upload every optimized size first'; end if;
    if largest is null or (item->>'width')::integer>(largest->>'width')::integer then largest:=item; end if;
  end loop;
  insert into public.product_images(product_id,path,alt,variants,width,height,bytes,content_hash)
  values(p_product_id,largest->>'path',trim(p_alt),p_variants,(largest->>'width')::integer,(largest->>'height')::integer,(largest->>'bytes')::integer,p_hash) returning id into result;
  insert into public.audit_records(actor_id,action,entity_id,after_data) values(auth.uid(),'catalogue.image_attached',p_product_id,jsonb_build_object('image_id',result,'variants',p_variants,'content_hash',p_hash));
  return result;
end $$;

-- Only the server-only Storage writer may insert/delete objects. Staff JWTs
-- cannot bypass decoding/compression through the public Storage API.
-- Existing JPEG/PNG objects remain readable and do not need re-uploading.
update storage.buckets set public=false,file_size_limit=2097152,allowed_mime_types=array['image/webp'] where id='catalogue';
drop policy catalogue_images_insert on storage.objects;
drop policy catalogue_images_delete on storage.objects;

revoke execute on function public.attach_image(uuid,text,text) from public,anon,authenticated;

-- PostgreSQL NULL must not bypass mandatory correction-reason checks.
alter function public.correct_payment(uuid,text,text) rename to correct_payment_internal;
revoke execute on function public.correct_payment_internal(uuid,text,text) from public,anon,authenticated;
create function public.correct_payment(p_id uuid,p_state text,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
begin
  if p_reason is null or length(trim(p_reason)) not between 5 and 2000 or p_state is null then raise exception 'Provide a correction reason'; end if;
  return public.correct_payment_internal(p_id,p_state,trim(p_reason));
end $$;
alter function public.void_invoice(uuid,text) rename to void_invoice_internal;
revoke execute on function public.void_invoice_internal(uuid,text) from public,anon,authenticated;
create function public.void_invoice(p_id uuid,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
begin
  if p_reason is null or length(trim(p_reason)) not between 5 and 2000 then raise exception 'Provide a correction reason'; end if;
  return public.void_invoice_internal(p_id,trim(p_reason));
end $$;
revoke execute on function public.allow_sign_in(text),public.allow_image_upload(),public.attach_catalogue_image(uuid,text,jsonb,text),public.correct_payment(uuid,text,text),public.void_invoice(uuid,text) from public,anon,authenticated;
grant execute on function public.allow_sign_in(text) to anon,authenticated;
grant execute on function public.allow_image_upload(),public.attach_catalogue_image(uuid,text,jsonb,text),public.correct_payment(uuid,text,text),public.void_invoice(uuid,text) to authenticated;

-- Relationship/filter and ordering indexes for the paginated catalogue.
create index products_name_id_idx on public.products(name,id);
create index product_images_variants_idx on public.product_images using gin(variants jsonb_path_ops);
create function public.catalogue_page(p_query text default '',p_category text default '',p_brand text default '',p_page integer default 1) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare total integer; page_number integer; result jsonb;
begin
  if not public.can_catalogue() then raise exception 'Access denied'; end if;
  if length(coalesce(p_query,''))>200 or length(coalesce(p_category,''))>100 or length(coalesce(p_brand,''))>100 then raise exception 'Invalid filters'; end if;
  with filtered as (
    select p.id from public.products p where
    (coalesce(p_category,'')='' or p.category=p_category) and (coalesce(p_brand,'')='' or p.brand=p_brand)
    and (coalesce(p_query,'')='' or strpos(lower(p.name||' '||p.description||' '||p.brand),lower(p_query))>0
      or exists(select 1 from public.variants v where v.product_id=p.id and strpos(lower(v.sku||' '||v.label),lower(p_query))>0))
  ) select count(*) into total from filtered;
  page_number:=greatest(1,least(coalesce(p_page,1),greatest(1,ceil(total/24.0)::integer)));
  with filtered as (
    select p.* from public.products p where
    (coalesce(p_category,'')='' or p.category=p_category) and (coalesce(p_brand,'')='' or p.brand=p_brand)
    and (coalesce(p_query,'')='' or strpos(lower(p.name||' '||p.description||' '||p.brand),lower(p_query))>0
      or exists(select 1 from public.variants v where v.product_id=p.id and strpos(lower(v.sku||' '||v.label),lower(p_query))>0))
    order by p.name,p.id limit 24 offset ((page_number-1)*24)
  ) select jsonb_build_object(
    'total',total,'page',page_number,'page_size',24,
    'products',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object(
      'variants',coalesce((select jsonb_agg(to_jsonb(v) order by v.sku) from public.variants v where v.product_id=p.id),'[]'::jsonb),
      'product_images',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc,i.id) from public.product_images i where i.product_id=p.id),'[]'::jsonb)
    ) order by p.name,p.id) from filtered p),'[]'::jsonb),
    'categories',coalesce((select jsonb_agg(category order by category) from (select distinct category from public.products) c),'[]'::jsonb),
    'brands',coalesce((select jsonb_agg(brand order by brand) from (select distinct brand from public.products) b),'[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke execute on function public.catalogue_page(text,text,text,integer) from public,anon;
grant execute on function public.catalogue_page(text,text,text,integer) to authenticated;
