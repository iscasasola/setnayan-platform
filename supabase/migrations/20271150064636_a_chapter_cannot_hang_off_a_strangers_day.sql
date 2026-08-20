-- ============================================================================
-- A chapter cannot hang off a stranger's day — and the author cannot put it there
-- ============================================================================
-- 🚨 MEASURED IN PRODUCTION, 2026-08-20, INSIDE A ROLLED-BACK TRANSACTION.
-- As the `authenticated` role, carrying one test account's own JWT, this
-- INSERT was ACCEPTED by the live database:
--
--   INSERT INTO creator_chapters (user_id, title, kind, body, status,
--                                 event_id, host_included_at)
--   VALUES (<their own id>, …, 'published',
--           <a wedding they have nothing to do with>, now());
--
-- Both forged fields stuck. So today any signed-in account can:
--   1. attach their PUBLIC chapter to ANY celebration — and the chapter page
--      then renders that celebration's booked suppliers
--      (app/u/[userSlug]/c/[chapterId]/page.tsx → loadBookedVendorProfileIds),
--      i.e. a private wedding's supplier list on a stranger's public page; and
--   2. stamp `host_included_at` themselves, which is the switch that puts a
--      chapter where SETNAYAN SPEAKS ABOUT THAT WEDDING (the cross-rail chip
--      in lib/storytellers.ts `loadChapterCutsForEvents`).
--
-- 🔑 WHY THE EXISTING GUARD NEVER FIRED — A COLUMN-LEVEL REVOKE CANNOT
-- SUBTRACT FROM A TABLE-LEVEL GRANT. 20271143154220 did exactly the right
-- thing on paper:
--     REVOKE UPDATE (host_included_at) ON creator_chapters FROM authenticated;
-- but `authenticated` holds TABLE-level INSERT/UPDATE on this table (read out
-- of prod: information_schema.role_table_grants). A table grant covers every
-- column, and revoking one column from it removes a column grant that was
-- never the thing doing the work. Measured after the revoke shipped:
--     has_column_privilege('authenticated','creator_chapters',
--                          'host_included_at','UPDATE') = TRUE.
-- ⚠ AND A TEST PINS THAT REVOKE (lib/chapter-event-link.test.ts) — it reads the
-- migration TEXT, so it has been green for five days over a control that does
-- not exist. **A guard can match a string instead of the act.**
--
-- 🔑 AND THE TRIGGER DID NOT COVER IT EITHER, for two separate reasons:
--   • it fired `BEFORE INSERT OR UPDATE OF event_id`, so an UPDATE naming only
--     `host_included_at` never reached it at all; and
--   • on INSERT it only ever *set* the value when it was NULL and the author
--     was the host — it never CLEARED a value the author submitted.
--
-- ── WHAT THIS MIGRATION DOES ────────────────────────────────────────────────
-- 1. The inclusion trigger becomes the gate for BOTH fields, and asks the two
--    questions lib/chapter-event-participation.resolveEventTie asks in TypeScript
--    — do you host this celebration, or was a shop of yours booked on it — in
--    SQL, where a browser client cannot go around them.
-- 2. Specifically:
--      • a browser caller naming an event_id it has no tie to is REFUSED;
--      • a browser caller can never write `host_included_at` at all — the value
--        is re-derived from OLD, or from the author's own hosting.
--    ⚖ THE SERVICE ROLE IS TRUSTED, deliberately: the host's own
--    "put this on / take this off my day" (app/dashboard/[eventId]/website/
--    stories/actions.ts) runs there, and it is the ONLY legitimate writer.
-- 3. The trigger now fires on EVERY insert and update, not only when event_id
--    is named — that omission is half of why the forgery worked.
--
-- 🪤 `current_user` IS THE FUNCTION OWNER INSIDE A `SECURITY DEFINER` BODY, AND
-- THAT COST TWO DRAFTS. The first cut asked `current_user IN
-- ('authenticated','anon')` from inside the definer body — false for every
-- caller, so the gate was inert; probing prod proved the forged INSERT still
-- went through. The second cut made the trigger INVOKER and pushed the lookups
-- into a DEFINER helper — which has to be granted to `authenticated`, and
-- PostgREST then publishes it at /rest/v1/rpc/ as an oracle answering "is user
-- X tied to event Y?" for ANY pair. `exposure-freeze.db.test.ts` caught that
-- one; it is a better reviewer than I was.
-- ✅ What actually survives the definer boundary is `current_setting('role')` —
-- measured in production: 'authenticated' under PostgREST's per-request SET
-- LOCAL ROLE, 'service_role' for our own server actions, 'none' for a
-- migration. A browser client cannot change it, because it cannot run SQL.
--
-- 🪤 AND AUTO-INCLUSION ONLY HAPPENS WHEN THE LINK IS BEING MADE. Widening the
-- trigger to every UPDATE re-ran the "the author is the host ⇒ included" rule
-- on ordinary edits, which would have SILENTLY UNDONE a host taking their own
-- chapter off their day: the next title edit put it back. Caught by probing the
-- host's own remove-then-edit path, not by reading the diff.
--
-- ✅ ALL SEVEN OUTCOMES BELOW WERE PROVEN AGAINST PRODUCTION IN A ROLLED-BACK
--    TRANSACTION BEFORE THIS FILE WAS WRITTEN:
--      1 forge a stranger's celebration on INSERT ............ REFUSED
--      2 their own celebration .............................. accepted, auto-included
--      3 re-point an existing chapter at a stranger's day ... REFUSED
--      4 a chapter about no celebration at all .............. accepted
--      5 host removes it from their day (service role) ...... works
--      6 an ordinary edit afterwards does NOT put it back ... stays off
--      7 host puts it back (service role) ................... works
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 2. The gate.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_chapter_host_inclusion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- 🪤 NOT `current_user` — INSIDE A `SECURITY DEFINER` BODY THAT IS THE
  -- FUNCTION'S OWNER, NOT THE CALLER. The first cut of this fix asked
  -- `current_user IN ('authenticated','anon')` and was therefore FALSE for
  -- everybody: the gate was inert, and probing production proved the forged
  -- INSERT still went through.
  --
  -- `current_setting('role')` DOES survive the definer boundary — measured in
  -- production: inside this exact shape it reads 'authenticated' under
  -- PostgREST's per-request `SET LOCAL ROLE`, 'service_role' for our own server
  -- actions, and 'none' for a migration or a psql session. A browser client
  -- cannot change it, because it cannot run SQL.
  --
  -- ⚖ WHY DEFINER AT ALL. The two lookups below must see the TRUTH about
  -- memberships and bookings whoever is writing; under invoker rights they are
  -- filtered by RLS, and a supplier whose booking row RLS hides would be
  -- refused their own day. Doing it in a separate DEFINER helper was tried and
  -- rejected: a helper must be granted to `authenticated`, and PostgREST then
  -- publishes it at /rest/v1/rpc/ as an oracle answering "is user X tied to
  -- event Y?" for any pair. The exposure-freeze guard caught exactly that.
  from_the_browser boolean :=
    coalesce(current_setting('role', true), 'none') IN ('authenticated', 'anon');
  link_is_being_made boolean := TG_OP = 'INSERT' OR NEW.event_id IS DISTINCT FROM OLD.event_id;
  author_is_host boolean;
  author_is_booked boolean;
