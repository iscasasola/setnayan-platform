## 2026-09-21 · fix(monogram): the "saved everywhere" popup has one button

"Make it reveal live for guests" linked to `#animated-monogram`, which renders only
once the animation is paid — so for an unpaid couple it closed the popup exactly
like "Done" and landed nowhere, while implying the reveal was theirs. Owner: "The
reveal should only be available when the payment for animation is paid." Removed;
"Done" is the one button. The page's "Unlock Animation & Apply" is the way in.

SPEC IMPACT: None.
