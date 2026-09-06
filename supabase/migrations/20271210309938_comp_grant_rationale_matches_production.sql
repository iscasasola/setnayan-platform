-- comp_grant_rationale_matches_production
--
-- The LAST of the three undocumented NOT NULLs on `comp_grants`, and the only
-- one where production turned out to be RIGHT.
--
-- ══ WHAT THIS IS FINISHING ══════════════════════════════════════════════════
--
-- Production marks `comp_grants.user_id`, `.rationale` and `.granted_by` NOT
-- NULL, and NO migration in this repo ever created any of the three — the
-- declaration says nullable, so the PGlite replay every db test runs against
-- says nullable too. That gap was invisible until `schema-drift.db.test.ts`
-- learned to compare nullability; it had compared column NAMES only.
--
-- The other two went the OTHER way, and it is worth being precise about why,
-- because "prod enforces it" is not on its own an argument:
--
--   · `granted_by` (20271208517365) — DROP NOT NULL. The fix converts its FK to
--     ON DELETE SET NULL, and SET NULL on a NOT NULL column does not null
--     anything: it makes the parent DELETE fail with 23502. Prod's constraint
--     would have made admin accounts undeletable.
--   · `user_id` (20271209332066) — DROP NOT NULL. `issueVendorSkuComp` writes
--     `user_id: null` deliberately, because a comp that targets a VENDOR has no
--     user. Prod's constraint made that feature raise 23502 on every use while
--     the whole db suite stayed green.
--
-- In both, a real writer wanted NULL and production refused it. **Here nothing
-- does.** Measured on origin/main:
--
--     grep -rn "from('comp_grants').insert" apps/web --include=*.ts
--
-- returns exactly two writers — `issueCompGrant` (app/admin/users/actions.ts)
-- and `issueVendorSkuComp` (app/admin/vendors/actions.ts) — and BOTH supply a
-- rationale; the admin console requires one of at least 10 characters before it
-- will submit. `lib/self-purchase.ts` only READS `source = 'vendor_self_comp'`
-- rows to count them against `enforce_vendor_self_comp_quota`; it inserts
-- nothing, and no other code in the repo writes that source at all.
--
-- So the declaration is the half that is behind, and this brings it forward.
--
-- ══ WHY REQUIRING IT IS ALSO THE RIGHT RULE, NOT JUST THE MATCHING ONE ══════
--
-- `comp_grants` is the money-side record of a waived charge — that is how
-- `lib/erasure/coverage-guardrail.test.ts` classifies the table, under "lawful
-- retention: financial + BIR records". A row here says the company gave
-- something away. **A gift with no recorded reason is the one shape this table
-- should never hold**, and the reason is the whole audit value of the row: the
-- amount is already in `retail_value_centavos`, the who in `granted_by`, the
-- when in `created_at`. Without `rationale` the record cannot answer "why".
--
-- ⚠ THIS TIGHTENS THE REPLAY, SO IT CAN BREAK A TEST — AND IT DOES, ONCE.
-- `tests/db/the-public-numbers-keep-the-record.db.test.ts` inserts
-- `(source, vendor_profile_id, created_by_user_id)` with no rationale, as a
-- fixture for the self-comp counting path. That row could never have existed in
-- production, so the FIXTURE is repaired in this same commit — never the
-- assertion, which is about public numbers and is unaffected.
--
-- ══ SCOPE ══════════════════════════════════════════════════════════════════
--
-- `comp_grants` holds ZERO rows in production, so `SET NOT NULL` validates
-- against nothing and cannot fail on legacy data. In a fresh replay the table is
-- likewise empty at this point. This is a no-op against prod (already NOT NULL)
-- and the whole change in any environment built from migrations — the mirror
-- image of the two DROP NOT NULLs above.
--
-- After this, all three columns agree on both sides and
-- `schema-drift.db.test.ts` has no `comp_grants` gap left to excuse.

ALTER TABLE public.comp_grants
  ALTER COLUMN rationale SET NOT NULL;

COMMENT ON COLUMN public.comp_grants.rationale IS
  'Why this comp was given. REQUIRED: a gift with no recorded reason is the one '
  'shape this table must not hold — the amount, the issuer and the date are all '
  'in other columns, so this is the only one that answers "why". Both writers '
  '(issueCompGrant, issueVendorSkuComp) supply it and the admin console demands '
  'at least 10 characters. NOT NULL in production since before the migration '
  'corpus recorded it; declared here 2026-09-06 so the two finally agree.';
