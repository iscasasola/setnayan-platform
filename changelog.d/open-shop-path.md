## 2026-07-03 · feat(vendors): /open-shop — logged-in accounts can finally become vendors

Owner-reported double gap: (1) the top-nav Vendors popup's "Register your
business · free" button pointed at the /for-vendors PITCH page instead of an
onboarding; (2) a logged-in account had NO path to become a vendor at all —
shops were only created by the signup trigger, so every existing couple/user
dead-ended.

**New smart route `/open-shop`** behind every "Register your business" CTA:
- logged OUT → `/signup?as=vendor` (account + shop in one go)
- logged in, owns a shop → `/vendor-dashboard/shop`
- logged in, no shop → a one-button confirm card ("Open your shop on Setnayan —
  your account stays the same; free during launch") → `becomeVendor()` action
  provisions exactly what the signup trigger does (bare `vendor_profiles` row +
  founding `vendor_team_members` admin seat, idempotent, admin-client after
  auth check) → lands on My Shop where the profile checklist + Get-verified
  journey are the onboarding.

**CTAs repointed** to /open-shop: the nav Vendors-popup button (was
/for-vendors) + the three /for-vendors register buttons (hero, tier ladder,
deep-dive — were /signup?as=vendor, which broke for logged-in users).

**My Shop no-vendor gate**: `/vendor-dashboard/shop` for a signed-in user with
no shop now redirects to /open-shop instead of the dead "unavailable" fallback
(loader returns a 'no-vendor' sentinel, distinct from genuine load errors).
Riding along: the loader's catch now RE-THROWS Next control-flow errors
(NEXT_REDIRECT) — previously the /login redirect inside loadShopData was
swallowed into the error fallback.

Verified `tsc` (0), `next lint`, production `next build` (route ƒ /open-shop).

SPEC IMPACT: closes the "one account, three doorways" gap for the vendor
doorway (0000/0015) — any existing account can now open a shop. Logged in
DECISION_LOG.
