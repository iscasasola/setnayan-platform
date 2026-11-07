## 2026-11-07 · perf(vendor-dashboard): seven supplier pages send their independent reads in one batch

Supplier go-live plan E3. Seven supplier-dashboard pages awaited reads one after another that ask nothing of each other. Each independent group now starts together. Nothing on screen changes, and no error handling changes. Every gate stays where it was (sign-in, the shop, the booking-fee gate, a redirecting or throwing first read), so a later read still starts only once that gate has passed.

| Page | Sequential round trips after its gates, before → after |
|---|---|
| `clients/[eventId]/mood-board` | 6 → 3 (sign-offs ‖ decor catalog ‖ colour grants ‖ suggestions + brief; the live parts stay their own read because a guard pins that line) |
| `clients/[eventId]/production-sheet` | 2 → 1 (portion rules ‖ crew meals) |
| `clients/[eventId]/editorial-media` | 2 → 1 (eligibility ‖ event name) |
| `booking-fees/[orderId]` | 2 → 1 (payments ‖ settings ‖ the bill's dispute) |
| `recommendations` | 5 → 2 (threads ‖ sent ‖ tiles, then recommendations ‖ opt-ins ‖ feedback ‖ catalog ‖ leaves) |
| `creators` | 2 → 1 (tier ‖ creators + offers + ROI) |
| `moodboard-library` | 4 → 1 after the uploads read, which throws and stays first (colour ranges ‖ tier ‖ importable ‖ shop photos + card choices) |

New `lib/settled-read.ts` (`settledValue`) with its test. `Promise.all` is used only where at most one read can throw and it was the first. Where a read that can throw sat after a log or another read, the batch is `Promise.allSettled`, and `settledValue` meets that failure at the line that used to await it. So the error that surfaces, and every log before it, stay the same.

SPEC IMPACT: None.
