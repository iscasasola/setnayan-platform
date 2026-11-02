## 2026-07-03 · feat(vendors): vendor onboarding wizard at /open-shop

Owner: "create a vendor onboarding. we just need the basic." The /open-shop
confirm card (PR #2692) becomes a two-step wizard:

- **Step 1 · Your shop** — shop name (required) · **primary service, pick 1**
  (grouped native select over the 30 categories, admin-taxonomy labels with
  in-code fallback) · location (city).
- **Step 2 · How couples reach you** — contact name · contact number ·
  website (optional) · **social media link** (optional — owner: "we also want
  to find their soc med, websites").

One always-mounted form (values survive step switches), client-side required
checks on step 1, single submit → `becomeVendor(formData)`: provisions the
shop (trigger-mirror, idempotent), writes the basics (blanks never clobber
existing values; the primary service leads `services[]`), normalizes URLs, and
**seeds the Get-verified `social_media` document slot** on a draft application
via the shared `buildSlotValue` — their social link is already ticked in the
verification checklist when they land on My Shop. The REST of the profile
(logo, email, exact HQ pin, EST) + documents continue there: the profile
checklist + Get-verified journey are the rest of the onboarding.

Routing: /open-shop now also serves the wizard to a logged-in account whose
shop was provisioned but never NAMED (fresh signups — the trigger creates a
bare shop), prefilled with anything already saved. Fresh vendor signups with
no explicit ?next= land on /open-shop (was '/'), so the wizard IS the vendor
signup landing; explicit next (QR/deep-link flows) still wins. The welcome
email points there too.

Verified `tsc` (0), `next lint`, production `next build`.

SPEC IMPACT: vendor onboarding = basics wizard → My Shop profile checklist →
Get-verified. Logged in DECISION_LOG.
