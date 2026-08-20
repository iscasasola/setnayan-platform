## 2026-08-20 · feat(front-door): the search answers on the home page, not the marketplace

Owner, pointing at the front door's own body: *"the search bar should run search
results on the [main] part? this search bar will be specifically for the Home."*

**The evidence was worse than the complaint.** Every search — the signed-out
public box and the signed-in palette's escape row — was handed to the supplier
marketplace, which leads with its vendor verdict. Measured on the live site the
same day, `/explore?q=doves` rendered, in this order:

> No vendors match exactly. Try widening your search or clearing one filter at a time.
>
> *…and below it:* Stories and guides — "The release of doves: a Filipino wedding tradition"

A box promising "suppliers, stories and guides" answered a story query with a
failure about suppliers and put the thing it found underneath. Prod holds two
shops, so the marketplace could not lead well on anything.

**What changed.** `/` reads `?q=` and renders the answer in its own body, in the
front door's existing card family (nothing new was drawn — every class already
ships). Three sections: the searcher's own events and spaces, the shops the
front page already publishes, and the reading. Both search controls — the public
GET form and the palette's escape row — now land on that one page, so a member
and a stranger typing the same words reach the same answer.

**What deliberately did not change.** `/explore` keeps its own search box, its
word-bridge, its filters and all 192 categories, and every results page carries
a permanent row handing the typed words to it. The supplier match on the front
door is names and cities over the shops it already publishes — it does NOT
re-implement the marketplace pipeline, because that would be a second definition
of who may be shown, and the direction it drifts in is a hidden shop rendered on
the front page.

- The live-shop visibility gate (`public_visibility='verified'` AND
  `verification_state='verified'`) is now written ONCE and applied by all three
  reads (shelf count, shelf rows, search) via `.match(LIVE_SHOP_GATE)`.
- A pre-existing invariant caught this change and was updated with its premise
  recorded, not relaxed.
- New guard `search-answers-here.test.ts` — 6 assertions, each mutation-checked
  by occurrence count: the box's destination, the row's destination, the page
  reading `?q=`, all three nouns resolved by the page that answers, the
  marketplace row being permanent rather than an empty state, and one gate.
- Indexing is unaffected: `metadata.alternates.canonical` is the bare `/`, so
  every `?q=` url canonicalizes to the front page.

SPEC IMPACT: None — no locked price, SKU, scope or schema. Behaviour of an
existing control, pre-launch.
