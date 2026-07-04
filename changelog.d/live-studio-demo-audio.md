# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-04 · feat(live-studio-demo): the homepage Live Studio demo now carries audio

Owner report (2026-07-04): "live studio demo does not have audio." A livestream control-room demo with no sound undersells the feature. Audio was off for two reasons — the phone captured `audio: false`, and every control-room `<video>` was hardcoded `muted`. Both fixed, with a real control-room monitoring model rather than blasting sound on connect.

- **`app/panood/demo/[token]/_components/cam-join-flow.tsx`** (phone publisher): new `captureCameraStream()` requests the mic alongside the rear camera with `echoCancellation` / `noiseSuppression` / `autoGainControl`. Audio is **best-effort** — a phone with no mic, or a visitor who allows the camera but blocks the mic, falls back to a silent video-only stream so the camera demo never regresses (a blocked *camera* still surfaces the existing `camera-error` step). Intro copy + CTA updated to name the mic; the phone's own preview stays `muted` (it must never play its mic back).
- **`app/_components/home/panood-demo-overlay.tsx`** (desktop control room): `LiveVideo` gains a `muted` prop (default `true`). Only the **PROGRAM** view opts out — the two multiview thumbnails stay muted, so exactly one source is ever audible, mirroring a real program monitor. New speaker toggle (top-left of the program view) flips a `audioOn` state that **defaults to muted**; it's disabled with an "isn't sending sound" hint when the on-air camera published no audio track (`programHasAudio`). `audioOn` resets on each overlay open.
- **`lib/demo-webrtc.ts`**: transport was already track-agnostic (`addTrack` over `getTracks()`, `ontrack` → `e.streams[0]`), so no transport change was needed — only the "video only" header comment was corrected.

**Why muted-by-default + tap-to-unmute:** the common demo is one person with their laptop *and* phone in the same room. Auto-playing the phone's audio out the laptop speaker back into the phone mic = an instant feedback howl; unmuted autoplay is also unreliable on Safari. Muted-by-default with an obvious speaker button avoids both and matches how OBS/vMix/ATEM program monitors behave. Full two-device audio verification needs the Vercel preview + a phone (headless preview can't produce live camera/mic streams).

SPEC IMPACT: None — the Live Studio homepage demo is groundwork (DECISION_LOG 2026-07-03), not a spec'd SKU surface; this is an additive audio path with no schema or pricing change.
