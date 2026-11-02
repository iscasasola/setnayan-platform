## 2026-09-18 · fix(card-maker): on a laptop the card stays beside the question for every edit, not only the first pass (SUP-10)

Measured first: the laptop two-column layout already shipped for the **guided first pass** (S4, 2026-08-28, `.sn-canvas-pass-pin` in `globals.css`). The card pins beside the rail at 420px and the question is a 400px column on the right, with at least 108px between them at every width from 1024px (rail 72px up to 1279px, 240px from 1280px). The register sweep called this row open because it searched for `grid-cols`, which is the wrong mechanism.

What was actually missing: **every edit after the pass** opened as a centered bottom sheet with a dark veil over the card. Those edits apply to the card live (the sheet's confirm button "changes nothing"), so on a laptop the supplier could not see the card they were changing. The S4 plan's reason for leaving edits out ("nothing is being built behind those") was false.
- `canvas-maker.tsx`: one flag, `cardBeside = inPass || sheet !== null`, drives the pin, the trailing-content hide, and a new `asideAtLg` on the health meter (the pinned card would otherwise paint over it).
- `CanvasSheet`: the laptop column classes apply to every sheet. The non-guided veil becomes transparent at `lg:` only.
- **The phone is unchanged:** every added class is `lg:`-prefixed, and the pin/hide rules still exist only inside `@media (min-width: 1024px)`.
- `laptop-gets-two-columns.test.ts`: rule 2 now pins "whenever a question is open" instead of "pass only". New tests check that the column is all `lg:`, that the phone heights and veil are unchanged, and that the meter steps aside. Sabotaging the column, the pin condition, or the laptop veil each turns it red.

SPEC IMPACT: None in the corpus. This reverses the S4 session plan's line "an ordinary edit stays a bottom sheet at every width" (`WHATS_NEXT_Service_Card_SESSION_PROMPTS_2026-08-28.md`), which was a session's plan and not an owner ruling (no DECISION_LOG row). Flagged in the PR.
