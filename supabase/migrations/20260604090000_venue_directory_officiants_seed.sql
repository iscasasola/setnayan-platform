-- ============================================================================
-- 20260604090000_venue_directory_officiants_seed.sql
--
-- Officiants on venue_directory — sample clergy roster seed for V1 pilot.
--
-- Per CLAUDE.md 2026-05-22 owner directive (verbatim):
--   "add officiants to the current churches so we can check."
--
-- Context: the Officiant flow being built (Task #23 in-flight) needs real
-- data to display when a host locks a ceremony venue. The flow reads each
-- venue's sample clergy roster, and falls back to a "search outside this
-- parish" or manual-add option when the roster is empty. This seed
-- populates the most popular Filipino Catholic venues with placeholder
-- clergy so the pilot can exercise the flow end-to-end against real data.
--
-- IMPORTANT — sample-data caveat:
--   Real clergy rosters change weekly. Parish offices are the canonical
--   source of truth for "who can officiate your wedding here." This seed
--   exists ONLY to populate the pilot UX so the flow renders something
--   useful. Every officiant note carries a "Sample clergy" caveat so
--   couples + admins understand to verify with the parish before booking.
--   Pre-launch, an admin pass should refresh against current parish data.
--
-- Architecture decisions:
--   • Column shape is JSONB array of objects (name · title · contact_number
--     · contact_email · notes). JSONB chosen over a separate
--     venue_officiants table because (a) rosters are small (1-5 entries
--     per venue), (b) read access is always alongside the parent
--     venue_directory row, (c) edits are admin-only via the same
--     edit-form a future Cowork pass will ship.
--   • Default '[]' so the Officiant card renders a sensible empty state
--     ("This parish hasn't shared its clergy roster — contact them
--     directly") instead of erroring on a NULL deref.
--   • UPDATEs use ILIKE patterns against name + slug so the seed lands
--     correctly regardless of minor naming drift. UPDATEs that find 0
--     rows are silently no-op — the seed is robust against venues that
--     aren't in venue_directory yet.
--   • No INSERTs for new venues — the existing seed at
--     20260526010000_venue_directory_seed.sql is the canonical source for
--     which venues exist; this migration only adds officiant data to
--     venues already there.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + UPDATE statements with
-- compatible WHERE clauses (re-running overwrites with the same JSONB,
-- which is a no-op outcome).
--
-- Cross-references:
--   • venue_directory schema: 20260526010000_venue_directory_seed.sql
--   • CLAUDE.md 2026-05-22 owner directive (Task #23 Officiant flow)
--   • CLAUDE.md 2026-05-09 row § "0006 vendors taxonomy" (officiant_priest_minister
--     canonical_service — separate concept: vendor-side directory of
--     freelance officiants. This migration populates the CLERGY ROSTER per
--     parish venue, not the vendor-side service.)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Add officiants column (idempotent)
-- ----------------------------------------------------------------------------

ALTER TABLE public.venue_directory
  ADD COLUMN IF NOT EXISTS officiants JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.venue_directory.officiants IS
  'Sample clergy roster per venue. Format: '
  '[{name, title, contact_number, contact_email, notes}, ...]. Marked as '
  'sample — real rosters are maintained at parish level. Used by the '
  'Officiant card on Home (CLAUDE.md 2026-05-22 Task #23). Default empty '
  'array means "no roster known — couple contacts the parish directly."';

-- ----------------------------------------------------------------------------
-- 2. Seed sample officiants for popular Filipino Catholic venues
--
-- Strategy: UPDATEs match against slug (preferred — stable + unique) OR
-- name (ILIKE fallback for resilience). All UPDATEs are no-op when
-- target venue isn't in the directory.
-- ----------------------------------------------------------------------------

-- ════════════════ Manila & NCR Catholic venues ════════════════

-- Manila Cathedral (Intramuros)
UPDATE public.venue_directory
SET officiants = '[
  {"name":"Cardinal Jose Advincula","title":"Cardinal","contact_number":null,"contact_email":null,"notes":"Sample clergy · Archbishop of Manila · presides over major weddings only"},
  {"name":"Father Reginald Malicdem","title":"Priest","contact_number":"+63 2 8527 1796","contact_email":"info@manilacathedral.com.ph","notes":"Sample clergy · parish office line"}
]'::jsonb
WHERE slug = 'manila-cathedral' OR name ILIKE 'Manila Cathedral';

-- San Agustin Church (Intramuros)
UPDATE public.venue_directory
SET officiants = '[
  {"name":"Father Ricardo Villaroya OSA","title":"Priest","contact_number":"+63 2 8527 4060","contact_email":null,"notes":"Sample clergy · Augustinian"},
  {"name":"Father Domingo Reynoso OSA","title":"Priest","contact_number":null,"contact_email":null,"notes":"Sample clergy · Augustinian"}
]'::jsonb
WHERE slug = 'san-agustin-church' OR name ILIKE 'San Agustin Church';

-- Quiapo Church
UPDATE public.venue_directory
SET officiants = '[
  {"name":"Monsignor Hernando Coronel","title":"Monsignor","contact_number":"+63 2 8733 4901","contact_email":null,"notes":"Sample clergy · parish office line"},
  {"name":"Father Joseph Roque","title":"Priest","contact_number":null,"contact_email":null,"notes":"Sample clergy"}
]'::jsonb
WHERE slug = 'quiapo-church' OR name ILIKE '%Quiapo Church%';

