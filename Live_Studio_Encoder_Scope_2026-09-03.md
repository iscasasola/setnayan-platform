# Live Studio — Setnayan's own encoder: closing the last hop to YouTube

**Scope + recommendation · 2026-09-03 · session LS3**
**Measured against `origin/main` @ `17d4adfa0`.** Every claim below is anchored on a
greppable symbol or a live query, never a line number. Re-measure before acting.

> **This document is not evidence.** It is a scope. Where it states a fact it names the
> command that produced it; run that command rather than trusting this file. Where it
> states a cost it names the assumption; the assumptions are the part most likely to rot.

---

## ⚠ Corrections 2026-09-05 — read before § 4, § 6 and § 10

Audited claim-by-claim against `origin/main @ 118546afe` and a cited feasibility pass on
2026-09-05 (Encoder Replan: https://claude.ai/code/artifact/dfa993e3-4229-4b50-a7ec-8c2e3a7eff35).
The recommendation (Path A) STANDS and was re-affirmed by the owner on 2026-09-05 — on corrected
figures, for different reasons. The plan of record is now `build-sessions/encoder/README.md`
(S-series); the E0–E9 prompts derived from this scope are retired.

1. **§ 4B's own correction is itself wrong.** "Once the client composites and encodes H.264, Path A
   is strictly better — same client work minus a server" is false: a remux relay does NOT need
   this encoder. `canvas.captureStream() → WHIP → MediaMTX → ffmpeg -c:v copy` uses the browser's
   built-in WebRTC H.264, so it deletes WebCodecs, IPC, Rust, the install, signing, the updater and
   the OS floor. Real cost ≈ fixed server ÷ weddings/month (₱30–₱700), or ~₱15–20/wedding at
   hourly provisioning. Path A wins on *product shape* — the default tier streams on the couple's
   own channel with no server and no Google API in the path, and native keeps that at any volume;
   the WebRTC encoder is call-tuned and downgrades itself under loss; the laptop keeps the
   recording — not on marginal cost.
2. **"₱0 per wedding" is ₱0 marginal.** Fixed: Apple Developer is already paid (owner, 2026-09-05);
   the incremental cost is a Windows OV cert + cloud signer (~$130–400/yr ≈ ₱600–1,900/month;
   Azure Trusted Signing excludes PH organisations) plus macOS CI minutes if release builds run
   in CI.
3. **§ 8 / E0 "WebCodecs undocumented in WKWebView" is wrong.** WebKit's preferences turn it ON
   (video gated on WebRTC availability, audio unconditional). The gate is WebKit VERSION:
   `AudioEncoder` only from Safari 26 → floor **Apple-silicon macOS 14 + Safari 26**, Windows
   10/11 with hardware H.264. S0 measures the matrix; it does not ask yes/no.
4. **§ 5's overlay guard targets a retired mechanism.** `ProgramFrame.overlay` / `WatermarkReason`
   retired 2026-07-25; the unified bridge publishes `overlay: false`. Overlays are
   `ResolvedOverlays` (`lib/live-studio-overlays.ts`), already on the controller as `airOverlays`;
   "POWERED BY SETNAYAN" is `lowerThird.forced`. The invariant is "forced lower third cannot be
   skipped; the renderer never derives `owned`".
5. **§ 3.2 understates audio.** There is no programme audio stream and no mixer; per-phone tracks
   change on every cut and may be absent; Safari's `MediaStreamTrackProcessor` is video-only.
   S3 (3–4 days, Opus) builds the mixer + master clock. Not in the 2–3 days § 4A budgeted.
6. **§ 6 is contradicted one page away, and misses the default tier.** The key is server-rendered
   into the controller and setup pages for OBS today. And the DEFAULT route to air is the couple's
   OWN channel by hand (`live-studio-manual-air.ts`) — the key is theirs; only the hosted-channel
   add-on has a Setnayan-held key. S8 handles both.
7. **§ 4A's estimate.** 19–28 → **33–48 session-days**: RTMP 6–9 not 4–6 (RTMPS, reconnect inside
   YouTube's grace, backup ingest, the 4 h 39 m extended-timestamp boundary); plus the sessions
   the scope never listed — audio mixer, local recording (E9 assumed one), reconnect + guest
   watch-link resolution, a release channel (`publish-latest` is unreachable under
   `workflow_dispatch`; the repo is private so release URLs 404; `/download` has no Windows link),
   adaptive bitrate for ~10 Mb/s PH uplinks, updater.
8. **`build-desktop` ran 2026-09-05** (twice, owner dispatch): Windows OK; macOS compiled, signed,
   failed notarization — HTTP 403 "A required agreement is missing or has expired" (unaccepted
   Apple agreement; membership paid). The "ad-hoc fallback so CI never breaks" claim is false:
   all six `APPLE_*` secrets exist, so the fallback never engages.
9. **§ 7 / LS4 shipped** (PR #5122, 2026-09-03). Extend `decideIngestHealth`; never a second decider.
10. **Split-screen has no live publisher** (`ProgramBridgeHost` hard-codes `secondaryStream: null`).
    Out of launch scope; unit-tested only.

---

## 0. TL;DR

Live Studio **works end to end today**. The couple runs OBS, which window-captures
`/panood/program/[eventId]` and pushes RTMP to a Setnayan-pool YouTube channel. This is a
**usability gap, not a capability gap** — nothing here is broken.

**Recommendation: build the encoder into the Tauri desktop app that already ships — but
do NOT window-capture.** Composite and encode *inside the webview* (the repo already does
exactly this in `lib/reel-render.ts`), and let Rust do only the one thing a browser cannot:
speak RTMP over a TCP socket.

**Do this first, before any encoder work:** `getYoutubeStreamStatus` already exists, costs
1 quota unit, and **has zero callers**. Wiring it to the controller makes a dead encoder
visible. It is correct under OBS today and under the native encoder later, so it is never
wasted work — and it is the single highest-value change in this document.

---

## 1. RULE 0 — what already ships (do not rebuild any of it)

| Piece | Where | Anchor to re-verify |
|---|---|---|
| Phones publish over WebRTC | `app/panood/control/[eventId]/_components/camera-feeds.tsx` | `grep -rn watchPanoodCameras apps/web` |
| Controller cuts between channels | `app/panood/control/[eventId]/` | `liveStudioControlPath` |
| Split screen | `lib/panood-program-bridge.ts` | `secondaryStream`, `splitRatio` |
| Program pop-out (the capture surface) | `app/panood/program/[eventId]/program-surface.tsx` | `installProgramBridge` |
| Watermark decision, server-side | `lib/panood-watermark.ts` | `decideWatermark` |
| Free-tier cut-blind pin | `lib/live-studio-publish-pure.ts` | `decideProgramAir`, `programSourceAllowed` |
| YouTube broadcast on a pool channel | `lib/live-studio-roam-provision.ts` | `provisionRoamBroadcasts` |
| Readiness that refuses to lie | `lib/live-studio-readiness.ts` | `encoderNotice` |
| Desktop app (13-line webview wrapper) | `src-tauri/src/lib.rs` | `tauri_plugin_oauth` |
| Desktop app is downloadable | `app/download/`, `lib/desktop-release.ts` | rolling `desktop-latest` release |
| **Client-side H.264 encode, already proven** | **`lib/reel-render.ts`** | **`renderWithWebCodecs`, `mp4-muxer`** |

The last row is the important one: **this repo already encodes H.264 in the browser**,
compositing to a canvas and feeding WebCodecs `VideoEncoder`, with a
`MediaRecorder`+`canvas.captureStream()` fallback. The encoder half of this project is not
new work — it is an existing, shipped pattern.

### The bridge constraint that shapes everything

`lib/panood-program-bridge.ts` documents it: the WebRTC transport is **one publisher → one
viewer per camera slot**. If a second surface opened its own `watchPanoodCameras`, it would
**steal the phone's stream and black out the operator's own monitor mid-ceremony**. The
pop-out therefore never touches signaling — it reaches through `window.opener` and re-renders
the *same* `MediaStream` objects by reference.

**Consequence for any encoder design: the encoder must sit downstream of the controller's
existing streams. It may not open its own connection to the phones.** This rules out a
"second browser tab that encodes" and it rules out a relay that subscribes independently.

---

## 2. The gap, precisely

A browser has no raw TCP sockets, so it cannot speak RTMP. Something between the controller
and YouTube must. Today that is OBS, installed and configured by the couple.

**What OBS is actually doing** is narrower than it sounds — two things:

1. **Rasterising** a DOM surface (`<video>` elements + DOM overlays) into frames.
2. **Muxing + pushing** those frames as H.264/AAC over RTMP.

The program surface has **no canvas and no `captureStream`** — verify:
`grep -nE "canvas|captureStream" apps/web/app/panood/program/\[eventId\]/program-surface.tsx`.
The composite exists only as *rendered pixels in a window*, which is exactly why window
capture is the mechanism.

---

## 3. Four findings that change the decision

### 3.1 🔴 `getYoutubeStreamStatus` has ZERO callers — the encoder can die silently

```
grep -rn "getYoutubeStreamStatus" apps/web --include="*.ts" --include="*.tsx"
# → exactly one hit: its own definition in lib/panood-youtube.ts
```

It calls `liveStreams.list(part=status)` and returns `{ streamStatus, healthStatus }` for
**1 quota unit**. Its own docblock says to poll it "until `streamStatus === 'active'` (the
encoder is connected + sending)". Nothing does.

So today: **OBS dies mid-ceremony → YouTube knows within ~10s → Setnayan could know for 1
quota unit → the controller says nothing.** The operator finds out from a guest.

This is precisely the defect class `CLAUDE.md` names as the repo's signature — *a failure
that renders identically to success* — sitting unaddressed on the most expensive, least
repeatable surface the product has. **A log line never changed a pixel.**

### 3.2 🔴 Audio reaches air only through a manual OBS step, and nothing checks

`program-surface.tsx`'s own docblock, verbatim:

> "OBS captures this WINDOW's picture; it does not capture a muted element's audio. For the
> vows to reach air the operator must add Desktop/Application Audio Capture."

An operator who misses that setting broadcasts a **silent wedding**. The failure is invisible
on the controller, invisible in the pop-out, and discovered only by a viewer. Note also that
the surface deliberately unmutes and **falls back to muted if autoplay rejects it** — so
there is a path where audio is lost with no operator error at all.

**This alone is a strong argument for the native encoder**, which takes the audio track off
the `MediaStream` directly and never involves OS-level audio routing.

### 3.3 🟡 The "§ 4c" citation is wrong, and it conflates two different apps

Four places in the tree say the native capture app "was scoped but never built (§ 4c)" —
`lib/live-studio-readiness.ts`, `lib/live-studio-roam-provision.ts`,
`app/_components/live-studio/broadcast-readiness.tsx`, `app/admin/live-studio-channels/page.tsx`.

Both halves are wrong:

- **§ 4c** of `Live_Studio_Unified_Spec_2026-07-25.md` is *"WAVE 1 + 2 SHIPPED — corrections
  the build forced"*. It scopes no capture app.
- The real scope is **B4** in `Live_Studio_Cast_and_Roam_2026-07-23.md`: *"direct-RTMP capture
  app for kit phones (container-app gap) — or interim Larix + provisioning deep-link."*

**B4 is a phone app.** It captures a kit phone's own camera and pushes one RTMP stream per
camera, direct to YouTube, for **Roam** — Setnayan never touches the media. The desktop
encoder scoped here captures the **composited program output** and pushes **one** stream, for
**Cast**. Different input, different topology, different product.

⚠ **So building the desktop encoder does NOT deliver B4, and Roam still has no capture path
afterwards.** Any plan that treats them as one item will under-scope Roam. (The session brief
for LS3 makes exactly this conflation — it is inherited from the code comments, not invented
there.)

### 3.4 🟡 The price in the spec is stale — it is ₱1,500/day, not ₱2,999

```sql
select service_code, retail_price_php, billing_period, is_active
from platform_retail_catalog_v2 where service_code = 'LIVE_STUDIO';
-- LIVE_STUDIO | 1500.00 | per_day | true      (read live, 2026-09-03)
```

`Live_Studio_Unified_Spec_2026-07-25.md` § 4f still says ₱2,999; the Cast/Roam rows say
₱2,500/₱3,500. **The catalog is the only price a customer is charged** (`CLAUDE.md` lock).
This matters because it halves the headroom any per-minute relay has to fit inside.

---

## 4. The three paths, with real cost

Assumptions, stated so they can be attacked: **1080p30 @ 4.5 Mbps**; a wedding broadcast of
**6h typical / 12h worst case** (12h is also YouTube's *archive* cap — beyond it there may be
**no replay at all**, per § 4f); **₱58 = US$1**.

### Path A — Desktop app encodes (RECOMMENDED)

**Marginal cost to Setnayan: ₱0.** Media never touches Setnayan infrastructure. Preserves the
₱0 lock exactly as OBS does today.

Engineering, estimated in ranges (these are the least reliable numbers here):

| Piece | Est. | Notes |
|---|---|---|
| Composite program surface → canvas | 2–3 d | pattern exists (`reel-render.ts`) |
| Redraw overlays on canvas + drift guard | 3–4 d | **the risky piece — see § 5** |
| WebCodecs H.264 + AAC audio | 2–3 d | video proven in-repo; **AAC audio is new** |
| RTMP client + FLV mux in Rust | 4–6 d | or an ffmpeg sidecar: ~2–3 d, but +~80 MB bundle and an LGPL/GPL call |
| IPC transport + backpressure | 2 d | dropping frames must degrade, never stall |
| Failure → controller render | 2–3 d | § 3.1; **not polish** |
| Stream key never in renderer/logs | 1–2 d | see § 6 |
| Cross-platform build, signing, notarization | 3–5 d | routinely underestimated |

**≈ 19–28 engineer-days.** Recurring cost: maintenance of a native binary on two OSes.

### Path B — Media-server relay (browser → WHIP → LiveKit/mediasoup → ffmpeg → RTMP)

**Zero install. Recurring per-minute cost on every wedding**, plus a new production dependency
in the path of an unrepeatable day.

LiveKit Cloud, published rates (fetched 2026-09-03): egress **$0.02/min video**; downstream
transfer **$0.12/GB**.

| | 6h wedding | 12h wedding |
|---|---|---|
| Egress minutes | $7.20 | $14.40 |
| Data transfer (~2 GB/h) | ~$1.46 | ~$2.92 |
| **Total** | **≈ $8.66 ≈ ₱502** | **≈ $17.32 ≈ ₱1,005** |
| **Share of the ₱1,500 SKU** | **≈ 33 %** | **≈ 67 %** |

That is what "breaks the ₱0 marginal-cost lock" means in pesos. At 12h it consumes two thirds
of gross revenue before any other cost.

**⚠ One honest correction in this path's favour.** The corpus rules relays out categorically,
but it was reasoning about a *compositing* relay (LiveKit's `RoomComposite` re-renders and
**re-encodes** server-side — that is what the transcode minute buys). If the client ships an
**already-composited, already-H.264** stream, the server only needs to **remux** to FLV —
roughly 0.1 core per stream instead of ~2. A self-hosted 4-core VPS (~$24/mo) would carry
~8–16 concurrent weddings, i.e. **≈ ₱46–₱280 per wedding** depending on volume, not ₱500–₱1,000.

**This does not change the recommendation**, because once the client is already compositing
and encoding H.264, Path A is strictly better — same client work, minus a server, minus a
runtime dependency on an unrepeatable day. But it does mean *"a relay is unaffordable"* is
**too strong as stated**; the accurate claim is *"a **transcoding** relay is unaffordable."*
Worth correcting in the corpus so a future session does not rule out remuxing on false grounds.

### Path C — Cloudflare Stream — RULED OUT (re-verified 2026-09-03)

Fetched `developers.cloudflare.com/stream/webrtc-beta/`: **"Simulcasting (restreaming via
RTMP/SRT) is not supported."** Stream Live ingests RTMPS/SRT, which a browser still cannot
speak. Not a path. Do not re-litigate without new evidence from that page.

