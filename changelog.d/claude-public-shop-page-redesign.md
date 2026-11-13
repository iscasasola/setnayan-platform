## 2026-11-13 · feat(shop-page): the two approved looks — verified at its best, unverified calm

The public shop page `/v/[slug]` now draws the owner-approved designs (prototype `public_pages_three_2026-11-13`;
DECISION_LOG 13 Nov: "two looks", "THREE PAGES, ONE FAMILY", "ONE MAIN BUTTON — INQUIRE", "CHECKING A DATE IS FOR
VERIFIED SHOPS ONLY", "SIMPLER TO MOVE AROUND", "THREE PUBLIC PAGES APPROVED"). Every existing read, privacy rule and
guard is kept; only placement, grouping and motion change.

- **Verified (Verified · Solo · Pro · Ultra alike):** full-bleed hero with the name on the photo (word-by-word rise), the
  circular Verified seal + badge circles on it, no buttons on the photo. The calling card overlaps the hero and stays
  pinned beside the body on tablet+. It carries the ONE filled **Inquire** (on a phone the same button floats
  bottom-right to stay in reach), **Add to your event** (the shipped Save
  action, `saveVendorToPicks`, as a ghost), Share, Check a date, and a new **"Their real calendar"** peek — the next
  Saturdays, Open / Not bookable, from `readCheckADate` (the read behind `/v/[slug]/dates`); a failed read draws no
  days. Reach, branches and the own web address stay per plan.
- **ONE Inquire per page** (owner 13 Nov, "Yes, only one"): no Inquire tab, no Inquire section or inline form at the
  foot, no hero button. The button — and a service card's "Inquire about this" (card picked) — open the shipped
  pop-up (`InquireSheet`), now mounted for every shop that takes messages (`canMessage`, so unverified shops too).
  The inline `InquiryComposer` / `AnonInquiryComposer` and the foot "which celebration" picker are no longer mounted;
  arriving on `#get-in-touch` (Compare, shared links) opens the pop-up for a signed-in visitor. The waitlist block and
  the cold "See more suppliers" door stay.
- **Body in sections under a sticky section bar** (About · Services · Portfolio · Reviews, ↑ Top): About
  holds their words (large serif), the new **"What their own website can't do"** panel (Check a date + three quiet
  lines; the chat is described in words, never labelled Inquire), details and Trusted by; Services holds the cards, typical price and packages; Portfolio holds photos, stories
  and looks. Real anchors; with JS the jump offsets for the bar and never writes history.
- **Lock** appears only on each package card — its trigger now reads "Lock this package".
- **Motion** (CSS module + one IntersectionObserver in the section bar): hero settle, kicker/name/tagline rise, seal
  stamp, badge pop, card rise, scroll-timeline drift, parts rising as they enter. Full
  `prefers-reduced-motion` fallback (120 ms cross-fade, nothing travels); resting state complete without JS.
- **Unverified:** one calm column — the notice as a soft card with its ⓘ, the header, Inquire (one main) + Add to your
  event + Share, section bar Services · Reviews · Where, the map (pin only) under Where, and "N live … M more on
  hold" read from `vendor_services.plan_hold` (drawn only on a successful count). No Check a date, no peek, no web
  address. The placeholder hero band is gone from this look.
- Guards: `one-inquire-button.test.ts` now pins exactly ONE page-level Inquire control (one `#get-in-touch` link, no
  inline composer, no Inquire tab or section, none in the panel or bar). `the-two-shop-looks.test.ts` (verified look = every verified shop; Check a date / peek / dates read only
  behind verified + bookable; Lock only in package cards; section-bar tabs; no web address on unverified; motion has a
  reduced fallback and hides nothing before JS). Column and identity-chip guards updated for the two looks.

Follow-up: the composer-only reads (requirements template, saved requirements, AI flag, existing thread, linked
services, event-type roster) still run but feed nothing now — safe to remove in a cleanup PR.

Not in this PR: the person page (`/u/[userSlug]`), `sample-shop-page.tsx` and `/for-suppliers` (a later step); the reach
ring's draw-on animation (the map is the shipped OSM embed) and the seal's ring/tick stroke draw (the seal is the shipped
image badge); the prototype's portfolio mosaic / albums / story-card and review-bar redraws (the shipped sections render
inside the new grouping); moving the Lock button beside the price inside `PackageCard`.

SPEC IMPACT: None — matches the approved prototype.
