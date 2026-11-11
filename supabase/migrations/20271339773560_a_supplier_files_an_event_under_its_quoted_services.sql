-- a supplier files an event under its quoted services
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ═══════════════════════════════════════════════════════════════════════════
-- PIECE 3b · FILES + ANTI-PADDING (negotiation-chat redesign, Piece 3).
--
-- Rulings (DECISION_LOG 2026-11-12):
--   • "UPLOADS BELONG TO THE QUOTED SERVICE" — for a client's event a supplier
--     uploads photos/videos ONLY under a service in that event's quote; they
--     never sync to the supplier's other services.
--   • "DOCUMENTS BELONG TO THE BOOKING, NOT A SERVICE" — contracts, PDFs,
--     menus, receipts go in "This booking", never under a service.
--   • "A SHARED PORTFOLIO PHOTO IS A MAPPING, NEVER A COPY" + "WHY THE MAPPING
--     — ONE STORED COPY PER PHOTO" — a share is a pointer to the existing
--     stored photo, keeping its own service and event.
--   • "EVENT PHOTOS CAN'T BE PADDED FROM OTHER EVENTS — THREE GUARDS" + the
--     approval row (2): window = the day before → the day after the event;
--     FIVE GUARDS (4): the couple's approval is ALWAYS required.
--   • "FILES · HUB · FORMS DESIGN APPROVED" — a couple's Hide takes a shown
--     photo off at once (and posts a line in the supplier's chat — the action).
--   • "EVERYTHING SHARED IN THE CHAT IS COLLECTED ON FILES, SORTED BY KIND" —
--     the 'unfiled' and 'links' groups exist here so Piece 3c writes no schema.
--
-- TWO TABLES + ONE VIEW + ONE RPC:
--   supplier_media           ONE stored copy per file per shop, keyed by its
--                            content hash (UNIQUE shop × sha256). The same
--                            bytes uploaded twice are ONE row — never two R2
--                            objects, never two media rows.
--   event_supplier_files     what a shop filed for ONE event, by group:
--       service   a photo/video under a QUOTED service      (media_id)
--       booking   a document — "This booking"                (media_id | chat msg)
--       linked    a portfolio photo MAPPED to this event      (portfolio_ref — NO
--                 media row, NO copy; keeps its own service; never counts)
--       unfiled   a photo/video from the chat, not filed yet  (chat_message_id)
--       links     a link pasted in the chat                   (link_url)
--   event_supplier_photos_listed (view) — THE ONE RULE for "listed on the shop
--                            as FROM this event": a service photo/video that
--                            COUNTS (first time these bytes were filed, not
--                            already in the portfolio), whose own taken-date
--                            is the day before → the day after the event (or
--                            undated), AND that the couple SHOWED. Computed
--                            live, so a moved event date or a Hide applies at
--                            once — no stored flag to go stale.
--   couple_decide_supplier_file(file, 'shown' | 'hidden') — the couple's
--                            only write; the supplier can never set it.
--
-- RLS at CREATE TABLE (RLS_Policy_Pattern: C = vendor-owned, couple read of
-- their event's rows). The supplier writes only under its own shop, only into
-- an event it talks to (a chat thread), and never the couple's decision
-- (column grants). The couple reads its event's files and decides through
-- the RPC.
--
-- NOT HERE (stated, not invented): the shop page does not read the view yet
-- (no public consumer is built in this piece); the unsettled booking-fee hold
-- greys the Hub tiles in the UI (the shipped fee gate) and is not folded into
-- the view; hashes of photos ALREADY on a portfolio before this piece are
-- unknown (they were stored without one) — `in_portfolio` is set when a
-- hashed upload is put on the portfolio.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · supplier_media — one stored copy per file per shop ───────────────
CREATE TABLE IF NOT EXISTS public.supplier_media (
  media_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  content_sha256    TEXT NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  r2_ref            TEXT NOT NULL CHECK (r2_ref LIKE 'r2://%' AND length(r2_ref) <= 500),
  mime              TEXT NOT NULL CHECK (length(mime) BETWEEN 3 AND 120),
  size_bytes        BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
  -- The photo's OWN taken-date (EXIF DateTimeOriginal), read from the file
  -- before upload. NULL = no date on the photo.
  taken_at          TIMESTAMPTZ,
  -- The same bytes sit on the shop's portfolio: a link everywhere, never counts for an event.
  in_portfolio      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT supplier_media_one_copy UNIQUE (vendor_profile_id, content_sha256)
);

ALTER TABLE public.supplier_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_media_owner_select ON public.supplier_media;
CREATE POLICY supplier_media_owner_select
  ON public.supplier_media FOR SELECT
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS supplier_media_owner_insert ON public.supplier_media;
CREATE POLICY supplier_media_owner_insert
  ON public.supplier_media FOR INSERT
  TO authenticated
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS supplier_media_owner_update ON public.supplier_media;
CREATE POLICY supplier_media_owner_update
  ON public.supplier_media FOR UPDATE
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- The stored object lives in the shop's OWN private folder.
CREATE OR REPLACE FUNCTION public.guard_supplier_media_own_folder()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.r2_ref NOT LIKE 'r2://setnayan-thread-files/supplier-files/' || NEW.vendor_profile_id::text || '/%' THEN
    RAISE EXCEPTION 'a shop''s file is stored in its own folder' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS supplier_media_own_folder_guard ON public.supplier_media;
CREATE TRIGGER supplier_media_own_folder_guard
  BEFORE INSERT OR UPDATE OF r2_ref, vendor_profile_id ON public.supplier_media
  FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_media_own_folder();

-- No DELETE (a stored copy may back files on several events); the hash, ref
-- and date are written once — only in_portfolio may change.
REVOKE ALL ON public.supplier_media FROM anon, authenticated;
GRANT SELECT ON public.supplier_media TO authenticated;
GRANT INSERT (vendor_profile_id, content_sha256, r2_ref, mime, size_bytes, taken_at, in_portfolio)
  ON public.supplier_media TO authenticated;
GRANT UPDATE (in_portfolio) ON public.supplier_media TO authenticated;

COMMENT ON TABLE public.supplier_media IS
  'ONE stored copy per file per shop, keyed by content hash (DECISION_LOG 2026-11-12 "ONE STORED COPY PER PHOTO", "same-file check"). The same bytes are never stored twice: a second upload finds this row and becomes a link. Piece 3b.';

-- ── 2 · event_supplier_files — what a shop filed for one event ───────────
CREATE TABLE IF NOT EXISTS public.event_supplier_files (
  file_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  grp               TEXT NOT NULL CHECK (grp IN ('service', 'booking', 'linked', 'unfiled', 'links')),
  kind              TEXT NOT NULL CHECK (kind IN ('photo', 'video', 'document', 'link')),
  vendor_service_id UUID REFERENCES public.vendor_services(vendor_service_id) ON DELETE CASCADE,
  media_id          UUID REFERENCES public.supplier_media(media_id),
  portfolio_ref     TEXT CHECK (portfolio_ref IS NULL OR (portfolio_ref LIKE 'r2://%' AND length(portfolio_ref) <= 500)),
  link_url          TEXT CHECK (link_url IS NULL OR (link_url ~ '^https?://' AND length(link_url) <= 1000)),
  chat_message_id   UUID REFERENCES public.chat_messages(message_id) ON DELETE SET NULL,
  name              TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  size_bytes        BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
  mime              TEXT,
  -- Copied from supplier_media by the trigger, never typed per file.
  taken_at          TIMESTAMPTZ,
  -- Same bytes already filed elsewhere → this row is a LINK to that file and never counts.
  dedupe_of         UUID REFERENCES public.event_supplier_files(file_id) ON DELETE SET NULL,
  counts            BOOLEAN NOT NULL DEFAULT FALSE,
  couple_decision   TEXT NOT NULL DEFAULT 'waiting' CHECK (couple_decision IN ('waiting', 'shown', 'hidden')),
  decided_at        TIMESTAMPTZ,
  created_by        UUID DEFAULT auth.uid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Each group carries exactly its own payload.
  CONSTRAINT event_supplier_files_shape CHECK (
    CASE grp
      -- A photo/video under a quoted service: an uploaded stored copy.
      WHEN 'service' THEN kind IN ('photo', 'video') AND vendor_service_id IS NOT NULL
        AND media_id IS NOT NULL AND portfolio_ref IS NULL AND link_url IS NULL
      -- A document: never under a service.
      WHEN 'booking' THEN kind = 'document' AND vendor_service_id IS NULL
        AND (media_id IS NOT NULL OR chat_message_id IS NOT NULL) AND portfolio_ref IS NULL AND link_url IS NULL
      -- A portfolio photo MAPPED here: a pointer, no stored copy of its own.
      WHEN 'linked' THEN kind IN ('photo', 'video') AND portfolio_ref IS NOT NULL
        AND media_id IS NULL AND link_url IS NULL
      -- From the chat, not filed yet.
      WHEN 'unfiled' THEN kind IN ('photo', 'video') AND vendor_service_id IS NULL
        AND chat_message_id IS NOT NULL AND portfolio_ref IS NULL AND link_url IS NULL
      ELSE kind = 'link' AND link_url IS NOT NULL AND vendor_service_id IS NULL
        AND media_id IS NULL AND portfolio_ref IS NULL
    END
  ),
  -- Only a service photo counts.
  CONSTRAINT event_supplier_files_counts_service CHECK (NOT counts OR grp = 'service')
);

CREATE INDEX IF NOT EXISTS event_supplier_files_event_idx
  ON public.event_supplier_files (event_id, vendor_profile_id, grp);
CREATE INDEX IF NOT EXISTS event_supplier_files_media_idx
  ON public.event_supplier_files (media_id) WHERE media_id IS NOT NULL;
-- 🔑 THE SAME BYTES NEVER COUNT TWICE — whatever the trigger does, the database holds it.
CREATE UNIQUE INDEX IF NOT EXISTS event_supplier_files_counts_once
  ON public.event_supplier_files (media_id) WHERE counts;
-- One mapping per portfolio photo per event (a second share is the same pointer).
CREATE UNIQUE INDEX IF NOT EXISTS event_supplier_files_one_mapping
  ON public.event_supplier_files (event_id, vendor_profile_id, portfolio_ref) WHERE grp = 'linked';

ALTER TABLE public.event_supplier_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_supplier_files_select ON public.event_supplier_files;
CREATE POLICY event_supplier_files_select
  ON public.event_supplier_files FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR event_id IN (SELECT public.current_couple_event_ids())
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS event_supplier_files_vendor_insert ON public.event_supplier_files;
CREATE POLICY event_supplier_files_vendor_insert
  ON public.event_supplier_files FOR INSERT
  TO authenticated
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS event_supplier_files_vendor_update ON public.event_supplier_files;
CREATE POLICY event_supplier_files_vendor_update
  ON public.event_supplier_files FOR UPDATE
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS event_supplier_files_vendor_delete ON public.event_supplier_files;
CREATE POLICY event_supplier_files_vendor_delete
  ON public.event_supplier_files FOR DELETE
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- (supplier_media, created above, reads this table — so its couple lane lives here.)
-- The couple sees the stored copy behind a file of THEIR event (to decide on it) —
-- never the shop's other copies.
DROP POLICY IF EXISTS supplier_media_couple_select ON public.supplier_media;
CREATE POLICY supplier_media_couple_select
  ON public.supplier_media FOR SELECT
  TO authenticated
  USING (
    media_id IN (
      SELECT f.media_id FROM public.event_supplier_files f
       WHERE f.media_id IS NOT NULL
         AND f.event_id IN (SELECT public.current_couple_event_ids())
    )
  );

-- The supplier never writes counts, dedupe_of, taken_at or the couple's decision.
REVOKE ALL ON public.event_supplier_files FROM anon, authenticated;
GRANT SELECT, DELETE ON public.event_supplier_files TO authenticated;
GRANT INSERT (event_id, vendor_profile_id, grp, kind, vendor_service_id, media_id, portfolio_ref, link_url,
              chat_message_id, name, size_bytes, mime)
  ON public.event_supplier_files TO authenticated;
GRANT UPDATE (grp, vendor_service_id, name, updated_at) ON public.event_supplier_files TO authenticated;

-- ── 3 · the cross-row rules (a policy sees one row) ──────────────────────
-- SECURITY DEFINER so the counting look-up sees every copy of these bytes
-- (another event's row the caller may not read) — it reveals nothing back.
CREATE OR REPLACE FUNCTION public.guard_event_supplier_file()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.supplier_media%ROWTYPE;
  first_id UUID;
BEGIN
  -- Only into an event the shop talks to.
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_threads t
     WHERE t.event_id = NEW.event_id AND t.vendor_profile_id = NEW.vendor_profile_id
  ) THEN
    RAISE EXCEPTION 'a shop files only for an event it talks to' USING ERRCODE = '42501';
  END IF;

  -- UPLOADS BELONG TO THE QUOTED SERVICE: a service photo sits under a service
  -- of THIS event's quote (sent, seen or accepted) — never another of the shop's.
  IF NEW.grp = 'service' AND NOT EXISTS (
    SELECT 1 FROM public.vendor_proposals p
     WHERE p.event_id = NEW.event_id
       AND p.vendor_profile_id = NEW.vendor_profile_id
       AND p.status IN ('sent', 'viewed', 'accepted')
       AND jsonb_typeof(p.service_card_ids) = 'array'
       AND p.service_card_ids ? NEW.vendor_service_id::text
  ) THEN
    RAISE EXCEPTION 'a photo is filed only under a service in this event''s quote' USING ERRCODE = '42501';
  END IF;

  -- A mapped portfolio photo keeps its OWN service — one of the shop's own cards.
  IF NEW.vendor_service_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.vendor_services s
     WHERE s.vendor_service_id = NEW.vendor_service_id AND s.vendor_profile_id = NEW.vendor_profile_id
  ) THEN
    RAISE EXCEPTION 'a file names one of the shop''s own services' USING ERRCODE = '42501';
  END IF;

  -- A chat file is a message of THIS shop's thread with THIS event.
  IF NEW.chat_message_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.chat_message_id IS DISTINCT FROM OLD.chat_message_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.chat_messages c
        JOIN public.chat_threads t ON t.thread_id = c.thread_id
        WHERE c.message_id = NEW.chat_message_id
          AND t.event_id = NEW.event_id AND t.vendor_profile_id = NEW.vendor_profile_id
     ) THEN
    RAISE EXCEPTION 'a chat file comes from this event''s own chat' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Re-filed under another service → the couple decides again.
    IF NEW.vendor_service_id IS DISTINCT FROM OLD.vendor_service_id OR NEW.grp IS DISTINCT FROM OLD.grp THEN
      NEW.couple_decision := 'waiting';
      NEW.decided_at := NULL;
    END IF;
    NEW.updated_at := NOW();
  END IF;

  -- The stored copy: the shop's own; its date is the FILE's date, never typed per row.
  IF NEW.media_id IS NOT NULL THEN
    SELECT * INTO m FROM public.supplier_media WHERE media_id = NEW.media_id;
    IF NOT FOUND OR m.vendor_profile_id <> NEW.vendor_profile_id THEN
      RAISE EXCEPTION 'a file points at the shop''s own stored copy' USING ERRCODE = '42501';
    END IF;
    NEW.taken_at := m.taken_at;
  ELSE
    NEW.taken_at := NULL;
  END IF;

  -- SAME FILE NEVER COUNTS TWICE: the first service file of these bytes counts;
  -- any later one — another event, the same event, or bytes already on the
  -- portfolio — is a LINK to it.
  NEW.counts := FALSE;
  NEW.dedupe_of := NULL;
  IF NEW.grp = 'service' THEN
    SELECT f.file_id INTO first_id
      FROM public.event_supplier_files f
     WHERE f.media_id = NEW.media_id AND f.counts AND f.file_id <> NEW.file_id
     LIMIT 1;
    IF first_id IS NOT NULL THEN
      NEW.dedupe_of := first_id;
    ELSIF NOT m.in_portfolio THEN
      NEW.counts := TRUE;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS event_supplier_files_guard ON public.event_supplier_files;