-- Sto. Domingo Church (QC)
UPDATE public.venue_directory
SET officiants = '[
  {"name":"Father Edwin Lao OP","title":"Priest","contact_number":"+63 2 8742 5333","contact_email":null,"notes":"Sample clergy · Dominican"},
  {"name":"Father Roberto Pinto OP","title":"Priest","contact_number":null,"contact_email":null,"notes":"Sample clergy · Dominican"}
]'::jsonb
WHERE slug = 'sto-domingo-church' OR name ILIKE 'Sto. Domingo Church';

-- Sacred Heart Parish — Cubao
UPDATE public.venue_directory
SET officiants = '[
  {"name":"Father Anton Pascual","title":"Priest","contact_number":"+63 2 8721 2191","contact_email":null,"notes":"Sample clergy · parish office line"},
  {"name":"Father Joseph Galang","title":"Priest","contact_number":null,"contact_email":null,"notes":"Sample clergy"}
]'::jsonb
WHERE slug = 'sacred-heart-cubao' OR name ILIKE 'Sacred Heart Parish%Cubao%';

-- Christ the King Parish — Greenmeadows
UPDATE public.venue_directory
SET officiants = '[
  {"name":"Father Raul Tan","title":"Priest","contact_number":"+63 2 8636 4400","contact_email":null,"notes":"Sample clergy · parish office line"}
]'::jsonb
WHERE slug = 'christ-the-king-greenmeadows' OR name ILIKE '%Christ the King Parish%Greenmeadows%';

-- Mary the Queen Parish — Greenhills
UPDATE public.venue_directory
SET officiants = '[
  {"name":"Father Carmelo Caluag","title":"Priest","contact_number":"+63 2 8721 4444","contact_email":null,"notes":"Sample clergy · parish office line"},
  {"name":"Father Joel Ulep","title":"Priest","contact_number":null,"contact_email":null,"notes":"Sample clergy"}
]'::jsonb
WHERE slug = 'mary-the-queen-greenhills' OR name ILIKE 'Mary the Queen Parish%Greenhills%';

-- National Shrine of Our Lady of Guadalupe (Makati)
UPDATE public.venue_directory
SET officiants = '[
  {"name":"Father Domingo Apilan","title":"Priest","contact_number":"+63 2 8895 0701","contact_email":null,"notes":"Sample clergy · parish office line"}
]'::jsonb
WHERE slug = 'our-lady-of-guadalupe-makati' OR name ILIKE 'National Shrine of Our Lady of Guadalupe';

-- Santuario de San Jose Parish (Greenhills)
UPDATE public.venue_directory
SET officiants = '[
  {"name":"Father Greg Bicomong","title":"Priest","contact_number":"+63 2 8721 5505","contact_email":null,"notes":"Sample clergy · parish office line"}
]'::jsonb
WHERE slug = 'santuario-de-san-jose-greenhills' OR name ILIKE 'Santuario de San Jose Parish';

-- Mt. Carmel Shrine — New Manila
UPDATE public.venue_directory
SET officiants = '[
  {"name":"Father Pacifico Nepomuceno OCD","title":"Priest","contact_number":"+63 2 8723 6411","contact_email":null,"notes":"Sample clergy · Carmelite"},
  {"name":"Father Vincent Ramos OCD","title":"Priest","contact_number":null,"contact_email":null,"notes":"Sample clergy · Carmelite"}
]'::jsonb
WHERE slug = 'mt-carmel-shrine-new-manila' OR name ILIKE 'Mt. Carmel Shrine%New Manila%';

-- ════════════════ Tagaytay & Batangas Catholic venues ════════════════

-- Pink Sisters Convent — Tagaytay
UPDATE public.venue_directory
SET officiants = '[
  {"name":"Father Carlo Tan","title":"Priest","contact_number":"+63 46 413 1100","contact_email":null,"notes":"Sample clergy · resident priest"},
  {"name":"Father Renato Maglinte","title":"Priest","contact_number":null,"contact_email":null,"notes":"Sample clergy"}
]'::jsonb
WHERE slug = 'pink-sisters-tagaytay' OR name ILIKE 'Pink Sisters Convent%Tagaytay%';

-- Saint Anthony Parish — Tagaytay
UPDATE public.venue_directory
SET officiants = '[
  {"name":"Father Anthony Aclan","title":"Priest","contact_number":"+63 46 413 0095","contact_email":null,"notes":"Sample clergy · parish office line"}
]'::jsonb
WHERE slug = 'st-anthony-parish-tagaytay' OR name ILIKE 'Saint Anthony Parish%Tagaytay%';

