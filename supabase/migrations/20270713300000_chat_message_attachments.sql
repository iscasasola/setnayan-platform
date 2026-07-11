-- Chat file sharing (Vendor↔Customer Connection Build Plan 2026-07-10, PR 2).
-- Additive only: four nullable attachment columns on chat_messages so a message
-- can carry an OPTIONAL file (image / pdf / common doc) alongside — or instead
-- of — its text body. Mirrors the proposal_id optional-payload pattern
-- (20270225555952): ordinary text messages leave all four NULL, so the
-- text-only path is completely unchanged.
--
-- RLS is intentionally NOT touched — the existing chat_messages SELECT/INSERT
-- policies already gate rows by thread membership and cover the new columns.
-- The file bytes live in R2 (uploaded via lib/storage.uploadPublicAsset under
-- the `chat/<thread_id>/…` prefix); attachment_url is the public URL. Access
-- control on the object itself (public URL → short-lived signed URL) is a
-- follow-up, matching the vendor-handover proof-image precedent.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS attachment_url        text,
  ADD COLUMN IF NOT EXISTS attachment_name       text,
  ADD COLUMN IF NOT EXISTS attachment_mime       text,
  ADD COLUMN IF NOT EXISTS attachment_size_bytes int;

COMMENT ON COLUMN public.chat_messages.attachment_url IS
  'Public R2 URL of an optional file attachment (chat file sharing, PR 2). NULL on text-only messages. Access-control hardening (signed URLs) is a follow-up.';
