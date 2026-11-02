## 2026-08-28 · feat(vendor-services): a published service card must carry a price

**What a person gets.** A shop can no longer publish a service card with no
price on it. The maker asks for a starting figure alongside the cover photo and
the Setnayan Exclusive, the card's own meter counts it as missing until it is
there, and Publish stays shut. Saving a draft is never refused.

**Why.** A couple's budget is matched against the card's declared figure. A card
carrying no number has nothing to match, so the shop that publishes one is
invisible to exactly the couples it was made for. Production holds 2 cards and
0 prices, because the field was optional.

- **NEW `apps/web/lib/service-publish-gate.ts`** — the one place that answers
  "may this card go live?". The answer used to be written in five places that
  could not see each other, and they already disagreed: the wizard required a
  cover photo the server never asked for.
- **NEW migration `20271176775619_a_card_that_can_be_found.sql`** — the fence.
  `vendor_services` carries a PERMISSIVE `FOR ALL` policy on "this row is yours"
  and `authenticated` holds UPDATE on all 40 of its columns, so a shop can PATCH
  `is_active` through PostgREST and meet no TypeScript at all — publishing past
  the price gate AND past the Setnayan Exclusive gate that has shipped since day
  one. A `BEFORE INSERT OR UPDATE` trigger refuses both.
- The trigger judges **the act of publishing**, and any statement that empties
  one of the two fields on a live card — never the mere state of a live row.
  `merge_canonical_service()` rewrites `category` on every live card when an
  admin folds one trade into another, so a blanket rule would have made an
  unrelated admin act fail on somebody else's legacy row.
- **`card-health.ts` moves `no_price` from HINT to BLOCKER**, which shuts the
  canvas maker's Publish button, puts the price in the coach line and caps the
  score at 30. This reverses that module's own documented rule ("quote on
  request is a real answer") — an engineering rationale, never an owner lock.
- **The first pass grew the same question.** It asked the two things the gate
  required; the gate now requires three. A pass one question short hands a
  supplier a finished-looking card and a shut button.
- **ZERO IS NOT A PRICE.** `parseInt0OrNull` accepts a typed `0`, so the card
  rendered "₱0 flat" and reported itself priced while the save stored a 0. The
  screen and the gate disagreed by exactly one value.
- **A read error now fails closed** on the Services-list on/off switch. Supabase
  resolves with `{ error }` rather than throwing, so an unreadable row used to
  reach `perk === undefined` and be refused for the wrong reason; it is refused
  deliberately now, and says so.
- 14 unit tests + 9 db tests. 14 mutations, every one measured before → after,
  every one RED. The migration was dry-run against production inside a
  self-rolling-back transaction; prod verified afterwards to hold the same 2
  rows, no trigger, no function.

⚠ **The card-health meter ships behind `NEXT_PUBLIC_CANVAS_MAKER_ENABLED`,
which defaults OFF.** Its value in production is not readable from a session (it
is read in a server component, so it never inlines into a client bundle). With
the flag off, a shop making a card gets the 6-step wizard — which is why the
wizard's Publish button and its recap were taught the same rule rather than left
to the server to bounce.

SPEC IMPACT: `DECISION_LOG.md` — a published service card requires a starting
price (owner-drawn 2026-08-28, `prototypes/shop_rooms_made_easy_2026-08-28.html`),
reversing the "quote on request is a real answer" rationale in `lib/card-health.ts`.
