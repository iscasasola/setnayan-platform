## 2026-09-05 · fix(desktop): a release channel that works, and a download page that tells the truth

S10 of the encoder S-series (`build-sessions/encoder/README.md`). Measured against
`origin/main` on 2026-09-05: `build-desktop.yml`'s `publish-latest` job could never
run (gated on `github.event_name == 'push'` while the workflow trigger is
`workflow_dispatch`-only), the repo is private so GitHub Release asset URLs 404 for
the public, `/download` served one committed `.dmg` with no Windows link, and
`tauri.conf.json` had no `minimumSystemVersion`, no `backgroundThrottling`, and
`csp: null`.

- `.github/workflows/build-desktop.yml`: `publish-latest` now runs on
  `workflow_dispatch` too. It uploads the `.dmg`, `.msi`, a `release.json` (consumed
  by `lib/desktop-release.ts`) and a `latest.json` Tauri-updater manifest (S12 will
  consume it — signatures are empty until S11 lands signing) to the `setnayan-media`
  R2 bucket under `desktop/<version>/` and `desktop/latest/`. `setnayan-media` is the
  ONLY publicly-served R2 bucket (`R2_PUBLIC_URL`, see `lib/r2.ts`); the other four
  hold vendor contracts / IDs / private uploads and were never candidates.
- `lib/desktop-release.ts`: resolves the current release from R2's public
  `desktop/latest/release.json` at request time, with a graceful fallback (rule 12 —
  never stall on a missing/unreachable manifest) rather than throwing.
- `/download`: adds the Windows link, a readiness-gate sentence above both download
  buttons, and best-effort Intel/old-macOS detection that leads with the OBS link
  instead for those visitors. Removed the page's standing "Signed & notarized by
  Apple" claim, now conditional on the manifest's actual per-platform signed state
  (macOS signing is env-gated in CI; unsigned until the `APPLE_*` secrets exist —
  S11).
- `tauri.conf.json`: `bundle.macOS.minimumSystemVersion: "14.0"`,
  `app.windows[].backgroundThrottling: "disabled"` — verified against
  `schema.tauri.app/config/2`: `backgroundThrottling` is macOS-14+-only, so the two
  settings gate on the same floor S0 measured (`S0-FINDING.md` § 4.1: WebKit throttles
  VideoToolbox input 30→16fps within 3s of occlusion, full suspension by ~8min).
- `src-tauri/src/keep_awake.rs` (new): `start_keep_awake` / `stop_keep_awake` Tauri
  commands — macOS `IOPMAssertionCreateWithName`, Windows `SetThreadExecutionState`,
  raw FFI (no third-party crate) — to be held between `encoder_start`/`stop` once
  S5/S6 land. Ships in every build profile (unlike the debug-only S0 probe
  commands); granted via a new app-level permission in `capabilities/default.json`.
  Round-trip lifecycle test passes for real on macOS (live IOKit assertion
  create/release, not mocked); mutation-tested (sabotaged `stop()` into a no-op →
  test failed; restored → passed).

SPEC IMPACT: None — this is a build/release-infra fix, not a product-facing spec
change. The desktop app's actual OS floor (Apple-silicon macOS 14 + Safari 26,
Windows 10/11 with hardware H.264) was already the plan-of-record floor in
`build-sessions/encoder/README.md` § "The OS floor"; S10 is the first place that
floor becomes user-visible copy, on `/download`.
