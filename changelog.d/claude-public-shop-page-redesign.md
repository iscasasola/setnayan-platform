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

Review fixes (same PR, 13 Nov):
- **One visible "Inquire".** A service card's details sheet button now reads **"Choose this service"** and opens the
  same pop-up with that card picked; a card with no price reads **"Price on request"** (`lib/service-card-view-model.ts`
  and the page's own price line) instead of "Inquire". New guard walks every `.tsx` the page renders and allows the
  word "Inquire" exactly once — the main button (the phone float is that same element).
- **Calling-card order** matches the prototype: Inquire (filled) · Add to your event (ghost), then Check a date · Share.
- **Lock beside its price**: `PackageCard` gains `ctaBesidePrice` (price left, "Lock this package" right, wrapping on a
  narrow card); the dashboard callers keep the foot slot.
- **Seal and reach motion** (README rows 3 and 8): `ImageBadge drawn` turns the verified seal's ring and ✓ into strokes
  (`pathLength=1`) that draw after the stamp; `ReachMap`'s plan ring carries `data-reach-ring` and draws, fills, then
  an "N km" tag (`kmTag`, shop page only) fades in and the pin drops. CSS only, `from`-only keyframes so the resting
  state is complete; reduced motion = the 120 ms fade.
- **Dead reads removed**: the composer-only reads no longer run — linked services (`vendor_service_links`), the
  existing-thread lookup, requirement facets + saved templates, composer live pax, the AI-mode event row, the
  event-type roster, and the composer's event-picker call.

Not in this PR: the person page (`/u/[userSlug]`), `sample-shop-page.tsx` and `/for-suppliers` (a later step); the
prototype's portfolio mosaic / albums / story-card and review-bar redraws (the shipped sections render inside the new
grouping); the Ultra "nationwide" ripple and the ring growing on a plan change (no plan switch on a public page).

SPEC IMPACT: None — matches the approved prototype.
