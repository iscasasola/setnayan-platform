## 2026-11-25 · fix(papic): the guest's Papic doors say what happened (final check, area 4, batch 2)

Final check fixer, area 4 (Guest), lane A batch 2 — the guest's Papic surfaces. Each fix makes a refusal, a failed
read or a dead press say what happened, where it used to be silent or drawn as a fact:

- Live demo (`/papic/demo/[token]`): a refused or failed shot says so (A4-57); the shot count comes from the server's
  `DEMO_SHOT_CAP`, never a typed 3 (A4-58); no "the real Papic is unlimited" (A4-56). `/papic/try` drops "the demo
  caps this, not Papic" (A4-83). The Papic truth guard now covers the demo's camera.
- Guest camera (`/papic/guest`): every refusal offers the way back to the event's Event Hub (A4-60); an unread
  block list says "we couldn't check" instead of handing out a camera that refuses every shot (A4-67); unread
  earlier shots say so in My shots (A4-61); "Add from your phone" replaces My shots instead of opening over it
  (A4-63); the "running low" line reads the owner's live `soft_stop_pct` (A4-65); an unread spent count reads
  "Credits: couldn't read", never the full allowance (A4-66).
- Offline: the camera's ✕ finds the saved Event Hub whatever its query, instead of the offline page (A4-70, `sw.js`).
- `/papic/join`: a failed token read says "we couldn't check your link" with Try again, not "isn't active" (A4-71).
- `/papic/claim` · `/papic/seat`: our own error is retryable, never the dead-link screen (A4-54, A4-82).
- `/papic/me`: an unread gallery says "Couldn't read your photos" (A4-74); the story maker says "Couldn't load your
  photos" instead of "no tagged photos yet" (A4-75).
- `/papic/pool`: a failed event read is not a 404 (A4-79); "Load more" keeps its button and says why when a page
  does not come (A4-80).
- `/papic/order` (behind `NEXT_PUBLIC_PAPIC_GUEST_BUY`): an unread payment list says so and holds the log form, so
  the same transfer is never logged twice (A4-78). No amount, fee or rule changes.

Held by `apps/web/lib/papic-guest-doors-say-what-happened.test.ts`, plus updated pins in
`lib/papic-reads-are-honest.test.ts`, `lib/papic-page-says-only-what-is-true.test.ts` and
`lib/papic-pool-balance-is-the-couples.test.ts`.

SPEC IMPACT: None — honest-state and wording fixes under existing rules (CLAUDE.md §5 rule 4; Papic truth guard).
