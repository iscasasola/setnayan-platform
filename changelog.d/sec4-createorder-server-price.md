## 2026-07-26 · fix(security): resolve order price server-side, never from the client

**SEC-4** (found during the 2026-07-26 security work, deferred out of PR #3728).
`createOrder` in `app/dashboard/[eventId]/orders/actions.ts` read its charge straight
off the submitted form — `formData.get('requested_total_php')` → `Number()` →
`requested_total_php` — with **no catalog resolve, no `resolveServiceSellability`
gate, no floor**. Its UI entry point `/orders/new` has been a bare `redirect()`
since 2026-05-29, but a `'use server'` export stays POST-able by its action id
whether or not any UI references it, and that module reaches the client graph via
`cancelOrder` + `logPayment`. So any authenticated event member could mint an order
for **any `service_key` at any amount** (₱1 against a ₱2,999 SKU), pay that ₱1 for
real, and hand `/admin/payments` a receipt that matched — the queue would show ₱1 as
the order's own asking price, so nothing looked wrong. Approval then ran
`activateOrderSku` and provisioned the SKU.

**Fix chosen: DELETE the export, not repair it** — it had zero callers.
Enumerated before removing: no `import` of `createOrder` anywhere in `app/`, `lib/`,
`api/`, `tests/`, `scripts/` or `.github/`; the only textual hits were comments and
`CHANGELOG`/`changelog.d` history, plus an unrelated boolean field of the same name
on `lib/booking-fee-lock.ts`'s decision object. `/orders/new` redirects. The
`SelfPurchaseConfirm` component that injected `self_purchase_action` was itself
orphaned in the same 2026-05-29 change (no importers) and is deleted here too.
`cancelOrder` + `logPayment` stay — `orders/[orderId]/page.tsx` uses both.

Repairing it would have meant a second copy of the pricing rule living next to
`submitOrderAction`'s. Deleting the surface is strictly stronger and leaves one
source of truth.

- Deleted `createOrder` + its private `createSelfCompOrder` helper (~400 lines) and
  the imports only they used (`activateOrderSku`, `sendEmail`, `fetchPlatformSettings`,
  `notifyAdminsOrderAwaitingReconciliation`, `decideSelfCompAuthority`,
  `generateReferenceCode`). Replaced by a tombstone comment that quotes the defect,
  says why deletion beat repair, and points self-comp's revival at the checkout path.
- Deleted `app/dashboard/[eventId]/orders/_components/self-purchase-confirm.tsx`.
- Corrected the stale note in `orders/new/page.tsx` that advertised "vendors needing
  self-comp can use the legacy createOrder server action directly via admin tooling."
  No such tooling was ever built; the note was an invitation to re-open the hole.
- **Untouched on purpose:** `app/admin/custom-plans/actions.ts` mints bespoke-amount
  orders deliberately — `assertAdmin()`-gated, service-role write. "An admin sets a
  negotiated price" is a different thing from "the browser sets its own price"; only
  the second is this bug. A new test pins that gate so it cannot quietly become the
  first thing.

**Tests** — new `lib/order-price-authority.test.ts` (8 cases), which does more than
guard the deletion: it enumerates **every** module that inserts into `orders` (11 of
them) with a written note on where its amount comes from, so a new minter goes RED
instead of sneaking in; and it taint-traces each `requested_total_php` back through
`const` bindings to see whether it originates in a **money-shaped** `formData` key
(`/price|amount|total|centavos|php|fee|cost/i`). That distinction is the point — the
browser may choose *what* and *how many* (Papic camera counts, the vendor Custom
configurator), the server decides the peso figure. Admin-gated modules are exempt by
design, and the exemption keys off a literal `assertAdmin(`, so removing the gate
un-exempts the file. It also re-pins checkout's ordering invariant (sellability
reject BEFORE the charge resolvers, both `'retired'` and `'error'` failing closed).

**Neutralisation proof** — restoring `createOrder` from `origin/main` turns 5 of the
8 red, including the taint test, which traces
`requested_total_php: requestedTotalPhp` → `Math.round(amount * 100) / 100` →
`Number(requestedRaw)` → `formData.get('requested_total_php')`. Separately, moving
checkout's sellability gate to run after `resolvePaxPricedOrderCentavos` turns the
ordering test red on its own. Both restored; suite green (8/8), `lib/**` + `app/**`
unit suites green, typecheck + lint clean. No DB test — this change is a deletion,
so the enforcing instrument is a source invariant, not RLS.

**⏭ Deferred, filed separately — the same hole exists one layer down.** `orders`
INSERT is reachable directly over PostgREST: `orders_owner_write` is
`WITH CHECK (user_id = auth.uid())` with no amount guard, and
`guard_orders_protected_columns` (migration `20270226279630`) is BEFORE **UPDATE**
only, so an authenticated user can `POST /rest/v1/orders` at `status='submitted'`
with any `service_key` and any `requested_total_php` — no server action involved.
Not fixed here because the safe fix is not small: it means revoking `INSERT` on
`orders` from `authenticated` and routing **eight** currently session-role minters
(checkout, papic ×3, photo-challenge, booth/AI add-ons, custom, team, deep-search,
branches) through service-role. A DB trigger re-deriving the price in SQL is the
wrong shape and actively dangerous: `resolvePaxPricedOrderCentavos` spans two
catalogs plus a pax curve plus per-event-type AI pricing plus cycle multiplication,
and `is_active=false` is overloaded — on `SETNAYAN_AI_RENEW` it means "not
independently sellable", not "retired", so a naive "reject inactive SKUs" trigger
would break every renewal. That is a second pricing rule, which is what this PR
exists to avoid.

SPEC IMPACT: `0034_payments_and_cart` / CLAUDE.md § 3.1a — the vendor "self-purchase
confirm / comp for myself" checkout branch is REMOVED from code (it only ever
existed on the deleted action; no UI has reached it since 2026-05-29). The feature
is not retired as a product decision — its authority rule survives, pure and tested,
in `lib/self-comp-authority.ts` (`decideSelfCompAuthority`), as does the per-quarter
`enforce_vendor_self_comp_quota` trigger and the `comp_grants.source='vendor_self_comp'`
enum value. When it returns it must be rebuilt on the `submitOrderAction` path.
DECISION_LOG row appended. ⚠ Owner sign-off wanted on removing a spec'd § 3.1a
branch, even a dead one.
