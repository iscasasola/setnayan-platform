## 2026-09-06 · feat(desktop): S11 — signed, notarized, and honest about what the first-run dialogs say

`build-desktop.yml`'s macOS ad-hoc fallback now writes **"🚨 AD-HOC SIGNED — not
shippable 🚨"** to the job summary in red instead of only logging to stdout —
before this a maintainer skimming a green run could miss that the artifact is
unsigned. Notarization failure still fails the job outright (unchanged).

Windows signing lands as the identical gated shape the macOS half already
uses: a new "Configure Windows signing" step exports `ES_*` env vars ONLY when
the four `SSL_COM_ESIGNER_*` repo secrets are non-empty (X0's decided route —
SSL.com OV + eSigner CodeSignTool; Azure Trusted/Artifact Signing excludes PH
orgs, and a file cert can't sign from GitHub Actions since 2023-06-01). A new
`src-tauri/scripts/windows-codesign.ps1`, wired as `tauri.conf.json`'s
`bundle.windows.signCommand`, is a no-op when `ES_USERNAME` is absent — so
today's build stays exactly as unsigned as before this PR. `release.json`'s
`windows.signed` field and the publish job's summary line are now computed
from whether those secrets exist, replacing the hardcoded `false`.

Generated the real Tauri updater ed25519 keypair now (`tauri signer
generate`): `TAURI_SIGNING_PRIVATE_KEY` and
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` are new repo secrets, and the public key
is in `tauri.conf.json`'s `plugins.updater.pubkey`. This is inert today —
Tauri only signs updater artifacts when `bundle.createUpdaterArtifacts` is
also `true` and `tauri-plugin-updater` is installed, neither of which this PR
adds (S12 owns wiring the plugin in and consuming these keys).

**LEFT UNDONE (owner-gated, X0-TRACKER.md):**
- macOS notarization is still blocked on the unaccepted Apple Program License
  Agreement (developer.apple.com → Agreements) — a 403, confirmed live against
  the 2026-09-05 CI runs (33937991389, 33940303449). Signing itself already
  works (cert "Indalecio Casasola" found). Once accepted, re-dispatch
  `build-desktop` and the macOS leg should notarize + staple with no code
  change.
- Windows signing turns on the moment these four secrets exist:
  `SSL_COM_ESIGNER_USERNAME`, `SSL_COM_ESIGNER_PASSWORD`,
  `SSL_COM_ESIGNER_CREDENTIAL_ID`, `SSL_COM_ESIGNER_TOTP_SECRET`. The OV cert
  + eSigner enrollment is on order per X0 item 3 (3–4 week validation).
- Screenshots of every first-run dialog on both OSes (spctl/stapler evidence,
  SmartScreen "Run anyway") can't be produced until both certs are live and
  land in S13's rehearsal script, not this PR.

SPEC IMPACT: None — this is desktop CI/build-pipeline work; no corpus iteration
covers code-signing infrastructure.