BEGIN
  IF NEW.event_id IS NOT NULL AND link_is_being_made THEN
    author_is_host := EXISTS (
      SELECT 1 FROM public.event_members em
       WHERE em.event_id = NEW.event_id
         AND em.user_id = NEW.user_id
         AND em.member_type = 'couple'
    );
    -- A shop of theirs was BOOKED on this celebration — the same evidence
    -- lib/chapter-event-participation.loadLinkableEvents trusts.
    author_is_booked := NOT author_is_host AND EXISTS (
      SELECT 1 FROM public.event_vendors ev
       JOIN public.vendor_profiles vp
         ON vp.vendor_profile_id = ev.linked_vendor_profile_id
       WHERE ev.event_id = NEW.event_id
         AND vp.user_id = NEW.user_id
    );

    -- 🔒 THE DAY MUST BE YOURS TO NAME. Attaching surfaces that celebration's
    -- name, date and BOOKED SUPPLIERS on a public page, so the tie is proven
    -- here and not only in the server action a browser can go around.
    -- ⚠ Only when the link is being MADE. Re-checking on every edit would make
    -- a written chapter unsavable the day its author stopped being tied to the
    -- day — and the app would then write NULL over the link, taking the host's
    -- inclusion decision with it.
    IF from_the_browser AND NOT author_is_host AND NOT author_is_booked THEN
      RAISE EXCEPTION 'chapter_event_not_yours'
        USING HINT = 'A chapter can only be attached to a celebration you host or worked on.';
    END IF;
  END IF;

  -- 🔑 THE ROW IS YOURS, THE FIELD IS NOT. `host_included_at` records SOMEBODY
  -- ELSE'S decision — the host's. A browser caller never writes it: the value
  -- is taken from the row as it stood, and only the rules below may move it.
  IF from_the_browser THEN
    NEW.host_included_at := CASE WHEN TG_OP = 'UPDATE' THEN OLD.host_included_at ELSE NULL END;
  END IF;

  -- Re-pointing a chapter at a DIFFERENT celebration drops the previous host's
  -- decision. It was a judgement about a different day, and carrying it over
  -- would silently place the piece on a wedding whose host never saw it.
  IF TG_OP = 'UPDATE' AND NEW.event_id IS DISTINCT FROM OLD.event_id THEN
    NEW.host_included_at := NULL;
  END IF;

  IF NEW.event_id IS NULL THEN
    NEW.host_included_at := NULL;
    RETURN NEW;
  END IF;

  -- The author IS the host of this celebration ⇒ included, always. A couple
  -- never has to approve themselves.
  -- ⚠ ONLY AS THE LINK IS MADE. On every update this would re-include a chapter
  -- the host had just taken off their own day — the next edit of any field
  -- would put it back, and nothing would say so. Proven by probing the host's
  -- own remove-then-edit path against production.
  IF link_is_being_made
     AND NEW.host_included_at IS NULL
     AND coalesce(author_is_host, false) THEN
    NEW.host_included_at := now();
  END IF;

  RETURN NEW;
