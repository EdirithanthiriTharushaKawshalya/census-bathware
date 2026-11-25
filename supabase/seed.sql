-- OPTIONAL DEVELOPMENT DATA ONLY. Does not create Auth users or grant privileges.
insert into public.products(id,name,category,brand,description,warranty) values
('10000000-0000-4000-8000-000000000001','Arc countertop basin','Basins & vanities','Census Studio','A quietly sculpted ceramic basin with a generous oval bowl. White gloss finish.','Warranty terms to be confirmed with the office.'),
('10000000-0000-4000-8000-000000000002','Forma basin mixer','Taps & mixers','Census Studio','A single-lever mixer with a balanced silhouette and ceramic cartridge.',null),
('10000000-0000-4000-8000-000000000003','Rain shower set','Showers & accessories','Aqua Line','An overhead shower with an adjustable hand shower and coordinated controls.',null)
on conflict(id) do nothing;
insert into public.variants(id,product_id,sku,label,attributes,price_minor) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','CEN-ARC-560-W','560 mm / White','{"finish":"White gloss","width":"560 mm"}',1850000),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','CEN-ARC-420-W','420 mm / White','{"finish":"White gloss","width":"420 mm"}',1490000),
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','CEN-FOR-CHR','Chrome','{"finish":"Chrome"}',1275000),
('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','CEN-FOR-BLK','Matte black','{"finish":"Matte black"}',1525000),
('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000003','AQU-RAIN-CHR','Chrome / 250 mm','{"finish":"Chrome","head":"250 mm"}',3950000)
on conflict(id) do nothing;
insert into public.customers(id,shop_name,address,phone,approved) values
('30000000-0000-4000-8000-000000000001','Perera Hardware (demo)','24 Temple Road, Colombo (fictional demo address)','0110000000',true),
('30000000-0000-4000-8000-000000000002','Southern Home Centre (demo)','18 Market Street, Galle (fictional demo address)','0910000000',true)
on conflict(id) do nothing;
