## 2026-07-11 · feat(seating): booked-vendors booth picker + door↔walk-through entrance

Two floor-plan authoring features on the shipped 2D seat-plan editor
(`apps/web/app/dashboard/[eventId]/seating/_components/seating-editor.tsx`), one
new migration.

- **Booked-vendors-only booth picker (no migration).** A booth's type picker is
  rebuilt into two sections: **"Your booked vendors"** (only vendors with a
  BOOKED status — `contracted` / `deposit_paid` / `delivered` / `complete` — are
  offered; picking one links `event_floor_booths.event_vendor_id`, and the
  vendor's category drives the 2D icon + PR1 footprint via a new coarse
  `boothTypeForVendorCategory` map, while the 3D venue walk keeps resolving the
  silhouette from the joined vendor category) and **"Stations"** (the non-vendor
  fixtures Front Desk + Custom, via the existing type path — which now also
  un-links any vendor). De-dup is enforced in the picker UI (a vendor already on
  another booth is hidden unless it's this booth's current link). New helpers:
  `fetchBookedVendorsForBooths` + `BOOKED_VENDOR_STATUSES` + `BoothVendorOption`
  in `lib/vendors.ts`; `boothTypeForVendorCategory` in `lib/seating.ts`; the
  seating page threads `bookedVendors` into the editor.
  - **SECURITY (`saveBooths`).** The `event_vendor_id` FK permits any
    `event_vendors` row and RLS only scopes `booth.event_id`, so `saveBooths`
    now nulls out any linked id that isn't a BOOKED vendor of THIS event —
    a tampered payload can't attach (or leak the name/logo of) another event's
    vendor onto the floor plan.
- **Door ↔ Walk-through entrance (one migration).** `event_floor_plan` gains
  `entrance_kind TEXT DEFAULT 'door' CHECK (kind IN ('door','tunnel'))` +
  `entrance_depth_m NUMERIC DEFAULT 3` (migration
  `20270717284319_seating_entrance_kind.sql`). The 2D editor gets a
  **Door | Walk-through** toggle + a depth stepper (walk-through only), draws a
  deeper wall-flush rectangle extending inward by the depth, and the 3D lab/demo
  render a walk-through frame (two side walls + lintel, back-flush to the wall,
  length clamped by `coldSparkFrame` so it never pushes through the far wall).
  The schema value stays `'tunnel'`; the UI **labels it "Walk-through"** to avoid
  colliding with the existing decor `receptionDesign.tunnel` + cold-spark kit.
  Depth is METRES (clamped 1.5–8 server-side, never routed through the percent
  clamp). The 3D-lab save round-trips `entrance_kind` / `entrance_depth_m` so a
  whole-row upsert can't reset a walk-through back to 'door'. The public guest
  walk defaults to 'door' until the `public_venue_scene` payload carries the kind
  (a documented follow-up).

Verified statically (app can't boot locally):
`node --import tsx --test lib/seating-3d.test.ts lib/seating.test.ts
lib/seating.reconcile.test.ts` → 108/108 pass · `pnpm exec tsc --noEmit` →
clean · `pnpm run lint` → 0 errors (only pre-existing warnings in unrelated
files). Migration filename sorts last in `supabase/migrations/`.

SPEC IMPACT: Booked-vendors-only booth placement + the entrance walk-through
kind are owner-decided seat-plan authoring rules (0008 seating chart editor),
already recorded in the corpus memory `project_setnayan_guests_living_roster.md`
(the true-scale "Arrange the room" editor with a door-or-tunnel entrance). The
migration adds `entrance_kind` / `entrance_depth_m` to `event_floor_plan`; no new
customer-facing SKU or price. Nothing to apply in `DECISION_LOG.md` beyond this
note.
