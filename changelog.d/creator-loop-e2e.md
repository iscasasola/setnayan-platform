## 2026-07-17 · test(creator): end-to-end creator-loop verification suite

- **NEW `pnpm --filter @setnayan/web test:db`** — `apps/web/tests/db/creator-loop.db.test.ts`
  replays **every** `supabase/migrations` file (~790) into an in-process PGlite
  (WASM Postgres 18 — no docker, no supabase CLI, no network, zero prod risk;
  harness: `apps/web/tests/db/replay-migrations.ts`) and exercises the creator
  economy END-TO-END at the DB layer: chapter draft/publish under the real RLS
  policies, `increment_chapter_view` self-gating, the deny-by-default
  Storytellers-shelf predicate (feature → listed, unfeature/report-hide →
  delisted, hidden profile → delisted), chapter reports on `user_reports`, all
  five offer gates (FORBIDDEN / TIER_FREE_NO_REACH / SELF_OFFER / MISSING_TERMS
  / NOT_A_CREATOR incl. hidden-profile targets), and the full escrow-at-send
  money loop of migration 20270819350491 — send debits + `spend_source`
  ledger tag, accept/decline both settle with no second debit,
  insufficient-balance send rolls back atomically (no unpaid offer row),
  expiry sweep refunds exactly once, member-draw wallets debit/refund
  correctly. 20/20 passing (~6 s).
- **BUG FOUND + FIXED — the expiry-refund sweep could never run:**
  `sweep_expired_creator_offers()` aborted with `column reference "vendor_id"
  is ambiguous` (42702) the moment it processed an expired ESCROWED offer —
  the `RETURNS TABLE` OUT-param `vendor_id` collides with the refund
  `INSERT … ON CONFLICT (vendor_id)` arbiter columns under plpgsql's default
  `variable_conflict = error`. No exception handler ⇒ the whole sweep rolled
  back: expired offers stayed `pending` forever and vendors' escrowed reach
  tokens were never refunded (walkthrough (c) of 20270819350491 was
  unreachable; respond correctly raises OFFER_EXPIRED, making the stuck state
  total). Fix: migration
  `20270820100000_fix_sweep_expired_creator_offers_ambiguous_vendor_id.sql`
  (same body + `#variable_conflict use_column`; signature unchanged). ⚠ Owner
  must `supabase db push` this to prod.
- **FINDING (documented in-test, fails closed — no leak):** the
  defense-in-depth `public_can_read_published_chapter` RLS policy is dead as
  written — its `EXISTS` on `public.users` runs under the caller's users-RLS
  (own-row/admin only; no anon policy), so it never grants public visibility.
  The product read path (service-role + app gates, `lib/creator-public.ts`)
  is unaffected and is what the suite asserts.
- **NEW e2e spec** `apps/web/tests/e2e/creator-public-surfaces.spec.ts` —
  /realstories renders with NO `#storytellers` shelf when nothing is featured
  (publish ≠ listed), unknown chapter URLs 404, unknown `/u/[slug]` fails
  closed. Runs under the existing dummy-env e2e job unchanged (verified
  locally: 74 passed / 0 failed against a CI-parity build + `next start`).
- Replay harness notes: two prod-data-dependent seed files are skipped with
  reasons; one replay-only patch to the 20260714000000 screen-name backfill
  (its slug/sequence namespaces disagree — latent collision on unmapped
  service keys, flagged to owner separately).

SPEC IMPACT: None (tests + a DB hotfix migration; no product-scope change).
