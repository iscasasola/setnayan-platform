## 2026-07-21 · fix(live-studio): the real camera never captured audio — the demo always did

Owner: *"the live sample already had audio input based from the camera"* — correct, and it exposed
a divergence rather than disproving the finding.

```
/panood/demo/[token]   ← the homepage live sample
   audio: { echoCancellation, noiseSuppression, autoGainControl }   ✅ mic captured

/panood/cam/[token]    ← the real product path
   audio: false                                                     ❌ silent
```

**The demo was better than the product.** It also proves audio rides this exact WebRTC transport
without trouble — the real publisher simply never asked for it. A wedding broadcast without vows is
not a broadcast.

### Capture

`getCameraStream()` now requests the mic with the demo's constraints, and **falls back to
video-only** if the mic is absent, blocked, or over-constrained. Losing the whole feed over audio
would be far worse than a silent one; a blocked *camera* still propagates, so the existing error
state is unchanged.

### Playback — only the pop-out makes sound

OBS captures this window's picture; it does not capture a muted element's audio. So for vows to
reach the couple's YouTube, the **program pop-out plays unmuted** and OBS picks it up via
Desktop/Application Audio Capture.

Everything else stays muted, deliberately:
- **The control-room monitor** — the operator is usually in the same room as a camera, and an
  unmuted monitor there is a feedback loop.
- **Split panes** — two live mics mixed by the browser is not a mix, it is noise. Audio rides the
  PROGRAM element.

Autoplay policy is handled: the pop-out is opened by a click so it normally has activation, but if
an unmuted `play()` is rejected it **falls back to muted** rather than losing the picture. A silent
broadcast is bad; a black one is worse.

### Also removed

The sources rail's "Audio (preview)" meter — a bar hardcoded to `w-0` that could never move. With
no level data in the pipeline it was a fake door, and a fake meter next to real audio is worse than
no meter.

126 unit tests pass; typecheck + production build clean.

SPEC IMPACT: `Live_Studio_Repackaging_2026-07-08.md` § 7 lists "audio meters" in the controller
feature set — they remain unbuilt, and the placeholder that implied otherwise is gone.
