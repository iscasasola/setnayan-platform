# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-25 · feat(website): Website Pro panels + umbrella unlock in the editor (PR-4)

PR-4 of 5 for the Unified Website Editor — the Pro set is now presented **in place**, where each feature belongs, instead of as a separate band the couple has to reason about.

- **`_components/pro-panels.tsx` (new).** `ProLockPanel` is the locked state of any Pro row: one honest line naming what the row is part of, the full seven-item list, the watermark note, and **one** `Unlock Website Pro · ₱3,500` CTA. Deliberately **no per-feature buy button** — the seven are a single unlock (owner 2026-07-24), so seven purchase affordances would misrepresent the offer.
- **`ColorsPanel`** — the first unlocked Pro panel: two hex fields with live swatches posting to the **same** `updateSiteColors` action the sub-page uses, plus the hidden `return_to` so the couple lands back in the editor. Blank = fall back to the Mood-Board palette, matching the action's own parse. `updateSiteColors` gained `resolveReturnTo` (opt-in, default-identical — the sub-page flow is unchanged).
- **Locked rows expand to the lock panel** — Colors · Background music · Photo gallery · Editorial editing. **Grandfathering is unchanged and still decided server-side** (`lockedIf`, the PR #3664 rule): a couple with existing content keeps editing, and only genuinely-locked rows show the panel. The Save-the-Date row is never blocked — its film is free and its Pro beats are already gated inside the STD studio — so it only carries a hint.
- **Rail CTA became the umbrella sheet** and now **hides once the couple owns Pro**, so an owner's rail isn't nagged.

Still deep-linked when unlocked (deliberate): music, gallery and editorial are R2-upload / long-form flows whose own editors do the job better than a rail panel — the plan's "correctness over completeness" rule. **PR-5** thins the `/website/*` sub-pages to `editor#anchor` redirects. No migration.

SPEC IMPACT: None — presentation of the already-locked Website Pro split; entitlement logic untouched.
