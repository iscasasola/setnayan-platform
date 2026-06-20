-- Seed the Maria & Jose sample-wedding Live Photo Wall (wall_feed mirror).
--
-- Stop 5 of the public tour ("See it come alive") reads the screened wall_feed
-- mirror via getWallSnapshot() → wall_visible_photos RPC. Without rows the wall
-- renders its graceful "warming up" empty state; this seed gives the demo real
-- imagery so the headline lands.
--
-- Each row points source_table/source_id at the 8 already-seeded sample
-- papic_photos (so the RPC's NSFW/consent/faceblock gates have a real source to
-- check) but stores a full https Unsplash URL in wall_safe_r2_key. The display
-- pipeline (parseStoredAsset → displayUrlForStoredAsset) returns any non-`r2://`
-- value verbatim as a legacy URL, so the wall renders the photo directly — no R2
-- object upload needed. The real consenting Papic shoot (owner action) will
-- later replace both papic_photos and these tiles with genuine media.
--
-- RPC visibility (verified against prod): sample has 0 faceblock guests (gate
-- auto-passes), all 8 papic_photos have hidden_at/wall_hidden_at NULL, and the
-- only photo_tags reference Maria with photo_consent=TRUE — so all 8 rows pass.
--
-- Re-runnable: clears this event's wall_feed first, then inserts. Apply with:
--   cat scripts/seed-sample-event-maria-jose-wall.sql | supabase db query --db-url "$SUPABASE_DB_URL"

DO $$
DECLARE
  v_event uuid;
  v_keys  text[] := ARRAY[
    'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1532712938310-34cb3982ef74?w=1200&q=80&auto=format&fit=crop'
  ];
  r record;
  i int := 0;
BEGIN
  SELECT event_id INTO v_event
  FROM public.events
  WHERE slug = 'maria-and-jose' AND is_sample = TRUE AND event_type = 'wedding'
  LIMIT 1;

  IF v_event IS NULL THEN
    RAISE EXCEPTION 'Maria & Jose sample event not found (slug=maria-and-jose, is_sample=TRUE)';
  END IF;

  -- Re-runnable: clear this event's wall feed before re-seeding.
  DELETE FROM public.wall_feed WHERE event_id = v_event;

  FOR r IN
    SELECT photo_id, width_px, height_px
    FROM public.papic_photos
    WHERE event_id = v_event
      AND hidden_at IS NULL
      AND wall_hidden_at IS NULL
    ORDER BY captured_at ASC
    LIMIT 8
  LOOP
    i := i + 1;
    INSERT INTO public.wall_feed
      (event_id, source_table, source_id, wall_safe_r2_key, width_px, height_px, sort_at)
    VALUES (
      v_event,
      'papic_photos',
      r.photo_id,
      v_keys[i],
      COALESCE(r.width_px, 1200),
      COALESCE(r.height_px, 1200),
      now() - ((9 - i) || ' minutes')::interval
    );
  END LOOP;

  RAISE NOTICE 'Seeded % wall_feed tile(s) for sample event %', i, v_event;
END $$;
