## 2026-08-26 · fix(vendor): the push card can turn itself on

Follow-on to *the switch says how to unblock* (#4885). The vendor
Notifications card's "enable" path pointed at the layout's registrar banner
("Allow via banner below"), and that banner hides itself for 30 days once a
vendor dismisses it — so a vendor who dismissed it once and later opened
Settings meaning to turn push back on found a sentence pointing at nothing on
screen. The card now enables inline (subscribes this device and calls
`registerPushToken`, the same path the registrar uses), so the "Enable" button
always does something regardless of the banner's own state. Disable is
unchanged — it still calls `deactivateAllPushTokens`, the server-side
switch-off across every device the vendor has registered, which the shared
admin/couple toggle does not have and which is why this card was not replaced
by that component.

Also confirmed `ADMIN_NAV_ALIASES` already covers every menu rename from
#4874/#4881 (`overview` → "Today", `app-performance` → "Numbers") — both
entries were added in the same 2026-08-26 session that made the renames, and
`the-menu-name-has-one-source.test.ts` passes its "renamed item keeps its old
name findable" assertion. No gap found; nothing to add there.

SPEC IMPACT: None.
