-- ============================================================================
-- 20270920573307_chat_message_flags.sql
-- Admin review queue for chat messages that carry off-platform contact info.
--
-- WHY THIS EXISTS
--   Setnayan's economy assumes the deal stays ON the platform (vendor booking
--   fee + vendor subscription + couple SKUs). The biggest leak is
--   disintermediation over couple↔vendor chat: a phone number, email, or
--   "add me on Viber" moves the relationship off Setnayan. The send path
--   (lib/chat-send.ts → scanForContactInfo) now MASKS the contact payload in the
--   delivered message and records the ORIGINAL here so a Setnayan admin can
--   review patterns + coach or act. Behaviour is gated behind the
--   CHAT_CONTACT_FILTER_ENABLED server flag (ships dark); this table is the
--   flag-write target and the /admin/chat-flags queue's source.
--
-- DESIGN
--   * One row per BLOCKED attempt. The message is rejected (never inserted into
--     chat_messages), so message_id is NULL — the row is a record of a blocked
--     try, not a pointer to a delivered message. (message_id is kept nullable for
--     forward-compat if a future "flag-but-deliver" mode is ever added.)
--   * Written by the SERVICE-ROLE admin client (bypasses RLS), same pattern as
--     revealExclusivePerks — so there is NO authenticated INSERT policy. Reads +
--     resolutions are admin-only via public.is_admin(). Neither the couple nor
--     the vendor can read this queue: the mask in the delivered body is their
--     visible signal; this is a moderator-only abuse-signal record.
--   * METADATA ONLY — no message text. The owner-locked admin-account-access
--     model (2026-06-22 · Admin_Account_Access_Model_2026-06-22.md · the
--     lint-admin-chat-guard invariant) forbids Setnayan staff from reading
--     couple↔vendor chat bodies. So this table deliberately stores WHAT KIND of
--     contact info was shared (categories + hit_count) and BY WHOM (sender_role
--     + context ids) — never the original or the masked text. That is enough to
--     catch repeat disintermediation (a vendor who keeps trying to go off-
--     platform) without reading anyone's conversation. message_id is kept for
--     provenance/dedup only; it does NOT grant body access (admin has no read
--     grant on chat_messages, and the guard blocks admin-surface reads of it).
--
-- IDEMPOTENT + RLS AT CREATE TIME. Safe to (re-)apply.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.chat_message_flags (
  id                 BIGSERIAL PRIMARY KEY,
  flag_id            UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  public_id          TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('W'),
  -- The blocked message is never inserted, so message_id is NULL. Nullable +
  -- CASCADE (if a message ever were linked, a hard-delete takes its flag too).
  message_id         UUID
                       REFERENCES public.chat_messages(message_id) ON DELETE CASCADE,
  thread_id          UUID NOT NULL
                       REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  -- Context for the queue label (SET NULL — a flag stays reviewable even if the
  -- event/vendor/user row is later removed).
  event_id           UUID REFERENCES public.events(event_id) ON DELETE SET NULL,
  vendor_profile_id  UUID REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL,
  sender_user_id     UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  -- 'couple' | 'vendor' (system/bot messages never reach the filter).
  sender_role        TEXT NOT NULL,
  -- Distinct detector categories: phone | email | url | handle | social_app |
  -- euphemism | solicit (see lib/chat-contact-filter.ts). This is the ONLY
  -- content-derived data stored — a set of category labels, never the text.
  categories         TEXT[] NOT NULL DEFAULT '{}',
  -- How many rules fired on the message (severity signal, not content).
  hit_count          INTEGER NOT NULL DEFAULT 0,
  -- What the filter did. 'blocked' = message rejected (the only live outcome
  -- today); 'flagged' reserved for a future deliver-but-record mode.
  outcome            TEXT NOT NULL DEFAULT 'blocked'
                       CHECK (outcome IN ('blocked', 'flagged')),
  status             TEXT NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'reviewed', 'dismissed')),
  action_taken       TEXT,
  reviewed_by        UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  reviewed_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_message_flags_status_idx
  ON public.chat_message_flags(status);
CREATE INDEX IF NOT EXISTS chat_message_flags_created_at_idx
  ON public.chat_message_flags(created_at DESC);
CREATE INDEX IF NOT EXISTS chat_message_flags_event_id_idx
  ON public.chat_message_flags(event_id);
CREATE INDEX IF NOT EXISTS chat_message_flags_vendor_idx
  ON public.chat_message_flags(vendor_profile_id);

ALTER TABLE public.chat_message_flags ENABLE ROW LEVEL SECURITY;

-- Setnayan admins read the whole queue.
DROP POLICY IF EXISTS chat_message_flags_admin_read ON public.chat_message_flags;
CREATE POLICY chat_message_flags_admin_read ON public.chat_message_flags
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Setnayan admins resolve (triage) any flag.
DROP POLICY IF EXISTS chat_message_flags_admin_update ON public.chat_message_flags;
CREATE POLICY chat_message_flags_admin_update ON public.chat_message_flags
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- NO authenticated INSERT/DELETE policy on purpose: rows are written by the
-- service-role admin client on the send path (which bypasses RLS), and couples/
-- vendors must never read or write this moderator-only queue.

COMMENT ON TABLE public.chat_message_flags IS
  'Admin record of couple↔vendor chat messages BLOCKED for off-platform contact '
  'info (phone/email/social URL/@handle/app-name/euphemism/solicit). The send '
  'path (lib/chat-send.ts) rejects the message and records METADATA ONLY here '
  '(categories + hit_count + sender_role + context) via the service-role client '
  '— NEVER the message text, per the owner-locked admin-no-chat-read invariant '
  '(2026-06-22). Admin-only RLS (is_admin). Gated behind '
  'NEXT_PUBLIC_CHAT_CONTACT_FILTER_ENABLED.';

COMMIT;
