-- ============================================================================
-- 20260927000001_onboarding_refinements.sql
--
-- DB-backed onboarding refinements (owner 2026-06-08, punch-list items 8 + 9).
-- Lifts the hardcoded REFINEMENTS const out of onboarding-shell.tsx into two
-- admin-editable tables so the "what kind of X?" refinement screens render from
-- DATA (label · description · per-option emoji/photo), not code. The onboarding
-- reads these DB-first via getOnboardingRefinements(); the TS data module
-- (app/onboarding/wedding/_data/refinements.ts) is the seed source below + the
-- behaviour-preserving fallback. Photos are static /public assets.
--
-- RLS: public read (anon + authenticated — onboarding is anonymous + this is
-- public catalogue data, no PII), admin-only write (mirrors
-- canonical_service_schemas). Idempotent.
-- ============================================================================

BEGIN;

-- 1. Leaves — one row per refinable service (ceremony, catering, cake, …).
CREATE TABLE IF NOT EXISTS public.onboarding_refinements (
  leaf_key            TEXT PRIMARY KEY,
  label_en            TEXT NOT NULL,
  description_en      TEXT NOT NULL DEFAULT '',
  main_photo          TEXT,                          -- /public path, or NULL
  is_dynamic_ceremony BOOLEAN NOT NULL DEFAULT FALSE,-- options come from ceremonyOptsFor(faith)
  sort_order          INT NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Options — the carousel choices under each leaf.
CREATE TABLE IF NOT EXISTS public.onboarding_refinement_options (
  leaf_key    TEXT NOT NULL REFERENCES public.onboarding_refinements(leaf_key) ON DELETE CASCADE,
  option_key  TEXT NOT NULL,   -- production key (cuisine_*/pv_*/ceremony_*) for projectables, else === label
  emoji       TEXT,
  label_en    TEXT NOT NULL,
  photo       TEXT,            -- /public path, or NULL → emoji glyph
  sort_order  INT NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (leaf_key, option_key)
);

CREATE INDEX IF NOT EXISTS onboarding_refinement_options_leaf_idx
  ON public.onboarding_refinement_options (leaf_key, sort_order);

ALTER TABLE public.onboarding_refinements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_refinement_options ENABLE ROW LEVEL SECURITY;

-- Public read — couples (often anonymous) render these during onboarding.
DROP POLICY IF EXISTS onboarding_refinements_read_all ON public.onboarding_refinements;
CREATE POLICY onboarding_refinements_read_all
  ON public.onboarding_refinements FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS onboarding_refinement_options_read_all ON public.onboarding_refinement_options;
CREATE POLICY onboarding_refinement_options_read_all
  ON public.onboarding_refinement_options FOR SELECT TO anon, authenticated USING (TRUE);

-- Admin-only write (catalogue edits ripple to every couple).
DROP POLICY IF EXISTS onboarding_refinements_admin_write ON public.onboarding_refinements;
CREATE POLICY onboarding_refinements_admin_write
  ON public.onboarding_refinements FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS onboarding_refinement_options_admin_write ON public.onboarding_refinement_options;
CREATE POLICY onboarding_refinement_options_admin_write
  ON public.onboarding_refinement_options FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3. Seed — generated from app/onboarding/wedding/_data/refinements.ts via
--    scripts/gen-onboarding-refinements-seed.ts (37 leaves · 206 options).
--    ON CONFLICT … DO UPDATE so re-running keeps the DB in sync with the module.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.onboarding_refinements (leaf_key,label_en,description_en,main_photo,is_dynamic_ceremony,sort_order) VALUES
('ceremony','Ceremony venue','Where you’ll say your vows.','/onboarding/refinements/ceremony/_main.webp',TRUE,0),
('catering','Catering','The feast your guests will remember.','/onboarding/refinements/catering/_main.webp',FALSE,1),
('photo_video','Photo & Video','How your day is captured to keep.','/onboarding/refinements/photo_video/_main.webp',FALSE,2),
('coordinator','Coordinator','The calm hands running your day.','/onboarding/refinements/coordinator/_main.webp',FALSE,3),
('cake','Cake','The centerpiece sweet of your reception.','/onboarding/refinements/cake/_main.webp',FALSE,4),
('florist','Florist','The blooms that set your mood.','/onboarding/refinements/florist/_main.webp',FALSE,5),
('hmua','Hair & Makeup','How you’ll look and feel up close.','/onboarding/refinements/hmua/_main.webp',FALSE,6),
('live_band','Live Band','The live sound of your celebration.','/onboarding/refinements/live_band/_main.webp',FALSE,7),
('bride_attire','Bride''s Attire','The gown you’ll walk in.','/onboarding/refinements/bride_attire/_main.webp',FALSE,8),
('stylist','Stylist / Decorator','The look of your whole reception.','/onboarding/refinements/stylist/_main.webp',FALSE,9),
('stations','Food Stations','Live stations guests gather around.','/onboarding/refinements/stations/_main.webp',FALSE,10),
('groom_attire','Groom''s Attire','What the groom wears to wed.','/onboarding/refinements/groom_attire/_main.webp',FALSE,11),
('women_attire','Women''s Attire','Your entourage’s ladies’ looks.','/onboarding/refinements/women_attire/_main.webp',FALSE,12),
('men_attire','Men''s Attire','Your entourage’s gentlemen’s looks.','/onboarding/refinements/men_attire/_main.webp',FALSE,13),
('filipiniana','Filipiniana & Barongs','Heritage fabrics, woven by hand.','/onboarding/refinements/filipiniana/_main.webp',FALSE,14),
('grooming','Grooming','Looking sharp for the big day.','/onboarding/refinements/grooming/_main.webp',FALSE,15),
('jewelry','Jewellery & Accessories','The pieces you’ll keep forever.','/onboarding/refinements/jewelry/_main.webp',FALSE,16),
('dj','DJ','Who keeps the dance floor moving.','/onboarding/refinements/dj/_main.webp',FALSE,17),
('wedding_singer','Wedding Singer','The voice for your key moments.','/onboarding/refinements/wedding_singer/_main.webp',FALSE,18),
('choir','Choir / Quartet','Live music for the ceremony.','/onboarding/refinements/choir/_main.webp',FALSE,19),
('choreographer','Choreographer','For a first dance to remember.','/onboarding/refinements/choreographer/_main.webp',FALSE,20),
('performers','Performers','The surprise that wows your guests.','/onboarding/refinements/performers/_main.webp',FALSE,21),
('livestream','Livestream','Bring far-away loved ones in.','/onboarding/refinements/livestream/_main.webp',FALSE,22),
('mobile_bar','Mobile Bar','Drinks that get the party going.','/onboarding/refinements/mobile_bar/_main.webp',FALSE,23),
('coffee','Coffee / Espresso','A warm cup for your guests.','/onboarding/refinements/coffee/_main.webp',FALSE,24),
('mocktail','Mocktail Bar','Alcohol-free, all the fun.','/onboarding/refinements/mocktail/_main.webp',FALSE,25),
('food_truck','Food Truck','A fun, casual late-night bite.','/onboarding/refinements/food_truck/_main.webp',FALSE,26),
('dessert','Dessert Station','A sweet spread to graze on.','/onboarding/refinements/dessert/_main.webp',FALSE,27),
('food_cart','Food Cart','Nostalgic Filipino treats on wheels.','/onboarding/refinements/food_cart/_main.webp',FALSE,28),
('photo_booth','Photo Booth','Instant keepsakes for your guests.','/onboarding/refinements/photo_booth/_main.webp',FALSE,29),
('henna','Henna / Tattoo','Adornments with meaning.','/onboarding/refinements/henna/_main.webp',FALSE,30),
('printing','Printing & Invites','The paper details guests hold.','/onboarding/refinements/printing/_main.webp',FALSE,31),
('souvenirs','Souvenirs / Giveaways','A thank-you they’ll take home.','/onboarding/refinements/souvenirs/_main.webp',FALSE,32),
('bridal_car','Bridal Car','Your grand arrival and exit.','/onboarding/refinements/bridal_car/_main.webp',FALSE,33),
('guest_shuttle','Guest Shuttle','Getting everyone there together.','/onboarding/refinements/guest_shuttle/_main.webp',FALSE,34),
('escort','Motorcycle Escort','A grand convoy through town.','/onboarding/refinements/escort/_main.webp',FALSE,35),
('outdoor','Outdoor Rentals','Everything an open-air venue needs.','/onboarding/refinements/outdoor/_main.webp',FALSE,36)
ON CONFLICT (leaf_key) DO UPDATE SET label_en=EXCLUDED.label_en, description_en=EXCLUDED.description_en, main_photo=EXCLUDED.main_photo, is_dynamic_ceremony=EXCLUDED.is_dynamic_ceremony, sort_order=EXCLUDED.sort_order, updated_at=now();
INSERT INTO public.onboarding_refinement_options (leaf_key,option_key,emoji,label_en,photo,sort_order) VALUES
('catering','cuisine_filipino','🍲','Filipino','/onboarding/prefs/cuisine_filipino.webp',0),
('catering','cuisine_asian','🥢','Asian','/onboarding/prefs/cuisine_asian.webp',1),
('catering','cuisine_international','🌍','International','/onboarding/prefs/cuisine_international.webp',2),
('catering','cuisine_spanish','🥘','Spanish','/onboarding/prefs/cuisine_spanish.webp',3),
('catering','cuisine_italian','🍝','Italian','/onboarding/prefs/cuisine_italian.webp',4),
('catering','cuisine_fusion','✨','Fusion','/onboarding/prefs/cuisine_fusion.webp',5),
('catering','cuisine_halal','☪️','Halal','/onboarding/refinements/catering/halal.webp',6),
('photo_video','pv_photojournalistic','📸','Photojournalistic','/onboarding/prefs/pv_photojournalistic.webp',0),
('photo_video','pv_classic','🤍','Classic','/onboarding/prefs/pv_classic.webp',1),
('photo_video','pv_editorial','📰','Editorial','/onboarding/prefs/pv_editorial.webp',2),
('photo_video','pv_fineart','🎞️','Fine-art / film','/onboarding/prefs/pv_fineart.webp',3),
('photo_video','pv_cinematic','🎬','Cinematic','/onboarding/prefs/pv_cinematic.webp',4),
('coordinator','Day-of','🗓️','Day-of','/onboarding/refinements/coordinator/day-of.webp',0),
('coordinator','Month-of','📅','Month-of','/onboarding/refinements/coordinator/month-of.webp',1),
('coordinator','Partial','🧩','Partial','/onboarding/refinements/coordinator/partial.webp',2),
('coordinator','Full-service','🤝','Full-service','/onboarding/refinements/coordinator/full-service.webp',3),
('coordinator','Destination','✈️','Destination','/onboarding/refinements/coordinator/destination.webp',4),
('cake','Classic tiered','🎂','Classic tiered','/onboarding/refinements/cake/classic-tiered.webp',0),
('cake','Naked / semi-naked','🌿','Naked / semi-naked','/onboarding/refinements/cake/naked-semi-naked.webp',1),
('cake','Floral','🌸','Floral','/onboarding/refinements/cake/floral.webp',2),
('cake','Modern minimalist','◻️','Modern minimalist','/onboarding/refinements/cake/modern-minimalist.webp',3),
('cake','Themed','✨','Themed','/onboarding/refinements/cake/themed.webp',4),
('florist','Lush & garden','🌿','Lush & garden','/onboarding/refinements/florist/lush-garden.webp',0),
('florist','Minimalist','◻️','Minimalist','/onboarding/refinements/florist/minimalist.webp',1),
('florist','Tropical','🌴','Tropical','/onboarding/refinements/florist/tropical.webp',2),
('florist','Dried / pampas','🌾','Dried / pampas','/onboarding/refinements/florist/dried-pampas.webp',3),
('florist','All-white','🤍','All-white','/onboarding/refinements/florist/all-white.webp',4),
('hmua','Soft glam','🌸','Soft glam','/onboarding/refinements/hmua/soft-glam.webp',0),
('hmua','Natural / no-makeup','🤍','Natural / no-makeup','/onboarding/refinements/hmua/natural-no-makeup.webp',1),
('hmua','Bold & editorial','📰','Bold & editorial','/onboarding/refinements/hmua/bold-editorial.webp',2),
('hmua','Traditional','🏛️','Traditional','/onboarding/refinements/hmua/traditional.webp',3),
('hmua','Airbrush','💨','Airbrush','/onboarding/refinements/hmua/airbrush.webp',4),
('live_band','Acoustic','🎸','Acoustic','/onboarding/refinements/live_band/acoustic.webp',0),
('live_band','Jazz / lounge','🎷','Jazz / lounge','/onboarding/refinements/live_band/jazz-lounge.webp',1),
('live_band','Pop / Top 40','🎤','Pop / Top 40','/onboarding/refinements/live_band/pop-top-40.webp',2),
('live_band','OPM','🇵🇭','OPM','/onboarding/refinements/live_band/opm.webp',3),
('live_band','Classical','🎻','Classical','/onboarding/refinements/live_band/classical.webp',4),
('bride_attire','Ball gown','👰','Ball gown','/onboarding/refinements/bride_attire/ball-gown.webp',0),
('bride_attire','A-line','✨','A-line','/onboarding/refinements/bride_attire/a-line.webp',1),
('bride_attire','Mermaid','🌊','Mermaid','/onboarding/refinements/bride_attire/mermaid.webp',2),
('bride_attire','Sheath','🤍','Sheath','/onboarding/refinements/bride_attire/sheath.webp',3),
('bride_attire','Filipiniana','🌺','Filipiniana','/onboarding/refinements/bride_attire/filipiniana.webp',4),
('stylist','Modern minimalist','◻️','Modern minimalist','/onboarding/refinements/stylist/modern-minimalist.webp',0),
('stylist','Traditional classic','🏛️','Traditional classic','/onboarding/refinements/stylist/traditional-classic.webp',1),
('stylist','Rustic / industrial','🪵','Rustic / industrial','/onboarding/refinements/stylist/rustic-industrial.webp',2),
('stylist','Bohemian','🌾','Bohemian','/onboarding/refinements/stylist/bohemian.webp',3),
('stylist','Luxe glamour','💎','Luxe glamour','/onboarding/refinements/stylist/luxe-glamour.webp',4),
('stylist','Garden / organic','🌿','Garden / organic','/onboarding/refinements/stylist/garden-organic.webp',5),
('stylist','Themed','🎭','Themed','/onboarding/refinements/stylist/themed.webp',6),
('stations','Paella','🥘','Paella','/onboarding/refinements/stations/paella.webp',0),
('stations','Sushi','🍣','Sushi','/onboarding/refinements/stations/sushi.webp',1),
('stations','Ramen','🍜','Ramen','/onboarding/refinements/stations/ramen.webp',2),
('stations','Grill / BBQ','🔥','Grill / BBQ','/onboarding/refinements/stations/grill-bbq.webp',3),
('stations','Pasta','🍝','Pasta','/onboarding/refinements/stations/pasta.webp',4),
('stations','Carving','🍖','Carving','/onboarding/refinements/stations/carving.webp',5),
('stations','Taco bar','🌮','Taco bar','/onboarding/refinements/stations/taco-bar.webp',6),
('groom_attire','Classic suit','🤵','Classic suit','/onboarding/refinements/groom_attire/classic-suit.webp',0),
('groom_attire','Slim-fit suit','✨','Slim-fit suit','/onboarding/refinements/groom_attire/slim-fit-suit.webp',1),
('groom_attire','Tuxedo','🎩','Tuxedo','/onboarding/refinements/groom_attire/tuxedo.webp',2),
('groom_attire','Three-piece','🧥','Three-piece','/onboarding/refinements/groom_attire/three-piece.webp',3),
('groom_attire','Barong (formal white)','🌾','Barong (formal white)','/onboarding/refinements/groom_attire/barong-formal-white.webp',4),
('groom_attire','Embroidered barong','🪡','Embroidered barong','/onboarding/refinements/groom_attire/embroidered-barong.webp',5),
('groom_attire','Polo barong','👔','Polo barong','/onboarding/refinements/groom_attire/polo-barong.webp',6),
('women_attire','Long gown','👗','Long gown','/onboarding/refinements/women_attire/long-gown.webp',0),
('women_attire','Cocktail','🍸','Cocktail','/onboarding/refinements/women_attire/cocktail.webp',1),
('women_attire','Filipiniana','🌺','Filipiniana','/onboarding/refinements/women_attire/filipiniana.webp',2),
('women_attire','Mix & match','🎨','Mix & match','/onboarding/refinements/women_attire/mix-match.webp',3),
('women_attire','Coordinated set','🤝','Coordinated set','/onboarding/refinements/women_attire/coordinated-set.webp',4),
('men_attire','Matching suits','🤵','Matching suits','/onboarding/refinements/men_attire/matching-suits.webp',0),
('men_attire','Barong set','🌾','Barong set','/onboarding/refinements/men_attire/barong-set.webp',1),
('men_attire','Tux','🎩','Tux','/onboarding/refinements/men_attire/tux.webp',2),
('men_attire','Smart casual','👔','Smart casual','/onboarding/refinements/men_attire/smart-casual.webp',3),
('men_attire','Themed','🎭','Themed','/onboarding/refinements/men_attire/themed.webp',4),
('filipiniana','Piña','🌾','Piña','/onboarding/refinements/filipiniana/pi-a.webp',0),
('filipiniana','Jusi','🧵','Jusi','/onboarding/refinements/filipiniana/jusi.webp',1),
('filipiniana','Calado embroidery','🪡','Calado embroidery','/onboarding/refinements/filipiniana/calado-embroidery.webp',2),
('filipiniana','Modern couture','✨','Modern couture','/onboarding/refinements/filipiniana/modern-couture.webp',3),
('filipiniana','Regional weave','🧶','Regional weave','/onboarding/refinements/filipiniana/regional-weave.webp',4),
('grooming','Haircut & style','💈','Haircut & style','/onboarding/refinements/grooming/haircut-style.webp',0),
('grooming','Beard grooming','🧔','Beard grooming','/onboarding/refinements/grooming/beard-grooming.webp',1),
('grooming','Skincare / facial','🧖','Skincare / facial','/onboarding/refinements/grooming/skincare-facial.webp',2),
('grooming','Mani-pedi','💅','Mani-pedi','/onboarding/refinements/grooming/mani-pedi.webp',3),
('grooming','Body treatments','🛁','Body treatments','/onboarding/refinements/grooming/body-treatments.webp',4),
('jewelry','Engagement ring','💍','Engagement ring','/onboarding/refinements/jewelry/engagement-ring.webp',0),
('jewelry','Wedding bands','💞','Wedding bands','/onboarding/refinements/jewelry/wedding-bands.webp',1),
('jewelry','Bridal jewellery','💎','Bridal jewellery','/onboarding/refinements/jewelry/bridal-jewellery.webp',2),
('jewelry','Veil','👰','Veil','/onboarding/refinements/jewelry/veil.webp',3),
('jewelry','Headpiece','👑','Headpiece','/onboarding/refinements/jewelry/headpiece.webp',4),
('jewelry','Garter','🎀','Garter','/onboarding/refinements/jewelry/garter.webp',5),
('dj','Pop','🎤','Pop','/onboarding/refinements/dj/pop.webp',0),
('dj','Dance / EDM','🎧','Dance / EDM','/onboarding/refinements/dj/dance-edm.webp',1),
('dj','Hip-hop','🎙️','Hip-hop','/onboarding/refinements/dj/hip-hop.webp',2),
('dj','OPM','🇵🇭','OPM','/onboarding/refinements/dj/opm.webp',3),
('dj','Classic rock','🎸','Classic rock','/onboarding/refinements/dj/classic-rock.webp',4),
('dj','Throwback 80s/90s','📻','Throwback 80s/90s','/onboarding/refinements/dj/throwback-80s-90s.webp',5),
('dj','K-pop','💃','K-pop','/onboarding/refinements/dj/k-pop.webp',6),
('wedding_singer','OPM','🇵🇭','OPM','/onboarding/refinements/wedding_singer/opm.webp',0),
('wedding_singer','Ballads','🎶','Ballads','/onboarding/refinements/wedding_singer/ballads.webp',1),
('wedding_singer','Pop','🎤','Pop','/onboarding/refinements/wedding_singer/pop.webp',2),
('wedding_singer','Jazz','🎷','Jazz','/onboarding/refinements/wedding_singer/jazz.webp',3),
('wedding_singer','Classical','🎻','Classical','/onboarding/refinements/wedding_singer/classical.webp',4),
('wedding_singer','Religious / liturgical','🙏','Religious / liturgical','/onboarding/refinements/wedding_singer/religious-liturgical.webp',5),
('wedding_singer','Broadway','🎭','Broadway','/onboarding/refinements/wedding_singer/broadway.webp',6),
('choir','Small choir','🎶','Small choir','/onboarding/refinements/choir/small-choir.webp',0),
('choir','Large choir','🎼','Large choir','/onboarding/refinements/choir/large-choir.webp',1),
('choir','String quartet','🎻','String quartet','/onboarding/refinements/choir/string-quartet.webp',2),
('choir','String trio','🎻','String trio','/onboarding/refinements/choir/string-trio.webp',3),
('choir','Chamber ensemble','🎹','Chamber ensemble','/onboarding/refinements/choir/chamber-ensemble.webp',4),
('choreographer','Traditional Filipino','🌺','Traditional Filipino','/onboarding/refinements/choreographer/traditional-filipino.webp',0),
('choreographer','Ballroom','💃','Ballroom','/onboarding/refinements/choreographer/ballroom.webp',1),
('choreographer','Contemporary','🩰','Contemporary','/onboarding/refinements/choreographer/contemporary.webp',2),
('choreographer','Latin / salsa','🪅','Latin / salsa','/onboarding/refinements/choreographer/latin-salsa.webp',3),
('choreographer','K-pop','🕺','K-pop','/onboarding/refinements/choreographer/k-pop.webp',4),
('choreographer','Broadway','🎭','Broadway','/onboarding/refinements/choreographer/broadway.webp',5),
('choreographer','Hip-hop','🎙️','Hip-hop','/onboarding/refinements/choreographer/hip-hop.webp',6),
('performers','Magician','🎩','Magician','/onboarding/refinements/performers/magician.webp',0),
('performers','Fire dancer','🔥','Fire dancer','/onboarding/refinements/performers/fire-dancer.webp',1),
('performers','Comedy','😂','Comedy','/onboarding/refinements/performers/comedy.webp',2),
('performers','Kulintang','🥁','Kulintang','/onboarding/refinements/performers/kulintang.webp',3),
('performers','Rondalla','🎸','Rondalla','/onboarding/refinements/performers/rondalla.webp',4),
('performers','Folk dancers','🌺','Folk dancers','/onboarding/refinements/performers/folk-dancers.webp',5),
('livestream','1080p standard','📹','1080p standard','/onboarding/refinements/livestream/1080p-standard.webp',0),
('livestream','1080p premium','🎥','1080p premium','/onboarding/refinements/livestream/1080p-premium.webp',1),
('livestream','4K','📡','4K','/onboarding/refinements/livestream/4k.webp',2),
('mobile_bar','Full cocktail','🍸','Full cocktail','/onboarding/refinements/mobile_bar/full-cocktail.webp',0),
('mobile_bar','Beer & wine','🍷','Beer & wine','/onboarding/refinements/mobile_bar/beer-wine.webp',1),
('mobile_bar','Mocktail only','🍹','Mocktail only','/onboarding/refinements/mobile_bar/mocktail-only.webp',2),
('mobile_bar','Coffee-focused','☕','Coffee-focused','/onboarding/refinements/mobile_bar/coffee-focused.webp',3),
('mobile_bar','Whiskey & cigar','🥃','Whiskey & cigar','/onboarding/refinements/mobile_bar/whiskey-cigar.webp',4),
('mobile_bar','Themed','🎭','Themed','/onboarding/refinements/mobile_bar/themed.webp',5),
('coffee','Espresso bar','☕','Espresso bar','/onboarding/refinements/coffee/espresso-bar.webp',0),
('coffee','Pour-over','🫗','Pour-over','/onboarding/refinements/coffee/pour-over.webp',1),
('coffee','Specialty beans','🌱','Specialty beans','/onboarding/refinements/coffee/specialty-beans.webp',2),
('coffee','Tea bar','🍵','Tea bar','/onboarding/refinements/coffee/tea-bar.webp',3),
('coffee','Both','✨','Both','/onboarding/refinements/coffee/both.webp',4),
('mocktail','Fruit','🍓','Fruit','/onboarding/refinements/mocktail/fruit.webp',0),
('mocktail','Herbal','🌿','Herbal','/onboarding/refinements/mocktail/herbal.webp',1),
('mocktail','Sparkling','🥂','Sparkling','/onboarding/refinements/mocktail/sparkling.webp',2),
('mocktail','Tea-based','🍵','Tea-based','/onboarding/refinements/mocktail/tea-based.webp',3),
('mocktail','Tropical','🌴','Tropical','/onboarding/refinements/mocktail/tropical.webp',4),
('mocktail','Dessert','🍮','Dessert','/onboarding/refinements/mocktail/dessert.webp',5),
('food_truck','Burgers','🍔','Burgers','/onboarding/refinements/food_truck/burgers.webp',0),
('food_truck','Pizza','🍕','Pizza','/onboarding/refinements/food_truck/pizza.webp',1),
('food_truck','Tacos','🌮','Tacos','/onboarding/refinements/food_truck/tacos.webp',2),
('food_truck','Asian fusion','🥢','Asian fusion','/onboarding/refinements/food_truck/asian-fusion.webp',3),
('food_truck','Filipino street food','🇵🇭','Filipino street food','/onboarding/refinements/food_truck/filipino-street-food.webp',4),
('food_truck','Ice cream','🍦','Ice cream','/onboarding/refinements/food_truck/ice-cream.webp',5),
('food_truck','Grilled skewers','🍢','Grilled skewers','/onboarding/refinements/food_truck/grilled-skewers.webp',6),
('dessert','Pastries','🥐','Pastries','/onboarding/refinements/dessert/pastries.webp',0),
('dessert','Macarons','🍬','Macarons','/onboarding/refinements/dessert/macarons.webp',1),
('dessert','Cupcakes','🧁','Cupcakes','/onboarding/refinements/dessert/cupcakes.webp',2),
('dessert','Chocolate fountain','🍫','Chocolate fountain','/onboarding/refinements/dessert/chocolate-fountain.webp',3),
('dessert','Candy buffet','🍭','Candy buffet','/onboarding/refinements/dessert/candy-buffet.webp',4),
('dessert','Donut wall','🍩','Donut wall','/onboarding/refinements/dessert/donut-wall.webp',5),
('dessert','Churros','🥖','Churros','/onboarding/refinements/dessert/churros.webp',6),
('dessert','Kakanin','🍚','Kakanin','/onboarding/refinements/dessert/kakanin.webp',7),
('food_cart','Halo-halo','🍧','Halo-halo','/onboarding/refinements/food_cart/halo-halo.webp',0),
('food_cart','Ice cream','🍦','Ice cream','/onboarding/refinements/food_cart/ice-cream.webp',1),
('food_cart','Crepe / pancake','🥞','Crepe / pancake','/onboarding/refinements/food_cart/crepe-pancake.webp',2),
('food_cart','Cotton candy','🍬','Cotton candy','/onboarding/refinements/food_cart/cotton-candy.webp',3),
('food_cart','Charcuterie','🧀','Charcuterie','/onboarding/refinements/food_cart/charcuterie.webp',4),
('food_cart','Mini lechon','🐷','Mini lechon','/onboarding/refinements/food_cart/mini-lechon.webp',5),
('food_cart','Sorbetes','🍨','Sorbetes','/onboarding/refinements/food_cart/sorbetes.webp',6),
('photo_booth','Traditional','📸','Traditional','/onboarding/refinements/photo_booth/traditional.webp',0),
('photo_booth','360 booth','🔄','360 booth','/onboarding/refinements/photo_booth/360-booth.webp',1),
('photo_booth','GIF','🎞️','GIF','/onboarding/refinements/photo_booth/gif.webp',2),
('photo_booth','Polaroid / instax','🖼️','Polaroid / instax','/onboarding/refinements/photo_booth/polaroid-instax.webp',3),
('photo_booth','Magic mirror','🪞','Magic mirror','/onboarding/refinements/photo_booth/magic-mirror.webp',4),
('photo_booth','Patiktok','🎬','Patiktok','/onboarding/refinements/photo_booth/patiktok.webp',5),
('henna','Traditional Arabic','🪬','Traditional Arabic','/onboarding/refinements/henna/traditional-arabic.webp',0),
('henna','Modern minimalist','◻️','Modern minimalist','/onboarding/refinements/henna/modern-minimalist.webp',1),
('henna','Elaborate bridal','💍','Elaborate bridal','/onboarding/refinements/henna/elaborate-bridal.webp',2),
('henna','Philippine Muslim','🌙','Philippine Muslim','/onboarding/refinements/henna/philippine-muslim.webp',3),
('printing','Invitations','💌','Invitations','/onboarding/refinements/printing/invitations.webp',0),
('printing','Save-the-date','🗓️','Save-the-date','/onboarding/refinements/printing/save-the-date.webp',1),
('printing','Program','📜','Program','/onboarding/refinements/printing/program.webp',2),
('printing','Place cards','🪧','Place cards','/onboarding/refinements/printing/place-cards.webp',3),
('printing','Menu','📋','Menu','/onboarding/refinements/printing/menu.webp',4),
('printing','Signage','🪧','Signage','/onboarding/refinements/printing/signage.webp',5),
('souvenirs','Edible','🍬','Edible','/onboarding/refinements/souvenirs/edible.webp',0),
('souvenirs','Practical / keychain','🔑','Practical / keychain','/onboarding/refinements/souvenirs/practical-keychain.webp',1),
('souvenirs','Decorative figurine','🗿','Decorative figurine','/onboarding/refinements/souvenirs/decorative-figurine.webp',2),
('souvenirs','Native Filipino','🌺','Native Filipino','/onboarding/refinements/souvenirs/native-filipino.webp',3),
('souvenirs','Candle DIY','🕯️','Candle DIY','/onboarding/refinements/souvenirs/candle-diy.webp',4),
('souvenirs','Succulent','🪴','Succulent','/onboarding/refinements/souvenirs/succulent.webp',5),
('bridal_car','Luxury sedan','🚗','Luxury sedan','/onboarding/refinements/bridal_car/luxury-sedan.webp',0),
('bridal_car','Limousine','🚙','Limousine','/onboarding/refinements/bridal_car/limousine.webp',1),
('bridal_car','Vintage / classic','🚘','Vintage / classic','/onboarding/refinements/bridal_car/vintage-classic.webp',2),
('bridal_car','SUV','🚐','SUV','/onboarding/refinements/bridal_car/suv.webp',3),
('bridal_car','Van / minivan','🚌','Van / minivan','/onboarding/refinements/bridal_car/van-minivan.webp',4),
('bridal_car','Carriage','🐴','Carriage','/onboarding/refinements/bridal_car/carriage.webp',5),
('bridal_car','Motorcycle escort','🏍️','Motorcycle escort','/onboarding/refinements/bridal_car/motorcycle-escort.webp',6),
('guest_shuttle','12-pax van','🚐','12-pax van','/onboarding/refinements/guest_shuttle/12-pax-van.webp',0),
('guest_shuttle','24-pax minibus','🚌','24-pax minibus','/onboarding/refinements/guest_shuttle/24-pax-minibus.webp',1),
('guest_shuttle','48-pax bus','🚍','48-pax bus','/onboarding/refinements/guest_shuttle/48-pax-bus.webp',2),
('guest_shuttle','56-pax coaster','🚎','56-pax coaster','/onboarding/refinements/guest_shuttle/56-pax-coaster.webp',3),
('escort','Parade','🏁','Parade','/onboarding/refinements/escort/parade.webp',0),
('escort','Escort','🏍️','Escort','/onboarding/refinements/escort/escort.webp',1),
('escort','Police-style','🚓','Police-style','/onboarding/refinements/escort/police-style.webp',2),
('escort','Ceremonial diamond','💠','Ceremonial diamond','/onboarding/refinements/escort/ceremonial-diamond.webp',3),
('outdoor','Tent','⛺','Tent','/onboarding/refinements/outdoor/tent.webp',0),
('outdoor','Generator','🔌','Generator','/onboarding/refinements/outdoor/generator.webp',1),
('outdoor','Mobile restroom','🚻','Mobile restroom','/onboarding/refinements/outdoor/mobile-restroom.webp',2),
('outdoor','Cooling fans / misters','🌬️','Cooling fans / misters','/onboarding/refinements/outdoor/cooling-fans-misters.webp',3),
('outdoor','Outdoor sound','🔊','Outdoor sound','/onboarding/refinements/outdoor/outdoor-sound.webp',4),
('outdoor','Outdoor lighting','💡','Outdoor lighting','/onboarding/refinements/outdoor/outdoor-lighting.webp',5)
ON CONFLICT (leaf_key,option_key) DO UPDATE SET emoji=EXCLUDED.emoji, label_en=EXCLUDED.label_en, photo=EXCLUDED.photo, sort_order=EXCLUDED.sort_order, updated_at=now();

COMMIT;
