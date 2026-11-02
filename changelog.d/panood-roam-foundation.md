## 2026-07-23 · feat(live-studio): Live Studio ROAM foundation (schema + lib + picker, flag-dark)

The first, isolated foundation for **Live Studio Roam** — the "guests pick which
camera / wander the venue" product (Cast = the existing directed feed; Roam = the
new viewer-choice, multi-camera/multi-venue product). All flag-dark behind
`NEXT_PUBLIC_PANOOD_ROAM_ENABLED` (default OFF); no live surface changes.

- **Schema** (`20270918111955_panood_roam_foundation.sql`) — three tables,
  deliberately ISOLATED from Cast so nothing touches `panood_broadcasts`'
  single-active index (Cast is live + selling):
  - `panood_roam_zones` — the "places" a guest can visit (couple-managed;
    control-room RLS: couple + coordinator + admin, not guests).
  - `panood_roam_channel_pool` — Setnayan-owned YouTube channel inventory (one
    channel checked out per event, recycled; admin-only RLS). Realizes the
    owner-locked 2026-07-23 "our own channel" decision + scales concurrency and
    isolates copyright-strike blast radius.
  - `panood_roam_streams` — per-zone YouTube broadcasts, **N per event** (the
    isolation that lets Roam run many concurrent streams). Holds the secret
    stream key → service-role only (RLS on, no policy), same posture as
    `panood_broadcasts`.
  - `events.panood_roam_manifest` (jsonb) — the PUBLIC picker manifest mirror
    (non-secret {zoneIndex,label,venueLabel,videoId,featured,status}); the event
    page reads this one column, never the roam tables — mirrors how
    `events.panood_watch_url` feeds the Cast embed.
- **lib/panood-roam.ts** — the flag, manifest types, and pure helpers
  (`parseRoamManifest` injection barrier, `selectFeaturedZone`,
  `groupZonesByVenue`, graceful-degrade `fetchRoamManifest`).
- **RoamWatchPicker** (`app/[slug]/_components/roam-watch-picker.tsx`) — the
  self-contained viewer surface (one main player + a venue-grouped camera picker,
  featured feed as default). Not yet wired into the event page — that's the next
  PR, gated on flag + manifest so it's zero-impact when off.
- **Tests** — `lib/panood-roam.test.ts` covers manifest parsing (incl. the
  invalid-video-id injection guard), featured selection, venue grouping, and the
  strict-`true` flag.

Naming: customer-facing "Roam"; code namespace `panood_roam` to stay clear of the
unrelated 3D-avatar "roam" (tap-to-walk). Canonical design:
`Live_Studio_Cast_and_Roam_2026-07-23.md` (spec corpus).

SPEC IMPACT: Applied directly in the corpus — `Live_Studio_Cast_and_Roam_2026-07-23.md` (new canonical) + DECISION_LOG 2026-07-23 (two rows: two-product split; channel model resolved → Setnayan-owned pool).
