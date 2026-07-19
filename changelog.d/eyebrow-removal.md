## 2026-07-02 · chore(ui): remove eyebrow/section-label kickers site-wide

Owner request ("remove all of these on all pages · we do not want these"): drop
the small uppercase, letter-spaced "eyebrow" kicker that sat above page `<h1>`s
and grouped in-page card sections (e.g. "VENDOR · MY PERFORMANCE" over "My
Performance", "OVERVIEW"/"YOUR BUSINESS" section dividers). 69 files across
marketing, tour, pricing, help, explore, vendor-dashboard, admin, and
couple-dashboard/studio surfaces. The `<h1>`/`<h2>` titles and subtitles stay —
only the decorative kicker line is removed.

Three high-leverage single-point fixes (each removes the kicker from many
surfaces at once):

- `_components/app-store/layout.tsx` — dropped `hero.eyebrow` (removed the prop),
  clearing it from every `/app-store/*` add-on detail page (Papic, Panood,
  Patiktok, LED, monogram, …).
- `_components/legal/legal-chrome.tsx` — `LegalLayout` no longer renders/accepts
  `eyebrow`, clearing terms/privacy/refunds/cookies/acceptable-use in one edit.
- `features/_sections/_*.tsx` (8 files) — removed the shared `{c.eyebrow}` render
  from Hero + 7 section headers on `/features`.

The rest are per-page inline `<p class="font-mono … uppercase tracking-[…]">`
deletions. Now-dead icon imports removed alongside (Sparkles, Clock, Zap,
HelpCircle, Store, categoryLabel, ReactNode, Rocket). Where a kicker shared a
flex row with a locale-switch/close/count control, the row was re-justified to
`justify-end` so the remaining control keeps its place.

Deliberately NOT touched: the wedding onboarding quiz
(`onboarding/wedding/_components/onboarding-shell.tsx`, ~20+ `.eyebrow` usages) —
it's under the locked "no-scroll ≈665px" onboarding budget, so removing those
lines risks breaking the per-screen pixel math. Flagged for a separate,
budget-aware review rather than swept blind.

Verified: `tsc --noEmit` clean, `next lint` clean (0 errors; one pre-existing
`aria-disabled` a11y warning in `tour/page.tsx` predates this change), production
`next build` green.

SPEC IMPACT: None — decorative header-copy removal, no schema/SKU/pricing/flow change.
