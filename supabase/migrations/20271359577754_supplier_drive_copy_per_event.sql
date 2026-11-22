-- supplier_drive_copy_per_event
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ☁️ "COPY THIS EVENT TO GOOGLE DRIVE" — FOR A SUPPLIER, PER EVENT (owner 22 Nov 2026; corpus DECISION_LOG
-- "COPY THIS EVENT TO GOOGLE DRIVE", SUPPLIER_SUBSCRIPTIONS_BUILD_SPEC_2026-11-22 § H+).
--
-- REUSE, NOT A SECOND SYSTEM. The shipped Drive copy layer (20260726000000_drive_copy_layer_foundation +
-- 20270721479486 per-Drive folders) is the couple's: one Drive per EVENT, a grant keyed (event_id, provider). A
-- supplier's Drive belongs to the SHOP, and one shop copies many events into it. So the same four tables gain ONE
-- dimension — the shop that owns the copy — and nothing else:
--
--   oauth_grants         + vendor_profile_id; a shop's Drive grant is provider 'drive_supplier' with NO event
--                          (event_id becomes nullable; exactly one of the two owners is set — CHECK below).
--   oauth_state          + vendor_profile_id; provider 'drive_supplier'. event_id stays NOT NULL: it is the event the
--                          supplier pressed "Copy to Google Drive" on, so the callback returns them there.
--   drive_copy_folders   + vendor_profile_id; drive_provider 'drive_supplier'; kinds 'supplier_files' ·
--                          'supplier_album' (one folder per event in the shop's Drive, two subfolders).
--   drive_copy_artifacts + vendor_profile_id; artifact types 'supplier_files' · 'supplier_album'.
--
-- 🔑 THE COUPLE'S ROWS ARE UNCHANGED: every existing row has vendor_profile_id NULL and keeps its exact meaning. The
-- couple's code paths now say `vendor_profile_id IS NULL` out loud (lib/drive-copy.ts), so a shop's pending copies can
-- never be pushed into a couple's Drive.
--
-- 🔑 NO DUPLICATES: drive_copy_artifacts keeps its UNIQUE (event_id, r2_object_key). A shop's stored objects live under
-- its OWN prefix (`supplier-files/<shop>/…` — guard_supplier_media_own_folder; `papic/vendor-<shop>/portfolio/…`), so a
-- shop's key can never be a couple's or another shop's key: the one ledger still means one Drive copy per object.
--
-- 🔑 NEVER COUNTED, NEVER A GATE: nothing here touches vendor_storage_used_bytes or any plan check.
--
-- RLS: all four tables already have RLS on. No new policy — a shop's grant and copy state are read and written by the
-- server only (service role), after the route proves the signed-in person acts for that shop. `event_member_reads_
-- oauth_grants` matches on event_id, so a shop grant (event_id NULL) is visible to no event member.

BEGIN;

-- ── 1 · oauth_grants: a grant may belong to a SHOP instead of an event ────────────────────────────────────────────
ALTER TABLE public.oauth_grants
  ADD COLUMN IF NOT EXISTS vendor_profile_id UUID
    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE;

ALTER TABLE public.oauth_grants ALTER COLUMN event_id DROP NOT NULL;

ALTER TABLE public.oauth_grants DROP CONSTRAINT IF EXISTS oauth_grants_provider_check;
ALTER TABLE public.oauth_grants ADD CONSTRAINT oauth_grants_provider_check
  CHECK (provider IN ('youtube', 'drive', 'tiktok', 'drive_photo_delivery', 'drive_overflow', 'drive_supplier'));

-- Exactly one owner: an event's grant (every row before this migration) or a shop's Drive.
ALTER TABLE public.oauth_grants DROP CONSTRAINT IF EXISTS oauth_grants_one_owner;
ALTER TABLE public.oauth_grants ADD CONSTRAINT oauth_grants_one_owner
  CHECK (
    (event_id IS NOT NULL AND vendor_profile_id IS NULL AND provider <> 'drive_supplier')
    OR (event_id IS NULL AND vendor_profile_id IS NOT NULL AND provider = 'drive_supplier')
  );

-- One Drive per shop. (The couple's UNIQUE (event_id, provider) is untouched: NULL event ids never collide there.)
CREATE UNIQUE INDEX IF NOT EXISTS oauth_grants_one_drive_per_shop
  ON public.oauth_grants (vendor_profile_id, provider)
  WHERE vendor_profile_id IS NOT NULL;

COMMENT ON COLUMN public.oauth_grants.vendor_profile_id IS
  'Owner 2026-11-22 "Copy this event to Google Drive" — set ONLY for a shop''s own Google Drive (provider ''drive_supplier''), which belongs to the shop, not to an event (event_id is NULL on that row). Read and written by the server only.';

-- ── 2 · oauth_state: the round trip remembers the shop ────────────────────────────────────────────────────────────
ALTER TABLE public.oauth_state
  ADD COLUMN IF NOT EXISTS vendor_profile_id UUID
    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE;

ALTER TABLE public.oauth_state DROP CONSTRAINT IF EXISTS oauth_state_provider_check;
ALTER TABLE public.oauth_state ADD CONSTRAINT oauth_state_provider_check
  CHECK (provider IN ('youtube', 'drive', 'tiktok', 'drive_photo_delivery', 'drive_overflow', 'drive_supplier'));

ALTER TABLE public.oauth_state DROP CONSTRAINT IF EXISTS oauth_state_shop_drive;
ALTER TABLE public.oauth_state ADD CONSTRAINT oauth_state_shop_drive
  CHECK ((provider = 'drive_supplier') = (vendor_profile_id IS NOT NULL));

-- ── 3 · drive_copy_folders: a shop's folders for one event ────────────────────────────────────────────────────────
ALTER TABLE public.drive_copy_folders
  ADD COLUMN IF NOT EXISTS vendor_profile_id UUID
    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE;

ALTER TABLE public.drive_copy_folders DROP CONSTRAINT IF EXISTS drive_copy_folders_kind_check;
ALTER TABLE public.drive_copy_folders ADD CONSTRAINT drive_copy_folders_kind_check
  CHECK (kind IN ('root', 'papic', 'patiktok', 'pabati', 'pakanta', 'monogram', 'qr_codes', 'supplier_files', 'supplier_album'));

ALTER TABLE public.drive_copy_folders DROP CONSTRAINT IF EXISTS drive_copy_folders_drive_provider_check;
ALTER TABLE public.drive_copy_folders ADD CONSTRAINT drive_copy_folders_drive_provider_check
  CHECK (drive_provider IN ('drive', 'drive_overflow', 'drive_supplier'));

ALTER TABLE public.drive_copy_folders DROP CONSTRAINT IF EXISTS drive_copy_folders_shop_owner;
ALTER TABLE public.drive_copy_folders ADD CONSTRAINT drive_copy_folders_shop_owner
  CHECK ((drive_provider = 'drive_supplier') = (vendor_profile_id IS NOT NULL));

-- The find-or-create key widens by the owner. NULLS NOT DISTINCT so the couple's rows (owner NULL) keep exactly the
-- one-row-per-(event, kind, Drive) rule they had; lib/drive-copy.ts upserts on all four columns.
ALTER TABLE public.drive_copy_folders DROP CONSTRAINT IF EXISTS drive_copy_folders_event_kind_provider_key;
ALTER TABLE public.drive_copy_folders DROP CONSTRAINT IF EXISTS drive_copy_folders_event_kind_provider_owner_key;
ALTER TABLE public.drive_copy_folders ADD CONSTRAINT drive_copy_folders_event_kind_provider_owner_key
  UNIQUE NULLS NOT DISTINCT (event_id, kind, drive_provider, vendor_profile_id);

-- ── 4 · drive_copy_artifacts: a shop's files for one event ────────────────────────────────────────────────────────
ALTER TABLE public.drive_copy_artifacts
  ADD COLUMN IF NOT EXISTS vendor_profile_id UUID
    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE;

ALTER TABLE public.drive_copy_artifacts DROP CONSTRAINT IF EXISTS drive_copy_artifacts_artifact_type_check;
ALTER TABLE public.drive_copy_artifacts ADD CONSTRAINT drive_copy_artifacts_artifact_type_check
  CHECK (artifact_type = ANY (ARRAY['papic'::text, 'patiktok'::text, 'pakanta'::text, 'monogram'::text, 'qr_codes'::text,
                                    'supplier_files'::text, 'supplier_album'::text]));

ALTER TABLE public.drive_copy_artifacts DROP CONSTRAINT IF EXISTS drive_copy_artifacts_shop_owner;
ALTER TABLE public.drive_copy_artifacts ADD CONSTRAINT drive_copy_artifacts_shop_owner
  CHECK ((artifact_type IN ('supplier_files', 'supplier_album')) = (vendor_profile_id IS NOT NULL));

-- The shop's per-event progress read ("12 of 40 copied") and its batch.
CREATE INDEX IF NOT EXISTS idx_drive_copy_artifacts_shop_event
  ON public.drive_copy_artifacts (vendor_profile_id, event_id)
  WHERE vendor_profile_id IS NOT NULL;

COMMENT ON COLUMN public.drive_copy_artifacts.vendor_profile_id IS
  'Owner 2026-11-22 "Copy this event to Google Drive" — the shop whose own Drive this file is copied to (artifact types supplier_files / supplier_album). NULL = the couple''s Drive copy, unchanged. Never counted against any storage allowance.';
COMMENT ON COLUMN public.drive_copy_folders.vendor_profile_id IS
  'Owner 2026-11-22 — the shop whose own Drive holds this folder (drive_provider ''drive_supplier''). NULL = the couple''s Drive.';

COMMIT;
