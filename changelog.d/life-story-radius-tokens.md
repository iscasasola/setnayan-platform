## 2026-07-08 · fix(life-story): route flash.module.css corners through the --m-r-* token scale

The advisory radius guard flagged 4 hardcoded border-radius px sites in the flash's CSS module (from PR #2897). Now var(--m-r-full) / var(--m-r-sm); the orb's 50% circle stays (not a px radius). Guard green again.

SPEC IMPACT: None.
