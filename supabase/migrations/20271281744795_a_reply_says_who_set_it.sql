-- a_reply_says_who_set_it
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. Idempotent (ADD COLUMN IF NOT EXISTS · guarded CHECK ·
-- explicit grants · a post-condition). NO BACKFILL.
--
-- ⚖ OWNER 2026-10-21, verbatim: *"so our guest list will have counts for those
-- who accepted only? How do we double check those who did not answer yet. so we
-- can manually accept them in case they just forgot to say yes?"* → approved:
-- *"Yes, add all three: tappable counts that filter, Select → Set reply ▾
-- Attending / Not coming, and "Marked by you" on replies I set."*
--
-- WHO SET THE REPLY. `guests.rsvp_status` said WHAT the answer is; nothing said
-- WHO gave it — a host marking a guest "Attending" because they forgot to say
-- yes was indistinguishable from the guest's own yes. This column says it:
--   · 'host'  — a host set it: the card's Reply pick (`updateGuest`), Select →
--               Set reply (`setGuestRsvp`); the Undo puts back what was there;
--   · 'guest' — the guest's own reply (`submitRsvp`), their join request, a
--               sponsor accepting their invitation. The guest's own answer ALWAYS
--               replaces a host's mark;
--   · NULL    — not said: every row before today (NEVER guessed — no backfill),
--               and a reply set back to "No reply".
-- The card reads "Attending · Marked by you", the list row a quiet "marked", the
-- Excel file a "Reply set by" column (You / Guest).
--
-- 🔒 GRANTS: `public.guests` holds TABLE-level SELECT/INSERT/UPDATE for anon,
-- authenticated and service_role (measured 2026-10-17 for `gender`), so this
-- column inherits exactly what its sibling `rsvp_status` has. Restated and
-- PROVEN by the post-condition (column privilege == rsvp_status's, every role
-- and privilege). RLS on guests is unchanged: the same policies that admit
-- `rsvp_status` admit this — a host may mark only their own event's guests, and
-- a guest writes only through the server's reply (service_role).

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS rsvp_set_by text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'guests_rsvp_set_by_chk' AND conrelid = 'public.guests'::regclass
  ) THEN
    ALTER TABLE public.guests
      ADD CONSTRAINT guests_rsvp_set_by_chk CHECK (rsvp_set_by IS NULL OR rsvp_set_by IN ('guest', 'host'));
  END IF;
END $$;

COMMENT ON COLUMN public.guests.rsvp_set_by IS
  'Who set rsvp_status: ''host'' (the card''s Reply pick, Select → Set reply) or ''guest'' (their own reply, '
  'their join request, a sponsor accepting). NULL = not said (every row before 2026-10-21 — never guessed — '
  'and a reply set back to No reply). The guest''s own answer always replaces a host''s mark.';

-- ── Grants: the same as rsvp_status, for every role that reads guests ──────
GRANT SELECT (rsvp_set_by), INSERT (rsvp_set_by), UPDATE (rsvp_set_by) ON public.guests TO anon, authenticated;
GRANT ALL ON public.guests TO service_role;

-- ── POST-CONDITIONS ────────────────────────────────────────────────────────
DO $$
DECLARE
  rle  text;
  priv text;
BEGIN
  FOREACH rle IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    FOREACH priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE'] LOOP
      IF has_column_privilege(rle, 'public.guests', 'rsvp_set_by', priv)
         IS DISTINCT FROM has_column_privilege(rle, 'public.guests', 'rsvp_status', priv) THEN
        RAISE EXCEPTION 'post-condition failed: guests.rsvp_set_by % for % differs from rsvp_status', priv, rle;
      END IF;
    END LOOP;
  END LOOP;
END $$;
