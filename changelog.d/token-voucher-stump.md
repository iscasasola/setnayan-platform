## 2026-08-18 · fix(admin): the last token wallet leaves the voucher screen

The owner opened his discount codes and asked *"why did I see a token wallet?"* — a currency
retired on 2026-07-21.

**What he saw, and why it was the ONLY thing that screen could show him.** Production held
exactly **one** voucher, and it was a token-granting one: `TESTGTK1`, created 2026-05-29,
**expired 2026-06-28, never once redeemed**. Opening it to edit rendered *"Tokens granted per
redemption"* and *"credited to the vendor's wallet"*.

🔑 **THE 2026-08-07 RETIREMENT TOOK THE OPTION AND LEFT THE EDITOR.** It removed the radio that
CREATES a token voucher and deleted the vendor's sidebar token counter — both correct. It did not
remove the fields that EDIT one, or the parser that accepts one. **A removed create-option only
stops NEW rows; the existing row is what renders.** This is the **fifth** time a retired feature
has resurfaced through a surface nobody counted as part of it.

**Removed:** the token inputs (91 lines of JSX), the dead state and props, the parser branch, the
two covered-services bypasses, and the accepted-types entry. **The one row was deleted from
production** (owner-approved) after checking nothing referenced it — 0 redemptions, 0 eligibility
rows, and the two foreign keys resolve to nothing. The voucher table is now empty.

⚖ **THE EDITOR REFUSES A RETIRED-TYPE VOUCHER RATHER THAN COERCING IT.** The DB enum still permits
the value, so a row could in principle carry it. Quietly re-labelling it as a percentage voucher
would **silently change what a money-adjacent object does**. It 404s instead: an editor that cannot
edit a thing should not open on it.

⚖ **The two columns are still written as an explicit `null` on every path, deliberately.** They
remain on the table and in its CHECK constraint, and an OMITTED column keeps its old value on an
UPDATE — so nulling is the safer shape, not laziness. The audit trail still records the prior
value, because an audit that cannot say what a value WAS is not an audit.

🪤 **THE GUARD'S FIRST CUT REPORTED EVERY CORRECT LINE AS AN OFFENDER.** `token_grant_count\s*:\s*(?!null)`
matched `token_grant_count: null` — because `\s*` can match **zero** characters, leaving the
lookahead staring at the SPACE before `null`, and a space is not "null". 🔑 **When a pattern must
judge a VALUE, extract the value and compare it; never ask a regex to assert a negative across
optional whitespace.** Rewritten to parse each assignment and allow exactly three shapes.

🛡 **4 mutations, each measured by occurrence count, all RED:** the currency offered again in the
form (1→2) · a token value written instead of null (7→6) · the editor's refusal removed (2→1) ·
a vendor screen reading a wallet (0→2).

📊 **What is left, and named rather than skipped:** 5 vendor wallets, 6 grants, 5 earned vouchers
and 5 reward rows still sit in the database from testing — **0 purchases, 0 redemptions, 0 boosts,
ever**. Nine token tables remain. No screen reads any of them; dropping them is a migration this
change does not attempt.

SPEC IMPACT: `DECISION_LOG.md` row 2026-08-18. One production row deleted (owner-approved). No
migration, no schema change.
