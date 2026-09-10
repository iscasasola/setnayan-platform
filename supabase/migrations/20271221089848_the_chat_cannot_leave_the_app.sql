-- ═══════════════════════════════════════════════════════════════════════════
-- THE CHAT CANNOT BE USED TO LEAVE THE APP.
--
-- Owner, 2026-09-10: "our goal is to let them integrate their event with the
-- vendor they find. not to let them communicate outside the app."
--
-- ── WHAT WAS POSSIBLE (measured in the replay as a real `authenticated`
--    session, and read in production, 2026-09-10) ─────────────────────────────
-- A couple or a supplier, holding only their own session and the public anon
-- key, could POST straight to /rest/v1/chat_messages and:
--   1. send ANY text. The contact screen (lib/chat-contact-filter.ts) runs only
--      inside lib/chat-send.ts; a direct PostgREST insert never meets it.
--   2. set `attachment_url` to `https://wa.me/…`, `viber://…` or `m.me/…`. The
--      attachment route redirected every non-r2:// value, so the message showed
--      a file card on setnayan.com that opened WhatsApp — a door out AND an open
--      redirect. INSERT on that column was still granted though nothing in the
--      app has written it since 2026-09-09.
--   3. post into a STRANGER'S conversation. chat_messages_member_insert checks
--      event_id and vendor_profile_id and never asks whether thread_id is the
--      conversation between them: a couple set their OWN event_id beside a
--      stranger's thread_id and the row rendered in the victim's thread as a
--      couple's message.
--   4. point `attachment_r2_key` at any object in any bucket — including a file
--      the OTHER party sent — which erasure would later delete as "theirs"
--      (found by the review of PR #5414).
--
-- 🔢 PRODUCTION, READ-ONLY, 2026-09-10: chat_messages holds 3 rows; ZERO carry
-- attachment_url, ZERO carry attachment_r2_key, and all 3 agree with their
-- thread on (event_id, vendor_profile_id). No SQL function in `public` inserts
-- into chat_messages. So nothing below can strand or refuse an existing row.
--
-- ── WHAT THIS FILE DOES ─────────────────────────────────────────────────────
--   A · (app) the attachment route signs only a thread-files ref under the
--       thread's own chat/<thread>/ folder, and refuses everything else.
--   B · REVOKE INSERT (attachment_url) from `authenticated`, AND the guard
--       below refuses a non-NULL value from an end-user session. The revoke is
--       the legible refusal; the guard still holds if a later migration
--       re-grants the column by accident.
--   C · the guard screens the message text with the SAME rules as
--       lib/chat-contact-filter.ts, ported to SQL in chat_contact_categories()
--       and held to the TypeScript engine by a parity test over every vector in
--       the shipped filter's own test files plus a seeded corpus
--       (tests/db/the-chat-cannot-leave-the-app.db.test.ts).
--   D · the guard refuses a row whose thread is not the conversation between
--       its event and its supplier, and pins attachment_r2_key to
--       r2://setnayan-thread-files/chat/<thread>/<the sender's own uid>/… —
--       PER SENDER, so erasure can never be pointed at the other party's file.
--       lib/chat-send.ts now files each upload under that per-sender folder.
--
-- ── WHY A TRIGGER, NOT A SECURITY DEFINER SEND FUNCTION (C) ───────────────
-- Moving the insert behind an RPC would still need the same rules in SQL (or
-- would make the app, via the service role, the whole fence again), and it
-- would re-route SIX legitimate session writers (plain send, meeting request,
-- change request, deal, proposal, offered service) plus the DB-derived sender
-- (20271132839561), which relies on the insert running as the caller. A BEFORE
-- INSERT trigger sits where every writer already passes, so no writer changes.
--
-- ⚖ WHICH RULE-SET, AND WHY (a product decision, so it reuses shipped rules):
--   · a PLAIN message is screened with the 'chat' profile — byte-for-byte the
--     rules the app already applies before a send (flag ON in production);
--   · a row that carries a CARD link (proposal / appointment / change order /
--     amendment / offered service) is screened with the 'card' profile — the
--     shipped rules for text that names a deliverable. Those bodies are built by
--     the app from a service name or a title ("Offered: Instagram teaser reel"),
--     and the chat rules would refuse exactly the copy the card rules exist to
--     allow. The app never screened those bodies; they are screened now.
--   No rule is new. Nothing is added to or removed from either profile.
--
-- ⚠ SCOPE: end-user sessions only (the `role` setting is authenticated/anon),
-- exactly like tg_chat_messages_derive_sender. The service role (system notices,
-- the Auto-Reply Assistant, demo seeds) and migrations pass through untouched.
-- A future SECURITY DEFINER RPC that inserts while an end user is signed in IS
-- screened — its body is text a person will read in a conversation.
--
-- 🔑 WHY THE GUARD IS SECURITY DEFINER when its sibling is INVOKER: it must call
-- chat_contact_categories(), which is deliberately NOT executable by anon or
-- authenticated — granting it would publish it at /rest/v1/rpc/ as an oracle
-- for probing the filter. Inside a DEFINER function current_user is the owner,
-- so the end-user test reads the `role` setting (what PostgREST sets per
-- request), which a DEFINER call does not change — measured in the replay.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · THE RULES, IN SQL ──────────────────────────────────────────────────
-- A port of evaluateMessage() in apps/web/lib/chat-contact-filter.ts. Returns
-- the distinct rule categories that fired, in the order the TypeScript engine
-- reports them; an empty array means the text may be sent.
--
-- Porting notes — each one is a place a naive port silently disagrees:
--   · JS `\b`, `\w`, `\d` are ASCII; Postgres `\y`, `\w`, `\d` follow the
--     locale (é is a word character there). Every boundary is therefore written
--     as an explicit ASCII lookaround, and every class as an explicit range.
--   · JS `\s` is the ECMAScript WhiteSpace + LineTerminator set; it is spelled
--     out character by character in `ws`.
--   · The phone filler rule measures a run in UTF-16 code units (JS
--     `.length`); an astral character (most emoji) counts twice there.
--   · `/i` with ASCII-only patterns folds only ASCII in both engines.
CREATE OR REPLACE FUNCTION public.chat_contact_categories(
  p_body    text,
  p_profile text DEFAULT 'chat'
)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $fn$
DECLARE
  -- JS \s, character for character.
  ws constant text :=
    chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || ' ' || chr(160) ||
    chr(5760) || chr(8192) || '-' || chr(8202) || chr(8232) || chr(8233) ||
    chr(8239) || chr(8287) || chr(12288) || chr(65279);
  s  constant text := '[' || ws || ']';
  -- JS \b before / after a word character, and the general \b.
  b0 constant text := '(?<![A-Za-z0-9_])';
  b1 constant text := '(?![A-Za-z0-9_])';
  bb constant text :=
    '(?:(?<=[A-Za-z0-9_])(?![A-Za-z0-9_])|(?<![A-Za-z0-9_])(?=[A-Za-z0-9_]))';

  is_card boolean := (p_profile = 'card');
  cats    text[]  := ARRAY[]::text[];
  norm    text;
  t1      text := '';
  run     text;
  gap     int;
  phone   boolean;
  solicit_body text;
BEGIN
  -- `typeof body !== 'string' || body.trim().length === 0`
  IF p_body IS NULL OR p_body ~ ('^' || s || '*$') THEN
    RETURN cats;
  END IF;

  -- ── PHONE (evasion-resistant) ────────────────────────────────────────────
  -- spelledDigitsToNumerals: word-boundaried, case-insensitive. Replacing a
  -- bounded word with one digit keeps every neighbouring boundary, so one pass
  -- per word equals the engine's single alternation pass.
  norm := p_body;
  norm := regexp_replace(norm, b0 || 'zero'  || b1, '0', 'gi');
  norm := regexp_replace(norm, b0 || 'one'   || b1, '1', 'gi');
  norm := regexp_replace(norm, b0 || 'two'   || b1, '2', 'gi');
  norm := regexp_replace(norm, b0 || 'three' || b1, '3', 'gi');
  norm := regexp_replace(norm, b0 || 'four'  || b1, '4', 'gi');
  norm := regexp_replace(norm, b0 || 'five'  || b1, '5', 'gi');
  norm := regexp_replace(norm, b0 || 'six'   || b1, '6', 'gi');
  norm := regexp_replace(norm, b0 || 'seven' || b1, '7', 'gi');
  norm := regexp_replace(norm, b0 || 'eight' || b1, '8', 'gi');
  norm := regexp_replace(norm, b0 || 'nine'  || b1, '9', 'gi');

  -- Tier 1: each non-digit run of <= gap UTF-16 units is removed (the digits
  -- fuse); a longer run is a break. Then a PH mobile shape on any group.
  -- PHONE_FILLER_GAP = 20 (chat) · CARD_PHONE_FILLER_GAP = 2 (card).
  gap := CASE WHEN is_card THEN 2 ELSE 20 END;
  FOR run IN
    SELECT r.m[1]
      FROM regexp_matches(norm, '([0-9]+|[^0-9]+)', 'g') WITH ORDINALITY AS r(m, n)
     ORDER BY r.n
  LOOP
    IF run ~ '^[0-9]' THEN
      t1 := t1 || run;
    ELSIF char_length(run) > gap
       OR char_length(run) + regexp_count(run, '[\U00010000-\U0010FFFF]') > gap THEN
      t1 := t1 || chr(10);
    END IF;
  END LOOP;
  -- PHONE_SHAPE /(?:0|63)?9\d{9}/ on a digits-only group (a group of >= 10).
  phone := t1 ~ '9[0-9]{9}';

  -- Tier 2 (chat only): strip every JS-\s ( ) . + - (the engine's {1,2} with /g
  -- removes them all), then any run of 11+ digits.
  IF NOT phone AND NOT is_card THEN
    phone := regexp_replace(norm, '[' || ws || '().+-]{1,2}', '', 'g') ~ '[0-9]{11}';
  END IF;
  IF phone THEN cats := array_append(cats, 'phone'); END IF;

  -- ── EMAIL · EMAIL_OBFUSCATED ─────────────────────────────────────────────
  IF p_body ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
     OR p_body ~* (
       '[A-Za-z0-9._%+-]+' || s || '*(?:\(at\)|\[at\]|' || b0 || 'at' || b1 || ')'
       || s || '*[A-Za-z0-9.-]+' || s || '*(?:\(dot\)|\[dot\]|' || b0 || 'dot' || b1 || ')'
       || s || '*[A-Za-z]{2,}'
     )
  THEN
    cats := array_append(cats, 'email');
  END IF;

  -- ── SOCIAL_URL ───────────────────────────────────────────────────────────
  IF p_body ~* (
    '(?:https?://)?(?:www\.)?(?:'
    || '(?:wa\.me|m\.me|t\.me|fb\.me|instagr\.am)(?:/[^' || ws || ']*)?'
    || '|'
    || '(?:facebook|fb|messenger|instagram|whatsapp|viber|telegram|tiktok|twitter|x|linkedin|snapchat|kakao|wechat)'
    || '\.(?:com|net|org|me|ph|io)(?:/[^' || ws || ']*)?'
    || ')'
  ) THEN
    cats := array_append(cats, 'url');
  END IF;

  -- ── HANDLE ───────────────────────────────────────────────────────────────
  IF p_body ~ ('(?:^|[^A-Za-z0-9_@/])@[A-Za-z][A-Za-z0-9._]{1,30}' || bb) THEN
    cats := array_append(cats, 'handle');
  END IF;

  -- ── BLOCKLIST (in the engine's order) ────────────────────────────────────
  -- CARD (c): app_name and euphemism entries are skipped on a card.
  IF NOT is_card THEN
    IF p_body ~* (b0 || 'facebook' || b1 || '|' || b0 || 'fb' || b1 || '|' || b0 || 'messenger' || b1)
       OR p_body ~* (b0 || 'viber' || b1)
       OR p_body ~* (b0 || 'whats' || s || '?app' || b1 || '|' || b0 || 'wassap' || b1 || '|' || b0 || 'wsp' || b1)
       OR p_body ~* (b0 || 'telegram' || b1)
       OR p_body ~* (b0 || 'instagram' || b1 || '|' || b0 || 'insta' || b1 || '|' || b0 || 'ig' || b1)
       OR p_body ~* (
         b0 || 'snapchat' || b1 || '|' || b0 || 'tiktok' || b1 || '|' || b0 || 'wechat' || b1
         || '|' || b0 || 'kakao(?:talk)?' || b1 || '|' || b0 || 'imessage' || b1
         || '|' || b0 || 'signal app' || b1 || '|' || b0 || 'line app' || b1
       )
    THEN
      cats := array_append(cats, 'app_name');
    END IF;
    IF p_body ~* (b0 || '(?:blue|purple|green|pink)' || s || '+app' || b1) THEN
      cats := array_append(cats, 'euphemism');
    END IF;
  END IF;

  -- CARD (d): on a card the solicit rule — and only that rule — reads the body
  -- with every "message me on Setnayan" PHRASE scrubbed out.
  solicit_body := p_body;
  IF is_card THEN
    solicit_body := regexp_replace(
      p_body,
      b0 || '(?:message|msg|add|find|reach|contact|call|text|chat|dm|pm|ping)'
        || s || '+me' || s || '+(?:on|at|via)' || s || '+setnayan' || b1,
      ' ',
      'gi'
    );
  END IF;
  IF solicit_body ~* (
    b0 || '(?:'
    || '(?:message|msg|add|find|reach|contact|call|text|chat|dm|pm|ping)' || s || '+me' || s || '+(?:on|at|via)'
    || '|(?:my|here''?s' || s || '+my|this' || s || '+is' || s || '+my)' || s
      || '+(?:number|cell|mobile|contact|email|gcash|viber|whatsapp)'
    || '|hit' || s || '+me' || s || '+up'
    || '|let''?s' || s || '+(?:connect|chat|talk)' || s || '+(?:on|via|outside)'
    || '|outside' || s || '+the' || s || '+app'
    || '|off' || s || '+(?:the' || s || '+)?platform'
    || ')' || b1
  ) THEN
    cats := array_append(cats, 'solicit');
  END IF;

  RETURN cats;
END;
$fn$;

COMMENT ON FUNCTION public.chat_contact_categories(text, text) IS
  'SQL port of evaluateMessage() in apps/web/lib/chat-contact-filter.ts '
  '(profiles ''chat'' and ''card''). Returns the rule categories that fired; '
  'empty = allowed. Held to the TypeScript engine by the parity test in '
  'tests/db/the-chat-cannot-leave-the-app.db.test.ts — change the rules in '
  'BOTH places or that test fails. Not executable by anon/authenticated: it '
  'is called only by tg_chat_messages_guard_end_user_write.';

-- Not an RPC. Supabase's default privileges grant EXECUTE on every new public
-- function to anon and authenticated; take it back.
REVOKE EXECUTE ON FUNCTION public.chat_contact_categories(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.chat_contact_categories(text, text) FROM anon, authenticated;

-- ── 2 · THE GUARD ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_chat_messages_guard_end_user_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid;
  v_event   uuid;
  v_vendor  uuid;
  v_prefix  text;
  v_key     text;
  v_is_card boolean;
  v_cats    text[];
BEGIN
  -- End-user sessions only. The `role` setting is what PostgREST sets for each
  -- request; a DEFINER call leaves it alone, so it still names the caller.
  IF coalesce(current_setting('role', true), 'none') NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'chat_messages: no signed-in identity to attribute this message to'
      USING ERRCODE = '42501';
  END IF;

  -- D · the thread IS the conversation between this event and this supplier.
  SELECT t.event_id, t.vendor_profile_id
    INTO v_event, v_vendor
    FROM public.chat_threads t
   WHERE t.thread_id = NEW.thread_id;
  IF NOT FOUND
     OR v_event  IS DISTINCT FROM NEW.event_id
     OR v_vendor IS DISTINCT FROM NEW.vendor_profile_id THEN
    RAISE EXCEPTION 'chat_messages: that conversation is not between this event and this supplier'
      USING ERRCODE = '42501';
  END IF;

  -- B · the legacy public-URL column is retired for everyone but the server.
  IF NEW.attachment_url IS NOT NULL THEN
    RAISE EXCEPTION 'chat_messages: attachment_url is retired — files travel as attachment_r2_key'
      USING ERRCODE = '42501';
  END IF;

  -- D · a file is the SENDER'S OWN, in this thread's private folder. An exact
  -- prefix (an allow-list, never a trimmed deny-list), then the same
  -- structural rules as keyIsStructurallySafe() in lib/r2-client-ref.ts.
  IF NEW.attachment_r2_key IS NOT NULL THEN
    v_prefix := 'r2://setnayan-thread-files/chat/' || NEW.thread_id::text || '/' || v_uid::text || '/';
    v_key    := substr(NEW.attachment_r2_key, char_length('r2://setnayan-thread-files/') + 1);
    IF NOT starts_with(NEW.attachment_r2_key, v_prefix)
       OR char_length(NEW.attachment_r2_key) <= char_length(v_prefix)
       OR char_length(v_key) > 1024
       OR v_key ~ '[\\\x01-\x1f\x7f]'
       OR v_key ~ '(^|/)\.\.?(/|$)' THEN
      RAISE EXCEPTION 'chat_messages: an attachment must be your own file in this conversation''s folder'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- C · the message text, screened by the shipped rules.
  v_is_card := NEW.proposal_id IS NOT NULL
            OR NEW.appointment_id IS NOT NULL
            OR NEW.change_order_id IS NOT NULL
            OR NEW.amendment_id IS NOT NULL
            OR NEW.offered_service_id IS NOT NULL;
  v_cats := public.chat_contact_categories(NEW.body, CASE WHEN v_is_card THEN 'card' ELSE 'chat' END);
  IF cardinality(v_cats) > 0 THEN
    -- CONTACT_BLOCKED is the marker lib/chat-send.ts maps to the same words the
    -- app shows when it catches the text itself. The text is never echoed.
    RAISE EXCEPTION 'chat_messages: CONTACT_BLOCKED — phone numbers, emails and outside-app contacts are not allowed in a conversation'
      USING ERRCODE = '23514', DETAIL = array_to_string(v_cats, ',');
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_chat_messages_guard_end_user_write() IS
  'BEFORE INSERT on chat_messages, end-user sessions only: the thread must be the '
  'conversation between the row''s event and supplier; attachment_url must be NULL; '
  'attachment_r2_key must sit under r2://setnayan-thread-files/chat/<thread>/<auth.uid()>/; '
  'the body must pass chat_contact_categories() (''chat'' for a plain message, '
  '''card'' for a row carrying a card link). Migration 20271221089848.';

REVOKE EXECUTE ON FUNCTION public.tg_chat_messages_guard_end_user_write() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_chat_messages_guard_end_user_write() FROM anon, authenticated;

-- Fires after chat_messages_derive_sender (triggers of one timing run in name
-- order), so a stranger is still told "not a party" before anything else.
DROP TRIGGER IF EXISTS chat_messages_guard_end_user_write ON public.chat_messages;
CREATE TRIGGER chat_messages_guard_end_user_write
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_chat_messages_guard_end_user_write();

-- ── 3 · TAKE THE PEN AWAY (B) ──────────────────────────────────────────────
-- chat_messages carries PER-COLUMN INSERT grants (20271132839561 dropped the
-- table-level grant), so a column revoke really narrows. Verified in production
-- 2026-09-10: relacl has no table-level INSERT for authenticated.
REVOKE INSERT (attachment_url) ON public.chat_messages FROM authenticated;
REVOKE INSERT (attachment_url) ON public.chat_messages FROM anon;

COMMENT ON COLUMN public.chat_messages.attachment_url IS
  'LEGACY and RETIRED — a public URL, written only before 2026-09-09; zero rows '
  'in production ever carried one. authenticated/anon hold no INSERT on it and '
  'tg_chat_messages_guard_end_user_write refuses a value from an end-user '
  'session. /api/chat/attachment signs only a thread-files ref under the '
  'thread''s own folder, so a URL stored here is never followed. Migration '
  '20271221089848.';

COMMENT ON COLUMN public.chat_messages.attachment_r2_key IS
  'The r2:// reference to the attached file — never a URL. From an end-user '
  'session it must sit under r2://setnayan-thread-files/chat/<thread_id>/<the '
  'sender''s own uid>/ (tg_chat_messages_guard_end_user_write), which is where '
  'lib/chat-send.ts files every upload, so a row can only ever name its own '
  'sender''s file. Read through /api/chat/attachment/[messageId], which re-proves '
  'the reader is a party to the thread. authenticated INSERT, no UPDATE.';
