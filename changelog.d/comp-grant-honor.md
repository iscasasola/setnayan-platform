## 2026-06-29 · fix(entitlements): comp grants now actually unlock in-app features

The `/admin/users` "Issue a comp grant" form wrote a `comp_grants` row (scope
`all_services` or `specific_skus`), but NOTHING read it — every couple-SKU
feature gate funnels through `lib/entitlements.ts` (`eventSkuActive` /
`eventOwnsSku` / `eventActiveSkus`), and those only queried `orders`. So an
admin could gift "Every Setnayan service" and the recipient got zero free
access. This wires the read side so a comp grant confers the access it promises.

- New migration `…_comp_grant_entitlement_functions.sql` — two STABLE
  `SECURITY DEFINER` fns: `event_has_comp_for_sku(event, sku)` (per-SKU gate)
  and `event_comp_active_skus(event)` (batch grid union; `all_services` → the
  full live `platform_retail_catalog_v2`, `specific_skus` → just the listed
  codes). They resolve the event's HOST users (couple member OR accepted
  primary-host moderator, mirroring `resolvePrimaryHostEvent`) then check THEIR
  active (non-revoked, non-expired) grants.
- WHY definer, not an app query: the gates routinely run under the service-role
  admin client (the Studio hub passes `createAdminClient()`), so a bare
  `comp_grants.eq(scope,'all_services')` read would see EVERY grant in the DB
  and unlock all paid features for EVERY couple the instant one grant exists —
  the exact flaw in the never-merged `owner-all-services-grant` branch's
  `hasAllServicesGrant()`. Host-scoping server-side makes it correct under any
  client and leak-proof across accounts (verified on prod: a grant on event A
  returns false for event B).
- `lib/entitlements.ts` — new `eventHasCompGrant()` / `eventCompActiveSkus()`
  helpers (graceful-degrade to false/[] on any RPC error, incl. pre-migration
  PGRST202) OR'd into `eventOwnsSku`, `eventSkuActive`, and unioned into the
  batch `eventActiveSkus`. `lib/indoor-blueprint.ts` (the one bare gate) also
  honors comps.
- Tests: `entitlements.test.ts` +4 comp cases; `seat-pass.test.ts` +
  `entitlements.test.ts` stubs learn `.rpc()`. 717/717 unit pass, typecheck +
  entitlement-gate lint clean. Both scopes + cross-account isolation smoke-
  tested on prod, then the test grant removed (0 grants remain).

SPEC IMPACT: None — read-side wiring of an already-shipped admin surface +
already-shipped `comp_grants` schema. No new schema/SKU/pricing/flow; the
`issueCompGrant` form and `comp_grants` table are unchanged.
