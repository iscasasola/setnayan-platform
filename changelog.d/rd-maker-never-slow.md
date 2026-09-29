## 2026-09-29 · perf(maker): every Maker tap shows its result first, saves behind it, and never remounts the Maker

Owner, verbatim: *"we also want to make sure 100% that there is no slow response on the maker"*
(DECISION_LOG 2026-09-29 "THE MAKER MUST NEVER FEEL SLOW"). Every change below uses the shipped
instant-Maker path — the canvas bridge, the canvas hold, `makerSave` and `BufferedCanvasFrame`. No
second mechanism was added.

**Measured, not inferred.** The real Maker (`next build` + `next start`) ran against a local fake
Supabase with in-memory writes and a locally minted session. No real account and no real database
were used. Test conditions: phone 390×844, 4× CPU throttle, 80 ms network RTT. Base (bd0ba53b8) and
this branch were run INTERLEAVED on two servers, so both saw the same machine load. Tap to first
visible change, 3 runs each:

| Action | Before | After |
|---|---|---|
| Hide a scene (eye) | instant, then the WHOLE MAKER REMOUNTED at 0.8–1.8 s with a blank canvas | 13–44 ms, no remount |
| Move a scene up | 510–596 ms, controls locked, and a drag of N places = N round trips | 24–27 ms; one save for any distance; three quick taps all land (before: only the first) |
| QR shape | 378–390 ms | 5–6 ms |
| Reveal pick | 1,019–1,066 ms, and the page frame went blank | 14–18 ms, the old page stays up until the new one is ready |
| Hero design | label 9–12 ms, Hero page BLANK at ~600 ms | label 10–12 ms, never blank (the page swaps when it is ready) |
| Add a scene | nothing until the new tile at 305–424 ms | "Adding your scene…" in the navigator (22–24 ms) and a placeholder on the canvas (52–56 ms) |

Unchanged, and still instant: select a scene, part size and bold, typing words, background picks,
warm stage switch, theme tile. Undo is still ~0.9–1.0 s: it needs the server's history. The old
canvas stays up the whole time and nothing goes blank.

**The finding that mattered most.** A Maker FORM post — the eye, Hidden, a move, add a scene, every
legacy panel form — redirects back to the Maker's own address. `lib/maker-stay.ts` exists so that
this lands "without remounting", but measured, the same-address redirect still REMOUNTED the whole
Maker, twice. The canvas and all three warm stages loaded again from nothing, blank, after edits
that had already been drawn. `router.refresh()`, `router.replace()` and `router.push()` to the same
address do not remount; only the server-action redirect does. So:

- the eye and Auto · Hidden now save the draft through `makerSave` (`gateWrite`), with the
  navigator's state shown at once. Shown still posts the form, because the server refuses Shown
  for an empty scene;
- a move saves the stage's whole order in ONE `makerSave` (`lib/maker-reorder.ts`). It writes the
  same patch the move action writes;
- adding a scene from the Maker revalidates the Maker and returns instead of redirecting
  (`addCustomSection`).

The remaining legacy row-panel forms still redirect. They are listed in the PR for a follow-up.

Also: `MakerPageFrame` is double-buffered through `BufferedCanvasFrame`. The Hero, Reveal and
RSVP page frames were keyed on every render stamp and went white after every save. The
QR controls are optimistic, and `updateQrStyle` no longer `revalidatePath`s: that was two
whole-Maker renders per pick. Reveal, reveal stages and effects are optimistic and no longer
lock. The theme picker queues taps so the last one wins (before, a tap while a save was in flight
was dropped). The template tile is pressed at once. The Save-the-Date lead switch is optimistic.

**Guards:**
- `lib/every-maker-edit-shows-before-it-saves.test.ts` parses the Maker's client components with
  the TypeScript AST and checks three properties. (A) Every `makerSave` is preceded in its handler
  by a state write or canvas post. (B) No server action is called outside `makerSave`. (C) There is
  no bare `router.refresh()`. It also checks that the made-once page frame is buffered. The
  exceptions are listed with reasons, and a stale exception fails.
- `lib/maker-reorder.test.ts` checks that one save equals the chain of N single swaps.
- `apps/web/scripts/check-maker-js-budget.mjs` sets a first-load JS ceiling for the Maker route:
  measured 481.5 KB gz on the base (page + layouts + root; Next prints 313 kB for the page entry
  alone), budget 505 KB, this branch 484.4 KB. It runs in the `bundle size check` CI job.

SPEC IMPACT: None. This implements the 2026-09-29 DECISION_LOG row.
