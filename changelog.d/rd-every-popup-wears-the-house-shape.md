## 2026-10-22 · fix(home): every popup wears the house rounded shape

The Prices, Download and Suppliers popups — and Sign in, the four demos, and
the /login · /signup · /signup/you cards — drew with square corners: square
card, square "How the tiers stack" box, square Download cards and store
buttons, square fields. Their rules ask for the reskin's radius scale
(`var(--hr-r22)`, `var(--hr-r14)` …), which was declared on `.home-reskin`
only, while they render in `.home-reskin-ov` — a portal (or page wrapper)
outside it. The undefined token made 19 overlay rules compute
`border-radius: 0`, silently. Measured at 375 px before: every `.hr-*` piece
in the four nav popups read `0px`; after: card 22px, Download cards 14px,
store buttons 11px, tiers box 14px, fields 10px.

The scale is now declared once on both roots (`.home-reskin, .home-reskin-ov`)
in `apps/web/app/_components/home/home-reskin.css`, and the popup card takes
the app's own popup token (`--m-r-lg`, ConfirmDialog's `rounded-2xl`).
Remapping the 19 rules onto the six-step `--m-r-*` scale was rejected: the
prototype's pieces are drawn at 2 · 10 · 11 · 12 · 14 · 20 px, so it would
have re-drawn them, and the next overlay rule written against `--hr-r*` would
have gone square again. Guarded by
`apps/web/app/_components/home/every-popup-wears-the-house-shape.test.ts`
(every `--hr-*` token a rule reads is declared on the root that rule renders
under; inline reads are declared on both; the card's radius is ConfirmDialog's
token, declared on `:root`).

SPEC IMPACT: None — restores the approved prototype's shapes and applies the
owner's 2026-10-22 ruling ("popups wear the house rounded shape").
