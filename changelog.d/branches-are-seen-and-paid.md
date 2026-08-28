## 2026-08-29 · feat(vendor): a branch is seen by customers, and it has to be paid for

Owner-ruled 2026-08-28, two answers: **customers should see a supplier's branches**, and
**paying for a branch is required**.

Before this, a supplier paid ₱1,000 per 28 days for a label only they could see. No customer
met a branch anywhere — not the marketplace, not the public shop page, not search, not the map,
not Google — so a shop with five paid branches looked identical to a shop with none. And every
surface that read a branch filtered on `status !== 'cancelled'`, so a branch nobody had ever
paid for was fully usable: paying flipped a chip orange → green and did nothing else.

**Seen.** The public shop page (`/v/[slug]`, and the bare-root `/{slug}` that renders through
the same function) now lists the shop's other locations under the map — name and city. Read
through the service-role client that page already uses, scoped to the shop being rendered, and
projected down to two fields: the street address, the pin, the service radius, the parent id
and the internal paid flag never leave the server. **Nothing is added to the JSON-LD or the
sitemap** — those are claims Google republishes, and a branch that lapses would leave one
standing after it stopped being true.

**Paid.** `branchIsUsable(status)` is now the one rule, called by the picker, by the server, and
by the public read. The service-card picker offers only paid, live branches; all three write
paths in `services/actions.ts` refuse an unpaid one in words rather than silently filing the
card under "main". A card *already* filed under a branch that has since lapsed keeps it — the
`<select>` would otherwise fall back to its first option and move the card on the next unrelated
save, with nothing said on screen.

**Two findings that were load-bearing for both halves:**

- **A shop's second manager could not see that its branch was paid.** Activation orders are read
  under `orders_owner_read` (`user_id = auth.uid() OR is_admin() OR …`), so any manager who did
  not personally pay read every branch as `pending_payment`. Cosmetic while nothing gated on the
  status; a **false refusal** the moment it does. The paid state is now read with a service-role
  client scoped by a vendor id the session proved.
- **"Could not read the orders" and "never paid" were the same empty result.** `fetchLatestBranchOrders`
  now throws on a read error and each caller states its direction: the public read claims
  nothing, the dashboard keeps listing the branches, and the write path refuses with a
  *different* sentence — telling a vendor their live branch is unpaid is a false claim about
  their money, and they would go and pay again.

**Migration `20271179754895`** (0 rows in `vendor_branches` in prod, so nothing is grandfathered
and no supplier is locked out mid-term): `branch_subscription_active` no longer defaults to
TRUE — a column named "this branch is paid up" was born in the privileged state, so any INSERT
that did not name it created a paid-looking branch for free (it has three writers and zero
readers, and the comment now says so). And `anon`, which held table-level SELECT/INSERT/UPDATE/
DELETE across all eleven columns from the born-open Supabase default, is revoked at **table**
level. ⚠ **Not a new discovery** — the 2026-08-28 sweep enumerated every base table, probed each
anon-INSERT holder by execution, and correctly classified this one as inert (grant present, RLS
refuses). It is closed here only because this change is the first time the table carries
something a stranger wants. Reproduced against prod today: **394 base tables · 193 grant `anon`
INSERT · 201 grant `anon` SELECT**. ⛔ **This does NOT close the born-open problem** — one table of ~193 is revoked; the rest are unswept, and separating the reachable ones from the inert ones needs each candidate insert attempted as `anon` in a rolled-back transaction and asserted on the ROW COUNT, because RLS refuses by returning zero rows rather than throwing. Its own task, deliberately not smuggled in here. The root cause is a migration that creates a relation and
issues no revoke; the durable fix is a lint that fails such a migration, and **nobody has built
one** — named, not attempted. The regenerated exposure baseline is **all narrowing, zero added
lines**.

**Guard:** `apps/web/lib/vendor-branches-are-paid.test.ts` — 24 assertions, **17 mutations, every
one landed by occurrence count and every one red**. One of them caught a decorative test of my
own: the fail-closed check passed with its mechanism sabotaged, because it was proving that a
missing order reads as unpaid rather than that an unreadable one does.

Verified: typecheck exit 0 / 0 errors · unit 11,249 pass 0 fail · db 1,805 pass 0 fail · lint 0 ·
production build 0 · every CI guard script green.

SPEC IMPACT: `DECISION_LOG.md` — the 2026-08-28 branch ruling now has an implementation row.
