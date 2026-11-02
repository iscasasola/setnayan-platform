## 2026-09-11 · fix(vendor-dashboard): no phone or email in a shop's own About or tagline

Applies the owner's already-settled rule (2026-07-23 chat; 2026-07-27 card
text: "no placing of contact information or anything to bypass our app") to
two saves the shipped detector never reached. `findVendorTextViolation`
(`lib/service-text-integrity.ts`) already runs on chat text and on
service-card/package text — it now also runs on:

- the shop's tagline save (`app/vendor-dashboard/shop/public-line-actions.ts`
  `updatePublicLine`), refused with the same wording as a card-text
  violation. The shop's own WEBSITE field on the same action is deliberately
  left unchecked — owner question 3 in the register is still open on whether
  a shop's own site may carry contact details.
- the About paragraph save (`app/vendor-dashboard/actions.ts`
  `updateVendorWebsiteField`, `microsite_about` case only). Every other field
  that action saves (sections, featured picks, accent, hero photo, video
  refs) is left unchecked — none of them are free text.

SPEC IMPACT: None.