END;
$$;

-- 🚨 EVERY INSERT AND EVERY UPDATE. The old `UPDATE OF event_id` meant an
-- UPDATE naming only `host_included_at` never reached the trigger — which is
-- how the forged stamp got through even with the (ineffective) revoke in place.
DROP TRIGGER IF EXISTS set_chapter_host_inclusion_trg ON public.creator_chapters;
CREATE TRIGGER set_chapter_host_inclusion_trg
  BEFORE INSERT OR UPDATE ON public.creator_chapters
  FOR EACH ROW EXECUTE FUNCTION public.set_chapter_host_inclusion();

COMMENT ON COLUMN public.creator_chapters.host_included_at IS
  'When the celebration''s host added this chapter to their day. NULL = the chapter is '
  'attached (event_id) but must NOT appear on the couple''s surfaces. The author''s own '
  'page always shows it regardless: attaching is the author''s act, INCLUDING is the '
  'host''s. ENFORCED BY set_chapter_host_inclusion(), not by the column REVOKE that '
  'shipped 2026-08-15 — a column-level revoke cannot subtract from the table-level grant '
  'authenticated holds, so that revoke never did anything. Owner 2026-08-15; sealed '
  '2026-08-20.';

COMMENT ON COLUMN public.creator_chapters.event_id IS
  'The celebration this chapter is about. NULL = a chapter about no celebration, which is '
  'a normal chapter and not a lesser one. A browser caller may only name a celebration '
  'set_chapter_host_inclusion() says is theirs (hosted, or their shop was booked on it) — '
  'before '
  '2026-08-20 any account could name ANY event here, and the chapter page renders that '
  'celebration''s booked suppliers.';

COMMIT;
