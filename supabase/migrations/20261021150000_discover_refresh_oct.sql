-- Discover refresh (October 2026): replace the Blackmagic URSA Cine Immersive
-- 100G, Canon CINE-SERVO 40-1200mm and 7Artisans Dream Cine cards with
-- Sigma's new Aizu Prime LF focal lengths, Nikon's NIKKOR Z CINEMA T1.9 VV
-- series and the Hollyland LARK M3. Also adds the shipping products to the
-- equipment catalogue so they can be added to inventory from Discover.

-- Catalogue items (skip any that already exist by name)
insert into public.equipment (name, category, image_url)
select v.name, v.category, v.image_url
from (values
  ('Sigma Aizu Prime Line 21mm T1.3 LF', 'lens', 'https://www.sigma-global.com/cine-lenses/images/aizuprime_21_13_product_img01.png.png'),
  ('Sigma Aizu Prime Line 100mm T1.3 LF', 'lens', 'https://www.sigma-global.com/cine-lenses/images/aizuprime_100_13_product_img01.png.png'),
  ('Sigma Aizu Prime Line 125mm T1.3 LF', 'lens', 'https://www.sigma-global.com/cine-lenses/images/aizuprime_125_13_product_img01.png.png'),
  ('Hollyland LARK M3 Wireless Microphone System', 'audio', 'https://store.hollyland.com/cdn/shop/files/6303-Combo_4TX_2RX-001.png?v=1790063362')
) as v(name, category, image_url)
where not exists (select 1 from public.equipment e where e.name = v.name);

-- Retire the three older cards
delete from public.discover_items
where title in ('URSA Cine Immersive 100G', 'CINE-SERVO 40-1200mm T5.0-10.8', 'Dream Cine primes');

-- New cards
insert into public.discover_items
  (title, brand, kind, headline, summary, body, highlights, price, announced, image_url, equipment_id, source_name, source_url, published, sort)
values
(
  'Aizu Prime LF 21mm, 100mm & 125mm', 'Sigma', 'Lens',
  'Sigma''s large-format T1.3 primes grow to 11 lenses',
  'Three new focal lengths for the Aizu Prime LF line, all T1.3 with a 46.3mm image circle that covers large format.',
  E'Sigma has added a 21mm, 100mm and 125mm to its Aizu Prime LF cine primes, taking the line to 11 lenses from 21mm to 125mm, with an 18mm still to come to complete the planned twelve.\n\nEvery lens is T1.3 and covers a 46.3mm image circle, enough for full frame, ALEXA LF Open Gate and VistaVision. Sigma has kept colour, contrast and flare consistent across the set, minimised breathing and distortion, and given them a wide focus rotation and an equal-pitch aperture ring.\n\nThey support Cooke /i and ZEISS eXtended Data for live lens metadata plus distortion and shading correction. In PL mount the 21mm weighs 1.6 kg and the 100mm and 125mm 2.2 kg each. Close focus is 0.35 m, 1 m and 1.25 m respectively. Shipments from US cinema dealers begin in November 2026.',
  array['21mm, 100mm and 125mm, all T1.3', '46.3mm image circle: full frame to VistaVision', 'Cooke /i + ZEISS eXtended Data', 'PL and Sony E mounts', 'PL weights: 1.6 kg (21mm), 2.2 kg (100mm, 125mm)', 'Shipping from November 2026'],
  '$9,799 list price', '2026-09-01',
  null,
  (select "UUID" from public.equipment where name = 'Sigma Aizu Prime Line 21mm T1.3 LF' limit 1),
  'Sigma', 'https://press.sigmaphoto.com/product/09/sigma-announces-21mm-t1-3-lf-100mm-t1-3-lf-and-125mm-t1-3-lf-aizu-prime-cine-lenses/',
  true, 2
),
(
  'LARK M3', 'Hollyland', 'Audio',
  'Four mics, four receivers, four isolated tracks from $99',
  'A tiny wireless lav system that scales to four transmitters and four receivers, with 32-bit recording and AI noise cancellation.',
  E'The LARK M3 is built for interviews, panels and multi-camera shoots. One system runs up to four 9 g transmitters into up to four receivers, and it can record four isolated tracks, so each voice lands on its own channel for the edit.\n\nTransmitters record internally at 48 kHz / 32-bit, with 32-bit float output to third-party apps on Apple devices (Android tops out at 24-bit). AI noise cancellation has three levels (10, 15 and 20 dB) for wind, traffic and running water, alongside vocal presets and auto-limit clip protection. A secondary receiver can take over if the primary drops out.\n\nHollyland quotes up to 300 m range in the open, about 8 hours per transmitter (4–4.5 hours with noise cancellation on) and up to 48 hours from the charging case.',
  array['Up to 4 TX and 4 RX; four isolated tracks', '48 kHz / 32-bit internal recording', 'AI noise cancellation: 10 / 15 / 20 dB', 'Up to 300 m range', '9 g transmitters; ~8 hr battery, 48 hr with case', 'Primary/secondary receiver failover'],
  '$99 (2TX + 1RX) · $119 (2TX + 2RX) · $179 (4TX + 2RX or 2TX + 4RX)', '2026-09-24',
  null,
  (select "UUID" from public.equipment where name = 'Hollyland LARK M3 Wireless Microphone System' limit 1),
  'audioXpress', 'https://audioxpress.com/news/hollyland-introduces-lark-m-wireless-audio-system-for-multi-person-and-multi-camera-production',
  true, 3
),
(
  'NIKKOR Z CINEMA T1.9 VV', 'Nikon', 'Lens',
  'Autofocus cine primes built to cover RED''s VistaVision sensor',
  'A nine-lens T1.9 cinema series with autofocus, in development, starting with a 50mm.',
  E'Nikon is developing a dedicated NIKKOR cinema prime series, the NIKKOR Z CINEMA T1.9 VV. There will be nine lenses, all T1.9, and the 50mm is the first to be named.\n\nThey are the first NIKKOR lenses with an image circle large enough for the RED V-RAPTOR [X] VV sensor (40.96 × 21.60 mm), which is larger than full frame. That makes them a natural match for RED, which Nikon now owns. Nikon also says they will have a highly precise autofocus mechanism, unusual for cine primes.\n\nThis is a development announcement: Nikon hasn''t given prices, release dates or the other eight focal lengths yet. The 50mm was on show at IBC 2026.',
  array['Nine-lens series, all T1.9', 'First named: 50mm T1.9 VV', 'Covers the RED V-RAPTOR [X] VV sensor', 'Built-in autofocus mechanism', 'In development: price and date TBC'],
  'Price and release date to be announced', '2026-09-08',
  null, null,
  'Nikon', 'https://www.nikonusa.com/press-room/da-cinema-lenses',
  true, 5
);
