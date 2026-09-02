-- ⏳ "I ALREADY HAVE A YOUTUBE ACCOUNT READY TO LIVE STREAM" — ASKED ONCE, EVER.
--
-- WHY THIS EXISTS. Live Studio's BYO path streams to the COUPLE'S own YouTube
-- channel: they create the broadcast, Setnayan composites the cameras, and they
-- paste the watch link back. That channel must already be live-enabled, and
-- YouTube's first-time activation takes about 24 hours — a wait nothing on our
-- side can shorten. Discovered on the wedding morning it is unrecoverable, and
-- the date does not move. So the buy surface asks the buyer to confirm it BEFORE
-- taking money (LIVE_STUDIO, ₱3,000), beside the existing manual-reconciliation
-- lead-time notice.
--
-- WHY ON `users` AND NOT ON `events` OR `orders` — owner-ruled 2026-09-02:
-- "if they have accepted at least once, then the next time they purchase, no more
-- tick box. since that account is already confirmed." A YouTube channel belongs to
-- the PERSON, not to one celebration. An event- or order-scoped column would re-ask
-- the same human for their second event, which is the behaviour that was ruled out.
--
-- WHY `_ack_at` AND NOT `_consent_at`. `users` already carries six
-- `<thing>_consent_at` columns (public_summary, marketing, religion, sex,
-- civil_status, dietary_restrictions) and every one of them answers "may we use
-- this fact ABOUT you". This one answers "I confirm I have done a thing" — no
-- personal data is processed by it, and nothing is revoked by clearing it. Naming
-- it into the consent family would put a non-consent under whatever rules that
-- family later grows.
--
-- ⚠ THIS IS A CLAIM, NOT A VERIFICATION, AND THE COLUMN NAME SAYS SO. Ticking a
-- box does not make a channel live-enabled. We cannot check that a couple's channel
-- is activated without OAuth on their account — the sensitive scope whose 100-user
-- cap the BYO path exists to avoid. What actually proves readiness is a dry run:
-- create a broadcast, push to it, paste the link. Never render this column as
-- "YouTube verified"; it is "the buyer said yes on <date>".
--
-- NULL = never acknowledged (every existing row, and the tick box shows).
-- Non-NULL = acknowledged at that moment (the tick box is not shown again).
--
-- RLS: none added, and none needed. `users` already carries `user_owns_row`
-- (USING/WITH CHECK `user_id = auth.uid()`, FOR ALL) plus `admin_full_access_users`,
-- so a person can stamp their own row through the ordinary authenticated client
-- and no service-role path is introduced.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS youtube_live_ready_ack_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.youtube_live_ready_ack_at IS
  'When this person confirmed, on a Live Studio buy surface, that their own YouTube '
  'channel is already enabled for live streaming. A self-declaration, NOT a verified '
  'fact — we cannot check a channel we hold no OAuth grant for. NULL = never asked or '
  'never ticked; the buy sheet shows the checkbox. Set once and reused across every '
  'later purchase and every later event (owner ruling 2026-09-02).';
