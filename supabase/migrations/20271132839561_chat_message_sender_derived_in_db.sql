-- ============================================================================
-- THE SENDER OF A CHAT MESSAGE IS DECIDED BY THE DATABASE, NOT BY THE BROWSER.
-- ============================================================================
--
-- ── WHAT WAS POSSIBLE (measured against a full replay of this corpus, before
--    this file existed) ─────────────────────────────────────────────────────
-- A couple signed into their OWN account, holding nothing but the public anon
-- key and their own session, could POST straight to /rest/v1/chat_messages and
-- have the row accepted with:
--
--     sender_role = 'vendor'      + sender_user_id = <the vendor's real uid>
--     sender_role = 'system'      (a message that reads as Setnayan speaking)
--     sender_role = 'coordinator' (a fourth costume nobody had listed)
--     is_bot      = true          (renders as the vendor's AI assistant)
--
-- All three were ACCEPTED on a thread the vendor had not even accepted yet.
-- The vendor then could not delete any of them: chat_messages carries no
-- UPDATE and no DELETE policy by design (it is the immutable evidence layer —
-- see 20270926679942 and tests/db/chat-immutable-archive.db.test.ts). So the
-- forged words were permanent.
--
-- ── AND FORGING ONE 'vendor' ROW UNMASKED THE VENDOR ──────────────────────
-- Three AFTER INSERT triggers branch on the stored role and nothing else:
--   reveal_vendor_name_on_first_reply  → vendor_profiles.name_revealed_at
--   tg_chat_messages_unlock_vendor_name→ vendor_profiles.real_name_unlocked_at
--   stamp_vendor_first_reply           → chat_threads.vendor_first_reply_at
-- In the replay all three fired off the forged row, so a couple could reveal a
-- supplier's real personal name to themselves before that supplier had ever
-- said a word. Those triggers are CORRECT and are deliberately left alone:
-- once the role in the row is derived rather than supplied, what they trust is
-- trustworthy. The fix belongs at the point the value is WRITTEN, not at each
-- of the three places it is read — a fourth reader will be added one day and
-- nobody will remember to patch it too.
--
-- ── WHY THE APP LAYER WAS NEVER THE CONTROL ───────────────────────────────
-- lib/chat-send.ts derives the role correctly from thread membership. It is
-- also skippable: apps/web/lib/supabase/client.ts ships a browser client, the
-- anon key is public by construction, and PostgREST is on the internet. RLS
-- allowed the INSERT (the couple IS a party to the thread) and had nothing to
-- say about WHO the row claimed to be from — chat_messages_member_insert's
-- WITH CHECK constrains event_id and vendor_profile_id only.
--
-- ── THE FIX, IN TWO HALVES THAT ONLY WORK TOGETHER ────────────────────────
-- 1. Take away the ability to name the columns. `authenticated` held the
--    privilege table-wide, so a column-level REVOKE would have been a no-op
--    (Postgres tracks table and column grants separately and warns rather than
--    narrowing). The table-level grant is dropped and re-issued column by
--    column, minus the four the browser must not decide.
-- 2. Fill them in server-side. sender_role is NOT NULL with no default and
--    cannot have one — it depends on other columns of the same row — so a
--    BEFORE INSERT trigger derives it from auth.uid() and this person's real
--    standing in this conversation.
--
-- Neither half is sufficient on its own. The revoke alone breaks every
-- legitimate send (NOT NULL, no default, nothing left to fill it). The trigger
-- alone would hold the line, but silently rewriting a value the caller is
-- still allowed to send is a control nobody can see; the revoke turns a forged
-- send into an immediate, legible refusal. Both ship, and the db test proves
-- each one fires on its own.
--
-- ── SCOPE NOTE (deliberate, flagged rather than smuggled) ─────────────────
-- Two columns beyond the brief are also removed from the browser's reach:
--   is_bot     — no authenticated path has ever set it (the assistant posts
--                via the service role); lib/vendor-autoreply/inbox-hook.ts
--                already ASSERTS in a comment that a live user "can't set
--                is_bot", which was untrue until this file. Column DEFAULT
--                false now does the work.
--   created_at — on an append-only evidence layer, letting the sender choose
--                WHEN a message happened is the same defect wearing a
--                different hat. DEFAULT now() does the work. No app path
--                names it under an end-user session.
--
-- UPDATE is revoked outright from both roles and NOT re-granted: there is no
-- UPDATE policy, so no authenticated session can update any row today, and
-- without this the day somebody adds an "edit your message" policy the sender
-- columns silently become forgeable again by a different verb.
-- DELETE is left exactly as it is — policy-blocked, and the immutability it
-- protects is a decision this file has no business re-opening.
--
-- Nothing here touches the service role: every system/bot/demo author
-- (lib/chat-actions.ts, vendor-autoreply/*, admin/demo-vendors/*) writes with
-- the service key, keeps its grants, and keeps authoring 'system' rows.
-- ============================================================================

-- ── 1 · STAMP THE SENDER BEFORE THE ROW LANDS ──────────────────────────────
-- The membership test is INLINE rather than a helper function on purpose. A
-- standalone SECURITY DEFINER function in `public` is published by PostgREST at
-- /rest/v1/rpc/ and becomes new public surface — the first cut of this file did
-- exactly that and both anon-rpc-surface.db.test.ts and exposure-freeze
-- .db.test.ts refused it. They offered "narrow it" or "declare it"; narrowing
-- is right, because nothing outside this trigger has any reason to ask. A
-- trigger function cannot be called over REST (PostgREST cannot expose a
-- `trigger` return type, and Postgres refuses a direct call), so this adds no
-- reachable surface at all.
--
-- The three branches mirror chat_messages_member_insert's WITH CHECK branch for
-- branch, on purpose: derivation must not be narrower than the policy (a
-- legitimate sender would start being refused) nor wider (it would mint a role
-- for somebody RLS is about to reject anyway). Couple is tested FIRST, matching
-- lib/chat-send.ts, so anyone who is both couple and vendor on one thread
-- resolves the same way in both places.
--
-- SECURITY INVOKER on purpose: it has to read current_user to tell an end-user
-- session (PostgREST does SET LOCAL ROLE authenticated) from a service-role or
-- owner session. A SECURITY DEFINER function would report the owner every time
-- and this whole branch would be dead code. The membership lookups it calls
-- are themselves DEFINER, so nothing here needs elevated rights of its own.
CREATE OR REPLACE FUNCTION public.tg_chat_messages_derive_sender()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid;
  v_role public.chat_sender_role;
BEGIN
  -- Service role, the table owner and migrations author 'system' rows, bot
  -- replies and demo seeds with an explicit sender. They are the server; there
  -- is nothing to derive them from and nothing to protect them against.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION
      'chat_messages: no signed-in identity to attribute this message to'
      USING ERRCODE = '42501';
  END IF;

  SELECT CASE
    -- A couple member of the event.
    WHEN NEW.event_id IN (SELECT public.current_couple_event_ids())
      THEN 'couple'::public.chat_sender_role
    -- The vendor profile's owner, or an owner/admin team member.
    WHEN NEW.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
      THEN 'vendor'::public.chat_sender_role
    -- Vendor-side staff below admin, on an event their assigned service serves.
    -- Vendor-side either way, so they speak as the vendor.
    WHEN NEW.vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
     AND NEW.event_id IN (SELECT public.agent_customer_event_ids())
      THEN 'vendor'::public.chat_sender_role
    ELSE NULL
  END INTO v_role;

  IF v_role IS NULL THEN
    -- RLS would refuse this row a moment later anyway; failing here makes the
    -- reason legible instead of a bare policy violation.
    RAISE EXCEPTION
      'chat_messages: sender is not a party to this conversation'
      USING ERRCODE = '42501';
  END IF;

  -- Overwrite unconditionally. Not "if null" — a supplied value is exactly
  -- what this exists to discard, and the grants below mean a well-behaved
  -- client never supplies one anyway.
  NEW.sender_role    := v_role;
  NEW.sender_user_id := v_uid;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_chat_messages_derive_sender() IS
  'BEFORE INSERT on chat_messages: for end-user sessions, replaces any '
  'client-supplied sender_role/sender_user_id with values derived from '
  'auth.uid(). Service-role and owner sessions pass through untouched.';

DROP TRIGGER IF EXISTS chat_messages_derive_sender ON public.chat_messages;
CREATE TRIGGER chat_messages_derive_sender
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_chat_messages_derive_sender();

-- ── 2 · TAKE THE PEN AWAY ──────────────────────────────────────────────────
-- The grant was table-wide, so it is dropped whole and re-issued per column.
-- Revoking INSERT (sender_role) against a table-level grant does NOT narrow
-- anything in Postgres — it warns and leaves the privilege standing. That
-- near-miss is the reason this is written the long way.
REVOKE INSERT, UPDATE ON public.chat_messages FROM authenticated;
REVOKE INSERT, UPDATE ON public.chat_messages FROM anon;

-- anon is granted NOTHING back. Every policy on this table is TO authenticated,
-- so anon could never insert a row regardless; this simply stops the ACL from
-- claiming otherwise.
GRANT INSERT (
  message_id,
  thread_id,
  event_id,
  vendor_profile_id,
  body,
  proposal_id,
  attachment_url,
  attachment_name,
  attachment_mime,
  attachment_size_bytes,
  appointment_id,
  change_order_id,
  amendment_id
) ON public.chat_messages TO authenticated;

COMMENT ON COLUMN public.chat_messages.sender_role IS
  'WHO the message is from. Derived by tg_chat_messages_derive_sender from '
  'auth.uid(); authenticated/anon hold no INSERT or UPDATE privilege on this '
  'column and cannot supply it. Three AFTER INSERT triggers act on this value '
  '(vendor name reveal + first-reply stamp), which is why it is not the '
  'browser''s to choose.';

COMMENT ON COLUMN public.chat_messages.sender_user_id IS
  'The authoring account. Derived from auth.uid() by '
  'tg_chat_messages_derive_sender; not writable by authenticated/anon. NULL on '
  'service-role rows (system notices and Auto-Reply Assistant replies).';
