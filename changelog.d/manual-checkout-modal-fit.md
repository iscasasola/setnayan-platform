## 2026-07-21 · fix(styles): Tailwind scans `components/**` + ManualCheckoutModal fits the viewport

Follow-up to PR #3446 (checkout sheets → `dvh`). Started as "is
`components/billing/ManualCheckoutModal.tsx` dead code?" and turned up a
config gap underneath it.

**The config gap.** `apps/web/tailwind.config.ts` scanned only
`./app/**` and `./lib/**`. `apps/web/components/**` — a second top-level
component root created by owner directive 2026-05-28 — was never scanned, so
any utility used ONLY under `components/**` was silently never generated.

It looked fine because the heavily-used files there (`skeletons` · 162
imports, `sd-loader` · 59) happen to share every class with some `app/**`
file. Two exceptions, both live today: `w-1/4` and `w-4/5` in
`components/skeletons/index.tsx` (lines 129, 276) never generated, so those
two skeleton bars render full-width instead of 25% / 80%. This fix restores
the intended widths — the only visible change to shipped UI.

`ManualCheckoutModal` shares nothing, so it rendered *completely* unstyled:
no dark theme, no gradient, no height cap. Verified in-browser before and
after (mounted on a throwaway route at 375×812, deleted before commit).

**The modal.** Kept, not deleted, despite having no importer: it's the client
half of the deliberately-parked manual-QR gateway. `/api/v1/billing/initialize-maya`
still exists, is registered in `lib/routes.ts` + `lib/public-api-flag.ts`, and
its Branch A returns the `MANUAL_QR_OVERLAY` payload this modal consumes —
gated on `NEXT_PUBLIC_MAYA_STATUS`. Parked pending KYC, not decayed. Applied
the PR #3446 pattern instead: `h-[100dvh]` overlay, `max-h-[90dvh]` panel with
`flex-col`, `flex-1 overflow-y-auto` body, `shrink-0` header/footer, and
`pb-[max(1rem,env(safe-area-inset-bottom))]` on the footer. Measured after:
panel 731px in an 812px viewport, footer fully on-screen, body scrolls.

SPEC IMPACT: None — presentation layer only. No SKU / pricing / flow change.
