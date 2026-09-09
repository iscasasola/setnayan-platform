-- ═══════════════════════════════════════════════════════════════════════════
-- A FILE CAN ACTUALLY BE ATTACHED TO A CONVERSATION AGAIN.
--
-- 🔴 A LIVE BREAK, INTRODUCED BY MIGRATION 20271215226091 (PR #5339, merged
-- 2026-09-09T11:01Z) AND MEASURED IN PRODUCTION BY THE CATALOGUE:
--
--   column                  authenticated INSERT
--   attachment_url                  ✓
--   attachment_name                 ✓
--   attachment_mime                 ✓
--   attachment_size_bytes           ✓
--   attachment_r2_key               ✗   ← the one that PR added
--
-- `chat_messages` uses PER-COLUMN grants. `sendChatMessageCore` inserts under
-- THE CALLER'S OWN SESSION, and that file's own comment already states the
-- mechanism, about a different pair of columns:
--
--   "this insert runs under the caller's own RLS-scoped session, and
--    `authenticated` holds no INSERT privilege on either column — naming one is
--    a HARD PERMISSION FAILURE, not a silent ignore."
--
-- So since that merge, EVERY attempt to attach a file to a conversation — by a
-- couple or by a supplier — has been refused by the database, and the message
-- goes with it. The feature the PR shipped is the feature the PR broke.
--
-- 🔑 WHY NOTHING CAUGHT IT, and this is the part worth keeping:
--   · The PGlite replay runs as SUPERUSER, so a missing grant is invisible to
--     every db test. The full suite is green on both sides of this bug.
--   · TypeScript cannot see a grant at all.
--   · The exposure baseline DOES record column grants — but a MISSING grant is
--     a NARROWING, and the freeze only fails on a WIDENING. It stayed green.
--   ⇒ Three guards, none of which could fail. The only instrument that sees it
--     is `information_schema.column_privileges` in PRODUCTION.
--
-- 🔑 AND IT IS THE `events` TRAP ON A DIFFERENT TABLE. This repo already records
-- it: "A NEW COLUMN IS NOT DONE WHEN IT EXISTS — a column with no GRANT makes
-- PostgREST refuse the WHOLE query." That was written about `events` and read as
-- being about `events`. It is about every table with per-column grants.
--
-- ⚖ WHAT THIS GRANTS, AND WHAT IT DELIBERATELY DOES NOT.
-- INSERT only, to `authenticated` only, on the one column — matching its four
-- siblings exactly. ⛔ NOT to `anon`: no anonymous caller sends a chat message,
-- and `attachment_url` does not grant it either. ⛔ NOT UPDATE: an attachment is
-- written once, with the message, and nothing in the app edits one afterwards.
-- Adding UPDATE would let a party rewrite which file a sent message points at.
-- ═══════════════════════════════════════════════════════════════════════════

GRANT INSERT (attachment_r2_key) ON public.chat_messages TO authenticated;

COMMENT ON COLUMN public.chat_messages.attachment_r2_key IS
  'The r2:// reference to the attached file — never a URL, so the bytes stay '
  'behind /api/chat/attachment/[messageId], which re-proves the reader is a '
  'party to the thread. Carries authenticated INSERT (and no UPDATE) to match '
  'attachment_url and the other three attachment columns: this table uses '
  'per-column grants, and between 2026-09-09 11:01Z and this migration the '
  'column existed with SELECT and no INSERT, which refused every file anybody '
  'tried to send.';
