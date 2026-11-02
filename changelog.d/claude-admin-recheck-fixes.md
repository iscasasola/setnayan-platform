## 2026-07-11 · fix(admin): recheck fixes for the consolidated admin console

A fresh 5-lens adversarial recheck of the fully-consolidated admin console (6 tabbed studios + chrome) surfaced 12 verified findings; this fixes 11 (the 12th — a cross-studio container cleanup — is a dedicated follow-up needing visual verification).

**High (functional):**
- **Sidebar row goes dark after a Catalog/Settings save.** The pricing/settings first-tab rows use a query-carrying matchPrefix (`/admin/pricing?tab=pricing`) to avoid stealing sibling highlights — but the pricing/settings *action redirects* landed on the bare path (`?saved=1`, no `tab`), so after any save no row lit and the Money section read collapsed. Fixed by carrying `tab=pricing` / `tab=settings` on every pricing (5) + settings (9) action redirect (the `/admin/settings/payment-methods` redirects left untouched).

**Medium:**
- **`--m-display` is undefined** — the admin Overview KPI/stat numbers (ProgressRing, ActionQueueTile) + every `KpiStatCard` (also used on Taxonomy + AI-brain) styled `fontFamily: 'var(--m-display)'`, a var defined nowhere, so they silently fell back to the body font instead of Saira Condensed. Repointed to `var(--font-condensed), 'Saira Condensed', sans-serif` (the chain the `.m-display` class already uses).

**Low (batch):**
- Added the missing `requireAdmin()` page-gate to 3 admin pages that read the service-role client via a lib helper (so the createAdminClient grep in the rollout missed them): `background-videos`, the `insights` mobile landing, `discount-codes/new`.
- `price-bands` action + the `operations-hiring` alert-email deep-link now target the live studio tab instead of a redirect stub.
- Active-tab pill aligned to `bg-terracotta/10 text-terracotta-700` across the 4 new studios (globals.css documents terracotta = selected-pill role, mulberry = CTA; the 4 had wrongly used the CTA token — now matches the Accounts/Studio reference).
- Added `ugat/loading.tsx` (the only studio missing a shell skeleton).
- Refreshed the Overview intro copy (`System Settings` → `Money`, `Performance` → `App Performance`) to match the renamed sidebar menus.

**Deferred (own PR):** the double page-container — each new-studio surface re-opens the container its shell also provides (doubled padding + the Catalog sticky-save-bar bleed stops short). It's a spacing refactor across 4 shells + ~18 surfaces with per-surface width nuance that needs browser verification.

SPEC IMPACT: None (internal admin fixes).
