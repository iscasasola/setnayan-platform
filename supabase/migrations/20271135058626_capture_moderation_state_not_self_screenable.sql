-- ============================================================================
-- THE UPLOADER DOES NOT DECIDE WHETHER THEIR OWN PHOTO PASSED THE NSFW SCREEN.
-- ============================================================================
--
-- Sixth instance of the shape (20271132839561 chat sender · 20271132843141
-- broadcast sender · 20271132891176 self-promotion to admin · 20271134103060
-- self-awarded experience mark · 20271134376999 self-approved payout
-- destination). `papic_photos` has two PERMISSIVE `FOR ALL` policies — one for
-- the paparazzo who claimed the seat, one for the couple — ZERO BEFORE
-- triggers, and nothing constraining `moderation_state`.
--
-- ── WHY IT IS WORSE THAN "A FORGED FLAG" ──────────────────────────────────
-- `lib/nsfw-screen.ts:258` returns early: `IF record.moderation_state !=
-- 'unscreened' THEN return` — "already decided" — and its UPDATE additionally
-- matches only rows still `'unscreened'`. So a client-supplied `'clean'` at
-- INSERT does not merely mislabel the row: **the screen never runs on it at
-- all**. And because the screen runs once, at upload, a later flip from
-- `'nsfw_blocked'` back to `'clean'` is never re-corrected either.
--
-- Two lanes, both open, both proven in the replay before this migration:
--   1. insert with moderation_state='clean'      → screen skipped entirely
--   2. flip a screened 'nsfw_blocked' row → 'clean' → back on every surface
--
-- The couple's gallery, the guest surfaces and the Live Wall all gate on
-- `moderation_state <> 'nsfw_blocked'` (lib/papic-gallery.ts:146,151,367). The
-- spec corpus carries this as a hard product constraint: "NSFW filter is on by
-- default and CANNOT be disabled."
--
-- ── WHY A PLAIN COLUMN REVOKE IS THE RIGHT SHAPE HERE ─────────────────────
-- EVERY legitimate writer is already service-role, so nothing is given up:
--   • the screen itself                     lib/nsfw-screen.ts (admin client)
--   • the couple's "approve this one" override
--       app/dashboard/[eventId]/studio/papic/moderation/actions.ts:259-265,
--       which uses createAdminClient() and is additionally pinned to
--       `.eq('moderation_state','nsfw_blocked')` so it can only ever undo a
--       classifier block, never touch a consent or faceblock verdict.
-- No RLS-scoped client anywhere writes this column on either table. Unlike the
-- experience mark (20271134103060), there is no legitimate end-user lane to
-- preserve, so the grant can simply go.
--
-- The DEFAULT is `'unscreened'` on both tables, which is the SAFE value here —
-- the opposite of vendor_payment_methods, where the default was the privileged
-- one and had to be flipped. An insert that names nothing lands unscreened, the
-- screen then runs, and the fail-open design (an unscreened row stays visible)
-- is preserved exactly as documented in nsfw-screen.ts:20-26.
--
-- ── WHAT IS *NOT* CHANGED ─────────────────────────────────────────────────
-- • `papic_guest_captures` — the sibling table with the same column — is
--   deliberately untouched. Its only write policy is `admin_all` (is_admin()),
--   so no ordinary user can insert or update a row there at all. Verified, not
--   assumed; the sweep classified it NOT_REACHABLE for the same reason.
-- • `editorial_vendor_media` carries the same column and IS reachable (vendor
--   insert/update + couple update policies), so it gets the same column-level
--   treatment.
-- • Everything else on these tables. The paparazzo still inserts captures, the
--   couple still hides photos and approves showcase picks. The allow-list is
--   COMPUTED from the catalog (precedent 20271005100000) because papic_photos
--   has accreted columns across ~20 migrations — geo, clip keys, faceblock,
--   QR-tag, caps — and a hand-typed keep-list is how one of them silently stops
--   saving.
--
-- ⚠ NOTED, NOT FIXED: `editorial_vendor_media`'s vendor INSERT policy checks
-- only that you are the vendor on a thread for that event. The
-- recommended-pick gate and the 3-photos/3-clips cap live entirely in
-- app/vendor-dashboard/clients/[eventId]/editorial-media/actions.ts, whose own
-- comment calls that gate "the trust boundary" — but it runs through the admin
-- client, so a direct PostgREST insert skips both. That is a different finding,
-- unverified, and deliberately not bundled here.
--
-- Prod: 14 papic_photos rows, all already 'clean'; 0 editorial_vendor_media
-- rows. Nothing to backfill, and freezing the column cannot disturb them.
-- ============================================================================

