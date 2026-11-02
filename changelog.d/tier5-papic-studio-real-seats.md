## 2026-06-25 · fix(papic): wire studio roster to real seat data, de-fake DSLR bridge

The Papic studio surface (`apps/web/app/dashboard/[eventId]/studio/papic/page.tsx`)
read a hardcoded MOCK roster (`MOCK_SEATS` — "Tita Marites" + invented per-seat
Canon/Nikon DSLR bridges) for its seat-status and Pro Camera Bridge cards.

- Seat status now reads REAL rows via `fetchPapicSeats` / `fetchPapicSamplerSeats`
  (`lib/papic-seats.ts` → `public.paparazzi_seats`). Roster source = paid seats
  when `eventOwnsPapicSeats`, else the free sampler seats when any exist, else []
  (buy/try state). Real total/claimed (`claimer_user_id && !revoked_at`)/unclaimed
  counts. Each unclaimed seat gets a "copy claim link" affordance built from
  `papicSeatClaimUrl` + the request host (reuses the crew page's `CopyButton`).
- DSLR Camera Bridge card is now HONEST: `paparazzi_seats` has no bridge column,
  so the fabricated "X of Y bridged" counts + per-seat pairing roster are removed.
  It now states the bridge is included with Papic and pairs in the native Papic app
  (V1.5), keeping the educational SDK matrix.
- Deleted `MOCK_SEAT_PACK` / `MockSeat` / `MOCK_SEATS` / `bridgeSeats` /
  `seatPackLabel` + the now-unused `Aperture` import.
- Prices stay live from the admin catalog via `formatV2Sku`. All gates
  (`eventOwnsPapicSeats`, sampler), graceful-degrade ([] on missing table), and
  the buy/checkout flows are preserved. Storage / gallery / magazine / recap /
  sampler-retention sections untouched.

SPEC IMPACT: None (corpus already describes Papic seats + included DSLR bridge;
this only replaces mock UI data with the real DB-backed read).

## 2026-06-25 · fix(panood): real ownership + live prices, honest not-built streaming preview

The Panood studio setup/broadcast surfaces faked state. Wired to real data; the
genuinely-not-built streaming infra is now an honest preview, not fake data.

- `panood/setup/page.tsx`: removed `mockPanoodSetup()` (which faked `baseOwned: true`
  + extra cameras/hours). Ownership now derives from real orders via
  `eventSkuActive` (PANOOD_SYSTEM base · ANIMATED_MONOGRAM · etc.) — bundle/refund/
  admin-approval-aware, degrades false on a missing orders table. `youtubeWatchUrl`
  still reads the real `events.panood_watch_url`.
- Prices read LIVE from the admin catalog via `formatV2Sku` (PANOOD_SYSTEM /
  ANIMATED_MONOGRAM / SDE — all present + active in prod); the hardcoded ₱ constants
  are gone. Add-ons with NO catalog SKU yet (BROADCAST_STYLE_PACK, AI_EDITED_HIGHLIGHT,
  camera/hour) render an honest "arrives with the streaming rollout" state with no
  price, and faked `extraCameras`/`extraHours` counts are removed.
- `panood/broadcast/page.tsx`: the control room is genuinely unbuilt — renamed the
  fake roster to `SAMPLE_CAMERA_LAYOUT` (all "offline"), zeroed audio meters, and
  labelled everything a "broadcast preview / sample layout — not a live feed".
- `panood/_components/copy-link.tsx`: removed the stub/fake URL handling.

The already-real bits (OAuth grant, watch-url persistence, reviews, the add-on hub
page) are untouched. Adversarially verified incl. real `tsc` (0 new errors) and a
live prod-DB cross-check of which SKUs exist.

SPEC IMPACT: None (replaces mock UI state with real DB-backed reads + honest
not-built states; no pricing or scope change).
