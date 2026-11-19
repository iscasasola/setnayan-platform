## 2026-11-18 · fix(prints): a refused badge read is never told as "None yet" on the Prints sheet

Opus review of #7956. `printBadgesV84` drops what it could not read, so when the reward counts or the seals read was refused the list came back empty, and the Prints sheet's "Your badges" row said "None yet — they show here by themselves as you earn them" to a shop that may wear several. The badges file answered "Your shop has no badges to print yet." the same way.

- `printBadgesAllRead` (`lib/print-badges-v84.ts`) says whether every read behind the list answered; `readPrintBadgeList` returns it beside the badges.
- `/api/vendor/badges?view=print` carries `allRead`. The sheet (`printBadgeListState`) shows "Couldn't load your badges just now." when nothing listed and a read was refused, and "Some of your badges couldn't load just now" when the list is partial; a partial answer is not cached, so the next opening asks again.
- The badges file answers 503 "Couldn't load your badges just now" instead of "no badges to print yet" when a read was refused.
- Tests: `lib/print-badges-v84.test.ts` (fail before this change).

SPEC IMPACT: None
