## 2026-10-02 · fix(entitlements): a Pro purchase unlocks the EVENT — every host page reads it through one resolver

Owner rule (DECISION_LOG 2026-10-02, "A PRO PURCHASE UNLOCKS THE EVENT, NOT THE PERSON WHO PAID"):
every Pro / paid-service check asks "does THIS EVENT hold it?". `orders` RLS is purchaser-scoped,
so ~25 host pages and 4 server checks that read entitlements through the signed-in user's own
session showed a co-host "not owned" for what the event had paid for (the Live Studio control
pages said "no route" while the server gate would have handed over the channel).

- New: `lib/event-entitlement-client.server.ts` → `eventEntitlementClient(eventId)` (server-only,
  `cache()`d): the service client, handed out only after the viewer is confirmed as a host of
  THAT event (couple / coordinator member, or an accepted, non-removed moderator — the union of
  the existing host gates). Decision half in `lib/event-entitlement-client.ts`.
- Every host-facing entitlement read under `app/dashboard/[eventId]` and
  `app/panood/control/[eventId]` passes that client to the reader it already called
  (`eventSkuActive`, `resolveAddOnState`, `eventCoupleWebsiteProActive`, `resolvePanoodTier`, …).
  No reader changed; no new server action; no schema.
- Guard: `lib/pro-unlocks-the-event.test.ts` — co-host B sees Pro for host A's order, page and
  server agree, a non-host is refused; plus a scan that fails if a host surface hands an
  entitlement reader anything but the resolver's client.
- Small: `lib/legacy-redirects.ts` docblock no longer claims a `what-to-bring` pair; the supplier
  custom-plan composer and the admin Action Center name the OPEN receiving accounts
  (`receivingAccountsPhrase`) instead of a typed "BDO or GCash".

SPEC IMPACT: None
