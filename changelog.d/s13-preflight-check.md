## 2026-09-06 · docs(encoder): S13 pre-flight — not ready, and here's what's blocking it

S13 (`build-sessions/encoder/S13.md`) is a physical hardware rehearsal that cannot run from
inside a coding session (it needs to disconnect the network / close the lid of the machine
running it) and the owner's available hardware can't cover the Windows or legacy-OS legs at all.
Rather than attempt it, this adds `build-sessions/encoder/S13-PREFLIGHT.md`: a RULE-0/0.8-style
check of whether S13 is even ready to run, measured against `origin/main @ f49bbcd5f` and
against in-flight local worktrees.

Findings: S0–S11 and W1 are all genuinely merged (verified by PR + changelog.d fragment). S12
(the updater) does not exist on `origin/main` — no PR, no fragment, `tauri.conf.json` has only a
bare pubkey, `capabilities/default.json` grants no updater permission — though a local worktree
(`claude/s12-desktop-updater`) already has substantial uncommitted work toward it. No
`build-desktop` run has succeeded since S10/S11 merged (both recent runs failed at notarization,
blocked on the owner accepting Apple's Program License Agreement). Two production flag values
(`NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED`, `NEXT_PUBLIC_PANOOD_STREAMING_ENABLED`) are still
unrecorded and could 404 the controller page before S13 step 1 even starts.

SPEC IMPACT: None.
