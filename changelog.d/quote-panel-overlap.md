## 2026-09-19 · fix(chat): an open tool can no longer be painted over by the conversation

Owner, supplier thread, Tools → "Send a quote" open: the message bubbles
painted on top of the quote builder's couple name and PAX / HRS inputs.
Measured live at 988×1265: the stream wrapper had a computed height of 0 and
its list (224px floor) spilled out across the open 701px panel. The wrapper is
`relative`, so it painted above the panel and caught clicks.

Root cause: every box from the `ChatBox` frame down to the list was `min-h-0`,
so the list's `min-h-[14rem]` floor constrained nothing above it. The frame
shrank to the column's fixed height and the open tray took the stream's share.

Fix, in the one frame both sides share (`app/_components/chat/chat-box.tsx`,
so the couple's thread gets it too):
- the `ChatBox` root drops `min-h-0` and keeps its automatic minimum, so with a
  tool open the page's scrolling `<section>` scrolls instead of the tray
  overlapping the stream;
- the three view scrollers in `chat-message-stream.tsx` (conversation,
  Decisions, Files) are `basis-0`, so that minimum counts the 14rem floor and
  not the whole thread. Files also gets the floor it lacked.

Measured in a Chromium harness with the real Tailwind build at 320 / 375 / 988
/ 1440 wide, with 2 and 80 messages and the tray open and closed: the list is
≥224px in every case, with no overlap on the composer or the tray, and the
composer does not move while the tray is closed. This also fixes a 60px overlap
on a 320×568 phone with no tool open.
Guarded by `apps/web/app/_components/chat/an-open-tool-cannot-flatten-the-stream.test.ts`,
and `lib/a-quote-card-does-not-crush-the-conversation.test.ts` now counts 3
floored scrollers instead of 2.

SPEC IMPACT: None.
