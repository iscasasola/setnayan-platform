# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-07 · fix(security,onboarding): two refused reads — and the fix that would have been a leak

Both found in production runtime errors while walking the app as a real couple. Both silent by
construction — neither showed an error to anyone.

### 1 · `onboarding_order_items` — 403 since 2026-08-11

Captured live at 12:35 on a brand-new event, query string verbatim:

```
?select=order_id,order:orders!inner(event_id,status)&service_code=eq.SETNAYAN_AI&order.event_id=eq.cc47d373-…
```

That is the OWNERSHIP reader in `lib/onboarding-order-items.ts`, whose own docblock says: *"every
function takes the caller's Supabase client — so it inherits whatever authority the caller has."*
Rendered for the couple, it goes out as `authenticated`.

Measured table state: **RLS enabled · ZERO grants · ZERO policies.** Refused twice over — and a
GRANT alone would still have been refused, because RLS with no policy denies everything.

🔑 **The consequence was invisible.** `lib/entitlements.ts` reads the refusal as "does not own it",
so a couple who BOUGHT Setnayan AI inside an onboarding basket read as not owning it. A refused
query behind `data ?? []` is an empty result for a broken read, not an empty table.

**Fix:** a SELECT policy reaching membership through `orders` (this table has `order_id` and no
`event_id`, and `orders` already carries `orders_owner_read` + a SELECT grant), using the canonical
`current_event_ids()` helper — no new pattern invented — plus the matching table GRANT, because
PostgREST refuses at the privilege layer before RLS is consulted. **SELECT only:** items are minted
service-side; a couple may read what they were billed, never author it.

### 2 · `platform_settings` — 401, and the error message's own advice was the trap

Postgres suggested `GRANT SELECT ON public.platform_settings TO anon`. **That table holds
`business_tin`, `bdo_account_number`, `gcash_number` and both QR payloads.** Following the hint
would have published the platform's banking details.

The real cause, pinned from the edge logs by its query string
(`?select=onboarding_discount_pct&id=eq.1`, 401 at 09:36, 10:07 and 10:40): `app/onboarding/[type]/page.tsx`
passes the CALLER's client into `readServicesStepView`, which read PLATFORM CONFIG with it. On
`/onboarding/wedding` that caller is **anonymous**.

**Fix:** one line — that read now uses `createAdminClient()`, like every other reader of this table
already does (`brand-settings`, `loader-settings`, `papic/page`, `onboarding-services-orders`).
**No grant, no migration, no exposure change.**

🔑 It was wrapped in a `try/catch` that degrades to the DEFAULT discount — so nothing looked broken,
and the owner's admin-set set-up discount was simply not honoured on the one screen that advertises
it.

### Exposure

`exposure-freeze.db.test.ts` caught the widening, as designed, and the baseline is regenerated in
this same PR. The diff is **exactly 8 facts** — 6 columns, 1 table privilege, 1 policy — all
`authenticated`, with **`anon=-` on every column**. Nothing else moved.

### Tests

5 guards. Mutation-checked, each red on its own case: reverting to the caller's client · widening
the policy to `FOR ALL` · dropping the GRANT and keeping only the policy · adding
`GRANT … platform_settings TO anon` · hand-rolling membership instead of `current_event_ids()`.

🪤 That last guard's first draft passed the mutation — it asserted against the whole file and matched
`current_event_ids()` in the policy's own COMMENT. It now reads only the `CREATE POLICY` statement.
Fourth time today a guard read prose instead of code.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-07 — a couple may read their own onboarding order items;
`platform_settings` is never granted to anon, and callers read it with the admin client.

### Correction · 2026-09-07 — the first fix opened a bill, and two guards said no

The `onboarding_order_items` half originally shipped as `GRANT SELECT … TO
authenticated` plus a policy reaching through `orders`. Two shipped db guards
refused it, both correctly:

- **`onboarding-basket-one-bill.db.test.ts`** — *"no session role can read or
  write a bill's contents"*. RLS on, zero policies, grants revoked: only
  `service_role` touches that table. That is a decision about a billing table,
  not an oversight for the first reader that trips over it to correct.
- **`couple-host-policy-scope.db.test.ts` T1/T7c** — a policy named `*_couple_*`
  must not resolve through the MEMBER-wide `current_event_ids()`. The draft's
  did, so every invited guest would have been able to read what the couple was
  billed for. The narrow helper is `current_couple_event_ids()`.

🔑 **The guard that caught it was already there, and the first draft's own test
passed.** A source guard over migration text cannot see who ends up holding a
privilege — it read the SQL and agreed with it.

The table now stays shut. `public.event_basket_orders_granting(uuid, text)` — a
`STABLE SECURITY DEFINER` function following the repo's ordinary RPC shape —
answers the ownership question instead, admitting the couple
(`current_couple_event_ids()`), an admin, or `service_role`, and nobody else.
`lib/onboarding-order-items.ts` calls it with `.rpc()`.

Proved against a replayed database in
`apps/web/tests/db/the-couple-can-read-their-own-bill.db.test.ts`: the couple
gets the row, an invited guest gets nothing, another couple gets nothing, a
signed-out caller gets nothing, `service_role` still gets it, the table is still
unreadable by every session role, and `anon` holds no EXECUTE. Mutation-tested
three ways — swapping in the member-wide helper, deleting the authority gate,
and granting EXECUTE to `anon` — each turns it red on exactly the assertions it
should.

Exposure baseline grows by ONE line: the function itself. No new table or column
grant.

SPEC IMPACT: None.
