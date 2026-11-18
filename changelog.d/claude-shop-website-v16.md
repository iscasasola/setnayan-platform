## 2026-11-15 · feat(shop): the shop website follows the approved v16 — top bar, Awards row, back doors, footer

- **Top bar (sticky).** It keeps ‹ back, named for where the visitor came from, and SETNAYAN. SETNAYAN now opens https://www.setnayan.com as an absolute address, so it also works on a shop's own domain.
  - Once the shop's name scrolls under the bar, the bar shows the shop's own round logo and name. Pressing either goes back to the top.
  - On a verified shop, the blue check beside the name is its own 44 px button. It opens the Setnayan Verified award full screen: the award kit's `VerifiedFullscreen` (#7752), reused as shipped and loaded only on that tap, showing the same blue-check seal as the Awards row.
  - Share and the heart (Add to event) join the bar only after the page's own buttons have scrolled away.
- **The heart is Add to event.** The body button and the top-bar copy both carry it, it fills once added, and the two copies stay in step.
- **Awards row.** The heading is just "Awards". Each award shows its badge and one plain fact ("100 bookings completed", "Setnayan Verified"). The row shows no tier name and no date.
  - It now reads the one badge adapter (`publicBadgeView`, `lib/public-badges.ts`), in the v16 order: Verified, then the seals the shop holds, then the tiered badges.
    - The seals come from the seals engine (`readShopSeals`, #7825), through the adapter's new `sealsFromEngine`.
    - The tiered badges (Completed bookings, Five-star reviews, Gifts given, Trusted by) come from J0's counters (`readShopTierCounts`, #7753), through `tiersFromCounts`. Each is shown at the step reached on its own ladder. Invites has no counter yet, so it never draws.
    - Facts follow the drawing: "Top 10 supplier of {year}", with the year from its stored `shop_seals` row. Gift points are said as points, and Trusted by as clients, because those are what the counters count.
  - Every item is a button that opens its full screen from the award kit, loaded only on the tap and in the public page's words:
    - Verified opens `VerifiedFullscreen`.
    - A tiered badge opens `BadgeFullscreen`, without the owner-only "after N days" line.
    - A seal opens `SealPlaque`, with the date its row was given.
  - The top bar's check opens the same Verified full screen. Both are labelled "Setnayan Verified — what it means".
  - **A failed read is never "no awards".** If the seals or a counter cannot be read, the row says "Couldn’t load every award". That also stops a Verified Partner shop from silently reading as plain Setnayan Verified.
  - **Unverified look.** The Verified slot stays and reads "Setnayan Verified · Not yet — papers not checked", and the footer carries the "Not yet verified" tag.
  - The adapter now lists Clients' Choice, takes seal names from the engine's `SEAL_LABEL`, orders seals by `SEAL_ORDER`, and lets Verified Partner replace Setnayan Verified (3077c9b3 rule 8).
  - The retired monthly Spotlight awards no longer draw in the row. DECISION_LOG row 6445 / 4b8cc3a3: they are replaced by the seals, so the page no longer reads `fetchVendorCurrentAwards`.
- **"See more suppliers"** now shows only for the supplier's own QR or link (`?src=own`) and for a typed address.
- **Branches.** "Also in Makati, Quezon City, Muntinlupa and 7 more": the line names three cities and counts the rest.
- **Footer.** "Report this shop" is its own outlined 44 px button, still inside a `<div>`.
- **Section menu.** It now sits under the sticky top bar.

SPEC IMPACT: None. It builds the owner's 15 Nov rulings already in DECISION_LOG (shop website rows) and prototype `shop_website_two_looks_2026-11-15` v16.
