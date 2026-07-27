## 2026-07-27 · fix(vendors): vendor verification submit was silently broken in prod — plus the integrity gap that let a bad row exist

**P0. Nobody has ever successfully applied for verification.** A vendor pressed
"submit for verification", Postgres refused the write, the app discarded the
refusal, and the vendor was told nothing. The marketplace filters on verified, so
it stayed empty. Prod corroborates: **0 verified vendors** (the single `verified`
row is a hand-inserted seed), **0 `vendor_tier_history` rows**, **0
`vendor_verifications` rows**.

### The defect

`submitApplication` (`app/vendor-dashboard/verify/actions.ts`) and its twin
`submitInlineForReview` (`app/vendor-dashboard/shop/inline-docs-actions.ts`) both
flipped `vendor_profiles.verification_state → 'pending_review'` through the
**vendor's own authenticated client**, and never checked the result:

```ts
await supabase.from('vendor_profiles').update({ verification_state: … })
//  ^ no `const { error } =` — the refusal was discarded
```

`trg_guard_vendor_profiles_entitlement` raises `insufficient_privilege` on any
vendor-authored `verification_state` change. The application row moved to
`pending_review` while the profile stayed `unverified` forever.

**This is a FRESH regression, not long-standing.** The trust-column clause landed
2026-07-26 in `970284a02` ("fix(security): close two live self-grant holes"),
migration `20271004444950`. That commit's audit concluded "EVERY writer of either
column lives under `apps/web/app/admin/` … there is NO vendor-facing write path"
— it missed these two. The guard itself is CORRECT and stays; a vendor must not
be able to self-grant the Verified badge.

### Fix 1 — route the flip, and fail LOUDLY

New `lib/vendor-verification-state.ts` performs the flip through **service_role**
— the escape hatch the guard's own `HINT` names, and the pattern ~a dozen
vendor-dashboard actions already use (`createAdminClient()`, with
application-level authorization in the caller, per `lib/supabase/admin.ts`).
Chosen over a `SECURITY DEFINER` RPC because it is the established precedent here.

- Every statement is pinned to **both** `vendor_profile_id` AND `user_id`.
- A DB error **and** a 0-row update both return `{ ok: false, error }`.
- Both call sites now branch on the result and surface the failure.
- The privileged flip runs **first**, so a refusal aborts with zero writes; if the
  application-row write then fails, the profile is reverted.
- An `annual_renewal` from an already-verified shop is a **no-op** rather than a
  downgrade — flipping it to `pending_review` would strip the badge and delist
  the shop from the marketplace for the whole review window.

### Fix 2 — the integrity gap

Prod holds a row at `verification_state='verified'` with NULL `last_verified_at`,
NULL `next_renewal_due_at` and no `vendor_tier_history` row. No shipped app path
can produce it (both admin writers stamp all three in one UPDATE and bump
`updated_at`; the bad row's `updated_at` equals its `created_at`). The reachable
shapes bypass the app entirely: `scripts/seed-test-accounts.sql` and migration
`20270331400000:41-44`.

Migration `20271017100000` adds CHECK `vendor_profiles_verified_requires_stamp`
(`verification_state='verified'` ⇒ `last_verified_at IS NOT NULL`) — engine-level,
so it binds seeds, migrations and hand-run SQL, which no app-layer fix can reach.
Added **`NOT VALID`**: fully enforced on every INSERT/UPDATE from the moment it
lands, while the one known bad row is grandfathered, so the deploy is not blocked
on a data decision. `next_renewal_due_at` is deliberately not required.

`scripts/seed-test-accounts.sql` now stamps `last_verified_at` +
`next_renewal_due_at` in the same statement and writes the `vendor_tier_history`
row a real approval would have written.

⚠ **Owner action required, in this order:** deploy → resolve the bad row
(recommend DELETE; see PR body) → `ALTER TABLE public.vendor_profiles VALIDATE
CONSTRAINT vendor_profiles_verified_requires_stamp;`. This PR does **not** touch
prod data.

### Fix 3 — retired value still being written

`app/api/admin/cron/dispute-counter/route.ts` wrote
`public_visibility: 'coming_soon'`, declared RETIRED and unwritable by
`20271013500000`. Corrected to **`'hidden'`** — the migration's own documented
"demote/reject/un-freeze target" and the new column default. It is also the only
choice that actually delists a dispute-demoted vendor, since the narrowed
`vendor_profiles_public_read` admits only `public_visibility='verified'`. The
audit row's `after_json` and the stale header comments were corrected to match.
The seed script's `coming_soon` write was fixed too.

### Tests

- `lib/vendor-verification-state.test.ts` — 14 unit tests, incl. a repo-wide sweep
  that fails if **any** file under `app/vendor-dashboard/` writes a trust column
  through its own client, and a guard that both submit actions branch on the
  result. Mutation-verified: swallowing the error, treating a 0-row write as
  success, and restoring the original call-site shape each turn a named test red.
- `tests/db/vendor-verified-stamp-integrity.db.test.ts` — 9 tests against replayed
  migrations: the bad shape is rejected on INSERT/UPDATE, and the exact
  single-statement pattern both admin approval paths use still succeeds.
- **10 existing db-test fixtures corrected.** The new constraint immediately
  caught them creating `verification_state='verified'` rows with no
  `last_verified_at` — i.e. the very row shape being outlawed. They now stamp it
  in the same statement (and `booking-requires-verified` stamps it only for the
  'verified' state), so fixtures produce the row a real approval produces. Full
  suite: **561/561 db tests pass, 4765/4765 unit tests pass.**

SPEC IMPACT: None. The guard, the `coming_soon` retirement and the verification
flow are all already-locked decisions; this makes the code match them. The one
judgement call surfaced for owner sign-off is in the PR body (renewal submits from
a verified shop keep the badge rather than dropping to `pending_review`).
