-- vendor_category: two buckets so no live service has to land in `misc`
--
-- Owner ruling 2026-08-09: "fix the taxonomy if needed. we do not like having
-- categories under misc."
--
-- THE MEASUREMENT BEHIND IT. The admin taxonomy has 15 parents → 70 branches →
-- 246 marketplace-visible leaves. The only bridge into the stored
-- `vendor_category` enum was a LEAF-keyed map built for packages, covering
-- **52 of 246**. The other 194 fell through a `?? 'misc'`. The companion code
-- change maps at the BRANCH instead (70 entries, and a new leaf inherits its
-- branch automatically) — which resolves all but two branches to a category
-- that already existed. These are those two.
--
--   wellness_fitness — the "Wellness & Fitness" branch under Look (5 leaves:
--     spa, fitness and pre-event wellness). Nothing in the enum covered it;
--     `makeup_artist` would have been simply wrong.
--   guest_booth      — seven guest-ACTIVITY branches under Booths (massage
--     chair · perfume bar · arcade / games · henna / tattoo · mini nail bar ·
--     tarot / astrology / palmistry · caricature / calligraphy / painting).
--     `photobooth` exists but means the photo booth specifically. The drinks
--     and food booths are NOT here — they map to mobile_bar / catering /
--     cake_maker, the trades that actually supply them.
--
-- ⚠ THE ENUM WAS ALREADY AHEAD OF THE CODE. It carried 51 values while the
-- TypeScript union listed 45: `bridal_gown`, `groom_suit`, `bridal_shoes`,
-- `groom_shoes`, `entourage_attire` and `parents_attire` exist in the database
-- and are unknown to the app. They are NOT touched here — surfacing them is a
-- product decision (they overlap `gown_designer` / `suit_designer`), not a
-- side effect of this fix. Noted so the next reader does not mistake the gap
-- for damage.
--
-- Safe to re-run: ADD VALUE IF NOT EXISTS is idempotent. No backfill — nothing
-- in production carries `misc` today (0 vendor rows in these branches), so
-- there is no data to reclassify, only future writes to route correctly.
--
-- ⚠ ADD VALUE CANNOT RUN INSIDE A TRANSACTION BLOCK on older PostgreSQL. On 12+
-- it can, which is what `supabase db push` relies on; the pinned engine here is
-- 17. Keeping each ADD as its own statement means a partial failure still
-- leaves a valid type.

ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'wellness_fitness';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'guest_booth';

COMMENT ON TYPE public.vendor_category IS
  'Coarse marketplace bucket stored on vendor_profiles.services and event_vendors.category. '
  'The admin taxonomy (parent -> branch -> leaf) is the vocabulary vendors NAVIGATE; this enum is '
  'what gets STORED and filtered on. lib/vendor-branch-category.ts maps every live BRANCH here, so '
  'a leaf an admin adds tomorrow inherits a real bucket with no code change. '
  'misc is a genuine last resort, not a default: tests/db/no-service-lands-in-misc.db.test.ts reads '
  'the live taxonomy and fails when any marketplace-visible leaf resolves to it.';
