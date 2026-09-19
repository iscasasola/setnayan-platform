-- 20271234330879 · drop the pre-split Papic camera gate (S37)
--
-- S26's both-ends guard (#5625) ranked all five as `rpc-no-caller`. Re-measured
-- 2026-09-18 against origin/main and production: none has a caller in app code,
-- in any SQL body (one comment in papic_record_guest_capture names
-- papic_reserve_camera_capture; it is prose, not a call), policy, trigger or view.
--
-- WHAT REPLACED THEM. Every capture path — guest phone, guest-own-camera and the
-- QR camera — books through ONE function, papic_reserve_capture_split
-- (20271131963489, wired by fc921d989), recorded atomically by
-- papic_record_seat_capture / papic_record_guest_capture. That is the owner's
-- 2026-08-11 ruling ("spend 2 and take 6"): a camera's dedicated credits are a
-- FLOOR nobody else may spend, never a ceiling on the camera. The functions below
-- are the gate that ruling replaced, and two of them encode the retired ceiling:
--
--   papic_reserve_camera_capture(uuid,uuid,text,int)  per-kind daily counter;
--       trusted a caller-supplied limit (NULL = always allow). Superseded twice.
--   papic_camera_remaining(uuid,text,int)             its read probe — and still
--       EXECUTE-able by anon in production; dropping it narrows that surface.
--   papic_reserve_camera_points(uuid,uuid,int)        the per-camera reserve that
--       refused at the camera's own zero — the ceiling the ruling removed.
--   papic_release_camera_points(uuid,int)             its inverse.
--   papic_reserve_event_points_for_seat(uuid,uuid,int) the -1 "pool stands down"
--       probe; calling it after the camera gate was the pair the decision log
--       says was "individually behaving as designed and the pair was wrong".
--
-- NOT touched: papic_camera_points_remaining and
-- papic_event_points_remaining_for_seat (the upload presign still reads both),
-- papic_seat_dedicated_points, papic_reserve_event_points, papic_release_event_points.
--
-- Not CASCADE: an unexpected dependant fails the push loudly.

DROP FUNCTION IF EXISTS public.papic_reserve_camera_capture(uuid, uuid, text, integer);
DROP FUNCTION IF EXISTS public.papic_camera_remaining(uuid, text, integer);
DROP FUNCTION IF EXISTS public.papic_reserve_camera_points(uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.papic_release_camera_points(uuid, integer);
DROP FUNCTION IF EXISTS public.papic_reserve_event_points_for_seat(uuid, uuid, integer);
