-- supplier storage meter counts everything
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ============================================================================
-- 📏 THE SUPPLIER STORAGE METER COUNTS EVERYTHING THE SHOP OWNS — FILES AND DATA.
--
-- Owner, 23 Nov 2026 (specs DECISION_LOG "THE SUPPLIER STORAGE METER COUNTS EVERYTHING THE SHOP OWNS — FILES AND
-- DATA", "THE METER SHOWS REAL USAGE ONLY — NO RESERVED SYSTEM BLOCK"; SUPPLIER_SUBSCRIPTIONS_BUILD_SPEC_2026-11-22.md
-- § ★ A · H · K): *"we want them to achieve limits asap"*, *"their calendars schedule, website and every data compiled
-- to them is computed"*, *"No, real usage only"*.
--
-- Before this, `vendor_storage_used_bytes` counted two things: event files (supplier_media filed to an event) and the
-- Papic portfolio. Logos, covers, card photos and videos, payment QR, booth posters, chat files, contracts, Papic
-- captures and every record the shop owns were never counted — a busy shop read a few MB.
--
--   1 · `supplier_stored_files` — the size of each upload that no other table records a size for (everything under
--       `vendors/`, `vendor-payment-qr/`, `vendor-originals/`, the marked public copy of a shop photo, a handover
--       file, a mood-board suggestion). Written by the app when the upload is signed (`recordShopUpload`,
--       lib/supplier-storage.server.ts — the presign pins the length, so the number is the real size); released when
--       the object is deleted (`r2Delete`). Service role only.
--   2 · `supplier_storage_records` — what the shop's DATA weighs: the real stored size (`pg_column_size` of each row)
--       of every row in every table that names the shop, measured by a nightly job (and once, on a shop's first
--       Plans page view) — never a scan per page view. Chat messages are kept apart: they live in the chat &
--       documents room. Service role only.
--   3 · `supplier_storage_record_sources()` — the list of tables that name a shop (a foreign key to vendor_profiles
--       or a uuid `vendor_profile_id` column), each counted, or not counted with its reason. A new table that names a
--       shop is COUNTED by default — the test tests/db/the-meter-counts-every-shop-table.db.test.ts proves it.
--   4 · `supplier_storage_measure_records(shop | NULL)` — the measure (one shop, or every shop in one pass per table).
--   5 · `vendor_storage_files(shop)` — every stored file, live, split media / documents / evidence.
--   6 · `vendor_storage_breakdown(shop)` — THE ONE READ the Plans page and /api/upload ask: Photos & video · Files ·
--       Records, the chat & documents room's use, the evidence share, when the records were measured.
--   7 · `vendor_storage_used_bytes(shop)` — the total (files + the last measured records): the number the filing
--       backstop `enforce_supplier_storage_allowance` and the limits sheet compare with the plan. Same signature.
--   8 · the nightly job (pg_cron, when installed).
--
-- Media = photos, video, audio and archives (zip can hide photos); everything else is a document (spec § ★ K).
-- Evidence (contracts, and uploads marked so) COUNTS but is never refused — the app's gate says so; nothing here
-- refuses anything new.
--
-- RLS ON at CREATE (service-role-only pattern: no policy, privileges revoked from anon and authenticated).
-- 🛑 NEVER APPLIED BY HAND. The pipeline (`supabase db push --include-all`) applies it.
-- ============================================================================

BEGIN;

