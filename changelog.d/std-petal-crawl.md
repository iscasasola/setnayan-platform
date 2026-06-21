## 2026-06-21 · feat(std): veil petals REST + crawl down the text (instead of bouncing), fall when the text is gone

Owner: "it will fall on the text and crawl down just like how an object hits something. if the text disappears, there is nothing blocking it, it will fall." This replaces the petal-bounce-off-text from #1970 with a more physical model.

- **Rest + crawl** (`reveal/veil-reveal.tsx`). A falling petal over the showing text no longer bounces up. Inside the central text band its descent is **capped to a slow creep** (and sideways drift damped), as if it landed on the words and is sliding down them. Below the text the cap lifts → it falls normally. The per-petal bounce cooldown (`pTextBounced`) is removed; `bouncePetal` stays for the press-poke.
- **Fall when the text is gone.** The film publishes `window.__stdTextShowing` — **false on every beat change** (the words swap out, over the 500ms cross-fade), then **true** once the new beat settles, and **false on the video beat** (no text). The veil reads it (default `true` if unset): when it's false there's nothing blocking the petals, so they fall through; when true they rest/crawl on the words.

So a petal lands on the names/date, creeps down them, and tumbles off when the text changes — then catches on the next words.

Verified: `tsc --noEmit` exit 0; adversarial review (crawl physics — does it creep down + exit cleanly, not stick or clump — plus the text-present signal + regressions) clean. WebGL petal *look* owner-verified on-device. CI (lint + build) + Vercel preview are the gate. Builds on #1969/#1970 (merged).

SPEC IMPACT: iter 0024 Save-the-Date veil reveal — petals rest + crawl down the on-screen text and fall when it's gone (replaces the bounce). → DECISION_LOG row.
