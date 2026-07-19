-- Chat report/block (Apple App Store Guideline 1.2 — UGC safety: the ability to
-- BLOCK an abusive user, on top of REPORT which reuses public.user_reports).
--
-- SAFETY: fully ADDITIVE. A new public.blocked_users table + a NEW RESTRICTIVE
-- INSERT policy on chat_messages that ANDs onto the existing PERMISSIVE
-- membership policy (chat_messages_member_insert) WITHOUT modifying it. With
-- zero blocked_users rows (launch state) the guard's NOT EXISTS is always true,
-- so the restrictive policy is a structural no-op and existing chat is
-- byte-identical. System messages use the service-role client (RLS bypassed) ->
-- unaffected. Idempotent (CREATE ... IF NOT EXISTS / DROP POLICY IF EXISTS).
-- Already applied to prod via Supabase apply_migration; this file is the repo
-- record (idempotent re-apply is a no-op).

CREATE TABLE IF NOT EXISTS public.blocked_users (
  id              bigserial PRIMARY KEY,
  blocker_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_user_id, blocked_user_id),
  CONSTRAINT blocked_users_not_self CHECK (blocker_user_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS blocked_users_blocker_idx ON public.blocked_users (blocker_user_id);
CREATE INDEX IF NOT EXISTS blocked_users_blocked_idx ON public.blocked_users (blocked_user_id);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- The blocker owns their block rows (create / read / unblock).
DROP POLICY IF EXISTS blocked_users_owner_all ON public.blocked_users;
CREATE POLICY blocked_users_owner_all ON public.blocked_users
  FOR ALL TO authenticated
  USING (blocker_user_id = auth.uid())
  WITH CHECK (blocker_user_id = auth.uid());

-- The blocked party may READ rows naming them (so their thread UI can show a
-- symmetric "you can't reply" state without leaking blocks beyond the pair).
DROP POLICY IF EXISTS blocked_users_blocked_read ON public.blocked_users;
CREATE POLICY blocked_users_blocked_read ON public.blocked_users
  FOR SELECT TO authenticated
  USING (blocked_user_id = auth.uid());

-- Admins read all (moderation context).
DROP POLICY IF EXISTS blocked_users_admin_read ON public.blocked_users;
CREATE POLICY blocked_users_admin_read ON public.blocked_users
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Additive RESTRICTIVE block guard on chat_messages INSERT. Does NOT touch the
-- existing permissive chat_messages_member_insert policy. Rejects a send when
-- the sender and the thread counterparty (any couple member on the event, or
-- the vendor owner) are in a block relationship in either direction.
DROP POLICY IF EXISTS chat_messages_block_guard ON public.chat_messages;
CREATE POLICY chat_messages_block_guard ON public.chat_messages
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1
      FROM public.blocked_users b
      WHERE auth.uid() IN (b.blocker_user_id, b.blocked_user_id)
        AND (CASE WHEN b.blocker_user_id = auth.uid()
                  THEN b.blocked_user_id ELSE b.blocker_user_id END)
            IN (
              SELECT em.user_id FROM public.event_members em
              WHERE em.event_id = chat_messages.event_id AND em.member_type = 'couple'
              UNION
              SELECT vp.user_id FROM public.vendor_profiles vp
              WHERE vp.vendor_profile_id = chat_messages.vendor_profile_id
            )
    )
  );

COMMENT ON TABLE public.blocked_users IS
  'Account-to-account chat block (Apple 1.2 UGC). A row stops both parties from posting into any shared chat thread — enforced by the chat_messages_block_guard RESTRICTIVE policy and by sendChatMessage() at the app layer. Distinct from event_blocked_users (Papic guest-upload block).';
