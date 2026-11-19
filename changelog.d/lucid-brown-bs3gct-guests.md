## 2026-11-17 · fix(guests): Regenerate QR cannot spin forever

From the couple-dashboard audit: `guests/invite/_components/regenerate-qr-button.tsx` set `busy`, awaited `save.run(...)` and reset `busy` only on the next line. `useSaveLoader().run` re-throws when the server action rejects (a dropped connection), so the refresh icon spun forever, the button stayed disabled, and nothing was said. It now resets in `finally` and says it could not confirm a new QR (it cannot know whether the server finished before the connection dropped, so it asks for a reload rather than claiming the old QR still works).

SPEC IMPACT: None

### And Invites says when it could not read which links were renewed

`invitation/page.tsx` read each guest's `qr_token_rotated_at` and, on a refused read, only logged — the page then drew no "renewed" badge on anybody, which its own comment calls "a claim about who can still get in". The refusal now sets `rotationsUnread` and the page's `ReadRefusedNotice` (partial) says so above the list. (A thrown, pre-migration read still degrades quietly, as before.)
