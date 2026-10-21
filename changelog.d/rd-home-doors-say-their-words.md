## 2026-10-22 · feat(home, pro): Home's three doors say Guests · Suppliers · Event Hub · the Pro list names every gate Pro already had

Owner 2026-10-22, "Yes to all" — `Setnayan/prototypes/journey_fixes_2026-10-22.html` § Host 2 and § Host 5.

- **Host 2 — the doors keep their words.** `HOME_DOOR_LABELS` (`home-parts.tsx`): "Edit your Guest list · Edit your
  Suppliers · Edit your Event Hub" → **Guests · Suppliers · Event Hub** (a cover-+-photos Hub reads "Event Hub" too).
  The door pill keeps a 6 px side edge instead of the house 14 px, so the row is icon + word at 375 and word-only at
  320 (BUTTON_RULE 3a unchanged; measured in Chromium and WebKit). `fitAsOne` now also counts a clipped word as tight,
  and the pill no longer clips its own 44 px press expander (the same hunk as #6756, byte for byte).
- **Host 5 — the Pro list.** `WEBSITE_PRO_ITEMS` is the drawn list: the six gates the code already enforced join it
  (style and animation for every part · decorations · a 6th Love Story moment with photos · uploads over 10 MB · print
  files in Pro themes · one download of every guest's ticket) and the free "Editorial editing" leaves it. No gate
  moved. The two sentences that count the list ("Unlock all N", "One unlock covers all N") compute N. `PITCH` is
  partial (no invented copy for items no channel leads with). Dev-only: `/dev/home-lab?view=pro`.
- Guards: `home-doors-say-their-words.test.ts` (words = the tab's word, ≤ 2 words · a clipped word is tight · no
  clipping rule on the pill) and `lib/the-pro-list-names-only-real-gates.test.ts` (the drawn list · each added line
  held to its gate · no free line), each sabotaged red.

FLAGS (gating that disagrees with a drawn line — not changed, owner's call): "Uploads over 10 MB" — the gate is a
per-event total allowance (Free 10 MB · Pro 500 MB), not a per-file size · "A 6th Love Story moment, with photos" —
any story's photo is Pro, not only the 6th's · "One download of every guest's ticket" — every all-in-one download is
Pro (whole set, Guest QR sheet, place-card pack, Everything), not only the tickets · the buy page's `BENEFITS`
sentences still name none of the six.

SPEC IMPACT: DECISION_LOG.md row "HOME'S THREE DOORS SAY GUESTS · SUPPLIERS · EVENT HUB · THE PRO LIST NAMES EVERY
GATE" (2026-10-22) records both rulings and the four flags above.
