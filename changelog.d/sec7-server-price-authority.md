## 2026-07-26 · fix(security): SEC-7 — the server resolves every order charge, or there is no sale

**The hole (LIVE in prod until this PR, exploitable by any signed-in account).**
`submitOrderAction` seeded its charge from `formData.get('original_centavos')`
and only OVERWROTE it when a catalog resolver returned a row. Its own comment
said it: *"Only SKUs in NEITHER catalog … keep the client value."*
`resolveServiceSellability` returns `'unknown'` for exactly those keys and
`'unknown'` is deliberately ALLOWED. `SETNAYAN_AI_SUB` is in neither
`platform_retail_catalog_v2` nor `platform_package_catalog`, **and** its branch
skips the `event_members` check because the SKU is eventless — so a POST of
`service_key=SETNAYAN_AI_SUB, original_centavos=1` minted a ₱0.01 order with no
event and no membership. On approval `cyclesFromAmount(0.01, null)` hit
`return 1; // can't divide → grant one cycle` and stamped a **full 28-day AI
subscription**. Repeatable; `extendUserAiSubscription` stacks the windows.

**The rule now enforced (owner-standing).** Nothing the customer can edit may set
a price or unlock a product. No server-resolvable price ⇒ refuse the sale.

- **NEW `lib/order-charge-authority.ts` + `lib/order-charge-math.ts`** — one
  total-or-nothing resolver. `original_centavos` is no longer an input to the
  charge anywhere. Resolvers, in order: retail catalog → AI per-event-type
  ladder → package catalog → `SETNAYAN_AI_SUB` (admin unit × validated cycles) →
  `setnayan_service__{category}` (the booked `event_vendors` deal, re-read
  server-side). Anything else **refuses**.
- **Double-multiplication is now a compile error.** Fixing SEC-7 naively creates
  a **36× overcharge**: `setnayan-ai-subscribe.tsx` already ships `unit × cycles`
  as the displayed price and checkout multiplied by `cycles` again (default
  preset = 6 cycles). The multiply now happens in exactly one place and returns a
  branded `OrderTotalCentavos`; `total * BigInt(n)` is a plain `bigint` that will
  not type-check back into a total. Proven by injection.
- **One-way overcharge tripwire.** Resolving HIGHER than the figure the buyer was
  shown refuses; resolving lower is fine (the vendor-unlocked 3D Plan discount
  does exactly that), and pax totals are exempt because SEC-3 prices them off
  live headcount on purpose.
- **`cyclesFromAmount` returns `null`, not `1`,** when the unit price is
  unknowable. `lib/sku-activation.ts` refuses and raises a Sentry alarm instead
  of granting a cycle.
- **`v2-catalog` splits "no row" from "the read errored"**
  (`resolveRetailChargeCentavos` / `resolveBundleChargeResolution`). The old
  `| null` conflated them, and checkout's null-fallback was the client price —
  so a transient (or *induced*) PostgREST failure on **any** SKU left the
  browser's number standing. Errors now fail CLOSED. The `| null` wrappers stay
  for display callers.
- **Preserved on purpose:** the retirement gate stays a REJECT that runs BEFORE
  the resolvers and never becomes an `is_active` filter inside one —
  `is_active=false` is overloaded (`SETNAYAN_AI_RENEW` = "not independently
  sellable", not "retired"), and filtering inside a resolver would demote
  "retired SKU charged its real price" into "charged whatever the browser sent".

**Test gap closed.** `lib/order-price-authority.test.ts`'s taint trace sliced
object literals after `.insert(` — checkout writes `.insert(insertPayload)`, a
*variable* — so the one module where a client price genuinely reached the DB
contributed **zero** assertions for its entire life. The trace now inlines
variable payloads plus later property writes and follows `let`/reassignment, not
just `const`. Added a **positive** assertion that the stored amount traces to
`resolveOrderChargeCentavos`, so deleting the server resolve fails the test (it
did not before). New `lib/order-charge-authority.test.ts` holds the behaviour:
₱0.01 → refuse, no hardcoded ₱499 fallback, read-error → refuse, 6 cycles is 6×
never 36×.

**Findings worth owner attention:**

- The four keys the old comment named as "legitimately no catalog row" are not
  what it claimed. `save-the-date:<slug>` **does not exist anywhere in the
  codebase** — the real Save-the-Date SKU is `STD_PREMIUM_OPENINGS`, an ordinary
  retail row. `PAPIC_CAMERAS` and `vendor_additional_branch__<uuid>` never route
  through this action at all; they are minted by their own server actions from
  server-computed prices. The comment has been corrected in place.
- A **fifth** key does route here and was undefended: `setnayan_service__{category}`
  (the first-party Setnayan service on the vendor workspace page). It now
  resolves from `event_vendors` server-side. ⚠ Its underlying sources
  (`total_cost_php`, line items) remain **host-writable** — a separate issue,
  documented in the resolver, not fixed here.
- 🚩 **`SETNAYAN_AI_SUB` is now UNBUYABLE** until an admin-managed price row is
  seeded. That is deliberate: there is no hardcoded ₱499 fallback (owner rule
  2026-06-14 "every price is admin-managed · never hardcoded"), the surface is
  flag-gated, and prod has **zero orders ever** for it. Pricing it is a product
  decision, not something a security patch should make. **Owner sign-off needed**
  before seeding `platform_retail_catalog_v2` — and note the 36× trap is only
  disarmed because the multiply is now single-sited.

SPEC IMPACT: `SECURITY_HANDOFF_2026-07-26.md` — SEC-7 moves from 🚨 LIVE to FIXED
(app layer). `DECISION_LOG.md` — new row: server-resolved-or-refuse is the
standing checkout price rule; `SETNAYAN_AI_SUB` is intentionally unpriced and
unbuyable pending an owner-set catalog row.
