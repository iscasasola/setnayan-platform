## 2026-09-06 · feat(desktop): S12 — an auto-updater so a Rust encoder bug doesn't mean reinstalling the week of the wedding

Owner-locked (DECISION_LOG 2026-09-03 ②). The shell is a meta-refresh to
setnayan.com, so WEB changes reach users instantly — only the native Rust
encoder half was version-locked until now.

`src-tauri`: added `tauri-plugin-updater` 2.x, set
`bundle.createUpdaterArtifacts: true`, and pointed
`plugins.updater.endpoints` at S10's real R2 manifest
(`https://media.setnayan.com/desktop/latest/latest.json`) — PREMISE E8 MISSED:
this repo is private, so a GitHub Release asset URL 404s for the public;
S10's R2 bucket is the only public endpoint that ever existed for this. A new
`src-tauri/src/updater.rs` module checks for an update from RUST at launch
(never from the web page — the page can't know which native build it's
running inside) and again the moment `encoder_ipc::encoder_stop` resets the
broadcast session to idle (`EncoderIpcState::is_idle`, a new method). An
update found while `!is_idle()` is deferred and surfaced as a non-modal
`setnayan://update-ready` event; a new `apps/web/app/_components/
desktop-updater-listener.tsx`, mounted in `providers.tsx` next to
`<ToastFromParams>`, renders it through the existing `useToast().info(...)`
primitive — no new UI system, no dialog, nothing that can appear mid-
broadcast.

`.github/workflows/build-desktop.yml`'s `publish-latest` job now uploads the
REAL macOS updater artifact too: `bundle.createUpdaterArtifacts` makes a
non-v1-compatible macOS build also emit `Setnayan.app.tar.gz` (+ `.sig`) next
to the `.app` — the plugin's macOS install path gunzips+untars that archive,
NOT the `.dmg` `/download` still links to, so `latest.json`'s
`darwin-aarch64.url` now points at the `.tar.gz`, a different file/URL than
`release.json`'s mac link. Windows signs the `.msi` directly (no zip
wrapper in non-v1-compatible mode), so only its sibling `.sig` is new.
Both `.sig` files' contents (already base64, written by `tauri-cli`'s
`updater_signature::sign_file`) go straight into `latest.json`'s per-platform
`signature` fields, replacing the `""` placeholder S10 shipped honestly
labeled as "not wired yet". A missing/empty signature is still written
honestly rather than fabricated — `updater.rs`'s own client-side guard
refuses to install against one.

**GUARDS (mutation-tested, Rust unit tests in `src-tauri/src/updater.rs`,
`cargo test -p setnayan-desktop`):**
- *update attempted while publishing → red*: `decide_action(idle: bool)`.
  Mutated to always return `Install` — 0 → 1 failing test
  (`decide_action_defers_when_the_encoder_is_not_idle`). Reverted; confirmed
  identical to the pre-mutation file.
- *unsigned manifest accepted → red*: `manifest_signature_ok(signature)`.
  Mutated to always return `true` — 0 → 2 failing tests. Reverted.
- *endpoint not R2 → red*: `is_r2_endpoint(url)` — checked against the
  fetched manifest's OWN `download_url` at runtime (not just the compile-time
  `tauri.conf.json` value — a compromised manifest could point the artifact
  fetch anywhere even from the right endpoint) AND against the real
  `tauri.conf.json` file content via `include_str!` in a dedicated test.
  Rejects a same-string-prefix lookalike host, the host string merely
  appearing in the path, plain `http`, and a GitHub Release URL — not just
  "any non-empty string", per this stream's repeated "guards must test the
  claim" lesson. Mutated to always return `true` — 0 → 4 failing tests.
  Reverted.

**VERIFIED (this sandbox, macOS aarch64 host, no live broadcast or dual-OS
bundling available here):**
- `cargo check` / `cargo build` for `setnayan-desktop` — clean, 0 warnings
  from this session's code.
- `cargo test -p setnayan-desktop` — 29 passed, 0 failed (includes 3 new
  `EncoderIpcState::is_idle` tests + 12 new `updater.rs` tests).
- `cargo test -p setnayan-encoder` — 87 passed, 0 failed, crate untouched
  (still compiles without Tauri, per its own `Cargo.toml` header).
- `apps/web`: `tsc --noEmit` — TSC_EXIT=0, 0 `error TS` lines. `pnpm lint` —
  exit 0, 0 `Error:` lines (only pre-existing unrelated warnings).
  `lib/desktop-release.test.ts` (unaffected file, sanity-checked) — 5/5.

**LEFT UNDONE / OWNER-GATED (X0-TRACKER.md — none of these are NEW gates,
all three were already tracked before this PR):**
- The task's literal EVIDENCE ask — "0.0.1 → 0.0.2 on BOTH OSes with a
  stream running: no restart; after stop: installs. Paste the updater log."
  — needs a real macOS + Windows Tauri bundle build and a live broadcast,
  neither available in this sandbox. `build-desktop.yml` is
  `workflow_dispatch`-only and not a required check, so this PR's merge does
  not run it. This is S13's (acceptance run) job, not something this session
  can fabricate.
- Apple notarization is still blocked on the unaccepted Program License
  Agreement (X0 item 1) and the Windows OV code-signing cert is still on
  order (X0 item 3) — neither blocks the auto-updater itself (an unsigned
  Windows `.msi` still gets a real updater `.sig` from `TAURI_SIGNING_PRIVATE_KEY`,
  a SEPARATE key from the Authenticode/eSigner cert), but SmartScreen/
  Gatekeeper first-run warnings are unchanged from before this PR.
- Whether the R2 GitHub Actions secrets (X0 item 6) actually exist was not
  reconfirmed by this session — `publish-latest` already degrades honestly
  (skips the R2 publish, warns) if they don't; unaffected by this PR.

SPEC IMPACT: None — this is desktop CI/build-pipeline + Tauri-native work; no
corpus iteration covers the auto-updater. No new owner-facing secret or
manual step was introduced (`TAURI_SIGNING_PRIVATE_KEY`/`_PASSWORD` already
existed as real repo secrets since S11); `X0-TRACKER.md` was not changed.
