-- a chat can be muted by one person
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ════════════════════════════════════════════════════════════════════════════
-- UNICHAT · MUTE THIS CHAT (approved drawing unichat_live_v3_2026-11-20.html:
-- ⋯ "Mute this chat / Unmute this chat", a bell-off after the name, toast
-- "Muted. Cards that need you still show."). Controller ruling 2026-11-21:
--   ⚖ PER PERSON. A mute silences that chat's notices only for the person who
--     muted it, on all their devices. Everyone else keeps getting them.
--   ⚖ Shop-wide notices still reach each member, minus anyone who muted.
--   ⚖ The chat still shows unread counts — only the phone notice stops.
--
-- 1 · chat_thread_mutes — one row = "this person muted this chat". Pattern A
--     (own rows: user_id = auth.uid()). Nobody else reads it, and the other
--     side is never told. Written by the signed-in person (RLS-scoped client),
--     read by the service role where notices are sent.
-- 2 · vendor_push_tokens.user_id — WHO registered the device. The shop-wide
--     chat push (/api/notify) is keyed on the shop, not on a person, so before
--     this column it could not leave out one member's phone. NULL = a token
--     registered before this column: it is still sent (it cannot be told
--     apart), and it gains its person the next time that device re-registers
--     (registerPushToken runs on every supplier-dashboard visit).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;
-- Both parts lock a hot table briefly (the FK on chat_threads · the column on vendor_push_tokens).
SET LOCAL lock_timeout = '5s';

-- ── 1 · the per-person mute ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_thread_mutes (
  thread_id  UUID NOT NULL REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  muted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS chat_thread_mutes_user_idx
  ON public.chat_thread_mutes (user_id, thread_id);

ALTER TABLE public.chat_thread_mutes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.chat_thread_mutes IS
  'Unichat "Mute this chat" (controller ruling 2026-11-21): one row = this person muted this chat. Per person, private (Pattern A, user_id = auth.uid()). Stops only the PHONE notice for that person (chatNoticeSilentFor in lib/chat-mutes.ts; /api/notify leaves out their vendor_push_tokens); the bell row and unread counts stay. Migration 20271356402294.';

DROP POLICY IF EXISTS chat_thread_mutes_own ON public.chat_thread_mutes;
CREATE POLICY chat_thread_mutes_own
  ON public.chat_thread_mutes FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Exactly what the ⋯ row needs: read your own, mute (insert), unmute (delete).
REVOKE ALL ON public.chat_thread_mutes FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.chat_thread_mutes TO authenticated;
GRANT ALL ON public.chat_thread_mutes TO service_role;

-- ── 2 · whose phone a shop token is ─────────────────────────────────────────
ALTER TABLE public.vendor_push_tokens
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.vendor_push_tokens.user_id IS
  'The person who registered this device (registerPushToken). Lets the shop-wide chat push leave out a member who muted the chat (chat_thread_mutes). NULL = registered before 2026-11-21: still sent, filled on the next re-register. Migration 20271356402294.';

COMMIT;
