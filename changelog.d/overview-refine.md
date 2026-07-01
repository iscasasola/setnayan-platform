## 2026-07-01 · refactor(vendor-dashboard): refine Overview page

Small, focused refinement of the vendor Overview (`/vendor-dashboard` root ·
`apps/web/app/vendor-dashboard/page.tsx`) per owner feedback:

- **Removed the "Invite a couple — free" QR card** at the bottom of Overview. It
  was redundant with the Shortlist/Invite QR that already lives on My Shop (Get
  Discovered · `shop/page.tsx`). The page now ends after "Upcoming schedules".
  Dropped the now-unused `ArrowRight` + `UserPlus` lucide imports; the
  `/vendor-dashboard/invite` route itself is untouched (still linked from My Shop).
- **Heading case made consistent.** The Overview title used `.m-display`, which
  carries `text-transform: uppercase` in `globals.css`, so it rendered ALL-CAPS
  "OVERVIEW" while every sibling primary page (Clients, Conversations, Calendar,
  Reviews, My Shop, My Customers) renders its `<h1>` in sentence case with
  `text-3xl font-semibold tracking-tight sm:text-4xl`. Switched both Overview
  `<h1>`s (main + no-profile landing) to that shared sentence-case pattern.
- Confirmed the three live sections read the right sources (no data changes
  needed): **What's new** = unresolved action-gated items (pending inquiries,
  unconfirmed lock requests, unreplied 5-star reviews, disputed handovers);
  **Ongoing** = incomplete tasks (unanswered inquiries, deposits to confirm,
  draft contracts to send); **Upcoming schedules** = next 5 booked events by date.

SPEC IMPACT: None
