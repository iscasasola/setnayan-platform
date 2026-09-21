-- the_lock_day_anchors_a_self_added_plan  (owner 2026-09-21)
--
-- A couple's payment plan for a supplier they added themselves can say
-- "N days after lock". Owner, asked what that counts from: "on the date you
-- clicked on lock". Nothing recorded that day — a self-added supplier never
-- handshakes, so `event_vendors.lock_agreed_at` stays null (and means "the
-- supplier agreed", which never happened), and `updated_at` moves on every
-- edit. Until now those rows were anchored on the day the supplier was ADDED.
--
-- This is the one day those rows count from. `finalizeVendor` stamps it when
-- the couple locks an off-platform supplier and re-dates the plan from it;
-- every later edit of the plan reads it back, so re-saving months later never
-- slides a date. Null = not locked yet: the sheet shows "after lock" rows as
-- if locked today, and the lock re-dates them.
--
-- ⚖ A column on the PLAN, not on event_vendors: it anchors only this plan's
-- dates. A general `event_vendors.locked_at` would become a second answer to
-- "when was this booked?" beside `lock_agreed_at`.

ALTER TABLE public.event_vendor_payment_plan
  ADD COLUMN IF NOT EXISTS on_lock_anchor_date DATE;

COMMENT ON COLUMN public.event_vendor_payment_plan.on_lock_anchor_date IS
  'The day the couple clicked Lock on a self-added (off-platform) supplier. '
  '"N days after lock" instalments in this plan count from it. Null until locked. '
  'Written by finalizeVendor only; owner decision 2026-09-21.';
