## 2026-07-03 · feat(vendor): Customer Card — client detail respine into header + pipeline + 5 tabs

Restructured the vendor client detail view (`/vendor-dashboard/clients/[eventId]`)
into the owner-approved Customer Card (PR-2 of the Customer Card program;
design source `03_Strategy/Customer_Card_Prototype_2026-07-03.html` View 2).
Every existing feature is preserved — regrouped, not removed.

- **Header (sticky):** back link · initials avatar (from the event display name —
  never a guest name) · event name · meta line (date · venue at booked / city-grain
  region at inquiry) · stage pill (Booked / Quote sent / In conversation) · source
  badge (`event_vendors.source = 'vendor_invite'` → Imported, else In-house) ·
  booked-category chips · action row: Open chat (this event's thread) · New quote
  (proposal flow) · Contract (compact, was the big card) · Files ⇢ tab · Schedule ⇢
  tab · Log payment (thread pay-confirm flow).
- **Pipeline strip:** Inquiry → Quoted → Booked → Delivered → Reviewed. Derivation:
  Quoted = any non-draft `vendor_proposals` row; Booked = RPC stage 'booked';
  Delivered = completion handshake confirmed/auto_confirmed; Reviewed = a
  `vendor_reviews` row exists (public-read RLS). Capped at Delivered until delivery
  so no review-state is implied that wasn't read.
- **Tabs (`?tab=`, server component; mobile = scrollable pill row):**
  - Overview — event snapshot · headcount · dietary (food-gated) · merged style
    card (palette + monogram) · seat plan · editorial-media + completion handshake ·
    deposit acknowledge · cocktail area.
  - Quote & Payments — this event's proposals (₱ from centavos, status chips,
    valid-until) + payment milestones with a paid/received progress bar and an
    "expected next" line, read via the SAME admin-gated vendor fetchers the chat
    thread uses (`fetchPlanProgressForVendor` / `fetchPendingVendorPayments`);
    no RLS weakened, no new SECURITY DEFINER.
  - Files — vendor's own `vendor_contracts` (vendor-readable) + shared handover
    links; honest empty state + "Share files in chat →" (0019 thread attachments
    are deferred in V1 — there is no thread-attachments table to read).
  - Schedule — the entire existing timeline block (call-time suggestion, lens
    toggle, request-a-change, suggest-new-entry, your-requests, .ics, run-of-show),
    the delivery-handover panel, and the change-order trail, unchanged in behavior.
  - Activity — merged newest-first feed (proposals, completion handshake, schedule
    suggestions, deposits, pending payments) interleaved with private, team-shared
    CRM notes (`vendor_client_notes`) + a composer (textarea + optional remind date).
- **New server actions** (`clients/[eventId]/actions.ts`): `createClientNote`,
  `toggleClientNoteDone`, `deleteClientNote` — plain inserts/updates/deletes under
  the caller's own session; the org-scoped RLS on `vendor_client_notes` is the
  authorization boundary (no admin client for notes).
- **Inquiry-stage disclosure ladder:** an accepted-inquiry vendor sees a limited
  card — pipeline highlights Inquiry/Quoted, snapshot shows the city-grain region
  with an "exact venue unlocks when they book you" lock row, Schedule + dietary +
  seat-plan render locked states with no suggest forms, while Quote & Payments /
  Files / Activity work normally. Redirect-on-RPC-error unchanged.
- New components under `clients/[eventId]/_components/`:
  `customer-card-nav.tsx` (tabs + pipeline strip), `customer-card-notes.tsx`
  (notes list + composer), `customer-card-activity.tsx` (merged feed).

No new migrations — the notes table + stage-aware `get_vendor_event_brief` landed
in PR-1 (`20270507380212_customer_card_schema.sql`). Lucide-only icons, terracotta
accent, centavos→₱ formatting matching existing money surfaces, aggregates only
(guest names never render).

SPEC IMPACT: None — design source 03_Strategy/Customer_Card_Prototype_2026-07-03.html
