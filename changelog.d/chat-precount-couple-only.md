## 2026-07-21 · fix(chat): pre-accept allowance counts only couple-authored messages

The couple's pre-accept chat allowance (the inquiry + exactly ONE follow-up while
the thread is `pending`) was computed from an UNFILTERED `chat_messages` count on
the thread. The comment above it asserted "while the thread is pending only the
couple can post" — that invariant is false. The Vendor Auto-Reply Assistant
(`lib/vendor-autoreply/inbox-hook.ts`) inserts into a still-`pending` thread as
`sender_role='vendor', is_bot=true`, scheduled from chat-send's own `after()` on
the couple's message. So the bot's reply consumed one of the couple's two allowed
messages, and a bot that asked a clarifying question could strand its own
conversation: the couple hit `followup_used` and could not answer.

- New exported helper `countCoupleMessages(admin, threadId)` in `lib/chat.ts`,
  filtered to `sender_role='couple'`, carrying the WHY in its docstring
  (including why `'coordinator'` is deliberately not counted and why no
  `.eq('is_bot', false)` is added — that column is owner-pushed).
- `lib/chat-send.ts` uses it for BOTH consumers of `priorMessageCount`: the
  one-follow-up gate and the `isFirstMessage` "new inquiry" notification swap.
  Same filter is correct for both — `isFirstMessage` means "the couple's first
  message to this vendor".
- Replaced the false invariant comment with the real one.
- Regression tests appended to `lib/chat.test.ts` (thenable stub that records
  `.eq()` filters): `[couple, vendor-bot] → 1` fails without the filter.

SPEC IMPACT: None (no schema/SKU/route change; restores the intended inquiry +
one-follow-up semantics).