CREATE TRIGGER event_supplier_files_guard
  BEFORE INSERT OR UPDATE ON public.event_supplier_files
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_supplier_file();

COMMENT ON TABLE public.event_supplier_files IS
  'What a shop filed for ONE event (Piece 3b, DECISION_LOG 2026-11-12): photos/videos under a QUOTED service · documents in "This booking" · portfolio photos MAPPED (portfolio_ref, no copy) · chat files not filed yet · links. counts/dedupe_of/taken_at are the trigger''s; couple_decision is the couple''s (couple_decide_supplier_file). What lists on the shop is the view event_supplier_photos_listed.';

-- ── 4 · THE ONE LISTING RULE — a live view ────────────────────────────────
CREATE OR REPLACE VIEW public.event_supplier_photos_listed
WITH (security_invoker = true) AS
SELECT f.file_id, f.event_id, f.vendor_profile_id, f.vendor_service_id, f.media_id, f.kind, f.name, f.taken_at, f.decided_at
  FROM public.event_supplier_files f
  JOIN public.events e ON e.event_id = f.event_id
 WHERE f.grp = 'service'
   AND f.counts
   -- (FIVE GUARDS 4) the couple's yes is ALWAYS required — the window is a filter, never a pass.
   AND f.couple_decision = 'shown'
   -- (the approved window) the photo's own date, the day before → the day after the event, Manila time;
   -- an undated photo lists on the couple's yes alone.
   AND (
     f.taken_at IS NULL
     OR (e.event_date IS NOT NULL
         AND (f.taken_at AT TIME ZONE 'Asia/Manila')::date BETWEEN e.event_date - 1 AND e.event_date + 1)
   );

