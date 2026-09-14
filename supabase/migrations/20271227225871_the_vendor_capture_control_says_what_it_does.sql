-- the_vendor_capture_control_says_what_it_does
-- ============================================================================
-- TD-1 · the vendor-capture control's `note` says what the control actually does.
--
-- `data_privacy_controls.note` is the RA 10173 audit trail an admin writes at
-- /admin/data-privacy when they flip a control (approved_by + approved_at +
-- note). The `vendor_papic_capture` row has carried an EMPTY note since it was
-- seeded in 20270814219429 — the lane whose whole reason for being counsel-gated
-- is that a supplier becomes a third-party controller of guest images, with
-- nothing on the record saying what a guest can do about it.
--
-- ⚠ THIS IS NOT A UNIQUELY EMPTY NOTE, AND THAT CORRECTION IS PART OF THE
-- CHANGE. 16 of the 20 seeded controls carry no note. Whether the other 15
-- should is a separate question for the owner and is deliberately NOT answered
-- here — filling them all from a migration would put words in an admin's mouth
-- across a board whose entire purpose is that a person signed off on each row.
--
-- ⛔ IT ONLY FILLS AN EMPTY ONE. `note` is admin-editable; overwriting a real
-- admin's audit note from a migration would destroy the evidence the column
-- exists to hold. The WHERE clause makes this re-run safe AND edit safe.
-- ============================================================================

BEGIN;

UPDATE public.data_privacy_controls
   SET note = 'Takedown reaches the supplier''s copy. A guest who appears in a '
              'photograph taken by a booked supplier can ask for it to be '
              'removed; when Setnayan honours that request the photo is hidden '
              'in vendor_papic_captures AND in the supplier''s own portfolio '
              'album (vendor_papic_portfolio_photos), not only in the couple''s '
              'gallery — owner ruling 2026-09-14, overriding the earlier '
              '"their own copy, kept for portfolio" position. The supplier is '
              'notified (guest_takedown_honored) and the guest is never named. '
              'NSFW screening stays always-on and geo is still stripped on any '
              'vendor-facing share.',
       updated_at = NOW()
 WHERE control_key = 'vendor_papic_capture'
   AND (note IS NULL OR btrim(note) = '');

COMMIT;
