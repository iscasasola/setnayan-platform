## 2026-08-28 · fix(vendor): "+ Create service card" opens the maker, not a page of links to it

Owner, pressing it in his own Shop: *"when i click create service card. i just bounces to a page
for a link to service card. we want it to directly go to a page to create a service card."*

**What changed for a supplier.** One press now opens the card itself. The kind of service is asked
for ON the card — the first region, above the name — instead of being chosen from a drawer on the
way there. Publish and Save-as-draft both wait until it is answered, and say so.

**What did NOT change.** `/vendor-dashboard/services/new/[category]` is untouched and still serves
the claim flow (`?claim=`), "start from one of your cards" (`?from=`) and every existing deep link;
it passes no options, so that screen has no chooser at all. My Shop's picker drawer stays exactly
where it is — it is also the fallback the new route redirects to when the canvas maker is switched
off, because the 6-step wizard takes its category from the ROUTE and has nowhere to ask for one.

**One maker, not two.** The new route renders the same `<CanvasMaker>` and posts the same
`commitVendorService` with the same field names — the category is state behind the same single
hidden input, so the server cannot tell which door drew the screen. `canvas-field-parity` still
passes untouched.

🔒 The draft button is the one that would have bitten: it has no health gate, and the action parses
the category on both paths and throws on an empty one — an enabled button would have handed the
vendor a raw database sentence for a question the card never asked out loud.

🛡 New guard `app/vendor-dashboard/services/kind-is-a-field-on-the-card.test.ts` — 6 assertions,
**7 mutations, every one printed before → after and every one RED**: posting the prop again ·
unlocking the draft button · publish no longer waiting · the pricing basis drawn for the old prop ·
the bundle list unfiltered (a card offered as bundling itself) · the new door not handing over the
kinds · the old door growing a chooser. The two existing guards were updated rather than deleted:
they now pin the destination KIND ("the press opens the maker") and that the maker route is a real
page rendering the card — *existing is not the same as reachable*, one level up.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-28 row.
