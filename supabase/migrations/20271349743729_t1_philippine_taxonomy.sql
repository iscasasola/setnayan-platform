-- t1_philippine_taxonomy
-- Created via `pnpm migration:new`. Idempotent — safe to re-apply.
-- ============================================================================
-- BUILD T1 — THE APP MOVES ONTO THE OWNER-APPROVED PHILIPPINE TAXONOMY
-- ============================================================================
--
-- Owner, 2026-11-07: "correct. use terminologies easily recognizable in the
-- philippines" · "add all that we can" · "yes we can add them". Owner,
-- 2026-11-16, on finding the app still on the old tree: "this is not my
-- taxonomy". Corpus: TAXONOMY_PH_FULL_2026-11-07.md ("the ONE spec for build
-- T1") + DECISION_LOG 2026-11-07 "ALL ✚ TAXONOMY AND EVENT ADDITIONS APPROVED"
-- + 2026-11-16 "SERVICE CARD MAKER: NOTHING IS BUILT YET".
--
-- SOURCE: supabase/data/taxonomy-ph-2026-11-07.json is the target. The JSON
-- literal below is that file, minified; lib/t1-taxonomy-is-the-spec.test.ts
-- fails if the two ever differ, and tests/db/t1-taxonomy-is-the-spec.db.test.ts
-- fails if the replayed tables differ from it.
--
-- ── WHAT EXISTED (RULE 0) ───────────────────────────────────────────────────
-- Every mechanism used here already ships; nothing new is invented:
--   · service_categories (groups + categories) and canonical_service_taxonomy
--     (services) — the one source every screen reads since #7417.
--   · canonical_service_schemas.display_name_en — a service's name.
--   · merge_canonical_service() (20271176753752) — folds service A into B in
--     one transaction across all twelve key holders and leaves A as a
--     tombstone carrying merged_into. Every ⇢ in the spec goes through it.
--   · marketplace_hidden — the table's own "keep the key, never offer it".
-- The category merge mechanism (#7348) and taxonomy v2 (#7355) were closed on
-- 7 Nov to make way for T1 and are NOT revived: no category is merged or
-- deleted here. Where the spec combines categories, the surviving category's
-- id is reused, the folded one's services move onto it (a tile_id update; no
-- shop holds a category id), and the folded category is HIDDEN, never deleted,
-- so every couple-side row, refinement card and saved link still resolves.
--
-- ── WHAT THIS DOES (one transaction) ────────────────────────────────────────
--   1. Refuses to run unless merge_canonical_service() exists.
--   2. Groups: the new "Gifts, Giveaways & Souvenirs" group; every group's PH
--      name; the group order (Gifts sits after Invitations & Prints).
--   3. Categories: every category's PH name and group; the new categories
--      (Event Staff & Security; Shoes where a database lacks it); each folded
--      category hidden; each surviving category's event types WIDENED to
--      cover what it absorbed (never narrowed — except Officiants, below).
--   4. Services: every named service is created if missing (the ✚ additions),
--      placed on its category, made visible, named, and ordered as the spec
--      lists it. Setnayan's own products are only checked, never renamed.
--   5. Merges: each ⇢ via merge_canonical_service() — the source's shops,
--      cards, packages, preferences and chats move to the destination. A
--      source that is absent or already merged is skipped (idempotent).
--   6. Hides each ⛔ service and the Tarot / palmistry category.
--   7. Post-conditions: refuses to commit unless the tables equal the target.
--
-- ── OFFICIANTS ──────────────────────────────────────────────────────────────
-- The spec makes Officiants "visible for" house blessing and mass / novena
-- scheduling. The category is shown again, scoped to open_house + wake ONLY,
-- and every priest / pastor / imam / judge row under it stays hidden (owner
-- ruling 2026-08-27 "officiants SHUT" holds for them). No wedding or christening
-- sees the category. Listed as an owner question on the PR.
--
-- ── CALE-ICE / MARIA-AND-JOSE ───────────────────────────────────────────────
-- Nothing here is keyed by an event. The only writes that can reach an event's
-- rows are the ⇢ merges (via merge_canonical_service), and those move a key
-- only where a row holds the merged-away key. Measured in prod 2026-11-16:
-- every merge source has ZERO holders except band_live_music (one shop's
-- services[] — not an event).
--
-- RLS / GRANTS: unchanged — rows in tables that already have RLS. No new table,
-- function, view or policy.
-- ============================================================================

