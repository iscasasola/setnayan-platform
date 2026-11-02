## 2026-07-26 · fix(security): the freeze caught its first real one — `orders.pax_snapshot` was forgeable by the payer

Follow-up to `changelog.d/ci-exposure-surface-freeze.md` on the same branch. **That entry's closing "no schema change, no migration" scope note is superseded by this one:** the PR now carries one migration, and the reason it does is the entire argument for the guard.

**Bringing the branch up to `main` made the freeze red on two new columns.** Both arrived in PRs that merged after the baseline was captured — `event_vendors.archived_by_lock_of` (#3740, migration `20271007380000`) and `orders.pax_snapshot` (#3728, migration `20271008000839`). Two facts added, nothing removed, nothing changed: 6,150 → 6,152. Each was investigated on its own evidence instead of being regenerated away, which is the only thing that keeps a baseline from decaying into a rubber stamp.

- **`event_vendors.archived_by_lock_of` — accepted.** Written on UPDATE by the couple's own session client (the lock's archive sweep stamps it; the undo reads and clears it), so the grant is required for the feature to work. Every policy on the table is `roles=authenticated` — verified in prod, there is no `anon` policy at all, so `anon` reaches zero rows — and forging the column can only un-archive the host's own vendor rows inside their own event, which is a thing the UI already lets them do. Baselined.

- **🔴 `orders.pax_snapshot` — accepted as a grant, but it exposed a real defect that is fixed here.** `public.orders` already carries a BEFORE UPDATE trigger whose whole job is to stop an un-elevated caller mutating money columns on their own order (`guard_orders_protected_columns`, `20270226279630`). The new column was never added to its list, and `orders_owner_write` is `FOR ALL USING (user_id = auth.uid())` — so the payer could rewrite their own priced pax straight through PostgREST with `PATCH /rest/v1/orders?order_id=eq.<their own order> {"pax_snapshot": 1}`, against a column whose own `COMMENT` promises it is "frozen at insert" and "Never recomputed".

**Why `20271008000839` deferred this, and why that reasoning does not survive contact with the trigger.** That migration declined to harden the column, arguing the row "already has a strictly larger hole in the same place — `requested_total_php` is client-supplied on this very INSERT", so hardening one audit column "would buy nothing". True of INSERT only. The guard is a BEFORE **UPDATE** trigger, and `requested_total_php` is already refused there — measured, not assumed. Post-insert, `pax_snapshot` was in fact the **only** money-adjacent column on `orders` a payer could still rewrite: the opposite of the premise that justified waiting.

**The fix is a trigger, not a grant** (`20271008300000`). The invasive option `20271008000839` correctly deferred — table-level REVOKE plus an explicit column re-GRANT, the way `20271005100000` did for `public.events` — stays deferred; it needs owner coordination and would break the checkout INSERT. Adding the column to the existing guard reaches the actual goal, an unforgeable snapshot, without touching a single grant: the column stays `SIU` for `anon`/`authenticated` and the baseline records that honestly; the WRITE is what gets refused. Function body is otherwise byte-identical to the version live in prod (compared against `pg_get_functiondef`), the only change being one `is distinct from` disjunct.

**Blast radius, stated plainly so this is not mistaken for more than it is:** nothing re-derives money from `pax_snapshot` today — the only reference in `apps/web` is the INSERT in `submitOrderAction`. This closes a latent trap (an audit record the audited party can edit, which re-opens the SEC-3 pax bug the moment anything trusts it), not a live theft. No production data was exposed; prod has one user and zero orders.

**Proof, all measured as a real `authenticated` session** — asserted first that `current_user` is `authenticated`, not superuser, no `BYPASSRLS`, and does not own `public.orders`, because this repo has shipped owner-connection RLS tests that passed vacuously twice:

| probe | before | after |
|---|---|---|
| payer `UPDATE pax_snapshot` on own order | **ALLOWED** | REFUSED |
| payer `UPDATE requested_total_php` | REFUSED | REFUSED |
| same UPDATE as `service_role` | ALLOWED | ALLOWED |
| payer `UPDATE` of an unprotected column | ALLOWED | ALLOWED |
| re-writing the SAME pax value (`is distinct from`) | ALLOWED | ALLOWED |
| `authenticated` INSERT carrying `pax_snapshot` (checkout) | ALLOWED | ALLOWED |
| same UPDATE as a DIFFERENT user | 0 rows (RLS) | 0 rows (RLS) |
| `SELECT` as `anon` | 0 rows (no anon policy) | 0 rows |

New `apps/web/tests/db/orders-pax-snapshot-freeze.db.test.ts` locks all of it: a META non-vacuity assertion, the denial, a positive control (same host, same row, non-protected column still writable), a differential control (`service_role` succeeds, so the denial is the guard and not a typo), a no-op control, the checkout INSERT, and the RLS cross-tenant check. **Verified non-vacuous by deletion** — remove `20271008300000` and exactly the denial test goes red (6/7) while all controls stay green; restore it and it is 7/7.

**Guard neutralisation re-proven end-to-end against the real schema**, not just the differ's synthetic fixtures: three different widening shapes injected at once — re-`GRANT SELECT (master_qr_token)` (undoing the SEC-2b lockdown), `ALTER POLICY … USING (true)`, and a new anon-callable `SECURITY DEFINER` function with an unpinned `search_path`. All three named, suite exit 1. Probe removed, 6/6 green.

DB suite **275/275**. `tsc --noEmit` clean, and proven to actually cover the new file by injecting a deliberate type error and watching it fail. Lint clean (pre-existing warnings only). `scripts/lint-exposure-baseline.mjs` OK.

SPEC IMPACT: None — no product surface, no pricing, no schema shape change (one trigger function body gains one column comparison). The exposure baseline moves 6,150 → 6,152 facts, both additions reviewed above.
