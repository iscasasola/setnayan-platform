## 2026-07-15 · feat(design): event core sections re-expression — Vendors + Budget + Checklist (Glass PR-3b)

The second half of Glass PR-3 (rollout plan §3.1 "Top sections" + §5). Applies the
§4 coherence contract to the remaining three event core sections, consuming the
kit landed by PR-1 (#3251) + PR-2 (#3256). Every data source, server action,
route, copy-fact and feature flag unchanged — real data or nothing. (Guests +
Schedule shipped as PR-3a.)

- **Checklist.** Header → `.sn-eye` + `.sn-h1`; progress meter → `sn-bar`
  success fill; phase rows → `.sn-row` (done rows muted, no blur); due dates →
  Space Mono; VendorProgress panel → glass tile; date-hint / leaf-suggestion /
  empty-state cards → glass rows. Owner-built phase-grouped composition intact.
- **Budget.** Header → `.sn-eye` + `.sn-h1`; the two `font-display` serif section
  heads → `.sn-sec` (Hanken w800); BudgetSummaryStrip + budget-setter +
  budget-live-summary + allocation-planner header/sticky-bar → glass panels;
  every `font-display` ₱ numeral (summary stats, live %, planner totals/cushion,
  leaf amounts) → Space Mono; payment-progress + leaf bars → `sn-bar` gold;
  TiltEditor modal → `.sn-modal-panel` + `sn-pop-in`; opaque `bg-cream`/`bg-white`
  panels + empty states → glass / `.sn-row`. Allocation engine + tilt logic
  untouched.
- **Vendors (Merkado).** The header, category-progress and vendor-row surfaces
  live INSIDE owner-locked Merkado components (services-takeover /
  plan-budget-accordion / shortlist-categories / waiting-for-quotes) which carry
  their OWN scoped gold/mono/serif design system and are protected by the
  "compositions stay" invariant — left untouched. The only page-composed chrome
  on the migrating `bg-cream`/`text-terracotta` tokens, the Summary tab's
  Setnayan-AI toggle, → glass row. (Deviation surfaced in the PR body.)

`m-serif`/`font-display` retired on these dashboard pages; numerals → Space Mono;
warm semantics only; blur budget honored (rows never blurred, one glass layer
deep); reduced-motion via the global freeze. typecheck + lint + lint:radius +
local prod build pass.

SPEC IMPACT: None (design re-expression only; plan §3.1/§5 PR-3).
