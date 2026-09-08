## 2026-09-08 · feat(vendor): the card list shows the actual service card

Owner, looking at his two service cards rendered as grey wrench glyphs with one
line of text: *"we want to show the actual service cards."*

The real card — cover, discount badge, inclusions, the Setnayan Exclusive teaser,
the "Request a quote" button — already existed. It lived inside the collapsed
"Edit details" editor, drawn by `ServiceCardLivePreview`, whose own docblock
carries the earlier form of the same instruction: *"when we create a service
card, we want to see the exact card."* That instruction had reached the editor
and never the list.

### One card, drawn once

The obvious fix was a second renderer for the list, and it was the wrong one. A
card is a promise about what a couple sees; two implementations of "from ₱X", of
which discount wins, of what counts as not-included, agree on the day they are
written and drift at the first pricing change.

- `apps/web/lib/service-card-snapshot.ts` — the READING half, moved out whole.
  `snapshotFromService()` assembles a FormData with the editor's own field names
  and hands it to the very same `readSnapshot`. The list is a caller, not a copy.
- `apps/web/app/vendor-dashboard/services/_components/service-card-face.tsx` —
  the DRAWING half, moved out whole. No state, no effects, no form access, so it
  renders on the server in the list and inside the live form in the editor.
- `ServiceCardLivePreview` is now the live-mirroring wrapper and nothing else.

The supplier-only facts — assigned-to, coverage, hidden, reach — stay, beneath
the card. They are not on the couple's card and never should be, but they are
what a shop scans a list for.

### And nothing offers a choice the gate refuses

The maker's price region read *"Add a price — couples look for it first. **Or
leave it as price-on-request.**"* while `PUBLISH_REQUIREMENTS` has included
`'price'` since the owner drew the rule on 2026-08-28
(`prototypes/shop_rooms_made_easy_2026-08-28.html`: *"Publish stays shut until
the price is in"*), enforced by the `enforce_service_publish_gate` trigger. A
live card left at price-on-request could not be saved at all, and the refusal
named a field the copy had just called optional.

🔑 **The copy was the stale half, not the gate** — the gate is a dated owner
decision with a prototype behind it; the sentence was an older promise nobody
retired. The guard fails if the offer returns *while* the requirement stands, and
lets it back in automatically if the requirement is ever dropped.

`apps/web/lib/the-list-shows-the-real-card.test.ts` proves the two snapshot paths
produce a deep-equal result for identical input, that an unchecked "included"
flag is omitted rather than sent as `'false'`, that a priceless card still draws,
and that neither surface hand-draws a card. Mutation-tested five ways.

SPEC IMPACT: None.
