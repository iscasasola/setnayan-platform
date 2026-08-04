## 2026-07-27 · fix(ui): collapse template — pin the column track (completes #3799)

#3799 added `min-width:0` to the collapse child. A follow-up 3-agent diagnosis found that
insufficient and incomplete:

- **`min-width:0` on the child may be a NO-OP here.** Every one of these collapse bodies already
  sets `overflow:hidden`, and per CSS Box Sizing a box whose overflow is not `visible` already
  resolves its automatic minimum size to 0 — so `min-width:auto` was already 0. The thing that
  actually inflates is the **implicit `auto` COLUMN TRACK**, which sizes to the child's
  max-content. Fix: `grid-template-columns: minmax(0,1fr)` on the collapse CONTAINER, in every
  engine, regardless of how the UA resolves minimum contributions. `min-width:0` stays as
  belt-and-braces.
- **Two more collapses were missed.** The pattern appears FOUR times in source, not two:
  `dashboard/(launcher)/_components/expandable.tsx` (the shared account-launcher accordion, which
  accepts arbitrary children — a latent trap) and
  `vendor-dashboard/performance/_components/health-composite-card.tsx` (same shape). Both fixed.

Corrections to #3799's stated diagnosis, recorded so the next reader isn't misled:
- The LEGACY `plan-budget-accordion.tsx` (`.leaf`/`.leafbody`) does **NOT** have this defect — its
  bodies are conditionally UNMOUNTED and animate via a keyframe, so there is no grid track to
  inflate. The live surface is the bench (`isBudgetBuildEnabled()` is ON unless env is literally
  `'false'`).
- `.slcat .fold`, `.fold-body` and `.cat-body` all carry `overflow:hidden`, and there is **no**
  `overflow-x:hidden` anywhere in `apps/web`. An inflated rail is therefore CLIPPED — the symptom
  is "content cut off / the carousel won't swipe", **not** a sideways-scrolling document. If a
  sideways-scrolling PAGE is observed, that is a separate defect outside these clipped containers
  and needs a live measurement to locate.

SPEC IMPACT: None
