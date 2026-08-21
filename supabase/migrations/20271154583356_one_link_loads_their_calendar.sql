-- ═══════════════════════════════════════════════════════════════════════════
-- ONE LINK LOADS THEIR CALENDAR
--
-- Owner 2026-08-21: *"can we allow their events to auto sync to their calendar?
-- google calendar / apple calendar?"* … *"it can be a general add to calendar
-- and the device will pick which calendar"*.
--
-- 🔑 A SUBSCRIPTION, NOT A DOWNLOAD — AND THAT IS THE WHOLE POINT. Everything
-- shipped today (`buildWeddingIcs`, the save-the-date button, the vendor /
-- appointment / budget .ics routes) hands over a COPY taken once. Move the
-- wedding afterwards and the copy in somebody's phone is silently wrong, which
-- is worse than never having offered it. A subscribed feed is re-read by the
-- calendar itself, so the date in their phone follows the date in Setnayan.
--
-- It is also the only mechanism that serves BOTH stores the owner named. Apple
-- Calendar has no write API at all, and the Google Calendar API would need a
-- THIRD reviewed scope on an account already carrying two with a known conflict
-- between them (google-oauth-scope-conflict.test.ts). A `webcal:` link needs no
-- login, no consent screen and no review, and the DEVICE decides which calendar
-- opens it — exactly what the owner asked for.
--
-- ⚠ THE URL IS THE CREDENTIAL. A calendar client cannot log in, so the token in
-- the path is the only thing between a stranger and this person's event names
-- and dates. Three consequences, all enforced below:
--   · 32 bytes of `gen_random_bytes`, not a guessable id;
--   · ONE live token per person, and "reset my link" mints a new row while the
--     old one stays with `revoked_at` set — a leaked link must keep resolving
--     to a refusal, not be silently reissued;
--   · nothing in the feed derives an email, a phone number or a guest list.
--
-- 🔒 THE FEED READS THROUGH `service_role`, so RLS here governs only who may
-- manage their OWN link. The route resolves token → user and then reads that
-- user's memberships explicitly; it never trusts the caller for identity,
-- because there is no caller identity to trust.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.calendar_feed_tokens (
  id           bigserial PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES public.users (user_id) ON DELETE CASCADE,
  token        text NOT NULL UNIQUE
                 CHECK (char_length(token) BETWEEN 32 AND 128),
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  revoked_at   timestamptz
);

-- 🔑 ONE LIVE LINK PER PERSON, ENFORCED BY THE DATABASE. Without this, a bug in
-- the reset path leaves two working links and the reset that person just
-- performed did nothing — a security control that reports success and changes
-- nothing is worse than no button at all.
CREATE UNIQUE INDEX IF NOT EXISTS calendar_feed_tokens_one_live_per_user
  ON public.calendar_feed_tokens (user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS calendar_feed_tokens_user_idx
  ON public.calendar_feed_tokens (user_id);

ALTER TABLE public.calendar_feed_tokens ENABLE ROW LEVEL SECURITY;

-- Pattern: owner-scoped on `user_id = auth.uid()`.
--
-- ⚠ SPLIT BY VERB ON PURPOSE, NEVER `FOR ALL`. A permissive `FOR ALL` policy
-- admits INSERT and DELETE as well as UPDATE, and the 2026-08-12 sweep found
-- eight live defects of exactly that shape. What must never happen here is a
-- person REVIVING a revoked link, so the UPDATE policy constrains the row it is
-- allowed to produce.
DROP POLICY IF EXISTS calendar_feed_tokens_select_own ON public.calendar_feed_tokens;
CREATE POLICY calendar_feed_tokens_select_own
  ON public.calendar_feed_tokens FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS calendar_feed_tokens_insert_own ON public.calendar_feed_tokens;
CREATE POLICY calendar_feed_tokens_insert_own
  ON public.calendar_feed_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid() AND revoked_at IS NULL);

DROP POLICY IF EXISTS calendar_feed_tokens_revoke_own ON public.calendar_feed_tokens;
CREATE POLICY calendar_feed_tokens_revoke_own
  ON public.calendar_feed_tokens FOR UPDATE
  USING (user_id = auth.uid())
  -- A row this person writes may only ever come out REVOKED. Un-revoking is how
  -- a leaked link comes back to life, so the database refuses it rather than
  -- relying on the one action that happens to be written today.
  WITH CHECK (user_id = auth.uid() AND revoked_at IS NOT NULL);

-- No DELETE policy, deliberately: destroying the row is how a revoked token
-- becomes mintable again, and nothing in the product needs to delete one.

COMMENT ON TABLE public.calendar_feed_tokens IS
  'One live subscription link per person, served at /api/calendar/<token>.ics. '
  'THE URL IS THE CREDENTIAL — a calendar client cannot log in — so the token is '
  '32 random bytes, only one row per user may be un-revoked, and "reset my link" '
  'mints a new row rather than editing this one. Read by the feed route through '
  'service_role; the RLS here governs only self-management.';

COMMENT ON COLUMN public.calendar_feed_tokens.revoked_at IS
  'Set by "reset my link". The row is KEPT so a leaked link keeps resolving to a '
  'refusal; there is no DELETE policy for the same reason.';

COMMENT ON COLUMN public.calendar_feed_tokens.last_read_at IS
  'Stamped by the feed route. Its job is to answer "is anything still using this '
  'link?" before somebody resets it — not analytics, and never a guest count.';
