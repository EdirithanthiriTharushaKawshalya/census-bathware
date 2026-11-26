-- OPTIONAL DEMO DATABASE ONLY. Thirty fictional products, sixty variants.
-- One atomic statement; reruns preserve edited prices and historical orders.
-- Upload photographs through the protected app workflow.
do $census_demo$
declare demo_products jsonb;
begin
  select jsonb_agg(to_jsonb(v)||jsonb_build_object('attributes_a',v.attributes_a::jsonb,'attributes_b',v.attributes_b::jsonb)) into demo_products from (values
(1,'BAS-001','Arc countertop basin','Basins & vanities','Census Demo Studio','560 mm / White','420 mm / White',18000,15500,'{"finish":"White gloss","width":"560 mm"}','{"finish":"White gloss","width":"420 mm"}'),
(2,'BAS-002','Round countertop basin','Basins & vanities','Census Demo Studio','400 mm / White','450 mm / White',14500,17000,'{"shape":"Round","width":"400 mm"}','{"shape":"Round","width":"450 mm"}'),
(3,'BAS-003','Square countertop basin','Basins & vanities','Forma Demo Collection','450 mm / White','500 mm / White',16500,19500,'{"shape":"Square","width":"450 mm"}','{"shape":"Square","width":"500 mm"}'),
(4,'BAS-004','Wall-mounted basin','Basins & vanities','Aqua Demo Line','450 mm','550 mm',12500,16000,'{"mount":"Wall","width":"450 mm"}','{"mount":"Wall","width":"550 mm"}'),
(5,'BAS-005','Inset ceramic basin','Basins & vanities','Census Demo Studio','500 mm','600 mm',15500,18500,'{"mount":"Inset","width":"500 mm"}','{"mount":"Inset","width":"600 mm"}'),
(6,'BAS-006','Pedestal basin','Basins & vanities','Aqua Demo Line','Standard / White','Compact / White',22000,19500,'{"style":"Standard"}','{"style":"Compact"}'),
(7,'BAS-007','Floating vanity unit','Basins & vanities','Forma Demo Collection','600 mm / Oak look','800 mm / Oak look',65000,82000,'{"width":"600 mm","finish":"Oak look"}','{"width":"800 mm","finish":"Oak look"}'),
(8,'BAS-008','Compact vanity unit','Basins & vanities','Census Demo Studio','450 mm / White','600 mm / White',48000,59000,'{"width":"450 mm","finish":"White"}','{"width":"600 mm","finish":"White"}'),
(9,'TAP-001','Forma basin mixer','Taps & mixers','Forma Demo Collection','Chrome','Matte black',12500,15000,'{"finish":"Chrome"}','{"finish":"Matte black"}'),
(10,'TAP-002','Tall basin mixer','Taps & mixers','Census Demo Studio','Chrome','Brushed gold look',18500,22500,'{"finish":"Chrome","height":"Tall"}','{"finish":"Brushed gold look","height":"Tall"}'),
(11,'TAP-003','Wall basin mixer','Taps & mixers','Aqua Demo Line','Chrome','Matte black',24500,27500,'{"finish":"Chrome","mount":"Wall"}','{"finish":"Matte black","mount":"Wall"}'),
(12,'TAP-004','Pillar tap','Taps & mixers','Aqua Demo Line','Chrome','Matte black',4500,5500,'{"finish":"Chrome"}','{"finish":"Matte black"}'),
(13,'TAP-005','Basin tap pair','Taps & mixers','Census Demo Studio','Chrome','Brushed nickel look',8500,10500,'{"finish":"Chrome"}','{"finish":"Brushed nickel look"}'),
(14,'TAP-006','Kitchen sink mixer','Taps & mixers','Forma Demo Collection','Chrome','Matte black',14500,18000,'{"finish":"Chrome"}','{"finish":"Matte black"}'),
(15,'TAP-007','Pull-out sink mixer','Taps & mixers','Forma Demo Collection','Chrome','Matte black',24500,29500,'{"finish":"Chrome","spout":"Pull-out"}','{"finish":"Matte black","spout":"Pull-out"}'),
(16,'TAP-008','Bath and shower mixer','Taps & mixers','Aqua Demo Line','Chrome','Matte black',28000,33500,'{"finish":"Chrome"}','{"finish":"Matte black"}'),
(17,'SHW-001','Rain shower set','Showers & accessories','Aqua Demo Line','Chrome / 250 mm','Matte black / 250 mm',39500,45000,'{"finish":"Chrome","head":"250 mm"}','{"finish":"Matte black","head":"250 mm"}'),
(18,'SHW-002','Hand shower kit','Showers & accessories','Census Demo Studio','Chrome','Matte black',9500,12000,'{"finish":"Chrome"}','{"finish":"Matte black"}'),
(19,'SHW-003','Round shower head','Showers & accessories','Aqua Demo Line','200 mm / Chrome','250 mm / Chrome',6500,9000,'{"diameter":"200 mm","finish":"Chrome"}','{"diameter":"250 mm","finish":"Chrome"}'),
(20,'SHW-004','Square shower head','Showers & accessories','Forma Demo Collection','200 mm / Chrome','300 mm / Chrome',8500,12500,'{"width":"200 mm","finish":"Chrome"}','{"width":"300 mm","finish":"Chrome"}'),
(21,'SHW-005','Shower rail kit','Showers & accessories','Census Demo Studio','Chrome','Matte black',11500,14500,'{"finish":"Chrome"}','{"finish":"Matte black"}'),
(22,'SHW-006','Shower hose','Showers & accessories','Aqua Demo Line','1.5 metre','2 metre',2500,3200,'{"length":"1.5 m"}','{"length":"2 m"}'),
(23,'WC-001','Close-coupled toilet','Toilets','Census Demo Studio','S-trap / White','P-trap / White',45000,46500,'{"trap":"S","finish":"White"}','{"trap":"P","finish":"White"}'),
(24,'WC-002','Wall-hung toilet','Toilets','Forma Demo Collection','Standard / White','Compact / White',62000,59000,'{"style":"Standard","finish":"White"}','{"style":"Compact","finish":"White"}'),
(25,'WC-003','One-piece toilet','Toilets','Aqua Demo Line','S-trap / White','P-trap / White',55000,56500,'{"trap":"S","finish":"White"}','{"trap":"P","finish":"White"}'),
(26,'WC-004','Soft-close toilet seat','Toilets','Census Demo Studio','Round / White','Elongated / White',6500,7500,'{"shape":"Round","finish":"White"}','{"shape":"Elongated","finish":"White"}'),
(27,'ACC-001','Towel rail','Bathroom accessories','Forma Demo Collection','600 mm / Chrome','600 mm / Matte black',4500,5500,'{"width":"600 mm","finish":"Chrome"}','{"width":"600 mm","finish":"Matte black"}'),
(28,'ACC-002','Toilet roll holder','Bathroom accessories','Census Demo Studio','Chrome','Matte black',2500,3200,'{"finish":"Chrome"}','{"finish":"Matte black"}'),
(29,'ACC-003','Soap dish','Bathroom accessories','Aqua Demo Line','Chrome / Glass','Matte black / Glass',2200,2900,'{"finish":"Chrome","dish":"Glass"}','{"finish":"Matte black","dish":"Glass"}'),
(30,'ACC-004','Robe hook','Bathroom accessories','Forma Demo Collection','Chrome','Matte black',1500,2100,'{"finish":"Chrome"}','{"finish":"Matte black"}')
  ) v(n,code,name,category,brand,label_a,label_b,price_a,price_b,attributes_a,attributes_b);

  if exists(select 1 from public.products p join jsonb_to_recordset(demo_products) as d(n integer,code text,name text,category text,brand text,label_a text,label_b text,price_a numeric(12,2),price_b numeric(12,2),attributes_a jsonb,attributes_b jsonb) on p.id=('df000000-0000-4000-8000-'||lpad(d.n::text,12,'0'))::uuid where p.name not like '[DEMO] %') then
    raise exception 'A planned demo product ID belongs to a non-demo product. Nothing has been changed.';
  end if;
  insert into public.products(id,name,category,brand,description,warranty,active)
  select ('df000000-0000-4000-8000-'||lpad(d.n::text,12,'0'))::uuid,'[DEMO] '||d.name,d.category,d.brand,
    'Fictional demonstration product for testing Census Bathware. Not a confirmed product or price list.',null,true
  from jsonb_to_recordset(demo_products) as d(n integer,code text,name text,category text,brand text,label_a text,label_b text,price_a numeric(12,2),price_b numeric(12,2),attributes_a jsonb,attributes_b jsonb) on conflict(id) do nothing;

  insert into public.variants(id,product_id,sku,label,attributes,price_minor,active)
  select ('da000000-0000-4000-8000-'||lpad((d.n*2-2+v.position)::text,12,'0'))::uuid,
    ('df000000-0000-4000-8000-'||lpad(d.n::text,12,'0'))::uuid,'DEMO-'||d.code||'-'||v.suffix,v.label,v.attributes,(v.price*100)::bigint,true
  from jsonb_to_recordset(demo_products) as d(n integer,code text,name text,category text,brand text,label_a text,label_b text,price_a numeric(12,2),price_b numeric(12,2),attributes_a jsonb,attributes_b jsonb) cross join lateral (values
    (1,'A',d.label_a,d.attributes_a,d.price_a),
    (2,'B',d.label_b,d.attributes_b,d.price_b)
  ) v(position,suffix,label,attributes,price)
  on conflict(id) do nothing;
end $census_demo$;

-- Review all 60 choices. LKR prices are shown in rupees for readability.
select p.name,p.category,p.brand,v.sku,v.label,v.price_minor::numeric/100 as price_lkr
from public.products p join public.variants v on v.product_id=p.id
where p.id between 'df000000-0000-4000-8000-000000000001'::uuid and 'df000000-0000-4000-8000-000000000030'::uuid
order by v.sku;
