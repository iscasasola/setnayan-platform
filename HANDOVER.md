# HANDOVER — rd/dress-code-lone-centred · started 2026-10-18 ~02:05 PHT by the controller

Owner, 2026-10-18, verbatim: "dresscode should also adapt center like wedding march".

MEASURED ON LIVE (cale-ice, 375 px, controller): Dress with us → role rows. A row with ONE look (Bride, Groom,
Bridesmaids, Groomsmen — `data-dress-code-people="1"`) draws figure LEFT + words/colours beside it, left-aligned. A row
with two looks (Parents & Immediate Family …) draws two columns, figure above its words. The wedding march ("Standing
with us", app/[slug]/_components/entourage-section.tsx) centres a lone person (held by lib/a-lone-person-is-centred.test.ts,
docblock "ONE ROW — one walk, or one person alone").

BUILD (extend, do not redraw — app/[slug]/_components/dress-code-widget.tsx, the `everyone.rows` list + the guest's own
"mine" look): a row with ONE look is CENTRED the way the march centres a lone person — the figure centred, its words
(style name, colour dots, dot words) stacked beneath it and centred, same figure size/type scale as a pair column.
Rows with two looks stay exactly as they are. Match the march for the row heading (read how entourage-section treats a
heading over a lone person and do the same). Options rows (`options`) unchanged unless they hold a single look.
Must hold in every palette look (dress-code-palette-looks.tsx), light + dark, the Maker canvas and the lab.
Guard: a test like a-lone-person-is-centred for the dress code (one look → centred; two → two columns) + sabotage.
Proof: 375 px WebKit iPhone 13 shots before/after (lab sample with lone + paired rows), light + dark, into
~/Documents/Claude/Projects/shots-2026-10-18/<pr>/. Changelog fragment changelog.d/rd-dress-code-lone-centred.md.

## STATE (builder, 2026-10-18)
- [x] Code: `dress-code-widget.tsx` (`lone` rows: li text-center, people flex-col items-center, person flex-col items-center
  text-center + `data-dress-code-lone`; `RowDots`/`PaletteLookList`/`DotWords` take `centre`; the reader's own look is
  `mineLook` — centred block when `mineDots.length === 1`), `dress-code-palette-looks.tsx`, `globals.css` (lone rule).
- [x] Guard `lib/a-lone-look-in-the-dress-code-is-centred.test.ts` — 17/17 green.
- [ ] Sabotage · shots (lab `?attire=cale-now`, palette look via `lab_widgets` cookie) · lints · PR · CI.
DECISIONS: the lone row's HEADING (and note) is centred too — the march's default look (On the axis) centres a group's
heading over a lone walker; pair rows keep their left heading (unchanged, per spec). The reader's own panel keeps its
text lines (You are · call time · Wear) where they were; only its figure + colours are centred (a redraw otherwise).
