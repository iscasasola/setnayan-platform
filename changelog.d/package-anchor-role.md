## 2026-07-26 · fix(packages): a package with 2+ items could not be booked at all — M1

Built to `Vendor_Package_Credit_BUILD_SPEC_2026-07-26.md` § 0 + M1.

### The blocker

`lockPackage` cascades one `event_vendors` row per kept item, all carrying the
same `marketplace_vendor_id`. Since **2026-06-25** a partial unique index has
forbidden exactly that:

```
event_vendors_unique_marketplace_pick_per_event
  ON (event_id, marketplace_vendor_id) WHERE archived_at IS NULL
```

The second row raises 23505, the whole bulk insert fails, `lockPackage` rolls
its own booking back, and the couple gets an error. **A one-item package works;
two or more has been dead for a month.** The index was added for an unrelated
race in the Save-Vendor flow — packages were collateral, and nobody noticed
because prod holds 0 packages.

Found by walking the journey end to end, not by reading code.

### The model — "one anchor, N covered"

|  | anchor | covered |
|---|---|---|
| count | exactly 1 per booking | 1 per remaining kept item |
| `total_cost_php` | the gross agreed total | **always NULL** (DB CHECK) |
| booking fee | opened once, here | never |
| free-tier cap | counts 1 | counts 0 |

Covered rows are exempt from the marketplace-pick and hard-single uniqueness
rules; for them the grain is deliberately per-line, and the duplicate-pick race
those rules exist to stop cannot happen on a server-side cascade.

**Both indexes were rebuilt, not one.** The spec's own review caught the second
— `event_vendors_hard_single_lock_uniq` keys on a group generated from
`category`, and the anchor's category equals its own kept row's, so it would
have 23505'd on the next insert even after Blocker 1 was cleared.

Also: the free-tier cap now counts `DISTINCT event_id`, so a 3-service package
is **one** of a free vendor's three concurrent slots, not three.

### 🔒 One hardening beyond the spec

The spec guards the anchor's `total_cost_php`. That guard was **evadable**:
`event_vendors` grants UPDATE to `authenticated` at table level, so a couple
could demote their own anchor to `'covered'` and NULL the total in one
statement — the guard tests `NEW.package_role`, which is no longer `'anchor'`,
so it never fires and **the fee base silently vanishes**.

`package_role` is now immutable, and the trigger fires on any UPDATE rather than
only `OF total_cost_php`. A trigger is the only lever available: a column-level
REVOKE cannot bite against a table-level grant.

### Exposure baseline

One added fact — `event_vendors.package_role anon=SIU authenticated=SIU` —
identical in shape to its 55 sibling columns on an already fully-granted table.
Accepted deliberately per `supabase/security/README.md`; the money is protected
by the trigger, not by the grant. The whole-table exposure belongs to the
security wave's 368-table audit.

**Tests:** `tests/db/first-user-journey.db.test.ts` — the first end-to-end walk
of vendor signup → authoring → couple discovery → lock → fee, 7 steps, including
the row that used to be impossible and the tamper attempt above. **4029 unit +
318 DB green**, `tsc` exit=0, `next lint` exit=0.

SPEC IMPACT: M1 of the build spec landed. M2/M3 (credit options, spend ledger)
not started; note M2's draft uses `'expire'/'refund'` while the shipped column
is `'expiring'/'refundable'` — reconcile before building M2. §6.4 is now
unblocked: the anchor carries the agreed total, which is the fee base.
