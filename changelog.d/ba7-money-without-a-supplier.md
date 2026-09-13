## 2026-09-03 · feat(budget): a cost can exist with no supplier (BA7)

`event_vendor_line_items.vendor_id` is `UUID NOT NULL REFERENCES
event_vendors(vendor_id)`, so every peso the couple recorded had to hang off a
supplier row. A couple could not write down their first ₱ until they invented
one — and `/budget` said so out loud: *"No vendors yet. Add a vendor first, then
come back here to itemize costs."* The taxonomy already named costs the schema
could not hold: `rings`, `attire`, `officiant`, `wedding_paperwork` and
`travel_honeymoon` are live plan groups, the page recommends a rings budget, and
it offered no way to record buying rings.

- **`event_costs`** (migration `20271193967957`) — one row per cost with no
  counterparty: `plan_group_id · label · amount_php · paid_php · due_date ·
  note`. RLS at `CREATE TABLE`, Pattern B narrowed to the couple exactly as its
  sibling `event_vendor_line_items` is narrowed in production (couple read +
  couple write via `current_couple_event_ids()`, budget-area delegate read via
  `moderator_area_level(event_id,'budget')`). What it deliberately does NOT copy
  is that table's fourth policy, `vendor_read`: there is no supplier here, and a
  caterer has no business reading what the couple spent on rings.
- **A new `MoneySource`, `'event_cost'`**, in `resolveEventMoney`. Settled NET
  per row, the same way a vendor is settled, so `committed + overpaid === paid +
  stillOwed` holds exactly for every sign of every input
  (`max(0, c−p) + c ≡ max(0, p−c) + p`). `MoneyInputs.costs` is REQUIRED, not
  optional-defaulting-to-`[]` — a money source you can forget to pass is one
  that silently reads ₱0. Overpaying is reported (`overpaid_cost`), never
  clamped. An unrecognised `plan_group_id` buckets to `other` rather than
  dropping the money.
- **Naming a supplier is one optional field, and it forks the whole save.**
  Owner, 2026-09-02, verbatim: *"if they add a budget it means it is
  automatically locked. and it will automatically be on the marketplace as well.
  then they also get a QR Code to add that vendor to the app (already planned
  before)."* A named supplier becomes an `event_vendors` row at `contracted` —
  which IS the Merkado row — with the cost as an `event_vendor_line_items` row,
  anything already paid as an `event_vendor_payments` row, and a claim QR.
  🔑 **None of that is new plumbing:** the QR is `renderUrlQrSvg` over
  `buildClaimUrl` over the shipped idempotent `ensureAutoShareInvite`, i.e. the
  existing `/vendor/claim/[token]` link. A cost with no supplier gets one
  `event_costs` row, no Merkado row and no QR.
- **The fork is what keeps the counting law structural.** One peso is in exactly
  one home, decided by a fact about the world rather than by which screen was
  used. That is why this is a new table and not a nullable `vendor_id`: ten
  shipped readers of `event_vendor_line_items` assume a supplier,
  `event_vendor_payments.vendor_id` would need the same relaxation, and a
  `plan_group_id` column on that table would be a second source of truth for a
  fact its rows already take from the vendor.
- The page's list of recorded costs is derived from `money.lines`, not from a
  second read of the table — one mechanism, so the list and the totals cannot
  disagree. When the resolver returns nothing the page SAYS so instead of
  printing an empty list, because an absence that renders identically to "you
  have none" is the disease this whole stream is named after.
- The empty state no longer sends the couple away to invent a supplier.

Guarded by `apps/web/lib/a-cost-needs-no-supplier.test.ts` (draft validation ·
the LOCKED supplier fork and its reuse of the existing claim link · the copy)
and `apps/web/tests/db/a-cost-can-exist-with-no-supplier.db.test.ts` (RLS
exercised through real sessions: the couple can record rings with no
`event_vendors` row; another couple sees nothing and cannot plant one; a
budget-area delegate reads and cannot write; a delegate granted every *other*
area sees nothing; a **booked supplier** who can read `event_vendor_line_items`
sees nothing here; `anon` holds no table or column grant). Both guards were
mutation-tested — eleven sabotages, each turning exactly the intended assertion
red.

