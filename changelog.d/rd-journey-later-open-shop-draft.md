## 2026-10-22 · fix(open-shop): a taken web address at Submit keeps what was typed

Owner 2026-10-22, "yes to all" on `prototypes/journey_fixes_later_2026-10-22.html` § Supplier 4c. The step-1
availability check already ships (Rule 0: found, not built); what was left is the race at Submit — two people, one
word, one minute — where the unique index refuses, `becomeVendor` redirects to `/open-shop?…&error=`, and the reload
kept only the banner. The wizard now parks the shipped one-hour `sessionStorage` draft (`lib/open-shop-draft.ts`) as
the form submits (`atSubmit`, with the address it sent; never the password) and restores it only on that error
reload (`restoresOnThisLoad`): name, logo, service, events and contact come back, the server's step stands, and the
address box remounts holding the refused address, focused, where its own check says "Taken — try another." Also
fixes the OAuth park's capture handler and the `AddressPreview` docblock that promised "the field intact".

Guard: `apps/web/app/open-shop/a-refused-submit-keeps-what-was-typed.test.ts` (round trip without a password · the
restore rule · park after the gate, restore through the rule, the address handed back · every return to /open-shop
carries `error=`). Sabotaged 7 ways, each red.

SPEC IMPACT: None beyond the DECISION_LOG row "JOURNEY FIXES — THE LATER LIST" (corpus 10df37b0).
