## 2026-07-02 · feat(marketing): Setnayan AI in the top nav + two-tier pricing display

Owner 2026-07-02 — surface Setnayan AI on the public site.

- **Top nav** (`app/_components/marketing/site-nav.tsx` + `lib/nav-registry-defaults.ts`): adds a
  "Setnayan AI" link (second, after Explore) → `/setnayan-ai` (the existing price-free product
  explainer). Registered as `public.site-nav.setnayan-ai` so an admin can rename/hide it from
  `/admin/menus`; the mobile menu inherits it automatically. Nav-icon-source lint passes.
- **`/pricing`** (`app/pricing/page.tsx`): the Setnayan AI card now shows the owner-locked
  two-tier model — the ₱499 first-28-days headline (catalog-driven, unchanged) plus a new
  "First 28 days — then ₱799 / 28 days after" line. The ₱799 reads from the `SETNAYAN_AI_RENEW`
  catalog row (a resilient direct read, since that row is dormant/`is_active=false`; ₱799 is a
  fallback only if the row is unreadable — never a new hardcode). Also de-hardcodes the old
  "A ₱499 / 28-day subscription" prose.

⚠ Note: this publishes the ₱799 renewal ahead of its billing enforcement (the per-event pricing
flag is still OFF; checkout charges the flat ₱499 today). The gap is couple-favorable and
harmless, but flagged — the copy is the decided model, the enforcement flips at go-live.

SPEC IMPACT: None new — per-event ₱499/₱799 pricing already recorded (DECISION_LOG 2026-07-02).
