## 2026-09-10 · security(chat): the chat cannot be used to leave the app — the database screens, binds and pins every end-user message

Owner: *"our goal is to let them integrate their event with the vendor they find.
not to let them communicate outside the app."* Four doors, each measured OPEN in
the replay as a real `authenticated` session before this change:

- **A · the attachment route was an open redirect.** `/api/chat/attachment/[messageId]`
  passed any non-`r2://` value through `displayUrlForStoredAsset` and 302'd to it,
  so `https://wa.me/…` / `viber://…` / `m.me/…` rendered as a file card on
  setnayan.com and opened WhatsApp. It now signs only through
  `presignClientRef(stored, chatAttachmentPolicy(row.thread_id))` — a
  `setnayan-thread-files` ref under `chat/<this thread>/` — and answers everything
  else exactly like a missing message (404). Production had ZERO rows with an
  `attachment_url` (read-only, 2026-09-10), so no legitimate file stops opening.
- **B · `attachment_url` was still writable.** `REVOKE INSERT (attachment_url)` from
  `authenticated`/`anon` (no writer since 2026-09-09), plus the new guard refuses a
  non-NULL value from an end-user session even if the grant comes back.
- **C · a direct PostgREST insert skipped the contact screen.** New BEFORE INSERT
  trigger `chat_messages_guard_end_user_write` (SECURITY DEFINER, end-user sessions
  only) screens the body with `chat_contact_categories()` — a SQL port of
  `lib/chat-contact-filter.ts` held to the TypeScript engine by a parity test (2,439
  vectors incl. every string in the shipped filter's two test files, both profiles,
  0 disagreements). Plain message → the `chat` rules; a row carrying a card link
  (proposal / meeting / change / deal / offered service) → the shipped `card` rules,
  because those bodies are built from service names and titles ("Offered: Instagram
  teaser reel"). No rule was added or removed. Trigger, not a SECURITY DEFINER send
  RPC: every one of the six session writers already passes the trigger, and the
  DB-derived sender (20271132839561) depends on the insert running as the caller.
  `lib/chat-send.ts` maps the database's `CONTACT_BLOCKED` refusal to the same
  words the app shows.
- **D · a couple could post into a stranger's thread** by pairing their own
  `event_id` with the stranger's `thread_id`; the guard now refuses a row whose
  thread is not the conversation between its event and its supplier. And
  `attachment_r2_key` is pinned **per sender**: from an end-user session it must sit
  under `r2://setnayan-thread-files/chat/<thread>/<auth.uid()>/…`, which is where
  `chat-send.ts` now files every upload (it was `chat/<thread>/`). A row can
  therefore only ever name its own sender's file, which closes the erasure
  cross-party delete found by #5414's review.

Guards: `tests/db/the-chat-cannot-leave-the-app.db.test.ts` (16 tests, as a real
`authenticated` session, every refusal beside an accepted positive control and a
neutralisation that disables the guard in a rolled-back transaction and shows the
attack land) and `lib/chat-attachment-signs-only-its-own-thread.test.ts`.
Exposure baseline: one narrowing (`chat_messages.attachment_url authenticated=SI → S`),
no widening; neither new function is executable by anon/authenticated.

⚠ Behaviour changes to know about: (1) the database rule is ALWAYS on —
`NEXT_PUBLIC_CHAT_CONTACT_FILTER_ENABLED` now only switches the instant app-side
check and its admin record; (2) card-carrying rows are screened for the first time
(a meeting titled "@Tagaytay" is refused, as it already is on a service card);
(3) with no R2 credentials (local dev) a chat file can no longer be sent — the
Supabase Storage fallback URL is exactly what the database now refuses.

Residuals, named not fixed: the attachment's FILE NAME is shown and not screened
(a camera file name like `PXL_20260910_093015123.jpg` fuses into a phone shape, so
screening it would refuse ordinary photos — same class as a number inside the
image, already a named follow-up); and `chat_threads` — measured in the replay as a
real `authenticated` couple — lets a member UPDATE `vendor_profile_id` (re-home their
own thread onto ANY supplier's inbox), `inquiry_status`/`accepted_at` (accept their
own inquiry) and `locked_at`/`agreed_price_centavos` (stamp a lock). The thread
binding here stops a message landing in a thread that is not its pair, but a
re-homed thread IS its new pair. A separate door, on a money-adjacent table, for its
own PR.

SPEC IMPACT: DECISION_LOG row appended (2026-09-10) — the chat contact rules are now
enforced by the database for every end-user write, independent of the flag.
