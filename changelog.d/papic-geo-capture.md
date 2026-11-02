## 2026-07-23 · feat(papic): build capture geolocation (papic_geo_metadata) + un-retire the control

Builds the geo-stamp feature the `papic_geo_metadata` data-privacy control was
retired for lacking. The seat/bridge capture path now records a coarse location fix
on Papic photos/clips — fail-closed behind the control, which ships OFF.

- **Migration** `20270915100000_papic_geo_capture.sql` — adds the two columns
  CLAUDE.md's data model names but that never existed (`geo_accuracy_m DOUBLE
  PRECISION`, `geo_unavailable BOOLEAN NOT NULL DEFAULT FALSE`); `geo_lat`/`geo_lon`/
  `captured_at` already existed. Un-retires the control (`status: retired → inactive`,
  `sort_order 65`) — the feature exists now, but geo is a NEW location collection so it
  stays Off until the owner activates it.
- **`lib/papic-geo.ts`** (+ test) — pure `buildPapicGeoFields(geoEnabled, geo)`: `{}` when
  the control is off (fail-closed → no geo column written), the coords + accuracy on a
  valid fix, or `{ geo_unavailable: true }` when enabled-but-no-fix. 7 unit tests.
- **`recordSeatCapture`** (`app/papic/actions.ts`) — new optional `geo` param; awaits
  `isDataPrivacyControlActive('papic_geo_metadata')` and spreads the built fields into
  both inserts. Server is the authoritative gate: a crafted call passing geo to a
  control-off event is dropped. The PGRST204 minimal-retry omits geo, so a pre-migration
  env still records the photo.
- **Client** (`papic-seat-capture.tsx`) — a new `geoEnabled` prop (resolved server-side in
  `seat/[token]/page.tsx`). When on, a background `watchPosition` keeps the last-known fix
  (coarse, cleaned up on unmount); each shot stamps it — the shutter never blocks on a fix.
  When off (the default), the client NEVER requests location, so no permission prompt.
- **Offline queue** (`papic-drain.ts`) — the geo fix is carried through the IndexedDB queue
  (`PapicSeatQueuePayload.geo` → `buildSeatSinkDeps` → drain) so a capture that couldn't
  deliver live (flaky venue Wi-Fi) keeps its location when it drains later.
- **`undefined` geo means "not recorded", not "unavailable"** — `buildPapicGeoFields(true,
  undefined)` returns `{}` (a DSLR-bridge / offline path that carried no fix), so those rows
  are geo-null rather than falsely flagged `geo_unavailable`. Only an explicit failed client
  attempt sets `geo_unavailable = true`.
- **No new share/strip work** — no gallery/download/social DTO selects the geo columns
  (verified), and full-res originals are already EXIF-stripped (`lib/papic-derivatives.ts`),
  so the stored coordinates never leave the server.

Adversarial review (fail-open / geo-leak / migration / client-robustness) run; its 2
confirmed findings — the offline/bridge mislabel + a dead `geoDeniedRef` — are fixed here.
- Catalog + coverage copy updated (un-retire; `declaredIn: ['ropa']` DPS-05; the public
  /privacy "Photos and videos — location data" section already discloses it).

Verified: tsc 0 errors, next lint clean, 2761 unit tests pass (7 new).

SPEC IMPACT: None — the geo capability was already in the CLAUDE.md data model + the ROPA
DPS-05; this ships the previously-missing write path + the two missing columns, all
fail-closed and OFF pending DPO activation. Board decision logged in DECISION_LOG.md.
