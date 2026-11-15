## 2026-11-14 · fix(app): a deploy-cutover module mismatch reloads once instead of the crash card (AW-12)

Three live faults from the admin Problems list (prod 0e9f11a), measured against the raw telemetry:

- **/dashboard "global crash: undefined is not an object (evaluating [value])"** — 5 occurrences over three weeks
  (21 Oct → 13 Nov). Not one of our components: the stack sits at the SAME offsets in every build inside React's own
  Server Components loader (`requireModule`, read off the live chunk `5006-*`) — `t` is the client module the server's
  payload named, `undefined` when this tab's bundle does not have it. Every occurrence was the crashing build's FIRST
  report while other pages still answered from the previous build: the cutover moment of a deploy. The error screens now
  treat it as a stale tab — one reload, the existing one-per-session budget — via `isMissingClientModuleError` in
  `lib/stale-bundle.ts`. Narrow: the loader's own property reads (`then` · `__esModule` · `default` · `t[e[2]]`) off
  undefined, with the top frame in a numbered SHARED chunk; the same words from a route's own chunk are still a real crash.
- **Unread messages badge "107×"** — the row's lifetime total; the raw log has 3 in the last 3 days, on two builds.
  `count_unread_message_threads` exists in prod, `authenticated` may execute it, and it answers. A refused re-read is
  already `null` and never reaches the badge (held by `lib/tab-return.test.ts`). No code change: intermittent refusals
  (a lapsed browser session), not a broken query.
- **"Send chat message" ×3** — a photo sent with no caption, refused by `chat_messages_body_check` (23514,
  `hadAttachment: true`). Same root cause as LIVE-FIX CHAT-01 (its own PR, migration `a_photo_needs_no_words`); not
  duplicated here.
- Guard: `lib/a-deploy-cutover-crash-reloads-once.test.ts` (the live stack; a route-chunk crash and other properties
  still crash). Sabotage measured: dropping the rule turns it red.

SPEC IMPACT: None.
