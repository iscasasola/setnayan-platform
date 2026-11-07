## 2026-11-07 · feat(marketplace): an unverified shop is findable until its first inquiry, then locked out of Find until verified

DECISION_LOG 2026-11-07 "🔎 AN UNVERIFIED SHOP IS FINDABLE UNTIL ITS FIRST INQUIRY" (reverses 2026-07-27 "only show shops that are ready").

- **One rule, in the database.** Migration `20271320303985` adds `vendor_profiles.is_findable` (a stored generated column: verified shops, plus `unverified` / `pending_review` shops that are not archived, not fraud-frozen and not locked) and the lock stamp `find_locked_at` / `find_lock_reason`. The stamp is written once by AFTER INSERT triggers on `chat_messages` (a couple's or coordinator's message) and `event_vendors` (`source = 'vendor_invite'`, an imported customer). It reuses those existing records and adds no counter. Deleting the inquiry does not unlock the shop. `guard_vendor_profiles_find_lock` refuses a browser session writing the lock columns. `vendor_market_stats` and `vendor_profiles_self` carry the new columns. Already-contacted shops are backfilled.
- **Every couple-facing list asks it** through `lib/findable-shop.ts` (`FINDABLE_SHOP_GATE` / `findableShopGate()`), and `LIVE_SHOP_GATE` is now built on it. The covered lists are Explore (grid, count, service cards, tiles), category pages, the front door / Home shelf, the suggestions engine, Suppliers › Find (bench search, add by name, pool count), the onboarding pool, date selection and the day-of "Get help" list. The bench search moved to the admin client with the gate; RLS was **not** widened.
- **Guard.** `lib/every-listing-asks-findable.test.ts` fails if a named list skips the gate, or if any `vendor_market_stats` reader re-types the verified filter. It was sabotaged once and fired.
- **Supplier.** Today shows "You’ve had your first inquiry — get verified to be found again" with a Verify button, which opens the documents step.
- **Couple.** A not-yet-verified shop's own page and QR codes open, with "This shop is not yet verified by Setnayan". Those pages are noindex.
- **Admin.** Verify › Visibility gains a find line on every card, an "Out of Find" tab, and a green "Lift the lock" pill that is audited and saves in place. The next inquiry locks the shop again.
- **Demo shops** keep their own `is_demo` rule, unchanged.
- **Labs.** `/dev/find-lock-lab` and `/dev/supplier-lab?easy=findlock`.

SPEC IMPACT: None. This implements the existing DECISION_LOG 2026-11-07 row, and there is no corpus edit. For owner sign-off, flagged in the PR:
- the import-lock title wording "first booking";
- the Explore tile's "Sample: A · B · C" names and the "N verified" brag figure staying verified-only;
- page Inquire and the chat notice not built yet.
