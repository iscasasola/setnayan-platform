## 2026-11-14 · fix(admin): Problems lines say what the call did · Work counts the problems the page lists

- **RW-285d** — a Problems line took its verb from the fault's kind, so a DELETE read "Saving the samahan stories",
  a background refresh read "Saving the refresh bottleneck signals", and a refused `get_…` read "could not save".
  The verb now comes from the call (Loading · Removing · Refreshing · Checking · Saving) and the outcome words agree
  with it. A tapped label no longer carries an avatar's hidden initial glued to the name ("IIndalecio"): the capture
  skips `aria-hidden` text and separates pieces, and rows already stored are mended on display.
- **RW-285e** — Work counted raw open rows (71) while Problems lists them merged (67). The Work count now runs the
  page's own merge (`lib/telemetry/problem-merge.ts`), so both say the same number.
- Guards: `a-problem-line-says-what-the-call-did`, `work-counts-the-problems-the-page-lists`; the F-A-16 line in
  `the-admin-walk-2` now expects "Loading … could not load" for a refused `get_…` call.

SPEC IMPACT: None — admin wording and one count; no new rule.
