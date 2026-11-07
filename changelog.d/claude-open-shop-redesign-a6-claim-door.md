## 2026-11-07 · feat(open-shop): A6 — the claim door. A couple's QR / link opens the redesigned sign-up door, pre-filled from their record, in v21's claim slides

Owner 2026-11-06 "A SUPPLIER WHO JOINS FROM A COUPLE'S QR / LINK GOES THROUGH THE SAME DOOR, PRE-FILLED" · "ONE SLIDE
PER SERVICE CARD, THEN THE BUNDLE. NO NEW MAKERS" · 2026-11-07 "SAYS WHICH PLAN THEIR SERVICES FIT" · "SPECIALTIES —
OPTIONAL" · "FIRST SLIDE WEARS THE DOOR'S OWN FRAME" (all in DECISION_LOG). Before, the couple's link sent the
supplier to `/signup?as=vendor` and then to a blank service maker.

- **One claim address.** `claimDoorHref(token)` (`lib/claim-door.ts`) = `/open-shop?claim=<token>`. `buildClaimUrl`
  (QR / copy link), the couple's emailed invite, and the claim page's "Claim & sign up" (auto-share + couple
  branches) all use it. Setnayan's own (admin) invite keeps its own door, unchanged.
- **Only the screens changed.** The record is read through the shipped `fetchClaimLandingByToken` (expiry sweep +
  first-opened stamp) by `readClaimDoor` (`lib/claim-door.server.ts`). The finish (`app/open-shop/claim-actions.ts`)
  checks the account first through the one shared reader (`lib/claim-account-gate.server.ts`, which finalize now uses
  too). It then opens the shop with `claim_ready_the_shop`, makes the cards with `createVendorService`, makes the
  bundle with `savePackage`, and hands over to the shipped `/vendor/claim/<token>/finalize` for the consent.
- **The slides (`app/open-shop/_components/claim-door.tsx`):**
  - Invited by: one Confirm, plus grey pills for "Sign in & claim" and "I'm not this supplier".
  - Tick what is wrong.
  - One detail per slide.
  - One slide per service card, pre-filled with the couple's price and inclusions. Other cards are bundled, with a
    "Price it on its own" option. A "Which one?" PickMenu appears when the couple's category holds several services.
    Specialties are optional.
  - The bundle.
  - Which plan fits (`PlanInline`).
  - Account: Google / Apple / sign in.
  - The draft is kept in this tab across the OAuth round trip.
- **No Email field.** The shop's contact email is the signed-in account's.
- **Lab:** `/dev/open-shop-lab?screen=claim` (`&signed=1`) shows the prototype's record.
- **Guard:** `app/open-shop/the-claim-door.test.ts` covers:
  - no couple-made claim link builds `/signup?as=vendor`;
  - the door pre-fills from the record, through the shipped token check, in v21 order;
  - there is no Email field;
  - the consent stays in finalize.
  - Sabotaged 3× red.
- **Neighbouring guards, updated in place:**
  - `claim-account-gate` and `the-active-shop-is-resolved-once` follow the gate's reads into the shared reader.
  - `no-delete-x-on-list-rows`: the claim door's editor fields go on ALLOWED, and `file-upload.tsx` moves from the
    baseline to ALLOWED. Every ✕ there is a photo or file tile's own, including A3's logo [Remove] pill, which had
    taken it 3 → 4.
  - `the-v21-deltas`: the plan sheet's back pill wording is now a prop.

- **The house rules, kept:**
  - Every claim field is drawn through ONE plain box (`Box`, a reasoned `field-ok`, as in `open-shop-wizard`).
  - "Which one?" is a `PickMenu`, never a raw `<select>`.
  - The side glance is borderless (no new card).
  - The number is grouped by the door's own `formatPhoneDigits`.
  - The plan slide's own Continue / Back replace the bar, so there are never two backs.
- **The finish keeps the business alaga in step** (`ensureBusinessAlaga`) after naming the shop. A refused shop read
  fails closed instead of dropping the shop's services in the merge.

SPEC IMPACT: None — builds the 2026-11-06 / 2026-11-07 claim rulings as recorded. No migration.
