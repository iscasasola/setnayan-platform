## 2026-11-22 · fix(guests): drawing v4 polish after a Fable review — the summary adds up, March reads like the program, the card's Saved row goes

A design review of the BUILT Guests page by Fable against the approved drawing
(`prototypes/guests_redesign_2026-11-20/guests_redesign_2026-11-20_fable.html`) and the house standard; only the
findings that are drawing parity or a house-standard break, in files outside the Spaces train. Stacked on #8152.

- **The summary's words add up.** "32 guests · 13 coming · 4 can't come · 13 no reply" left 2 guests unnamed: Maybes
  kept from before Maybe was retired (owner 2026-09-30). They are named now — "· 2 maybe", only when there are any —
  counted by the same filter its tap opens (`ReplyFilter` gains `maybe`; `rosterStats().maybe`).
- **No dead band under the top row** (List, Seats, March): the page's title group held only an sr-only h1 yet, as a
  flex item, cost the section's 24 px gap; it is `display: contents` now (page, offline copy, lab).
- **List:** headings read "BRIDE & GROOM 2" (no dot); the "Drag the box right…" hint is an unframed line on a band of
  the page colour (a framed pill read as pressable and still hid a result); on a computer every row ends on one right
  edge (a row that cannot be removed keeps the hover-Delete column's room).
- **March (Guests):** headings bold in the accent word, tight to their walks; one white frame for every name (the
  groom's gold border read as "selected"); every walker captioned with their role in the couple's words, never what the
  heading already says (`marchCaption`, view-only — the printed march is untouched); "not walking" no longer
  underlined; the count line on the gutter, on the type scale. The adding line wraps, is shorter, and says "nobody by
  that name" in the danger colour.
- **Guest card:** no row that held only "✓ Saved" — it sits on the About line; a refused read ("Couldn't read their
  seat") wears the warn colour; group labels and chevrons are grey (house standard: gold never on small text); the ✕
  keeps its round in dark.
- Lab: the card's Daniel is the best man, as on the lab's List.

Guard: `guests/_components/the-v4-polish-holds.test.ts` (5 tests, each sabotage-checked red). Proof beside the drawing:
`build-sessions/shots-guests-v4-polish-2026-11-22/`. No migration, no server action, no new read.

SPEC IMPACT: None — parity with the approved drawing and the house standard; the beyond-the-drawing proposals are
listed for the owner in the PR, not built.
