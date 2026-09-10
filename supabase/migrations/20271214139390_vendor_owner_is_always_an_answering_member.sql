-- ═══════════════════════════════════════════════════════════════════════════
-- A SHOP'S OWNER CAN ALWAYS ANSWER ITS INQUIRIES.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ── THE BUG, MEASURED IN PRODUCTION 2026-09-08 ────────────────────────────
-- The owner pressed **Accept** on the first inquiry this platform has ever
-- received and got "Could not accept right now — please try again in a moment."
-- The thread stayed `inquiry_status = 'pending'`.
--
-- `unlock_vendor_event_free`'s first gate is:
--
--     IF NOT EXISTS (SELECT 1 FROM vendor_team_members
--                    WHERE vendor_profile_id = … AND user_id = auth.uid()
--                      AND role IN ('owner','admin','agent'))
--     THEN RAISE EXCEPTION 'FORBIDDEN: caller is not an answering member';
--
-- Measured for the shop in question:
--
--     Saysay Live Band & Hosting   owner: 9f1d8c74…   team rows: 0
--     SetnaProd                    owner: 5599d399…   team rows: 1 (admin)
--
-- 🔑 TWO RECORDS SAY "THIS SHOP IS MINE" AND ONLY ONE OF THEM WAS WRITTEN.
-- `vendor_profiles.user_id` names the owner; `vendor_team_members` decides who
-- may answer. Every other screen trusts the first, this RPC trusts the second,
-- and a shop created outside the seeding path has one and not the other. Same
-- shape as the two definitions of "this shop is live" (seven broken code paths)
-- and the two definitions of "who hosts this event" (a pick landing in the
-- wrong wedding) — both found the same day.
--
-- ── WHY IT IS NOT A ONE-ROW DATA FIX ──────────────────────────────────────
-- The invariant already exists and is already intended: migration
-- 20260514010000 both seeds an owner row from a trigger AND backfills every
-- profile that existed at the time. But the backfill ran in MAY 2026 and this
-- shop was written straight into `vendor_profiles` on 2026-08-01. Nothing has
-- enforced the invariant since.
--
-- So this is not "Saysay is missing a row" — it is "any profile created outside
-- one code path can never accept an inquiry, and the only symptom is a button
-- that does nothing."
--
-- ⚠ THIS WIDENS NO PERMISSION. It writes the `owner` row that
-- `vendor_profiles.user_id` already asserts. Nobody gains access to a shop they
-- did not already own; the RPC's gate, its role list and every other check are
-- untouched.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1 · Backfill every profile that is missing its owner row.
--     `ON CONFLICT DO NOTHING` makes this safe to re-run and safe against a
--     profile whose owner is already a member with a DIFFERENT role — an
--     existing 'admin' or 'agent' row is left exactly as it is.
INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
SELECT vp.vendor_profile_id, vp.user_id, 'owner'
FROM public.vendor_profiles vp
WHERE vp.user_id IS NOT NULL
ON CONFLICT (vendor_profile_id, user_id) DO NOTHING;

-- ⛔ NO TRIGGER HERE, AND THAT IS THE FINDING.
--
-- The first draft of this migration added an AFTER INSERT trigger on
-- `vendor_profiles` to seed the owner row "from now on". Measured against the
-- replayed schema with that trigger deliberately disabled (`AFTER UPDATE`,
-- confirmed by `pg_trigger.tgtype = 17`), a direct insert **still** received its
-- owner row — some existing mechanism already does this.
--
-- 🔑 SO THE TRIGGER WOULD HAVE BEEN A SECOND DEFINITION OF A RULE THAT ALREADY
-- HOLDS — the exact shape of the bugs this session kept finding: two definitions
-- of "this shop is live" (seven broken paths), two of "who hosts this event" (a
-- pick landing in the wrong wedding), two of "this shop is mine" (the bug below).
-- Adding a third one to fix the second would have been the same mistake wearing
-- a fix's clothes.
--
-- What is genuinely missing is HISTORY: this shop was written into the table on
-- 2026-08-01, before that mechanism existed, and nothing has ever gone back for
-- the rows left behind. That is a backfill, and a backfill is all this is.

COMMIT;
