## 2026-07-11 · fix(launcher): stop passing a Lucide icon component across the RSC boundary

The `/dashboard` launcher crashed to the global error boundary for any vendor
whose shop has a `logo_url` set. `SpaceCard` (Server Component) passed
`fallbackIcon={Icon}` — a Lucide `forwardRef` object — into the `'use client'`
`ShopLogo`, which React rejects: *"Functions cannot be passed directly to Client
Components."* Sentry `JAVASCRIPT-NEXTJS-3`, 30 occurrences since 2026-06-09,
culprit `/dashboard`, last seen 2026-07-11.

Fix: `ShopLogo` now takes a pre-rendered `fallback: ReactNode` instead of a
component function, and the caller passes `fallback={<Icon … />}`. A rendered
React element serializes across the server→client boundary; the component
function did not.

SPEC IMPACT: None.
