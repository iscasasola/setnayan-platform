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

Next concrete step if this session ends early: run `src-tauri/probe/run.sh encode 60` and paste
the `encode-10s` lines into the finding's § 4.

SPEC IMPACT: None (finding only; the design doc `Live_Studio_Encoder_Scope_2026-09-03.md` is
updated by the owner once the floor is confirmed on the remaining matrix machines).
