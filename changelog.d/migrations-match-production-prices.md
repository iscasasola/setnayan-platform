## 2026-08-31 · fix(db): the migrations sell what production sells — two of four rows, and why the other two can't be

**SPEC IMPACT: None.** No product behaviour. Live prices were always correct.

🚨 **A DATABASE BUILT FROM `supabase/migrations/` ALONE DID NOT MATCH PRODUCTION
ON FOUR CATALOGUE ROWS.** Found by the C7 session; measured here by replaying
every migration into PGlite and diffing against the live Supabase catalogue:

| row | replay | production |
|---|---:|---:|
| `CUSTOM_QR_GUEST` | ₱999 | **₱0 — the QR is free** |
| `SEATING_3D` | **no row at all** | ₱1,500 |
| `pro_vendor_monthly` | ₱2,499 | ₱2,500 |
| `pro_vendor_annual` | ₱24,999 | ₱26,000 |

✅ **Owner ruled twice (2026-08-30, 2026-08-31): "the production prices are the
correct prices."** This moves the migrations to production, never the reverse.

⛔ **NOTHING CUSTOMER-FACING WAS EVER WRONG** — live pages resolve every figure
from the catalogue at render. What was wrong is every database *built from
migrations*: a fresh environment, a restore, and the `*.db.test.ts` replay.

**THIS FIXES TWO. THE OTHER TWO CANNOT BE FIXED BY ANY MIGRATION**, and that is
measured rather than argued. A canary inside the new migration reads
`pro_vendor_annual` = **₱26,000 at the end of the file** and **₱24,999 after the
whole replay finishes**.

🔑 **WHY: `tests/db/replay-migrations.ts` DEFERS a migration that fails on first
pass and RETRIES IT LAST**, after every later-numbered file. Seven take that path
on a normal run, and `20260530010000_iteration_0006_v2_1_amendment_2.sql`
re-seeds the pre-price-sheet Pro Vendor figures after everything else.
**The oldest file wins, not the newest** — an ordering production never had,
since prod applied each migration once when authored and never re-ran a
2026-05-30 seed after a 2026-08-27 reprice.

⇒ **This is a TEST-HARNESS defect, not a migration one.** Another migration with
a later prefix loses the same way. The fix belongs in the replay's retry
ordering, which **1,919 db tests depend on**, and is booked as its own change.

🪤 **I ASSERTED THE OPPOSITE FIRST.** I claimed a forward-dated correction "lands
last in both orders, whatever the cause." False for this harness. Two attempts to
instrument the retry loop **silently failed to patch the file**, and I read the
empty output as "no retries happen". Only verifying the patch anchor actually
matched exposed it — the third instance this week of a check that could not fail.

**Also updated:** `llms-fixture-matches-the-catalog.db.test.ts` loses two
exemptions (`CUSTOM_QR_GUEST`, `SEATING_3D`) — its own staleness guard *requires*
removing an entry that stops diverging, and it fired correctly the moment the
migration landed. The list shrinks 4 → 2. That is the ratchet working.

**Verification:** migration timestamp guard ✓ (1,271 unique, allocator-sourced) ·
the four catalogue db tests 26/26 · `TSC_EXIT=0`, 0 errors under the shared mutex ·
a no-op in production by construction — every statement guarded with
`IS DISTINCT FROM`, so it updates zero rows where the values are already correct.