-- Our Lady of Manaoag Chapel — Tagaytay
UPDATE public.venue_directory
SET officiants = '[
  {"name":"Father Ramon Bautista OP","title":"Priest","contact_number":"+63 46 413 0200","contact_email":null,"notes":"Sample clergy · Dominican · resident priest"}
]'::jsonb
WHERE slug = 'our-lady-of-manaoag-tagaytay' OR name ILIKE 'Our Lady of Manaoag Chapel%Tagaytay%';

-- Caleruega — Transfiguration Chapel
UPDATE public.venue_directory
SET officiants = '[
  {"name":"Father Antonio Dela Cruz OP","title":"Priest","contact_number":"+63 917 555 0201","contact_email":null,"notes":"Sample clergy · Dominican · Caleruega resident"},
  {"name":"Father Gabriel Mendoza OP","title":"Priest","contact_number":null,"contact_email":null,"notes":"Sample clergy · Dominican"}
]'::jsonb
WHERE slug = 'caleruega-church' OR name ILIKE 'Caleruega%' OR name ILIKE '%Transfiguration Chapel%';

-- Pico de Loro Chapel
UPDATE public.venue_directory
SET officiants = '[
  {"name":"Father Esteban Lopez","title":"Priest","contact_number":"+63 998 555 0301","contact_email":null,"notes":"Sample clergy · visiting officiant — confirm with venue coordinator"}
]'::jsonb
WHERE slug = 'pico-de-loro-chapel' OR name ILIKE 'Pico de Loro Chapel';

-- ════════════════ Cebu & Visayas Catholic venues ════════════════

-- Cebu Metropolitan Cathedral
UPDATE public.venue_directory
SET officiants = '[
  {"name":"Archbishop Jose Palma","title":"Archbishop","contact_number":null,"contact_email":null,"notes":"Sample clergy · Archbishop of Cebu · presides over major weddings only"},
  {"name":"Father Carlo Marquez","title":"Priest","contact_number":"+63 32 255 4253","contact_email":"info@cebucathedral.ph","notes":"Sample clergy · parish office line"},
  {"name":"Father Luis Rodriguez","title":"Priest","contact_number":null,"contact_email":null,"notes":"Sample clergy"}
]'::jsonb
WHERE slug = 'cebu-metropolitan-cathedral' OR name ILIKE 'Cebu Metropolitan Cathedral';

-- Basilica Minore del Santo Niño (Cebu)
UPDATE public.venue_directory
SET officiants = '[
  {"name":"Father Romeo Cruz OSA","title":"Priest","contact_number":"+63 32 255 6699","contact_email":null,"notes":"Sample clergy · Augustinian · parish office line"},
  {"name":"Father Mario Reyes OSA","title":"Priest","contact_number":null,"contact_email":null,"notes":"Sample clergy · Augustinian"},
  {"name":"Monsignor Jose Santos","title":"Monsignor","contact_number":null,"contact_email":null,"notes":"Sample clergy · senior officiant"}
]'::jsonb
WHERE slug = 'santo-nino-basilica-cebu' OR name ILIKE '%Basilica Minore del Santo Ni%';

-- Jaro Metropolitan Cathedral (Iloilo)
UPDATE public.venue_directory
SET officiants = '[
  {"name":"Archbishop Jose Romeo Lazo","title":"Archbishop","contact_number":null,"contact_email":null,"notes":"Sample clergy · Archbishop of Jaro · presides over major weddings only"},
  {"name":"Father Rafael Lavilla","title":"Priest","contact_number":"+63 33 320 4504","contact_email":null,"notes":"Sample clergy · parish office line"}
]'::jsonb
WHERE slug = 'iloilo-cathedral' OR name ILIKE 'Jaro Metropolitan Cathedral';

-- ════════════════ Mindanao Catholic venues ════════════════

-- San Pedro Cathedral — Davao
UPDATE public.venue_directory
SET officiants = '[
  {"name":"Archbishop Romulo Valles","title":"Archbishop","contact_number":null,"contact_email":null,"notes":"Sample clergy · Archbishop of Davao · presides over major weddings only"},
  {"name":"Father Ronaldo Pueblos","title":"Priest","contact_number":"+63 82 222 1421","contact_email":null,"notes":"Sample clergy · parish office line"}
]'::jsonb
WHERE slug = 'davao-cathedral' OR name ILIKE 'San Pedro Cathedral%Davao%';

COMMIT;

-- ============================================================================
-- Verification (manual · run separately to confirm seeding):
--
--   SELECT slug, name, jsonb_array_length(officiants) AS roster_size
--   FROM public.venue_directory
--   WHERE venue_type = 'catholic_church'
--   ORDER BY slug;
--
-- Expected: ~19 catholic_church rows; ~18 should have non-empty officiants
-- arrays after this migration applies. The remaining ones (if any) either
-- weren't in the existing seed or didn't match any of the WHERE clauses
-- above — admins can populate them via the future officiants edit form.
-- ============================================================================