-- ── 0 · what is media ──────────────────────────────────────────────────────
-- TS twin: `isMediaContentType` (lib/supplier-storage.ts); parity held by the db test. An unknown type is media —
-- the chat & documents room is the smaller, reserved one, and nothing unknown may hide in it.
CREATE OR REPLACE FUNCTION public.supplier_storage_is_media(p_mime text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_mime IS NULL OR btrim(p_mime) = '' THEN true
    WHEN lower(split_part(p_mime, ';', 1)) LIKE 'image/%'
      OR lower(split_part(p_mime, ';', 1)) LIKE 'video/%'
      OR lower(split_part(p_mime, ';', 1)) LIKE 'audio/%' THEN true
    WHEN lower(split_part(p_mime, ';', 1)) IN (
      'application/zip', 'application/x-zip-compressed', 'application/x-7z-compressed', 'application/x-rar-compressed',
      'application/vnd.rar', 'application/x-tar', 'application/gzip', 'application/x-gzip', 'application/octet-stream'
    ) THEN true
    ELSE false
  END;
$$;
REVOKE ALL ON FUNCTION public.supplier_storage_is_media(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_storage_is_media(text) TO service_role;

-- ── 1 · the size of uploads no other table records ─────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_stored_files (
  object_ref        text        PRIMARY KEY CHECK (object_ref LIKE 'r2://%/%'),
  vendor_profile_id uuid        NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  bytes             bigint      NOT NULL CHECK (bytes >= 0),
  content_type      text,
  room              text        NOT NULL CHECK (room IN ('media', 'documents')),
  evidence          boolean     NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  released_at       timestamptz
);
ALTER TABLE public.supplier_stored_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.supplier_stored_files FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.supplier_stored_files TO service_role;
CREATE INDEX IF NOT EXISTS supplier_stored_files_held_idx
  ON public.supplier_stored_files (vendor_profile_id) WHERE released_at IS NULL;

COMMENT ON TABLE public.supplier_stored_files IS
  'The size of each upload a shop holds that no other table records a size for (vendors/, vendor-payment-qr/, vendor-originals/, the marked public copy of a shop photo, handover files, mood-board suggestions). Written when the upload is signed (recordShopUpload, lib/supplier-storage.server.ts — the presign pins the length); released_at set when the object is deleted (r2Delete). Counted by vendor_storage_files. Owner 2026-11-23 "THE SUPPLIER STORAGE METER COUNTS EVERYTHING". Service role only.';

-- ── 2 · what the shop's data weighs (measured, not scanned per view) ───────
CREATE TABLE IF NOT EXISTS public.supplier_storage_records (
  vendor_profile_id uuid        PRIMARY KEY REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  records_bytes     bigint      NOT NULL DEFAULT 0 CHECK (records_bytes >= 0),
  chat_bytes        bigint      NOT NULL DEFAULT 0 CHECK (chat_bytes >= 0),
  tables_counted    int         NOT NULL DEFAULT 0 CHECK (tables_counted >= 0),
  measured_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_storage_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.supplier_storage_records FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.supplier_storage_records TO service_role;

COMMENT ON TABLE public.supplier_storage_records IS
  'What a shop''s DATA weighs: the stored size (pg_column_size) of every row of every table that names the shop (supplier_storage_record_sources), chat messages apart (chat_bytes — the chat & documents room). Written only by supplier_storage_measure_records (nightly job; once on a shop''s first Plans page view). Owner 2026-11-23: "every data compiled to them is computed", "computed cheaply … never a scan per page view". Service role only.';

-- ── 3 · which tables name a shop, and whether each is counted ──────────────
-- A table names a shop when it has a foreign key to vendor_profiles(vendor_profile_id), or a uuid column called
-- vendor_profile_id — or names one of the shop's BOOKINGS (a foreign key to event_vendors, whose linked or marketplace
-- shop is the shop: the booking's line items, payments, tasks…). COUNTED BY DEFAULT: only the platform's own books and safety records about a shop are left out,
-- each with its reason. tests/db/the-meter-counts-every-shop-table.db.test.ts holds the list honest.
CREATE OR REPLACE FUNCTION public.supplier_storage_record_sources()
RETURNS TABLE (table_name text, shop_columns text[], booking_columns text[], counted boolean, reason text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH uncounted(t, why) AS (
    VALUES
      -- the platform's books: what the shop pays Setnayan, not data the shop keeps
      ('app_store_purchases',           'Setnayan''s own books: what the shop paid through Apple'),
      ('booking_fee_charges',           'Setnayan''s own books: booking fees charged to the shop'),
      ('booking_fee_ledger',            'Setnayan''s own books: the booking fee ledger'),
      ('booking_fee_disputes',          'Setnayan''s own books: disputes of a booking fee'),
      ('booking_fee_event_import_slots','Setnayan''s own books: imported-event fee slots'),
      ('vendor_subscriptions',          'Setnayan''s own books: the plan the shop pays for'),
      ('vendor_tier_history',           'Setnayan''s own books: plan changes'),
      ('vendor_credit_ledger',          'Setnayan''s own books: credit owed to the shop'),
      ('vendor_payouts',                'Setnayan''s own books: money paid out to the shop'),
      ('vendor_2307_filings',           'Setnayan''s own books: BIR 2307 certificates Setnayan issues'),
      ('vendor_member_token_wallets',   'Setnayan''s own books: a retired token wallet'),
      ('vendor_token_purchases',        'Setnayan''s own books: retired token purchases'),
      ('comp_grants',                   'Setnayan''s own books: comped plans and gifts'),
      ('shop_papic_wallet_entries',     'Setnayan''s own books: the shop''s Papic credit wallet'),
      -- the platform's safety and admin records about a shop: the shop cannot see or remove them
      ('fraud_signals',                 'Setnayan''s safety records about the shop'),
      ('fraud_enforcement_audit',       'Setnayan''s safety records about the shop'),
      ('vendor_admin_motions',          'Setnayan''s admin records about the shop'),
      ('vendor_verification_bypasses',  'Setnayan''s admin records about the shop'),
      ('vendor_correction_requests',    'Setnayan''s admin records about the shop'),
      ('chat_message_flags',            'Setnayan''s safety records: reported messages'),
      ('vendor_qr_media_flags',         'Setnayan''s safety records: flagged QR media'),
      ('vendor_image_hashes',           'Setnayan''s safety records: photo fingerprints for theft watch'),
      -- secrets and devices: not data the shop stores
      ('vendor_ig_oauth_state',         'A short-lived sign-in secret, not stored data'),
      ('vendor_push_tokens',            'A device address for notifications, not stored data'),
      -- this meter's own rows
      ('supplier_stored_files',         'This meter''s own ledger: its bytes are the files it measures'),
      ('supplier_storage_records',      'This meter''s own measurement')
  ),
  cols AS (
    -- (a) a foreign key to vendor_profiles(vendor_profile_id), one column
    SELECT rel.relname::text AS t, att.attname::text AS c, false AS booking
      FROM pg_constraint con
      JOIN pg_class rel       ON rel.oid = con.conrelid
      JOIN pg_namespace ns    ON ns.oid = rel.relnamespace
      JOIN pg_class ref       ON ref.oid = con.confrelid
      JOIN pg_attribute att   ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
     WHERE con.contype = 'f'
       AND ns.nspname = 'public'
       AND ref.relname = 'vendor_profiles'
       AND array_length(con.conkey, 1) = 1
       AND rel.relkind = 'r'
    UNION
    -- (b) a uuid column called vendor_profile_id (vendor_profiles itself, and any table without the key)
    SELECT c.table_name::text, c.column_name::text, false
      FROM information_schema.columns c
      JOIN information_schema.tables tb
        ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
     WHERE c.table_schema = 'public'
       AND c.column_name = 'vendor_profile_id'
       AND c.data_type = 'uuid'
    UNION
    -- (c) a foreign key to one of the shop's bookings (event_vendors.vendor_id)
    SELECT rel.relname::text, att.attname::text, true
      FROM pg_constraint con
      JOIN pg_class rel       ON rel.oid = con.conrelid
      JOIN pg_namespace ns    ON ns.oid = rel.relnamespace
      JOIN pg_class ref       ON ref.oid = con.confrelid
      JOIN pg_attribute att   ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
     WHERE con.contype = 'f'
       AND ns.nspname = 'public'
       AND ref.relname = 'event_vendors'
       AND array_length(con.conkey, 1) = 1
       AND rel.relkind = 'r'
       AND rel.relname <> 'event_vendors'
  )
  , named AS (
    SELECT cols.t,
           COALESCE(array_agg(DISTINCT cols.c ORDER BY cols.c) FILTER (WHERE NOT cols.booking), ARRAY[]::text[]) AS shop_cols,
           COALESCE(array_agg(DISTINCT cols.c ORDER BY cols.c) FILTER (WHERE cols.booking), ARRAY[]::text[]) AS booking_cols
      FROM cols
     GROUP BY cols.t
  )
  -- A left-out name that matches no shop table comes back with no columns, so the guard test sees the typo.
  SELECT COALESCE(n.t, u.t),
         COALESCE(n.shop_cols, ARRAY[]::text[]),
         COALESCE(n.booking_cols, ARRAY[]::text[]),
         u.t IS NULL,
         u.why
    FROM named n
    FULL JOIN uncounted u ON u.t = n.t
   ORDER BY 1;
$$;
REVOKE ALL ON FUNCTION public.supplier_storage_record_sources() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_storage_record_sources() TO service_role;

COMMENT ON FUNCTION public.supplier_storage_record_sources() IS
  'Every public table that names a shop (an FK to vendor_profiles, a uuid vendor_profile_id column, or an FK to one of its bookings in event_vendors), with the columns that name it, and whether the storage meter counts its rows — counted by default; the platform''s own books, safety records, secrets and the meter''s own rows are not, each with its reason. Read by supplier_storage_measure_records and the guard test.';

-- ── 4 · the measure: one shop, or every shop in one pass per table ─────────
CREATE OR REPLACE FUNCTION public.supplier_storage_measure_records(p_vendor_profile_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_src    record;
  v_parts  text[] := ARRAY[]::text[];
  v_cols   text;
  v_where  text;
  v_n      int := 0;
  v_tables int := 0;
BEGIN
  FOR v_src IN SELECT * FROM public.supplier_storage_record_sources() s
                WHERE s.counted AND cardinality(s.shop_columns) + cardinality(s.booking_columns) > 0 LOOP
    -- The shops a row names: its own shop columns, and the linked / marketplace shop of each booking it names. A row
    -- naming the shop twice counts once for it.
    v_cols := concat_ws(' || ',
      CASE WHEN cardinality(v_src.shop_columns) > 0 THEN
        format('ARRAY[%s]::uuid[]', (SELECT string_agg(format('t.%I', c), ', ') FROM unnest(v_src.shop_columns) c))
      END,
      CASE WHEN cardinality(v_src.booking_columns) > 0 THEN
        format('COALESCE((SELECT array_agg(x) FROM public.event_vendors ev, unnest(ARRAY[ev.linked_vendor_profile_id, ev.marketplace_vendor_id]) x WHERE ev.vendor_id IN (%s)), ARRAY[]::uuid[])',
               (SELECT string_agg(format('t.%I', c), ', ') FROM unnest(v_src.booking_columns) c))
      END
    );
    v_where := CASE
      WHEN p_vendor_profile_id IS NULL THEN ''
      ELSE ' WHERE ' || concat_ws(' OR ',
        (SELECT string_agg(format('t.%I = $1', c), ' OR ') FROM unnest(v_src.shop_columns) c),
        (SELECT string_agg(format('t.%I IN (SELECT ev.vendor_id FROM public.event_vendors ev WHERE ev.linked_vendor_profile_id = $1 OR ev.marketplace_vendor_id = $1)', c), ' OR ')
           FROM unnest(v_src.booking_columns) c)
      )
    END;
    v_parts := v_parts || format(
      'SELECT s.shop, pg_column_size(t.*)::bigint AS b, %L::boolean AS chat FROM public.%I t '
      'CROSS JOIN LATERAL (SELECT DISTINCT x FROM unnest(%s) x WHERE x IS NOT NULL) s(shop)%s',
      v_src.table_name = 'chat_messages', v_src.table_name, v_cols, v_where
    );
    v_tables := v_tables + 1;
  END LOOP;

  IF array_length(v_parts, 1) IS NULL THEN
    RETURN 0;
  END IF;

  EXECUTE format(
    'WITH m AS (%s), s AS ('
    '  SELECT m.shop, SUM(m.b) FILTER (WHERE NOT m.chat) AS rb, SUM(m.b) FILTER (WHERE m.chat) AS cb'
    '    FROM m JOIN public.vendor_profiles vp ON vp.vendor_profile_id = m.shop'
    '   WHERE $1 IS NULL OR m.shop = $1'
    '   GROUP BY m.shop'
    '), w AS ('
    '  INSERT INTO public.supplier_storage_records AS r (vendor_profile_id, records_bytes, chat_bytes, tables_counted, measured_at)'
    '  SELECT s.shop, COALESCE(s.rb, 0), COALESCE(s.cb, 0), $2, now() FROM s'
    '  ON CONFLICT (vendor_profile_id) DO UPDATE'
    '     SET records_bytes = EXCLUDED.records_bytes, chat_bytes = EXCLUDED.chat_bytes,'
    '         tables_counted = EXCLUDED.tables_counted, measured_at = EXCLUDED.measured_at'
    '  RETURNING 1'
    ') SELECT count(*)::int FROM w',
    array_to_string(v_parts, ' UNION ALL ')
  ) INTO v_n USING p_vendor_profile_id, v_tables;

  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.supplier_storage_measure_records(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_storage_measure_records(uuid) TO service_role;

COMMENT ON FUNCTION public.supplier_storage_measure_records(uuid) IS
  'Measures what a shop''s data weighs (pg_column_size of every row of every counted table naming it — supplier_storage_record_sources) into supplier_storage_records. NULL = every shop, one pass per table (the nightly job); a shop id = that shop only (its first Plans page view). Returns the shops written.';

-- ── 5 · every stored file, live ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_storage_files(p_vendor_profile_id uuid)
RETURNS TABLE (media_bytes bigint, documents_bytes bigint, evidence_bytes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH f(bytes, media, evidence) AS (
    -- event files: each stored copy an event file still points at, once (unchanged rule)
    SELECT COALESCE(m.size_bytes, 0)::bigint, public.supplier_storage_is_media(m.mime), false
      FROM public.supplier_media m
     WHERE m.vendor_profile_id = p_vendor_profile_id
       AND EXISTS (SELECT 1 FROM public.event_supplier_files ef
                    WHERE ef.media_id = m.media_id AND ef.vendor_profile_id = p_vendor_profile_id)
    UNION ALL
    -- the Papic portfolio (unchanged rule)
    SELECT COALESCE(a.size_bytes, 0)::bigint, true, false
      FROM public.vendor_papic_portfolio_photos a
     WHERE a.vendor_profile_id = p_vendor_profile_id
    UNION ALL
    -- the shop's own Papic captures: every size kept (the original only until it is dropped)
    SELECT (CASE WHEN c.full_res_dropped_at IS NULL THEN COALESCE(c.orig_bytes, 0) ELSE 0 END
            + COALESCE(c.display_bytes, 0) + COALESCE(c.tile_bytes, 0) + COALESCE(c.thumb_bytes, 0))::bigint, true, false
      FROM public.vendor_papic_captures c
     WHERE c.vendor_profile_id = p_vendor_profile_id
    UNION ALL
    -- files the shop sent in its chats, while the file is kept
    SELECT COALESCE(cm.attachment_size_bytes, 0)::bigint, public.supplier_storage_is_media(cm.attachment_mime), false
      FROM public.chat_messages cm
     WHERE cm.vendor_profile_id = p_vendor_profile_id
       AND cm.sender_role = 'vendor'
       AND cm.attachment_size_bytes IS NOT NULL
       AND cm.file_removed_at IS NULL
    UNION ALL
    -- contracts: evidence — counted, never refused, kept forever
    SELECT COALESCE(k.file_size_bytes, 0)::bigint, false, true
      FROM public.vendor_contracts k
     WHERE k.vendor_profile_id = p_vendor_profile_id
       AND k.file_size_bytes IS NOT NULL
    UNION ALL
    -- every other upload, by the size it was signed for, until it is deleted
    SELECT s.bytes, s.room = 'media', s.evidence
      FROM public.supplier_stored_files s
     WHERE s.vendor_profile_id = p_vendor_profile_id
       AND s.released_at IS NULL
  )
  SELECT COALESCE(SUM(f.bytes) FILTER (WHERE f.media), 0)::bigint,
         COALESCE(SUM(f.bytes) FILTER (WHERE NOT f.media), 0)::bigint,
         COALESCE(SUM(f.bytes) FILTER (WHERE f.evidence), 0)::bigint
    FROM f;
$$;
REVOKE ALL ON FUNCTION public.vendor_storage_files(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_storage_files(uuid) TO service_role;

-- ── 6 · THE ONE READ: Photos & video · Files · Records ─────────────────────
CREATE OR REPLACE FUNCTION public.vendor_storage_breakdown(p_vendor_profile_id uuid)
RETURNS TABLE (
  photos_video_bytes  bigint,
  files_bytes         bigint,
  records_bytes       bigint,
  room_bytes          bigint,
  evidence_bytes      bigint,
  records_measured_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.vendor_profiles WHERE vendor_profile_id = p_vendor_profile_id) THEN
    RAISE EXCEPTION 'vendor_storage_breakdown: no such shop' USING ERRCODE = 'P0002';
  END IF;
  -- A shop never measured is measured now, once (its own rows only); after that the nightly job keeps it.
  IF NOT EXISTS (SELECT 1 FROM public.supplier_storage_records WHERE vendor_profile_id = p_vendor_profile_id) THEN
    PERFORM public.supplier_storage_measure_records(p_vendor_profile_id);
  END IF;
  RETURN QUERY
    SELECT f.media_bytes,
           f.documents_bytes,
           COALESCE(r.records_bytes, 0) + COALESCE(r.chat_bytes, 0),
           f.documents_bytes + COALESCE(r.chat_bytes, 0),
           f.evidence_bytes,
           r.measured_at
      FROM public.vendor_storage_files(p_vendor_profile_id) f
      LEFT JOIN public.supplier_storage_records r ON r.vendor_profile_id = p_vendor_profile_id;
END;
$$;
REVOKE ALL ON FUNCTION public.vendor_storage_breakdown(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_storage_breakdown(uuid) TO service_role;

COMMENT ON FUNCTION public.vendor_storage_breakdown(uuid) IS
  'THE storage meter (owner 2026-11-23 "THE SUPPLIER STORAGE METER COUNTS EVERYTHING THE SHOP OWNS"): photos_video_bytes (photos, video, audio, archives) · files_bytes (every other file) · records_bytes (the shop''s data, chat included, as last measured) · room_bytes (the chat & documents room: non-media files + chat messages) · evidence_bytes (contracts and other kept papers — counted, never refused). Real usage only: no reserve. Read by lib/supplier-storage.server.ts readStorageBreakdown. Service role only — the app resolves the shop from the session first.';

-- ── 7 · the total, same signature ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_storage_used_bytes(p_vendor_profile_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT (
    (SELECT f.media_bytes + f.documents_bytes FROM public.vendor_storage_files(p_vendor_profile_id) f)
    + COALESCE((SELECT r.records_bytes + r.chat_bytes
                  FROM public.supplier_storage_records r
                 WHERE r.vendor_profile_id = p_vendor_profile_id), 0)
  )::bigint;
$$;
REVOKE ALL ON FUNCTION public.vendor_storage_used_bytes(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_storage_used_bytes(uuid) TO service_role;

COMMENT ON FUNCTION public.vendor_storage_used_bytes(uuid) IS
  'Everything a shop stores against its plan (owner 2026-11-23 "THE SUPPLIER STORAGE METER COUNTS EVERYTHING THE SHOP OWNS"): every file (vendor_storage_files — event files, portfolio, Papic captures, chat files the shop sent, contracts, every other upload) plus its data as last measured (supplier_storage_records). Read by the filing backstop enforce_supplier_storage_allowance and the limits sheet. Service role only.';

-- ── 8 · the nightly measure ────────────────────────────────────────────────
-- 19:23 UTC = 03:23 in Manila. Runs SQL in the database (no HTTP). Skipped where pg_cron is not installed (local
-- replay, PGlite).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed; skipping supplier_storage_records_nightly.';
    RETURN;
  END IF;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'supplier_storage_records_nightly';
  PERFORM cron.schedule(
    'supplier_storage_records_nightly',
    '23 19 * * *',
    $job$SELECT public.supplier_storage_measure_records(NULL)$job$
  );
END;
$$;

COMMIT;