---

## 5. Why NOT window capture — the recommendation's load-bearing detail

The obvious build is "Tauri app screen-captures the program window." **Don't.** The web app
already runs *inside* the Tauri webview, so the frames can be produced in-process:

**composite → canvas → WebCodecs H.264 → IPC → Rust → FLV/RTMP → YouTube**

This removes, in one move:

- the macOS **Screen Recording permission** prompt (a support burden and a scary dialog on a
  wedding morning);
- **occlusion / minimise / display-sleep** black frames;
- wrong-window and wrong-resolution capture;
- and **the manual Desktop Audio Capture step of § 3.2** — audio comes off the `MediaStream`
  as a track, so the vows cannot be silently lost to an OS routing setting.

Two things make this cheaper than it sounds: the WebRTC `MediaStream`s **do not taint the
canvas** (unlike `reel-render.ts`'s cross-origin R2 clips, whose CORS problem is that file's
main hazard), and the H.264 encode path is already written.

### 🚩 The one genuinely hard part — overlay drift is a revenue risk

The overlays (monogram · lower third · event QR · **Powered-by SETNAYAN**) are **React DOM**.
A canvas encoder must **re-draw** them, which creates a second renderer for the same fact —
exactly the "two mechanisms that disagree, each passing its own suite" failure `CLAUDE.md`
rule 8 warns about. Here the overlay **is the free-tier paywall**, so drift is not cosmetic:
it is unbranded free broadcasts.

