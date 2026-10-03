-- Initial Discover picks (October 2026). Facts from the linked announcements.
insert into public.discover_items (title, brand, kind, headline, summary, body, highlights, price, announced, equipment_id, image_url, source_name, source_url, sort) values
(
  'Sony FX5', 'Sony', 'Camera',
  'Full-frame Cinema Line body with internal 16-bit RAW',
  'A compact full-frame cinema camera with a fully stacked sensor, three base ISOs and X-OCN RAW recorded in camera.',
  E'The FX5 is the newest full-frame body in Sony''s Cinema Line. It pairs a fully stacked Exmor RS sensor with the BIONZ XR2 processor, and Sony quotes more than 15 stops of dynamic range in S-Log3.\n\nThe headline feature is internal X-OCN, Sony''s 16-bit scene-linear RAW, in LT, C1 and C2 flavours, so you get RAW without an external recorder. Three base ISOs (800, 4000 and 12800) plus a Dual Gain mode cover everything from daylight exteriors to available-light interiors.\n\nIt''s an E-mount body of about 643 g that records to two slots taking CFexpress Type A or SD cards. Note the battery: it runs on Sony''s NP-SA100 rather than the NP-FZ100 used by the FX3 and FX30, so check your power kit. The optional XLR-H2 handle adds two XLR/TRS inputs with up to four channels of 32-bit float audio.',
  array['5K up to 60p, 4K up to 120p, FHD up to 240p', 'Internal 16-bit X-OCN RAW (LT, C1, C2)', '15+ stops in S-Log3; base ISO 800 / 4000 / 12800', 'E-mount; two CFexpress Type A / SD slots', 'NP-SA100 battery; about 643 g body only', 'Optional XLR-H2 handle: 4-channel 32-bit float audio'],
  '$4,899.99 body only · $5,499.99 with XLR handle', '2026-07-22', null, null,
  'Sony Alpha Universe', 'https://alphauniverse.com/stories/sony-electronics-launches-the-fx5/', 1
),
(
  'URSA Cine Immersive 100G', 'Blackmagic Design', 'Camera',
  'The first immersive cinema camera built for live broadcast',
  'Dual 8K × 8K capture for Apple Immersive Video, sent live over 100G Ethernet.',
  E'Blackmagic''s URSA Cine Immersive was designed for Apple Immersive Video; the 100G model takes it live. It captures dual 8K × 8K images with 16 stops of dynamic range, using an RGBW sensor with larger photosites and equal numbers of red, green and blue pixels.\n\nA 100G Ethernet port outputs SMPTE-2110 IP video, and the URSA Live Encoder encodes to ProRes in real time, so the feed can go straight into a live production. It has already been used to stream Los Angeles Lakers games to Apple Vision Pro.\n\nThis is a specialist tool for sports, concerts and events rather than a drama camera, but it shows where live immersive production is heading.',
  array['Dual 8K × 8K stereoscopic capture', '16 stops of dynamic range', '100G Ethernet with SMPTE-2110 IP output', 'Live ProRes encoding with URSA Live Encoder', 'Built for Apple Immersive Video'],
  '$26,495 · shipping Q3 2026', '2026-04-13', null, null,
  'PetaPixel', 'https://petapixel.com/2026/04/13/blackmagics-new-camera-is-the-worlds-first-for-immersive-live-broadcasting/', 2
),
(
  'CINE-SERVO 40-1200mm T5.0-10.8', 'Canon', 'Lens',
  'The longest-reaching cine-servo zoom yet',
  'A 40–1200mm Super 35 zoom whose built-in 1.5x extender reaches 1800mm and covers full frame.',
  E'Canon''s new CINE-SERVO takes the record for the longest focal length in a cine-servo lens from Canon''s own 50-1000mm, which launched twelve years earlier, while staying close to that lens''s size and weight.\n\nIt covers Super 35 across 40–1200mm at T5.0–10.8. Engage the built-in 1.5x extender and it becomes a 60–1800mm that covers full frame. It comes in PL and RF mounts; the PL version weighs 14.6 lb and is 16 in long.\n\nIt''s aimed at wildlife, sport and broadcast, where one lens has to frame a landscape and an extreme close-up. Canon announced it at NAB 2026 alongside a major Cinema EOS firmware update.',
  array['40–1200mm, T5.0–10.8', 'Built-in 1.5x extender: 60–1800mm', 'Super 35; full frame with the extender', 'PL and RF mounts', 'PL version: 14.6 lb, 16 in long'],
  'Price on request', '2026-04-15', null, null,
  'Canon U.S.A.', 'https://www.usa.canon.com/newsroom/2026/20260415-lens', 3
),
(
  'MISSION 1 PRO', 'GoPro', 'Camera',
  'GoPro goes cine: 8K open gate in a pocket-sized body',
  'A new 50MP 1-inch sensor and GP3 processor bring 8K and open-gate recording to GoPro''s toughest form factor.',
  E'The MISSION 1 series is GoPro''s move into compact cinema cameras, built around a new 50MP 1-inch sensor and the GP3 processor.\n\nThe standard MISSION 1 records 8K30 in both 16:9 and 4:3 open gate. The PRO adds 8K60, 4K240 and 1080p960 in 16:9, plus 8K30 and 4K120 open gate. Both record 10-bit with HLG, have HyperSmooth stabilisation with 360° Horizon Lock, and shoot 50MP RAW stills.\n\nOpen gate lets you crop vertical and horizontal deliverables from one take, which makes it a strong crash cam, POV or B-roll camera alongside your main body.',
  array['50MP 1-inch sensor, GP3 processor', 'PRO: 8K60, 4K240, 1080p960 (16:9)', 'Open gate 4:3: 8K30, and 4K120 on PRO', '10-bit, HLG, 50MP RAW stills', 'HyperSmooth with 360° Horizon Lock'],
  'MISSION 1 $599.99 · MISSION 1 PRO $699.99', '2026-04-20', '47f7a25c-1f68-4251-935e-a87f0279d8d1', null,
  'PetaPixel', 'https://petapixel.com/2026/04/20/gopros-new-8k-mission-1-series-compact-cine-cameras-start-at-600/', 4
),
(
  'Dream Cine primes', '7Artisans', 'Lens',
  'Full-frame T1.5 cine primes from $279',
  'A 35, 50 and 75mm T1.5 set with long focus throws and matched gear positions, in E, Z, L and RF mounts.',
  E'7Artisans'' Dream Cine series is aimed at shooters stepping up from photo lenses to a proper cine workflow. The 35mm, 50mm and 75mm are all T1.5 and cover full frame.\n\nEach has a 300-degree focus throw, a stepless de-clicked aperture and gears in the same position, so a follow focus or motor doesn''t need re-rigging between lenses. The apertures have 11, 10 and 13 blades respectively, and the 50mm has built-in threads for mounting accessories.\n\nThey come in Sony E, Nikon Z, L-Mount and Canon RF, at $279–$299 each or $850 for the set.',
  array['35mm, 50mm and 75mm, all T1.5', 'Full-frame coverage', '300° focus throw, de-clicked aperture', 'Matched gear positions across the set', 'E, Z, L and RF mounts'],
  '$279–$299 each · $850 for the three-lens set', '2026-06-18', null, null,
  'PetaPixel', 'https://petapixel.com/2026/06/18/7artisans-launches-entry-level-cine-lens-series-starting-at-just-279/', 5
);
