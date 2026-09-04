## 2026-09-04 · fix(rail): the sign-in prompt's button fits the 72px icon strip

Owner-reported from a live screenshot at ~1024px width: the rail's "Sign
in" button clipped past the rail's right edge and spilled into the feed.

The 1024–1279px breakpoint already hides `.fd-signin-prompt`'s paragraph at
this width — a Sign-in button is a real control, so it stays, unlike the
prose beside it — but never gave the button itself a compact treatment.
Base `.fd-btn-gold` is `white-space: nowrap` with 15px side padding, sized
for its normal home in the expanded rail; inside the 72px icon strip its
own container is barely 40px of content, so it rendered at full size and
overflowed.

Fix: `.fd-signin-prompt .fd-btn-gold` shrinks to its actual container at
that breakpoint only (full width, smaller padding/font, wrapping allowed
instead of clipped — "Sign" / "in" on two lines fits the 44px row height
already reserved for it). The ≥1280px expanded rail and the ≤1023px phone
drawer (280px, plenty of room) are untouched and were re-checked live.

SPEC IMPACT: None — a CSS fix for an existing, unlabelled defect, not a
product decision.
