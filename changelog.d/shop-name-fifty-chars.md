## 2026-11-06 · feat(shops): a shop name is 50 characters at most, everywhere [migration]

Owner, 6 Nov 2026: *"50 characters"*. A supplier's shop name (`vendor_profiles.business_name`) was 128 in four hand-typed places. It is now ONE constant, `SHOP_NAME_MAX = 50` in `apps/web/lib/business-slug.ts` (beside `BUSINESS_SLUG_MAX`), with one refusal sentence, `SHOP_NAME_TOO_LONG` — "Keep the shop name to 50 characters or fewer."

- **Boxes** (`maxLength={SHOP_NAME_MAX}`): the sign-up wizard, My Shop, the ask-to-rename row and the correction-request card, Admin's invite form and Admin's edit page. The sign-up and My Shop boxes show a live count from 40 characters ("42 / 50"), in the existing hint style.
- **Server writers** refuse past 50 — never clip: `becomeVendor` (open-shop), `updateVendorProfileField` (My Shop), `requestProfileCorrection` (a rename request), `createAdminVendorInvite` + `saveUnclaimedVendorProfile` (Admin), `parseRequestedValue` (the correction apply, which used to clip to 128).
- **Database**: migration `20271320245383_a_shop_name_is_fifty_characters` adds `vendor_profiles_business_name_max_50` (`CHECK (char_length(business_name) <= 50)`, NOT VALID then VALIDATE — prod's longest is 20). It re-creates `claim_ready_the_shop` and `claim_ready_the_invited_shop` with one change each: the invite's name is clipped to 50, so a supplier claiming from a couple's link where the couple typed a long name is never refused.
- **Not shops, unchanged**: the couple's own record (`event_manual_vendors.business_name`, free text) and Setnayan's identity (`platform_settings.business_name`).

Guards: `apps/web/app/open-shop/the-shop-name-is-fifty-characters.test.ts` (every writer and box reads the constant; the claim functions' latest definitions still clip; a census of every `business_name`/`shop_name` box) and `apps/web/tests/db/a-shop-name-is-fifty-characters.db.test.ts` (the CHECK refuses 51 and keeps 50; free text stays free; both claims clip a 70-character name). Both sabotage-checked. `old-shops-are-loved-ones-too.db.test.ts` lifts the cap for its one 184-character fixture, which models a shop from before the rule.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` — a 2026-11-06 row records the 50-character shop-name rule and where it is enforced.
