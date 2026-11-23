-- Discover: Panasonic Lumix SHX1 (announced 17 Nov 2026) as the lead card, plus
-- a catalogue item so it can be added to inventory from Discover.
-- No image_url yet: the card falls back to the branded placeholder until an
-- official Panasonic press image is added in the Table Editor.
insert into public.equipment (name, category)
select 'Panasonic Lumix SHX1 Full-Frame Cinema Camera (L-Mount)', 'camera'
where not exists (select 1 from public.equipment where name = 'Panasonic Lumix SHX1 Full-Frame Cinema Camera (L-Mount)');

-- New lead card: push existing picks down one place.
update public.discover_items set sort = sort + 1
where not exists (select 1 from public.discover_items where brand = 'Panasonic' and title = 'Lumix SHX1');

insert into public.discover_items
  (title, brand, kind, headline, summary, body, highlights, price, announced, image_url, equipment_id, source_name, source_url, published, sort)
select
  'Lumix SHX1', 'Panasonic', 'Camera',
  'Panasonic''s first box-style cinema camera: full-frame 6K with internal ProRes RAW',
  'A compact full-frame cinema body with a 24.1MP partially stacked sensor, internal Apple ProRes RAW to CFexpress Type B and up to 15 stops of dynamic range.',
  E'The SHX1 is the first cinema camera under the Lumix brand, a compact box-style body in the spirit of the Varicam. A 24.1MP partially stacked full-frame sensor with Dual Native ISO records 6K internally as Apple ProRes RAW and ProRes RAW HQ to CFexpress Type B, while Blackmagic RAW (including 6K open gate at 24p) goes to an external USB-C SSD.\n\nPanasonic quotes over 14 stops natively and up to 15 stops in V-Log with Dynamic Range Boost, which limits the top ISO and slightly increases rolling shutter. ARRI LogC3 comes pre-installed. It records 32-bit float audio through a 3.5mm input and takes Micro V-Mount batteries.\n\nThere are no built-in ND filters, so bright exteriors need a matte box or front-threaded ND. An optional XLR handle unit (AU-XHU1) and control grip (AU-GRP1) are sold separately or in a cinema kit.',
  array['24.1MP partially stacked full-frame sensor, Dual Native ISO', 'Internal ProRes RAW / RAW HQ to CFexpress Type B', 'Blackmagic RAW to USB-C SSD, 6K open gate 24p', '14+ stops native, up to 15 in V-Log with DR Boost', '32-bit float audio, Micro V-Mount power', 'No built-in ND'],
  '$4,699.99 body only · $5,499.99 cinema kit · ships Dec 2026 (EU) / Jan 2027 (US)',
  '2026-11-17',
  null,
  (select "UUID" from public.equipment where name = 'Panasonic Lumix SHX1 Full-Frame Cinema Camera (L-Mount)' limit 1),
  'Daily Camera News', 'https://www.dailycameranews.com/2026/11/panasonic-shx1-specs-price/',
  true, 0
where not exists (select 1 from public.discover_items where brand = 'Panasonic' and title = 'Lumix SHX1');
