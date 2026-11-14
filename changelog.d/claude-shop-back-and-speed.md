## 2026-11-14 · fix(shop): the shop's Back returns where you came from

- A shop opened from search now goes **Back to results** with the same words in the box (`?q=` rides along).
- A shop opened from any other page (a supplier credit on the Event Hub, the day-of help card, the booth, the
  mood-board picker, a profile, the creator page, a saved card) now goes **Back** to that page. One `ShopLink`
  carries the page you were on, checked to be one of our own paths. **Home** stays only for a cold arrival.
- Guards: `a-shop-back-returns-to-its-origin` and the updated `shop-back`.

SPEC IMPACT: None — restores the approved back behaviour; the shop's speed half follows in its own change.
