## 2026-06-26 · feat(guest-3d): public_venue_scene RPC + endpoint (guest 3D explorer data path)

Owner direction ("guests enjoy this too", Sims-style). The read-only, SECURITY-
CRITICAL data path for the guest-facing 3D venue explorer. Privacy LOCKED (RA
10173): "their table named, rest anonymous".

- **Migration `20270224160000_public_venue_scene.sql`** — `public_venue_scene(slug,
  token?)` SECURITY DEFINER RPC, published-gated. Returns room GEOMETRY (floor,
  tables, venue objects) + ANONYMISED occupancy (filled seat NUMBERS, never names)
  always; guest NAMES only for a caller holding a valid per-guest `qr_token` (their
  own invite link) and only that token-holder's OWN table (tablemates). No/bad
  token → zero names. Public ids only; exact token match (no enumeration). Applied
  to `setnayan-prod` and **scoping verified against real data**: no-token call
  leaks no name field, bad token → `you:null`, valid token → only that table named,
  unknown/draft slug → `{published:false}`.
- **`app/api/venue-scene/[slug]/route.ts`** — thin rate-limited GET wrapper
  (mirrors /api/seat-lookup); `?t=<token>` carries the guest's personal token;
  degrades to `{published:false}`, never 500s.

Next increment: the guest 3D route + read-only scene render (reuses the lab engine)
+ Sims-style auto-walk-to-seat then tap-to-roam. PRO-gated.

SPEC IMPACT: 0008 Seating + 0031 Day-of guest — guests get a read-only 3D explorer.