**The mitigation that makes this tractable:** the *decision* stays single-sourced and
server-side — `decideWatermark`, `decideProgramAir` / `programSourceAllowed` — and only the
*drawing* is duplicated. The encoder must **consume** `ProgramFrame.overlay` /
`WatermarkReason` / the air decision, exactly as the pop-out does, and **never re-derive**
them. Add a guard asserting the canvas renderer handles **every** `WatermarkReason` variant,
so a new variant fails the build rather than silently airing unbranded.

🚫 **This is the surface most likely to be left uncovered. Budget for the guard, not just the
renderer.**

---

## 6. The stream key

It is a bearer credential for a channel other couples' weddings stream on. It must:

- be fetched **server-side** and handed to the **Rust** side, never to the renderer/webview;
- never be logged, never appear in an error string, never reach Sentry;
- be redacted from any RTMP URL printed in diagnostics (`rtmp://…/live2/****`);
- and be revocable — a leaked key means resetting it on the pool channel.

Note the existing precedent: `live_studio_channel_grants` is **RLS-enabled with no policy**
(service-role only), specifically because a widened `oauth_grants` would have exposed a
platform credential row-wise to event members. Follow that reasoning, not a shortcut.

---

## 7. Smallest shippable slice — and it is not the encoder

**Wire `getYoutubeStreamStatus` to the controller.**

