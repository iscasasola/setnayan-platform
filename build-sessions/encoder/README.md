# Encoder program — S-series (plan of record, 2026-09-05)

**Supersedes the E0–E9 prompts** (`setnayanencoderplan.zip`, 2026-09-03). Those were audited
claim-by-claim against `origin/main` and a feasibility pass on 2026-09-05; three of ten sessions rested
on false premises (E2 · E3 · E6), five pieces of work were missing outright, and the cost figures
behind the Path A lock were wrong twice. Evidence and design:

- Encoder Replan (audits, architecture, corrections): https://claude.ai/code/artifact/dfa993e3-4229-4b50-a7ec-8c2e3a7eff35
- Launch Plan (decision, scope, week-by-week): https://claude.ai/code/artifact/331d962c-15f5-4d12-8f3d-cf7274f1b9bd
- Source scope: `Live_Studio_Encoder_Scope_2026-09-03.md` → § "Corrections 2026-09-05"
- Lead-time tracker (owner items, updated in place): `build-sessions/encoder/X0-TRACKER.md`

**Decision (owner, 2026-09-05): native encoder in the Tauri desktop app — Path A, re-affirmed on true
figures.** Not for ₱0; because the default tier streams on the couple's own channel with no
Setnayan server and no Google API in the path, and native keeps it that way at any volume.
**Owner ruling 2026-09-05: "we will finish everything asap. no need to wait."** No calendar gating —
every session starts as soon as its dependency lands; owner items (X0) run alongside.

## The pipeline

    phones → controller → OffscreenCanvas (worker) → WebCodecs H.264 ─┐
             (ships)      S1 · S2                     S4              ├─ IPC (S5) → Rust FLV/RTMPS (S6·S7) → YouTube
    phone mics → MIXER (S3, new) → AudioEncoder AAC ──────────────────┘            └→ local .flv (S7)
                 ↑ MASTER CLOCK = AudioContext.currentTime

Everything left of the canvas ships behind two env flags whose prod values X0 records. There is no
programme audio today (S3 builds it). Split-screen has no live publisher (unit-tested, not accepted).

## Order

| | Session | Model · Effort | Days | Depends on |
|---|---|---|---|---|
| **X0** | Calendar-first: Apple agreement · Developer ID identity · Windows cert order · prod flags | Sonnet 5 · medium | 0.5 + owner | — day 1 |
| **S0** | The spike: OS matrix · 60-min encode · IPC-fallback probe · HLS + WHIP for the record | Opus 5 · high | 2–3 | X0 (agreement) |
| S1 | Program → OffscreenCanvas in a worker | Sonnet 5 · high | 2–3 | may start with S0 |
| S2 | Overlays from `ResolvedOverlays` + `encoder-layout.ts` | Sonnet 5 · high | 3–4 | S1 · § 4c answer |
| **S3** | Audio mixer + master clock + AAC | Opus 5 · high | 3–4 | S1 — **B-remux branch point** |
| S4 | Video encode + drift guard | Sonnet 5 · high | 2 | S3 · S0 finding |
| S5 | IPC · ACL · CSP · token · backpressure (**contract in first commit**) | Sonnet 5 · high | 2–3 | S4 |
| **S6** | RTMPS + FLV in Rust · 4h39m fixture | Opus 5 · high | 4–6 | S5's contract only — **parallel** |
| **S7** | Reconnect · backup ingest · local recording | Opus 5 · high | 3–4 | S6 |
| S8 | Stream key: paste-to-Rust (own channel) · nonce (hosted) · desktop UI gate | Sonnet 5 · high | 2–3 | S5's contract — **parallel** |
| S9 | Ingest-health states + adaptive bitrate | Sonnet 5 · high | 2–3 | S5 · S6 |
| W1 | Guests: live watch-link on the story page | Sonnet 5 · high | 1–2 | — **parallel** |
| S10 | Release channel (R2) · `/download` readiness gate · min OS · throttling · keep-awake | Sonnet 5 · high | 2–3 | X0 — **parallel** |
| S11 | Signing + notarization (macOS now; Windows when the cert lands) | Sonnet 5 · high | 2–3 | S10 |
| S12 | Updater (R2 endpoint, Rust-side check, never mid-broadcast) | Sonnet 5 · high | 2–3 | S11 |
| S13 | Acceptance run on both OSes — a REPORT | Sonnet 5 · medium | 2–3 | everything |

**33–48 session-days.** `BUILD_SESSIONS.md` rule 1 still applies: never more than TWO build
sessions at once — "parallel" means eligible, not simultaneous. Serial spine S1 → S2 → S3 → S4 → S5 → S13; S6, S8, W1, S10 run beside
it. Milestones: M0 the shipped pipeline proven end-to-end with OBS · M1 path confirmed (S0) ·
M2 picture + sound on canvas (S3) · M3 first OBS-free stream (S7) · M4 signed installers (S11) ·
M5 acceptance (S13) · M6 a real wedding on it.

## Do not rebuild (RULE 0 hits the E-series missed)

- `airOverlays: ResolvedOverlays` is already on the controller page — S2 draws it, never resolves it.
- `lib/live-studio-ingest-health.ts` (LS4) is THE health surface — S9 extends `decideIngestHealth`.
- `live_studio_channel_oauth_state` is the nonce precedent — S8 copies its shape.
- `ProgramBridge` + `EMPTY_FRAME` are tested and on the same window — S1 subscribes.
- `reel-render.ts` has the WebCodecs codec probe — S4 copies the shape.
- Own-channel by hand is the DEFAULT route to air (`live-studio-manual-air.ts`) — the key is the couple's.

## What this does not buy

It does not remove the laptop. It is not B4/Roam. It does not stop clamshell sleep — the
rehearsal script says "lid open, power in, do not close, do not minimise."

## Retired: E0–E9

Do not run them. Their false premises: E0 "WebCodecs undocumented in WKWebView" (documented ON;
gate is Safari 26's WebKit → floor macOS 14 + Apple silicon) · E2 guards retired `WatermarkReason` ·
E3 encodes programme audio that does not exist · E6 protects a key the product hands to the browser
and ignores that the default tier's key is the couple's own · E5 is happy-path (no reconnect, no
RTMPS, no 4h39m) · E7 "ad-hoc fallback so CI never breaks" (false: secrets exist, CI fails hard) ·
E8 GitHub-release endpoint (repo is private) · E9 asserts a recording nobody built and a split
nobody publishes.
