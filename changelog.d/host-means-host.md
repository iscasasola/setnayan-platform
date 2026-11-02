## 2026-08-27 · fix(security): "host" means host — a QR-scan guest was not one

`lib/slug-access.ts`'s `isSignedInEventHost` selected `event_members.member_type`
and **never compared it**, returning `Boolean(memberRow)`. `event_members` is the
event's people table, not a host table — `'guest'` is one of its values, written
by the event-QR scan-to-join, the cookie link and the cross-device magic link. So
**any signed-in member, including a guest who merely scanned the event QR, read as
a HOST**: through the private gate on all seven `/{slug}` sub-routes, and past
`who-can-see-your-story.ts`, which answers true for a host **before** it tests the
audience — letting them read the couple's unfinished keepsake story months before
it is published.

This is the exact bug `app/[slug]/_lib/host-scope.ts` was written to kill. The
twin (`loadHostMembership`) was fixed and pinned; **this clone never inherited
it.** Both now filter on the one shared `HOST_MEMBER_TYPES`.

**The seat-holder arm ships in the same commit, and had to.** Narrowing "host"
unmasked a divergence it was hiding: `app/[slug]/page.tsx` admits a signed-in
seat-holder on `private`, the shared gate never grew that arm. Without it, every
invited guest whose 60-day cookie has expired — the ordinary case, since
save-the-dates go out 6–12 months ahead — would start being bounced off all seven
sub-routes. `canViewSlugEvent` now admits a seat-holder on **both** closed
visibilities, page-only, minting no guest session.

Guard `lib/host-means-host.test.ts` pins BOTH twins and BOTH gates by source, and
each assertion is mutation-verified by occurrence count (filter 1 → 0 · gate arm
1 → 0 · page arm 2 → 0, all RED).

FLAGGED, NOT FIXED (separate change): `app/[slug]/print/page.tsx:133` still
hardcodes `belongsToEvent: true`.

SPEC IMPACT: None — this is a repair to shipped code, not a product decision. The
unbuilt supplier room from `WHATS_NEXT_Vendor_Hub_And_Answers_2026-08-26.md` is
deliberately untouched.
