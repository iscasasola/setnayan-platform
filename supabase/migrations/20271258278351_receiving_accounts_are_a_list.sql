-- receiving_accounts_are_a_list
-- Created via `pnpm migration:new`. Idempotent — safe to re-apply.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- Owner, 2026-10-01 (DECISION_LOG "ADMIN APP + EVENT HUB PER TYPE — OWNER
-- ANSWERS"): "Changing or Adding Payment Options in the future like our bank
-- account as a couple or add a mari bank or uno bank, is possible?" ⇒
-- Setnayan's own receiving accounts become a LIST the admin can add to, edit,
-- re-order and remove from; checkout shows them in the order the admin sets.
--
-- ── WHY A COLUMN, NOT A TABLE ────────────────────────────────────────────────
-- The two fixed rails already live on the `platform_settings` singleton, which
-- already has the right access: admin-write through the service role,
-- `authenticated` read (20271014400000 revoked anon entirely and granted
-- table-level SELECT to authenticated, so a new column is readable by checkout
-- with no new grant). A list inside that existing home needs no new RLS, no new
-- policy and no new subsystem; a table would have duplicated all three for a
-- handful of rows.
--
-- ── SHAPE ───────────────────────────────────────────────────────────────────
-- An array of {id, kind, label, account_name, number, qr_url, qr_payload,
-- enabled}. Parsed ONLY by apps/web/lib/payment-channels.ts
-- (parseReceivingAccounts), which drops a malformed entry rather than guess.
--
-- ── THE ONE-TIME MOVE ──────────────────────────────────────────────────────
-- Today's fixed GCash and BDO fields are copied into the list ONCE, as entries
-- with ids 'gcash' and 'bdo' (GCash first — the order checkout has always
-- shown). The ids are kept so every `payments.channel` already written still
-- names its account, and so the monthly-cap meter (whose columns exist for
-- those two only) still applies to them. A rail with no number and no QR is
-- not payable and is not copied.
--
-- The legacy columns are NOT dropped: they are the fallback the owner asked
-- for ("checkout must keep working if the list is empty") and the app keeps the
-- two migrated entries mirrored into them.
--
-- The copy only runs while the list is still empty, so a re-apply never
-- clobbers a list the admin has since edited.

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS receiving_accounts jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_receiving_accounts_is_array;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_receiving_accounts_is_array
  CHECK (jsonb_typeof(receiving_accounts) = 'array');

COMMENT ON COLUMN public.platform_settings.receiving_accounts IS
  'Setnayan''s receiving accounts (banks + e-wallets) as an ordered list the admin manages at /admin/settings/payment-methods. Read only through apps/web/lib/payment-channels.ts, which falls back to the fixed gcash_*/bdo_* columns when this is empty. Changing an account''s number, name or QR goes through approve_payment_account_change (Vendor Agreement § 9.1).';

UPDATE public.platform_settings ps
   SET receiving_accounts = COALESCE((
         SELECT jsonb_agg(e.entry ORDER BY e.ord)
           FROM (
             SELECT 1 AS ord,
                    jsonb_build_object(
                      'id', 'gcash',
                      'kind', 'ewallet',
                      'label', 'GCash',
                      'account_name', ps.gcash_account_name,
                      'number', ps.gcash_number,
                      'qr_url', ps.gcash_qr_url,
                      'qr_payload', ps.gcash_qr_payload,
                      'enabled', COALESCE(ps.gcash_enabled, true)
                    ) AS entry
              WHERE NULLIF(btrim(COALESCE(ps.gcash_number, '')), '') IS NOT NULL
                 OR NULLIF(btrim(COALESCE(ps.gcash_qr_url, '')), '') IS NOT NULL
             UNION ALL
             SELECT 2 AS ord,
                    jsonb_build_object(
                      'id', 'bdo',
                      'kind', 'bank',
                      'label', 'BDO',
                      'account_name', ps.bdo_account_name,
                      'number', ps.bdo_account_number,
                      'qr_url', ps.bdo_qr_url,
                      'qr_payload', ps.bdo_qr_payload,
                      'enabled', COALESCE(ps.bdo_enabled, true)
                    ) AS entry
              WHERE NULLIF(btrim(COALESCE(ps.bdo_account_number, '')), '') IS NOT NULL
                 OR NULLIF(btrim(COALESCE(ps.bdo_qr_url, '')), '') IS NOT NULL
           ) e
       ), '[]'::jsonb)
 WHERE ps.id = 1
   AND ps.receiving_accounts = '[]'::jsonb;
