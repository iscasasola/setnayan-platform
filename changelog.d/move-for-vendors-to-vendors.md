# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-05 · chore(marketing): move /for-vendors → /vendors

Renamed the vendor **benefits** marketing page route from `/for-vendors` to `/vendors` (owner routing change). Front-end/routing only — no payment/checkout/entitlement/DB/migration changes, and no page content or design changes.

- **Route folder moved**: `apps/web/app/for-vendors/` → `apps/web/app/vendors/` (whole folder incl. `_components/` + motion files) via `git mv`; relative `./_components/*` imports unchanged. Component filenames (`for-vendors-deep-dive.tsx`, `for-vendors-motion.tsx`) left as-is — private to the folder, no external refs.
- **Permanent redirect (308)** added in `next.config.ts` `redirects()`: exact `/for-vendors` → `/vendors` (`permanent: true`). Exact source only so the static hero art under `public/for-vendors/*.avif` keeps serving.
- **Middleware**: bare `/vendors` is now EXCLUDED from the legacy `/vendors/* → /explore` marketplace redirect (only subpaths `startsWith('/vendors/')` still redirect), so the benefits page renders at `/vendors`. Native-shell marketing-skip set updated `/for-vendors` → `/vendors`.
- **Inbound links + non-link refs repointed** (`/for-vendors` → `/vendors`): footer "For vendors" (`reskin-footer.tsx`), Vendors popup line-link (`HomeOverlays.tsx`), `/pricing`, `/explore`, `/how-it-works` (+ `tl/` twin), `/features`, `/waitlist`, `/signup`, `/open-shop`, `/v/[slug]`, `admin/pricing` (page + `revalidatePath` in actions), `robots.ts`, `sitemap-static.xml`, `public/llms.txt`, `lib/routes.ts` (`forVendors()`), `lib/site-widgets.ts` (url), `lib/nav-registry-defaults.ts` (route values; stable `key`s kept), `_fixtures.ts`, `brand-marks.tsx`, `vendor-benefits.ts`, `site-chrome.tsx`, keynote demo slides, plus doc/comment refs.
- **Reserved-slug hardening**: `'vendors'` added to `lib/reserved-slugs.ts` and `public/sw.js` reserved sets (bare `/vendors` is now a real route); `'for-vendors'` kept reserved (redirect source).
- **Left unchanged (owner)**: footer "Vendors" (Explore column) → `/explore` stays the couples' browse-vendors marketplace. Static asset URLs `public/for-vendors/*.avif` kept (referenced by two `src=` in the moved page; not the page route). Stable registry keys (`for_vendors` widget-page id, `public.site-nav.for-vendors` nav key) kept.

SPEC IMPACT: URL change — the vendor benefits page canonical URL is now `https://www.setnayan.com/vendors` (was `/for-vendors`); the old path 308-redirects permanently. No pricing/SKU/schema change. `public/llms.txt` and `sitemap-static.xml` updated to the new URL.
