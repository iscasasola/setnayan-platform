## 2026-07-23 · feat(vendor): Booking Fee PR-0 — marketplace attribution (explore/search)

First slice of the Booking Fee build (`Booking_Fee_Build_Plan_2026-07-21.md` §PR-0):
the fee is only owed on Setnayan-SOURCED bookings, so an organic marketplace
discovery must be distinguishable from a bare direct hit. Today both land as
`inquiry_source = NULL`. Purely additive, no behaviour change beyond stamping.

- **Migration `20270917000000`** — add `explore` + `search` to the
  `chat_threads.inquiry_source` CHECK (drop-if-exists the auto-named constraint,
  re-add with the expanded list). Existing/NULL rows untouched — never retro-billed.
- **`lib/inquiry-source.ts`** — `explore`/`search` added to `INQUIRY_SOURCES` +
  labels (they auto-pass the existing client-declared-source whitelist since
  they're neither `influencer` nor `degree`).
- **`app/v/[slug]/page.tsx`** — the `?src=` → `inquirySource` map now recognises
  `explore`/`search` (was `editorial`/`favorites` only).
- **Explore card / folder section / compare** — `/v/[slug]` links now carry
  `?src=explore` so `stampThreadProvenance` records the origin on brand-new threads.

⚠ The attribution FREEZE point (first proposal send) and the billable use of this
signal don't exist yet — this only ensures the origin is *recorded* now, so threads
carry a usable source when the fee turns on later. No fee is computed or charged.

SPEC IMPACT: None (implements the model's SOURCED-vs-import attribution, already
specced). DECISION_LOG 2026-07-23.
