# S13 pre-flight check — 2026-09-06

**This is not the S13 acceptance run.** S13 (`build-sessions/encoder/S13.md`) is a physical,
hardware-driven rehearsal — install on real Mac + Windows machines, use physical phones as
cameras, go actually live on YouTube, kill the network, close the laptop lid, verify a recorded
`.flv` in VLC. It cannot be executed from inside a Claude Code coding session: doing so would
require disconnecting the network and closing the lid of the very machine running the session,
and the owner's available hardware (1 MacBook, 1 phone, 1 iPad, no separate Windows or legacy
machine, no third "guest" device) can't cover the Windows leg or the macOS-13/Intel
expected-fail leg at all.

What follows instead is RULE 0/0.8-style due diligence: **is S13 even ready to run**, measured
against `origin/main` and against work in flight, not against the plan doc's own claims.

## Measured against

- `origin/main @ f49bbcd5f` (fetched 2026-09-06)
- Local worktrees on this machine (`git worktree list`) for in-flight work not yet on a PR

## What's actually shipped (verified by merged PR + changelog.d fragment, not by the README)

| Session | Evidence |
|---|---|
| S0 spike | `changelog.d/encoder-s0-spike.md` |
| S1 program canvas | `changelog.d/encoder-s1-program-canvas.md` |
| S2 overlay canvas | PR #5235, `changelog.d/s2-overlay-canvas.md` |
| S3 audio mixer | PR #5224, `changelog.d/encoder-s3-audio-mixer.md` |
| S4 video encode | `changelog.d/encoder-s4-video-encode.md` |
| S5 IPC / JSON envelope | PR #5232 + PR #5239, `changelog.d/encoder-s5-ipc-transport.md` |
| S6 RTMPS + FLV | `changelog.d/encoder-s6-rtmps.md` |
| S7 reconnect / recording | PR #5223, `changelog.d/encoder-s7-reconnect-recording.md` |
| S8 stream key | `changelog.d/encoder-s8-stream-key.md` |
| S9 ingest health / ABR | `changelog.d/encoder-s9-health-abr.md` |
| S10 release channel | PR #5209, `changelog.d/encoder-s10-release-channel.md` |
| S11 signed & notarized | PR #5240, `changelog.d/s11-signed-notarized-honest.md` |
| W1 guest watch-link | PR #5212, `changelog.d/claude-w1-guest-watch-link.md` |

## What is NOT ready — S13 should not be attempted yet

1. **S12 (the updater) does not exist on `origin/main`.** No merged PR, no changelog fragment.
   `src-tauri/tauri.conf.json` carries only a bare `updater.pubkey`; `src-tauri/capabilities/default.json`
   grants no updater permission at all. S10's own changelog fragment says outright that the
   `latest.json` manifest it publishes is for **"S12 will consume it."** S13 step 9 — bump to a
   test version on R2 and confirm the app does not restart mid-stream — has no code path to
   exercise.
   ⚠ **In-flight, not yet a PR:** a local worktree on this machine
   (`claude/s12-desktop-updater`, based on `c2d009934`) already has uncommitted work toward this
   — a new `src-tauri/src/updater.rs` (344 lines) plus edits across
   `build-desktop.yml` / `Cargo.toml` / `encoder_ipc.rs` / `lib.rs` / `tauri.conf.json`
   (583 insertions total). It is not on the remote and has no PR, so `origin/main` genuinely
   lacks S12 today — but S13 should wait for that work to land rather than being scheduled as if
   S12 were simply missing from the plan.
2. **No successful `build-desktop` run since S10/S11 merged.** `gh run list` shows the two most
   recent runs (2026-09-05, both on `main`) failed at notarization — Apple's Program License
   Agreement is still unaccepted (X0 tracker item #1, still "⏳ open" as of the same commit that
   merged S11). There is no evidence `/download` has ever served a build produced by the current,
   signed pipeline. S13's very first SETUP step ("install from `/download`") depends on this.
3. **Windows OV code-signing cert (X0 item #3) still open.** Not a blocker for the rehearsal
   itself — SmartScreen firing is one of the things S13 is explicitly supposed to record — but
   worth knowing going in that it's expected, not a regression.
4. **Two production flag values are still unrecorded** (X0 item #4):
   `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` and `NEXT_PUBLIC_PANOOD_STREAMING_ENABLED`. If either is
   off in production, the live-studio controller page returns `notFound()` and S13 step 1 can't
   even start. Neither value is visible from a repo session — someone needs to check Vercel's
   Environment Variables directly.
5. **No `S13-REPORT.md` exists anywhere in git history** — this is the first time S13 has been
   attempted in any form.

## Recommendation

Do not schedule the physical S13 rehearsal until:
- S12 lands (the in-flight worktree above is the fastest path — someone should open its PR)
- a `build-desktop` dispatch actually succeeds end-to-end post-S11 (blocked on the owner accepting
  Apple's Program License Agreement, X0 item #1)
- the two prod flag values are confirmed

None of this required hardware or a live stream to determine — it's a `git`/`gh` measurement
against `origin/main` and local worktrees, same as RULE 0 asks for before any build session.

SPEC IMPACT: None — this is a status check, not a product decision.
