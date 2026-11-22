## 2026-11-13 · fix(supplier-walk): the Shop screen agrees with itself · supplier words on their own quote · no guessed headcount · a sent quote is a price

Four live faults from the controller's walk of SetnaProd (supplier side) and one from the couple side, each measured on prod:

- **Analytics count cards printed a held 0** beside their own true line ("Opened 0 … 127 couples opened", "Asked 0 … 1 couple asked"). `HeldCount` inside an unseen card printed 0 in the server HTML, a hidden tab and the a11y tree. Unseen, the figure now prints the true number; the count-up still runs when the card is seen.
- **"What couples say" read every review** (`vendor_activity_stats.review_count` = 3, all `booked_through_setnayan = false`) while the cover, the Rating badge and the public page read the trusted stat (0) — "4.2 ★ · 3 reviews" and "No reviews yet" on one screen. The card now reads the trusted stat (`trustedRating`), the one source.
- **Supplier's own quote page said the couple's line** "Accepting shortlists them…". `quoteNoteShown` takes the viewer (the page's existing `isVendorSide`); the supplier reads "When the couple accepts, you are on their shortlist at this price…". Couple view unchanged.
- **Quote maker guessed 100 pax** with no guest list (`requestedPax={… ?? 100}`). No count at all → `null`; the headcount field starts empty and asks the supplier to type it. The couple's estimate (`events.estimated_pax`) already reaches it through `resolveLivePax`.
- **Couple bench card said "Price on request" / "Ask for a price" beside "Quoted ₱6,750"**. `withLiveQuotes` takes the standing line's own quote amount (no new read) as the card's price basis when it has none, so the card offers Add and never says "Price on request".

Not changed: the cover's "0 events" is true (events finished on Setnayan = 0). No ChunkLoadError was found in Vercel logs or `app_telemetry_logs`; nothing speculative added.

SPEC IMPACT: None
