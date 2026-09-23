-- A WITHDRAWN CONVERSATION REFUSES WRITES — the server half of the UI gate.
--
-- ── WHY (owner, 2026-09-23: "fix the withdrawn wording now") ────────────────
-- `withdrawInquiry` writes ONLY `chat_threads.archived_at` and never touches
-- `inquiry_status`, so a withdrawn thread is still `pending`. Both thread pages
-- branched on the status alone and offered the actions of a live inquiry:
-- a working composer for the couple, and **Accept inquiry** for the supplier.
--
-- The pages now ask `isThreadClosed()` first. This is the other half: a page
-- that was ALREADY OPEN when the couple withdrew can still post its form, and
-- `acceptInquiry` never reads `archived_at` — it goes straight to
-- `.update({ inquiry_status: 'accepted' })`, and the write SUCCEEDS.
-- The repo's own standard for the sibling case is a refusal, not a hidden
-- button: `lockDeal` refuses a stale page with nothing written.
--
-- ── WHY RLS AND NOT A TYPESCRIPT CHECK ──────────────────────────────────────
-- `chat_messages` has NINE insert sites, not one. A guard in `sendChatMessage`
-- would be a fix that looks complete and leaves eight doors open (quotes,
-- offered services, negotiation cards, the 3-state build action, …).
-- Re-measure the doors before trusting that number:
--   grep -rn "from('chat_messages')" apps/web/lib apps/web/app
--
-- ── ⚖ AND THE BOT IS UNTOUCHED, BY MECHANISM RATHER THAN BY CARE ────────────
-- Audited at the CALL SITE, not by the files' imports — a file's imports do not
-- name the query's client (`chat-send.ts` holds BOTH: `admin` at :183/:384 and
-- the user client at :355, which is the one that inserts):
--   user client  → chat-send · proposal-send · offer-service-core ·
--                  negotiation-actions ×3   → RLS APPLIES, refused here
--   service role → vendor-autoreply/inbox-hook · auto-accept · chat-actions ·
--                  build-3state-actions · admin demo → RLS BYPASSED, unaffected
-- So the auto-reply bot and the `'system'` notes keep working. The fear that a
-- refusal would also silence the bot is not mitigated here; it CANNOT OCCUR.
--
-- ── SHAPE ───────────────────────────────────────────────────────────────────
-- RESTRICTIVE, because a PERMISSIVE policy would only OR with the existing
-- grant and refuse nothing. Both of this schema's existing refusals are
-- restrictive — `chat_messages_block_guard` and `chat_threads_follow_gate`.
--
-- Idempotent: safe to re-run.

-- 1 ─ No new message on a withdrawn thread.
drop policy if exists chat_messages_withdrawn_guard on public.chat_messages;
create policy chat_messages_withdrawn_guard
  on public.chat_messages
  as restrictive
  for insert
  to authenticated
  with check (
    not exists (
      select 1
      from public.chat_threads ct
      where ct.thread_id = chat_messages.thread_id
        and ct.archived_at is not null
    )
  );

-- 2 ─ A withdrawn thread may not be moved to `accepted`.
--
-- ⚖ The rule is on the NEW row, deliberately. `with check` cannot see the OLD
--    row, and a `using` clause would refuse EVERY update to a withdrawn thread
--    — including the couple re-adding the vendor, which un-withdraws it by
--    setting `archived_at` back to NULL. Re-adding must keep working:
--      NEW.archived_at IS NULL            → allowed (this is un-withdrawing)
--      NEW.archived_at set, status pending → allowed (ordinary bookkeeping)
--      NEW.archived_at set, status accepted → REFUSED (the defect)
--    A thread that was accepted and then withdrawn is therefore frozen until
--    it is un-withdrawn, which is the intended reading of "withdrawn".
drop policy if exists chat_threads_withdrawn_accept_guard on public.chat_threads;
create policy chat_threads_withdrawn_accept_guard
  on public.chat_threads
  as restrictive
  for update
  to authenticated
  with check (
    archived_at is null
    or inquiry_status <> 'accepted'::chat_inquiry_status
  );

comment on policy chat_messages_withdrawn_guard on public.chat_messages is
  'A withdrawn thread (chat_threads.archived_at set) takes no new messages from a user session. Service-role writers (the auto-reply bot, system notes) are not subject to RLS and are unaffected.';
comment on policy chat_threads_withdrawn_accept_guard on public.chat_threads is
  'A withdrawn thread may not be moved to accepted. Checked on the NEW row so that un-withdrawing (archived_at back to NULL) still works.';
