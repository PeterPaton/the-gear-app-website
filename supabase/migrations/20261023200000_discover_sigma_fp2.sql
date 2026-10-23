-- Discover: Sigma FP2 (announced 23 Oct 2026) as the lead card, plus a
-- catalogue item so it can be added to inventory from Discover.
insert into public.equipment (name, category, image_url)
select 'Sigma FP2 Full-Frame Camera (L-Mount)', 'camera',
       'https://www.sigma-global.com/cameras/images/01_PPhoto_FP_Beauty_front_1000px.png'
where not exists (select 1 from public.equipment where name = 'Sigma FP2 Full-Frame Camera (L-Mount)');

insert into public.discover_items
  (title, brand, kind, headline, summary, body, highlights, price, announced, image_url, equipment_id, source_name, source_url, published, sort)
select
  'FP2', 'Sigma', 'Camera',
  'A pocket full-frame cine camera with 6K open gate ProRes RAW',
  'Sigma''s tiny modular L-Mount body returns with a partially stacked 24.5MP sensor, internal ProRes RAW and a dedicated Cine mode.',
  E'The FP2 keeps the original fp''s pocket-sized, modular design and makes it a far more serious video tool. A 24.5MP partially stacked full-frame sensor records 6K open gate (3:2) internally, including Apple ProRes RAW and ProRes RAW HQ, with Leica''s L-Log and up to 14.1 stops of dynamic range (4K full frame, L-Log).\n\nA single switch flips between Still and Cine modes, each with its own interface, and a Director''s Viewfinder mode simulates the frame of various cinema cameras. It records to SD plus 70GB of built-in storage, so a take carries on when the card fills. 32-bit float audio is possible with the HU-21 hot shoe unit and Panasonic''s XLR adapters.\n\nThere''s no built-in viewfinder; the EVF-21 clips on as an option. The BP-91 battery is rated for about 130 minutes of video, roughly 30% more than the original fp. It''s L-Mount, so it pairs with Sigma, Leica and Panasonic glass.',
  array['24.5MP partially stacked full-frame sensor', '6K open gate, internal ProRes RAW / RAW HQ', 'L-Log, up to 14.1 stops (4K FF)', 'Still / Cine switch, Director''s Viewfinder', 'SD + 70GB internal storage', 'BP-91 battery: ~130 min video'],
  '$2,199 body only · $2,749 with 50mm F2 or EVF-21 · ships 11 Nov 2026',
  '2026-10-23',
  null,
  (select "UUID" from public.equipment where name = 'Sigma FP2 Full-Frame Camera (L-Mount)' limit 1),
  'Sigma', 'https://press.sigmaphoto.com/product/10/sigma-announces-fp2-camera/',
  true, 0
where not exists (select 1 from public.discover_items where brand = 'Sigma' and title = 'FP2');
