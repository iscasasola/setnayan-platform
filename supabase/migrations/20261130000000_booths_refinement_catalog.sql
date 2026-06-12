-- Booths refinement catalog — complete local (PH) + international coverage.
-- Owner-approved 2026-06-12 (Booths_Refinement_Catalog_2026-06-12.md, corpus root).
-- 7 previously-refinement-less booth tiles get leaves + options; 8 existing booth
-- leaves get PH-local + international additions; 2 cross-tile-overlap options
-- retired (selections live in events.style_preferences JSONB snapshots — retiring
-- only stops future offering); donut wall canonical re-homed food_cart -> dessert;
-- Pabati enters the canonical taxonomy under Booths > Photo Booth per the
-- 2026-06-03 amendment; '56-pax coaster' corrected to '30-pax coaster' (a Toyota
-- Coaster seats ~29; owner-confirmed 2026-06-12).

-- 1 ── new refinement leaves (leaf_key = onboarding PICK_GROUPS key, NOT tile_id)
INSERT INTO public.onboarding_refinements (leaf_key, tile_id, label_en, description_en, main_photo, sort_order, status)
VALUES ('massage_chair', 'massage_chair', 'Wellness Station', 'Pampering for your guests — massage, reflexology, and quick refresh stations.', '/onboarding/refinements/massage_chair/_main.webp', 37, 'active')
ON CONFLICT (leaf_key) DO NOTHING;
INSERT INTO public.onboarding_refinements (leaf_key, tile_id, label_en, description_en, main_photo, sort_order, status)
VALUES ('nail_bar', 'mini_nail_bar', 'Mini Nail Bar', 'Quick manicures and nail art for guests mid-celebration.', '/onboarding/refinements/nail_bar/_main.webp', 38, 'active')
ON CONFLICT (leaf_key) DO NOTHING;
INSERT INTO public.onboarding_refinements (leaf_key, tile_id, label_en, description_en, main_photo, sort_order, status)
VALUES ('perfume_bar', 'perfume_bar', 'Perfume Bar', 'Guests blend or take home a signature scent from your day.', '/onboarding/refinements/perfume_bar/_main.webp', 39, 'active')
ON CONFLICT (leaf_key) DO NOTHING;
INSERT INTO public.onboarding_refinements (leaf_key, tile_id, label_en, description_en, main_photo, sort_order, status)
VALUES ('arcade', 'arcade_games', 'Arcade / Games', 'Games and play corners that keep every age entertained.', '/onboarding/refinements/arcade/_main.webp', 40, 'active')
ON CONFLICT (leaf_key) DO NOTHING;
INSERT INTO public.onboarding_refinements (leaf_key, tile_id, label_en, description_en, main_photo, sort_order, status)
VALUES ('tarot', 'tarot_astrology_palmistry', 'Tarot / Astrology', 'Light-hearted readings your guests will talk about all night.', '/onboarding/refinements/tarot/_main.webp', 41, 'active')
ON CONFLICT (leaf_key) DO NOTHING;
INSERT INTO public.onboarding_refinements (leaf_key, tile_id, label_en, description_en, main_photo, sort_order, status)
VALUES ('caricature', 'caricature_calligraphy_painting', 'Live Art & Calligraphy', 'A live artist capturing guests in sketches, paint, or ink.', '/onboarding/refinements/caricature/_main.webp', 42, 'active')
ON CONFLICT (leaf_key) DO NOTHING;
INSERT INTO public.onboarding_refinements (leaf_key, tile_id, label_en, description_en, main_photo, sort_order, status)
VALUES ('engraving', 'engraving_embroidery', 'Engraving / Embroidery', 'Favors personalized on the spot — engraved or embroidered while guests watch.', '/onboarding/refinements/engraving/_main.webp', 43, 'active')
ON CONFLICT (leaf_key) DO NOTHING;

