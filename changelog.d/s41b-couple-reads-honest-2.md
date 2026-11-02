## 2026-09-19 · fix(guest-site): a guest's privacy switches say "couldn't check" instead of stating a setting (S41b · couple 2)

COUPLE-FACING tier of `result-dropped-silently` (S26 baseline, #5625), batch 2 —
the event site a guest opens. 18 sites, all option (a): join the missing end.

On screen:

- **FaceBlock** — a refused read printed "Your face can appear on the screens at
  the venue." to a guest who may have blurred herself. It now says it could not
  check; the button still offers the protective action (blur ON), now through
  `faceBlockTarget`, so `null` can never bind "show my face again".
- **Scan trail** — a refused read printed "We keep a record of when you open your
  invitation…" to a guest who may have opted out. Same treatment:
  `scanOptOutTarget(null)` offers "stop keeping a record".

Reason kept, behaviour unchanged (already honest or draws nothing on a read-only
line): find-my-table ×3 (already says "try again"), seat pass ×2 (already
`SeatCouldNotLoad`), hub arrival, back cover, previous edition ×3, supplier desk
brief, save-vendor upsert (already redirects `?save=error`), consent veto ×3
(already fails closed), face receipt dates.

`a-guest-can-decline-the-scan-trail.test.ts` pinned the wiring as `!optedOut`; it
now pins `scanOptOutTarget(optedOut)` plus the helper's body, and the helper's
truth table is executed.

Proof: `lib/guest-privacy-reads-are-honest.test.ts` executes both notices against
a refusing client (5/5); sabotages — sentence guard off, opt-out read back to
`false`, either target helper narrowed to `current === false` — each turn one red.

SPEC IMPACT: None
