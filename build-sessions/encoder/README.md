# Setnayan's own encoder — the S-series plan of record

> 🛑 **CORRECTED 2026-09-08. This file WAS the retired E0–E9 plan** while every S-series prompt's
> own rule 17 pointed here calling it "the S-series plan of record". A session obeying rule 17
> read the retired plan. The E0–E9 prompts remain on disk as history — **do not act on one.**
>
> 🔴 **S12 AND S13 ARE BOTH MERGED. DO NOT RELAUNCH EITHER.** S12 (the auto-updater) is PR
> [#5252](https://github.com/iscasasola/setnayan-platform/pull/5252), merged 2026-09-06T06:55:10Z.
> S13 merged as a **pre-flight readiness check** (PR #5250, `S13-PREFLIGHT.md`) concluding the
> physical rehearsal cannot yet be run — the rehearsal itself is still owed.
> 🔑 **A hand-off written 2026-09-07 said both branches sat at "0 commits — relaunch them". It
> read `git rev-list origin/main..<branch>` as `0` and concluded "never started". A MERGED branch
> and a NEVER-STARTED branch both read zero.** Check `gh pr list`, never the commit count.

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

## Where it stands — measured 2026-09-08 against `origin/main` and the live site

**14 sessions are merged; the pipeline is complete end to end.** What is left is one code defect,
one publish, two measurement runs and the physical rehearsal.

    phones ─► controller ─► canvas ─► audio ─► H.264+AAC ─► IPC ─► Rust FLV/RTMPS ─► YouTube
              (shipped)     S1·S2      S3       S4          S5      S6·S7             (free CDN)

| Merged | | PR |
|---|---|---|
| S0 | the spike — killed three false premises | #5200 |
| S1 · S2 | program canvas + overlays | #5195 · #5235 |
| S3 · S4 | programme audio (master clock) + H.264 on that clock | #5224 · #5236 |
| S5 | webview→Rust transport, gated and bounded | #5239 |
| S6 · S7 | RTMPS + FLV; reconnect, backup ingest, local `.flv` | #5213 · #5223 |
| S8 · S9 | stream key never in page state; ingest health + ABR | #5210 · #5243 |
| S10 · S11 | R2 release channel + honest `/download`; signing + notarization | #5209 · #5240 |
| S12 | **the auto-updater** | **#5252** |
| W1 | guests never hold a dead watch link across a reconnect | #5212 |

## Order — what is left

| | Session | Model · Effort | Days | Depends on |
|---|---|---|---|---|
| **S14** | The app points at a host that exists | Sonnet 5 · high | 1 | — **start now** |
| S15 | The first real publish; `/download` stops saying "no build" | Sonnet 5 · medium | 0.5 | S14 + **owner: 4 R2 secrets** |
| S16 | The real YouTube publish + the measured grace window | Sonnet 5 · high | 1 | **owner: 1 stream key** — **parallel** |
| S17 | 60-minute thermal, memory, the OS matrix, Windows | Sonnet 5 · medium | 1–2 | S15 + **a Windows laptop** |
| S13 | The acceptance rehearsal (`S13.md`, already written) | Sonnet 5 · medium | 2–3 | S14·S15·S16 + hardware |

🔶 **S17 PARTIALLY RUN 2026-09-09** (`S17-FINDING.md`) — do not treat as "never started" from a
`0 commits` read (see the trap this README already warns about above). Done: OS matrix cited from
S0 (unchanged machine); one full hour of the *hidden*-regime encode measured (new — no WebKit
suspension this time, unlike S0's 8 minutes). **Still open, both by owner instruction, not by
failure:** the visible-state 60-minute run (needs a human physically at this Mac's keyboard — an
unattended launch here never reaches WindowServer "visible" state) and the entire Windows leg
(owner has the laptop, will run it personally later). Exact resume commands for both in
`S17-FINDING.md` §§ 1 and 4.

**5.5–7.5 engineer-days.** S16 is parallel-safe with S14/S15 — it touches
`src-tauri/crates/encoder/` only. 🛑 **Never more than two build sessions at once**; collisions
were observed on S0 and S1.

🔴 **THE CRITICAL PATH IS OWNER ACTIONS, NOT ENGINEERING.** Nobody can install the desktop app
today: `/api/download/mac` and `/api/download/windows` both answer **503**, and the whole
`desktop/` prefix 404s on R2, because the four R2 secrets have never been set in the **GitHub
Actions** store (a different store from Vercel's). See `X0-TRACKER.md`.

## Do not skip the spike (history)

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
