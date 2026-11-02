## 2026-07-10 · feat(admin): Money split — Catalog Studio + Settings Studio

Owner: "yes" (continue the studio-consolidation program). The Money menu's 14 flat items collapse to **7** by folding two clusters into tabbed studios (the shipped Accounts/Studio/Insights pattern: page shell + `_surfaces/*` + `?tab=`).

- **Catalog Studio** (`/admin/pricing`, 5 tabs): Pricing (shell/default) · Add-ons · Custom plans · Token bands · Price bands.
- **Settings Studio** (`/admin/settings`, 4 tabs): Settings (shell/default) · Compliance · Notifications · Demo mode.
- **Stays standalone** in the Money menu: Vendor recommendations · Budget Planner · Receipts · Payment methods · My account.

These are **mutation surfaces**, so beyond the mechanical move (bodies → `_surfaces/*`, relative imports → absolute, legacy routes → param-forwarding redirect stubs) the fold handled the sharp edges a recon workflow surfaced:

- **First-tab flash forwarding.** `/admin/pricing` and `/admin/settings` ARE both the shell path AND their first tab's legacy route, so pricing/settings action redirects land on the bare path (no `?tab=`). The shells forward every flash param (`saved`/`skipped`/`error`/`created`/`createError` for pricing; `saved`/`error`/`brand_icon`/`brand_icon_removed`/`loader_saved` for settings) into the surface so success/error banners still render.
- **`?tab=` collision (add-ons).** The add-ons page used its own `?tab=customer|vendor` sub-tab, which the studio `?tab=` would clobber. Collapsed to the Customer catalog (the Vendor sub-tab was V1-dead behind a flag) — removes the collision; kept `?sku=`.
- **revalidatePath repoints.** Sibling-tab actions revalidated their now-redirect-stub path — repointed custom-plans/token-bands/price-bands → `/admin/pricing` and compliance → `/admin/settings` (left compliance's data-sheet revalidate + pricing/settings' own alone). Both shells are `force-dynamic` as a belt-and-braces against staleness.
- **Redirect stubs forward params.** `/admin/addons?sku`, `/admin/custom-plans?vendor`, `/admin/price-bands?recomputed`, `/admin/settings/demo-mode?toggled` are forwarded into the studio tab; the demo-mode toggle API's 303 redirect was repointed to `/admin/settings?tab=demo-mode&toggled=` directly. The notifications mark-read `returnTo` → `/admin/settings?tab=notifications`. The custom-plans vendor-picker `router.push` → the studio tab.
- **Sidebar matchPrefix collision.** The pricing/settings first-tab rows carry NO shell matchPrefix (an exact-equal `/admin/pricing` would steal every sibling's lit-state via longest-match); the other tabs keep/gain a matchPrefix on their legacy path. Mobile Money hub cards + the More bottom-nav umbrella auto-track (they derive from the group / match on pathname).
- **Preserved standalone:** `/admin/addons/pricing-report` (route handler), `/admin/compliance/data-sheet`, `/admin/settings/payment-methods`, `/admin/pricing/[id]/edit`.
- Per-tab `<Suspense>` skeletons (Table/Grid/Form/List, matching each page's old `loading.tsx`) + per-tab `generateMetadata` titles; deleted 3 orphaned redirect-dir `loading.tsx`.

Verified via a recon → build → adversarial-verify workflow; typecheck + lint + production build clean.

SPEC IMPACT: DECISION_LOG.md row appended (2026-07-10) — admin studio-consolidation program continues (Money → Catalog + Settings studios). No product-surface/catalog change; internal admin IA only.