Why this first: it is the only piece here that is **path-independent**. It is correct under
OBS today, correct under the native encoder later, and correct if the owner picks the relay.
It cannot be wasted work, and it converts the product's worst failure — a ceremony that is
dead on air and looks fine on the console — into something the operator can see and fix.

Shape, following the repo's own pure/server split (`live-studio-readiness{,-server}.ts`):

1. `decideIngestHealth({ streamStatus, healthStatus, live, lastOkAt })` — **pure**, in
   `lib/live-studio-ingest-health.ts`, returning a named state
   (`waiting_for_encoder` · `receiving` · `degraded` · `no_data`) plus the operator-facing
   sentence. Fully unit-testable, and the thing to mutation-test.
2. A server read beside it that resolves the event's stream id + pool token and calls
   `getYoutubeStreamStatus` (1 quota unit/poll; at ~15s intervals that is ~240 units/hour —
   check it against the ~12–15 weddings/day quota ceiling **before** choosing the interval).
3. **Render it on the controller, loudly.** Not a toast, not a log — a persistent state next
   to the tally. `no_data` while `live` is true is the loudest state the console has.

⚠ **Two traps, from this repo's own history:**
- **A stopped upload fires no event at all.** Absence of a bad status is not health — treat
  *stale* polls as `no_data`, never as "still fine".
