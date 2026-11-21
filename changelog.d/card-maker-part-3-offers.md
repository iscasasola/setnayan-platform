## 2026-11-19 · feat(supplier): Card Maker part 3 — the shop's offers on the card

v36 Decided "Offer" ("Several can be loaded; couples see the best one" · "made in the step … no jump to another
screen"), built by EXTENDING the shipped one-page maker (ruling 280d53a9). The Offer Maker stays the one place an
offer is made; the card now shows which offers reach it and moves itself in or out.

- **More settings › Shop offers** (Edit only — the card must exist): each offer on this card with what it gives and
  "On all your cards" · "Also on N other cards" · "Only on this card". **Take off** removes this card from the offer
  (an all-cards offer becomes every other card); on an offer only on this card the button is **Switch off**,
  because the Offer Maker refuses an offer with no card. **Put an offer on this card** is one dropdown of the
  others. **＋ New offer** opens the shipped Offer Maker with this card picked (`?maker=offers&new=card&card=`).
- Every change saves in place with Undo; the screen never resets.
- **No new server action, no new read path:** it calls the shipped `offerMaker` dispatcher (`load`, `save`,
  `switch`), so the Offer Maker's lock (`canUse('offerMaker')`, Verified only) and checks (`offerProblem`) apply
  as they are. Below Verified the row shows the shared lock (Problem → Solution).
- The read happens the first time the fold opens, never on page load. A refused read says so, with Try again —
  never "none".
- Rules in `lib/card-shop-offers.ts`; guard `lib/card-shop-offers.test.ts`. Lab: `/dev/card-maker-lab?view=shop-offers`
  (`&offers=none|unread|locked`).

SPEC IMPACT: None — implements v36 Decided "Offer" on the one-page maker; no ruling changed.
