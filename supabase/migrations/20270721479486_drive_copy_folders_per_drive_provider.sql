-- Per-Drive folder namespace for the 2nd Google Drive per event (owner 2026-07-11)
-- (Pricing.md § 2.1 core-invariant · DECISION_LOG 2026-07-11 · build plan WS3.12b)
--
-- Google folder IDs are PER-DRIVE, so when a couple connects a second Drive
-- (oauth_grants.provider='drive_overflow', added by 20270720727938), that Drive
-- needs its OWN root + artifact subfolders — the folder ids created in Drive #1
-- do not exist in Drive #2. Today drive_copy_folders is keyed (event_id, kind),
-- assuming ONE Drive. This adds a `drive_provider` dimension so each Drive gets
-- its own folder rows.
--
-- Additive + backward-compatible: existing rows default to 'drive' (the primary),
-- so the widened unique (event_id, kind, 'drive') matches the old (event_id, kind)
-- for every existing row — the single-Drive path is byte-for-byte unchanged.
-- Idempotent.

-- 1. The per-Drive dimension (defaults to the primary Drive). -----------------
ALTER TABLE public.drive_copy_folders
  ADD COLUMN IF NOT EXISTS drive_provider TEXT NOT NULL DEFAULT 'drive';

ALTER TABLE public.drive_copy_folders
  DROP CONSTRAINT IF EXISTS drive_copy_folders_drive_provider_check;
ALTER TABLE public.drive_copy_folders
  ADD CONSTRAINT drive_copy_folders_drive_provider_check
    CHECK (drive_provider IN ('drive', 'drive_overflow'));

-- 2. Widen the unique key (event_id, kind) → (event_id, kind, drive_provider). -
-- Drop the old auto-named unique + any prior run of the new one, then re-add.
ALTER TABLE public.drive_copy_folders
  DROP CONSTRAINT IF EXISTS drive_copy_folders_event_id_kind_key;
ALTER TABLE public.drive_copy_folders
  DROP CONSTRAINT IF EXISTS drive_copy_folders_event_kind_provider_key;
ALTER TABLE public.drive_copy_folders
  ADD CONSTRAINT drive_copy_folders_event_kind_provider_key
    UNIQUE (event_id, kind, drive_provider);
