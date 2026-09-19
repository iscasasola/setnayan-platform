## 2026-09-19 · fix(shop-page): a pinned review shows first even when it is older than the newest 5 (S43 · 4)

The public shop page (`app/v/[slug]/page.tsx`) loads the newest 5 reviews and
floated the Pro pinned review to the top **only if it was already in that
window** — its own comment said an older pin "simply isn't surfaced". Pinning
the review a supplier is proudest of, usually an older one, changed nothing.

Now, when the pin is outside the window, the page fetches it on its own
(`fetchReviewForVendorWithCouple` in `lib/reviews.ts`, scoped to this vendor, so
a stale or foreign id still does nothing) and `pinReviewFirst` puts it first,
never twice. A refused read is logged and the list renders unpinned. The pin
stays a Pro perk.

Guard: `lib/the-pinned-review-reaches-the-page.test.ts`.

SPEC IMPACT: None.
