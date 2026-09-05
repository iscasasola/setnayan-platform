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
- `lib/desktop-release.ts` (pure: types + `parseDesktopRelease`, rejects any
  non-absolute URL — the exact shape of the old defect) + `lib/desktop-release-server.ts`
  (`import 'server-only'`; fetches R2's public `desktop/latest/release.json` at
  request time, revalidated hourly with the page's own ISR window). Split the same
  way `live-studio-readiness.ts` / `-server.ts` already is, because `server-only`
  throws outside an RSC context and the pure half needs to run under
  `node:test`/`tsx`. Returns `null` — never a stale or relative URL — when R2 isn't
  configured or unreachable (rule 12: build behind the gap, don't throw); `/download`
  renders an honest "not available right now" state on that branch instead of a
  dead link. Deleted the committed `apps/web/public/downloads/*.dmg` now that R2
  serves it.
- `/download`: adds the Windows link (`/api/download/windows`, new route — there
  was none before), the readiness-gate sentence verbatim above both download
  buttons, and best-effort Intel/old-Mac detection (WebGL renderer sniff, since
  `navigator.platform`/UA can't distinguish Apple Silicon from Intel in Safari
  anymore) that leads with an OBS link for those visitors. Removed the page's
  standing "Signed & notarized by Apple" claim — it was already false pre-S11
  (no `APPLE_*` secrets configured) — now conditional on the manifest's actual
  per-platform `signed` field, and the "System requirements" copy now states the
  real floor (macOS 14 / Apple Silicon / Safari 26) instead of the old, now
  actively wrong, "macOS 11 Big Sur".
- The same readiness-gate sentence is mirrored onto `BroadcastReadiness`
  (`app/_components/live-studio/broadcast-readiness.tsx`, the `encoderNotice`
  readiness surface) via a new `DESKTOP_ENCODER_READINESS_NOTICE` constant in
  `lib/live-studio-readiness.ts` — a deliberately separate fact from
  `ENCODER_NOTICE`/`ENCODER_BUY_NOTICE` (which stay pinned equal to each other by
  the pre-existing `the-laptop-requirement-is-disclosed.test.ts`): those two say
  "an encoder is required at all, today that's OBS"; this one says which machines
  can run Setnayan's own FUTURE in-app encoder specifically.
- New tests, both mutation-checked (sabotage → red, restore → green, verified by
  hand for each): `lib/desktop-release.test.ts` (the absolute-URL rejection —
  sabotaging it out flips 2 of 5 tests red) and
  `lib/desktop-readiness-gate-is-disclosed.test.ts` (the sentence's presence on
  `/download` before the buttons, and mirrored on `BroadcastReadiness` — deleting
  the mirrored paragraph flips 1 of 4 red).
- `OWNER_ACTIONS.md`: new section — `R2_PUBLIC_URL` + the 3 R2 credential envs
  need to exist as GitHub Actions secrets (separate store from Vercel's) for the
  publish step to actually run; until then `/download` degrades gracefully but
  has nothing to serve.
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
