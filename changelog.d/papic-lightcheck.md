## 2026-07-21 · chore(papic): /papic/lightcheck — the probe that gates the low-light plan

A **throwaway** operator diagnostic implementing **M1 + M3** of
`Papic_Low_Light_Council_Verdict_2026-07-21.md` § 7.1.

**Why.** The whole low-light plan rests on four claims the council could not verify from any primary
source, and would not let any lens assert from memory: does iOS Safari expose **`torch`**,
**`exposureCompensation`**, **`iso`** — and is **`ImageCapture`** real on this device? Every
downstream estimate (flash, frame stacking, night mode) is gated on the answers. This produces them
in about a minute on a real handset, for free.

**M3 is the cheap one that can kill a whole workstream.** Delivered FPS in a genuinely dark room
decides whether frame stacking is *physically possible*: if auto-exposure drops the stream to ~8 fps,
a 300 ms window yields 2–3 frames and stacking is dead before anyone costs the 7–9 days. The page
says so in words — *"STACKING IS NOT VIABLE at this frame rate"* — rather than leaving the operator
to interpret a number.

**What it reports:** `getSupportedConstraints()` · `getCapabilities()` · `getSettings()` · a real
`new ImageCapture(track).takePhoto()` **attempt** (the council's § 10.9 — `getCapabilities()` does not
answer the ImageCapture question) · measured FPS via `requestVideoFrameCallback` (counts decoded
frames, not paints) · a live torch toggle.

**Safety posture:**
- **Not on the capture path.** Opens its own stream, shares no code with `lib/use-papic-camera.ts`,
  so it cannot affect a live event. It only *copies* that hook's constraints (`HI_RES` 2560×1440,
  `facingMode` ideal) so the numbers describe the real capture rather than a synthetic one.
- **No upload, no points gate, no persistence.** Nothing leaves the device but what the operator
  pastes back.
- Torch is tested by **live `applyConstraints` on an already-acquired track** — never a constraint at
  acquisition — mirroring `applyZoom` (`use-papic-camera.ts:71`), because the known WebKit failure
  mode is *the camera pausing when torch is enabled*.
- `noindex`, unlinked, reached by typing the URL.

⚠ **Delete this route once the numbers are recorded in the verdict.** It is a measurement instrument,
not a feature.

SPEC IMPACT: None yet — it produces the input for § 7 of the verdict. Record the results there.
