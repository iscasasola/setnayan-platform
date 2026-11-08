## 2026-11-07 · fix(screen-name): a shop's anonymous name is built from its real city and services — not "Philippines Wedding Vendor"

The owner, live on his own new shop (/v/rondomusical, Quezon City, a music shop): the hero read **"Philippines Wedding Vendor #14"** and the logo tile **"PW"**.

**Why.** /open-shop (`app/open-shop/actions.ts`) inserts `vendor_profiles` with only its `user_id` and writes the city and services in a second statement. The AFTER INSERT screen-name trigger fired on the empty row, took both fallbacks (city "Philippines", label "Wedding Vendor"), and the generator's persistence rule kept that name forever. Separately, the label read `services[1]` only — and /open-shop puts the coarse category first (`band_dj`, `florist`), which has no label — so even real data read "Wedding Vendor".

**Fix — migration `20271319689851_screen_name_remints_from_real_data.sql`** (extends the existing generator + trigger, no new column):
- The label is the first ticked service that has one (`screen_name_label(services)`; DECISION_LOG 2026-10-28 "NO PRIMARY SERVICE … e.g. the first ticked"). Where `services[1]` has a label the name is the same as before.
- `remint_fallback_screen_name()` re-mints a name only when it was built on a fallback that can now be filled (the city arrived, or a labelled service did), only while `name_revealed_at IS NULL`, never for a venue. It hands the row back to `generate_screen_name_for_vendor()`, so the (city, label) namespace and the collision retry are the signup's own. A name built from real data is never touched.
- AFTER UPDATE OF `location_city`, `services` trigger → that function.
- A one-time, re-runnable repair of rows already stuck: 3 in prod (measured read-only 2026-11-07).

**Also on that page:** the owner-only banner's button is the house forward step (`ActionButton tone="brand" main`, terracotta, 44 px) instead of a black block, and "Send your documents" now opens Today's documents step (`/vendor-dashboard#setup-docs`) instead of Shop ⚙ › Verification.

Guards: new `tests/db/screen-name-remints-from-real-data.db.test.ts` (7 tests, each assertion sabotage-checked); `app/v/[slug]/the-team-sees-its-own-page.test.ts` gains the terracotta and Today-href assertions.

SPEC IMPACT: None. A bugfix that applies the 2026-10-28 ruling ("derive it without asking … e.g. the first ticked") to the screen-name generator. No new decision.
