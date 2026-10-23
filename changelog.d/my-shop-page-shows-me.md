## 2026-10-23 · fix(shop page): a shop's owner and helpers see its page before couples can — with a banner; Sign in on the not-found page comes back

Owner, 23 Oct: *"why can't i see setnaprod's website?"* — `www.setnayan.com/setnaprod` drew the not-found page for him.

**The rule, written down once** (`lib/own-shop-preview.ts` · `shopPageGate`). `setnayan.com/{business_slug}` is served
by `app/[slug]/page.tsx`: an event at that slug first, otherwise `renderVendorBySlug` (also `/v/{slug}`). A stranger
opens the page only when ALL of: `public_visibility = 'verified'` (Setnayan listed it — `/admin/verify`),
`verification_state = 'verified'` (documents approved) and `is_demo` is not true. That is `isShopLive` plus the demo
half — the same three filters `/sitemap-vendors.xml` uses, so "opens for a stranger" and "is in the sitemap" agree.
An admin in demo mode keeps exactly the old reach. `is_published` plays no part (legacy, see `lib/vendor-visibility.ts`).

**What was wrong.** The owner carve-out existed, but under two earlier 404s: a `hidden` shop (every shop not yet
approved) and a demo shop 404'd for their own owner, and helpers were never let in. **SetnaProd is a demo shop** —
migration `20271256763663_trial_shops_are_demo_shops` set `is_demo = true` on it (owner ruling, DECISION_LOG
2026-09-29 "LANE 2 §2C" (1)); with Saysay demoed the same way, that is also why the vendor sitemap lists zero shops.
Not re-read from prod in this change (no prod reads): derived from the migration and the record.

**Now.** Signed in, the shop's owner (`vendor_profiles.user_id`) or a helper (`vendor_team_members` seat, read under
RLS) sees the page with a band: *"Only you and your team can see this."* + what couples wait on (documents · being
checked · Setnayan lists it · it is a demo shop) + one button to the next step. Everyone else still gets the
not-found page; closed (archived) shops stay shut for everyone. A team look is not recorded as a profile view, and a
page a stranger cannot open gets the generic title and `noindex`. Your page's 👁 View my page (Shop › Your page) is
no longer grey before listing; the avatar sheet's View page ↗ (`/v/{slug}`) opens the same view.

**Sign in comes back.** The bare-root not-found's Sign in was a bare `/login`, so a signed-out owner landed on Home.
It now carries the address (`/login?next=/setnaprod`, path only — never the query, which can hold invite tokens).

Guards: `lib/own-shop-preview.test.ts` (every column combination), `app/v/[slug]/the-team-sees-its-own-page.test.ts`
(the renderer asks the rule and nothing else; banner rendered), `lib/sign-in-back-here.test.ts`.

SPEC IMPACT: None — implements the existing owner self-preview intent (PR-B) for hidden and demo shops and helpers;
no ruling changed. Whether SetnaProd should stop being a demo shop is the owner's call (DECISION_LOG 2026-09-29).
