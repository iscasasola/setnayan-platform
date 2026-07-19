## 2026-07-20 · feat(coordinator): filtered run-of-show, schedule templates, bulk retime

Coordinator P2 (`coordinator#P2-filtered-ros`) — one master `event_schedule_blocks`
timeline → auto-synced per-vendor / per-couple / per-guest views that are pure
FILTERS over the master (never copies), plus a responsible party per row,
wedding run-of-show templates, and a one-action bulk retime.

- **Migration `20270825042743`** — two columns on `event_schedule_blocks`:
  `responsible_party` (free-text vendor/crew/family label) and
  `responsible_vendor_ids UUID[]` (tagged `event_vendors` ids that drive the
  per-vendor slice). NO new RLS — both ride the existing row policies (couple
  write · moderator schedule-edit write · booked-vendor full read per locked
  D2 · anon is_public read).
- **`lib/schedule-ros.ts`** — pure audience filter (couple = master, guest =
  existing `is_public` semantics, vendor = tagged rows with parent/child
  context expansion), bulk-retime span + patch math (contiguous span from an
  anchor, children travel with parents, durations preserved, ±12 h cap), and
  a best-effort meta fetch that degrades to empty pre-migration.
- **`lib/schedule-templates.ts`** — 3 wedding run-of-show skeletons (classic
  full day · civil & intimate · reception-only); template load is strictly
  additive-into-empty — it never overwrites existing rows.
- **Server actions** (`schedule/actions.ts`): `setBlockResponsibleParty`
  (vendor ids validated against the event's own registry),
  `bulkRetimeScheduleBlocks`, `loadScheduleTemplate` — all through the
  authenticated client so existing RLS (couple + coordinator schedule-'edit')
  decides who may write.
- **UI, flag-gated `NEXT_PUBLIC_SCHEDULE_ROS_P2_ENABLED` (default OFF = today's
  behavior byte-identical):** couple schedule page gains the View-as lens bar
  (master / guests / tagged vendors), read-only lens previews, the bulk-retime
  panel, the empty-state template picker, and a per-block responsible-party
  editor. Vendor Brief: rows explicitly tagged to the vendor rank 'primary'
  ("Your slot" + "My slots only") — data-gated, inert until rows are tagged.
- **Tests:** 25 unit tests (`schedule-ros.test.ts`, `schedule-templates.test.ts`)
  pin the filter, retime, and template contracts.
- Reminders/call-times remain EMAIL-ONLY (no-SMS lock) and are P3's build —
  no send path here.

SPEC IMPACT: Coordinator_Whats_Next_2026-07-18 §P2 shipped (filtered
run-of-show + responsible party + templates + bulk retime);
Coordinator_Role_Feature_Spec_2026-07-18 P2 pillar → built (flag-dark;
owner: push migration 20270825042743, then flip NEXT_PUBLIC_SCHEDULE_ROS_P2_ENABLED).
