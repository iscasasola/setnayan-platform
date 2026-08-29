## 2026-08-29 · fix(shell): the hamburger stays visible on every rail variant

The menu button that opens the off-canvas rail rendered on the two public
chrome variants only. The signed-in app variant (dashboard, an event, a shop,
admin) dropped it, and its rail was hidden with an unconditional
`display: none` below 1024 — so those four trees had no way to open
navigation on a phone, and pressing the button anywhere it did render on the
app chrome would have opened a drawer sitting underneath the fixed bottom bar
(both were `z-40`, and the bottom nav renders after `.fd` in the document).

Owner: "hamburger menu disappeared on other parts of the shell. keep it
visible across."

Fixed: the button no longer checks the variant; the app rail is hidden only
while shut (`[data-open='false']`), reusing the same drawer machinery the
public pages already use; the drawer and its scrim are raised to z-60/z-59 on
the app chrome so they outrank the bottom bar's z-40.

SPEC IMPACT: None.
