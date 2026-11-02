## 2026-09-19 · fix(card-maker): the first-card intro sample shows only what a supplier can write, in words for every trade (S43 · 6)

The card maker's one-time intro (`canvas-maker.tsx`, sheet `canvas-intro`)
showed a photographer's card ("Kuya Dan Photo & Video") promising a free
"engagement mini-shoot" as a Setnayan Exclusive. That free-text perk was retired
on 2026-09-09 and no supplier can author it. The same screen also told a new
shop "the price can wait", but a starting price is a publish requirement, and
said "two answers" go live when the gate asks for three (cover · price ·
inclusions).

Now the sample is a trade-neutral card, labelled "A sample card", built only
from fields the maker has: title, starting price, an "Includes" line, and the
one shared `SetnayanGiftLine` (optional yes/no). The bullets say a starting
price and inclusions are what couples see, and that the gift is optional. The
go-live line names the three requirements.

Guards: new `services/the-card-maker-sample-is-honest.test.ts` (red on the old
copy, and ties the go-live line to `PUBLISH_REQUIREMENTS`).
`kind-is-a-field-on-the-card.test.ts` keeps its "the explainer shows a card"
property with the new price and label.

SPEC IMPACT: None.
