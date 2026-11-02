## 2026-10-12 · fix(maker): the first render after an Undo is the truth for every panel's copy of a scene

**The fault (walked in the lab, 375 × 812).** Invitation › Welcome › Title › Style: Size one step up (draft: eyebrow
`{size:110}`) → ↺ → the draft was EMPTY and ↺ grey, but the panel still read 110 %; the next Colour pick wrote
`{color, size:110}` — the undone pick came back. The same on Title › Edit (the undone words written back by a Size
pick) and on Details › Schedule › Background (the undone Plain colour written back, the panel still on "Colour").

**Why.** `lib/maker-draft-store.ts` keeps the Maker's own copy of every scene canvas a panel writes (a held pick owes
no render) and drops it when a render moves on. When the ONLY pick of a visit on a scene is undone, the server is back
at exactly the value the copy was built on — which the store read as "no render has brought anything newer".

**The rule now — by the order of things, not the content.** A write the canvas did not draw (↺ · Restore · Reset ·
✓ Apply · a form) already announces itself (`MAKER_UNHELD_WRITE_EVENT`) after sending every pick still waiting, and
the router runs writes and renders in order. Every copy kept at that moment is owed the truth by the first Maker
render after it (`makerRendered(renderStamp)` — the first line of `MakerShell`'s body, so that render's panels already
read it), unless a write of that scene, or an unheld one, is still on its way. A pick noted after the announcement is
a later write and is judged as before. Canvases and a scene's own words alike. The RSVP stage's own rule
(`lib/rsvp-stage-truth.ts`, PR #6483) is kept — it re-posts its frames — and agrees with this one.

Guards: 8 new in `lib/maker-draft-store.test.ts` (red on the base code; 8 sabotages each red). Walked before/after on
three panels (part-look, part-words, scene background).

SPEC IMPACT: None
