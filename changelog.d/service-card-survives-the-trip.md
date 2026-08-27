## 2026-08-28 · fix(vendor): a published card's own name never reached the couple

The public shop page's "Services & pricing" card (`toServiceCard` in
`app/v/[slug]/page.tsx`) never read `vendor_services.title` — it always showed
the bare category ("Photography") instead of the name the vendor typed in the
maker, for every published card, regardless of whether a title was set. The
maker's own live preview claims "exactly what couples see"; it was not.

A second copy of the same bug rode along: for a CUSTOM (non-canonical)
category, the same lines and four siblings (the inquiry-composer label
helper, the "also ask about" categoryLabel, the linked-services chips, and
two JSON-LD `Service` entries Google reads) printed the raw stored category
key instead of routing through `displayServiceLabel` — the exact
"never print a database key at a couple" rule that function exists to
enforce. All six sites now go through one path: `title?.trim() ||
displayServiceLabel(category)`.

Also removed a hardcoded, always-shown "★ 4.5" from the maker's live card
preview — the real card only ever shows a rating once the shop has a real
review, labelled "shop rating"; the preview was showing every vendor praise
their card had not earned.

New guard: `app/v/[slug]/service-card-shows-its-title.test.ts` — pins the
title-first fallback on both label sites and bans the
`isCanonicalService(x) ? displayServiceLabel(x) : x` shape that silently
un-fixes the raw-key bug. Mutation-verified: reverting the fix flips 2 of 4
assertions red.

Flagged, not decided (owner territory — changes what a couple is promised):
the maker's live preview promises a "Setnayan Exclusive inside · unlocked in
chat" teaser on every card that has one set (and every published card has one
— it's in the publish gate); the real public card and details sheet show
nothing about it at all, on purpose, per `service-details-sheet.tsx`'s own
docblock. Whether the public card should carry that same one-line teaser (not
the perk text itself) is a call about the vendor's incentive design, not a
bug fix.

SPEC IMPACT: None.
