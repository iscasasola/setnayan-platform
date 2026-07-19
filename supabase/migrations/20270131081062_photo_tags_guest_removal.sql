-- photo_tags_guest_removal
-- Guest "Not me" / face-tag removal (RA 10173, the data subject's right to
-- object to a specific processing outcome). A guest can drop the auto_face tag
-- of THEMSELVES on a single photo without revoking their whole enrollment.
--
-- Mechanism: a SOFT tombstone, not a hard DELETE. A deleted row would simply be
-- re-added by the next auto-tag run — `autoTagCapture` reads existing photo_tags
-- to fill `alreadyTaggedGuestIds` (lib/face-match.ts), and a vanished row stops
-- excluding that (guest, photo) pair. Keeping the row with `removed_at` set means
-- the guest_id stays in `alreadyTaggedGuestIds` forever, so `planAutoTags` never
-- re-tags it. The existing UNIQUE (source_table, source_id, guest_id) makes the
-- tombstone idempotent (one row per pair, reused as its own gravestone).
--
-- Reads (guest gallery, couple gallery dot colour) filter `removed_at IS NULL`
-- in app code so a removed tag stops surfacing the photo / colouring the dot.
--
-- No new RLS policy: photo_tags is service-role / DEFINER-write only by design
-- (zero-account guests have no auth.uid()); the removal runs on the admin client
-- guarded by the signed guest-session cookie + a WHERE clause pinned to
-- source='auto_face' + the guest's own guest_id. The existing photo_tags_admin_all
-- FOR ALL policy already covers the service-role write of these columns.

ALTER TABLE public.photo_tags
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removed_by TEXT
    CHECK (removed_by IS NULL OR removed_by IN ('guest', 'couple', 'admin'));

-- Live tags only (the hot path for both galleries): skip tombstones cheaply.
CREATE INDEX IF NOT EXISTS photo_tags_guest_live_idx
  ON public.photo_tags (guest_id)
  WHERE removed_at IS NULL;
