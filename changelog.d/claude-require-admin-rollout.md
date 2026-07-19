## 2026-07-10 · fix(admin/security): roll the shared requireAdmin gate out to every admin page

Follow-up to PR #2965 (which added `lib/admin/require-admin.ts` and gated the layout + Overview + payments actions). A Next.js layout is not a safe auth boundary — it doesn't re-run on soft navigation / crafted RSC requests — so every admin PAGE that touches `createAdminClient()` (the RLS-bypassing service-role client) must gate itself.

**Pages (58 gated):** `await requireAdmin();` added at the top of every `apps/web/app/admin/**/page.tsx` that calls `createAdminClient` (54), plus the two studio hub pages whose `_surfaces` call it (`/admin/studio`, `/admin/accounts`), plus three pages whose comments *claimed* a gate that didn't exist in code (`budget-planner`, `completions`, `vendors/[vendorProfileId]/edit`). `payment-options/page.tsx` had a real local gate that THREW for non-admins — swapped to the shared helper so non-admins get the contract-correct 404 instead of an error page. The cache()'d gate shares the layout's lookup — zero extra queries per request.

**Server actions (audited, all 53 already gated — no live holes found):** every admin `actions.ts` has an auth check — a local `requireAdmin` duplicate, an inline profile check, or `roles.hasAdminAccess`. 13 files whose local gate was byte-equivalent (modulo whitespace) to the shared `requireAdminAction` contract (login redirect · Forbidden throw · `{ userId }`) were deduped onto the shared helper: approvals · completions · corrections · disputes · force-majeure · fraud · help · integrity-watch · journal-spotlights · repost-watch · reviews · user-reports · vendor-partnerships. The remaining local variants return richer objects (profile fields, roles) or are intentionally stricter (`editorial-review` is `is_internal`-only) and were deliberately left in place.

**Route handlers:** `admin/addons/pricing-report/route.ts` was already self-gated (401/403 JSON) — unchanged.

SPEC IMPACT: None (security hardening; no product-surface or catalog change).
