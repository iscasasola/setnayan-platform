## 2026-11-15 · fix(event-dash): the owner's six answers, built — a shop typed by name shows, "Shop · Name" on a reply, "New" only with no bookings (CYC-05 · CYC-16 · CYC-15b)

This builds the owner's answers to C2's six open questions (2026-11-15, specs DECISION_LOG e8650540, "C2's SIX OPEN
QUESTIONS — ANSWERED"):

- **CYC-05** A shop found by typing its NAME shows even when the event types it lists don't cover the event, e.g. a
  weddings-only shop for a birthday. In `fetchWizardVendorRecommendations`, the event-type scope admits
  `business_name.ilike.%<typed>%` (`nameMatchesFilter`) only while a name is typed. Browsing a category, and every
  other filter, still goes by what the shop serves.
- **CYC-16** A supplier's chat reply on the couple side is signed "Shop · Name" (e.g. "Liwanag · Ana"). This replaces
  the 28 Oct name-only rule. `readThreadReceipts` takes `shopName` and returns `shopSignature`; a co-host keeps their
  own name. The stream is untouched (`chat-message-stream.tsx` is held by #7713 and #7632); it draws the signature
  it is handed.
- **CYC-15b** "New to Setnayan" shows only on a shop with NO confirmed bookings (`CONFIRMED_VENDOR_STATUSES`). A shop
  with bookings and no reviews says "No reviews yet" (`NO_REVIEWS_YET_LABEL`). Both Find feeds count bookings in the
  same round trip: the Suppliers page enrichment and `category-search.ts`. A refused count is unknown (null) and
  reads "No reviews yet", never "New".

Kept as built, per the same answers: F-W2-26, F-W2-22, F-W2-19.

Guard: `lib/the-six-answers-hold.test.ts`, run red against origin/main.

SPEC IMPACT: None new. This implements DECISION_LOG e8650540, which the controller already recorded in the corpus.
