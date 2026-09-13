-- CHAT ATTACHMENTS STOP LIVING AT A PUBLIC ADDRESS.
--
-- ── WHAT WAS WRONG ──────────────────────────────────────────────────────────
-- `lib/bucket-routing.ts` had no `chat/` rule, so `pathPrefix: chat/<threadId>`
-- fell through its `return 'media'` default — the PUBLIC bucket — and
-- `uploadPublicAsset` handed back a permanent, unauthenticated URL that was
-- stored in `attachment_url` and rendered straight into an <img>/<a>. Anyone who
-- ended up with the link could open a couple's contract forever, without ever
-- signing in.
--
-- That is the exact omission that routing file's own comments warn about THREE
-- separate times, in its own words: "That omission is exactly how they got
-- there." The private `threadFiles` bucket already existed and already held
-- payment proofs and Mood Board renders.
--
-- 🔢 SAFE BY ARITHMETIC, MEASURED IN PRODUCTION 2026-09-09: `chat_messages`
-- holds 3 rows and **ZERO** of them carry an attachment. Not one file has ever
-- been shared. So there is nothing to migrate, nobody to notify, and no object
-- stranded in the public bucket — which is exactly why this is being done now
-- rather than after the first contract goes through.
--
-- ── WHAT THIS CHANGES ───────────────────────────────────────────────────────
-- The bytes move to the private bucket and the row stops carrying a URL at all.
-- It carries the OBJECT KEY, and every reader asks
-- `/api/chat/attachment/<message_id>` for it — a route that proves the caller is
-- a party to the thread and then redirects to a short-lived signed GET.
--
-- 🔑 WHY A ROUTE AND NOT A SIGNED URL STORED ON THE ROW. The message stream is a
-- CLIENT component and receives new messages over Realtime; it cannot sign
-- anything, and a signed URL written at insert time would expire while the
-- conversation was still open. A route re-checks membership on every request,
-- which is also the only form of this that keeps working after someone is
-- removed from a thread.
--
-- `attachment_url` is KEPT, nullable, and is now legacy-only: no writer sets it
-- after this migration, and prod has no row that uses it. It is not dropped
-- because dropping a column is not reversible and this one costs nothing.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS attachment_r2_key text;

COMMENT ON COLUMN public.chat_messages.attachment_r2_key IS
  'Stored-asset ref (r2://<bucket>/<key>, the same shape every other stored asset in this app uses, written by encodeR2Ref) for an optional file attachment in the PRIVATE setnayan-thread-files bucket. NULL on text-only messages. Never a URL and never public: readers fetch /api/chat/attachment/<message_id>, which proves thread membership and redirects to a short-lived signed GET. Replaces attachment_url (2026-09-09).';

COMMENT ON COLUMN public.chat_messages.attachment_url IS
  'LEGACY — a public R2 URL, written only before 2026-09-09. Zero rows in production ever carried one. Superseded by attachment_r2_key + /api/chat/attachment/<message_id>; nothing writes this column any more. Kept, not dropped, so no historical row loses its reference.';
