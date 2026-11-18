## 2026-11-19 · feat(search): Search or add — the magnifying glass becomes ＋, only where a list can add

Owner, 18–19 Nov: *"so we also do no need an add button because. our text box is search / add feature"* · *"tap the
magnifying glass to convert it to add"* · *"not all search bar converts to add. just only those that needs conversion"*.
On top of tap-and-type (`154acd676d`). One shared part, `components/search-add.tsx` + `search-add.module.css`.

- **Which lists got it** (the separate ＋ Add beside the search is gone on each):
  Guests › List (`guests-screen.tsx`) · the couple's Suppliers › Find (`find-thumb-row.tsx`) · the supplier's Clients
  (`clients-search.tsx`, through `app/_components/search-box.tsx`). Every other search is untouched — a field with no
  `onAdd` draws its plain magnifier and has no mode. Guests › Map keeps its own ＋ Add guest (its field only finds a
  seat).
- **The rule**: 🔍 while something matches or the box is empty · ＋ by itself when nothing matches · a tap on 🔍 over
  words switches it to ＋ · as ＋, a tap on it or Enter adds what was typed · **＋ holds until the box is cleared** —
  words that match again do not turn it back (`searchAddHeld`).
- **Every way the removed buttons opened is still there**: Guests' "From your people" / "Import a file" stand above the
  empty field while it has the cursor and in the typed results; Clients' "Add a booking from outside" is a row at the
  empty search and the sheet opens with the typed name in it; Suppliers' "Add your own" is the first row of the empty
  box's panel.
- **The morph** (the approved drawing `search-to-add-morph`, its geometry stroke for stroke): ① the circle grows into
  the button outline (Quick) ② the handle grows through the centre and a second line crosses it — an X (Quick) ③ the X
  turns 45° into ＋ (Move), all on Settle; back is the exact reverse. Played by transitions on `data-mode` with the
  `--sn-m-*` tokens, so it never plays on the first drawing and turns around mid-move; transform / opacity / the
  stroke's dash on one 22 px svg. Reduced motion: it swaps at once.
- **Colour**: search is ink (`--color-ink`); add is the CTA red (`--color-mulberry`) on the icon AND the typed words.
- **The press**: the icon is a 44 px button that never takes the cursor (pointerdown and mousedown refused). A finger's
  press is its touchend, not the click — measured in WebKit under touch, a refused pointerdown took the click with it
  and 🔍 never became ＋.
- 🔒 `apps/web/lib/a-search-that-adds-shows-add.test.ts` — nine properties, sabotaged eleven ways (each red, then
  restored). One sabotage stayed green on the first run (`/color:/` matched inside `caret-color:`); fixed in the guard.

**The one Show-and-sort button** (owner 19 Nov: *"just one: show and sort"*; his final pick of its look the same day).
On the four lists — Guests › List, Guests › Map, Suppliers › Find, Clients — the ONE control after the search now wears
one shared face, `components/sort-face.tsx`: lucide `SlidersHorizontal`, icon only, in the thumb row's own 44 px round
(the circle the search rests as), a small mulberry dot at its top-right only while something is not the default, named
"Show and sort" / "Show and sort · changed" (`sortLabel`). Each list keeps its own shipped choices and its own "is
anything not the default" measure — no option was added, removed or renamed.
🔒 `apps/web/lib/show-and-sort-is-one-button.test.ts` — five properties, sabotaged seven ways (each red, then restored).

NOT DONE, ON PURPOSE — needs the owner's word: "one PickMenu with a Show group then a Sort group". Guests › Map and
Suppliers › Find already open one PickMenu; Guests › List and Clients open the approved Show & sort SHEET (3 Nov; v113),
which also holds +1s, per-service counts, Group by, Schedule, Service, Status, Client and Handled by. Folding those two
into a two-group menu would remove those controls, and no ruling lists them as removed. Nor did any of the four rows
have two pills ("▽ All" · "⇅ Sort") to merge — each already had one round.

NOT PROVEN: a real iPhone's keyboard staying up through the icon tap (headless WebKit and Chromium with touch only).

SPEC IMPACT: None — implements the owner's 18–19 Nov rulings and the approved drawing as given; the copy changes are
two help / tour lines that named the removed ＋ button (`lib/help/supplier-2.ts`, `lib/tours.ts`).
