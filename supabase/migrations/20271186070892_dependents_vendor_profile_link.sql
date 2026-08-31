-- ============================================================================
-- 20271186070892_dependents_vendor_profile_link.sql
--
-- A BUSINESS ALREADY EXISTS TWICE, AND THE TWO ROWS HAVE NEVER MET.
--
-- Opening a shop writes `vendor_profiles`. Naming a business on the People page
-- writes `dependents` with dependent_kind = 'business'. Until this migration
-- nothing joined them, so a supplier who had spent four screens telling us the
-- name of their business still had to type it in a second time before the
-- platform would admit the business existed as a thing they care for. And every
-- re-run of the open-shop wizard would have minted ANOTHER record, because
-- there was no key to be idempotent against.
--
-- WHAT THIS ADDS
--   • dependents.vendor_profile_id — "this alaga IS that shop". NULLABLE and
--     NULL for every row that exists today and for every hand-typed business:
--     an alaga does not need a shop, and a business someone names on the People
--     page (a sari-sari store, a family farm) has none.
--   • A PARTIAL UNIQUE index on (owner_user_id, vendor_profile_id) — the
--     idempotency key. It is what makes "opening a shop creates EXACTLY ONE
--     business record" a fact of the database rather than a hope about the
--     order of two statements. `ON CONFLICT DO NOTHING` upstream reads it.
--
-- WHY THE KEY IS (owner, shop) AND NOT (shop) ALONE
--   A business alaga can be REHOMED (dependent-actions.ts `createHandoverLink`
--   → purpose 'rehome' for every non-person kind), which moves owner_user_id to
--   a new guardian while the shop stays where it is. A bare UNIQUE(shop) would
--   then make the ORIGINAL owner's next open-shop save fail on a unique
--   violation — i.e. a feature about record-keeping would start costing people
--   their shop. Keying on the pair fails OPEN: the old guardian gets a fresh
--   record, nobody is blocked. Duplicate rows for one shop across two ACCOUNTS
--   are the honest reading anyway — each account is describing its own care.
--
-- ⚠ ON DELETE SET NULL, NOT CASCADE. Erasure (lib/erasure/purge.ts) deletes
--   `dependents` by owner_user_id and deletes vendor rows elsewhere; a CASCADE
--   here would let deleting a SHOP silently delete a person's alaga record, and
--   an FK that can block is an FK that can break an erasure run. SET NULL keeps
--   the alaga (it is the owner's record, not the shop's) and simply stops
--   claiming a shop that is gone.
--
-- ⚠ NO NEW TABLE, VIEW OR FUNCTION ⇒ no new object carrying the default ACL, so
--   there is nothing here to REVOKE from anon. No policy, USING or WITH CHECK
--   clause is touched; the column is reachable only through
--   `dependents_owner_all` (RLS Pattern A, owner-only), exactly like every other
--   column on this table.
--
-- 📋 THE EXPOSURE BASELINE GAINS EXACTLY ONE LINE, DELIBERATELY:
--     col  public.dependents.vendor_profile_id  anon=- authenticated=SIU
--   — byte-identical to all 21 sibling columns, and `anon=-`: the public
--   internet reaches none of it. It is not narrowed to SELECT-only because
--   Postgres subsumes a column-level REVOKE under a table-level grant, so
--   "tightening" this one column would mean revoking INSERT/UPDATE on the TABLE
--   and re-granting all 22 columns individually — a far larger change to the
--   grant shape of a table holding a child's birthdate, to close a much smaller
--   door. What that door is: an authenticated user could UPDATE their OWN row
--   to point at a shop they do not own. The FK means it must be a REAL shop, the
--   partial unique index means one per pair, the page then reads
--   `vendor_profiles` under the USER's client (so RLS still decides what they
--   see), and the result is visible on nobody's screen but their own. No
--   cross-account read, no denial, and open-shop's idempotency read keys on
--   their own shop id so a forged row cannot block their real record.
--
-- ⚠ THIS COLUMN IS NOT SENSITIVE PI. It names a business, which is a public
--   commercial entity — the person-only rules (age fence, birth_date_consent_at,
--   religion) are untouched and remain person-only. A business may NOT carry a
--   birthdate, a religion or a sex, and nothing here changes that.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS, and the FK
-- is added only when absent. Ends with a post-condition that RAISEs if the
-- uniqueness it promises does not actually hold.
-- ============================================================================

BEGIN;

ALTER TABLE public.dependents
  ADD COLUMN IF NOT EXISTS vendor_profile_id UUID;

-- The FK, added separately so the whole migration stays re-runnable (ADD
-- CONSTRAINT has no IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.dependents'::regclass
       AND conname  = 'dependents_vendor_profile_id_fkey'
  ) THEN
    ALTER TABLE public.dependents
      ADD CONSTRAINT dependents_vendor_profile_id_fkey
      FOREIGN KEY (vendor_profile_id)
      REFERENCES public.vendor_profiles(vendor_profile_id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- THE IDEMPOTENCY KEY. Partial, so the millions of alaga that are not shops do
-- not contend for it: NULL vendor_profile_id rows are simply not in the index.
CREATE UNIQUE INDEX IF NOT EXISTS dependents_owner_vendor_profile_key
  ON public.dependents (owner_user_id, vendor_profile_id)
  WHERE vendor_profile_id IS NOT NULL;

-- Post-condition. Says the invariant in its own right and fails loudly rather
-- than leaving a "unique" index that is not (e.g. if a future edit recreates it
-- non-unique or drops the WHERE clause).
DO $$
DECLARE
  dup_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT owner_user_id, vendor_profile_id
      FROM public.dependents
     WHERE vendor_profile_id IS NOT NULL
     GROUP BY owner_user_id, vendor_profile_id
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'dependents_owner_vendor_profile_key does not hold: % duplicated (owner, shop) pair(s). A shop must have exactly one business alaga per owner.',
      dup_count;
  END IF;
END $$;

COMMENT ON COLUMN public.dependents.vendor_profile_id IS
  'The shop this business alaga IS (vendor_profiles.vendor_profile_id), or NULL. Written once by app/open-shop/actions.ts when a supplier opens a shop, so a business gets a record without anyone typing it twice; NULL for every hand-typed alaga and every non-business kind. Unique per (owner_user_id, vendor_profile_id) — that partial index is the idempotency key that makes re-running the wizard create no duplicate. ON DELETE SET NULL: the alaga belongs to its owner, not to the shop.';

COMMIT;
