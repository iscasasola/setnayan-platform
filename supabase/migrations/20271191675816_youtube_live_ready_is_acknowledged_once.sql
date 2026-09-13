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

-- 🔒 A NOTE ON WHO CAN REACH THIS COLUMN — and why there is no REVOKE here.
--
-- `tests/db/exposure-freeze.db.test.ts` flags this column as new reach for `anon` and
-- `authenticated`, and it is right to: a new column on `public.users` INHERITS the
-- table's grants, Supabase publishes every `public` table as a REST endpoint, and the
-- anon key ships in the page source. The baseline is updated in this same PR so the
-- one-line diff is reviewable, which is the point of that file.
--
-- WHY NOT SIMPLY REVOKE IT FROM `anon`. It was tried and it is the wrong tool.
-- `anon` and `authenticated` hold SELECT/UPDATE on `public.users` at the TABLE level,
-- and PostgreSQL cannot subtract a column privilege from a table-level grant — the
-- attempt silently dissolved the table grant into 53 per-column grants (the guard
-- reported 54 narrowings) and left `anon`'s UPDATE standing anyway. Narrowing this for
-- real means restructuring the whole table's grants, which does not belong in a
-- feature migration.
--
-- WHAT ACTUALLY GATES IT TODAY: every policy on `public.users` is `{authenticated}` —
-- `user_owns_row` (`user_id = auth.uid()`) and `admin_full_access_users` — and there is
-- NO policy admitting `anon`, so an anonymous caller reaches zero rows of this table
-- and therefore zero values of this column. `authenticated` genuinely needs both
-- privileges: the buy page reads the column to decide whether to render the tick box,
-- and `setYoutubeLiveReadyAck` writes it under `user_owns_row`.
--
-- ⚠ FLAGGED, NOT FIXED, AND IT PREDATES THIS COLUMN: `anon` holds table-level
-- SELECT + UPDATE on all 53 pre-existing columns of `public.users`, held back by
-- nothing but the absence of an anon policy. Add one anon-readable policy to this
-- table some day and every column goes public in that one statement. Worth its own
-- pass; deliberately out of scope here.
