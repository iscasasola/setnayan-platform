## 2026-10-13 · fix(maker): a finger can pick the Yes / No answer on the RSVP stage (iPhone Safari)

The canvas bridge (`app/[slug]/_components/rsvp-canvas-bridge.tsx`) cancelled every pointerdown on a field that can take focus. The Yes / No answers are labels, and WebKit (every iPhone browser) drops a tap's click when its touch pointerdown is cancelled, so a couple on an iPhone could not pick those lines. A finger's pointerdown is now left alone; focus is still refused on the mousedown that follows the tap, and text fields still cannot take focus. Guard: `a-finger-picks-the-rsvp-answer.test.ts` (WebKit touchscreen over the real bridge; skips where WebKit is absent, the source half always runs).

SPEC IMPACT: None
