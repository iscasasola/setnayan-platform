## 2026-08-17 · feat(doors): password recovery joins the account journey

Owner ruling 2026-08-17, asked directly: sign-up and the two password pages
should read as the same product as the thirteen doors, not as the public
website.

`/forgot-password` and `/reset-password` now render through `<DoorShell>`. They
previously wore the marketing register (`--m-*` inline styles, `.m-serif`) —
internally coherent, but it made recovering your account look like a different
product from claiming an invitation.

`/reset-password` takes the tone split the other doors take: a live recovery
session is a **threshold**; a spent link is a **dead end** and does not wear the
action colour. Its one control still leads somewhere real.

⏭ **`/signup` is NOT in this change.** It is a 960px two-column brand-panel page
built from ~860 lines of hand-written inline styles — an order of magnitude more
than these two, and the one page in the product where a mistake costs a signup.
It gets its own change, done carefully, not appended to this one.

Also fixed on the two pages touched: their own `title` appended "· Setnayan"
while the root layout already appends it via `template: '%s · Setnayan'`, so the
tab read "Reset your password · Setnayan · Setnayan".
⚠ **87 other pages still do this** — a separate mechanical sweep, deliberately
not bundled here.

🔍 **A GUARD ALARM THAT WAS A FALSE ONE, AND HOW IT WAS CLEARED.**
`lint-port-no-lost-controls` reported both pages "can no longer reach /" — a
DESTINATION, which is that guard's real subject, not a wrapper. The link moved
into `<DoorShell>`, and the guard is FILE-SCOPED, so a control moving into a
shared component reads as a deletion. Cleared by rendering both pages and
reading the DOM: `main a[href="/"]` is present with aria-label "Setnayan home".
**Verified at runtime before the baseline was regenerated — not waved through.**

SPEC IMPACT: None.
