## 2026-08-09 · fix(vendor): the first screen a vendor sees told them to publish a shop they cannot publish

Follow-up to the same day's order-of-operations work (#4266), found by the owner on a real phone within minutes of testing.

**The copy.** Step 1 of Open your shop, under the logo field: *"You can add it later from My Shop — but you'll need it to publish your shop and to get verified."*

**A vendor cannot publish their shop.** There is no such control for them anywhere — the only `name="is_published"` input is on the admin vendor edit page, the one vendor-side action that ever wrote the column has no caller, and `/admin/verify` (the thing that actually makes a shop public) writes `public_visibility` + `verification_state` and never touches it. **Approval is what publishes a shop.** Now reads *"but Setnayan needs it before your shop can be approved"* — which is both true and the actual reason the logo matters: it is one of the business-profile fields, and the profile must be complete before documents can be submitted.

**🔑 THIS IS THE THIRD PLACE THE SAME FALSE IDEA SHIPPED, AND THE ONE A SWEEP MISSED.** #4266 removed it from the invite QR page and the My Customers QR section, both of which refused the vendor's own customer QR by pointing at a button that does not exist. That sweep searched for *"publish your profile"* and *"publish your page"*. This one said *"publish your **shop**"* and survived — then landed on the owner's screen the same afternoon. **A sweep is only as good as the phrasing you guessed.**

**🛡 So it is a standing check now, not a note.** `app/open-shop/no-vendor-publish-claim.test.ts` walks the two vendor-facing trees and fails on any copy telling a vendor to publish their shop / business profile / page. Three properties make it real rather than decorative:

- **Mutation-verified** — restoring the exact shipped sentence turns it red (confirmed applied, then confirmed caught, then restored green).
- **It self-checks its own matcher** against that shipped string plus both phrasings #4266 removed, so a regex drift cannot quietly turn the file into something that always passes.
- **Narrowly scoped so it cannot cry wolf** — a vendor genuinely CAN publish a service card and a package, and those surfaces say "Required to publish" correctly. The pattern binds the verb to the shop/profile/page noun and asserts the legitimate copy stays unflagged. A guard that cries wolf teaches you to skim past the one time it is right.

Comments recording *why* the phrase was removed are stripped before matching — deleting those notes to satisfy a regex would throw away the reason and invite a fourth recurrence.

SPEC IMPACT: None — copy correction plus a guard. The underlying rule (only admin approval publishes a shop) is unchanged and already recorded in `DECISION_LOG.md` 2026-08-09.
