-- Fix: verify_and_activate_manual_payment() inserted into the DROPPED table
-- name `public.event_software_activations`. That table does not exist (it was
-- renamed to `event_software_activations_v2` in 20260628000000_v2_additive_phase_a.sql),
-- so every manual-payment activation that hit this function raised
-- `relation "public.event_software_activations" does not exist` and rolled back
-- the whole activation transaction (the manual_payment_logs row would also not
-- flip to VERIFIED_AND_ACTIVATED because the function errors before COMMIT).
--
-- The companion app-code fix (PR: connection-blockers) repointed the three
-- `.from('event_software_activations')` calls in the manpower API routes to the
-- `_v2` table; this migration repoints the matching DB-function path so the
-- admin / Maya manual-payment activation flow stops failing.
--
-- Pure table-name swap — the INSERT only sets (event_id, vendor_id, service_code),
-- and on `event_software_activations_v2` the remaining columns all have defaults
-- (id → gen_random_uuid(), is_reward_issued → false, created_at → now(),
-- rewarded_at → NULL), and the (event_id, service_code) UNIQUE index backs the
-- existing `ON CONFLICT DO NOTHING`. No behavioural change beyond the target table.

CREATE OR REPLACE FUNCTION public.verify_and_activate_manual_payment(p_reference_number text, p_vendor_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_event_id UUID;
    v_item TEXT;
    v_items_array TEXT[];
BEGIN
    -- Update payment ledger status
    UPDATE public.manual_payment_logs
    SET payment_status = 'VERIFIED_AND_ACTIVATED'
    WHERE reference_number = p_reference_number
    RETURNING event_id, items_ordered INTO v_event_id, v_items_array;

    -- Map out array elements and programmatically unlock active software licenses
    FOREACH v_item IN ARRAY v_items_array LOOP
        IF v_item = 'MEDIA_PACK' THEN
            -- Expand mass media rows natively
            INSERT INTO public.event_software_activations_v2 (event_id, vendor_id, service_code)
            VALUES
            (v_event_id, p_vendor_id, 'PAPIC_SEATS'),
            (v_event_id, p_vendor_id, 'PANOOD_SYSTEM'),
            (v_event_id, p_vendor_id, 'PATIKTOK_COMPILER'),
            (v_event_id, p_vendor_id, 'PABATI'),
            (v_event_id, p_vendor_id, 'PAKANTA'),
            (v_event_id, p_vendor_id, 'SDE'),
            (v_event_id, p_vendor_id, 'CAMERA_BRIDGE'),
            (v_event_id, p_vendor_id, 'LIVE_WALL')
            ON CONFLICT DO NOTHING;
        ELSE
            -- Single item resolution block
            INSERT INTO public.event_software_activations_v2 (event_id, vendor_id, service_code)
            VALUES (v_event_id, p_vendor_id, v_item)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
END;
$function$;
