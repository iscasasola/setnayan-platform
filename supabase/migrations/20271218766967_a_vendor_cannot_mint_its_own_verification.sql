-- a_vendor_cannot_mint_its_own_verification
-- ============================================================================
-- A SIGNED-IN VENDOR COULD MINT THEIR OWN "APPROVED" VERIFICATION ROW — AND
-- USE IT TO MAKE OUR RETENTION JOB DELETE AN R2 OBJECT THEY DO NOT OWN.
--
-- ⛔ DO NOT `GRANT INSERT ON public.vendor_verifications TO authenticated`, and
--    do not recreate `vendor_verifications_self_insert`. Read this header
--    first. Either one alone re-opens the hole; both together are how it shipped.
--
-- ── THE DOOR ────────────────────────────────────────────────────────────────
-- Measured from supabase/security/exposure-surface.baseline.txt on origin/main
-- 582ca4f3d (the committed snapshot of live privileges), not inferred:
--
--   tpriv  public.vendor_verifications|authenticated  SIUD
--   col    …every one of the 29 columns…              anon=- authenticated=SIU
--
-- and exactly two policies:
--
--   vendor_verifications_self_read    FOR SELECT  (own profile)
--   vendor_verifications_self_insert  FOR INSERT  (own profile)
--
-- The UPDATE and DELETE table grants are INERT — RLS is enabled and there is no
-- UPDATE or DELETE policy, so both verbs are refused at the policy layer. The
-- live verb is INSERT, because it is the one with a policy behind it.
--
-- And that policy's WITH CHECK constrains exactly ONE column:
--
--   EXISTS (SELECT 1 FROM vendor_profiles vp
--           WHERE vp.vendor_profile_id = vendor_verifications.vendor_profile_id
--             AND vp.user_id = auth.uid())
--
-- It authenticates the SHOP and says nothing about the other 28 columns.
-- `status`, `approved_at`, `approved_by_admin_user_id`, `rejected_at`,
-- `sanctions_clear`, `google_meet_passed`, `reference_calls_passed`,
-- `persona_status`, `expires_at` and all five `*_r2_key` columns are the
-- caller's to choose. This is the eighth instance in this schema of
-- "THE ROW IS YOURS, THE FIELD IS NOT".
--
-- ── NOTHING LEGITIMATE USES THE DOOR ────────────────────────────────────────
-- Grepped the whole repo at 582ca4f3d: there are ZERO writers of this table in
-- application code and ZERO in SQL beyond this table's own CREATE TABLE
-- (20260516010000). Every other reference is a comment, a test, an erasure /
-- export coverage entry, or one of the two READERS — and BOTH readers open
-- `createAdminClient()`:
--
--   apps/web/lib/verification-docs-server.ts:44   createAdminClient()
--   apps/web/lib/vendor-identity-retention.ts:196 createAdminClient()  (the sweep)
--
-- The live vendor intake writes a DIFFERENT table —
-- `vendor_verification_applications.doc_uploads`
-- (app/vendor-dashboard/verify/actions.ts) — which is why this row's INSERT
-- policy has sat unused since 2026-05-16. So revoking INSERT breaks nothing:
-- there is no caller to break.
--
-- ── THE PRIMITIVE THE FORGED ROW REACHES ────────────────────────────────────
-- `sweepVerifications` in apps/web/lib/vendor-identity-retention.ts:
--
--   1. selects rows WHERE approved_at IS NOT NULL OR rejected_at IS NOT NULL
--      — both attacker-chosen on insert
--   2. derives the retention clock from those two columns and skips unless it
--      is past 90 days — so the attacker writes a date 91+ days ago
--   3. calls deleteStoredAsset(row.government_id_r2_key) and
--      deleteStoredAsset(row.bank_account_proof_r2_key) — attacker-chosen
--      strings — and then nulls the columns.
--
-- It runs on the ADMIN client, so RLS protects nothing on the TARGET object.
-- `deleteStoredAsset` → `parseStoredAsset` accepts any of the FIVE buckets in
-- `R2_BUCKETS` (media · thread-files · vendor-contracts · samples ·
-- vendor-verification), so `r2://setnayan-media/<key>` is honoured.
--
-- 🔑 AND `setnayan-media` KEYS ARE PUBLISHED IN OUR OWN PAGE SOURCE. A shop
-- logo is served as a presigned URL carrying `vendors/<uuid>/logo/<uuid>-<name>`
-- in plain sight, so "the key contains a server-side randomUUID and is not
-- guessable" is FALSE for the public bucket. The attacker copies a victim's key
-- off a live page.
--
-- It is not a dormant job: `maybeRunVendorIdentityRetention` is imported by
-- apps/web/app/admin/layout.tsx and fired from `after()` on admin page loads.
--
-- ⇒ END TO END: a signed-in vendor POSTs ONE row through PostgREST with the
--   public anon key — their own vendor_profile_id, approved_at 91+ days ago,
--   government_id_r2_key = 'r2://setnayan-media/<key copied from a public
--   page>' — and the next admin page load deletes that object permanently.
--   The bucket is not versioned.
--
-- ── WHY A REVOKE AND NOT A COLUMN ALLOW-LIST OR A TRIGGER ───────────────────
-- Contrast public.events (20271005100000), where hosts legitimately write most
-- columns and the fix HAD to be a computed per-column allow-list. Here there is
-- no legitimate session-role write of ANY column, so there is nothing to grant
-- back and an allow-list would be a bill with no payer. A validating trigger
-- would likewise be a second source of truth for a workflow that has no first.
--
-- ── WHAT IS REVOKED, AND WHAT IS DELIBERATELY KEPT ──────────────────────────
-- REVOKED at TABLE level from authenticated (and restated for anon):
--   INSERT — the live verb, the exploit.
--   UPDATE, DELETE — already inert for want of a policy. Taken anyway, so the
--   privilege stops depending on a policy's continued ABSENCE. A future
--   migration adding an UPDATE policy would otherwise silently arm the grant.
--
-- 🔒 TABLE level is what drops the column grants. Revoking column-by-column
-- leaves the NEXT column granted, and `has_table_privilege` answers FALSE while
-- a column grant stands — so the post-condition below checks BOTH, per column.
--
-- KEPT: SELECT, and `vendor_verifications_self_read`. Argued, not defaulted:
--   · SELECT is not part of this exploit. The read policy is correctly scoped
--     to the caller's own shop and discloses nothing about anybody else.
--   · Removing it is a strictly WIDER narrowing than the finding supports, and
--     narrowing a live read is its own change with its own question — a shop
--     reading its own verification status is a plausible product capability
--     that the sweep's admin-client reads do not contradict.
--   · Prod holds 0 rows, so keeping SELECT discloses nothing today either way.
--   The honest summary: INSERT had no caller AND an exploit; SELECT has no
--   caller and no exploit. Only the first is this migration's business.
--
-- DROPPED: `vendor_verifications_self_insert`. A policy with no grant behind it
-- is dead weight that READS as a permission, and Postgres needs BOTH a grant
-- and a policy to admit a write — so removing both means two independent things
-- must go wrong before the door reopens. That matters specifically here: these
-- grants come from Supabase's pg_default_acl, which re-applies at CREATE TABLE
-- time, so a `db reset` or a squashed baseline WOULD restore the INSERT grant.
-- With the policy also gone, RLS still refuses the write.
--
-- ── PROVENANCE OF THE GRANT BEING REMOVED ───────────────────────────────────
-- No migration in this repo has ever GRANTed on public.vendor_verifications.
-- The only privilege statement that has ever named it is
-- `REVOKE ALL … FROM anon` (20271147692197). The `authenticated` grant is
-- Supabase's platform default privilege, exactly as
-- tests/db/anon-table-grants-closed.db.test.ts describes for this schema.
--
-- ── DATA STATE / BLAST RADIUS ───────────────────────────────────────────────
-- Production holds 0 rows in public.vendor_verifications (recorded in
-- changelog.d/marketplace-lenses-three.md and changelog.d/we-delete-what-we-
-- promised.md, and in lib/vendor-verification-state.ts). There is no evidence
-- of exploitation and this carries zero data-migration risk.
--
-- ⚠ HONEST LIMIT: the production `BEGIN…ROLLBACK` dry-run this repo normally
-- runs before a privilege migration WAS NOT PERFORMED — this session had no
-- production database access (the Supabase tool returned "You do not have
-- permission to perform this action"). Every object this migration touches was
-- instead verified from the committed exposure baseline and the migration
-- history. See the PR body.
--
-- REVERSIBLE (do not): `GRANT INSERT, UPDATE, DELETE ON
-- public.vendor_verifications TO authenticated;` + recreate the insert policy.
-- ============================================================================

BEGIN;

-- ── 1 · The privilege fix, with a before/after overreach check ──────────────
-- Wrapped in a DO block so SELECT can be SNAPSHOTTED before and compared after.
-- An ABSOLUTE assertion ("authenticated must still hold SELECT") would assert
-- the ENVIRONMENT rather than this migration, and would fail on a fresh replay
-- where the platform default privileges are not emulated. A before/after DIFF
-- asserts exactly the thing that matters — that this migration removed the
-- three write verbs and touched nothing else — and holds on prod and on a
-- freshly-built database alike.
DO $$
DECLARE
  bad        TEXT[] := ARRAY[]::TEXT[];
  r          TEXT;
  v          TEXT;
  before_sel BOOLEAN;
BEGIN
  FOREACH r IN ARRAY ARRAY['authenticated', 'anon'] LOOP
    before_sel := has_table_privilege(r, 'public.vendor_verifications', 'SELECT');

    -- TABLE level. This is what drops the column grants; a column-by-column
    -- revoke would leave the next column granted.
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE ON public.vendor_verifications FROM %I', r
    );

    -- (a) All three write verbs gone at TABLE level.
    FOREACH v IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE'] LOOP
      IF has_table_privilege(r, 'public.vendor_verifications', v) THEN
        bad := array_append(bad, format('%s still holds table %s', r, v));
      END IF;
    END LOOP;

    -- (b) …and at COLUMN level. Postgres checks the table privilege first, but
    --     a stray column grant would still let a narrow write through — and
    --     has_table_privilege() reads FALSE while exactly that column grant
    --     stands, so (a) alone cannot see it.
    --
    --     🪤 DELETE IS DELIBERATELY ABSENT FROM THIS LOOP. It has no column form:
    --     column privileges are SELECT / INSERT / UPDATE / REFERENCES only, and
    --     has_column_privilege(…, 'DELETE') RAISES `unrecognized privilege type`.
    --     The first draft of this file looped all three verbs here and failed
    --     the PGlite replay on exactly that — in production it would have
    --     aborted the migration and blocked every deploy behind it.
    FOREACH v IN ARRAY ARRAY['INSERT', 'UPDATE'] LOOP
      IF EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name   = 'vendor_verifications'
          AND has_column_privilege(r, 'public.vendor_verifications', c.column_name, v)
      ) THEN
        bad := array_append(bad, format('%s still holds a column %s', r, v));
      END IF;
    END LOOP;

    -- (c) NOTHING ELSE may have moved. An overreaching revoke that also took
    --     SELECT would be invisible to any test of the denial path.
    IF has_table_privilege(r, 'public.vendor_verifications', 'SELECT') <> before_sel THEN
      bad := array_append(bad, format('OVERREACH: %s SELECT changed', r));
    END IF;
  END LOOP;

  -- Restate service_role explicitly. It already holds this in prod, so this is
  -- a no-op there — but it stops the migration ASSUMING how service_role got
  -- its grant, and makes it self-sufficient on a fresh database. Both readers
  -- and the retention sweep run as service_role.
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_verifications TO service_role';

  FOREACH v IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
    IF NOT has_table_privilege('service_role', 'public.vendor_verifications', v) THEN
      bad := array_append(bad, format('service_role LOST %s', v));
    END IF;
  END LOOP;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'vendor_verifications privilege post-condition failed: %',
      array_to_string(bad, ', ');
  END IF;
