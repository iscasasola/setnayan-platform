## 2026-08-19 · fix(roles): a supplier who has a shop is no longer invited to create one

`fetchUserRoleSummary` reads the shops a person OWNS. Its error was already bound
and already logged — and `?? []` turned the refusal into an empty list anyway. So
`ownedShopCount` fell to 0, `canOpenAnotherShop(0)` returned true, and the account
menu offered **"Create your shop"** to a supplier who already has one.

That contradicted the promise in `account-switcher.tsx`'s own docblock: *"a vendor
who already owns one gets canOpenShop === false"*.

⚖ IT FAILS CLOSED, AND THE DIRECTION IS THE DECISION. Hiding the button for one
render is small and self-correcting. A duplicate shop is not: **shop addresses are
IMMUTABLE once minted**, so the mistake is permanent and needs an admin to unpick.
Compare the opposite ruling on the ₱2,500 photo wall, which fails OPEN because an
unrecognised value must not silently delete a feature somebody paid for. Neither
default is universal — pick by what the wrong answer costs.

🔑 A LOG LINE NEVER CHANGED A PIXEL. The error was bound the whole time.

SPEC IMPACT: None.

### CI caught what my local check could not — 2026-08-19

Adding a required field to `UserRoleSummary` broke **two consumers** that build
that object by hand in a `catch`: `app/dashboard/(launcher)/page.tsx` and
`lib/dashboard-shell.ts`. Both now set `shopsMeasured: false`, which is not a
formality — those literals exist *because* a read failed, so marking them
unmeasured is what keeps the fail-closed rule whole at the exact point the read
already went wrong.

🔑 **I MISSED IT LOCALLY BY GREPPING FOR THE FILES I CHANGED.** `tsc` was run and
its output filtered with `grep -c "roles.ts\|account-switcher"` → 0, read as
"clean". **A type change breaks its CONSUMERS, which are by definition files you
did not name.** Compare the TOTAL error count against the known baseline (270)
instead — that is what caught it on the retry, and it is the same family as
grepping a TAP log for a filename it never prints.
