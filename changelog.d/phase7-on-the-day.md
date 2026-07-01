## 2026-07-01 · feat(vendor-dashboard): On the Day — the 6th vendor nav menu (category-conditional day-of console)

Phase 7 of the vendor-dashboard reorg (03_Strategy/Vendor_Dashboard_Build_Plan_2026-07-01.md).
Ships the 6th vendor navigation menu, "On the Day" — a free, category-conditional
day-of console — and wires it into the sidebar + mobile overflow.

New route `app/vendor-dashboard/on-the-day/page.tsx` (built FIRST, per orphan-prevention):

- Resolves the vendor's category from their `services[]` (canonical `WeddingTile`
  keys) via the new `lib/vendor-day-of.ts` resolver, then renders the matching
  day-of tool — mirroring the prototype's `odayCat` switch:
  - **Photo/Video** → an interactive shot list (must-get shots, checkable, editable)
    alongside the live run-of-show.
  - **Coordinator/Planner** → the command center: the live run-of-show, vendor
    check-in + broadcast-a-change pointers (into the couple's brief), and an
    issues log.
  - **Caterer** → final headcount / meal splits (links into the existing
    production sheet).
  - **Band/DJ** → the setlist (links into Repertoire).
  - anything else → the event brief.
- Anchors on the vendor's own booked events (`fetchVendorPoolBookings` — the same
  RLS-scoped read the Clients page uses), split into Today / Upcoming / Recently
  wrapped, with a focusable event whose live run-of-show renders via the shared
  `RunOfShowHeader` (booked vendors may advance the run-state — the single-winner
  `advance_schedule_block` RPC already allows it).
- Specialist tools surface ONLY on services in their matching category
  (`servicesMatchConsoleKind`).

Two new client components (`_components/shot-list.tsx`, `_components/issues-log.tsx`)
are device-local (localStorage, per event) working tools — offline-tolerant on a
spotty venue signal, no server writes, no new RLS surface.

Nav wiring (added ONLY after the route existed):
- 6th group "On the Day" (key `onday`, item `on-the-day`, `CalendarCheck` icon)
  appended LAST in `VENDOR_NAV_GROUPS` (vendor-sidebar.tsx); docstring updated
  (was "On the Day (deferred)").
- `/vendor-dashboard/on-the-day` added to the mobile bottom-nav "More" umbrella
  activeMatch list (vendor-bottom-nav.tsx) so it lights on mobile.
- `vendor.sidebar.on-the-day` default added to `NAV_SLOT_DEFAULTS`
  (nav-registry-defaults.ts, sortOrder 26) + a `/more` landing description.

RLS/security: no new tables, no new policies, no money. The run-of-show read uses
the existing `event_schedule_blocks_booked_vendor_read` policy (migration
20261130003000); advance uses the existing gated RPC. The console is a free surface.

Deferred (documented, not blocking): the shot list + issues log are per-device
(not couple-shared/synced) — a synced version needs a new table + booked-vendor
RLS; agents/viewers don't see the nav entry (owner/admin only, consistent with the
existing scoped-nav set) though the page self-guards.

Verified: typecheck clean · per-file next lint clean · lint:navicon · lint:botnav ·
lint:retired · lint:entitlement-gates · nav-registry-defaults unit test (8/8) ·
check-migration-timestamps. (Full prod build blocked only by missing SUPABASE env
in the ephemeral worktree — an unrelated blog static-generation env failure; the
new route compiled + is dynamic/auth-gated, never build-time prerendered.)

SPEC IMPACT: None. (Code-canonical surface per the ground-truth doc; the build plan
+ AS_BUILT already describe the 6-menu IA. The "On the Day (deferred)" note in the
vendor-sidebar docstring is now realized.)
