## 2026-09-22 · fix(env): the flag guard closes its set, and four drifted readers come back in

W1 / register LAU-36. `lib/env-flag.ts` has been the one boolean-env reader since
2026-08-09, accepting `true·1·yes·on` case-insensitively and trimmed. Its guard
checked every REGISTERED flag — but nothing checked for flags in no list at all.

Its last test ended `assert.ok(Array.isArray(strict), 'inventory computed')`.
`Array.isArray` of an array is always true: the test printed a count and gated
nothing. It also walked only `lib/` (one level, via `readdirSync`) and matched
only `NEXT_PUBLIC_*`.

Four readers drifted in behind it:
`CATEGORY_PROPOSAL_DRAFT_ENABLED`, `SUPPLIER_NIGHT_BEFORE_EMAIL_ENABLED`,
`VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED` (all server-side, outside the pattern)
and `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION` (hand-rolled `'true' || '1' ||
'TRUE'`, matching no pattern). The last one gates whether a new account must
confirm its email, and it did not trim whitespace — a trailing space in the
Vercel dashboard would have read as OFF.

All four now read through `envFlagEnabled`. The inventory test is replaced by a
closed-set gate: whole tree (~4,100 files), both operand orders, fails when a
strict reader is in neither `CONVERTED` nor `HELD_STRICT`. Runner-provided vars
(`CI`, `GITHUB_ACTIONS`, `VERCEL`, `NODE_ENV`) are excluded by nature, not by
directory, so a real flag written strictly in `scripts/` is still caught.

Proved by sabotage: a new strict reader in `app/` (a directory the old test
could not see) and the Yoda form `'true' === process.env.X` each turned the gate
red, with the printed sweep count confirming the mutation landed; restored, 12/12.

The five deliberately-strict flags are untouched — converting those is a
compliance/DPO decision, and the guard still pins both their strictness and the
note saying why.

SPEC IMPACT: None.

## 2026-09-22 · fix(db-errors): pay down 11 units of unread-error debt, and bound the slack

W1 / register LAU-30 + LAU-31. LAU-31's mechanism already exists — the
`supabase-unread-error.baseline.txt` ratchet, inherited 2026-09-18, with a test
named "LAU-30 exactly". The register lists both as NOT BUILT; the guard was
built four days ago.

What was actually wrong is the other direction. The ratchet failed on GROWTH but
only `console.log`ged entries that had been PAID DOWN, so stale entries
accumulated. **A stale entry is not neutral — it is permission:** the baseline is
a per-`file · kind · target` ceiling, so a file whose real count has dropped to 0
while its entry says 1 can acquire a genuinely unread error later and stay green.

Measured: 8 entries / 11 units had gone stale in 4 days, including 4 paid down by
#5872 — the PR that fixed them — without lowering them here. Regenerated:
366 → 359 entries. The diff is removals and one decrement only; nothing added.

The reporting-only decision is kept, and its reason is right: failing on a single
fix punishes the fix, which matters with several sessions in flight. Instead the
slack is now BOUNDED — still never red for one fix, but red once more than 12
entries are stale, i.e. once the debt list has stopped describing the tree. The
failure message carries the one command that regenerates it.

Proved by sabotage: inflating 13 baseline counts turned it red at exactly 13 > 12
(the printed count confirmed the mutation landed); restored, 6/6 green.

SPEC IMPACT: None.

## 2026-09-22 · fix(schema-drift): assert the prod snapshot is still about production

W1 / register LAU-28 + LAU-29.

**The guard could be green and blind at the same time.** `schema-drift.db.test.ts`
replays the migrations in the snapshot's own `[ledger]` and compares them to the
snapshot's own `[columns]`. Both halves come from the same file, so an old
snapshot is perfectly self-consistent: it verifies an old ledger produces an old
prod, and says nothing about anything applied since.

Measured against production: the snapshot's ledger holds **1351** versions while
prod's ledger and the repo both hold **1475**. **124 migrations sat outside the
comparison** — including any `CREATE TABLE IF NOT EXISTS` no-op among them, which
is the exact bug class this file exists to catch. Nothing was red, because
staleness had no symptom.

Freshness is now asserted. The repo's migration count is the honest local proxy
for prod's ledger (the pipeline applies every committed file with
`db push --include-all`), so no production credential is needed here.

⚖ The ceiling is **160 = the 124 measured today + 36 of headroom** — a ratchet
pinned at existing debt, not a judgement that 124 is fine. Clearing it needs
`SUPABASE_DB_URL` and is an OWNER action, and a red required check would block
every bundle behind it for a reason no session can fix. The headroom is small on
purpose: `gap` grows by one per migration merged, so ~36 more land before it goes
red, and the answer then is the refresh in the failure message — never a bigger
number.

LAU-29's other half: the "HONEST LIMITS" paragraph claimed nullability was not
compared. It has been compared since `[notnull]` was added, with its own floor.
Corrected — a limits paragraph that overstates the hole teaches people to
distrust the guard, which is the same damage as one that understates it. Defaults
are still genuinely not compared, and that stays stated.

Proved by sabotage: 40 extra migration files pushed the gap to 164 and turned it
red; removed, 8/8 green at 1475 files.

SPEC IMPACT: None.

OWNER ACTION: refresh the snapshot — `export SUPABASE_DB_URL='postgresql://...'`
then `pnpm --filter @setnayan/web schema:snapshot`, and commit
`supabase/security/prod-schema.snapshot.txt`.
