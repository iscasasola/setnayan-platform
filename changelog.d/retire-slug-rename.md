## 2026-08-10 · fix(vendor): the shop address is permanent — the rename is retired, in the UI, the server, and the database

Owner 2026-08-10, twice: *"slug cannot be renamed so they need to pick their preferred slug."* → *"they can rename it during creation so they can check which is available. but whatever they choose here will be permanent."* And on the cost: *"no, that is fine. we added a lot recently for pro as well."*

### 🔑 The one-line edit that would have done the exact opposite

`updateVendorWebsiteField` checks a field against **two** sets: `INLINE_WEBSITE_FIELDS` is the **allowlist** (not in it → refused outright), `PRO_WEBSITE_FIELDS` is only the **tier gate**. `business_slug` was in both.

Removing it from `PRO_WEBSITE_FIELDS` — the obvious reading of *"it is no longer a Pro feature"* — would have left it in the allowlist with **no tier gate at all**, handing the rename to Free, Verified and Solo instead of taking it away. It is removed from the **allowlist** first, and `lib/shop-address-is-permanent.test.ts` asserts *that* set, so the inverse edit fails CI.

### ⚠ The UI was the button, not the door

`vendor_profiles_owner` is `FOR ALL` on `user_id = auth.uid()` and the column carries the `authenticated` grant — so **any vendor on any tier could PATCH `business_slug` straight through PostgREST**, no UI involved. Deleting the form would have left the promise unkept.

Migration `20271124956492` adds `vendor_profiles_business_slug_immutable`: an already-set address cannot be changed **or cleared**. First write (NULL → value) stays open — that is creation, and the generator. Escape hatch is a **per-statement** `SET LOCAL setnayan.allow_slug_change = 'on'`, modelled on the shipped `guard_vendor_tier_no_silent_downgrade`, so the default stays closed. Deliberately **not** a role check: `is_admin()` reads `auth.uid()`, which is NULL under service_role, so an is_admin() hatch would be open to every server action and shut to the actual admin — precisely backwards.

### 🔴 A latent rename inside the PR that had just merged

`becomeVendor` derives `chosenSlug` from the shop name when the form posts none — which is exactly what a re-run does, since the wizard renders the address read-only once a shop has one. `if (chosenSlug) patch.business_slug = …` would have **overwritten a live address with a fresh slug of the name**, on the very screen that promised it was permanent. Now guarded on `!existing?.business_slug`. Unreachable through the UI today (`page.tsx` redirects any named shop away), but it is a server action reachable by direct POST, and "unreachable" has been wrong here before.

### 🔴 And a real gap the other session's guard caught

`lib/slug-handout-paths.test.ts` failed — it pins that the shop's address-handout path asks the **shared four-namespace question**. It pointed at the rename, which I had just deleted.

The failure was correct and the fix was in the code, not the test: **the unique index covers vendor slugs alone.** Weddings, people and still-forwarding addresses share the one namespace, and `app/[slug]/page.tsx` resolves an **event before a vendor** — so a new shop could take a wedding's word, pass the index, and be **permanently unreachable, with no rename to escape through**. `findSlugConflict` now runs on creation, failing closed on an unverifiable probe. The contract **moved** with the path it guards; a second test asserts the retired rename has not crept back, so this file cannot end up guarding only one of two handout paths.

### What Pro lost, and what it kept

Lost: changing the shop address. Kept, all still gated on `customWebsiteName`: the premium 2-column public page, hero photo, pinned review, featured editorials.

⚠ **The cap was NOT flipped on for lower tiers** — the tempting "it's free now" edit. It gates four things; flipping it would have handed Free and Solo the entire Pro website. Only the slug came out of the gate, and a test asserts the cap still has work to do, so nobody later "cleans up" a cap that looks unused from the slug's side alone.

Public surfaces corrected: the tier matrix row **"Custom URL / slug"** is removed (false three ways — free, on every tier, and now impossible to change), the padlocked Pro upsell no longer dangles *"Change your address"* at the tiers who just typed one in the wizard, and `VENDOR_TIERS_AND_BENEFITS.md` records the trade.

⏭ **NAMED, NOT BUILT: nobody can correct a bad address — not even Setnayan.** No admin surface writes `business_slug` today (verified: all reads). A typo'd or trademark-infringing address has no remedy but a new shop. The escape hatch exists so that screen is a small change when wanted; building it uninvited would be inventing product.

Verified: **7295/7295** unit · 8/8 the new DB immutability suite (incl. a neutralisation that disables the trigger and watches the rename go through) · 7/7 the app-side guard · 10/10 the moved handout contract · all 20 `lint-*.mjs` · migration guard · `tsc` clean.

SPEC IMPACT: `Vendor_Monetization_Model_LOCKED_2026-07-25.md` + `apps/web/VENDOR_TIERS_AND_BENEFITS.md` — custom slug removed as a Pro benefit by owner ruling. `DECISION_LOG.md` row added.
