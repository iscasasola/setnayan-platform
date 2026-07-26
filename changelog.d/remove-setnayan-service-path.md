## 2026-07-26 · fix(security): delete Way 2 — "book Setnayan as a vendor" is no longer a purchase path

Owner 2026-07-26: *"way 2. no. all setnayan in app services are either on their
exact location on the dashboard or on suites"* · *"monogram and papic is in
suite"*. Companion to the same day's `remove-setnayan-from-explore` — that one
took Setnayan out of the marketplace **listing**; this one takes it out of the
marketplace **checkout**.

There were two ways to buy from Setnayan:

- **Way 1 (KEPT).** An ordinary catalog SKU — fixed `service_code`, admin-set
  price in `platform_retail_catalog_v2` — sold from `/dashboard/[eventId]/suite`
  or the service's own `/dashboard/[eventId]/studio/<service>` page.
  `ANIMATED_MONOGRAM` (₱1,000) and the `PAPIC_*` family already work this way.
  **Nothing in this change touches Way 1.**
- **Way 2 (DELETED).** The couple booked Setnayan as a *vendor*, and the vendor
  workspace **synthesised a `service_key` at runtime** — `setnayan_service__${ev.category}`
  — then invented a price from a three-tier precedence: locked package total →
  itemized line items → **`event_vendors.total_cost_php`, a figure the COUPLE
  types into the Costing form on that same page.**

That last tier is the point. It is the **third** instance of *"a value the
customer can edit decides what they are charged"*, after `events.event_type`
(SEC-5, fixed) and `events.estimated_pax` (latent). **Deleted, not repriced** —
per the owner ruling.

### Reachability (verified against prod before touching anything)

| Check | Result |
|---|---|
| `orders` with `service_key LIKE 'setnayan\_service\_\_%'` | **0 ever** (0 orders exist at all) |
| `event_vendors` with `marketplace_vendor_id IS NOT NULL` | **0** (of 44 rows — all host-typed) |
| `vendor_market_stats` rows with `is_setnayan_service = true` | **0** (of 1 profile) |
| `vendor_profiles.is_setnayan_service` in `information_schema` | **0** — the column does not exist |

The **UI** path was already dead: `workspace/page.tsx` selected
`is_setnayan_service` from `public.vendor_profiles`, where it is not a column
(it is computed on the `vendor_market_stats` VIEW, migration `20260607020000`),
so the query 42703'd and the drawer never rendered. The **POST** path was live,
though — `lib/order-charge-authority.ts` resolved the key server-side and its
own `is_setnayan_service` read was corrected to the view in the SEC-7 follow-up.
A forged `submitOrderAction` POST would therefore have priced off the
host-writable value today. Removing the resolver closes that.

### Removed

- **`apps/web/app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx`**
  — `setnayanServiceKey`, the `setnayanServiceCentavos` three-tier precedence,
  the `setnayanSettings` / `setnayanOrders` fetch and `activeSetnayanOrder`; the
  whole "Managed by Setnayan" card and its `InlineCheckoutDrawer`; the
  `isSetnayanService` gates on the cancel/dispute row and the desktop context
  rail; the now-unused `InlineCheckoutDrawer` / `fetchPlatformSettings` /
  `@/lib/orders` imports.
- **`apps/web/lib/order-charge-authority.ts`** — resolution step (5) and
  `resolveSetnayanServiceChargeCentavos` (~110 lines). The chain is now 4 steps
  then REFUSE.
- **`apps/web/lib/order-charge-math.ts`** — `SETNAYAN_SERVICE_KEY_PREFIX`,
  `setnayanServiceCategoryFromKey`, and the `'event_vendor_setnayan_service'`
  member of `ChargeSource` (a TS-only union — never persisted, no DB enum or
  CHECK behind it).

### Two judgement calls

1. **`isSetnayanService` / "Provided by Setnayan" — removed the concept, and
   fixed a real bug on the way out.** The alternative was re-pointing the read at
   `vendor_market_stats`; leaving a permanently-erroring query was not an option.
   Removal wins: the label existed only to frame the Way-2 purchase, prod has 0
   first-party profiles so a corrected read renders `by {vendor}` for every real
   row anyway, and Explore already dropped the first-party float the same day.
   **The bug:** because `is_setnayan_service` poisoned the whole `select`, the
   42703 nulled `marketplaceProfileRes.data` entirely — so the workspace header
   silently lost `business_name`, `logo_url`, `city` **and** `business_slug` for
   any marketplace pick, not just the attribution. Dropping the column from the
   select restores the header.
2. **No "find it in the suite" pointer — deliberately.** The wayfinding rule
   guards against orphaning a capability, and nothing is orphaned here: after
   this change a first-party `event_vendors` row (none exist) renders as an
   ordinary, fully-functional vendor workspace — hero, Costing, chat, schedule,
   cancel/dispute. It is not a dead end, just a different page. Setnayan's own
   services already have their doorway (the suite / studio, reached from the
   services launcher), and adding a pointer for a state that cannot exist would
   be inventing UI for a phantom — which is roughly how Way 2 came about.

`event_vendors.total_cost_php` is **untouched**. It stays the couple's own
BUDGET record, which is its real job; it simply stops being a price.

### Comments corrected (not just deleted)

`checkout/actions.ts`, `lib/v2-catalog.ts` and `lib/vendor-branches.ts` each
described the key as a live path. Where a comment lists "keys with no catalog
row", `setnayan_service__{category}` now comes **out** of the list with an
explicit note that it was REMOVED 2026-07-26 rather than silently vanishing —
that inventory was already misread once during the SEC-7 review.
`vendor-branches.ts` no longer cites it as precedent for its own suffixed key,
and says why the two differ: the branch fee reads `vendor_billing_catalog`, an
**admin** table.

### Verification

- `tsc --noEmit` → **0 errors**, proven non-vacuous (injected a deliberate
  `const x: number = 'str'` into the most-edited file, confirmed TS2322 was
  reported at that line, reverted).
- `pnpm test:unit` → **4121 pass / 0 fail**. The prefix-parsing test is replaced
  by a removal tripwire: a runtime assertion that neither export is back, plus a
  **type-level** `Exclude<ChargeSource, …> extends never` check that fails
  `typecheck` if the union member returns (verified it fires by re-adding it).
- Grep proof: every surviving `setnayan_service__` match is a comment, a
  historical changelog entry, or the test asserting the removal. No live code
  path mints, parses or prices the key.
- **No migration.** Zero SQL touched, no grants touched, so the exposure baseline
  is unaffected.

SPEC IMPACT: Corpus `DECISION_LOG.md` — append a 2026-07-26 row recording that
the "Setnayan booked as a vendor → synthesised `setnayan_service__{category}`
order" purchase path is RETIRED, leaving exactly one way to buy a first-party
service (admin-priced catalog SKU from the suite or its studio page), and that
`event_vendors.total_cost_php` is a budget record only, never a price.
