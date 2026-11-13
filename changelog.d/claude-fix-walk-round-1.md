## 2026-11-13 · fix(supplier-onboarding): walkthrough round 1 — `/open-shop`, `/open-shop/logo`, Today

From the controller's 390 px walkthrough of the live site (0dc2f67), supplier part, round 1:

- **F-W1-04** `/open-shop` Continue is drawn pressed with a spinner at once, ignores a second tap, and drops the focus
  before the next step is drawn (`go()` in `open-shop-wizard.tsx`; Enter takes the same path).
- **F-W1-03** Today's "N categories · manage in Coverage" counts categories the way sign-up does
  (`lib/shop-category-count.ts`); it printed `services.length`, and opening a shop writes the coarse key AND the leaf.
- **F-W1-13** A company email still exactly as prefilled from the account is re-read from the account that submits
  (`accountEmailAtSubmit`, `lib/open-shop-account.ts`); the account's boxes are redrawn when the account changes.
- **F-W1-02** Same mechanism for "Your name": the box follows the signed-in account (owner lock 2026-08-10, the account
  name wins). One question left to the owner (PR).
- **F-W1-10** Closing the "Our Terms have changed" sheet holds for the browser session (sessionStorage); "I agree" is
  the server record and ends it for good.
- **F-W1-06** "Celebration" tile reads "Other events" on Events you serve; key unchanged.
- **F-W1-07** The map hint band sits above the Leaflet / OpenStreetMap credit.
- **F-W1-08** `/open-shop/logo` wears the wizard's shell (step bars, top-aligned, sticky bottom bar).
- **F-W1-09** One logo rule (`SHOP_LOGO_UPLOAD`, 10 MB, PNG/JPEG/WEBP/HEIC/HEIF — what `/api/upload` enforces) in both
  uploads and Today's help line.
- **F-W1-11** Today's "Get verified" points to "Send your documents" instead of asking for the four papers again.
- **F-W1-12** Signed-in "Your account" has its line; the fee line ends with a full stop.
- **F-W1-05** No change: "Free and Verified cover this" is correct (both hold 1 category × 1 service in `TIER_CAPS`).

SPEC IMPACT: None (walk fixes to shipped screens; two owner questions are on the PR, not decided here).

## 2026-11-13 · fix(supplier): "How many a day" is per service — it leaves Today's setup

Owner, 13 Nov 2026 (DECISION_LOG d8ec0922): the daily limit is per SERVICE, not per shop. Today's setup step 7 ("How
many a day", under the six) is removed — the checklist stays "N of 6" — and each service card asks it plainly: "How many
events a day can this service take?", on the card's existing `vendor_services.daily_capacity` (no new column).

SPEC IMPACT: None (the ruling is already in DECISION_LOG d8ec0922).
