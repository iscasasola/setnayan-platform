## 2026-11-20 · fix(card-maker): review fixes on the Card Maker batch — Last-minute boxes, flat price, the Templates tile

- **Last-minute boxes** are 72 px, as wide as Book ahead, so "mo" and "+%" are no longer clipped (review Gap 9).
- **Flat price is one number,** as the HYBRID drawing rules (*"On Price: 'Price covers' on a flat price"* is in its removes list). A card that already carries a guest cover or an extra-guest price keeps both rows, so saving it never silently drops that charge (review Gap 5).
- **The Shop tile reads "Templates",** the word on the approved drawing (it read "Saved templates"; a look call, decided by the controller).

Guard: `services/_components/a-flat-price-is-one-number.test.ts` (sabotage-checked).

SPEC IMPACT: None — matches the approved HYBRID drawing (`prototypes/service_card_maker_HYBRID_2026-11-17_fable.html`).
