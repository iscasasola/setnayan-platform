/*
  THE PUBLIC CARD MUST COUNT THE BOOKING THE DELETE ALREADY PRESERVED

  Owner, 2026-08-21: "on a SHARED record, the vendor keeps it" — contracts,
  payments, completed bookings. THE TEST IS WHETHER THE SUPPLIER TOOK PART IN IT.

  Slice 2 keeps the booking: `keep_supplier_bookings_on_event_delete` nulls
  `event_vendors.event_id` and stamps `event_type_at_delete` / `event_date_at_delete`
  onto the row for the express purpose of still being able to describe it. The row
  survives. THE PUBLIC CARD DOES NOT SHOW IT, because every CTE in
  `service_card_records` inner-joins `public.events`, and a preserved booking has
  no event to join to.

  MEASURED IN PRODUCTION 2026-08-27, seeded in a rolled-back transaction: three
  finished arm's-length jobs on one card, then ONE couple deletes their celebration.

      booked_count        3 → 2
      documented_events   3 → 2
      type_mix            [birthday x3] → []      <-- emptied entirely
      ledger              3 dated rows   → []      <-- emptied entirely

  The last two do not merely lose a row. Falling from 3 to 2 drops the card under
  the minimum-N floor, so ONE stranger's deletion erases the supplier's whole
  published track record. Meanwhile the row itself read back
  `status=complete, event_id IS NULL, event_type_at_delete=birthday,
  event_date_at_delete=2026-05-27` — everything needed to keep counting it, sitting
  on the row, unread.

  🔑 THE FIFTH COSTUME OF "STORED DOES NOT MEAN SURVIVES". The three matviews were
  taught to tolerate an orphan by `the_public_numbers_keep_the_record`; this
  function was written the same week and never was. A fix applied to one reader of
  a preserved row is not a fix.

  ⚖ WHY RELAXING THE JOIN CANNOT LAUNDER A SELF-DEALT JOB. The anti-self-dealing
  guard reads `event_members`, which cascades, so it returns TRUE VACUOUSLY for an
  orphan — measured: `vendor_booking_is_arms_length(vp, NULL, ev)` = true. That is
  safe here for one reason only, and it is load-bearing: the preserve trigger
  evaluates the SAME four tests while `event_members` still exists and REFUSES to
  preserve a self-dealt booking. Measured in production: a vendor booking their own
  celebration leaves NO surviving row (SELF_DEALT_ROW_SURVIVED = false). So
  *orphan ⇒ arm's-length* holds by construction — exactly the argument the review
  slice already relies on. ⛔ If that trigger's predicate is ever weakened, this
  function starts publishing self-dealt work. They must move together.

  ⛔ NOT CHANGED, AND NOT OVERSIGHTS:
   · `documented_events` still drops. Captures cascade WITH the celebration because
     the owner ruled photos are deleted (2026-08-21), so the evidence is genuinely
     gone and "no photo, no proof" is honoured. That is a collision between two of
     his own rulings and it is HIS call, not a bug to route around here.
   · `option_mix` / `option_sample_n` still drop. They read
     `event_vendor_packages`, which cascades whole — there is no preserved row to
     count, so this would be a NEW preserve, not a read fix.

  🔒 GRAIN. An orphan has no event identity, so it cannot be de-duplicated by
  `event_id`. The DISTINCT collapses orphans by (card, type-at-delete,
  date-at-delete) instead, which UNDER-counts if two separate deleted events shared
  a type and a date and never OVER-counts. A public trust number fails toward the
  smaller figure, always.
*/

