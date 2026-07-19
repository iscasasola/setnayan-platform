## 2026-07-11 · fix(admin): de-duplicate the double page-container in the 4 new studios

The Insights/Catalog/Settings/Ugat studio shells wrap the active surface in a `mx-auto w-full max-w-6xl … px-4 py-8 sm:px-6 lg:px-8` container, but each extracted `_surfaces/*.tsx` re-opened an identical container — doubling horizontal + vertical padding on every studio tab, and stopping the Catalog pricing-surface's sticky "Save all changes" bar (which bleeds via `-mx-4 sm:-mx-6 lg:-mx-8`) short of the viewport edge because it only cancelled one padding layer.

Fixed to match the Accounts/Studio reference (shell owns the container, surfaces return bare content). 17 surfaces de-duplicated:
- **8 full-width surfaces** (max-w-6xl, same as the shell) → bare `<div>`: funnels · growth · intelligence · overview (kept its `id="apx-root"`) · addons · custom-plans · pricing · brain. The pricing sticky-save-bar bleed now reaches the content-column edge (it cancels the shell's px instead of an inner one).
- **9 intentionally-narrower surfaces** → kept their own `mx-auto max-w-*` (and `space-y-*`) but dropped the redundant `px-4 py-* sm:px-6 lg:px-8` the shell already provides: seo (4xl) · price-bands (5xl) · token-bands (4xl) · settings (3xl) · demo-mode (3xl) · notifications (3xl) · menus (4xl) · onboarding (3xl) · wedding-traditions (`<section>` 4xl).
- **Left untouched** (no redundant page container): `compliance` (already `mx-auto max-w-4xl` with no px/py), `connection-logs` (renders its client directly), `offline` / `operations` (bare `space-y-6`, no max-w wrapper).

The tab strip lives in the shell (constant width); only per-tab content width varies, which is intended (narrow config forms stay narrow).

Verification: typecheck clean · production build passes. NOTE: a pixel-level visual pass requires an authenticated admin session (the studio routes are admin-gated), which isn't available in this environment — the fix is verified structurally (shell-owns-container math + no residual `px-4 py-*` page wrapper in any surface) and by the build. Worth an eyeball on the deployed preview, especially the Catalog Pricing sticky bar.

SPEC IMPACT: None (cosmetic spacing fix).