⚠ **A CORRECTION TO THE ORDER THAT PRODUCED THIS.** The brief claimed all five
named plan groups carry seeded benchmarks. Measured against production
2026-09-03: only three do (attire ₱40,000 · officiant ₱15,000 · rings ₱40,000).
`wedding_paperwork` and `travel_honeymoon` have **no row at all** in
`budget_leaf_benchmarks` — not a NULL, no row — so BA3's `plannedFrom()` folds
their Planned column to `null` ("no typical price yet"), which is the truth. It
does not change the defect; both were equally unrecordable.

## 🛑 AND IT FOUND A LIVE OUTAGE ON THE WAY

**No couple has been able to add a supplier since `20271105038066` shipped.**

BA7 needed to prove its "name a supplier" fork could really create the LOCKED
Merkado row it promises, so it wrote a db test that performs the insert AS THE
COUPLE instead of asserting that the server action spells it. The database
refused. Re-run against **production** on 2026-09-03, inside a rolled-back
transaction, an `authenticated` INSERT naming no completion column at all comes
back:

    INSERT REFUSED: event_vendors: completion columns record who did what and
                    are written only by the app backend

`guard_event_vendor_completion` refuses a session-role INSERT whose
`NEW.completion_status IS NOT NULL` — but that column is
`NOT NULL DEFAULT 'awaiting_vendor'`, and **a column default is applied when the
tuple is formed, before any BEFORE ROW trigger runs**. So the condition was true
on every insert by anybody, ever. `createVendor`,
`attachManualVendorToCategory` and `attachMarketplaceVendorToCategory` are all
session-client inserts and were all dead.

🔑 **THE SOURCE GUARD COULD NEVER HAVE SEEN IT.** Every server action spells the
insert correctly; a trigger refuses it. Typecheck, lint, a source scan and a
code review all pass on a feature that cannot write a row. The only assertion
that can see this is one that PERFORMS the write as the couple.

🔑 **AND THE MISTAKE IS WRITTEN IN THE ORIGINAL'S OWN DOCBLOCK**: *"A repo-wide
grep for a SESSION-client write of these columns returns NOTHING, so refusing
`authenticated`/`anon` breaks no shipped path."* The grep was right and the
conclusion was wrong — **a `NOT NULL DEFAULT` writes a column nobody named**,
and searching application code cannot find a writer that lives in the schema.

Corroborated by data, not inferred: production holds 45 `event_vendors` rows,
all 45 with a non-null `completion_status`, the **newest created 2026-07-30**,
and **zero created since**.

Fixed in `20271194295412` — one condition, on the one column of the four that
carries a default. Its three siblings are nullable with no default, so
`IS NOT NULL` stays correct for them, and the UPDATE branch is untouched.
⛔ **The forgery protection is not relaxed**: a booking that arrives marked
`confirmed`, `auto_confirmed` or `disputed` is still refused, on either verb.
Guarded by `apps/web/tests/db/a-couple-can-add-a-supplier.db.test.ts`, which
asserts BOTH halves — a test proving only that the insert lands would be
satisfied by deleting the guard. Mutation-tested three ways: reverting the fix,
over-correcting it away, and "hardening" it into `SECURITY DEFINER` (which would
make it permanently inert) each turn exactly the intended assertions red.

⚠ **TWO BASELINES WERE REGENERATED BY THEIR OWN SANCTIONED COMMANDS**, neither
weakened: `supabase/security/exposure-surface.baseline.txt`
(`pnpm --filter @setnayan/web exposure:baseline`) and
`apps/web/tests/db/user-fk-behaviour.generated.txt`
(`UPDATE_FK_BEHAVIOUR=1 pnpm --filter @setnayan/web test:db`). The exposure diff
carries one thing that is NOT this PR's: `public.users` moves from `anon=SU` to
`anon=S`, the narrowing already merged as `20271193294406` (PR #5127). A
narrowing never fails the freeze, so its baseline had gone stale; regenerating
folds it in, which TIGHTENS the frozen surface. Everything else added is
`event_costs`, `anon=-` on every column.

SPEC IMPACT: None. This implements the owner's 2026-09-02 rulings already
recorded on the BA stream (finalized money only · the two doors · off-platform
and finalized as independent axes). No locked decision changes; no new price,
threshold or number is introduced anywhere.
