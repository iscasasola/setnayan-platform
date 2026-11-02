## 2026-07-03 · feat(vendor): customer info rail in the chat thread

Added the Customer info rail beside the vendor⇆couple conversation
(`/vendor-dashboard/messages/[threadId]`). On lg+ it docks as a right column;
on mobile a header info button opens it as the shared bottom-sheet primitive
(`app/_components/sheet.tsx`). The rail shows identity (initials avatar + event
display name, or the masked "New Customer" placeholder pre-accept), a
server-derived stage pill (Inquiry / Quoted / Booked / Delivered), a compact
event snapshot (date · service · guests), quick actions that reuse existing
in-thread flows (Send proposal, Propose schedule, Log payment), and a "Full
customer profile →" link to `/vendor-dashboard/clients/[eventId]`.

Stage is derived server-side from cheap RLS-scoped reads
(`lib/vendor-thread-stage.ts`): Delivered when the `event_vendors` completion
handshake is confirmed, else Booked on a live `vendor_schedule_pool_bookings`
row for the event, else Quoted when a `vendor_proposals` row is sent/viewed,
else Inquiry — each probe graceful-degrades toward Inquiry. Masking is not
weakened: a still-pending inquiry reveals nothing beyond the placeholder.
UI-only, no migrations.

SPEC IMPACT: None — design source 03_Strategy/Customer_Card_Prototype_2026-07-03.html