-- 2 ── options for the new leaves
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('massage_chair', 'Massage chairs', '💆', 'Massage chairs', '/onboarding/refinements/massage_chair/massage-chairs.webp', 0, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('massage_chair', 'Hilot massage', '🙌', 'Hilot massage', '/onboarding/refinements/massage_chair/hilot-massage.webp', 1, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('massage_chair', 'Foot reflexology', '🦶', 'Foot reflexology', '/onboarding/refinements/massage_chair/foot-reflexology.webp', 2, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('massage_chair', 'Aromatherapy bar', '🌸', 'Aromatherapy bar', '/onboarding/refinements/massage_chair/aromatherapy-bar.webp', 3, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('massage_chair', 'Oxygen bar', '💨', 'Oxygen bar', '/onboarding/refinements/massage_chair/oxygen-bar.webp', 4, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('massage_chair', 'Hair touch-up', '💇', 'Hair touch-up', '/onboarding/refinements/massage_chair/hair-touch-up.webp', 5, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('nail_bar', 'Express manicure', '💅', 'Express manicure', '/onboarding/refinements/nail_bar/express-manicure.webp', 0, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('nail_bar', 'Nail art', '🎨', 'Nail art', '/onboarding/refinements/nail_bar/nail-art.webp', 1, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('nail_bar', 'Gel polish', '✨', 'Gel polish', '/onboarding/refinements/nail_bar/gel-polish.webp', 2, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('nail_bar', 'Kids glitter nails', '🌈', 'Kids glitter nails', '/onboarding/refinements/nail_bar/kids-glitter-nails.webp', 3, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('nail_bar', 'Hand spa', '🤲', 'Hand spa', '/onboarding/refinements/nail_bar/hand-spa.webp', 4, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('perfume_bar', 'Custom scent blending', '🧪', 'Custom scent blending', '/onboarding/refinements/perfume_bar/custom-scent-blending.webp', 0, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('perfume_bar', 'Take-home minis', '🎁', 'Take-home minis', '/onboarding/refinements/perfume_bar/take-home-minis.webp', 1, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('perfume_bar', 'Oil-based / halal', '🌙', 'Oil-based / halal', '/onboarding/refinements/perfume_bar/oil-based-halal.webp', 2, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('perfume_bar', 'Solid perfume', '🕯️', 'Solid perfume', '/onboarding/refinements/perfume_bar/solid-perfume.webp', 3, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('perfume_bar', 'Bottle engraving', '✒️', 'Bottle engraving', '/onboarding/refinements/perfume_bar/bottle-engraving.webp', 4, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('arcade', 'Retro arcade', '🕹️', 'Retro arcade', '/onboarding/refinements/arcade/retro-arcade.webp', 0, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('arcade', 'VR station', '🥽', 'VR station', '/onboarding/refinements/arcade/vr-station.webp', 1, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('arcade', 'Claw machine', '🧸', 'Claw machine', '/onboarding/refinements/arcade/claw-machine.webp', 2, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('arcade', 'Karaoke booth', '🎤', 'Karaoke booth', '/onboarding/refinements/arcade/karaoke-booth.webp', 3, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('arcade', 'Perya games', '🎡', 'Perya games', '/onboarding/refinements/arcade/perya-games.webp', 4, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('arcade', 'Giant lawn games', '🎯', 'Giant lawn games', '/onboarding/refinements/arcade/giant-lawn-games.webp', 5, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('arcade', 'Console lounge', '🎮', 'Console lounge', '/onboarding/refinements/arcade/console-lounge.webp', 6, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('tarot', 'Tarot reading', '🔮', 'Tarot reading', '/onboarding/refinements/tarot/tarot-reading.webp', 0, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('tarot', 'Palm reading', '✋', 'Palm reading', '/onboarding/refinements/tarot/palm-reading.webp', 1, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('tarot', 'Birth charts', '🌌', 'Birth charts', '/onboarding/refinements/tarot/birth-charts.webp', 2, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('tarot', 'Fortune sticks', '🎋', 'Fortune sticks', '/onboarding/refinements/tarot/fortune-sticks.webp', 3, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('tarot', 'Numerology', '🔢', 'Numerology', '/onboarding/refinements/tarot/numerology.webp', 4, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('tarot', 'Tea-leaf reading', '🍵', 'Tea-leaf reading', '/onboarding/refinements/tarot/tea-leaf-reading.webp', 5, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('caricature', 'Live wedding painter', '🎨', 'Live wedding painter', '/onboarding/refinements/caricature/live-wedding-painter.webp', 0, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('caricature', 'Caricature', '✏️', 'Caricature', '/onboarding/refinements/caricature/caricature.webp', 1, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('caricature', 'Digital caricature', '📱', 'Digital caricature', '/onboarding/refinements/caricature/digital-caricature.webp', 2, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('caricature', 'Watercolor portraits', '🖌️', 'Watercolor portraits', '/onboarding/refinements/caricature/watercolor-portraits.webp', 3, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('caricature', 'Silhouette cutting', '✂️', 'Silhouette cutting', '/onboarding/refinements/caricature/silhouette-cutting.webp', 4, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('caricature', 'Live calligraphy', '🖋️', 'Live calligraphy', '/onboarding/refinements/caricature/live-calligraphy.webp', 5, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('caricature', 'Poetry typewriter', '⌨️', 'Poetry typewriter', '/onboarding/refinements/caricature/poetry-typewriter.webp', 6, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('engraving', 'Keychain engraving', '🔑', 'Keychain engraving', '/onboarding/refinements/engraving/keychain-engraving.webp', 0, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('engraving', 'Glassware engraving', '🥂', 'Glassware engraving', '/onboarding/refinements/engraving/glassware-engraving.webp', 1, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('engraving', 'Jewelry engraving', '💍', 'Jewelry engraving', '/onboarding/refinements/engraving/jewelry-engraving.webp', 2, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('engraving', 'Live embroidery', '🧵', 'Live embroidery', '/onboarding/refinements/engraving/live-embroidery.webp', 3, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('engraving', 'Handkerchief embroidery', '🤍', 'Handkerchief embroidery', '/onboarding/refinements/engraving/handkerchief-embroidery.webp', 4, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('engraving', 'Leather stamping', '👜', 'Leather stamping', '/onboarding/refinements/engraving/leather-stamping.webp', 5, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;

-- 3 ── additions to existing booth leaves (sort_order appends after current max)
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('photo_booth', 'Pabati', '📹', 'Pabati', '/onboarding/refinements/photo_booth/pabati.webp', 6, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('photo_booth', 'AI photo booth', '🤖', 'AI photo booth', '/onboarding/refinements/photo_booth/ai-photo-booth.webp', 7, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('photo_booth', 'Glam booth', '🖤', 'Glam booth', '/onboarding/refinements/photo_booth/glam-booth.webp', 8, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('photo_booth', 'Slow-motion', '🎥', 'Slow-motion', '/onboarding/refinements/photo_booth/slow-motion.webp', 9, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('photo_booth', 'Audio guest book', '☎️', 'Audio guest book', '/onboarding/refinements/photo_booth/audio-guest-book.webp', 10, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('photo_booth', 'Flipbook', '📖', 'Flipbook', '/onboarding/refinements/photo_booth/flipbook.webp', 11, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('photo_booth', 'Light painting', '✨', 'Light painting', '/onboarding/refinements/photo_booth/light-painting.webp', 12, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('mobile_bar', 'Gin bar', '🍋', 'Gin bar', '/onboarding/refinements/mobile_bar/gin-bar.webp', 6, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('mobile_bar', 'Lambanog / tuba', '🥥', 'Lambanog / tuba', '/onboarding/refinements/mobile_bar/lambanog-tuba.webp', 7, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('mobile_bar', 'Craft beer tap', '🍺', 'Craft beer tap', '/onboarding/refinements/mobile_bar/craft-beer-tap.webp', 8, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('mobile_bar', 'Champagne tower', '🥂', 'Champagne tower', '/onboarding/refinements/mobile_bar/champagne-tower.webp', 9, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('mobile_bar', 'Espresso martini', '🍸', 'Espresso martini', '/onboarding/refinements/mobile_bar/espresso-martini.webp', 10, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('mobile_bar', 'Sake / soju', '🍶', 'Sake / soju', '/onboarding/refinements/mobile_bar/sake-soju.webp', 11, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('coffee', 'Kapeng barako', '🫘', 'Kapeng barako', '/onboarding/refinements/coffee/kapeng-barako.webp', 5, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('coffee', 'Iced / Spanish latte', '🧊', 'Iced / Spanish latte', '/onboarding/refinements/coffee/iced-spanish-latte.webp', 6, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('coffee', 'Matcha bar', '🍵', 'Matcha bar', '/onboarding/refinements/coffee/matcha-bar.webp', 7, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('coffee', 'Cold brew', '🥤', 'Cold brew', '/onboarding/refinements/coffee/cold-brew.webp', 8, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('coffee', 'Chai', '☕', 'Chai', '/onboarding/refinements/coffee/chai.webp', 9, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('mocktail', 'Fresh buko', '🥥', 'Fresh buko', '/onboarding/refinements/mocktail/fresh-buko.webp', 6, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('mocktail', 'Sago''t gulaman', '🧋', 'Sago''t gulaman', '/onboarding/refinements/mocktail/sago-t-gulaman.webp', 7, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('mocktail', 'Smoothies', '🥤', 'Smoothies', '/onboarding/refinements/mocktail/smoothies.webp', 8, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('mocktail', 'Zero-proof cocktails', '🍹', 'Zero-proof cocktails', '/onboarding/refinements/mocktail/zero-proof-cocktails.webp', 9, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('food_truck', 'Silog meals', '🍳', 'Silog meals', '/onboarding/refinements/food_truck/silog-meals.webp', 7, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('food_truck', 'Shawarma', '🌯', 'Shawarma', '/onboarding/refinements/food_truck/shawarma.webp', 8, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('food_truck', 'BBQ / smokehouse', '🍖', 'BBQ / smokehouse', '/onboarding/refinements/food_truck/bbq-smokehouse.webp', 9, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('food_truck', 'Vegan', '🥗', 'Vegan', '/onboarding/refinements/food_truck/vegan.webp', 10, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('dessert', 'Bibingka & puto bumbong', '🫓', 'Bibingka & puto bumbong', '/onboarding/refinements/dessert/bibingka-puto-bumbong.webp', 8, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('dessert', 'Turon / banana cue', '🍌', 'Turon / banana cue', '/onboarding/refinements/dessert/turon-banana-cue.webp', 9, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('dessert', 'Gelato', '🍨', 'Gelato', '/onboarding/refinements/dessert/gelato.webp', 10, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('dessert', 'S''mores', '🔥', 'S''mores', '/onboarding/refinements/dessert/s-mores.webp', 11, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('dessert', 'Bubble waffle', '🧇', 'Bubble waffle', '/onboarding/refinements/dessert/bubble-waffle.webp', 12, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('dessert', 'Dessert tower', '🍰', 'Dessert tower', '/onboarding/refinements/dessert/dessert-tower.webp', 13, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('food_cart', 'Taho', '🥛', 'Taho', '/onboarding/refinements/food_cart/taho.webp', 7, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('food_cart', 'Kwek-kwek / fishball', '🍢', 'Kwek-kwek / fishball', '/onboarding/refinements/food_cart/kwek-kwek-fishball.webp', 8, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('food_cart', 'Isaw grill', '🍗', 'Isaw grill', '/onboarding/refinements/food_cart/isaw-grill.webp', 9, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('food_cart', 'Mais con yelo', '🌽', 'Mais con yelo', '/onboarding/refinements/food_cart/mais-con-yelo.webp', 10, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('food_cart', 'Buko shake', '🥥', 'Buko shake', '/onboarding/refinements/food_cart/buko-shake.webp', 11, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('food_cart', 'Popcorn', '🍿', 'Popcorn', '/onboarding/refinements/food_cart/popcorn.webp', 12, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('food_cart', 'Pretzel', '🥨', 'Pretzel', '/onboarding/refinements/food_cart/pretzel.webp', 13, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('food_cart', 'Takoyaki', '🐙', 'Takoyaki', '/onboarding/refinements/food_cart/takoyaki.webp', 14, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('food_cart', 'Bubble tea', '🧋', 'Bubble tea', '/onboarding/refinements/food_cart/bubble-tea.webp', 15, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('food_cart', 'Oyster bar', '🦪', 'Oyster bar', '/onboarding/refinements/food_cart/oyster-bar.webp', 16, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('food_cart', 'Raclette', '🧀', 'Raclette', '/onboarding/refinements/food_cart/raclette.webp', 17, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('food_cart', 'Other specialty cart', 'None', 'Other specialty cart', NULL, 18, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('henna', 'Indian bridal mehndi', '🪷', 'Indian bridal mehndi', '/onboarding/refinements/henna/indian-bridal-mehndi.webp', 4, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('henna', 'Jagua ink', '🌿', 'Jagua ink', '/onboarding/refinements/henna/jagua-ink.webp', 5, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('henna', 'Metallic flash tattoos', '✨', 'Metallic flash tattoos', '/onboarding/refinements/henna/metallic-flash-tattoos.webp', 6, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('henna', 'Airbrush tattoo', '🎨', 'Airbrush tattoo', '/onboarding/refinements/henna/airbrush-tattoo.webp', 7, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;
INSERT INTO public.onboarding_refinement_options (leaf_key, option_key, emoji, label_en, photo, sort_order, status)
VALUES ('henna', 'Kids glitter tattoos', '🌟', 'Kids glitter tattoos', '/onboarding/refinements/henna/kids-glitter-tattoos.webp', 8, 'active')
ON CONFLICT (leaf_key, option_key) DO NOTHING;

-- 4 ── retire cross-tile-overlap options (capability = its own tile; catalog §1f)
UPDATE public.onboarding_refinement_options SET status='retired', updated_at=now()
WHERE leaf_key='mobile_bar' AND option_key IN ('Mocktail only','Coffee-focused');

-- 5 ── clarify coffee 'Both'
UPDATE public.onboarding_refinement_options SET label_en='Coffee + tea', updated_at=now()
WHERE leaf_key='coffee' AND option_key='Both';

-- 6 ── coaster capacity correction (photo already shows a real Coaster, PR #1293)
UPDATE public.onboarding_refinement_options
SET option_key='30-pax coaster', label_en='30-pax coaster',
    photo='/onboarding/refinements/guest_shuttle/30-pax-coaster.webp', updated_at=now()
WHERE leaf_key='guest_shuttle' AND option_key='56-pax coaster';

-- 7 ── donut wall is a dessert display, not a roving cart (catalog §1b)
UPDATE public.canonical_service_taxonomy SET tile_id='dessert', updated_at=now()
WHERE canonical_service='donut_wall_display' AND tile_id='food_cart';

-- 8 ── Pabati canonical (2026-06-03 amendment: Patiktok + Pabati under Booths > Photo Booth)
INSERT INTO public.canonical_service_taxonomy
  (canonical_service, folder_id, tile_id, phase, is_ph, is_setnayan, is_rental, is_tradition, marketplace_hidden, secondary_tiles)
VALUES ('pabati', 'booths', 'photo_booth', 'V1.1 base', FALSE, TRUE, FALSE, FALSE, FALSE, '{}')
ON CONFLICT (canonical_service) DO NOTHING;
