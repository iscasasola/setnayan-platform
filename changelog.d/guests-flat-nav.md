## 2026-07-10 · refactor(nav): flatten customer Guests menu to a single item

The customer "Guests" nav is now a plain menu like Overview — its
guest-journey sub-nav is gone from BOTH surfaces:

- **Docked "stage tabs" pill** (mobile `CustomerSectionSubnav`): removed
  `sectionMatch` / `subnavLabel` / `children` from the `guests` menu in
  `lib/customer-menu.ts`, so `matchesMenuSection` returns false for Guests
  routes and the dock never shows.
- **Desktop sidebar submenu** (`customer-nav-config.ts`): the `guests` item is
  now a childless leaf (dropped `guestJourneyChildren` + the Event QR child),
  mirroring the Overview leaf.

Build · Invite · Confirm · Seat · Day-of · Event-QR move in-page in the Living
Roster single-page Guests redesign. **Seat remains the one separate screen**,
opened from within Guests, and stays in the Guests `activeMatch`
(`/guests`, `/seating`, `/event-qr`, `/hosts`) so those routes still light the
tab. Removed the now-unused `buildGuestJourney` / `QrCode` imports from the two
files.

SPEC IMPACT: Living Roster single-page Guests redesign (spec corpus / owner memory) — Guests nav flattened; guest-journey stage nav retired from the sidebar+dock.
