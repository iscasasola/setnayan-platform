-- ============================================================================
-- no_gallery_word_in_stored_copy
--
-- ⚖ OWNER 2026-10-23: no "gallery" anywhere a person reads it — an event's
-- photos are **Memories**, a supplier's own photos are **Portfolio**, the Mood
-- Board library is **Inspiration**. The app's own strings moved in the
-- no-gallery-word copy PR; the owner then asked for the copy STORED in the
-- database to follow as its own change ("yes, do the migration as a follow-up").
--
-- Measured against production on 2026-10-23 (a read-only scan of every text,
-- varchar, jsonb and array column in `public` for \mgaller(y|ies)\M). Only rows
-- that reach a screen are changed here:
--
--   table                         rows  where it is read
--   moodboard_theme_templates     120   name — the Mood Board theme picker, and
--                                       copied into events.moodboard_theme_name
--                                       when applied (no event holds one today)
--   moodboard_theme_templates       1   description — same picker
--   platform_retail_catalog_v2      2   description — the Event Hub Pro offer
--   canonical_service_schemas       1   a field label the supplier fills in
--                                       (vendor-dashboard/attributes)
--   data_privacy_controls           1   note — the admin privacy console reads
--                                       `note` from here (title/description
--                                       come from lib/data-privacy-controls.ts,
--                                       already reworded)
--
-- NOT changed, on purpose: keys and tokens (`gallery_images`,
-- `gallery_image_uploads_count`, the `gallery` surface in
-- event_type_profiles.enabled_surfaces, std_media `type: gallery`), COMMENT ON
-- text, telemetry/log rows, what couples typed themselves (event_editorial),
-- and the retired `save_the_date_video` service_catalog row (inactive since
-- 2026-05-28, sold nowhere).
--
-- Every change but one is a `replace()` of the exact old phrase, not a typed
-- value, so whatever wording an admin has since given a row is kept and only
-- the old phrase moves. The one exception (COUPLE_WEBSITE_PRO's description) is
-- explained where it is written. Idempotent: a second run finds no old phrase
-- and changes nothing. Prices, keys and ids are untouched.
-- ============================================================================

-- Mood Board themes: the generated suffix "Gallery Vow" became "Atelier Vow" in
-- lib/moodboard-theme-generator.ts; the 120 seeded names follow it. One name
-- puts the article right before the suffix ("Once Upon a Gallery Vow"), so it
-- takes "an" first — a plain replace would read "Once Upon a Atelier Vow".
UPDATE public.moodboard_theme_templates
   SET name       = regexp_replace(name, '(^|\s)([Aa]) Gallery Vow$', '\1\2n Atelier Vow'),
       updated_at = now()
 WHERE name ~ '(^|\s)[Aa] Gallery Vow$';

UPDATE public.moodboard_theme_templates
   SET name       = replace(name, ' Gallery Vow', ' Atelier Vow'),
       updated_at = now()
 WHERE name LIKE '% Gallery Vow';

UPDATE public.moodboard_theme_templates
   SET description = replace(description, 'in the entire gallery', 'in the entire collection'),
       updated_at  = now()
 WHERE description LIKE '%in the entire gallery%';

-- Event Hub Pro: the item is "Photos you add" — the name its widget carries
-- (lib/the-four-photo-names.test.ts) and the code copy already uses.
-- COUPLE_WEBSITE_PRO's description is written WHOLE, as
-- 20271250830175_event_hub_pro_description_drops_colours.sql wrote it: the
-- latest migration that sets it is read by
-- app/dashboard/[eventId]/studio/website-pro/says-what-it-includes.test.ts as
-- the sentence prod shows. Same text as that file, with the one phrase moved
-- (production held exactly that text on 2026-10-23, so no admin wording is lost).
UPDATE public.platform_retail_catalog_v2
SET description =
      'Every premium touch on your Event Hub in one unlock — the cinematic '
      'Save-the-Date reveal, a Save-the-Date video, background music, photos '
      'you add, your own photo or video behind any scene or the whole '
      'page, the Pro themes for your Event Hub and your invite link, your own '
      'fonts and animation, an animated logo, and your logo on every QR code — '
      'plus the Setnayan mark taken off everywhere your guests see it: the page, '
      'the printable version, your story and the recap. The cinematic reveal '
      'comes only with this.',
    updated_at = now()
WHERE service_code = 'COUPLE_WEBSITE_PRO'
  -- Only while the old phrase is still there (prod held it on 2026-10-23), so an admin's later edit is never overwritten.
  AND description LIKE '%photo gallery%'
  AND description IS DISTINCT FROM
      'Every premium touch on your Event Hub in one unlock — the cinematic '
      'Save-the-Date reveal, a Save-the-Date video, background music, photos '
      'you add, your own photo or video behind any scene or the whole '
      'page, the Pro themes for your Event Hub and your invite link, your own '
      'fonts and animation, an animated logo, and your logo on every QR code — '
      'plus the Setnayan mark taken off everywhere your guests see it: the page, '
      'the printable version, your story and the recap. The cinematic reveal '
      'comes only with this.';

UPDATE public.platform_retail_catalog_v2
   SET description = replace(description, 'The photo gallery, photos and clips', 'Photos you add, photos and clips'),
       updated_at  = now()
 WHERE service_code = 'COUPLE_HUB_PART_PHOTOS'
   AND description LIKE '%The photo gallery, photos and clips%';

-- A supplier's own photos are their Portfolio. Only the LABEL moves; the
-- attribute key `gallery_image_uploads_count` stays.
UPDATE public.canonical_service_schemas
   SET category_specific_attributes = jsonb_set(
         category_specific_attributes,
         '{gallery_image_uploads_count,label}',
         to_jsonb('Upload at least 5 location photos to your Portfolio'::text)
       ),
       updated_at = now()
 WHERE category_specific_attributes #>> '{gallery_image_uploads_count,label}'
       = 'Upload at least 5 location gallery photos';

-- Admin privacy console: the couple's photos are their Memories.
UPDATE public.data_privacy_controls
   SET note       = replace(note, 'in the couple''s gallery', 'in the couple''s Memories'),
       updated_at = now()
 WHERE control_key = 'vendor_papic_capture'
   AND note LIKE '%in the couple''s gallery%';
