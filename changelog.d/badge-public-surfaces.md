## 2026-11-15 · feat(badges): public badge surfaces read one adapter; the old explore pills retire; unverified shops show their real name (badge build J6, part)

Owner rulings 15 Nov (specs 4b8cc3a3 "the badges we created will be the only badges we have"; 7fbff0cd items 5 and 9); approved drawing `prototypes/supplier_badges_2026-11-15/badge-milestones_v86.html`.

- **Explore card:** the pills New · Couple Trusted · Most Booked · Top Pick no longer draw; Setnayan Verified stays (named as such). An unverified shop's card shows its **real business name**; the anonymous placeholder is kept only for a shop with no name.
- **Service card (grown):** new optional `badges` prop. With a view from the adapter it draws the card's medal row (layout D order, Setnayan Verified last, with an ⓘ), the Verified check beside "by {shop}", and under The record the shop's other seals and tiered badges. With no view — every caller today — it draws nothing.
- **`lib/public-badges.ts` — the ONE adapter.** The approved names and orders (five shop badges, the seals, six card medals), `publicBadgeView` (drops unknown keys, zero counts and an unverified Verified), `keptExplorePills`, `publicShopName`, and `PUBLIC_BADGE_GAPS`. Only Setnayan Verified has a source on main; J0 (tiers), J2 (seals) and J3 (card medals) wire their readers here.
- Guards: `lib/public-badges.test.ts` (6 claims, each sabotaged red). `lib/root-map-waves-2-3.test.ts` now asserts the retired Most Booked / Top Pick pills draw nothing (their tooltip pins went with them).
- Help: "What do the badges on a supplier mean?"; tour: the Suppliers first-visit stop names the Verified check; lab `/dev/shop-preview-lab?view=card-badges`.

SPEC IMPACT: None — builds the 15 Nov rulings. Not built, named: the art (J1 award kit, lazy), the layout D turn (J3's card-badges kit), the services-gallery / shop page passing `badges` (J3 / F2 own those files), other surfaces that still anonymise unverified names (`explore/_lib/marketplace-view.tsx`, `folder-vendors-section.tsx`, the shop page).
