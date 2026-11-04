## 2026-11-03 · fix(guests): a filtered, grouped list folds again

Owner, 3 Nov, verbatim: "when using filter and picking on show and group by and the rest of the choices, i cannot
collapse the search results group." Root cause: `isOpen` in `guests-screen.tsx` answered `true` for every heading
while a search or a Show / +1 filter was on (G19 — hits must not hide in a folded heading). The header tap wrote
`open`, which that path never read, and a search returned early (`if (q) return`) — so the tap and ⇕ Collapse all
did nothing.

- New `guests/_components/section-fold.ts`: a narrowed list keeps its own folds, scoped to that narrowing (search
  words + Show + +1 + Group by). Every hit still arrives open; a tap folds and unfolds it; ⇕ works; a new
  narrowing opens every hit again; the whole list's own open headings are untouched.
- Header tap, ⇕ and the ↗ jump now go through one `foldSections`.
- 🔒 `a-filtered-group-folds.test.ts` (5 checks); `sections-pop-then-unfold.test.ts` and `lib/guest-section-head.test.ts` re-anchored to `foldSections` (each sabotage-tested red).
- Measured in `/dev/guests-lab?part=screen` at 390 px, Show = Attending + Group by = Side: before, a header tap left
  `data-open` unchanged and ⇕ stayed "Collapse all"; after, the tap folds and re-opens, ⇕ folds all three headings.

- ⚖ The Maker's first-load ceiling is raised 507.5 → 508 KB (owner, 4 Nov: "raise the Maker limit 0.5 KB"):
  main sat at exactly 507.5 KB, and this PR plus the Show & sort sheet (#7223) together read ~507.6 KB, because the Maker
  draws the guest list. Reason and numbers are in `scripts/check-maker-js-budget.mjs`.

SPEC IMPACT: DECISION_LOG row needed — "MAKER FIRST-LOAD BUDGET RAISED TO 508 KB" (owner 2026-11-04). The corpus is not
in this cloud session; for the controller to apply.
