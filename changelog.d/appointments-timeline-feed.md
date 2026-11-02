## 2026-07-11 · feat(schedule): surface confirmed appointments on the timeline feeds (Home Upcoming · Preparation · Journey)

The two-sided Appointments scheduler (`event_appointments`) already shipped, but a couple's confirmed appointments — a food tasting, a fitting, a pre-shoot call scheduled with their booked/shortlisted vendors — appeared **only** inside the vendor workspace. The three planning timelines (`lib/upcoming-items.ts` Home "Upcoming", `lib/preparation.ts` Preparation runway, and the new `lib/journey.ts` Journey arc) had **zero** appointment references, so those scheduled meetings never showed on the couple's calendar. This wires them in — the delivery of the owner's "easier for users to see the upcoming schedules assigned to them by their shortlists."

- `lib/preparation.ts` — new Source 3b `fetchAppointmentItems`: **confirmed** `event_appointments` with a `scheduled_at`, folded into the existing **`meeting`** source (same Meeting chip/icon/vocabulary — no new enum, no presentation change). Merged into the agenda; `sourceCounts.meeting` includes them.
- `lib/upcoming-items.ts` — new Source 1b `fetchAppointments`: **future confirmed** appointments, folded into the `meeting` source/category on Home "Upcoming".
- `lib/journey.ts` — **unchanged**; the Journey arc reuses the Preparation agenda, so appointments flow onto it automatically.

Design: only `status='confirmed'` rows with a `scheduled_at` are surfaced — a `proposed` appointment still awaiting a decision stays in the vendor workspace; `cancelled`/`done` aren't upcoming. Appointments carry the marketplace `vendor_profile_id`, so the vendor name + couple-side workspace deep-link (`/dashboard/[event]/vendors/[event_vendor_id]/workspace`) resolve via a single batched `event_vendors` lookup keyed on `marketplace_vendor_id`. Both fetchers graceful-degrade to `[]` on a missing table (`isMissingRelation` / error guard). Off-platform vendors (null `vendor_profile_id`) fall back to "your vendor" + the vendors list.

**Verified** end-to-end against the live prod schema in a rolled-back transaction: a confirmed in-person tasting and a confirmed custom voice call both surface with the right label + resolved vendor (Grazia Catering), while a `proposed` row is correctly excluded. `tsc` ✓ · `next lint` ✓ · `next build` ✓.

SPEC IMPACT: None (additive read-only integration; the appointments schema + scheduler already shipped per Relationship_Workspace_and_Appointments_2026-07-11.md). DECISION_LOG.md row appended.
