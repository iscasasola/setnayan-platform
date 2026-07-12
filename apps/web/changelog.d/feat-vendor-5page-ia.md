## 2026-07-12 · feat(vendor): the 5-page IA — desktop sidebar collapses to the owner's locked five destinations

Owner 2026-07-12: "overview, my shop, my customers, my performance, BEO are
all 1-page each with the different features integrated on that page." Desktop
now mirrors the mobile bottom nav exactly:

- **Sidebar = 5 items** (Overview · My Shop · My Customers · My Performance ·
  On the Day (BEO)) — the Business/Grow tree with nested children is retired.
- **My Customers hub** gains tabs: pipeline (default) · Bookings · Clients ·
  Calendar · Payday · Messages. The sidebar badge now carries inquiries +
  unread threads combined.
- **My Shop hub** gains tabs: home (profile · services · verify · website —
  incl. the 2026-07-02 services fold-in) · Contracts · Proposals · Earnings ·
  How clients pay you · Manpower · More tools (cards linking Reviews, Track
  record, Real Stories, Recaps, Recommend, Partnerships, Attributes,
  Repertoire, Moodboard library, Branches, Team, Disputes, Theft Watch).
- **My Performance hub** gains tabs: overview (default) · Demand Radar.
- **11 old routes → redirect stubs** (clients, calendar, payday, messages,
  bookings, contracts, proposals, earnings, payment-options, manpower,
  demand) into their hub's ?tab=, forwarding all params — every deep link
  and bookmark keeps working (pattern: /services → My Shop, 2026-07-02).
  Surfaces live on verbatim as `<route>/surface.tsx`.
- Staff scope updated: agents/viewers scope to Overview + My Customers (the
  hub whose tabs carry their Bookings + Threads work); role checks inside
  each surface unchanged.

Verified: tsc + lint clean; all 10 hub/legacy routes respond without server
errors on a local dev run.

SPEC IMPACT: corpus DECISION_LOG.md 2026-07-12 row (vendor 5-page IA lock).
