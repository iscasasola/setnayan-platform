## 2026-07-22 · feat(papic): compressed ~0.5 MB clip web-copy at capture (Storage PR-1)

The producer half of the clip-storage win (`0012_papic/Papic_Storage_Sustainability_Spec_2026-07-22.md`,
PR-1): every Papic clip now gets a small H.264 "web copy" generated on-device at
capture and stored under its OWN R2 key, so galleries serve the ~0.5 MB copy and
the heavy raw clip becomes droppable in a later PR. Urgent because the 10s clip
cap (owner 2026-07-22 §0) just ~doubled clip bytes. **Data-loss-safe by
construction: no clip is ever dropped in this PR — the full-res sweep stays
photo-only. The raw clip remains the only playable copy whenever a web copy is
absent (unsupported browser / transcode skip / failure).**

**Schema** — migration `20270906703321_papic_clip_web_copy_at_capture.sql`:
nullable `clip_web_r2_key TEXT` + `clip_web_bytes bigint` on BOTH `papic_photos`
and `papic_guest_captures`. Additive + idempotent (`ADD COLUMN IF NOT EXISTS`),
no RLS change.

**Transcode** — `lib/video-compress.ts` gains a `profile: 'web480'` on
`compressVideoForWeb` (854 long edge → ≤480 short edge for 9:16, H.264 baseline,
CRF 30, 64k AAC; never skips small inputs). The existing quality path (Save-the-
Date) is byte-identical. Never-throws contract unchanged — returns the input on
failure, so callers detect "no web copy" by reference-equality and omit it.

**Guest path** (`papic-guest-capture.tsx` + `api/papic/guest-capture/route.ts`):
the web copy is a **BACKGROUND follow-up** fired only after the raw clip has
recorded — it is never serialized into the capture POST (a multi-second wasm
transcode must not block the raw upload/record path or the next capture). The
client POSTs it as `mode=web_copy` keyed on `capture_id`; a new route branch
validates ownership + `video/*` + size, PUTs to a sibling `-web.mp4` key
(provably ≠ poster/display/raw), then service-role UPDATEs `clip_web_r2_key` +
the real object size — keeping the fragile `papic_record_guest_capture` RPC
arity untouched. Drive still receives the RAW original.

**Seat path** (`papic-seat-capture.tsx` + `recordSeatCapture` +
`persistSeatClipWebCopy`): the web copy is a **BACKGROUND follow-up**, symmetric
with the guest path. `recordSeatCapture` is now RAW-ONLY (the clip_web trailing
args + inline transcode were removed) — it writes the clip row with NULL web
columns and returns immediately. The capture client then FIRE-AND-FORGETs
`uploadSeatClipWebCopy`: transcode → presign+PUT to its own `/api/upload`
UUID-prefixed key → `persistSeatClipWebCopy(token, photoId, key, bytes)`, a new
server action that UPDATEs `clip_web_r2_key`/`clip_web_bytes` **auth-scoped to the
seat session** (seat resolved by token under `paparazzi_seats_claimer_read` RLS,
photo scoped to that seat, `papic_photos_claimer_own` re-enforces the write — a
crafted call can't touch another seat's/event's row). Idempotent + poster-trap
guarded. This was a red-team HIGH: the old inline transcode `await`ed a
multi-second wasm encode INSIDE the serial drain worker, delaying the raw clip's
DB record and backing up the unbounded in-memory queue (memory-pressure loss of
queued raws at a high capture rate).

**Reader wiring** — `resolvePlayRef` prefers `clip_web_r2_key` (drop-safe);
audited + rerouted EVERY hand-rolled clip `<video>`/download surface to it (each
now SELECTs `clip_web_r2_key` + `full_res_dropped_at`): `lib/papic-gallery.ts`
(couple studio gallery — seat + guest clip `videoRef`), the public wedding recap
`app/[slug]/…/editorial/data.ts` (5b-bis "As the Day Unfolded" + both Kwento
anchors — the highest-traffic public clip surface), and the download-originals
routes `…/studio/papic/gallery-zip` + `papic/me/[token]/download` (serve the raw
while it exists, fall back to the web copy once a clip is dropped so it never
404s / vanishes from the ZIP). Earlier callers `lib/alaala-orb.ts` +
`lib/life-story-moment-graph.ts` were already routed. `generateClipThumb`'s
`display_r2_key = posterRef` is deliberately UNTOUCHED (still stays an image; the
web copy is play-only). `clipWebKeyDistinct` poster-trap guard now runs on BOTH
the guest route AND the seat action before persisting.

**Perf/robustness** — `lib/video-compress.ts` now reuses a SINGLE lazily-loaded
ffmpeg.wasm instance (was `new FFmpeg()` + a full core load per clip), serialized
through a promise-chain mutex (single-thread core + fixed FS filenames → no
overlapping encodes) with per-op progress-listener cleanup; the shared instance
is never terminated. The guest `mode=web_copy` UPDATE also scopes on `event_id`
for symmetry (capture_id is already unique).

Tests: `tests/db/papic-clip-web-copy.db.test.ts` (migration replays clean + 4
columns exist + clip rows round-trip on both tables); `clipWebKeyDistinct` unit
test; the resolver's clip_web-over-raw preference + drop-safety now covered per
rerouted PLAY surface (couple gallery seat/guest, recap 5b-bis, both Kwento
anchors).

SPEC IMPACT: storage — clip web-copy at capture (`clip_web_r2_key` /
`clip_web_bytes` on both Papic capture tables; producer for the clip full-res
drop). Corpus already tracks this in `Papic_Storage_Sustainability_Spec_2026-07-22.md`
+ `Papic_One_Pool_Model_Spec_2026-07-22.md`; no new corpus edit required.