DO $t1$
DECLARE
  v_target  JSONB := $target${"_about":"Build T1 — the owner-approved Philippine taxonomy (corpus TAXONOMY_PH_FULL_2026-11-07.md, 'the ONE spec for build T1'; additions from its 'Additions the events need (approved)' table and DECISION_LOG 2026-11-07 'ALL ✚ TAXONOMY AND EVENT ADDITIONS APPROVED'). This file is the TARGET the migration 20271349…_t1_philippine_taxonomy.sql writes and the guards lib/t1-taxonomy-is-the-spec.test.ts + tests/db/t1-taxonomy-is-the-spec.db.test.ts compare against. Every category id and service key is a STABLE SLUG: an existing id is reused wherever the spec renames or combines, so no saved link, shop or event key changes. 'folds' = categories whose services move onto this one and which are then hidden (marketplace_hidden, never deleted). 'merges' = services folded with merge_canonical_service (merged_into; never deleted). 'hide' = services hidden (⛔). 'new' = ✚. 'kept' = a live service the spec does not name — left visible where it is and listed as an owner question. Tags and inspiration parts are NOT in this file (see the PR body).","groups":[{"id":"venue","label":"Venues & Simbahan","short":"Venues","categories":[{"id":"reception","label":"Reception Venues","services":[{"key":"hotel_ballroom","label":"Hotel ballroom"},{"key":"events_place","label":"Events place"},{"key":"function_hall","label":"Function hall"},{"key":"garden_reception_venue","label":"Garden reception"},{"key":"resort_reception_venue","label":"Resort / beach reception"},{"key":"reception_venue","label":"Reception venue (other)"}]},{"id":"ceremony_venue","label":"Ceremony Venues","services":[{"key":"catholic_church_venue","label":"Catholic church"},{"key":"inc_kapilya_venue","label":"INC kapilya"},{"key":"christian_church_venue","label":"Christian / Born Again church"},{"key":"aglipayan_church_venue","label":"Aglipayan"},{"key":"mosque_venue","label":"Mosque"},{"key":"civil_ceremony_venue","label":"Civil (judge / mayor)"},{"key":"ceremony_venue_booking","label":"Garden / Beach ceremony","question":"The spec lists 'Garden / Beach ceremony' (not marked ✚) and does not list the generic 'Ceremony Venue' (ceremony_venue_booking, 0 shops). It is renamed rather than adding a second key."},{"key":"other_place_of_worship","label":"Other place of worship","new":true}]},{"id":"accommodation","label":"Hotels & Resorts","services":[{"key":"accommodation","label":"Hotel stay"},{"key":"resort_stay","label":"Resort stay"},{"key":"vacation_rental","label":"Villa / vacation house"},{"key":"guesthouse_homestay","label":"Guesthouse / homestay"}]},{"id":"officiants","label":"Officiants","visible":true,"event_types_set":["open_house","wake"],"question":"The spec says Officiants is 'made visible for' house blessing and mass / novena scheduling. The tile is shown again for those two; every priest, pastor, imam and judge row under it stays hidden (owner ruling 2026-08-27 'officiants SHUT' is kept for them), and the category is scoped to open house and wake only, so no wedding or christening sees it.","services":[{"key":"house_blessing","label":"House blessing","new":true,"event_types":["open_house"]},{"key":"mass_novena_scheduling","label":"Mass / novena scheduling","new":true,"event_types":["wake"]}]},{"id":"counseling_seminars","label":"Counseling & Seminars","hidden_unchanged":true,"services":[]}]},{"id":"feast","label":"Catering & Cakes","short":"Catering","categories":[{"id":"catering","label":"Catering","services":[{"key":"catering","label":"Catering"},{"key":"chinese_lauriat_caterer","label":"Chinese lauriat"},{"key":"halal_catering","label":"Halal catering"},{"key":"lechonero","label":"Lechon"},{"key":"christening_package","label":"Christening package","new":true,"event_types":["christening"]},{"key":"fast_food_party_package","label":"Fast-food party package","new":true,"event_types":["birthday"]},{"key":"packed_meals","label":"Packed meals","new":true},{"key":"wake_catering","label":"Wake catering","new":true,"event_types":["wake"]}]},{"id":"cake","label":"Cakes & Desserts","folds":["dessert"],"services":[{"key":"wedding_cake","label":"Wedding cake"},{"key":"dessert_station","label":"Dessert table","question":"The spec names both 'Dessert table (from booths)' under Cakes and 'Dessert station' under Food Carts; there is one live key (dessert_station). It moves to Cakes as 'Dessert table'; no second key is added."}]},{"id":"stations","label":"Live Stations","services":[{"key":"live_cooking_station","label":"Live cooking station"}]},{"id":"crew_meals","label":"Crew Meals","services":[{"key":"crew_meal_supply","label":"Crew meal packs"}]}]},{"id":"planning","label":"Coordinators","short":"Coordinators","categories":[{"id":"coordinator","label":"Coordinators & Planners","services":[{"key":"wedding_coordination","label":"Full coordination"},{"key":"wedding_planner_partial","label":"Partial coordination"},{"key":"day_of_coordinator","label":"On-the-day coordinator"},{"key":"destination_wedding_specialist","label":"Destination wedding"},{"key":"pamamanhikan_coordinator","label":"Pamamanhikan"},{"key":"despedida_planner","label":"Despedida"},{"key":"sponsor_coordinator","label":"Sponsor (ninong/ninang) coordinator"},{"key":"inc_wedding_coordinator","label":"INC wedding"},{"key":"mahr_coordination","label":"Muslim wedding (mahr, separated reception)"},{"key":"religious_venue_coordinator","label":"Religious venue coordinator"},{"key":"setnayan_concierge","label":"Setnayan Concierge","setnayan":true}]},{"id":"date_specialist","label":"Date & Feng Shui","services":[{"key":"date_fengshui_consultant","label":"Date / feng shui consultant"}]},{"id":"wedding_paperwork","label":"Documents","services":[{"key":"marriage_license_expediting","label":"Marriage license help"},{"key":"psa_cenomar_runner","label":"PSA / CENOMAR document runner","new":true},{"key":"apostille_dfa_authentication","label":"Apostille / DFA"}]},{"id":"travel_honeymoon","label":"Travel & Honeymoon","services":[{"key":"honeymoon_planner","label":"Honeymoon planner"},{"key":"destination_wedding_travel_coordinator","label":"Destination travel coordinator"}]}]},{"id":"documentary","label":"Photo & Video","short":"Photo & video","categories":[{"id":"photo_video","label":"Photo & Video","folds":["editorial"],"services":[{"key":"photography","label":"Photography"},{"key":"videography","label":"Videography"},{"key":"pre_nup_photographer","label":"Prenup shoot"},{"key":"same_day_edit","label":"SDE"},{"key":"drone","label":"Drone"},{"key":"family_day2_photographer","label":"Family / Day-2"},{"key":"studio_portrait_photographer","label":"Studio portraits"},{"key":"pre_nup_shoot_locations","label":"Prenup locations"},{"key":"toga_class_photos","label":"Toga & class photos","new":true,"event_types":["graduation"]},{"key":"setnayan_papic","label":"Setnayan Papic","setnayan":true},{"key":"setnayan_ai_edited_highlight","label":"Setnayan AI Edited Highlight","setnayan":true},{"key":"setnayan_save_the_date_mp4","label":"Setnayan Save-the-Date Video MP4","setnayan":true}]},{"id":"livestream","label":"Livestream","hidden_unchanged":true,"services":[]}]},{"id":"look","label":"Gowns, Barong & HMUA","short":"Gowns & HMUA","categories":[{"id":"brides_attire","label":"Gowns & Couturiers","services":[{"key":"bridal_gown_custom","label":"Bridal gown (made-to-measure)"},{"key":"bridal_gown_rental","label":"Bridal gown (rental)"},{"key":"filipiniana_terno","label":"Filipiniana: Terno"},{"key":"filipiniana_maria_clara","label":"Filipiniana: Maria Clara"},{"key":"filipiniana_balintawak","label":"Filipiniana: Balintawak"},{"key":"inc_modest_bridal","label":"Modest bridal (INC)"},{"key":"muslim_modest_bridal","label":"Modest bridal (Muslim)"},{"key":"maranao_wedding_attire","label":"Maranao bridal"},{"key":"tausug_wedding_attire","label":"Tausug bridal"},{"key":"yakan_wedding_attire","label":"Yakan bridal"},{"key":"qipao_cheongsam_attire","label":"Qipao / Cheongsam"},{"key":"sari_lehenga_bridal","label":"Sari / Lehenga"}]},{"id":"grooms_attire","label":"Barong & Suits","services":[{"key":"barong_tagalog_custom","label":"Barong (custom)"},{"key":"barong_tagalog_rental","label":"Barong (rental)"},{"key":"groom_suit_custom","label":"Suit (custom)"},{"key":"groom_suit_rental","label":"Suit (rental)"},{"key":"maranao_groom_attire","label":"Maranao groom"},{"key":"tausug_groom_attire","label":"Tausug groom"},{"key":"yakan_groom_attire","label":"Yakan groom"},{"key":"muslim_groom_attire","label":"Muslim groom"},{"key":"sherwani_groom","label":"Sherwani"}]},{"id":"womens_attire","label":"Entourage & Sponsors","folds":["mens_attire","filipiniana_barongs"],"services":[{"key":"ninang_attire","label":"Ninang Filipiniana"},{"key":"ninong_attire","label":"Ninong barong"},{"key":"bridesmaid_dress","label":"Bridesmaid dress"},{"key":"groomsman_set","label":"Groomsman set"},{"key":"mother_of_bride_gown","label":"Mother of the bride"},{"key":"flower_girl_dress","label":"Flower girl"},{"key":"ring_bearer_suit","label":"Ring bearer"},{"key":"junior_bridesmaid_dress","label":"Junior bridesmaid / groomsman"},{"key":"eighteen_roses_attire","label":"18 roses attire"},{"key":"debutante_gown","label":"Debut gown"},{"key":"baptismal_gown","label":"Baptismal gown / baby barong","new":true,"event_types":["christening"]},{"key":"toga_cap_rental","label":"Toga & cap rental","new":true,"event_types":["graduation"]},{"key":"costume_rental","label":"Costumes","new":true}]},{"id":"hmua","label":"Hair & Make-up (HMUA)","folds":["grooming"],"services":[{"key":"bridal_hmua","label":"Bridal HMUA"},{"key":"family_mua","label":"Entourage & family HMUA"},{"key":"touchup_mua","label":"Touch-up artist"},{"key":"groom_grooming","label":"Groom grooming"}]},{"id":"jewelleries_accessories","label":"Jewellers & Accessories","services":[{"key":"wedding_ring","label":"Wedding rings"},{"key":"engagement_ring","label":"Engagement ring"},{"key":"bridal_jewellery","label":"Bridal jewellery (buy)"},{"key":"bridal_jewellery_rental","label":"Bridal jewellery (rent)"},{"key":"bridal_headpiece","label":"Headpiece / tiara"},{"key":"wedding_veil","label":"Veil"},{"key":"floral_jewellery","label":"Floral jewellery"},{"key":"sponsor_corsage","label":"Sponsor corsage"},{"key":"flower_girl_tiara","label":"Flower girl tiara"}]},{"id":"ceremony_essentials","label":"Ceremony Essentials","services":[{"key":"ceremony_essentials_set","label":"Complete set"},{"key":"arrhae_arras","label":"Arrhae"},{"key":"unity_cord","label":"Cord"},{"key":"unity_veil","label":"Veil"},{"key":"ceremony_candles","label":"Candles"},{"key":"wedding_bible","label":"Bible"},{"key":"ring_coin_bearer_pillow","label":"Ring & coin pillows"},{"key":"wedding_rosary","label":"Rosary"}]},{"id":"shoes_footwear","label":"Shoes","prod_only":true,"coarse":"suit_designer","services":[{"key":"custom_made_shoes","prod_only":true,"label":"Custom-made shoes"},{"key":"shoe_rental","prod_only":true,"label":"Shoe rental"},{"key":"shoe_repair","prod_only":true,"label":"Shoe repair"}]},{"id":"wellness_fitness","label":"Bridal Spa","services":[{"key":"bridal_spa","label":"Bridal spa"}]}]},{"id":"design","label":"Styling, Flowers & Lights","short":"Styling","categories":[{"id":"stylist_decorator","label":"Stylist / Decorator","event_types_add":["date"],"services":[{"key":"stylist_decorator","label":"Stylist / Decorator"},{"key":"capiz_native_decor","label":"Capiz / native"},{"key":"hacienda_heritage_decor","label":"Hacienda / heritage"},{"key":"maranao_okir_decor","label":"Maranao okir"},{"key":"double_happiness_decor","label":"Chinese (double happiness)"},{"key":"tea_set_styling","label":"Tea set styling"},{"key":"mandap_decor","label":"Mandap"},{"key":"proposal_setup","label":"Proposal setup","new":true,"event_types":["date"]},{"key":"balloon_decor","label":"Balloon decor","new":true},{"key":"ribbon_cutting_set","label":"Ribbon-cutting set","new":true,"event_types":["grand_opening","corporate"]}]},{"id":"florist","label":"Florist","services":[{"key":"florals","label":"Florist"},{"key":"bridal_bouquet_specialty","label":"Bridal bouquet"},{"key":"garden_wedding_florist","label":"Garden wedding florist"},{"key":"beach_wedding_florist","label":"Beach wedding florist"}]},{"id":"lights_sound","label":"Lights & Sounds","services":[{"key":"lights_sound","label":"Lights & Sounds"}]},{"id":"led_wall","label":"LED Wall","services":[{"key":"led_video_wall","label":"LED video wall"}]},{"id":"chairs_tents","label":"Rentals & Special Effects","folds":["outdoor","dance_floor","fireworks"],"services":[{"key":"tent_canopy_rental","label":"Tent & canopy"},{"key":"chair_table_rental","label":"Chairs & tables"},{"key":"led_dance_floor","label":"LED dance floor"},{"key":"fireworks_pyro","label":"Fireworks"},{"key":"cold_sparks","label":"Cold sparks","new":true},{"key":"generator_rental","label":"Generator"},{"key":"mobile_restroom_rental","label":"Mobile restroom"},{"key":"cooling_fans_misters","label":"Fans & misters"},{"key":"lounge_set_rental","label":"Lounge set rental","new":true},{"key":"stage_truss_rental","label":"Stage & truss","new":true}]},{"id":"digital_services","label":"Digital Services","setnayan_unchanged":true,"services":[{"key":"setnayan_pailaw","label":"Setnayan Pailaw (LED Background)","setnayan":true},{"key":"setnayan_pakanta","label":"Setnayan Music Maker (Custom Song)","setnayan":true},{"key":"setnayan_custom_monogram","label":"Setnayan Custom Monogram","setnayan":true}]}]},{"id":"program","label":"Hosts, Music & Program","short":"Hosts & music","categories":[{"id":"host_mc","label":"Host","services":[{"key":"host_emcee","label":"Host (emcee)"},{"key":"tea_ceremony_master","label":"Tea ceremony master"},{"key":"kids_party_host","label":"Kids' party host","new":true,"event_types":["birthday","christening"]}]},{"id":"live_band","label":"Live Band & Singers","folds":["wedding_singer"],"services":[{"key":"live_band","label":"Live band"},{"key":"wedding_singer","label":"Wedding singer"},{"key":"acoustic_performer","label":"Acoustic performer"}]},{"id":"choir","label":"Choir & Strings","folds":["orchestra"],"services":[{"key":"choir_string_quartet","label":"Choir & string quartet"},{"key":"orchestra","label":"Orchestra"}]},{"id":"dj","label":"DJ","services":[{"key":"dj","label":"DJ"},{"key":"videoke_rental","label":"Videoke rental","new":true}]},{"id":"performers","label":"Cultural Performers","services":[{"key":"rondalla_ensemble","label":"Rondalla"},{"key":"kulintang_ensemble","label":"Kulintang"},{"key":"folk_performer","label":"Folk dance"},{"key":"lion_dance_troupe","label":"Lion dance"},{"key":"fire_dancers","label":"Fire dancers","new":true},{"key":"wedding_entertainment","label":"Wedding entertainment (general)","question":"The spec lists 'Wedding entertainment (general)' on an 'Other' row of Hosts, Music & Program without naming its category; it stays where it is, under Cultural Performers."}]},{"id":"choreographer","label":"Dance Instructors & Choreographers","services":[{"key":"first_dance_choreographer","label":"First dance instructor"},{"key":"entourage_choreographer","label":"Entourage dance choreographer"},{"key":"cotillion_18_roses_instructor","label":"Cotillion & 18 roses","new":true,"event_types":["debut"]},{"key":"family_dance_instructor","label":"Father-daughter / family dance","new":true}]},{"id":"kids_entertainer","label":"Kids' Party Entertainers","services":[{"key":"kids_entertainer","label":"Kids entertainer"},{"key":"clown","label":"Clown","new":true},{"key":"magician","label":"Magician","new":true},{"key":"mascot","label":"Mascot","new":true},{"key":"inflatables","label":"Inflatables","new":true},{"key":"face_painting","label":"Face painting","new":true},{"key":"balloon_twisting","label":"Balloon twisting","new":true},{"key":"bubble_show","label":"Bubble show","new":true},{"key":"puppet_show","label":"Puppet show","new":true}]},{"id":"speaker_talent","label":"Speakers & AV","folds":["av_production"],"services":[{"key":"speaker_talent","label":"Speaker / talent"},{"key":"av_production","label":"AV production"},{"key":"booth_builder","label":"Booth builder (expos)","new":true,"event_types":["corporate","grand_opening","open_house"]},{"key":"team_building_facilitator","label":"Team-building facilitator","new":true,"event_types":["corporate"],"question":"The spec places Booth builder and Team-building facilitator under 'Program › Speakers & AV / ✚ new \"Event services\"'. Both are filed under Speakers & AV; no 'Event services' category is created."}]}]},{"id":"booths","label":"Booths, Food Carts & Bars","short":"Booths & carts","categories":[{"id":"photo_booth","label":"Photobooths","services":[{"key":"photo_booth","label":"Photobooth"},{"key":"booth_360","label":"360 booth"},{"key":"selfie_magic_mirror","label":"Mirror photobooth"},{"key":"gif_booth","label":"GIF booth"},{"key":"polaroid_booth","label":"Polaroid"},{"key":"photoman","label":"Photoman (roving, instant prints)"},{"key":"setnayan_patiktok","label":"Setnayan Patiktok (TikTok Booth)","setnayan":true}]},{"id":"mobile_bar","label":"Mobile Bar","folds":["mocktail"],"services":[{"key":"mobile_bar","label":"Mobile bar"},{"key":"mocktail_bar","label":"Mocktail bar"}]},{"id":"coffee_espresso","label":"Coffee Cart","services":[{"key":"coffee_booth","label":"Coffee cart"},{"key":"tea_bar","label":"Tea bar"},{"key":"juice_bar","label":"Juice bar","new":true}]},{"id":"food_cart","label":"Food Carts","folds":["food_truck"],"services":[{"key":"food_cart_generic","label":"Food cart"},{"key":"sorbetes_cart","label":"Sorbetes"},{"key":"halo_halo_station","label":"Halo-halo"},{"key":"taho_cart","label":"Taho","new":true},{"key":"kakanin_station","label":"Kakanin","new":true},{"key":"sari_sari_booth","label":"Sari-sari store booth","new":true},{"key":"mini_lechon_station","label":"Mini lechon"},{"key":"crepe_pancake_station","label":"Crepes"},{"key":"cotton_candy_cart","label":"Cotton candy"},{"key":"ice_cream_cart","label":"Ice cream"},{"key":"charcuterie_board","label":"Grazing table"},{"key":"donut_wall_display","label":"Donut booth"},{"key":"franchise_food_cart","label":"Franchise food carts","new":true},{"key":"food_truck","label":"Food truck"},{"key":"popcorn_cart","label":"Popcorn","new":true},{"key":"fishball_kwek_kwek_cart","label":"Fishball / kwek-kwek","new":true},{"key":"ice_scramble_cart","label":"Ice scramble","new":true},{"key":"churros_cart","label":"Churros","new":true},{"key":"shawarma_cart","label":"Shawarma","new":true}]},{"id":"engraving_embroidery","label":"Make & Take","services":[{"key":"leather_imprinting","label":"Leather imprinting","new":true},{"key":"keychain_engraving","label":"Laser engraving"},{"key":"live_embroidery","label":"Live embroidery"},{"key":"bracelet_making","label":"Build-your-own bracelet","new":true},{"key":"brooch_pin_making","label":"Brooch / pin making","new":true},{"key":"brick_building","label":"Lego-style brick building","new":true},{"key":"custom_toys","label":"Custom toys","new":true},{"key":"button_badges","label":"Button badges","new":true},{"key":"tote_painting","label":"Tote painting","new":true},{"key":"terrarium_making","label":"Terrarium","new":true},{"key":"candle_making","label":"Candle making","new":true}]},{"id":"caricature_calligraphy_painting","label":"Live Art","services":[{"key":"caricature_artist","label":"Caricature"},{"key":"live_calligraphy","label":"Live calligraphy"},{"key":"wedding_portrait_painter","label":"Live portrait painter"}]},{"id":"arcade_games","label":"Games","services":[{"key":"arcade_retro_games","label":"Arcade / retro games"},{"key":"vr_ar_station","label":"VR station"}]},{"id":"massage_chair","label":"Pampering","folds":["mini_nail_bar","perfume_bar","henna_tattoo"],"services":[{"key":"massage_chair_station","label":"Massage station"},{"key":"mini_nail_bar","label":"Mini nail bar"},{"key":"hair_touchup_station","label":"Hair touch-up"},{"key":"perfume_bar","label":"Perfume bar"},{"key":"henna_tattoo_booth","label":"Henna / Mehndi"}]}]},{"id":"prints","label":"Invitations & Prints","short":"Invites & prints","categories":[{"id":"printing","label":"Invitations & Signage","services":[{"key":"invitation_print","label":"Printed invitation"},{"key":"invitation_digital","label":"E-invite"},{"key":"ceremony_program","label":"Missalette / program"},{"key":"stationery_signage","label":"Signage & stationery"},{"key":"menu_card","label":"Menu & place cards"},{"key":"tarpaulin_standee","label":"Tarpaulin & standee","new":true},{"key":"memorial_prints","label":"Memorial prints / prayer cards","new":true,"event_types":["wake"]},{"key":"diploma_certificate_printing","label":"Diploma & certificate printing","new":true,"event_types":["graduation","corporate"]},{"key":"tickets_registration","label":"Tickets & registration","new":true}]},{"id":"trophies_awards","label":"Trophies & Medals","services":[{"key":"trophy_supplier","label":"Trophies"},{"key":"medals_plaques","label":"Medals & plaques"}]}]},{"id":"gifts","label":"Gifts, Giveaways & Souvenirs","short":"Gifts","new":true,"categories":[{"id":"souvenir_giveaways","label":"Gifts, Giveaways & Souvenirs","services":[{"key":"souvenirs_giveaways","label":"Souvenirs"},{"key":"personalised_items","label":"Personalised items","new":true},{"key":"food_gifts_hampers","label":"Food gifts & hampers","new":true},{"key":"apparel_shirts","label":"Apparel & shirts","new":true},{"key":"gift_shoes","label":"Shoes","new":true},{"key":"home_appliances","label":"Home & appliances","new":true},{"key":"gadgets","label":"Gadgets","new":true},{"key":"plants","label":"Plants","new":true},{"key":"pasalubong_box","label":"Pasalubong box"},{"key":"angpao_betrothal_supplier","label":"Angpao / betrothal"},{"key":"custom_tissue_napkins","label":"Custom tissue & napkins","new":true},{"key":"raffle_prizes","label":"Raffle prizes","new":true},{"key":"loot_bags","label":"Loot bags","new":true},{"key":"sponsor_token","label":"Ninong & Ninang tokens","question":"The spec lists gifts BY ITEM and makes 'for whom' (Ninong & Ninang, Inaanak…) a buyer-picked tag. The two live for-whom services (sponsor_token, godchild_token) are kept visible and renamed rather than folded, until the for-whom tag exists."},{"key":"godchild_token","label":"Inaanak tokens"}]}]},{"id":"transport","label":"Bridal Cars & Transport","short":"Cars","categories":[{"id":"bridal_car","label":"Bridal Car","services":[{"key":"transportation_bridal_car","label":"Bridal car"},{"key":"vintage_classic_vehicle","label":"Vintage car"},{"key":"horse_drawn_carriage","label":"Horse carriage (kalesa)"},{"key":"bridal_boat_yacht","label":"Bridal boat / yacht"}]},{"id":"guest_shuttle","label":"Van / Coaster Rental","folds":["transfers_rentals"],"services":[{"key":"transportation_guest_shuttle","label":"Guest shuttle"},{"key":"airport_transfer","label":"Airport transfer"},{"key":"boat_ferry_charter","label":"Boat / ferry charter"},{"key":"motorcycle_scooter_rental","label":"Motorcycle / scooter"}]},{"id":"escort","label":"Escort","services":[{"key":"motorcycle_escort","label":"Motorcycle escort"}]}]},{"id":"experience","label":"Guest experiences","short":"Experiences","unchanged":true,"categories":[{"id":"tour_activity","label":"Tours & Activities","services":[{"key":"tour_activity","label":"Tours & Activities"}]},{"id":"tour_guide","label":"Tour Guide","services":[{"key":"tour_guide","label":"Tour Guide"}]}]},{"id":"dining","label":"Dining extras","short":"Dining","unchanged":true,"categories":[{"id":"restaurant_reservation","label":"Restaurant (Reservation)","services":[{"key":"restaurant_reservation","label":"Restaurant (Reservation)"}]}]},{"id":"logistics_safety","label":"Logistics & safety","short":"Logistics","unchanged":true,"categories":[{"id":"referee_official","label":"Referees / Officials","services":[{"key":"referee_official","label":"Referees / Officials"}]},{"id":"event_medic","label":"Medic / First-aid","services":[{"key":"event_medic","label":"Medic / First-aid"}]},{"id":"event_staff_security","label":"Event Staff & Security","new":true,"coarse":"security","icon":"ShieldCheck","event_types":["wedding","debut","corporate","tournament","graduation","gala_night","concert","open_house","grand_opening"],"question":"The spec adds Event staff & ushers and Security guards to Logistics & Safety without naming a category; they get a new category 'Event Staff & Security'.","services":[{"key":"event_staff_ushers","label":"Event staff & ushers","new":true},{"key":"security_guards","label":"Security guards","new":true}]},{"id":"everything_else","label":"Everything else","hidden_unchanged":true,"services":[]}]},{"id":"insurance","label":"Insurance & protection","short":"Insurance","unchanged":true,"categories":[{"id":"event_insurance","label":"Event Insurance","services":[{"key":"event_insurance","label":"Event Insurance"}]},{"id":"personal_accident_insurance","label":"Personal Accident","services":[{"key":"personal_accident_insurance","label":"Personal Accident Insurance"}]},{"id":"travel_insurance","label":"Travel Insurance","services":[{"key":"travel_insurance","label":"Travel Insurance"}]}]},{"id":"specialty","label":"Specialty","short":"Specialty","unchanged":true,"categories":[{"id":"reveal_element","label":"Reveal Element","services":[{"key":"reveal_element","label":"Reveal Element"}]}]},{"id":"farewell","label":"Funeral homes & farewell","short":"Farewell","unchanged":true,"services_unchanged":true,"categories":[{"id":"funeral_home","label":"Funeral Home","services_unchanged":true,"services":[]},{"id":"cremation","label":"Cremation","services_unchanged":true,"services":[]},{"id":"memorial_park","label":"Memorial Park","services_unchanged":true,"services":[]}]}],"merges":[{"from":"orthodox_church_venue","into":"other_place_of_worship"},{"from":"buddhist_temple_venue","into":"other_place_of_worship"},{"from":"hindu_temple_venue","into":"other_place_of_worship"},{"from":"gurdwara_venue","into":"other_place_of_worship"},{"from":"synagogue_venue","into":"other_place_of_worship"},{"from":"lds_temple_venue","into":"other_place_of_worship"},{"from":"kingdom_hall_venue","into":"other_place_of_worship"},{"from":"sda_church_venue","into":"other_place_of_worship"},{"from":"cultural_ceremony_site","into":"other_place_of_worship"},{"from":"born_again_church_venue","into":"christian_church_venue"},{"from":"hotel_stay","into":"accommodation"},{"from":"gender_separated_reception_coordinator","into":"mahr_coordination"},{"from":"engagement_photographer","into":"pre_nup_photographer"},{"from":"highlight_reel_specialist","into":"same_day_edit"},{"from":"drone_videographer","into":"drone"},{"from":"junior_groomsman","into":"junior_bridesmaid_dress"},{"from":"bridal_hair_stylist","into":"bridal_hmua"},{"from":"maternity_bride_mua","into":"bridal_hmua"},{"from":"mature_bride_mua","into":"bridal_hmua"},{"from":"decorator_general","into":"stylist_decorator"},{"from":"event_lights_rental","into":"lights_sound"},{"from":"outdoor_lighting_specialist","into":"lights_sound"},{"from":"outdoor_sound_system","into":"lights_sound"},{"from":"tent_rental","into":"tent_canopy_rental"},{"from":"band_live_music","into":"live_band"},{"from":"pre_cana_dance_trainer","into":"first_dance_choreographer"},{"from":"whiskey_cigar_bar","into":"mobile_bar"},{"from":"mocktail_booth_mini","into":"mocktail_bar"},{"from":"mocktail_only_caterer","into":"mocktail_bar"},{"from":"massage_therapist","into":"massage_chair_station"},{"from":"foot_reflexology","into":"massage_chair_station"},{"from":"aromatherapy_station","into":"massage_chair_station"},{"from":"mehndi_artist","into":"henna_tattoo_booth"},{"from":"muslim_henna_artist","into":"henna_tattoo_booth"},{"from":"wedding_cards_designer","into":"invitation_print"},{"from":"save_the_date_digital","into":"invitation_digital"},{"from":"place_card","into":"menu_card"},{"from":"van_rental","into":"transportation_guest_shuttle"},{"from":"private_car_charter","into":"transportation_guest_shuttle"}],"hide":["visa_wedding_logistics","boudoir_photographer","wedding_garter","bridal_dental","bridal_nutritionist","bridal_fitness","bridal_dermatology","chuppah_rental","bug_repellent_station","parasol_hat_rental","wedding_day_weather_forecaster","silhouette_artist","poetry_typewriter","tarot_astrology","palmistry_reader"],"hide_categories":["tarot_astrology_palmistry"]}$target$::jsonb;
  v_group_order TEXT[] := ARRAY['venue','planning','feast','design','program','documentary','look',
                                'booths','prints','gifts','transport','experience','dining',
                                'logistics_safety','insurance','specialty','farewell'];
  g         JSONB;
  c         JSONB;
  s         JSONB;
  m         JSONB;
  v_k       TEXT;
  v_i       INT;
  v_types   TEXT[];
  v_own     TEXT[];
  v_moved   JSONB := '{}'::jsonb;
  v_res     JSONB;
  v_n       INT;
  v_bad     TEXT;
  v_pre     TEXT[];
