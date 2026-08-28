-- ============================================================================
-- Close the three anonymous-write doors that nothing walks through.
--
-- ── WHAT WAS MEASURED (prod, 2026-08-28, in rolled-back transactions) ───────
-- 391 base tables in `public`. RLS is ON for all 391. `anon` — the role behind
-- the publishable key that ships in every page's source — holds INSERT on 197
-- of them, SELECT on 204, UPDATE on 198, DELETE on 203, TRUNCATE on 205.
--
-- ⚠ A FIGURE IN CIRCULATION IS WRONG AND IS CORRECTED HERE: "361 of 368 tables
-- grant SELECT+INSERT to anon". It is about HALF, not 98%. That number has been
-- quoted from memory notes and from at least one other migration's docblock; it
-- overstates the posture by roughly 2x and made the problem look unfixable.
--
-- ROOT CAUSE is unchanged and already documented: Supabase's DEFAULT PRIVILEGES
-- in schema `public` grant the whole `arwdDxtm` set to BOTH `anon` and
-- `authenticated` at CREATE TABLE time, and `REVOKE ... FROM PUBLIC` does not
-- remove a role's own explicit grant. See 20271029105532, which closed 11.
--
-- ── THE PART THAT HAD NEVER BEEN MEASURED ──────────────────────────────────
-- A grant only matters if a POLICY admits the role. So all 197 anon-INSERT
-- tables were probed BY EXECUTION, as `anon`, inside BEGIN ... ROLLBACK: one
-- generated INSERT per table naming only its NOT NULL / no-default columns.
--
--   193  refused, SQLSTATE 42501  — "new row violates row-level security policy"
--     4  ADMITTED
--
-- The four are every signup/contact form in the product, and each carries a
-- policy explicitly naming `anon` with `WITH CHECK (true)`:
--
--   help_messages                      ← KEPT. LOAD-BEARING.
--   couple_waitlist_signups            ← closed here
--   couple_event_type_notify_signups   ← closed here
--   couple_wedding_type_notify_signups ← closed here
--
-- ── WHY THREE CLOSE AND ONE STAYS ──────────────────────────────────────────
-- `help_messages` is the public Help contact form. `app/help/actions.ts` posts
-- it through the VISITOR'S OWN SESSION (`createClient()`), and a signed-out
-- visitor's session IS `anon` — the action even comments that anonymous
-- submissions leave `user_id` NULL. Revoking it would break a shipped
-- signed-out path, so it is deliberately untouched and P3 below proves it.
--
-- The other three have no anonymous caller at all:
--   • couple_event_type_notify_signups   — written by app/(shell)/explore/actions.ts
--                                          through the SERVICE ROLE, which bypasses
--                                          RLS and needs no anon policy.
--   • couple_wedding_type_notify_signups — same, from create-event/actions.ts.
--   • couple_waitlist_signups            — has NO writer anywhere in the codebase.
--                                          Its only mentions are the erasure
--                                          register and its coverage tests.
--
-- 🔢 SAFE BY ARITHMETIC: all three hold ZERO rows in production. Nobody has ever
-- used these doors, so closing them takes nothing away from anyone.
--
-- ⚖ AND IT IS MORE THAN HYGIENE. All three are in the RA 10173 data-subject
-- register (`lib/data-subject-register.ts`): they hold an email, a full name, a
-- partner's name, an IP address and a user agent. An open anonymous INSERT on a
-- table of personal data, reachable with a key published in the page source and
-- written by nothing, is a spam and abuse target whose only possible traffic is
-- illegitimate.
--
-- ── WHAT IS NOT DONE HERE, AND WHY ─────────────────────────────────────────
-- ⛔ NO BLANKET REVOKE SWEEP. 193 of the 197 grants are already inert behind
-- RLS. Mass-revoking them is a separate, reviewable batch (that is the standing
-- rule from 20271029105532 and from the anon-grant-debt note) and it risks
-- breaking a legitimate signed-out path exactly like the one kept above.
--
-- 🪤 TRUNCATE IS NOT SUBJECT TO RLS, and `anon` holds it on 205 tables — so it
-- is safe ONLY because nothing exposes it. Checked rather than assumed: of the
-- 278 functions `anon` may EXECUTE, ZERO SECURITY INVOKER functions mention
-- TRUNCATE, and the two SECURITY DEFINER ones that match the word do so in
-- PROSE COMMENTS (`papic_tag_capture`: "truncates the tail";
-- `enforce_photo_tag_cap`: "truncate, never error") — neither executes one.
-- PostgREST exposes no TRUNCATE verb. Stated so the next reader does not have
-- to re-derive it; the grant itself is left for the batch above.
--
-- 🪤 THE MEASUREMENT TRAP THIS AUDIT NEARLY FELL INTO, recorded because it will
-- recur: `vendor_services` first came back as SQLSTATE 23514, a CHECK-style
-- failure, which reads as "the row PASSED RLS and was rejected on its data" —
-- a live hole. IT IS NOT ONE. A BEFORE INSERT trigger runs BEFORE the RLS WITH
-- CHECK is evaluated, and what fired was the publish gate added hours earlier
-- (20271176775619), whose message is user-facing prose. Probed again with a
-- DRAFT row, which that trigger does not judge: refused, 42501.
-- ⇒ A NON-42501 ERROR DOES NOT PROVE RLS ADMITTED YOU. Re-probe past the
--   trigger before calling anything a hole.
-- ============================================================================

