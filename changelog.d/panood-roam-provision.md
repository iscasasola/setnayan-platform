## 2026-07-23 · feat(live-studio): Live Studio ROAM provisioning spine (channel pool + manifest mirror, flag-dark)

PR 3 of the ROAM series — the provisioning engine, still flag-dark
(`NEXT_PUBLIC_PANOOD_ROAM_ENABLED`), isolated from Cast.

- **`lib/panood-roam-provision.ts`:**
  - `buildRoamManifest(zones, streams)` — pure write-side barrier: a zone reaches
    the public picker only with an active stream carrying a real YouTube video id
    (complete/errored streams, invalid ids, disabled zones omitted); ordered by
    zone_index.
  - `mirrorRoamManifest(admin, eventId)` — rebuilds + persists
    `events.panood_roam_manifest` from the current zones + streams (what lights up
    the event-page picker).
  - `checkoutPoolChannel` / `returnPoolChannel` — the Setnayan-owned channel-pool
    lifecycle (one channel per event, idempotent, lost-update-guarded via the
    partial unique index; recycled after).
- **`lib/panood-roam-provision.test.ts`** — 7 tests on `buildRoamManifest`.
- The YouTube broadcast-creation step (N liveBroadcasts per event, reusing
  `lib/panood-youtube.ts`) is **documented but intentionally not wired** — it needs
  the pool channel's own OAuth token, gated on G1 (a verified Setnayan channel) +
  the OAuth-path decision (Workspace-Internal vs External). The wiring shape is
  spelled out in `provisionRoamBroadcasts`' doc block.

Not included (deliberately): the Suite tile + Roam SKU — the Suite renders tiles
from the priced catalog, so those land once the owner sets Roam's price (S2);
hardcoding a placeholder price is the stale-price anti-pattern the corpus warns
against.

SPEC IMPACT: None new (implements `Live_Studio_Cast_and_Roam_2026-07-23.md`; the API_Integration_Checklist #17a rescope + §5.3 pivot banner were applied separately, 2026-07-23).
