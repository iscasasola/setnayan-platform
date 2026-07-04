# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-04 · feat(live-studio-demo): the homepage Live Studio demo now carries audio

Owner report (2026-07-04): "live studio demo does not have audio." A livestream control-room demo with no sound undersells the feature. Audio was off for two reasons — the phone captured `audio: false`, and every control-room `<video>` was hardcoded `muted`.

- **`app/panood/demo/[token]/_components/cam-join-flow.tsx`** (phone publisher): new `captureCameraStream()` requests the mic alongside the rear camera with `echoCancellation` / `noiseSuppression` / `autoGainControl`. Audio is **best-effort** — a phone with no mic, or a visitor who allows the camera but blocks the mic, falls back to a silent video-only stream so the camera demo never regresses (a blocked *camera* still surfaces the existing `camera-error` step). Intro copy + CTA updated to name the mic; the phone's own preview stays `muted` (it must never play its mic back).
- **`app/_components/home/panood-demo-overlay.tsx`** (desktop control room): `LiveVideo` gains a `muted` prop (default `true`). Only the **PROGRAM** view opts out — the two multiview thumbnails stay muted, so exactly one source is ever audible: the program plays the **ON-AIR camera's** sound and it **follows every cut** (owner: "we want the demo monitor to play the audio of the chosen camera"). The speaker toggle's `audioOn` state **defaults to on**; it's disabled with an "isn't sending sound" hint when the on-air camera published no audio track (`programHasAudio`). If a browser blocks unmuted autoplay, `LiveVideo` retries **muted** so the video never goes black and fires `onAutoplayBlocked` → `audioOn` drops to off, leaving a one-tap "sound" affordance (a click is the gesture that lets sound start). The toggle also lets a visitor mute if a same-room laptop + phone start to feed back.
- **`lib/demo-webrtc.ts`**: transport was already track-agnostic (`addTrack` over `getTracks()`, `ontrack` → `e.streams[0]`), so no transport change was needed — only the "video only" header comment was corrected.

Full two-device audio verification needs the Vercel preview + a phone (a headless preview can't produce live camera/mic streams).

SPEC IMPACT: None — the Live Studio homepage demo is groundwork (DECISION_LOG 2026-07-03), not a spec'd SKU surface; this is an additive audio path with no schema or pricing change.
