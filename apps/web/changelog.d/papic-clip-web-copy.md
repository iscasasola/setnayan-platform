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

**Seat path** (`papic-seat-capture.tsx` + `recordSeatCapture`): the web copy is
produced after the raw upload and passed as new optional trailing args into the
clean direct insert (`/api/upload` UUID-prefixes every key, so the copy is
distinct by construction). The insert's PGRST204 fallback now strips the web
columns too, so a pre-migration env still never loses a clip.

**Reader wiring** — `resolvePlayRef` already prefers `clip_web_r2_key`; audited
every caller's SELECT and added the column where missing: `lib/alaala-orb.ts`
(needed it) and `lib/life-story-moment-graph.ts` (both papic_photos +
papic_guest_captures SELECTs needed it). `generateClipThumb`'s `display_r2_key =
posterRef` is deliberately UNTOUCHED (still stays an image; the web copy is
play-only). New `clipWebKeyDistinct` poster-trap guard asserts the web key never
equals the still/raw key before persisting.

Tests: new `tests/db/papic-clip-web-copy.db.test.ts` (migration replays clean +
4 columns exist + clip rows round-trip on both tables); `clipWebKeyDistinct`
unit test; the resolver's clip_web-over-raw preference stays covered.

SPEC IMPACT: storage — clip web-copy at capture (`clip_web_r2_key` /
`clip_web_bytes` on both Papic capture tables; producer for the clip full-res
drop). Corpus already tracks this in `Papic_Storage_Sustainability_Spec_2026-07-22.md`
+ `Papic_One_Pool_Model_Spec_2026-07-22.md`; no new corpus edit required.
