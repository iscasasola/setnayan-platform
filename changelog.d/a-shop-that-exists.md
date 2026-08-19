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
