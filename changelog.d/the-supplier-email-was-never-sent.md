## 2026-08-21 · fix(notifications): the supplier's booking emails were suppressed for everybody

🚨 **A LIVE BUG IN SHIPPED CODE, found while planning the deletion handshake.**

All six `lock_request_*` notification types sat in **both** `EMAIL_ENABLED_TYPES`
**and** `MARKETING_GATED_EMAIL_TYPES`. The gate is
`!MARKETING_GATED.has(type) || recipient?.marketing_opt_in === true`, and
`users.marketing_opt_in` is `NOT NULL DEFAULT FALSE`.

**Measured in production: 9 users, 0 opted in.** So the suppression was total —
a supplier with **seven days** to answer a booking request was never emailed, and
the couple waiting on that answer never heard either. In a product with **no SMS
in V1**, email plus one dashboard card is the entire channel.

🔑 **THE COMMENT ARGUING THEY MUST SEND WAS PASTED INTO THE SET THAT STOPS THEM.**
Byte-identical text appears in both lists, explaining that all six are
transactional and must reach somebody who is not in the app. And the gate's own
comment asserts *"Transactional types are unaffected (they're not in the gated
set)"* while six transactional types sat in it. **A sentence is not a mechanism.**

🔑 **TWO LISTS, ONE CHECKED.** `lock-request-notifications.test.ts` asserts
membership of the EMAIL set and never looks at the gated one — so both halves
agreed with each other and the suite stayed green. The new guard checks the
**relationship between the two lists**, which is where the defect lived.

**The fix:** the six are removed from the marketing-gated set. They stay
email-enabled. `new_chapter_from_followed` — genuinely marketing-adjacent —
stays gated, and a test pins that so the guard cannot degrade into "the gated set
is empty", which would be the opposite defect.

**Guards:** 3 assertions, all mutation-checked with counts printed before → after,
all RED — including one proving the gated set cannot simply be emptied.

🪤 One mutation had to be retargeted: `new_chapter_from_followed` appears in BOTH
sets, so removing "the first occurrence" hit the wrong list and the green result
meant nothing. **Scope a mutation to the block you are testing, not the file.**

⏭ **This also unblocks the deletion handshake**, whose four notification types
would have inherited the same suppression by mirroring the lock family.

SPEC IMPACT: None — restores intended behaviour.
