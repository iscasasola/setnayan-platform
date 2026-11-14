-- RW-15 (Controller re-walk, 2026-11-14): the EVENT_PLUS description still says
-- "100 Papic credits", typed by 20271308555594_the_final_price_sheet.sql. The
-- count was raised to 1,000 by 20271344038763_plan_papic_credits.sql (owner
-- ruling 13 Nov: "event plus 1000, event pro 2000, event ultra 3500"), which
-- changed only the included_papic_credits column, so the sentence went stale.
--
-- The fix drops the number from the sentence rather than retyping it: the count
-- lives in included_papic_credits, and every screen that says a count reads it
-- there. A sentence with no number cannot drift from the column again.
--
-- Text only: no price, credit or flag changes. Idempotent, and it updates only
-- a row that still carries the stale sentence, so an admin-written description
-- is left alone.

UPDATE public.platform_retail_catalog_v2
   SET description = 'Setnayan AI and Papic credits for your event. Upgrade to Event Pro any time and pay only the difference.',
       updated_at  = now()
 WHERE service_code = 'EVENT_PLUS'
   AND description = 'Setnayan AI and 100 Papic credits for your event. Upgrade to Event Pro any time and pay only the difference.';
