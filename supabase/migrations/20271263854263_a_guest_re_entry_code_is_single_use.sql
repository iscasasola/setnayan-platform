-- ============================================================================
-- A GUEST RE-ENTRY CODE IS SHORT-LIVED, SINGLE-USE AND HASHED AT REST
-- (owner 2026-10-04, guest-flow rows I4 + I9 of
--  INVITATION_RSVP_GUEST_FLOW_REMAINING_2026-10-04.md)
--
-- The guest pass is a cookie, and a cookie stays in the jar it was written to.
-- Two moments move a guest to ANOTHER jar while they are mid-invitation:
--
--   · leaving an in-app browser (Messenger · Instagram · Facebook) through the
--     app's own "Open in Safari / external browser" — that opens the page's
--     CURRENT address, `/{slug}/invite/enter`, which holds no token, so the
--     browser has no pass and the guest met the Event Hub's "Get inside";
--   · the iPhone home-screen tile — a home-screen web app keeps its own cookies,
--     so the tile asked the guest to "Get inside" again.
--
-- A re-entry code carries the guest across exactly once. It is minted by the
-- server (lib/guest-reentry.server.ts) into the landing address (`landing`,
-- minutes) or the tile's start address (`tile`, one day), stored ONLY as its
-- sha256, and exchanged ONCE for the guest's normal pass cookie by
-- `/{slug}/redeem?k=` — the same route that writes the pass for a personal link.
-- The exchange is one conditional UPDATE (unused AND unexpired → used_at), so
-- two racing opens cannot both win. A used code is kept until it expires so a
-- later launch of the same tile still knows whose it was (and is logged, not
-- honoured, if that phone lost the pass).
--
-- It is NEVER the raw pass token (`guests.qr_token`), never an account session,
-- and it grants nothing the personal link does not already grant.
--
-- RLS: enabled at CREATE, NO policy, NO grant to anon or authenticated — only
-- the service role (the redeem route + the landing render) reads or writes it.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.guest_reentry_codes (
  code_hash   TEXT        PRIMARY KEY,
  event_id    UUID        NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- A hard-deleted guest takes their codes with them.
  guest_id    UUID        NOT NULL REFERENCES public.guests(guest_id) ON DELETE CASCADE,
  purpose     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  CONSTRAINT guest_reentry_codes_purpose_chk CHECK (purpose IN ('landing', 'tile')),
  -- A sha256, hex — never a raw code.
  CONSTRAINT guest_reentry_codes_hash_chk CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT guest_reentry_codes_window_chk CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS guest_reentry_codes_guest_idx
  ON public.guest_reentry_codes (guest_id, expires_at);

ALTER TABLE public.guest_reentry_codes ENABLE ROW LEVEL SECURITY;
-- Every new relation in `public` ships OPEN (ALTER DEFAULT PRIVILEGES). No
-- browser role holds this table.
REVOKE ALL ON TABLE public.guest_reentry_codes FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.guest_reentry_codes IS
  'Short-lived, single-use guest re-entry codes (sha256 only). Minted by '
  'lib/guest-reentry.server.ts into the landing address or the home-screen '
  'tile''s start address; exchanged once by /{slug}/redeem?k= for the guest''s '
  'normal pass cookie. Service-only (2026-10-04).';

COMMIT;
