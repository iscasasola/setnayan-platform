## 2026-07-10 · feat(vendor): Energy dashboard reskin + designed Business/Grow menu

Brought the "Energy, not skin" design language (design ref
`setnayan-vendor-energy.html`) to the **vendor doorway** — sidebar + Overview
body — scoped to `apps/web/app/vendor-dashboard/**`.

**Sidebar** — replaced the flat 6-destination proto-shell with the prototype's
two labelled sections rendered through the shared `SidebarSection` +
`SidebarItem` primitives (wine active-state · nested auto-expanding sub-items):

- **Business**: Home (Overview) · Bookings · Services · Threads (Messages).
- **Grow**: My Shop · Growth & Setnayan (Performance).
- Every prior route stays reachable — the extras (Profile · Verify · Website ·
  Reviews · Track record · Disputes · Theft Watch · Real Stories · Recaps ·
  Recommend · Partnerships · Team · Branches · Clients · Calendar · Contracts ·
  Proposals · Earnings · Payday · Payment options · On the Day · Attributes ·
  Repertoire · Manpower · Moodboard library · Demand Radar · Plan & tokens) nest
  as sub-items under the closest primary. `VENDOR_NAV_GROUPS` (flat) is left
  untouched so the mobile `/more` landing + `vendor-mobile-landing` keep
  enumerating every route.
- Real **badge counts**: Bookings ← pending-inquiry count · Threads ← unread
  chat threads (`countUnreadMessages`) — both from real, RLS-scoped layout data
  (fail-soft to 0 = omitted, never faked).
- Vendor **photography-blue secondary accent** via a single additive
  `--v-blue` token (mirrors the admin `--a-violet` pattern) — identity-card rail
  + Overview stat rings/dots; the shared wine nav-active chrome is untouched.

**Overview body** — added a databerry-inside-editorial stat bento
(`VendorEnergyStats`) above the decision feed: a wine hero ("what needs you
today" + composition legend), a blue `ProgressRing` countdown to the nearest
booked shoot, and three real-count KPI tiles (new inquiries · open tasks ·
upcoming). Section headings + the page H1 move to `.m-serif`. All numbers derive
from the feed data the page already loads (whatsNew · ongoing · upcoming) — no
new queries. Prototype widgets lacking a real source on this surface
(booked-revenue hero, response-rate ring, profile-views sparkline, aggregate
rating, token balance) are omitted, not fabricated.

Guardrails preserved: identity-masking (company logo via `VendorAvatar`, never a
personal photo), team scoping via role filter (owner-only Grow surfaces stripped
for agent/viewer), no schema/migration/dep/flag/billing changes.

SPEC IMPACT: None — presentation-only vendor doorway reskin + sidebar menu
regroup (design = `setnayan-vendor-energy.html`). No SKU, schema, or pricing
change.
