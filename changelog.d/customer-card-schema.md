## 2026-07-03 · feat(vendor): customer-card schema — private client notes + inquiry-stage event brief

SCHEMA slice (PR-1) of the vendor Customer Card respine. Migration-only, no UI.

- New table `vendor_client_notes` — private, TEAM-SHARED CRM notes per (vendor org, event): `body` (≤2000), optional `remind_at` follow-up date, `done_at` flag, author attribution. Vendor-org-only RLS (`current_vendor_profile_ids()`), full CRUD for owner + team. Deliberately NO couple policy and NO admin policy — private client-relationship content, off-limits to hosts and Setnayan HQ (mirrors the admin account-access lock).
- `get_vendor_event_brief(uuid)` made STAGE-AWARE. Adds a top-level `"stage"` key. BOOKED payload is unchanged (shipped UI keeps working). When the vendor org is not booked but holds an ACCEPTED `chat_threads` row for the event, returns `stage='inquiry'` with a LIMITED disclosure-ladder payload: display_name / event_date / ceremony_type, city-grain `region` only (venue_name + venue_address NULL), pax totals, palette + monogram + attire_guide; timeline `[]`, seat_plan zeroed, dietary NULL. Un-booked + un-accepted callers still raise `not_booked`.

Migration: `supabase/migrations/20270507380212_customer_card_schema.sql`.

SPEC IMPACT: None — corpus prototype 03_Strategy/Customer_Card_Prototype_2026-07-03.html is the design source.
