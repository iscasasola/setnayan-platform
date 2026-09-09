## 2026-09-10 · feat(explore): the service card carries the shop logo, and the logo opens the shop

Owner ruled it 2026-09-09, choosing it over one-destination and over logo-only:
**the card BODY opens that service's details; the LOGO opens the shop.**

SPEC IMPACT: `DECISION_LOG.md` row 2026-09-09 (two destinations on a marketplace
service card; the marketplace and the sitemap mint the bare-root shop address).

### What existed · what was missing · the delta

**Existed.** `ServiceCardView` — "THE service card, the one a couple sees" — has
shipped a doorway mode (`detailsEnabled`) since it was written: a stretched
control, a visible *View details* affordance, and the showcase clip lifted to
`z-10` so it stays usable underneath. The per-service details screen is already
linkable — `renderVendorBySlug` reads `?service=<public id>` and opens that
card's sheet on arrival — and the bare `/{slug}` route already forwards its
query through. `displayLogoUrl` is the one shipped `r2://` resolver. The vendor
sitemap already emits the bare root.

**Missing.** The card rendered no logo, and the query did not fetch one. The
whole card was ONE wrapping `<Link>` to the legacy `/v/{slug}` — one
destination, no affordance, and it swallowed the card's own `<video controls>`.

**Delta.** The query returns the shop's stored logo ref; the page resolves it
once **per shop**; the card grows two optional props (`shop`, `detailsHref`);
the wrapping link is gone.

### A third trap, found while composing with #5384

**A LEGACY `logo_url` is a URL the vendor PASTED, on any host** — and `next/image` answers **HTTP
400** for a host outside `remotePatterns`, so the picture is simply not there and nothing throws.
That has already cost a measured day here: the presigned R2 URL answered `200 image/png 34478 bytes`
while `/_next/image?url=…` answered `400`.

The rule that decides this **already existed** — privately, inside
`app/(shell)/explore/_components/vendor-card.tsx`. It is extracted to
`lib/optimizable-image-url.ts` and both cards now import the same one; the service card falls back to
the initials tile, which is a designed state rather than broken markup. **A copy was removed, not
added.** Latent today (prod's one stored logo is an `r2://` ref, which resolves to a whitelisted
host) — which is exactly how it would have stayed invisible.

### The two traps this had to walk through

**A second anchor inside the wrapping one is invalid HTML.** Browsers unnest it
and the inner link loses keyboard focus — it looks clickable and cannot be
tabbed to. Nothing throws. So the two controls are **siblings**: the stretched
doorway stays the card's last child, and the shop row is lifted above it with
`relative z-10` — the same trick the showcase clip already uses.

**`logo_url` does not hold a URL.** Anything uploaded through the shop editor is
stored as `r2://bucket/key`. Measured in production: of the two verified,
publicly-visible shops, one has exactly that shape stored. It goes through
`displayLogoUrl` and never through `publicUrlFor`, whose argument is an object
KEY and which would fold the `r2://` scheme into the object path — the defect
PR #5384 is repairing on the cover photo. No second resolver was written.

### The address the shop was promised

The supplier's own dashboard shows them `/{slug}` and calls it, verbatim, *"this
is your address for good"*. The card sent couples to `/v/{slug}`. Both resolve
and the shop page canonicalises to the bare root, so nothing was broken — but
the link a shop is shown and the link a couple is given were different strings.

⛔ **`/v/{slug}` is NOT retired and keeps resolving.** Printed QR codes and
bookmarks survive; this changes what we MINT, and removes nothing. A guard
asserts the route still exists.

⚠ The vendor sitemap **already emitted the bare root** — only its docblock still
said `/v/`, which is corrected here. A session reading that paragraph would have
"fixed" a sitemap that was already right.

### It degrades, it never dead-ends

The details sheet is behind `NEXT_PUBLIC_SERVICE_DETAILS_ENABLED`, which is off.
With the flag off `?service=` is read and ignored, so the body link lands on the
shop page — exactly where the card already sent people. The day the owner flips
the flag, the same link opens the service. **Nothing here switches a dark
feature on**, and a new assertion pins that the shop's own page still passes the
flag down rather than a hardcoded `true`.

### Measured in production before building (SELECT only)

| | |
|---|---|
| verified + publicly-visible shops | **2** |
| shops with a logo stored | **1**, and it is an `r2://` ref |
| the shop whose cards are live | has **no logo** — every card today draws the initials tile |
| live marketplace cards | **2**, both `saysay-live-band-and-hosting-fix` |
| events colliding with either shop slug | **0** |

So the visible change today is the two destinations and the initials tile; the
logo rung starts working the moment a listed shop uploads one.

### Guards, every mutation measured before → after

`lib/the-logo-opens-the-shop.test.ts` (12 tests) + one rewritten assertion and
one new test in `service-details-dark.test.ts` (9 → 10).

| mutation | count | result |
|---|---|---|
| re-wrap the card in a `<Link>` to `/v/` | 0 → 1 | **RED** (2 fails) |
| hand the RAW `r2://` ref to the card | 1 → 0 | **RED** |
| drop the shop row's `z-10` lift | 1 → 0 | **RED** |
| stop selecting `logo_url` | 2 → 0 | **RED** |
| `shopAddress` mints `/v/` again | 0 → 1 | **RED** |
| sign the logo per CARD, not per shop | 1 → 0 | **RED** |
| strip the logo link's accessible name | 1 → 0 | **RED** |
| sitemap advertises `/v/` again | 0 → 1 | **RED** |
| gallery hardcodes `detailsEnabled={true}` | 0 → 1 | **RED** |
| the Link doorway loses its flag gate | 1 → 0 | **RED** |
| **blind the comment stripper** (anti-vacuity) | 0 → 1 | **RED**, on 2 real assertions |
| the logo bypasses the host guard | 1 → 0 | **RED** |
| the host whitelist admits everything | 1 → 2 | **RED** |
| the vendor card re-grows a private copy of the rule | 0 → 1 | **RED** |
| a comment naming `/v/{slug}` **inside** the block | 0 → 1 | **green** ✔ cry-wolf |

🪤 **Four mutations first read 0 → 0 and proved nothing.** Every one was a broken
*needle*, not a sabotage that failed to land: a shell `grep` pattern containing
`${…}` and backticks, and one sabotage that APPENDS a wrapper rather than
replacing anything — so its own needle could never move. Re-measured with a
literal count on the string each one actually changes; all four then moved.

🪤 **And the anti-vacuity mutation was itself decoration on its first run.**
Blinding the stripper failed only the stripper's OWN self-test, because no
comment in the sliced regions named a forbidden string. It is real now: the call
site carries a comment naming both `/v/{slug}` and `<Link>`, the guard stays
green with the stripper working, and blinding it turns two real assertions red.

⚠ **And the stripper is no longer a private copy either.** `lib/strip-comments.ts` — the repo's ONE
string-aware lexer, whose own docblock records the regex version it replaced blanking **5,104 lines
of real code** because `accept="image/*"` in a string opens a comment that never existed — landed on
main mid-build. This guard imports it. Two copies removed in one PR, none added.
