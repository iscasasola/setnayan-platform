## 2026-10-19 · fix(frontdoor): Home says "event", the small print reads, the search field presses 44

Quality sweep 2026-10-19, batch 5 (rows B1, B2, C3).

- **B1 — house word.** Home's hero said "Every celebration, planned in one place" over the main button
  "Start your celebration — free"; now "Every event…" / "Start your event — free". The ⌘K palette's
  New-event row ("Start planning a new celebration") said it too and now says "event".
  Guard: `the-front-door-says-event.test.ts` reads every string a front-door file can put on screen
  (JSX text, string/template literals) through the TypeScript parser, plus the rendered hero.
- **B2 — 44 px on the public top bar.** Measured by pressing (`elementFromPoint`), four of the five
  signed-out controls already pressed 44+ through their `::after` expanders (Menu 44.75, wordmark
  45.25, Sign in 44.75, Search 46) — the sweep measured bounding boxes, which cannot see an expander.
  The one real miss was the phone search FIELD: 42.75, because the box's 1px borders belonged to the
  `<form>`. On touch the field now reaches over both borders (`margin: -1px 0; min-height: 44px`) —
  44, pixel-identical paint. Guard: `tests/e2e/the-public-top-bar-presses-44.spec.ts` presses every
  visible pressable in the bar and the phone search row at 375 and 390.
- **C3 — small print contrast.** The rail captions ("things you plan with…"), Home's shelf rules,
  the rail's "© 2026" / "Set na 'yan" lines and the "couldn't load" label were `--fd-m3` (2.80:1);
  the rail's Privacy · Terms line was `--fd-m2` (3.67:1). All now `--fd-m1` (5.38:1 light, 8.2:1
  dark). Guard: `the-small-print-is-readable.test.ts` computes each rule's ratio from the tokens.

Not done: C11 (seed/owner data in the Home feed) needs the owner's call.

SPEC IMPACT: None
