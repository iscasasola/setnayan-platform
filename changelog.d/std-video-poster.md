## 2026-06-21 · feat(std): video play mode (fill default / fit-to-screen option) + desktop scroll no longer scrubs the film

Three owner asks on the full-screen Save-the-Date video beat (desktop + iPhone):

**1. Desktop scroll no longer moves the text.** Owner: "transition of text still moves with scrolling … that should not work anymore." The film registered a `window` `wheel` listener that scrubbed a beat on every mouse/trackpad flick. Removed it (`save-the-date-film.tsx`). The film auto-plays; **press-and-hold pauses, release resumes**, and a deliberate vertical drag still scrubs — none of which depend on the wheel listener (veil + petals + RAF auto-play untouched).

**2. A fill / fit-to-screen play mode, default FILL.** Owner: "give them an option how the video plays, fit to screen or fill … what we did before was fit to screen, now change our settings to fill."
- New `std_media.fit: 'fill' | 'fit'` (`lib/std-media.ts`), **default `'fill'`** — so legacy videos keep filling the screen (the earlier "video must be full screen" lock). No migration (`std_media` is free-shape JSONB). Persisted in the Render action; the two NSFW spread-writers preserve it automatically.
- **FILL** (default) → the clip plays **object-cover**, edge-to-edge (a slight crop, never black bars). **FIT** → **object-contain** (whole frame) over a **blurred poster still**.
- Implemented via the poster gate: the page/builder resolve the poster **only when `fit === 'fit'`**, and the film's existing `poster ? contain : cover` already encodes the choice — no new prop threading, no wasted presign in the common fill case. A fit-mode clip with no poster still falls back to object-cover (never black bars).

**3. A toggle in the builder next to "upload video"** (`std-media-picker.tsx`) — a Fill / Fit-to-screen segmented control (matches the Step-1 Readability control), shown once a video is uploaded, with a one-line explainer. The builder preview reflects the choice live (saved video); a fresh local-blob upload has no poster URL yet, so its preview shows object-cover until saved.

**iOS note (carried from the same work):** the fit-mode blurred fill is a `<img>` poster still, NOT a 2nd `<video>` — iOS plays only one video at a time, so a video backdrop stayed black on iPhone and left the bars (owner "still black screens on top and bottom").

Verified: `tsc --noEmit` exit 0. Adversarial review (scroll-removal safety + fill/fit correctness across all cases + persistence/plumbing + builder UI/preview + regressions). ESLint/CI lint + Vercel preview are the gate (sandbox can't run eslint/iOS). Live + on-device behavior owner-verified.

SPEC IMPACT: iter 0024 Save-the-Date — the full-screen video beat has a couple-chosen play mode (`std_media.fit`, default **fill** = object-cover; **fit** = object-contain over an iOS-safe blurred poster); desktop scroll no longer scrubs the film. → DECISION_LOG row.
