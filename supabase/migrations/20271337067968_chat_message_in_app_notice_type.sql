-- chat_message_in_app_notice_type
-- ============================================================================
-- 💬 ONE IN-APP NOTICE FOR THE PEOPLE A CHAT MESSAGE NOW ALSO REACHES (chat gaps, owner 8 Nov 2026 — "yes build
-- them"; "no new emails (in-app notices only)").
--
--   chat_message_in_app → when a HOST writes: the shop's team members who may chat in that conversation (the owner
--                         keeps `chat_message`, as it ships) and the OTHER hosts in the thread plus the event's
--                         coordinators; when the SHOP writes: the event's coordinators (the hosts in the thread keep
--                         `chat_message`). Sent by `notifyOtherParty` (lib/chat-actions.ts).
--
-- IN-APP ONLY — NOT on EMAIL_ENABLED_TYPES, declared `app_only` in lib/couple-supplier-notices.ts (its guard fails if
-- it is ever emailed). A `chat_message` would have emailed every one of these new recipients; a type of its own is
-- how widening WHO is told adds no email. Its phone notice follows lib/push-levels.ts (normal) — quiet hours, the 7 am
-- release and the evening summary as every other notice.
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE. notification_type is a Postgres ENUM and Postgres forbids USING
-- a newly-added value in the same transaction that adds it (same shape as 20271330482944).
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'chat_message_in_app';
