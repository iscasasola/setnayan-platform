# Setnayan's own encoder — a spike plus nine sessions (E0–E9)

Replaces OBS with the Tauri desktop app you already ship, so a couple opens Setnayan instead
of configuring streaming software the week of their wedding.

Owner-ruled 2026-09-03 (Path A): ₱0 per wedding.

⚠ **Be precise about what Path B costs, because the scope corrected its own figure.** A
COMPOSITING relay (LiveKit `RoomComposite`, which re-encodes server-side) is ₱500–1,000 per
wedding. A REMUX-ONLY relay is ≈₱46–₱280 — but it only works once the client already
composites and encodes H.264, at which point it is Path A minus a server. The categorical
claim "a relay breaks the ₱0 lock" is flagged in the scope (§ 4B) as *too strong*; the
accurate claim is that a **transcoding** relay is unaffordable. Do not repeat the
₱500–1,000 figure without saying which relay it describes.

Plan of record (diagram + reasoning): https://claude.ai/code/artifact/bc4f3469-fa86-4473-848d-4bb73677de78
Source scope: `Live_Studio_Encoder_Scope_2026-09-03.md` in the repo (LS3, PR #5118).

## The pipeline

    phones → controller → canvas → WebCodecs → IPC → Rust/RTMP → YouTube
             (built)      E1·E2     E3·E4            E5·E6        (free CDN)

Everything left of the canvas already ships. Only the highlighted hops are new.
A browser cannot open the RTMP socket — that, and only that, is why native code is involved.

## Order

| | Session | Model · Effort | Days | Depends on |
|---|---|---|---|---|
| **E0** | The spike — does WebCodecs work in Tauri? | Opus 5 · high | 1–2 | — **BLOCKING** |
| E1 | Program surface → canvas | Sonnet 5 · high | 2–3 | E0 |
| **E2** | Overlays on canvas + the drift guard | Sonnet 5 · high | 3–4 | E1 — **the risky one** |
| E3 | WebCodecs H.264 + AAC | Sonnet 5 · high | 2–3 | E1 |
| E4 | IPC + backpressure | Sonnet 5 · high | 2 | E3 |
| E5 | RTMP + FLV in Rust | Opus 5 · high | 4–6 | IPC contract only — **parallel** |
| E6 | Stream key never reaches the renderer | Sonnet 5 · high | 1–2 | — **parallel** |
| E7 | Build, signing, notarization | Sonnet 5 · high | 3–5 | a working binary |
| E8 | Auto-updater | Sonnet 5 · high | 2–3 | E7 |
| E9 | Acceptance run | Sonnet 5 · medium | 1–2 | everything |

**21–32 engineer-days across ten prompts (E0–E9)** — E1–E9 alone are 20–30; E0's spike is the rest. Wall-clock is shorter: E5 and E6 need only the IPC contract, so they
run alongside E1–E4.

## Do not skip E0

Every session after it assumes WebCodecs works inside the Tauri webview. That is confirmed for
Safari 26 and **undocumented for WKWebView**. One day of spike against three weeks of rework.

## Already done — do not rebuild

**LS4** shipped "a dead encoder is visible on the controller" (`lib/live-studio-ingest-health.ts`,
`getYoutubeStreamStatus` wired, quota-costed, mutation-tested). The scope budgeted 2–3 days for
it. E4 and E5 should EXTEND that surface, never build a second one that can disagree with it.

## What this does not buy

**It does not remove the laptop.** Nothing can — a browser cannot open an RTMP socket on any
device. It replaces "install OBS, configure a custom RTMP server, paste a stream key, set up
window capture" with "open Setnayan."

**And it is not B4.** B4 is a phone app pushing one stream per kit camera, for Roam. Different
input, different topology. Building this leaves Roam with no capture path.

---

## Audited 3 Sept 2026

Both documents were checked claim-by-claim against `origin/main` and the live database by a
separate model before release. Seven false or overstated claims were corrected and four
omissions closed — audio, the free tier's route to air, multi-day events, and what guests see
when it fails. Two corrections worth carrying forward:

- **The relay figure.** "₱500–1,000 per wedding" describes a COMPOSITING relay. A remux-only
  relay is ≈₱46–₱280. The scope flags the categorical "a relay breaks the ₱0 lock" as *too
  strong*. Path A still wins — the cheap relay needs the client to composite and encode
  anyway, which is most of Path A — but do not quote the big number without saying which
  relay it describes.
- **Ten prompts, not nine sessions.** E0–E9. The 21–32 day range includes E0's spike.

Companion document — the whole system end to end, including what the encoder does NOT fix:
`live-studio-system.html` in this folder.
