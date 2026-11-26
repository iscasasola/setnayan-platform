## 2026-11-25 · fix(shop page): final check area 1, batch a1-a3-shop

Lane A fixes on the public shop page and its sub-pages.

- **A1-127:** Share always ends in a result: shared, copied, or a toast "Couldn't copy the link on this device. Press Share to try again." No clipboard is a failure, not a false "Copied"; closing the share sheet is not.
- **A1-123:** a package saved at ₱0 reads "Price on request", never "₱0".
- **A1-129:** a refused rating read (`fetchTrustedReviewStatsRead`) says "Couldn't load the rating", never "none yet".
- **A1-130:** "Show more reviews" stops when the public list runs out.
- **A1-131:** an unverified shop hands its service cards no reviews or stars.
- **A1-139:** only a verified Trusted partner wears the check badge.
- **A1-126, A1-136:** the 3D booth has a way back to the shop; an expired paid plan is Free there (`effectiveSeoTier`).
- **A1-133, A1-134, A1-135:** the guest review page gives a shop a stranger cannot open the same 404 (never its real name), reads "this wedding" / "Thank you" when a name is missing, and uses `BOOKED_EVENT_VENDOR_STATUSES`.
- **A1-132:** the story page lists only reviews a public page may list (`vendor_reviews_public`).
- **A1-140:** pesos on the shop page and the verified median go through `lib/php.ts`.
- **A1-137:** review words fit every event: "Recent events", "Events at your venue", "Verified event", "From hosts who booked …".

SPEC IMPACT: None — words and honest states only; A1-138 (award names) is the owner's call.