REVOKE ALL ON public.event_supplier_photos_listed FROM anon, authenticated;
GRANT SELECT ON public.event_supplier_photos_listed TO authenticated;

COMMENT ON VIEW public.event_supplier_photos_listed IS
  'THE ONE RULE for a supplier photo listed on its shop as FROM an event (DECISION_LOG 2026-11-12 three guards + FIVE GUARDS 4): filed under a quoted service · counts (first copy of these bytes, not already on the portfolio) · the couple showed it · its own taken-date the day before → the day after the event, or undated. Live: a Hide or a moved date applies at once.';

-- ── 5 · the couple decides — their only write ─────────────────────────────
CREATE OR REPLACE FUNCTION public.couple_decide_supplier_file(p_file_id UUID, p_decision TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f public.event_supplier_files%ROWTYPE;
BEGIN
  IF p_decision NOT IN ('shown', 'hidden') THEN
    RAISE EXCEPTION 'show or hide' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO f FROM public.event_supplier_files WHERE file_id = p_file_id;
  IF NOT FOUND OR f.event_id NOT IN (SELECT public.current_couple_event_ids()) THEN
    RAISE EXCEPTION 'only the couple of this event decides' USING ERRCODE = '42501';
  END IF;
  IF f.grp <> 'service' THEN
    RAISE EXCEPTION 'only a photo filed under a service is shown on a shop' USING ERRCODE = '22023';
  END IF;
  -- Written directly (this function owns the row): the decision column is not
  -- in any browser grant, so this is the ONLY way it changes.
  UPDATE public.event_supplier_files
     SET couple_decision = p_decision, decided_at = NOW()
   WHERE file_id = p_file_id;
  RETURN p_decision;
END $$;

REVOKE ALL ON FUNCTION public.couple_decide_supplier_file(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.couple_decide_supplier_file(UUID, TEXT) TO authenticated;

COMMIT;
