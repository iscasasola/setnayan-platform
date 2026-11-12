-- a guest can speak in a group chat
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ════════════════════════════════════════════════════════════════════════════
-- EVENT GROUP CHATS · PART 1 of 2 — owner, DECISION_LOG 2026-11-11 ✍️ "GUESTS
-- CAN WRITE IN THEIR GROUP CHATS" and 2026-11-12 "EVENT GROUP CHATS APPROVED AS
-- DRAWN". A guest writes in General and in their role group, so a line needs a
-- side to be written from. chat_sender_role was couple · vendor · coordinator ·
-- system; it gains 'guest'.
--
-- ALONE IN ITS OWN FILE on purpose: Postgres refuses to USE an enum value in
-- the transaction that added it (55P04), and the next migration
-- (20271340374819) uses it in the sender derivation. Nothing else changes here.
-- 'guest' can only ever be derived for a GROUP thread (20271340374819's
-- tg_chat_messages_derive_sender) — a supplier conversation never derives it.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TYPE public.chat_sender_role ADD VALUE IF NOT EXISTS 'guest';