BEGIN
  -- 1 ── the merge mechanism must exist.
  IF to_regprocedure('public.merge_canonical_service(text,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: merge_canonical_service() is missing';
  END IF;

  -- The event-type gaps that exist BEFORE this runs (category:event_type a
  -- category claims and no visible service fills). Post-condition (d) refuses
  -- only NEW gaps — an old one is the fillability guard's own allowlist's
  -- business, not a reason to block the taxonomy.
  SELECT COALESCE(array_agg(cl.tile || ':' || cl.et), ARRAY[]::text[]) INTO v_pre
    FROM (SELECT sc.id AS tile, unnest(sc.applicable_event_types) AS et
            FROM public.service_categories sc
           WHERE sc.tier = 2 AND sc.marketplace_hidden IS FALSE) cl
   WHERE NOT EXISTS (
     SELECT 1 FROM public.canonical_service_taxonomy t
       JOIN public.service_categories tc ON tc.id = t.tile_id
      WHERE t.tile_id = cl.tile AND t.marketplace_hidden IS FALSE AND t.merged_into IS NULL
        AND (COALESCE(NULLIF(t.applicable_event_types, '{}'), tc.applicable_event_types) IS NULL
             OR cl.et = ANY (COALESCE(NULLIF(t.applicable_event_types, '{}'), tc.applicable_event_types))));

  -- 2 ── groups.
  FOR g IN SELECT * FROM jsonb_array_elements(v_target->'groups') LOOP
    INSERT INTO public.service_categories
      (id, parent_id, tier, kind, label_en, label_short, slug, sort_order, scope, status,
       service_nature, marketplace_hidden, icon_name)
    VALUES
      (g->>'id', NULL, 1, 'branch', g->>'label', g->>'short', replace(g->>'id', '_', '-'),
       array_position(v_group_order, g->>'id') - 1, 'global', 'active', 'service', FALSE,
       CASE WHEN g->>'id' = 'gifts' THEN 'Gift' END)
    ON CONFLICT (id) DO NOTHING;

    UPDATE public.service_categories
       SET label_en = g->>'label', label_short = g->>'short', updated_at = now()
     WHERE id = g->>'id' AND tier = 1
       AND (label_en IS DISTINCT FROM g->>'label' OR label_short IS DISTINCT FROM g->>'short');
  END LOOP;

  UPDATE public.service_categories sc
     SET sort_order = o.ord - 1, updated_at = now()
    FROM unnest(v_group_order) WITH ORDINALITY AS o(id, ord)
   WHERE sc.id = o.id AND sc.tier = 1 AND sc.sort_order IS DISTINCT FROM o.ord - 1;

  -- 3 ── categories (pass 1: exist, named, in their group).
  FOR g IN SELECT * FROM jsonb_array_elements(v_target->'groups') LOOP
    FOR c IN SELECT * FROM jsonb_array_elements(g->'categories') LOOP
      INSERT INTO public.service_categories
        (id, parent_id, tier, kind, label_en, slug, sort_order, scope, status, service_nature,
         marketplace_hidden, applicable_event_types, coarse_category, icon_name)
      VALUES
        (c->>'id', g->>'id', 2, 'leaf', c->>'label', replace(c->>'id', '_', '-'),
         CASE c->>'id' WHEN 'event_staff_security' THEN 79 WHEN 'shoes_footwear' THEN 39 ELSE 80 END,
         'global', 'active', 'service', FALSE,
         CASE WHEN c ? 'event_types'
              THEN ARRAY(SELECT jsonb_array_elements_text(c->'event_types')) END,
         (c->>'coarse')::public.vendor_category, c->>'icon')
      ON CONFLICT (id) DO NOTHING;

      UPDATE public.service_categories
         SET label_en  = c->>'label',
             parent_id = g->>'id',
             marketplace_hidden = CASE WHEN COALESCE((c->>'hidden_unchanged')::boolean, FALSE)
                                       THEN marketplace_hidden ELSE FALSE END,
             updated_at = now()
       WHERE id = c->>'id'
         AND (label_en IS DISTINCT FROM c->>'label'
              OR parent_id IS DISTINCT FROM g->>'id'
              OR (NOT COALESCE((c->>'hidden_unchanged')::boolean, FALSE) AND marketplace_hidden));
    END LOOP;
  END LOOP;

  -- 4 ── services: create the missing (✚), then place, show, name and order every named one.
  FOR g IN SELECT * FROM jsonb_array_elements(v_target->'groups') LOOP
    FOR c IN SELECT * FROM jsonb_array_elements(g->'categories') LOOP
      v_i := 0;
      FOR s IN SELECT * FROM jsonb_array_elements(c->'services') LOOP
        v_k := s->>'key';
        IF COALESCE((s->>'setnayan')::boolean, FALSE) THEN
          -- Setnayan's own products: checked in the post-conditions, never touched.
          v_i := v_i + 1;
          CONTINUE;
        END IF;

        INSERT INTO public.canonical_service_taxonomy
          (canonical_service, folder_id, tile_id, phase, faith, is_ph, is_setnayan, is_rental,
           dietary, is_tradition, marketplace_hidden, secondary_tiles, sort_order, applicable_event_types)
        VALUES
          (v_k, g->>'id', c->>'id', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE,
           '{}'::TEXT[], v_i,
           CASE WHEN s ? 'event_types'
                THEN ARRAY(SELECT jsonb_array_elements_text(s->'event_types')) END)
        ON CONFLICT (canonical_service) DO NOTHING;

        UPDATE public.canonical_service_taxonomy
           SET folder_id = g->>'id', tile_id = c->>'id', marketplace_hidden = FALSE,
               sort_order = v_i, updated_at = now()
         WHERE canonical_service = v_k
           AND merged_into IS NULL
           AND (folder_id IS DISTINCT FROM g->>'id' OR tile_id IS DISTINCT FROM c->>'id'
                OR marketplace_hidden OR sort_order IS DISTINCT FROM v_i);

        INSERT INTO public.canonical_service_schemas (canonical_service, display_name_en)
        VALUES (v_k, s->>'label')
        ON CONFLICT (canonical_service) DO UPDATE
          SET display_name_en = EXCLUDED.display_name_en
          WHERE canonical_service_schemas.display_name_en IS DISTINCT FROM EXCLUDED.display_name_en;

        v_i := v_i + 1;
      END LOOP;
    END LOOP;
  END LOOP;

  -- 5 ── merges (⇢). Destination exists by now; absent / already-merged sources are skipped.
  FOR m IN SELECT * FROM jsonb_array_elements(v_target->'merges') LOOP
    IF EXISTS (SELECT 1 FROM public.canonical_service_taxonomy
                WHERE canonical_service = m->>'from' AND merged_into IS NULL) THEN
      v_res := public.merge_canonical_service(m->>'from', m->>'into', NULL);
      v_moved := v_moved || jsonb_build_object(m->>'from', v_res->'moved');
    END IF;
  END LOOP;

  -- 6 ── hidden (⛔).
  UPDATE public.canonical_service_taxonomy
     SET marketplace_hidden = TRUE, updated_at = now()
   WHERE canonical_service IN (SELECT jsonb_array_elements_text(v_target->'hide'))
     AND marketplace_hidden IS DISTINCT FROM TRUE;

  UPDATE public.service_categories
     SET marketplace_hidden = TRUE, updated_at = now()
   WHERE id IN (SELECT jsonb_array_elements_text(v_target->'hide_categories'))
     AND marketplace_hidden IS DISTINCT FROM TRUE;

  -- 3b ── categories (pass 2, after every service has moved): hide each folded
  --       category and widen each survivor's event types to what it now holds.
  FOR g IN SELECT * FROM jsonb_array_elements(v_target->'groups') LOOP
    FOR c IN SELECT * FROM jsonb_array_elements(g->'categories') LOOP
      UPDATE public.service_categories
         SET marketplace_hidden = TRUE, updated_at = now()
       WHERE id IN (SELECT jsonb_array_elements_text(COALESCE(c->'folds', '[]'::jsonb)))
         AND marketplace_hidden IS DISTINCT FROM TRUE;

      IF c ? 'event_types_set' THEN
        v_types := ARRAY(SELECT jsonb_array_elements_text(c->'event_types_set'));
        UPDATE public.service_categories
           SET applicable_event_types = v_types, updated_at = now()
         WHERE id = c->>'id' AND applicable_event_types IS DISTINCT FROM v_types;
        CONTINUE;
      END IF;

      SELECT applicable_event_types INTO v_own FROM public.service_categories WHERE id = c->>'id';
      IF v_own IS NULL THEN
        CONTINUE; -- NULL = every event type; nothing to widen.
      END IF;
      -- A folded category that reached every event type makes the survivor reach every one too.
      IF EXISTS (SELECT 1 FROM public.service_categories
                  WHERE id IN (SELECT jsonb_array_elements_text(COALESCE(c->'folds', '[]'::jsonb)))
                    AND applicable_event_types IS NULL) THEN
        UPDATE public.service_categories SET applicable_event_types = NULL, updated_at = now()
         WHERE id = c->>'id';
        CONTINUE;
      END IF;
      SELECT array_agg(DISTINCT t ORDER BY t) INTO v_types FROM (
        SELECT unnest(v_own) AS t
        UNION SELECT unnest(applicable_event_types) FROM public.service_categories
         WHERE id IN (SELECT jsonb_array_elements_text(COALESCE(c->'folds', '[]'::jsonb)))
        UNION SELECT jsonb_array_elements_text(COALESCE(c->'event_types_add', '[]'::jsonb))
        UNION SELECT unnest(cst.applicable_event_types) FROM public.canonical_service_taxonomy cst
         WHERE cst.tile_id = c->>'id' AND cst.marketplace_hidden IS FALSE AND cst.merged_into IS NULL
      ) x;
      -- Only ever widen: keep the stored order, append what is new.
      v_types := v_own || ARRAY(SELECT t FROM unnest(v_types) t WHERE NOT t = ANY (v_own));
      UPDATE public.service_categories
         SET applicable_event_types = v_types, updated_at = now()
       WHERE id = c->>'id' AND applicable_event_types IS DISTINCT FROM v_types;
    END LOOP;
  END LOOP;

  -- 6b ── INSPIRATION PARTS FOLLOW (20271291224109 — a part links SERVICES; its categories
  --       are DERIVED from where those services sit, so a service that moved category takes
  --       its parts with it on its own). Two things do NOT move on their own:
  --   · a part's link to a ⇢-folded service — merge_canonical_service() predates
  --     inspiration_part_services and does not hold it — so the link moves to the destination;
  --   · a part's HOME on a folded category — it moves to the category that absorbed it.
  --   Then every part's stored categories are re-derived (the ③a double write), so the old
  --   inspiration_part_categories table stays a true copy.
  IF to_regclass('public.inspiration_part_services') IS NOT NULL THEN
    FOR m IN SELECT * FROM jsonb_array_elements(v_target->'merges') LOOP
      DELETE FROM public.inspiration_part_services a
       WHERE a.canonical_service = m->>'from'
         AND EXISTS (SELECT 1 FROM public.inspiration_part_services b
                      WHERE b.slot_key = a.slot_key AND b.canonical_service = m->>'into');
      UPDATE public.inspiration_part_services SET canonical_service = m->>'into'
       WHERE canonical_service = m->>'from';
    END LOOP;
  END IF;
  IF to_regclass('public.inspiration_parts') IS NOT NULL THEN
    FOR g IN SELECT * FROM jsonb_array_elements(v_target->'groups') LOOP
      FOR c IN SELECT * FROM jsonb_array_elements(g->'categories') LOOP
        UPDATE public.inspiration_parts
           SET home_category_id = c->>'id', updated_at = now()
         WHERE home_category_id IN (SELECT jsonb_array_elements_text(COALESCE(c->'folds', '[]'::jsonb)));
      END LOOP;
    END LOOP;
    IF to_regprocedure('public.inspiration_part_categories_resync(text)') IS NOT NULL THEN
      PERFORM public.inspiration_part_categories_resync(slot_key) FROM public.inspiration_parts;
    END IF;
  END IF;

  RAISE NOTICE 'T1 taxonomy: rows moved per merge = %', v_moved;

  -- 7 ── post-conditions.
  -- (a) every named service is live, visible, on its category in its group, and named as the spec says.
  SELECT string_agg(x.k, ', ') INTO v_bad
    FROM (
      SELECT ss->>'key' AS k, ss->>'label' AS label, cc->>'id' AS tile, gg->>'id' AS folder,
             COALESCE((ss->>'setnayan')::boolean, FALSE) AS setnayan
        FROM jsonb_array_elements(v_target->'groups') gg,
             jsonb_array_elements(gg->'categories') cc,
             jsonb_array_elements(cc->'services') ss
    ) x
   WHERE NOT EXISTS (
     SELECT 1 FROM public.canonical_service_taxonomy t
       JOIN public.canonical_service_schemas sch USING (canonical_service)
      WHERE t.canonical_service = x.k AND t.tile_id = x.tile AND t.folder_id = x.folder
        AND t.merged_into IS NULL
        AND (x.setnayan OR (t.marketplace_hidden IS FALSE AND sch.display_name_en = x.label))
   );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'refusing to apply: services not where the spec puts them — %', v_bad;
  END IF;

  -- (b) every category is in its group and named; folded ones are hidden.
  SELECT string_agg(cc->>'id', ', ') INTO v_bad
    FROM jsonb_array_elements(v_target->'groups') gg, jsonb_array_elements(gg->'categories') cc
   WHERE NOT EXISTS (SELECT 1 FROM public.service_categories sc
                      WHERE sc.id = cc->>'id' AND sc.parent_id = gg->>'id' AND sc.tier = 2
                        AND sc.label_en = cc->>'label');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'refusing to apply: categories not named / placed as the spec says — %', v_bad;
  END IF;
  SELECT string_agg(f, ', ') INTO v_bad
    FROM jsonb_array_elements(v_target->'groups') gg, jsonb_array_elements(gg->'categories') cc,
         jsonb_array_elements_text(COALESCE(cc->'folds', '[]'::jsonb)) f
   WHERE EXISTS (SELECT 1 FROM public.service_categories WHERE id = f AND marketplace_hidden IS FALSE)
      OR EXISTS (SELECT 1 FROM public.canonical_service_taxonomy
                  WHERE tile_id = f AND marketplace_hidden IS FALSE AND merged_into IS NULL);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'refusing to apply: a folded category is still visible or still holds a visible service — %', v_bad;
  END IF;

  -- (cc) every ⇢ source that exists now forwards to its destination; every ⛔ is hidden.
  SELECT string_agg(mm->>'from', ', ') INTO v_bad
    FROM jsonb_array_elements(v_target->'merges') mm
   WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy
                  WHERE canonical_service = mm->>'from'
                    AND (merged_into IS DISTINCT FROM mm->>'into' OR marketplace_hidden IS FALSE));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'refusing to apply: merges did not land — %', v_bad;
  END IF;
  SELECT count(*) INTO v_n FROM public.canonical_service_taxonomy
   WHERE canonical_service IN (SELECT jsonb_array_elements_text(v_target->'hide'))
     AND marketplace_hidden IS FALSE;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'refusing to apply: % ⛔ service(ss) still visible', v_n;
  END IF;

  -- (d) FILLABILITY on every category this migration names: each event type it
  --     claims has at least one visible service resolving to it
  --     (tests/db/tile-event-type-fillable.db.test.ts).
  SELECT string_agg(cl.tile || ':' || cl.et, ', ') INTO v_bad
    FROM (SELECT sc.id AS tile, unnest(sc.applicable_event_types) AS et
            FROM public.service_categories sc
           WHERE sc.tier = 2 AND sc.marketplace_hidden IS FALSE
             AND sc.id IN (SELECT cc->>'id' FROM jsonb_array_elements(v_target->'groups') gg,
                                                 jsonb_array_elements(gg->'categories') cc
                            WHERE NOT COALESCE((gg->>'unchanged')::boolean, FALSE))) cl
   WHERE NOT (cl.tile || ':' || cl.et) = ANY (v_pre)
     AND NOT EXISTS (
     SELECT 1 FROM public.canonical_service_taxonomy t
       JOIN public.service_categories tc ON tc.id = t.tile_id
      WHERE t.tile_id = cl.tile AND t.marketplace_hidden IS FALSE AND t.merged_into IS NULL
        AND (COALESCE(NULLIF(t.applicable_event_types, '{}'), tc.applicable_event_types) IS NULL
             OR cl.et = ANY (COALESCE(NULLIF(t.applicable_event_types, '{}'), tc.applicable_event_types))));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'refusing to apply: categories claim event types no visible service fills — %', v_bad;
  END IF;
END
$t1$;
