## 2026-07-25 · fix(ui): migrate 4 new masthead-lint offenders to <PageMasthead> + lock in launch page

`node apps/web/scripts/lint-page-masthead.mjs` had gone red on four pages that landed after the
ratchet was set: `dashboard/[eventId]/studio/live-studio-roam/setup`,
`dashboard/[eventId]/website/colors`, `vendor-dashboard/booking-fees` and
`vendor-dashboard/booking-fees/[orderId]`. Each hand-rolled the drifted shape — an `.sn-eye`
eyebrow inside a `<header>` — instead of using the single shared masthead.

All four now render `<PageMasthead>` from `@/app/_components/page-masthead`. Purely mechanical:
titles, ledes and every interactive control in the old header are preserved. Per the component's
locked design the eyebrow line is dropped, not relocated ("Roam controller", "Site colours",
"Billing", "Booking fee <public_id>") — 24px of layout for 10.5px of type that repeats what the
nav already says. Two component props get their first use in the codebase: `actions` (the
booking-fee status pill, which was the old header's right-aligned sibling) and `titleNode` (the
booking-fee title composes the reference code at runtime). The colours page folds its in-header
"Back to website" text link into the masthead's `back`/`backLabel` chevron; the three pages whose
back link already sat outside the header keep it exactly where it was. The Roam h1's decorative
`<Video>` icon is dropped — the masthead is a one-row `[chevron] + title (+ actions)` block, and a
28px glyph next to the new 22px phone title is chrome, not identity.

Baseline shrinks by one more: `app/dashboard/[eventId]/website/launch/page.tsx` became a redirect
stub when the Launch surface merged into the unified website editor (#3669), so it no longer
hand-rolls anything — its line is removed from `apps/web/scripts/page-masthead-baseline.json` to
lock the win in. Baseline is now 114 files; nothing was added to it.

SPEC IMPACT: None
