## 2026-10-18 · fix(dress-code): a role holding one look is centred, like a lone person in the wedding march

Owner, 2026-10-18: *"dresscode should also adapt center like wedding march"*. On the Dress code scene a role row that
holds ONE look (the bride, the groom, a crew dressed alike, a guests' row with one option) drew its figure on the left
with its words beside it. It now draws as the march draws a lone walker (`entourage-section.tsx` `PairRow`): the row's
heading centred, the figure centred, its Wear and colours (and their words) stacked under it and centred, at the same
figure size and type as a pair's column. The reader's own look (Welcome "you" panel, Me › What to wear) is centred the
same way when it is one look. Rows and readers with two looks are unchanged. Every palette look centres inside a lone
look (`globals.css`, `[data-dress-code-lone]`); Paint strokes keep their cascade.

Guard: `apps/web/lib/a-lone-look-in-the-dress-code-is-centred.test.ts` (every palette look × lone/paired/options rows ×
the reader's one/two looks; sabotage → red).

SPEC IMPACT: None — applies the owner's 2026-10-17 lone-person ruling (DECISION_LOG "A LONE PERSON IN THE ENTOURAGE /
WEDDING MARCH / STANDING WITH US IS CENTRED") to the Dress code, per his 2026-10-18 word.