-- ── 1 · PIN THE VERDICT FOR END-USER SESSIONS ──────────────────────────────
-- SECURITY INVOKER so `current_user` reports the PostgREST request role; a
-- DEFINER function would report the owner and this branch would be dead code.
-- Shared by both tables — the rule is identical and one function cannot drift
-- from itself.
CREATE OR REPLACE FUNCTION public.tg_pin_moderation_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- The screen, the couple's override and the admin console are all
  -- service-role. They are the deciders; there is nothing to protect them from.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- The literal, not DEFAULT, so a future DEFAULT change cannot quietly
    -- re-open the lane this exists to close. 'unscreened' is what makes the
    -- screen run at all.
    NEW.moderation_state := 'unscreened';
  ELSE
    NEW.moderation_state := OLD.moderation_state;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_pin_moderation_state() IS
  'BEFORE INSERT OR UPDATE: end-user sessions cannot set or change '
  'moderation_state. Forced to ''unscreened'' on insert so nsfw-screen.ts, which '
  'skips any row that is not ''unscreened'', actually runs. Migration '
  '20271135058626.';

DROP TRIGGER IF EXISTS papic_photos_pin_moderation_state ON public.papic_photos;
CREATE TRIGGER papic_photos_pin_moderation_state
  BEFORE INSERT OR UPDATE ON public.papic_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_pin_moderation_state();

DROP TRIGGER IF EXISTS editorial_vendor_media_pin_moderation_state ON public.editorial_vendor_media;
CREATE TRIGGER editorial_vendor_media_pin_moderation_state
  BEFORE INSERT OR UPDATE ON public.editorial_vendor_media
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_pin_moderation_state();

-- ── 2 · TAKE THE PEN AWAY ──────────────────────────────────────────────────
-- Computed all-columns-minus-deny-set, per table. A column-level REVOKE against
-- a table-level grant is a Postgres no-op, so the table grant is dropped whole
-- and re-issued.
DO $$
DECLARE
  t    text;
  cols text;
BEGIN
  FOREACH t IN ARRAY ARRAY['papic_photos', 'editorial_vendor_media'] LOOP
    EXECUTE format('REVOKE INSERT, UPDATE ON public.%I FROM authenticated', t);
    EXECUTE format('REVOKE INSERT, UPDATE ON public.%I FROM anon', t);

    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum)
      INTO cols
      FROM pg_attribute a
     WHERE a.attrelid = format('public.%I', t)::regclass
       AND a.attnum > 0
       AND NOT a.attisdropped
       AND a.attname <> 'moderation_state';

    -- anon gets nothing back: no write policy on either table is TO anon, so it
    -- could never insert or update regardless. Papic's login-free paparazzi are
    -- Supabase ANONYMOUS SESSIONS, which carry the `authenticated` DB role — not
    -- `anon` — so their capture path is unaffected by this.
    EXECUTE format('GRANT INSERT (%s) ON public.%I TO authenticated', cols, t);
    EXECUTE format('GRANT UPDATE (%s) ON public.%I TO authenticated', cols, t);
  END LOOP;
END $$;

COMMENT ON COLUMN public.papic_photos.moderation_state IS
  'NSFW verdict. Gates every guest/couple/Live-Wall surface '
  '(lib/papic-gallery.ts). Written ONLY by service-role: nsfw-screen.ts, and the '
  'couple''s single-photo override which is pinned to nsfw_blocked. Not writable '
  'by authenticated/anon — a client-supplied value would make the screen skip '
  'the row entirely (nsfw-screen.ts returns early on anything but ''unscreened'').';
