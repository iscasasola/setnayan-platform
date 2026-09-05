# S0 — FINDING: the WebCodecs floor and the IPC transport, measured inside the real app

**Session:** S0 (`build-sessions/encoder/S0.md`) · **Measured against** `origin/main @ a8cfdd16ac8c4471729c05f1de250780f7f500ee` (fetched 2026-09-05) · **Branch** `claude/encoder-s0-spike`
**Machine:** this Mac only — macOS 26.6.2 (25G83), arm64, Apple M1 Pro, 8 cores · WebKit framework **21624.5.1.11.3** · Safari 26.6.2 · Tauri 2.11.1 · wry 0.55.1 · rustc 1.95.0 · debug build (`cargo tauri build --debug --no-bundle`)
**Where the probe ran:** INSIDE the Tauri webview, on the real origin `https://www.setnayan.com` (the `/login` page, then `/dashboard` after the app's own redirect) — not Safari, not a `file://` page. Every number below is quoted from a log in `build-sessions/encoder/S0-logs/` (copied verbatim from `src-tauri/probe/*.log`, which `src-tauri/.gitignore` excludes).

This is a finding, not a feature. It answers two questions separately — **§ 8** — and it does not choose between the transport options it lays out; that choice belongs to the owner and a re-scoped S5.

---

## 0. Headline

| Question | Answer | Where |
|---|---|---|
| Q1 — does WebCodecs exist and accept HW H.264 + AAC inside WKWebView on the real origin? | **YES on macOS 26.6.2 arm64, WebKit 21624.5.1.11.3.** `VideoEncoder`, `AudioEncoder`, `VideoFrame`, `AudioData` all `function`; 720p and 1080p `avc1.42E01F` `prefer-hardware` supported; AAC-LC `mp4a.40.2` 48 kHz stereo supported; all of it also inside a dedicated Worker. `hardwareAcceleration: 'require-hardware'` **throws `TypeError: Type error`** — WebKit rejects the value outright. | § 2 |
| Q1 — the other matrix cells (macOS 14/15 ± Safari 26, macOS 13, Windows 11 HW, Windows blocklisted/VM) | **LEFT UNDONE** — no second machine in this session. Exact probe to run per cell in § 2.3. | § 2.3 |
| Q1 — long 720p30 encode | See § 4 (filled from `s0-encode.log`). | § 4 |
| Q2 — does the IPC body arrive as `InvokeBody::Raw` from the real origin? | **NO — never, not once.** The `ipc://localhost` custom protocol fails on the very first invoke (`TypeError: Load failed` on all four direct `fetch` variants and on XHR), Tauri logs `IPC custom protocol failed, Tauri will now use the postMessage interface instead`, and **1797 / 1797** 10 KB chunks arrived Rust-side as `body=Json kind=array len=10240`. The app is in permanent postMessage/JSON-array fallback from its first IPC call. | § 3.1 |
| Q2 — is that the origin, or the machine? | The origin. From the bundled shell origin `tauri://localhost` a raw `fetch('ipc://localhost/probe_report')` **reaches Rust** (Tauri's invoke-key check answered it); from `https://www.setnayan.com` the same fetch never leaves WebKit. § 3.2 has the control run's numbers. | § 3.2 |
| Q2 — does a CSP without `ipc:` change anything? | It cannot make it worse: the transport is already in fallback before any CSP is enforced. The prod CSP is **Report-Only** (`disposition:report`), so it did not cause the failure. An enforced `connect-src 'self' https: wss:` injected at runtime produced `disposition:enforce` violations and the JSON path kept working (mean latency rose 50.7 → 155 ms). | § 3.4 |
| Q3 — HLS-CORS and WHIP spikes | **LEFT UNDONE** — need the owner's YouTube channel (HLS ingest URL) and a VPS. Exact steps in § 5. | § 5 |

---

## 1. How it was measured (so it can be re-run)

Harness on this branch, **debug builds only** (`#[cfg(debug_assertions)] mod probe;` in `src-tauri/src/lib.rs`; `build.rs` adds `capabilities-debug/` only when cargo `PROFILE=debug`; `apps/web/lib/desktop-probe-is-debug-only.test.ts` fails if any leg of that gate moves):

- `src-tauri/src/probe.rs` — `probe_report(json)` prints a page record to stdout; `probe_ipc(request)` reports whether the body arrived as `InvokeBody::Raw` or `InvokeBody::Json` (and the JSON kind/length); `on_page_load` evals the probe script when `SETNAYAN_PROBE=<mode>` is set and the page is on setnayan.com (or on `tauri://localhost` when `SETNAYAN_PROBE_ORIGIN=any`). A debug-only HTTP listener on `127.0.0.1:<random>` is the "loopback" arm (raw POST bodies, CORS preflight answered, WebSocket handshakes logged but not completed) and carries a `/diag` side channel for records the invoke path cannot deliver.
- `src-tauri/probe/encoder-probe.js` — the page-side probe: transport diagnostics before the first invoke, the Q1 matrix (window + worker), the Q2 runs, the long encode (OffscreenCanvas in a Worker → `VideoEncoder`).
- `src-tauri/probe/run.sh <matrix|ipc|encode> [minutes] [log]` — builds, launches with the env var, samples `pmset -g therm` + WebContent/GPU CPU every 10 s.
- `src-tauri/probe/local-shell/` + `capabilities-debug/probe-local.json` — the control origin (`SETNAYAN_PROBE_SHELL=local`).

Commands that produced the logs (all from the worktree root; `HH:MM` = start time on 2026-09-05, Asia/Manila):

| Log | Command | Harness commit | Started |
|---|---|---|---|
| `s0-matrix.log` | `src-tauri/probe/run.sh matrix 1 src-tauri/probe/s0-matrix.log` | `22b2838de` | 13:32 |
| `s0-ipc.log` | `src-tauri/probe/run.sh ipc 1 src-tauri/probe/s0-ipc.log` (window **hidden** the whole run — corroboration only, see § 3.5) | `22b2838de` | 13:35 |
| `s0-ipc-realorigin.log` | `src-tauri/probe/run.sh ipc 1 src-tauri/probe/s0-ipc-realorigin.log` — **the primary Q2 run** | `22b2838de` | 14:26 |
| `s0-ipc-localshell.log` | `SETNAYAN_PROBE_TOP=1 SETNAYAN_PROBE_SHELL=local src-tauri/probe/run.sh ipc 1 …` — first control attempt, killed before any stage printed (kept as evidence for the one line it did print) | `23afcb631` + uncommitted window-thread fix | 14:34 |
| `s0-ipc-localshell-rerun.log` | `env -u SETNAYAN_PROBE_TOP SETNAYAN_PROBE_SHELL=local src-tauri/probe/run.sh ipc 1 …` — **the control run** | `75eff03ea` | 14:42 |
| `s0-ipc-localshell-control.log` | `SETNAYAN_PROBE_SHELL=local SETNAYAN_PROBE_TOP=1 src-tauri/probe/run.sh ipc 1 src-tauri/probe/s0-ipc-localshell-control.log` — **the completed control**, all stages (§ 3.2) | `7a0dd1084` | 14:55 |
| `s0-ipc-realorigin-loopback.log` | `env -u SETNAYAN_PROBE_TOP src-tauri/probe/run.sh ipc 1 …` — real origin again, now with the loopback HTTP + WebSocket arms | `75eff03ea` | see § 3.3 |
| `s0-encode.log` | `SETNAYAN_PROBE_TOP=1 src-tauri/probe/run.sh encode 60 …` | `75eff03ea` | see § 4 |

Harness verification (2026-09-05, `7a0dd1084`): `cargo tauri build --no-bundle && strings src-tauri/target/release/setnayan-desktop | grep -c probe_report` → **0** (also `probe_ipc` 0, `allow-probe` 0); the debug binary is the positive control at 7 / 3 / 1. The first release build on this tree read **1 / 1 / 1**: tauri-build reads `./permissions/**` in every profile and a debug build had left `permissions/autogenerated/probe_*.toml` behind (gitignored), so the release binary carried the allow/deny permission *definitions* — no capability granted them and no handler existed, but the string was there. `build.rs` now removes that directory in non-debug builds. Two `run.sh` defects fixed in the same commit: its 300-s silence cut-off compared the log's byte size, which `sample()` grows every loop, so it could never fire (a control run hung for an hour); and it launched the freshly built binary in place, which any rebuild beside it replaced (see § 3.2 item 3).

Probe identity line from every real-origin run (`stage:"start"`): `"href":"https://www.setnayan.com/login","origin":"https://www.setnayan.com","userAgent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 SetnayanApp/desktop","platform":"MacIntel","hardwareConcurrency":8,"devicePixelRatio":2`. (The UA string is the one `tauri.conf.json` pins; it is not the WebKit version — the framework's own `version.plist` is.)

---

## 2. Q1 — the OS matrix

### 2.1 This Mac — every cell measured (`s0-matrix.log`, 13:35:17–13:35:28; identical results repeated in `s0-ipc.log`, `s0-ipc-realorigin.log` twice, on `/login` and on `/dashboard`)

Environment line: `macOS 26.6.2 · 25G83 · arm64 · Apple M1 Pro · WebKit framework: 21624.5.1.11.3 · Safari: 26.6.2 · Tauri 2.11.1`.

**Globals on `window`** — stage `matrix-globals`, 49 ms after eval:

| Probe | Result |
|---|---|
| `typeof VideoEncoder` | `function` |
| `typeof AudioEncoder` | `function` |
| `typeof VideoFrame` / `AudioData` / `EncodedVideoChunk` / `EncodedAudioChunk` | `function` × 4 |
| `typeof MediaStreamTrackProcessor` (window) | **`undefined`** |
| `typeof MediaStreamTrackGenerator` (window) | `undefined` |
| `typeof OffscreenCanvas` | `function` |
| `typeof AudioWorklet` / `AudioWorkletNode` / `'audioWorklet' in AudioContext.prototype` | `function` / `function` / `true` |
| `typeof Worker` | `function` |
| `typeof SharedArrayBuffer` / `crossOriginIsolated` | **`undefined` / `false`** (the page sends no COOP/COEP — expected; nothing in the plan needs SAB) |

**`VideoEncoder.isConfigSupported`** — stage `matrix-video`, 268 ms (`codec:'avc1.42E01F', bitrate:2_500_000, framerate:30`):

| Config | `supported` | Notes |
|---|---|---|
| 1280×720 `hardwareAcceleration:'require-hardware'` | **`null` — threw `TypeError: Type error`** | WebKit rejects the enum value itself; the promise never resolves to a support answer |
| 1280×720 `'prefer-hardware'` | `true` | echoed config: `bitrateMode:"variable", latencyMode:"quality", alpha:"discard"` |
| 1280×720 no preference | `true` | echoed `hardwareAcceleration:"no-preference"` |
| 1920×1080 `'require-hardware'` | **`null` — `TypeError: Type error`** | same rejection |
| 1920×1080 `'prefer-hardware'` | `true` | |
| **the encode config** — 720p `prefer-hardware`, `bitrateMode:'constant'`, `latencyMode:'realtime'`, `avc:{format:'annexb'}` | `true` | echoed with all four fields kept: `"avc":{"format":"annexb"},"bitrateMode":"constant","latencyMode":"realtime"` |

**`AudioEncoder.isConfigSupported`** — stage `matrix-audio`, 270 ms:

| Config | `supported` |
|---|---|
| `mp4a.40.2` (AAC-LC) 48 000 Hz × 2 ch | `true` |
| same + `bitrate:128_000` | `true` (echoed `bitrate:128000, bitrateMode:"variable"`) |
| `opus` 48 000 Hz × 2 ch | `true` |

**Inside a dedicated Worker** (blob URL, `worker-src 'self' blob:` is in the prod CSP) — stage `matrix-worker`, 449 ms:

| Probe | Result |
|---|---|
| `typeof VideoEncoder` / `AudioEncoder` / `VideoFrame` | `function` × 3 |
| `typeof MediaStreamTrackProcessor` (worker) | **`function`** — present in workers only, absent on `window` |
| `typeof OffscreenCanvas` / `new OffscreenCanvas(64,64).getContext('2d')` | `function` / `object` |
| 720p `prefer-hardware` `isConfigSupported` | `true` |
| AAC-LC 48k stereo `isConfigSupported` | `true` |

Whether the H.264 encoder actually engaged VideoToolbox (as opposed to `prefer-hardware` silently choosing software) is not observable through WebCodecs; the long encode in § 4 reports WebContent/GPU-process CPU and thermal state, which is the only proxy this harness has.

### 2.2 What this means for S4 (config shape)

- **Use `hardwareAcceleration: 'prefer-hardware'`**, never `'require-hardware'` — the latter is a `TypeError` on this WebKit, in `isConfigSupported` and therefore in `configure()`. S4's "hardwareAcceleration: <from S0 finding>" slot is filled: `'prefer-hardware'`.
- `bitrateMode:'constant'`, `latencyMode:'realtime'`, `avc:{format:'annexb'}` are all accepted and echoed. (S4 asks for `avc:{format:'avc'}`; only `annexb` was probed here — one extra `isConfigSupported` call, listed in § 2.3.)
- `MediaStreamTrackProcessor` is worker-only on this WebKit. The S1/S2 pipeline draws to an OffscreenCanvas in a worker and never needs it, but nothing may call it from the main thread.
- AAC-LC via `AudioEncoder` is present — the Safari 26 gate the README describes holds on this machine. Opus is also available (irrelevant for RTMP/FLV, noted for completeness).

### 2.3 LEFT UNDONE — the other matrix cells, with the exact probe

None of these machines were available in this session. For each, the probe is the same harness; nothing needs re-writing:

```bash
git fetch -q origin && git checkout claude/encoder-s0-spike   # or main once merged
pnpm install
src-tauri/probe/run.sh matrix 1 src-tauri/probe/s0-matrix-<machine>.log
grep -E '"stage":"(start|matrix-globals|matrix-video|matrix-audio|matrix-worker)"' src-tauri/probe/s0-matrix-<machine>.log
```

Record the header block the runner prints (`sw_vers`, `uname -m`, chip, WebKit framework `CFBundleVersion`, Safari version) beside the four stage lines.

| Cell | Expected | Pass = | Run |
|---|---|---|---|
| macOS 14 or 15 **without** the Safari 26 update, Apple silicon | `AudioEncoder` **`undefined`**, `VideoEncoder` `function` | matches expectation (confirms the AudioEncoder gate is Safari 26's WebKit) | as above |
| the same machine **with** Safari 26 installed | `AudioEncoder` `function`, AAC `supported:true` | matches | as above, after the Safari update |
| macOS 13, any chip | `AudioEncoder` `undefined` (cannot receive Safari 26) | matches — confirms the floor | as above |
| Windows 11, `edge://gpu` "Hardware accelerated" | all globals `function`; 720p/1080p `prefer-hardware` `true`; `require-hardware` returns a boolean rather than throwing (Chromium) | `supported:true` for the encode config | run.sh is macOS-only (`pmset`, `ps -o`); on Windows run `cargo tauri build --debug --no-bundle`, then `set SETNAYAN_PROBE=matrix && target\debug\setnayan-desktop.exe > s0-matrix-win.log` — the probe prints the same stage lines. Also capture the WebView2 runtime version (`reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" /v pv`). |
| Windows 11 GPU-blocklisted or VM | `prefer-hardware` `true` with the OpenH264 software path (Constrained Baseline only — `avc1.42E01F` IS Constrained Baseline L3.1, so still `true`); `require-hardware` `false` | record both values — this is the machine class S9's adaptive bitrate has to survive | same as the Windows row |
| this Mac, `avc:{format:'avc'}` | `true` | one line added to `matrix-video` in `encoder-probe.js` | `run.sh matrix` |

---

## 3. Q2 — the IPC path, and why it is not binary

### 3.1 The primary run on the real origin (`s0-ipc-realorigin.log`, 14:26:39)

**Before the first `invoke`** the probe tried the IPC URL directly, with a `securitypolicyviolation` listener already armed (stage `start`, 13 ms after eval, on `https://www.setnayan.com/login`, `visibility:"visible"`):

```
"ipcUrl":"ipc://localhost/probe_report",
"directFetch":[
  {"label":"POST no custom headers (no preflight)","error":"TypeError: Load failed"},
  {"label":"POST with Tauri headers (preflight)","error":"TypeError: Load failed"},
  {"label":"POST mode=no-cors","error":"TypeError: Load failed"},
  {"label":"GET","error":"TypeError: Load failed"}],
"xhr":{"error":"xhr onerror","status":0},
"cspViolationsBeforeFirstInvoke":[ {"blockedURI":"ipc://localhost/probe_report","directive":"connect-src","disposition":"report"} ×5 ]
```

**The first real `invoke`** (stage `first-invoke-transport`, 21 ms): `"tauriFallbackWarnings":["IPC custom protocol failed, Tauri will now use the postMessage interface instead | TypeError: Load failed"]`. Rust saw that record arrive `via=postMessage headers=0` — the custom-protocol path carries an `Origin` header and a `Content-Type`; the postMessage path carries no headers at all, which is how `probe.rs` tells them apart.

**60 s at 30 invokes/s of a 10 240-byte `Uint8Array`** (stage `ipc-raw-60s`):

| Metric | Value |
|---|---|
| sent / completed / errors | **1797 / 1797 / 0** |
| achieved rate | 29.63 / s (target 30) |
| body kinds seen by Rust | `{"json:array:10240":1797}` — **zero `Raw`** |
| Rust-side samples | `[probe-ipc] body=Json #1 kind=array len=10240 via=postMessage content-type=None` … `#300` … `#1800` … `#2400` — every printed sample identical |
| latency (invoke → resolved) | mean **50.7 ms** · p50 **19 ms** · p95 **151 ms** · p99 **293 ms** · max **501 ms** |
| in-flight max | 41 |
| document visibility during the run | `hidden` (the run started on `/login`; the app's own redirect to `/dashboard` at ~17 s re-evaluated the probe there — the 60-s window below is the `/dashboard` instance's; see § 3.5 for the visibility caveat) |

What "JSON array" costs: Tauri's `ipc-protocol.js` (quoted from `~/.cargo/registry/src/*/tauri-2.11.1/scripts/ipc-protocol.js`) sets `customProtocolIpcFailed = true` in the fetch `catch` and **never clears it**; from then on `processIpcMessage` serialises a `Uint8Array` as a JSON array of numbers (`Array.from`), so a 10 240-byte chunk becomes 10 240 decimal literals plus commas — for encoded H.264 (bytes roughly uniform over 0–255) that is ≈ 3.6 × the bytes on the wire, then a `serde_json` parse into `Vec<Value>` on the Rust side (`InvokeBody::Json(Value::Array)`), then a second copy into bytes. The measured numbers above already include that.

### 3.2 The control — the same probe on the bundled shell origin (`s0-ipc-localshell.log` 14:34, `s0-ipc-localshell-rerun.log` 14:42)

The first control attempt (`s0-ipc-localshell.log`) printed exactly one line from Rust before the previous session stopped it:

```
__TAURI_INVOKE_KEY__ expected Fl+0Bt1Wu6EOlem.[Vox but received bogus
```

That line is `tauri-2.11.1/src/webview/mod.rs` `Webview::on_message` answering the probe's second diagnostic fetch — `fetch('ipc://localhost/probe_report', {headers:{'Tauri-Invoke-Key':'bogus', …}})`. It can only be produced if WebKit **delivered the `ipc://` request to wry's `WKURLSchemeHandler`**. On `https://www.setnayan.com` the identical fetch is `TypeError: Load failed` and Rust prints nothing. That single line is therefore the cleanest statement of the finding: the custom protocol is reachable from `tauri://localhost` and unreachable from the https origin, on the same binary, the same WebKit, the same minute.

**The completed control (`s0-ipc-localshell-control.log`, 14:55:42, harness `7a0dd1084` — run from a per-run copy of the binary so a rebuild beside it could not kill it).** Same binary, same WebKit, same probe, the only change is the origin (`tauri://localhost`, `capabilities-debug/probe-local.json`). ⚠ Load average at launch was **123.24 / 75.88 / 40.34** — a release build, a second full debug build in `../wt-s0-run` and that tree's own control app were all running beside it — so every latency figure below is unusable and is quoted only because it is in the log; the body-type and transport columns are what this run measures.

```
[runner] 2026-09-05T14:55:55+0800 load-at-start: 123.24 75.88 40.34 · SETNAYAN_PROBE_TOP=1 SETNAYAN_PROBE_ORIGIN=any
[runner] 2026-09-05T14:55:55+0800 app pid=86930 bin=/Users/icecasasola/Documents/Claude/Projects/wt-s0/src-tauri/target/debug/setnayan-desktop.run-86392 (copy of /Users/icecasasola/Documents/Claude/Projects/wt-s0/src-tauri/target/debug/setnayan-desktop)
```

1. **The custom protocol works from this origin, and the body is `Raw`.** Every `probe_report` line from the run is tagged `via=custom-protocol headers=8` (an `Origin` header and a `Content-Type` — the postMessage path carries none); `first-invoke-transport` reports `"tauriFallbackWarnings":[]`, `"cspViolationsSoFar":0`; the direct `fetch('ipc://localhost/probe_report')` without headers answered **HTTP 500 `missing Tauri-Invoke-Key header`** (Tauri's `parse_invoke_request`) instead of `TypeError: Load failed`, and the `GET` answered **405 `only POST and OPTIONS are allowed`** — both are responses from wry's scheme handler, which the https origin never reaches.

```
[probe-ipc] t=1788591493781 body=Raw #1 len=10240 via=custom-protocol content-type=Some("application/octet-stream")
[probe] t=1788591619965 via=custom-protocol headers=8 {"stage":"ipc-raw-60s","ms":259142,"visibility":"visible","payloadBytes":10240,"targetRate":30,"seconds":60,"sent":1783,"completed":1783,"errors":0,"achievedRate":14.27,"kinds":{"raw:10240":1783},"latencyMs":{"mean":1226.658,"p50":2,"p95":17321,"p99":19311,"max":45271},"inflightMax":121,"elapsedMs":124970}
```

   1783 / 1783 `raw:10240`, 0 errors, **zero `Json`**, in the same 60-s shape that produced 1797 / 1797 `json:array:10240` from `https://www.setnayan.com` (§ 3.1). The transport claim in § 3.1 is therefore attributable to the origin, not to the machine, the Tauri version or the probe.

2. **The Raw → Json transition, measured.** After the runtime `<meta http-equiv="Content-Security-Policy" content="connect-src 'self' https: wss:">`:

```
[probe] t=1788591738406 via=postMessage headers=0 {"stage":"ipc-csp-injected","ms":363545,"visibility":"visible","csp":"connect-src 'self' https: wss:"}
[probe] t=1788591740651 via=postMessage headers=0 {"stage":"ipc-csp-direct-fetch","ms":380315,"visibility":"visible","directFetch":{"error":"TypeError: Load failed"},"violations":[{"blockedURI":"ipc://localhost/probe_report","violatedDirective":"connect-src","effectiveDirective":"connect-src","disposition":"enforce","originalPolicy":"connect-src 'self' https: wss:"},{"blockedURI":"ipc://localhost/probe_report","violatedDirective":"connect-src","effectiveDirective":"connect-src","disposition":"enforce","originalPolicy":"connect-src 'self' https: wss:"}],"violationCount":2}
[probe-ipc] t=1788591744629 body=Json #1 kind=array len=10240 via=postMessage content-type=None
[probe] t=1788591752985 via=postMessage headers=0 {"stage":"ipc-after-csp-10s","ms":392650,"visibility":"visible","payloadBytes":10240,"targetRate":30,"seconds":10,"sent":24,"completed":24,"errors":0,"achievedRate":1.95,"kinds":{"json:array:10240":24},"latencyMs":{"mean":4264.667,"p50":2945,"p95":11036,"p99":11050,"max":11050},"inflightMax":24,"elapsedMs":12314}
[probe] t=1788591763236 via=postMessage headers=0 {"stage":"ipc-csp-violations","ms":402887,"visibility":"visible","violationCount":279,"first":{"blockedURI":"ipc://localhost/probe_report","violatedDirective":"connect-src","effectiveDirective":"connect-src","disposition":"enforce","originalPolicy":"connect-src 'self' https: wss:"}}
```

   The first blocked fetch is `disposition:"enforce"` (here there is no report-only policy at all — the shell page ships no CSP), Tauri's `ipc-protocol.js` flips to postMessage, and from that invoke on every body is `Json kind=array len=10240 via=postMessage` — **24 / 24 in the 10-s window, zero `Raw`**. This is the exact event S5's guard exists to detect (rule 23), and it is reproducible on demand from this origin. The 279 enforced violations at the end are the 2 direct fetches + 277 loopback POSTs (item 3).

3. **The loopback arms from this origin** (they are answered by the same debug-only listener as § 3.3; the https-origin numbers belong there):

```
[probe] t=1788591723307 via=custom-protocol headers=8 {"stage":"loopback-raw-60s","ms":362925,"visibility":"visible","url":"http://127.0.0.1:57992/probe","payloadBytes":10240,"targetRate":30,"seconds":60,"sent":1776,"completed":1776,"errors":0,"achievedRate":17.25,"kinds":{"raw:10240":1776},"latencyMs":{"mean":18166.083,"p50":18431,"p95":39813,"p99":41800,"max":43684},"inflightMax":813,"elapsedMs":102959}
[probe-loopback] t=1788591723366 websocket-handshake-received method=GET path=/ws upgrade="websocket" origin="tauri://localhost"
[probe] t=1788591723563 via=custom-protocol headers=8 {"stage":"loopback-websocket","ms":363208,"visibility":"visible","url":"ws://127.0.0.1:57992/ws","pageOrigin":"tauri://localhost","violations":[],"events":[{"ev":"error","ms":101},{"ev":"close","code":1006,"wasClean":false,"reason":"","ms":115}]}
[probe] t=1788591763214 via=postMessage headers=0 {"stage":"loopback-after-csp-10s","ms":402866,"visibility":"visible","url":"http://127.0.0.1:57992/probe","payloadBytes":10240,"targetRate":30,"seconds":10,"sent":277,"completed":0,"errors":277,"achievedRate":27.15,"kinds":{"error:TypeError: Load failed":277},"latencyMs":{"mean":null,"p50":null,"p95":null,"p99":null,"max":null},"inflightMax":30,"elapsedMs":10203}
```

   1776 / 1776 raw 10 240-byte bodies reached the Rust listener (`first_bytes=[0, 1, 2, 3]`); the `ws://127.0.0.1` handshake **reached Rust** (`websocket-handshake-received … origin="tauri://localhost"`) and closed 1006 only because the listener does not complete upgrades; and once the injected CSP was in force the same POSTs failed **277 / 277 `TypeError: Load failed`** — the loopback path is governed by `connect-src` exactly like any other fetch, so S5 must allow-list it. The `mean 18 166 ms · inflightMax 813` on the 60-s loopback window is the load-123 machine plus a one-thread-per-connection `Connection: close` listener; not a property of the transport.

   A note on what killed the earlier control attempts (`s0-ipc-localshell.log` 14:34, the two attempts at 14:48): each died 10–40 s in with no Rust output while a `cargo tauri build --debug` in the same tree replaced `target/debug/setnayan-desktop` underneath it (the probe script is `include_str!`'d, so even a compile check after editing it rewrites the binary). `run.sh` now launches a per-run copy; this run survived the same conditions.

### 3.3 The loopback arms — a plain HTTP server on 127.0.0.1, and a WebSocket, from the https page

<!-- S0-LOOPBACK-RESULTS -->

### 3.4 CSP — what the page ships, and what enforcing one does

The production policy the page carried (verbatim from the violation's `originalPolicy`, and matching `apps/web/next.config.ts` `CSP_REPORT_ONLY`) is sent as **`Content-Security-Policy-Report-Only`**:

```
default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.vercel-insights.com https://*.vercel-scripts.com https://*.posthog.com https://challenges.cloudflare.com https://itunes.apple.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.posthog.com https://*.r2.cloudflarestorage.com https://media.setnayan.com https://*.vercel-insights.com; frame-src …; img-src …; media-src …; style-src …; font-src …; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; report-uri /api/csp-report
```

- `connect-src` has **no `ipc:` and no `http://ipc.localhost`**, so every IPC fetch is reported (`disposition:"report"`) — five reports before the first invoke, six after it. Report-only **blocks nothing**; the `Load failed` is not the CSP's doing. (Also: the same fetch reaches Rust from `tauri://localhost`, where the page has no CSP header at all.)
- **Forced enforcement** (stage `ipc-csp-injected`, 60.8 s: a `<meta http-equiv="Content-Security-Policy" content="connect-src 'self' https: wss:">` appended at runtime) — the next direct fetch produced **two** violations for one request: `disposition:"report"` against the prod policy and `disposition:"enforce"` against the injected one (stage `ipc-csp-direct-fetch`, `violationCount:2`). Then 10 s at 30/s (stage `ipc-after-csp-10s`): sent/completed/errors **300 / 300 / 0**, 27.97 / s, all `json:array:10240`, latency mean **155.2 ms** · p50 **141** · p95 **304** · p99 **410** · max **420**, in-flight max 39. The postMessage path is not subject to `connect-src` (it is not a fetch), which is why an enforced CSP that excludes `ipc:` degrades nothing that was not already degraded — it only turns every fallback attempt into an enforced violation, and the ~3 × latency increase is consistent with WebKit paying for the enforced-violation reports on the same thread.
- Consequence for S5's "add `ipc: http://ipc.localhost` to `connect-src`" step: **necessary but not sufficient.** With the header in place the CSP stops reporting, but on this WebKit the request still does not reach the scheme handler from an https document (§ 3.2). That step should stay (it is correct hygiene for any platform where the custom protocol does work, e.g. WebView2's `http://ipc.localhost`), but it cannot be the guard that proves `Raw`.

### 3.5 Corroboration and a caveat (`s0-ipc.log`, 13:35)

The earlier run measured the same transport facts (`kinds:{"json:array:10240":1244}`, zero `Raw`, `Load failed`, `disposition:report`) but its numbers are not usable for latency: the window sat **hidden** behind the terminal for the whole run and WebKit throttled it — 19.74 / s achieved, in-flight max **358**, latency p95 **19.3 s**, max **30.2 s**. That is throttling, not IPC. The 14:26 run's `probe.rs` calls `window.set_focus()` before eval; its `start` record shows `visibility:"visible"`, but the `/dashboard` instance that produced the 60-s numbers reports `visibility:"hidden"` — and still held 29.63 / s with p50 19 ms. The honest statement: **the 50.7 ms mean / 19 ms p50 is a hidden-tab number that was NOT throttled; a visible-tab number should be no worse.** S5's latency budget should be set from a run with the window pinned (`SETNAYAN_PROBE_TOP=1`, now off the page-load thread) — one more `run.sh ipc`, listed in § 9.

---

## 4. The long encode — 1280×720 @ 30 fps, OffscreenCanvas in a Worker → `VideoEncoder`

<!-- S0-ENCODE-RESULTS -->

---

## 5. Q3 — LEFT UNDONE: HLS-CORS and WHIP (need the owner's YouTube channel and a VPS)

Neither spike can run from this machine alone; both are written up so the next session can execute them in a day. Owner ruling 2026-09-05 stands: native is the plan of record regardless of (a)/(b) unless Q1 fails on the accepted floor — and Q1 holds here (§ 8a).

### 5a. HLS-CORS — can a page `PUT` a segment straight to YouTube's HLS ingest?

1. Owner: YouTube Studio → **Go live** → **Stream settings** → *Stream latency* any → set *HLS* as the ingest protocol → copy the **HLS ingest URL** (form `https://a.upload.youtube.com/http_upload_hls?cid=<key>&copy=0&file=`). Give the URL to the session over a private channel, never in a PR.
2. Produce one 2-second MPEG-TS segment: `ffmpeg -f lavfi -i testsrc2=size=1280x720:rate=30 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 2 -c:v libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p -c:a aac -f mpegts seg0.ts`.
3. From the real controller page inside the desktop app (`SETNAYAN_PROBE=matrix` is enough to be on the page; the probe is not needed), in the WebKit inspector console: `fetch('<HLS URL>seg0.ts', {method:'PUT', body: await (await fetch('/seg0.ts')).arrayBuffer(), headers:{'Content-Type':'video/mp2t'}})` (serve `seg0.ts` from `apps/web/public/` on a preview deploy, or paste it as a Blob).
4. Read the Network tab: the **OPTIONS preflight** (status, `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`) and the PUT (status). **Pass = 2xx on the PUT with `Access-Control-Allow-Origin` echoing `https://www.setnayan.com` or `*`.** Record both requests' response headers verbatim into this file. Expected: no CORS headers → the browser blocks the PUT → HLS-from-the-page is dead without a proxy, which is the point.
5. Also try it from plain Safari 26 on the same page to separate "YouTube has no CORS" from "WKWebView".

### 5b. WHIP — `canvas.captureStream()` → MediaMTX → RTMPS → YouTube, and what 2 % loss does to it

1. Owner: a Hetzner CX22 (hourly, ≈ ₱580 for the day) in Singapore, Ubuntu 24.04, ports 8889/tcp (WHIP), 8189/udp (ICE), 22/tcp. Destroy it the same day.
2. On the VPS: `wget https://github.com/bluenviron/mediamtx/releases/latest/download/mediamtx_linux_amd64.tar.gz && tar xzf …`; in `mediamtx.yml` set `webrtc: yes`, `webrtcAddress: :8889`, `webrtcICEUDPMuxAddress: :8189`, and give the path a `runOnReady: ffmpeg -i rtsp://localhost:8554/$MTX_PATH -c:v copy -c:a aac -f flv rtmps://a.rtmps.youtube.com/live2/<KEY>` (`-c:v copy` requires the browser to send H.264 — set `webrtcCodecs`/`videoCodec` to H264 in mediamtx.yml, and force H.264 in the page's `RTCRtpTransceiver.setCodecPreferences`). Put a TLS cert on 8889 (Caddy in front, or `webrtcEncryption: yes` with a Let's Encrypt cert) — an https page cannot POST WHIP to plain http on a non-loopback host.
3. On the real controller page in the desktop app: `const s = programCanvas.captureStream(30); const pc = new RTCPeerConnection(); s.getTracks().forEach(t => pc.addTrack(t, s)); const offer = await pc.createOffer(); await pc.setLocalDescription(offer); const r = await fetch('https://<vps>:8889/live/whip', {method:'POST', headers:{'Content-Type':'application/sdp'}, body: offer.sdp}); await pc.setRemoteDescription({type:'answer', sdp: await r.text()});` — the canvas is `ProgramBridgeHost`'s program canvas (S1 moves it to an OffscreenCanvas; use the on-screen one for this spike).
4. Confirm the YouTube watch URL plays. Record from `pc.getStats()` every 5 s for 2 min: `outbound-rtp` `framesPerSecond`, `frameWidth×frameHeight`, `targetBitrate`, `qualityLimitationReason`.
5. On the VPS: `tc qdisc add dev eth0 root netem loss 2%` (inbound loss needs an `ifb` — `modprobe ifb; ip link set ifb0 up; tc qdisc add dev eth0 ingress; tc filter add dev eth0 parent ffff: matchall action mirred egress redirect dev ifb0; tc qdisc add dev ifb0 root netem loss 2%`). Repeat step 4 for 2 min. **The quality argument against Path B is the delta**: expected `qualityLimitationReason:"bandwidth"`, resolution stepping down to 960×540 or lower, and bitrate well under the 2.5 Mbps the native path holds by construction.
6. `hcloud server delete`. Paste the two `getStats` tables here verbatim.

---

## 6. Consequences for S4, S5, S6 — stated plainly

- **S4** — config shape is settled: `prefer-hardware`, CBR, realtime, `annexb` (or `avc` after the one extra probe). Nothing in S4 depends on the transport.
- **S5** — its contract as written (`invoke('encoder_push', bytes)` → `InvokeBody::Raw`; the go-live guard "anything but `Raw` REFUSES go-live") **cannot pass on this platform today.** Measured: 100 % of bodies are `Json` from the real origin, before any CSP is enforced, and adding `ipc:` to `connect-src` addresses the CSP report but not the `Load failed`. A guard that refuses on non-`Raw` would refuse **every** macOS user. S5 has to be re-scoped around one of the options in § 7 — this finding does not choose.
- **S6** — codes against S5's contract only; the byte layout (16-byte header, seq, ts_us) is transport-independent and can stand. What S6 must not assume is that a chunk arrives as one contiguous `&[u8]` at custom-protocol cost; if the transport stays JSON, the Rust side receives `Vec<serde_json::Value>` per chunk and pays a parse + copy per frame (measured cost is inside the § 3.1 latencies; CPU is in the `[sample]` lines of the same log — the debug binary sat at 1–16 % of one core at 30 chunks/s of 10 KB).

## 7. The options — measured or reasoned, none chosen

| Option | What is known from this session | What is not |
|---|---|---|
| **A. Keep the JSON-array fallback** as the contract | Works today with zero code: 1797/1797 at 29.63/s, mean 50.7 ms, p50 19 ms, p99 293 ms, max 501 ms for 10 KB chunks (§ 3.1). At 2.5 Mbps video ≈ 10.4 KB/frame this is the measured shape. ~3.6 × on the wire + a JSON parse per chunk in Rust. The S5 guard flips meaning: assert `Json` arrives intact (length + checksum), not `Raw`. | Windows numbers (WebView2 has `http://ipc.localhost` and may take the custom protocol — the `Raw` path could be Windows-only, which is a two-transport contract). Whether p99 grows at 1080p (≈ 4 × the bytes). |
| **B. A localhost HTTP server in Rust** (`http://127.0.0.1:<port>`, raw `POST` bodies) | § 3.3 measures it from the https page: whether mixed-content rules allow it, the raw body length Rust receives, and the 60-s latency profile beside the invoke path. The CSP must allow-list it in `connect-src` (an enforced `connect-src 'self' https: wss:` blocks it — measured in the same run). | Port allocation and a per-launch token (the page must not be able to be phished into posting to another local listener). Whether WebSocket is preferable to per-chunk POST — § 3.3 reports whether `ws://127.0.0.1` is even permitted. Windows. |
| **C. Load the app from a custom scheme** (`tauri://localhost` serving the Next.js build, or a wry custom protocol proxying to setnayan.com) instead of the remote https origin | § 3.2's control run is exactly this origin: the custom protocol reaches Rust. Cost is architectural, not measured: the meta-refresh shell (`src-tauri/shell/index.html`, a 0-second `<meta http-equiv="refresh">` + `location.replace('https://setnayan.com')`) exists precisely so the desktop app is the live web app with no separate build, no separate release cadence, and the same cookies/session as the browser. A custom-scheme origin means bundling the frontend (or proxying it) — a second deploy surface, `capabilities/default.json` re-scoped from `remote.urls` to local, Supabase auth redirects re-registered for the new origin, and every `SetnayanApp/desktop` UA gate re-checked. | Whether `tauri://localhost` with a proxied remote works for the auth flows. Effort. |
| **D. Ask WebKit for the custom protocol from https** | Not available in wry 0.55.1: it registers the handler with `WKWebViewConfiguration.setURLSchemeHandler(_:forURLScheme:)` only (no `_registerURLSchemeAsSecure` / CORS-enabled private API — grep of `wry-0.55.1/src/wkwebview/mod.rs`). WebKit's fetch of a non-HTTP(S) scheme from an https document is a network error before any handler runs, which is what `Load failed` without a CSP `enforce` shows. | Whether a wry patch (private API) would pass App Store-less notarization; owner-level risk, not measured. |

## 8. Closing — two answers, separately

**(a) Does the WebCodecs floor hold?** It **holds on macOS 26.6.2 arm64, WebKit 21624.5.1.11.3**, measured inside the real Tauri webview on `https://www.setnayan.com`: `VideoEncoder` and `AudioEncoder` are both present on the window and in a Worker, H.264 `avc1.42E01F` at 1280×720 and 1920×1080 is supported with `hardwareAcceleration:'prefer-hardware'` (and `'require-hardware'` is a `TypeError` on this WebKit, so S4 must send `'prefer-hardware'`), AAC-LC 48 kHz stereo is supported, `OffscreenCanvas` and `AudioWorklet` are present, and the long encode in § 4 reports how that holds over time on this machine. That sentence is exactly as wide as the machine it was measured on. LEFT UNDONE, each with the exact probe in § 2.3: Apple-silicon macOS 14/15 **without** Safari 26 (expected `AudioEncoder` absent) and **with** it (expected present) — the pair that proves the gate is Safari 26's WebKit rather than macOS 26; macOS 13 (expected absent — the floor); Windows 11 with `edge://gpu` hardware-accelerated; one GPU-blocklisted or VM Windows box; and one extra `isConfigSupported` for `avc:{format:'avc'}` on this Mac. Until the macOS 14/15 + Safari 26 cell is run, "the floor is Apple-silicon macOS 14 + Safari 26" remains the README's documented claim, not a measured one — nothing measured here contradicts it, and nothing measured here confirms it below macOS 26.

**(b) The IPC contract in S5.md assumes a raw binary body (`InvokeBody::Raw`). On the real remote origin that is measurably impossible today — the app is in permanent postMessage/JSON-array fallback.** From `https://www.setnayan.com` the `ipc://localhost` custom protocol fails on the very first invoke (`TypeError: Load failed` on every direct fetch variant and on XHR, with the prod CSP only *reporting*), Tauri's `ipc-protocol.js` sets `customProtocolIpcFailed` and never clears it, and **1797 of 1797** 10 KB chunks reached Rust as `InvokeBody::Json` arrays — zero `Raw` — at 29.63/s, mean 50.7 ms, p50 19 ms, p95 151 ms, p99 293 ms, max 501 ms. From the bundled `tauri://localhost` origin the same fetch reaches Rust (§ 3.2), so this is the origin's doing, not the machine's. The consequence for S5 is that its go-live guard ("anything but `Raw` refuses go-live") would refuse every macOS user, and its CSP fix (`ipc:` in `connect-src`) is correct hygiene but does not make the protocol reachable; the consequence for S6 is that the wire format it codes against must not assume a contiguous raw body arrives at custom-protocol cost. The options are laid out in § 7 with what was measured for each: keep JSON arrays and accept ≈ 3.6 × expansion at the latencies above; a localhost HTTP or WebSocket server in Rust, with § 3.3's measurement of whether an https page in WKWebView may reach `http://127.0.0.1` / `ws://127.0.0.1` at all and what the CSP must allow; loading the app from a custom scheme instead of the remote https origin, which the control run shows would restore the custom protocol at the cost of abandoning the meta-refresh shell's "the desktop app is the live site" model; or patching wry for a private WebKit API. **No option is chosen here.** The choice belongs to the owner and to a re-scoped S5, and S6 should not start its transport-facing code until that choice is written down.

## 9. LEFT UNDONE (complete list)

1. Matrix cells in § 2.3 (five machines + one config line).
2. Q3a HLS-CORS and Q3b WHIP (§ 5) — owner's channel + VPS.
3. A 60-minute encode on a Windows box (§ 4 is this Mac only).
4. One `run.sh ipc` with the window pinned visible (`SETNAYAN_PROBE_TOP=1`) to give S5 a non-hidden latency profile (§ 3.5).
5. The IPC probe on Windows (WebView2 `http://ipc.localhost`) — decides whether option A is a one-transport or a two-transport contract.

## 10. Evidence files

`build-sessions/encoder/S0-logs/` — byte-for-byte copies of the runner logs named in § 1. The harness itself is in `src-tauri/probe/` and `src-tauri/src/probe.rs`; `apps/web/lib/desktop-probe-is-debug-only.test.ts` keeps it out of release builds.
