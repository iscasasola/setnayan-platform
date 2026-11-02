## 2026-07-10 · feat(admin): Ugat Studio — fold the Ugat Console into one tabbed surface

The last of the four studio consolidations. The Ugat Console menu's config pages fold into a tabbed **Ugat Studio** at `/admin/ugat` (replacing the card-hub), 4 tabs: **Menus & icons** (default) · Onboarding · Traditions · AI brain.

- **Taxonomy stays standalone.** `/admin/taxonomy` is already its own `?view=` studio; folding it would collide `?view` with the studio `?tab=` (the add-ons collision lesson), so it remains a separate Ugat sidebar link.
- **No shell-path matchPrefix collision.** Unlike Catalog/Settings (where the shell path *was* a tab's legacy route), `/admin/ugat` ≠ any tab's legacy path, so each folded sidebar row keeps a **normal** matchPrefix on its own legacy path (`/admin/menus` etc.) — none gets `/admin/ugat` (which would steal sibling highlights).

Mutation-surface hygiene (mapped by a 6-agent recon workflow, verified by a 3-auditor adversarial pass):
- **Onboarding flash forwarding** — onboarding is NOT the default tab, so its post-mutation redirects were retargeted to `/admin/ugat?tab=onboarding&saved=1|&error=…` (and the shell forwards `{saved,error}` into the surface); the `/admin/onboarding` redirect stub also forwards them.
- **revalidatePath repoints** → `/admin/ugat` (menus ×1, onboarding ×1, wedding-traditions ×4). **Kept** menus' `revalidateTag(NAV_REGISTRY_TAG)` (platform-wide nav-cache refresh) and onboarding's `revalidatePath('/onboarding/wedding')` (public read path).
- **Brain import trap** — `brain/page.tsx`'s `../_components/kpi-stat-card` is parent-relative to the *shared* `admin/_components`; rewritten to the absolute `@/app/admin/_components/kpi-stat-card` (moving into `_surfaces/` would otherwise mis-resolve to `ugat/_components`).
- Force-dynamic shell + per-tab `<Suspense>` skeletons + `generateMetadata` per-tab titles; the shell gates once with `requireAdmin()` (the menus page had *no* body gate before — the fold hardens it). The one cross-surface inbound link (Settings Studio's Onboarding card) was repointed. Deleted the 2 orphaned redirect-dir `loading.tsx`.

With this, all four remaining flat menus (App Performance, Money×2, Ugat) are consolidated — the admin console is now tabbed studios end to end.

SPEC IMPACT: DECISION_LOG.md row appended (2026-07-10). Internal admin IA only; no product-surface/catalog change.
