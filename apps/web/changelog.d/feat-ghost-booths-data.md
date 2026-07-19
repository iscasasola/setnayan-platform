## 2026-07-11 · feat(plan3d): ghost-booth prefs schema + placement + actions (slice 9 · Part A, PR 2/N)

Phase 2 of 3D Booth Ads Part A — the persistence + placement foundation (still
nothing renders; PR 3 wires the lab). All behind `NEXT_PUBLIC_PLAN3D_BOOTH_ADS`.

- **Migration `20270719672325`** — two idempotent columns on `event_floor_plan`:
  `ghost_booths_enabled` (BOOLEAN, default TRUE — the master toggle, ON per the
  lock) + `ghost_booths_dismissed` (TEXT[], the per-booth "×" set of
  VendorCategory keys). Ghost booths are derived at read time; only these prefs
  persist. RLS on `event_floor_plan` already scopes rows to the event.
- **`lib/ghost-booths.ts`** — `ghostBoothSlots(count, occupied, tol)`: greedy
  perimeter placement in room %-space that skips any wall slot near a real booth
  or table (and each already-placed ghost), so ghost booths fill EMPTY wall space
  and never crowd the seated floor. Returns fewer than asked when the perimeter
  is full (a ghost booth with no free wall simply doesn't show). Pure + tested.
- **Server actions** (`seating/actions.ts`) — `setGhostBoothsEnabled` (master
  toggle), `dismissGhostBooth` (append-dedup one category), `restoreGhostBooths`
  (clear dismissed). Couple-scoped (auth + RLS on `event_floor_plan`).

+4 placement tests → suite 12/12 green · `tsc` clean · guards + migration guard
clean.

⚠ OWNER: apply the migration on deploy (`supabase db push`, AFTER merge — ORPHAN
rule). Harmless until the flag flips (nothing reads the columns while off).

SPEC IMPACT: None (implements locked slice-9 Part A).
