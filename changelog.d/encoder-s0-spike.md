## 2026-09-05 · chore(desktop): S0 encoder spike — OS-matrix / IPC-body / long-encode probe harness + finding

Part of the S-series encoder plan (`build-sessions/encoder/README.md`). S0 produces a FINDING,
not a feature: `build-sessions/encoder/S0-FINDING.md` records, from INSIDE the real Tauri
webview on https://setnayan.com (not Safari), whether WebCodecs `VideoEncoder`/`AudioEncoder`
exist and accept hardware H.264 + AAC on this machine, how the Tauri IPC body arrives
(`InvokeBody::Raw` vs the permanent JSON fallback once a CSP without `ipc:` blocks the custom
protocol), and how a 1280×720 30 fps WebCodecs encode holds up over a long run.

- `src-tauri/src/probe.rs` (new) — `probe_report(json)` and `probe_ipc(request)` commands plus an
  `on_page_load` hook that evals `src-tauri/probe/encoder-probe.js` when `SETNAYAN_PROBE=<mode>`
  is set. **Debug builds only**: the module is behind `#[cfg(debug_assertions)]` and `build.rs`
  adds the `capabilities-debug/` glob only when cargo `PROFILE=debug`, so a release binary has
  neither the commands nor the grant.
- `src-tauri/capabilities-debug/probe.json` (new) — grants the two commands to the remote origin.
- `src-tauri/probe/run.sh` (new) — builds `--debug --no-bundle`, launches with the env var, logs
  stdout + `pmset -g therm` + WebContent CPU every 10 s.
- Release behaviour unchanged: `lib.rs` still registers only the opener + oauth plugins.

- `src-tauri/probe/local-shell/` + `capabilities-debug/probe-local.json` — CONTROL origin:
  `SETNAYAN_PROBE_SHELL=local src-tauri/probe/run.sh ipc` keeps the webview on
  `tauri://localhost` (weaker origin, labelled as such) to attribute the real-origin result.
- `apps/web/lib/desktop-probe-is-debug-only.test.ts` (new) — reads lib.rs / build.rs / both
  capability directories as text and fails if the probe ever escapes `debug_assertions`.

Measured so far (macOS 26.6.2 arm64, WebKit 21624.5.1.11.3, inside the real webview on
https://www.setnayan.com): VideoEncoder + AudioEncoder present, H.264 720p/1080p prefer-hardware
and AAC-LC 48k stereo supported; the Tauri custom-protocol IPC FAILS on the first invoke
(`TypeError: Load failed` on every `fetch('ipc://localhost/…')`, CSP violations all
`disposition:report`), so every body arrives as `InvokeBody::Json` (array of 10240 numbers) —
the binary path is never taken from the https origin.

Next concrete step if this session ends early: run `SETNAYAN_PROBE_TOP=1 src-tauri/probe/run.sh
encode 60` and paste the `encode-10s` lines into `build-sessions/encoder/S0-FINDING.md` § 4; run
`SETNAYAN_PROBE_SHELL=local src-tauri/probe/run.sh ipc` for the control and `run.sh ipc` again
with the loopback arm for the real origin.

SPEC IMPACT: None (finding only; the design doc `Live_Studio_Encoder_Scope_2026-09-03.md` is
updated by the owner once the floor is confirmed on the remaining matrix machines).
