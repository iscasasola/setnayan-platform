## 2026-11-15 · fix(help): a help ask is written only when a person asks — never on a page render, at most once an hour

The ask-first Help logged every `GET /help?q=…` render into `help_asks` (service-role, signed out, no limit), so a
crawler, a link prefetch or a loop of GETs could fill the table. Now the ask box POSTs to the help's existing action
(`submitHelpMessage`, `intent=ask`; the team's help rides `setHelpMessageStatus`, `intent=ask`, after `requireAdmin`),
which finds the answer, writes the row and redirects to the same `?q=`. `logHelpAsk` checks for a row with the same
words + account + outcome in the last hour before inserting. No new server action, no migration change. Guarded by
`lib/help-asks-are-written-only-when-asked.test.ts` (no page/layout calls `logHelpAsk`; only the two actions write).

SPEC IMPACT: None.
