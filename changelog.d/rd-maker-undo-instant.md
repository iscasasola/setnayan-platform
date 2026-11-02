## 2026-10-13 · perf(maker): every drawn Undo answers at once — an undo journal, a draft stamp, a lazy runner

Before: the Maker remembered ONE step it could draw backwards (the last scene drag) and forgot it at the next save of
any kind, so the 2nd ↺ of a run of moves and every ↺ of a Style · Text · Animate · typed-words · RSVP-line pick became
an unheld save — a whole-Maker render plus a new canvas page, 6–10 s at production speed.

Now every held save leaves its inverse in a short journal as it is sent (`lib/maker-drawn-undo.ts`, first load, no
imports; `makerSave(…, { held, undo })`), and every write the Maker did not draw leaves a barrier. Every draft answer
carries a stamp of the state it left (`lib/hub-draft-stamp.ts`, server + the lab's door). ↺ draws the newest step
backwards in its own click and sends a HELD undo naming the stamp it expects (`lib/maker-undo-run.ts`, lazy — loaded by
`import()` after the first step is noted). The server always steps back one and answers `matched`; refused → the step is
drawn again and the line says why; not matched → the first render after the ↺ is the truth (#6485's rule, unchanged).
Scene steps are noted by value at their press (`editor-shell.tsx`), canvas picks hand their refused-save put-back
(`lib/canvas-pick-undo.ts`: part-look, element-sheet, type-in-place; part-words), RSVP lines theirs (maker-rsvp-ask).
Phase 2 (still the slow path, listed in `lib/every-held-save-can-be-undone.test.ts`): backgrounds, fonts, fixed-part
and scene Style variants, Look › Buttons, music, special message, reply-by, pabuya, love story, the names.

Guards: `lib/an-older-undo-is-drawn-at-once.test.ts` (G1–G4), `maker-draft-store.test.ts` (+2, G5),
`lib/every-held-save-can-be-undone.test.ts` (G6); seven older guards re-aimed to the journal (never weakened);
17 sabotages each red.

SPEC IMPACT: None — no locked decision changes (owner rule "a press answers at once", "never a silent refusal",
one press = one undo step are what this implements). Depends on #6513 (Maker first-load headroom).