- **Do not fail closed into silence.** If the health *read* itself fails, say "cannot tell",
  never "receiving". This is a read, not an action: an absence here must be **shown**, not
  denied. (`actions.ts` files are the opposite case and out of scope.)

---

## 8. What I could not determine

- **Whether couples actually use the desktop app.** It ships and is downloadable
  (`/download`, `lib/desktop-release.ts`, rolling `desktop-latest` release), but I found no
  install/usage telemetry. The "no new install" argument for Path A is **weaker if adoption is
  ~0** — the couple would then be installing Setnayan instead of installing OBS, which is
  still a win (one vendor, no stream-key copy-paste, no scene setup) but a smaller one.
- **Whether WKWebView (macOS) supports WebCodecs `VideoEncoder` with AVC** at the Tauri 2
  version pinned here. Chromium/WebView2 on Windows does. **This is the single technical
  unknown that could force the ffmpeg-sidecar variant on macOS, so prototype it first** — it
  is a half-day spike and it de-risks the largest line item in § 4.
- **Real-world stream durations.** 6h/12h are assumptions, and the relay costs scale linearly
  with them. `orders` + broadcast records could ground this once there are enough events.

---

## 9. Owner decisions (not engineering)

1. **Path A (desktop, ~19–28 eng-days, ₱0/wedding) vs Path B (relay, no build, ₱46–₱1,000
   per wedding depending on remux-vs-transcode and volume) against a ₱1,500/day SKU.**
2. **Correct the corpus?** § 4c citation, the B4 conflation (§ 3.3), the stale ₱2,999
   (§ 3.4), and the too-strong "a relay breaks the ₱0 lock" (§ 4B). Not applied here —
   `CLAUDE.md` authorises direct corpus edits, but these are money and product claims, so
   they are surfaced rather than taken.
3. **Does B4 (the Roam phone capture app) stay on the roadmap?** It is a separate,
   still-unbuilt product need that this work does not address.

## 10. Recommended sequence

1. **Wire ingest health to the controller** (§ 7) — path-independent, highest value.
2. **Half-day spike:** WebCodecs AVC inside WKWebView on macOS (§ 8).
3. **Owner picks Path A or B** (§ 9.1).
4. If A: **canvas composite + overlay-parity guard first** (§ 5) — the paywall surface, not
   the RTMP socket, is the risky half.
5. RTMP push, then signing/notarization.
