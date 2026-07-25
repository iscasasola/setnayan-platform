## 2026-07-15 · chore(routes): delete dead bundle route; resolve concierge route

Actioned the two dead-route findings from the 2026-07-15 route-wayfinding audit
(`Route_Wayfinding_Audit_2026-07-15.md` in the spec corpus), each re-verified against
current `origin/main` before touching anything.

**1. `/dashboard/[eventId]/studio/bundle` — DELETED (confirmed dead).**
The page permanently returned `notFound()` since the Essentials/Complete bundles were
retired 2026-06-29. Verified the whole path was dead: `fetchV2BundleCatalog()` filters
`is_active=true`, both `GUIDED_PACK`/`MEDIA_PACK` are `is_active=false`, so it returns `[]`
→ the onboarding `bundleVM()` builder resolves `null` for both → `pricing.bundles.{essentials,
complete}` are both `null` → the goToDashboard `studio/bundle?code=` routing branch and the
inert bundle-offer onboarding screen (filtered out of the flow since 2026-06-29) never fire.
Removed:
- the route (`app/dashboard/[eventId]/studio/bundle/page.tsx`);
- the dead bundle path in `onboarding-shell.tsx` — the `goToDashboard` `bundleVM` branch, the
  `bundleOverride` param on `handleFinish` (+ its one `undefined`-passing caller), the inert
  `screen-bundle` section + its `card()` helper + `selectedBundle` reads/writes, `'bundle'`
  from `FLOW_IDS`/`PAYWALL_SCREENS`/the sequence filter, the now-unused `OnboardingBundleVM`
  import and the stale `pricing` useCallback dep;
- `selectedBundle` from onboarding `types.ts` (state field + default);
- the stranded `routes.dashboard.addOns.bundle` helper (zero callers, pointed at the 404).

KEPT deliberately: `onboarding-pricing.ts`'s `BUNDLE_MEMBERS` / `bundleVM` builder /
`pricing.bundles` field and `fetchV2BundleCatalog`. `BUNDLE_MEMBERS` is cross-checked by the
`lint-entitlement-gates.mjs` CI guard against `entitlements.ts` `BUNDLE_CHILD_SKUS`, which
still grants child SKUs for already-purchased historical bundle orders (`sku-activation.ts` /
`checkout/actions.ts`). Removing it would break CI + historical-order activation — out of
scope for a dead-route cleanup.

**2. `/dashboard/(account)/profile/concierge` — KEPT (not dead; rubric branch b).**
The route body is NOT dead code — it is the live "Settings → Setnayan AI tab": it renders
per-event Setnayan AI status + a `/pricing` CTA, and it backs four live consumers — the admin
concierge-abuse queue's notification `relatedUrl`s (`admin/concierge-abuse/actions.ts` L93,
L245), `sku-activation.ts`'s `activateConcierge` import from its `actions.ts`, the `routes.ts`
`concierge()` helper, and the (flag-gated) profile entry link. Deleting it would break the
admin abuse queue and the activation path. So per the audit rubric it stays; instead the flag
machinery was made honest + coherent:
- rewrote the `CONCIERGE_ENABLED` comment (`lib/concierge.ts`) — it wrongly framed a permanent
  retirement as a temporary kill-switch ("flip to re-light Concierge") and misdescribed the
  panel as "Temporarily unavailable" (it actually renders "Setnayan AI · see pricing"). Now
  documents: permanently false (Concierge retired; ₱499 Setnayan AI is the successor), what it
  still gates, and why the route resolves politely rather than 404s;
- refreshed the route's header comment + the flag-off branch comment to state plainly that
  this is a live surface kept in the cleanup, that `CONCIERGE_ENABLED` is permanent, and that
  the `true` branch (V1 trial/expiry reading legacy `concierge_*` columns) is a dormant
  tombstone pending the V2 schema migration.
Left the flag-gated profile link's visibility unchanged (surfacing whether to un-gate it is an
owner/UX call, and Setnayan AI placement is being reworked by the home/launcher streams).

SPEC IMPACT: None. Implements the two dead-route findings from
`Route_Wayfinding_Audit_2026-07-15.md`; no product decisions, prices, SKUs, or schema changed.
The audit doc is the corpus record; no further corpus edit required.