CREATE OR REPLACE FUNCTION public.service_card_records(p_service_ids uuid[])
 RETURNS TABLE(vendor_service_id uuid, record jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_min_n      CONSTANT INTEGER := 3;
  v_max_ids    CONSTANT INTEGER := 50;
  v_ledger_max CONSTANT INTEGER := 6;
  v_option_max CONSTANT INTEGER := 6;

  v_today DATE := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_ledger_before DATE := date_trunc('month', v_today)::date;

  v_ids UUID[];
BEGIN
  IF p_service_ids IS NULL
     OR COALESCE(array_length(p_service_ids, 1), 0) = 0
     OR array_length(p_service_ids, 1) > v_max_ids THEN
    RETURN;
  END IF;

  v_ids := ARRAY(SELECT DISTINCT x FROM unnest(p_service_ids) AS x WHERE x IS NOT NULL);
  IF COALESCE(array_length(v_ids, 1), 0) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH req AS (
    SELECT x AS sid FROM unnest(v_ids) AS x
  ),
  svc AS (
    SELECT r.sid, vs.vendor_profile_id AS vpid
    FROM req r
    LEFT JOIN public.vendor_services vs ON vs.vendor_service_id = r.sid
  ),
  booked AS (
    -- ONE ROW PER (card, EVENT). For a LIVE event the grain is `event_id`, as
    -- before. For a PRESERVED booking `event_id` is NULL for every row, so the
    -- same DISTINCT collapses them by the type and date stamped at deletion —
    -- see the GRAIN note in the header for why that direction was chosen.
    SELECT DISTINCT
      s.sid              AS sid,
      ev.event_id        AS event_id,
      COALESCE(e.event_type::TEXT, ev.event_type_at_delete::TEXT) AS event_type,
      COALESCE(e.event_date, ev.event_date_at_delete)             AS event_date,
      -- An orphan has no head-count to band: `estimated_pax` went with the
      -- celebration, so this correctly reads 'unknown' rather than inventing one.
      CASE
        WHEN e.estimated_pax IS NULL THEN 'unknown'
        WHEN e.estimated_pax <  50   THEN 'under_50'
        WHEN e.estimated_pax <  100  THEN '50_99'
        WHEN e.estimated_pax <  200  THEN '100_199'
        ELSE                              '200_plus'
      END AS pax_band
    FROM svc s
    JOIN public.event_vendors ev ON ev.service_id = s.sid
    -- LEFT, so a preserved booking is not dropped by the absence of its event.
    LEFT JOIN public.events e ON e.event_id = ev.event_id
    WHERE s.vpid IS NOT NULL
      AND ev.status::TEXT = ANY (public.booked_event_vendor_statuses())
      AND ev.archived_at IS NULL
      AND ev.voided_by_fraud = FALSE
      AND (
        -- a live celebration, unarchived, exactly as before …
        (ev.event_id IS NOT NULL AND e.archived = FALSE)
        -- … or a booking the delete deliberately preserved. The stamp is the
        -- proof it came through that path: `keep_supplier_bookings_on_event_delete`
        -- is the only writer that nulls `event_id`, and it always stamps the type.
        OR (ev.event_id IS NULL AND ev.event_type_at_delete IS NOT NULL)
      )
      AND public.vendor_booking_is_arms_length(s.vpid, ev.event_id, ev.vendor_id)
  ),
  counts AS (
    -- COUNT(b.sid), not COUNT(b.event_id): a preserved booking has a NULL
    -- event_id, and COUNT of a NULL column silently skips it — which would have
    -- left this fix counting nothing while every other CTE saw the row.
    SELECT s.sid, COUNT(b.sid)::INTEGER AS n
    FROM svc s
    LEFT JOIN booked b ON b.sid = s.sid
    GROUP BY s.sid
  ),
  mix AS (
    SELECT b.sid, b.event_type, COUNT(*)::INTEGER AS n
    FROM booked b
    GROUP BY b.sid, b.event_type
  ),
  ranked AS (
    SELECT
      b.sid,
      b.event_type,
      to_char(b.event_date, 'YYYY-MM') AS month_year,
      b.pax_band,
      ROW_NUMBER() OVER (PARTITION BY b.sid ORDER BY b.event_date DESC) AS rn
    FROM booked b
    WHERE b.event_date IS NOT NULL
      AND b.event_date < v_ledger_before
  ),
  pkg_bookings AS (
    SELECT
      s.sid                     AS sid,
      evp.event_id              AS event_id,
      evp.locked_at             AS locked_at,
      evp.customizations_json   AS cj
    FROM svc s
    JOIN public.vendor_packages vp
      ON vp.vendor_service_id = s.sid
     AND vp.vendor_profile_id = s.vpid
    JOIN public.event_vendor_packages evp ON evp.package_id = vp.package_id
    JOIN public.events e ON e.event_id = evp.event_id
    WHERE s.vpid IS NOT NULL
      AND evp.status = 'locked'
      AND e.archived = FALSE
      AND public.vendor_booking_is_arms_length(s.vpid, evp.event_id, NULL)
  ),
  pkg_n AS (
    SELECT b.sid, COUNT(DISTINCT b.event_id)::INTEGER AS n
    FROM pkg_bookings b
    GROUP BY b.sid
  ),
  picked AS (
    SELECT DISTINCT
      b.sid                        AS sid,
      b.event_id                   AS event_id,
      opt ->> 'option_id'          AS option_id,
      opt ->> 'label'              AS label,
      b.locked_at                  AS locked_at
    FROM pkg_bookings b
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(b.cj -> 'pricing_snapshot' -> 'options') = 'array'
          THEN b.cj -> 'pricing_snapshot' -> 'options'
        ELSE '[]'::JSONB
      END
    ) AS opt
    WHERE jsonb_typeof(opt) = 'object'
      AND COALESCE(opt ->> 'option_id', '') <> ''
      AND COALESCE(opt ->> 'label', '') <> ''
  ),
  documented AS (
    -- UNCHANGED. Captures cascade with the celebration by the owner's own
    -- photos-are-deleted ruling, so there is no preserved capture to count and
    -- "no photo, no proof" still holds. See the header.
    SELECT s.sid, COUNT(DISTINCT vpc.event_id)::INTEGER AS n
    FROM svc s
    JOIN public.vendor_papic_captures vpc ON vpc.vendor_profile_id = s.vpid
    JOIN public.events e2 ON e2.event_id = vpc.event_id
    WHERE s.vpid IS NOT NULL
      AND vpc.hidden_at IS NULL
      AND vpc.nsfw_checked = TRUE
      AND e2.archived = FALSE
      AND public.vendor_booking_is_arms_length(s.vpid, vpc.event_id, NULL)
    GROUP BY s.sid
  ),
  option_counts AS (
    SELECT
      p.sid,
      p.option_id,
      (ARRAY_AGG(p.label ORDER BY p.locked_at DESC NULLS LAST))[1] AS label,
      COUNT(DISTINCT p.event_id)::INTEGER AS n
    FROM picked p
    GROUP BY p.sid, p.option_id
  )
  SELECT
    c.sid,
    jsonb_build_object(
      'booked_count', c.n,
      'documented_events',
        COALESCE((SELECT d.n FROM documented d WHERE d.sid = c.sid), 0),
      'type_mix',
        CASE WHEN public.min_n_ok(c.n, v_min_n) THEN
          COALESCE(
            (
              SELECT jsonb_agg(jsonb_build_object('event_type', m.event_type, 'n', m.n)
                               ORDER BY m.n DESC, m.event_type ASC)
              FROM mix m WHERE m.sid = c.sid
            ),
            '[]'::JSONB
          )
        ELSE '[]'::JSONB END,
      'ledger',
        CASE WHEN public.min_n_ok(c.n, v_min_n) THEN
          COALESCE(
            (
              SELECT jsonb_agg(jsonb_build_object(
                       'event_type', r.event_type,
                       'month_year', r.month_year,
                       'pax_band',   r.pax_band)
                     ORDER BY r.rn)
              FROM ranked r WHERE r.sid = c.sid AND r.rn <= v_ledger_max
            ),
            '[]'::JSONB
          )
        ELSE '[]'::JSONB END,
      'option_sample_n',
        COALESCE(
          (
            SELECT CASE WHEN public.min_n_ok(pn.n, v_min_n) THEN pn.n ELSE 0 END
            FROM pkg_n pn WHERE pn.sid = c.sid
          ),
          0
        ),
      'option_mix',
        COALESCE(
          (
            SELECT jsonb_agg(x.obj)
            FROM (
              SELECT jsonb_build_object('label', oc.label, 'n', oc.n) AS obj
              FROM option_counts oc
              JOIN pkg_n pn ON pn.sid = oc.sid
              WHERE oc.sid = c.sid
                AND public.min_n_ok(pn.n, v_min_n)
                AND public.min_n_ok(oc.n, v_min_n)
              ORDER BY oc.n DESC, oc.label ASC
              LIMIT v_option_max
            ) x
          ),
          '[]'::JSONB
        )
    )
  FROM counts c;
END;
$function$;

COMMENT ON FUNCTION public.service_card_records(uuid[]) IS
  'The public record on a service card. Counts LIVE bookings and the bookings a '
  'couple''s deletion deliberately preserved (event_id NULL + event_type_at_delete '
  'stamped). Orphans are arm''s-length by construction: the preserve trigger '
  'destroys self-dealt bookings while event_members still exists. Captures and '
  'locked packages cascade, so documented_events and option_mix still fall with '
  'the celebration.';
