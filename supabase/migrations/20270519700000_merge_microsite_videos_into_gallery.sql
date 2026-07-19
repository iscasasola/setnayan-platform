-- merge_microsite_videos_into_gallery
--
-- Owner decision 2026-07-05: ONE all-tier video system. The Enterprise-only
-- "Films" rack (vendor_profiles.microsite_video_ids) is folded into the all-tier
-- "Featured videos" gallery (vendor_profiles.gallery_video_links) so vendors
-- have a single place to manage videos and the public page renders one set.
--
-- WHAT THIS DOES (per vendor, once):
--   • Converts every microsite_video_ids entry — stored as a provider-prefixed
--     ref — into a canonical full URL that gallery_video_links / parseVideoLink
--     understands:
--       vimeo:{id}:{hash}  -> https://vimeo.com/{id}/{hash}
--       vimeo:{id}         -> https://vimeo.com/{id}
--       {11-char yt id}    -> https://www.youtube.com/watch?v={id}   (legacy bare id)
--   • Merges the converted URLs into gallery_video_links, GALLERY FIRST then
--     films, de-duplicated (case-sensitive exact match), preserving order.
--   • Caps the merged result at 10 to satisfy the existing
--     gallery_video_links CHECK (cardinality <= 10): keep the first 10, drop the
--     rest (a no-op in practice — pre-reset there are 0 vendors with films).
--
-- NOT DROPPED: microsite_video_ids is intentionally LEFT IN PLACE (data kept as
-- a backstop). The app stops reading/writing it after this PR — a future
-- cleanup migration can drop the column once we're confident nothing depends on
-- it.
--
-- IDEMPOTENT: re-running merges the same converted URLs again, but the dedupe
-- against the already-merged gallery makes it a no-op on the second pass. Only
-- touches rows that actually have films, so it's cheap + re-safe.
--
-- KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).

DO $$
DECLARE
  v_row     RECORD;
  v_ref     TEXT;
  v_url     TEXT;
  v_parts   TEXT[];
  v_merged  TEXT[];
BEGIN
  FOR v_row IN
    SELECT vendor_profile_id,
           microsite_video_ids,
           gallery_video_links
    FROM public.vendor_profiles
    WHERE microsite_video_ids IS NOT NULL
      AND cardinality(microsite_video_ids) > 0
  LOOP
    -- Start from the existing gallery links (gallery leads, films follow).
    v_merged := COALESCE(v_row.gallery_video_links, ARRAY[]::TEXT[]);

    FOREACH v_ref IN ARRAY v_row.microsite_video_ids
    LOOP
      v_ref := btrim(v_ref);
      CONTINUE WHEN v_ref = '' OR v_ref IS NULL;

      IF lower(v_ref) LIKE 'vimeo:%' THEN
        -- vimeo:{id}[:{hash}] — split on ':' → [vimeo, id, hash?]
        v_parts := string_to_array(v_ref, ':');
        IF cardinality(v_parts) >= 2 AND v_parts[2] ~ '^\d+$' THEN
          IF cardinality(v_parts) >= 3 AND v_parts[3] <> '' THEN
            v_url := 'https://vimeo.com/' || v_parts[2] || '/' || v_parts[3];
          ELSE
            v_url := 'https://vimeo.com/' || v_parts[2];
          END IF;
        ELSE
          CONTINUE;  -- malformed vimeo ref — skip
        END IF;
      ELSIF v_ref ~ '^[A-Za-z0-9_-]{11}$' THEN
        -- Legacy bare 11-char YouTube id.
        v_url := 'https://www.youtube.com/watch?v=' || v_ref;
      ELSE
        CONTINUE;  -- unrecognized ref — skip (never rendered anyway)
      END IF;

      -- De-dupe (exact match) then append.
      IF NOT (v_url = ANY (v_merged)) THEN
        v_merged := array_append(v_merged, v_url);
      END IF;
    END LOOP;

    -- Respect the gallery_video_links CHECK (cardinality <= 10): keep first 10.
    IF cardinality(v_merged) > 10 THEN
      v_merged := v_merged[1:10];
    END IF;

    -- Only write when the merge actually changed the gallery.
    IF v_merged IS DISTINCT FROM COALESCE(v_row.gallery_video_links, ARRAY[]::TEXT[]) THEN
      UPDATE public.vendor_profiles
      SET gallery_video_links = v_merged,
          updated_at = now()
      WHERE vendor_profile_id = v_row.vendor_profile_id;
    END IF;
  END LOOP;
END $$;
