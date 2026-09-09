# ENC-1 · RULE 0 — every stage of the encoder, its entry point, and the gaps between

**Measured 2026-09-09 against `origin/main @ beccdf510`.** Nothing below is read from a plan
document; every "0 callers" line is a grep printed in § 3.

The plan of record (`build-sessions/encoder/README.md`) says *"14 sessions are merged; the
pipeline is complete end to end."* **The first half is true. The second is false** — and the
crate's own `lib.rs` already says so, in writing, under the heading `WHAT IS NOT HERE YET, ON
PURPOSE`.

---

## 1 · The map

| # | stage | what exists | entry point | joined? |
|---|---|---|---|---|
| 1 | phones → controller | `CameraFeedsProvider` / `useCameraFeed` | `app/panood/control/[eventId]/_components/camera-feeds.tsx` | ✅ ships |
| 2 | controller → program bridge | `installProgramBridge()` | `_components/program-bridge.tsx`, mounted on the controller | ✅ ships |
| 3 | bridge → composite | `createProgramCanvas()` | `lib/encoder/program-canvas.ts` | ❌ **0 non-test callers** |
| 4 | composite + overlays | `program-canvas.worker.ts`, `program-compositor`, `draw-overlays`, `program-plan`, `encoder-layout` | worker `{type:'start'}` | ⚠ reachable only through #3 |
| 5 | audio graph | `createAudioMixer()` + `audio-tap.worklet` | `lib/encoder/audio-mixer.ts` | ❌ **0 non-test callers** |
| 6 | audio → AAC | worker's `AudioEncoder` | `startEncoder()` | ⚠ **chunks discarded** — the worker's own line: `// S4/S5: hand chunk to the IPC sender here. S3 stops at "it encoded".` |
| 7 | canvas → H.264 | worker's `VideoEncoder` + `video-encode.ts` ring | `startVideoEncoder()` | ⚠ **chunks accumulate in a ring whose comment says "S5's consumer drains it"; there is no consumer** |
| 7b | the drop policy | `backpressure-ring.ts` | `createBackpressureRing` | ❌ **never adopted.** Its own docblock: *"whichever lands second swaps S4's placeholder `createChunkRing` for `createBackpressureRing` at the one call site."* That swap never happened |
| 8 | chunk → wire envelope | `ipc-contract.ts` / `ipc-envelope.ts` | `chunkToBase64`, `encodeChunk` | ❌ **0 non-test callers** |
| 9 | envelope → Rust | `encoder_start/config/push/stop` | Tauri commands, ACL granted | ❌ **0 callers in `apps/web`** |
| 10 | Rust → FLV → RTMPS | `tagger` · `sender` · `reconnect::supervise` · `file_sink` · `rtmp` — 83 tests, gates CI | `encoder::reconnect::supervise(...)` | ❌ **`encoder_ipc.rs` runs a STUB byte counter.** Zero references to `sender`/`tagger`/`rtmp`/`reconnect`/`file_sink` anywhere under `src-tauri/src/` |
| 11 | the stream key | `StreamKeyState` (`stream_key.rs`) | `stream_key_*` commands | ⚠ **held, never read** by anything that publishes |
| 12 | health → controller | `reconnect::HealthEvent`, `occupancy`, `lib/live-studio-ingest-health.ts` | — | ❌ no bridge; the strip's own comment says the sink is a stub |
| 13 | keep-awake around a broadcast | `start_keep_awake` / `stop_keep_awake` | Tauri commands, ACL granted | ❌ **0 callers** |
| 14 | the go-live guard | *claimed* at `apps/web/lib/encoder/go-live-guard.ts` by `encoder_ipc.rs`'s own docblock | — | ❌ **THE FILE DOES NOT EXIST** |

**Nine joins missing, in two languages. No stage is missing.** Every single thing this session
needs was already written, tested, and left unconnected.

## 2 · Why nobody noticed

`cargo test -p setnayan-encoder` is green and gates CI — but **CI compiles `setnayan-encoder`,
never `setnayan-desktop`** (`.github/workflows/ci.yml:437`, deliberate: the desktop crate needs
tauri + wry + webkit + generated icons). So the crate with 83 passing tests is the half nobody
calls, and the half that would call it is the half CI cannot see. Meanwhile every web-side
module has its own passing unit suite — 13 modules, all green, **all imported only by their own
tests.** A pipeline can be 100% green and 0% connected.

## 3 · The greps

```
$ grep -rn "sender::\|tagger::\|rtmp::\|PublishSession\|FlvTagger\|reconnect::" --include='*.rs' src-tauri/src/
(nothing)

$ for c in encoder_start encoder_config encoder_push encoder_stop start_keep_awake stop_keep_awake; do
    grep -rn "'$c'" --include='*.ts' --include='*.tsx' apps/web/lib apps/web/app | grep -v '\.test\.ts' | wc -l; done
0 0 0 0 0 0

$ grep -rn "from '.*encoder/\(program-canvas\|video-encode\|audio-mixer\|ipc-contract\|ipc-envelope\|program-compositor\|draw-overlays\|backpressure-ring\|audio-clock\|audio-packer\|program-plan\|encoder-layout\)'" --include='*.ts' --include='*.tsx' apps/web | grep -v '\.test\.ts'
(nothing)

$ find apps/web -name 'go-live-guard*'
(nothing)
```

SPEC IMPACT: None — this is a measurement, not a product decision.
