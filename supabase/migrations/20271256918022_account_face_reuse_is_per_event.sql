-- account_face_reuse_is_per_event
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)




-- ─────────────────────────────────────────────────────────────────────────────
-- "REUSE THE FACE ON MY ACCOUNT FOR THIS EVENT" — PER EVENT, OFF UNTIL TURNED ON.
--
-- ⚖ Owner 2026-09-30 (DECISION_LOG "AMENDS THE ROW ABOVE — FACE TAGGING NEEDS
-- NO ACCOUNT"): at "Save it to your account", ONE switch, OFF by default,
-- "Reuse the face on my account for this event (no selfie needed)"; Profile →
-- Privacy lists "Events that can reuse your face", one switch each. *"Allowing
-- one event never allows another."*
--
-- Until now `accountSeedsForEvent` (lib/account-face-profile.ts) seeded the
-- matcher with an opted-in account's face at EVERY event that account holds a
-- seat at — one account-wide opt-in standing in for a per-event choice. This
-- column is the per-event choice: the matcher now seeds an account face at an
-- event ONLY when that event's id is in this list.
--
-- 🔑 WHY A COLUMN HERE AND NOT A NEW TABLE. The choice is the face owner's own,
-- about their own face — and this row is already exactly that, guarded by the
-- owner-only RLS on this table (auth.uid() = user_id for every verb). A couple
-- or supplier can never write it. Deleting the profile ("Forget my face
-- everywhere", or turning the account profile off) removes every reuse with
-- it, so no reuse can outlive the face it points at.
--
-- 🔑 WHY NOT `source_event_ids`. That column is PROVENANCE ("which events
-- contributed to this profile") and its own comment says "never a search key".
-- Reusing it would make contributing a sample the same act as consenting to be
-- searched for — two owners' questions on one column.
--
-- NULL or '{}' = the account's face is reused nowhere. NULLABLE with NO default:
-- a default would be a consent nobody gave. Written by the owner's own server
-- actions (the Save-it-to-your-account Yes, and Profile → Privacy).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_face_profiles
  ADD COLUMN IF NOT EXISTS reuse_event_ids uuid[];

COMMENT ON COLUMN public.user_face_profiles.reuse_event_ids IS
  'Events at which this account''s own face may be used for Papic photo tagging instead of a day-of selfie (owner 2026-09-30, "Reuse the face on my account for this event"). Per event, OFF until the owner turns it on at "Save it to your account" or in Profile → Privacy; allowing one event never allows another. NULL/empty = reused nowhere. Read by accountSeedsForEvent, which seeds the matcher with this face at an event only when the event is listed. Distinct from source_event_ids (provenance, never a search key).';

-- No GRANT here on purpose: `public.user_face_profiles` carries table-level
-- grants and owner-only RLS for every verb (20270306508746), so the new column
-- is readable and writable by exactly the face's owner, like its siblings.