END $$;

-- ── 2 · The second lock · drop the orphaned INSERT policy ───────────────────
-- A grant is not a policy and a policy is not a grant; a write needs both. With
-- the grant gone this policy admits nobody — but it would come back to life the
-- moment pg_default_acl re-granted INSERT on a table rebuild. Removing it means
-- a restored grant is still refused by RLS.
--
-- The SELECT policy is deliberately untouched (see the header).
DROP POLICY IF EXISTS vendor_verifications_self_insert ON public.vendor_verifications;

COMMENT ON TABLE public.vendor_verifications IS
  'Admin verification decision record. WRITTEN BY service_role ONLY - INSERT/UPDATE/DELETE '
  'were revoked from authenticated and anon, and the self-insert policy dropped, because a '
  'forged row could set approved_at and government_id_r2_key freely and steer the RA 10173 '
  'retention sweep into deleting an arbitrary R2 object. Session roles keep SELECT of their '
  'own row only. The live vendor intake is vendor_verification_applications, not this table.';

COMMIT;

-- ----------------------------------------------------------------------------
-- Post-condition — the policy really went, and the read really stayed. (The
-- privilege half is asserted inline above, where the before/after snapshot is.)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  bad TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'vendor_verifications'
      AND policyname = 'vendor_verifications_self_insert'
  ) THEN
    bad := array_append(bad, 'vendor_verifications_self_insert still exists');
  END IF;

  -- The read must survive. Dropping it here would be a silent widening of the
  -- change beyond what the finding supports.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'vendor_verifications'
      AND policyname = 'vendor_verifications_self_read'
  ) THEN
    bad := array_append(bad, 'vendor_verifications_self_read was lost');
  END IF;

  -- RLS must still be on. With no INSERT policy this is what refuses a write
  -- if the grant is ever restored.
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'vendor_verifications'
      AND c.relrowsecurity
  ) THEN
    bad := array_append(bad, 'row level security is OFF on vendor_verifications');
  END IF;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'vendor_verifications post-condition failed: %',
      array_to_string(bad, ', ');
  END IF;
END $$;

-- ============================================================================
-- ⚠ MAINTENANCE NOTE
--
-- A NEW writer of public.vendor_verifications must use createAdminClient()
-- (service_role) and stamp the decision columns from server-derived values. It
-- must NOT be "fixed" by granting the session roles INSERT back.
--
-- apps/web/tests/db/vendor-verifications-write-revoke.db.test.ts fails if the
-- grant or the policy returns. ⚠ That test asserts the CATALOGUE, not
-- enforcement — the PGlite replay runs as SUPERUSER and cannot prove a grant is
-- obeyed.
--
-- The second half of the repair is in TypeScript, deliberately not here: the
-- retention sweep now REFUSES a verification ref outside the vendor-verification
-- bucket and counts the refusal, so even a future writer of these columns cannot
-- turn the job into a general delete. See lib/vendor-identity-retention-core.ts
-- (`verificationRefIsInScope`).
-- ============================================================================
