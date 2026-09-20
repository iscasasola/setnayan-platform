## 2026-09-20 · fix(security): the shared SQL comment stripper now strips block comments

**The miss.** `stripSqlComments` (`lib/security/events-column-privileges.ts`) — shared by
`events-column-select-privileges.ts`, `events-private-details.ts`, and `lib/ugat/both-ends.ts`'s
`sqlWords()` (the function that decides whether a DB function or table "has a caller") — only
ever blanked `--` line comments. A name mentioned ONLY inside a `/* … */` block comment read as a
real reference, which is exactly the shape of miss that lets a genuinely orphaned RPC or table hide
from the both-ends checker: a function whose sole mention of another name sat in
`/* legacy note: used to call orphan_fn() */` made `orphan_fn` look called. Reproduced directly
against `sqlWords()` before this fix landed (see `both-ends.test.ts`).

**The fix.** Replaced the two-line-per-line regex with a single-pass character scanner (the SQL
analogue of `lib/strip-comments.ts`'s TS/JS lexer), so it never falls into the well-documented wrong
shape (`.replace(/\/\*…\*\//g,'').replace(/--.*$/gm,'')`, which strips block comments FIRST and lets
a `--`-shaped glob this codebase writes constantly — `-- apps/web/app/dashboard/[eventId]/date-selection/*`
— open a fake comment that eats real code to the next real `*/`).

Handles:
- `--` line comments, `/* … */` block comments **with Postgres's own nesting** (a depth counter,
  not the first `*/` — Postgres block comments nest, unlike C),
- single-quoted strings with the SQL `''` escape, scanned once over the WHOLE text rather than reset
  per physical line (the old per-line reset silently broke on a string holding a real embedded
  newline),
- dollar-quoted bodies (`$$ … $$`, `$tag$ … $tag$` — every `DO $$ … $$` and `CREATE FUNCTION … AS
  $$ … $$` in this repo's migrations is one). The boundary is found the way Postgres itself finds
  it — a literal search for the same tag reappearing, nothing inside consulted — so one mismatched
  apostrophe inside a function body (a comment reading `-- don't do this`, written constantly) can
  never desync tracking for the rest of the file. The interior is then recursively stripped, so a
  block comment inside a dollar-quoted body is also blanked. A positional parameter (`$1`, `$2`) is
  never mistaken for a tag.

Deliberately not handled, both in the safe direction (never eats real code): an unterminated block
comment or dollar-quote body is not treated as one (mirrors `lib/strip-comments.ts`'s "never closed
⇒ not a comment"), and Postgres's `E'…'` backslash-escaped strings are scanned as plain `'…'`
strings (only `''` doubling is honoured).

Caught one real bug while building this: the first draft never wrote the CLOSING dollar-tag's
characters back into the output, so `"$$"` silently became `""` on join — corrupting every
downstream consumer that re-searches the cleaned text for its own closing tag
(`h6-mirrors-the-booking-path.test.ts` caught it immediately). Fixed and pinned with a regression
test before this shipped.

**Verified no consumer regressed.** Ran every unit test that imports this function
(`events-column-privileges.test.ts`, `events-column-select-privileges.test.ts`,
`events-private-details.test.ts`, `both-ends.test.ts`, `a-payment-can-be-refused-too.test.ts`,
`h6-mirrors-the-booking-path.test.ts`, `the-hold-limit-counts-every-couple.test.ts`) plus the
db-replay suites (`events-column-privileges.db.test.ts`, `events-private-details.db.test.ts`,
`events-guest-read-scope.db.test.ts`, `ugat-both-ends.db.test.ts`) — all green.

**Table-driven + sabotage-proof tests added** in `events-column-privileges.test.ts`: every tricky
case above (nested block comments, `*/` inside a string, the `''` escape, a `--`-shaped glob inside
a real comment, a `--` inside a block comment, a block comment inside a `$$`/`$tag$` body, a stray
apostrophe inside a dollar body, unterminated block comment/dollar-quote), each proven against a
deliberately-broken local variant (line-comments-only, the two-regex-passes shape, no-nesting,
per-line reset, no-dollar-quote-awareness) that fails the same assertion the real function passes.

**Orphan count against the real corpus.** Ran `ugat-both-ends.db.test.ts` before and after: the
honest count did not move (still 44 real findings — `rpc: 11`, `table: 16`, `notice: 3`,
`component: 3`, `result-dropped-silently: 11`). None of the migrations' block comments happen to
mention an otherwise-truly-orphaned name today, so no baseline edit is needed here. If PR #5757 (the
44-row re-baseline with `EXPECTED_BASELINE_ROWS`) merges first, this PR is a pure text-fix with no
baseline interaction; if this merges first, #5757's re-sweep will observe the same 44.

SPEC IMPACT: None.
