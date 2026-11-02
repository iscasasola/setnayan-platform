## 2026-10-14 · fix(rsvp): after ‹ Back at 320 × 568 the answers stay fully tappable

Re-check of batch 6 (R1, both engines): after a guest picks Yes and taps ‹ Back, the reply page's foot holds **Next**,
sticky at 496–568, over "Joyfully accepts" and the top strip of "Sadly can't make it" — in WebKit a tap on that strip
pressed Next and went on with Yes kept. The short-screen rule that kept only the HINT in place now keeps the whole
foot in place: under 600 px tall (`ONE_AT_A_TIME_CSS`) the slot is static whatever it holds, so it sits after the
answers, one scroll away. 375 × 667 and taller unchanged (Next keeps its sticky foot; measured boxes identical).

- Guard: `lib/the-tap-hint-never-covers-an-answer.test.ts` (3) — the short-screen rule names the slot itself, and its
  line holds 568 and leaves 667 alone; sabotaged twice red (hint-only rule back · line at 700 px).
- `the-reply-card-is-todays-page.golden.json` re-recorded on purpose: the 30 one-question-at-a-time cases each −15 bytes,
  exactly the rule's shorter selector; nothing else moved.

SPEC IMPACT: None.
