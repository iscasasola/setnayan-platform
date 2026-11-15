-- a_photo_needs_no_words
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)


-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 📎 CHAT-01 (W1 re-walk of a2a872a, 14 Nov 2026 — live fault): sending a photo with no words ALWAYS failed (500).
-- `chat_messages_body_check` demanded length(body) > 0, the column is NOT NULL, and the send (`sendChatMessageCore`)
-- writes the words as typed — '' for a photo alone. The app has always meant "body OR attachment OR both" (its own
-- check says so, and the bubble draws words only when there are any); the table did not.
-- LOOSENS ONLY: a message may now carry no words WHEN it carries a file. A message with neither is still refused, and
-- the 4,000-character ceiling is unchanged. Writes no data.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_body_check;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_body_check CHECK (
  length(body) <= 4000
  AND (length(body) > 0 OR attachment_url IS NOT NULL OR attachment_r2_key IS NOT NULL)
);