BEGIN;

-- --- The doors ------------------------------------------------------------
-- Narrow the INSERT policy to signed-in callers. `authenticated` keeps it, so
-- any future in-app form still works; only the anonymous arm goes.
DROP POLICY IF EXISTS couple_waitlist_signups_public_insert ON public.couple_waitlist_signups;
CREATE POLICY couple_waitlist_signups_public_insert
  ON public.couple_waitlist_signups
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS event_type_notify_signups_insert ON public.couple_event_type_notify_signups;
CREATE POLICY event_type_notify_signups_insert
  ON public.couple_event_type_notify_signups
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS notify_signups_insert_any ON public.couple_wedding_type_notify_signups;
CREATE POLICY notify_signups_insert_any
  ON public.couple_wedding_type_notify_signups
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- --- The grants -----------------------------------------------------------
-- The whole default-ACL set, not only INSERT: no policy on any of these three
-- admits anon for ANY verb (every other policy is `TO authenticated`), so anon
-- reads zero rows today and loses nothing it could reach.
REVOKE ALL ON public.couple_waitlist_signups            FROM anon;
REVOKE ALL ON public.couple_event_type_notify_signups   FROM anon;
REVOKE ALL ON public.couple_wedding_type_notify_signups FROM anon;

COMMENT ON TABLE public.couple_waitlist_signups IS
  'Pre-launch waitlist emails. Written by the service role only — anon holds no privileges and no policy admits it (20271178066835). RA 10173 data-subject register entry.';
COMMENT ON TABLE public.couple_event_type_notify_signups IS
  'Notify-me signups for event types not yet launched. Written by app/(shell)/explore/actions.ts through the SERVICE ROLE; anon closed 20271178066835.';
COMMENT ON TABLE public.couple_wedding_type_notify_signups IS
  'Notify-me signups for ceremony types not yet launched. Written by create-event/actions.ts through the SERVICE ROLE; anon closed 20271178066835.';

-- --- P1. anon holds nothing on the three ----------------------------------
DO $$
DECLARE t text; v text; still text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'couple_waitlist_signups','couple_event_type_notify_signups','couple_wedding_type_notify_signups'
  ] LOOP
    FOREACH v IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF has_table_privilege('anon', 'public.' || t, v) THEN
        still := still || t || '.' || v || ' ';
      END IF;
    END LOOP;
  END LOOP;
  IF still <> '' THEN
    RAISE EXCEPTION 'P1 FAILED: anon still holds %', still;
  END IF;
END $$;

-- --- P2. no surviving policy on the three names anon or PUBLIC -------------
-- A revoke closes the privilege layer; a policy still naming anon would mean
-- the NEXT grant re-opens the door silently.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(p.tablename || ':' || p.policyname, ' ') INTO bad
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename = ANY (ARRAY[
      'couple_waitlist_signups','couple_event_type_notify_signups','couple_wedding_type_notify_signups'
    ])
    AND ('anon' = ANY (p.roles) OR 'public' = ANY (p.roles));
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'P2 FAILED: a policy still admits anon: %', bad;
  END IF;
END $$;

-- --- P3. POSITIVE CONTROL: help_messages is UNCHANGED ---------------------
-- The one door that IS load-bearing. A narrowing that quietly takes the public
-- Help form with it would look identical to a clean run without this check.
DO $$
BEGIN
  IF NOT has_table_privilege('anon', 'public.help_messages', 'INSERT') THEN
    RAISE EXCEPTION 'P3 FAILED: anon lost INSERT on help_messages — the public Help form posts through the visitor''s own session.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='help_messages'
      AND policyname='help_messages_anyone_insert' AND 'anon' = ANY (roles)
  ) THEN
    RAISE EXCEPTION 'P3 FAILED: help_messages_anyone_insert no longer admits anon.';
  END IF;
END $$;

-- --- P4. the signed-in path survived --------------------------------------
-- `authenticated` must keep INSERT on all three, and service_role must keep
-- everything it writes with — a narrowing that breaks the real writer is worse
-- than the exposure it closes.
DO $$
DECLARE t text; lost text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'couple_waitlist_signups','couple_event_type_notify_signups','couple_wedding_type_notify_signups'
  ] LOOP
    IF NOT has_table_privilege('authenticated', 'public.' || t, 'INSERT') THEN
      lost := lost || 'authenticated:' || t || ' ';
    END IF;
    IF NOT has_table_privilege('service_role', 'public.' || t, 'INSERT')
       OR NOT has_table_privilege('service_role', 'public.' || t, 'SELECT') THEN
      lost := lost || 'service_role:' || t || ' ';
    END IF;
  END LOOP;
  IF lost <> '' THEN
    RAISE EXCEPTION 'P4 FAILED: a legitimate writer lost access — %', lost;
  END IF;
END $$;

-- --- P5. RLS is still on ---------------------------------------------------
DO $$
DECLARE norls text;
BEGIN
  SELECT string_agg(c.relname, ' ') INTO norls
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname='public'
    AND c.relname = ANY (ARRAY[
      'couple_waitlist_signups','couple_event_type_notify_signups',
      'couple_wedding_type_notify_signups','help_messages'
    ])
    AND NOT c.relrowsecurity;
  IF norls IS NOT NULL THEN
    RAISE EXCEPTION 'P5 FAILED: RLS disabled on %', norls;
  END IF;
END $$;

COMMIT;
