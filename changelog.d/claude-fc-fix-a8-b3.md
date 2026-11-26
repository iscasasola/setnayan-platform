## 2026-11-25 · fix(admin): final check area 8, batch 3: menus, search, times and plain words

Final check, area 8 fixer, batch 3 (lane A only; no amounts, plans or rules change):

- **A8·F-5**: "Live Watch channels" no longer sits in the Setup menu while its page is flag-dark (404). The view keeps
  its home and forward (`notInMenus`, same flag as the page's `notFound()`), so "every admin page has a home" still holds.
- **A8·D-8**: a comma or bracket in the Users or Venues search no longer breaks the read (`sanitizeIlikeTerm`, as the
  Events tab already does).
- **A8·A-23**: payout times print in Manila time.
- **A8·A-19**: "Set aside" with no reason picked says "Pick why to set it aside." instead of doing nothing.
- **A8·B-16**: a price kind with nothing on sale says so, not 'Nothing matches "".'
- **A8·I-10**: the sample-event switch's Default row says what the server default is, not "off" as fact.
- **A8·I-12**: the admin demand radar no longer promises a floor control that does not exist.
- **A8·C-5**: the team Help's "Message us" (which only jumps to the unanswered list) is labelled "See what is
  unanswered"; public Help keeps "Message us" (shared `help-ask` components take an optional `messageLabel`).

Guards: `lib/admin/live-watch-menu-follows-its-flag.test.ts`, `app/admin/accounts/a-comma-does-not-break-search.test.ts`,
`app/admin/batch-3-small-fixes-hold.test.ts`, mutation-checked.

SPEC IMPACT: None.
