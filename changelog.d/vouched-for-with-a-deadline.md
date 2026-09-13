# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-07 · feat(admin): vouch for a supplier, with the paperwork owed

Owner ruling, after we tried and failed all day to get a single supplier in front of a couple.

### Why

Real verification is four documents, a two-channel VALIDATE token and a 15-minute Google Meet.
Correct for a mature marketplace — and the reason **zero suppliers have ever completed it**:
`vendor_verifications` held **0 rows**, both existing shops carried a `verified` column written by a
seed rather than earned, and the platform had therefore never carried a single inquiry
(`chat_threads` = 0 since launch). A marketplace with no verified supplier has no funnel.

An admin may now vouch for a supplier they know: **listed immediately, documents due in six months**,
withdrawn automatically if they do not arrive.

### Two owner rulings, implemented without softening — and their cost, stated

- **Same badge.** Asked directly whether a couple should see any difference: *"just same."* So
  "Verified" now means *documents checked **OR** the platform vouched*, and only an admin can tell
  which. Nothing in this feature renders a couple-facing distinction, and a test fails if one
  appears.
- **No cap.** Asked whether to limit concurrent bypasses: *"no limit. we can apply this to as many
  as we want."* There is deliberately no ceiling.

🔑 **Together these make the deadline the only thing holding the badge honest** — which is why it
expires on read rather than on anyone remembering (no cron, owner-locked 2026-05-14; same shape as
Live Studio and Papic sessions).

### It is also the write path `public_visibility` never had

Measured today: three admin surfaces READ `public_visibility` and **not one could write it** —
`/admin/vendors/[id]/edit` selects the column and its save action omits it. A shop that reached
`verified` + `hidden` had no exit through the product; the platform's only published shop needed a
hand-written SQL UPDATE. A grant here is that missing write, carrying a required reason and an audit
row — which a bare toggle would not.

### 🪤 THE SCHEMA WAS WRONG TWICE, AND `exposure-freeze` CAUGHT BOTH

**First draft — five columns on `vendor_profiles`.** Refused, correctly: **a new column INHERITS the
table's grants**, and `vendor_profiles` grants SELECT+INSERT+**UPDATE** to `authenticated`. All five
arrived writable — **a vendor could have pushed their own deadline into the future and never lost
the badge.** A column-level REVOKE against a table-level grant is a no-op, so they could not be
closed where they stood. Moved to their own table.

**Second draft — the new table, with no GRANT statements.** Also refused: **"no grant" is not
closed.** A new table in `public` arrives with Supabase's default privileges — `anon=SIU
authenticated=SIU` on every column, on a table this migration had just described as "granted to
nobody". Fixed with an explicit `REVOKE ALL … FROM anon, authenticated, PUBLIC`, and a test now
fails if that revoke is ever dropped.

Final state: **zero exposure change, no baseline edit.** Service-role only.

### Tests

18 in `verification-bypass.test.ts` — 9 pure, 9 source/migration-anchored. Mutation-checked, each
red on its own case: letting an expired bypass survive · withdrawing a shop whose documents landed ·
granting verification without listing (recreating the dead end) · a bypass with no stated reason ·
the sweep comparing dates itself instead of the shared rule · granting a bypass column · dropping
the REVOKE.

🪤 Three drafts of these guards passed while asserting nothing — one matched the migration's own
comment, one matched `GRANT` inside `verification_bypass_**grant**ed_at`, one matched a docblock.
Each was caught only by mutation. That is five such slips in one day, all in guards, all mine.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-07 — verification bypass exists; same badge; no cap; six-month
deadline enforced by on-access sweep; the vouch lives in its own service-role-only table.

### Follow-up · 2026-09-07 — two CI guards this PR had not satisfied

- **`lint-one-comment-stripper`** refused `verification-bypass.test.ts`: the
  couple-facing-label assertion stripped comments with its own two-replace
  regex. Swapped for `stripComments` from `lib/strip-comments.ts`. Mutation-
  tested both directions — adding `BADGE_LABEL = 'Vouched'` to the module turns
  it red, and a *comment* mentioning "Provisional" correctly does not.
- **`admin-jobs-are-generated`** was red because the three new server actions
  (`grantVerificationBypass`, `revokeVerificationBypass`,
  `sweepExpiredVerificationBypasses`) were not in the committed checklist.
  Regenerated with `pnpm --filter @setnayan/web admin:jobs`. The admin *map* is
  untouched: regenerating it changes only its commit stamp, which is churn.

SPEC IMPACT: None.

### Follow-up · 2026-09-08 — the FK-behaviour map had to learn the new table

`user-fk-behaviour.db.test.ts` went red once `vendor_verification_bypasses`
existed: its generated map is what erasure decisions are read from, and it did
not yet know that `granted_by` is `SET NULL` onto `auth.users`. Regenerated with
`UPDATE_FK_BEHAVIOUR=1`, exactly one line added (238 → 239 FKs, SET NULL 175 →
176). `SET NULL` is the right behaviour here and is safe: the column is nullable
and carries no CHECK, so deleting the admin who vouched blanks the attribution
without blocking the delete or revoking the bypass.

SPEC IMPACT: None.
