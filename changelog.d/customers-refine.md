## 2026-07-01 · feat(vendor-customers): wire the My Customers filters + heat map + payments to live data

Owner corrections to the LIVE `/vendor-dashboard/customers` page. Everything reads
LIVE, vendor-scoped sources — nothing hardcoded.

- **Filters now functionally filter BOTH the month calendar AND the customers
  list** (previously presentational). A new client island (`customers-client.tsx`)
  owns the three filters + Heat map toggle so one source of state drives the
  calendar and the list; the server page slots the summary cards through
  unfiltered.
  - **"All types"** = the booking/day **STATE** (Full · Booked · Locked ·
    Whitelist · Blocked · Waitlist · Scheduled), sourced from the states that
    actually appear in the vendor's data (`vendor_calendar_day_states` +
    customer statuses) — never an invented state. NOT event type.
  - **"All services"** = the vendor's **leaf service categories** (distinct
    `vendor_services.category`). Each booking's category resolves via
    `event_vendors.service_id → vendor_services.category` (new
    `fetchBookingServiceAgentMeta` resolver), indexed per calendar day + per
    customer row.
  - **"All agents"** = team-member **display names** (never raw emails) from
    `vendor_team_members` + `users.display_name`. Bookings map to agents via
    `event_vendors.service_id → vendor_service_agents`.
- **Heat map** now overlays a **Demand Radar** intensity gradient on the
  calendar (was: dim-quiet-days). Colour ramps by the demand signal for the
  selected event type, from `demand_radar_for_vendor` (de-identified, min-N
  gated in SQL). The radar rolls up by month (no per-date grain), so the whole
  visible month shares a shade normalised against the busiest (month, type) cell
  across the radar; a demand-scale legend replaces the state legend while on.
  Honest empty state when no demand cleared the privacy floor.
- **Ongoing payments** already collects the FULL month's expected installments
  (every `vendor_payday_installments` row whose `due_date` lands in the month) +
  received-so-far; copy corrected from "due" → "expected" to match.
- **Service status** confirmed reading the vendor's **active** `vendor_services`
  (each active service → "Active") — left as-is (correct).

SPEC IMPACT: None
