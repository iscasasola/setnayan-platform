## 2026-06-28 · fix(onboarding): desktop layout pass — align/balance every two-pane + single-column step

A full desktop (≥1024px) audit of the wedding onboarding (`/onboarding/wedding`,
~40 steps). Every fix lives inside the existing `@media (min-width:1024px)` block in
`onboarding-desktop.css`; mobile/tablet (<1024px) is byte-for-byte untouched.

**1 — role/kind/faith hero alignment.** The two-pane hero filled the left column
top-to-bottom, pinning eyebrow+question to the very top while the answer stack stayed
vertically centred on the right — so question and answers floated apart (owner-reported
"the texts are not properly aligned"). Cap the hero to a centred 4:5 portrait
(`flex:0 0 auto; aspect-ratio:4/5; max-height:min(56vh,540px)`) so the
eyebrow+question+image group centres and lines up with the centred answers as one
composition. pax/budget keep the full-fill hero (tall slider/number control beside it).

**2 — faith screen was BROKEN.** The ~16 faith traditions were laid out as one
full-width stacked column (~1900px tall) — it overflowed the sheet AND the two-pane
`align-items:stretch` dragged the left eyebrow+question+image down to the vertical
middle of that giant column, off-screen (the "empty left pane" report). Lay the chips
out as a **2-column grid** (`grid-template-columns:1fr 1fr`, compact padding) — ~8 rows
fit the sheet, the left content stays put, nothing overflows.

**3 — single-column steps were top-pinned.** love-story steps, the AI-gate, account,
the empty find state and the congrats recap all sat at the top with the bottom half
empty. Added `justify-content:center` to `.screen.active:not(.onb-twopane)`. Safe
against tall content: `.screen.active` is `flex:1 0 auto` (never shrinks), so a tall
step grows to its content height (no slack → body scrolls, nothing clips) while a short
step takes the body's slack and centres. Congrats wraps its recap in a stretching
`.viewzone`, so it gets an extra `flex:0 0 auto` override to let the card centre.

Verified each statically-renderable step in a live local run of the flow.

SPEC IMPACT: None (desktop-only CSS polish; no schema, copy, pricing, or flow change).
The 2026-06-21 "hero fills the left column top-to-bottom" note is refined for the three
option screens — surfaced to the owner for sign-off.
