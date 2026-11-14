## 2026-11-14 · fix(offers): OWN-01 — a "first N couples" offer counts its earlier uses

- **OWN-01 (money, live 5cbf166)** Liwanag's December "first 1 couple" ₱5,000 offer went on a second couple's quote
  (S89J-VBT0P4MJPD) an hour after the first (S89J-3YAPVHGQYH). Two causes, both measured: `vendor_offers.first_n_taken`
  had no writer (its own column comment said so), so every cap compared against 0; and a quote started from a service
  card carried the card's offer as a plain "Discount" line that named no offer.
  - The maker now stamps that Discount `from_offer_id` (only while it is the card's figure, untouched — a typed figure
    clears it); the send keeps it (`lineStructureOf`) and a revision keeps it as the Discount (`discountOfferId`).
  - Migration `20271346038449`: an offer's uses are the OTHER couples whose live quote (sent · viewed · accepted)
    carries it (`offer_id` or `from_offer_id`) — counted, never typed. A quote newly sent with, or newly gaining, a
    used-up "first N" offer is refused (`OFFER_TAKEN`); a quote that already carries it is never refused later. After
    every change `first_n_taken` is recomputed, so the card, the Offer Maker and the dropped-offer apply all close the
    offer at its cap with no reader changed.
  - The supplier is told in words: "An offer on this quote was for the first couples only, and they already have it.
    Take the offer off, then send — nothing was sent."
  - ⚠ Quotes sent before this carry no `from_offer_id` and are not counted (the two on record are the owner's test shop).
- **OWN-02** The shop's Inquire sheet dropped an ask in silence: closing it during "Sending in N s…" cleared the timer
  and closed — nothing sent, and its last words were "Sending". Undo is the one way not to send now; closing sends at
  once and the sheet stays to say whether it went. Back from "Start a new event", the event just made is picked (the
  sheet remembers the couple's events as they leave, in sessionStorage; two new or none → nothing is guessed).
- **OWN-03** On a supplier's event lines, "They added this to their plan" sat beside services the couple never
  picked: "their plan" counted the shop's OWN row, which the inquiry itself wrote under the first pick's category. It
  now counts only the couple's rows. The Celebrant read "Someone —": a birthday "for you" saved the account's display
  name as the celebrant, and that name was the stand-in. The account name now passes `realNameOrNull` at the source
  (`lib/self-personalization.ts`), and the supplier's Celebrant line refuses a stand-in when reading it back.
  The event already saved with it reads "Not named yet" now.
- Guards: `apps/web/lib/a-supplier-reads-the-couples-own-plan.test.ts` ·
  `apps/web/lib/an-inquiry-never-drops-in-silence.test.ts` ·
  `apps/web/tests/db/a-first-n-offer-counts-its-earlier-uses.db.test.ts` (sabotage: the refusal removed → the
  second couple is let through, red) · `apps/web/lib/a-first-n-offer-names-the-couple-who-has-it.test.ts`.

SPEC IMPACT: None.
