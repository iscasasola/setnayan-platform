## 2026-08-18 · fix(guards): the switch detector asked two file-level questions, never the same statement

**The guard that catches "a switch nobody can press" could not see the switch
becoming un-pressable.** Found by another session on PR #4535 and independently
re-proved here before acting.

`gateWritersOf`'s direct branch was:

```ts
.filter((s) => writesTable(s.code, table) && namesColumnAsField(s.code, column))
```

Two **file-level** predicates joined by `&&`: does this file write that table
*anywhere*, and does it name that column as a field *anywhere*. **Never the same
statement.**

**Measured on main, by mutation:** deleting the only real write of
`events.archived` left the suite **10/10 GREEN**. The detector reported **three**
writers for that column where exactly one exists — `chat-actions.ts` has a local
variable of that name writing a *different* table, and `events.ts` has it as a
type field and in a select list.

🔑 **TWO CORRECT PREDICATES ANDED AT THE WRONG SCOPE ARE NOT A CORRECT
PREDICATE.** Each half was carefully written, commented, and separately right.
The join is what made them blind. This is the failure shape the guard exists to
catch, occurring inside the guard.

**The helper branch had the same fault one level along** — "names the column
anywhere" AND "calls any exported function from any file that writes this table
anywhere". Dozens of files write `events`, so it degenerated into "mentions the
column and calls something": with the real writer sabotaged it returned **six**
files, none of which write that column.

Both branches are now **statement-anchored**, and the span is **brace-matched**
rather than budgeted — a `[\s\S]{0,600}` window reads past the payload's closing
brace into the `.select(...)` on the next line, and silently shrinks the moment
somebody writes a long comment inside the payload. Two guards in this repo
passed today for exactly that reason.

⚠ **AND THE FIRST TIGHTENING WAS TOO STRICT, WHICH IS THE WORSE DIRECTION.** A
guard that cries wolf about real code teaches the next person to baseline it.
Measured at each step: 26 columns newly reported "no writer", and the ones
spot-checked all had perfectly good writers that build the payload first
(`.update(payload)`), so payload-variable and `Object.assign` resolution were
added — 26 → 20 → **17**. One of those steps mattered on its own:
`admin/settings/actions.ts` declares `const payload = {…}` **twice**, and only
the second carries `gcash_enabled`; an `.exec` found the first, saw no column,
and reported a live admin toggle as having no writer at all. **`matchAll`, not
`exec`.**

**Verified in both directions:** all five directly-written registered switches
still resolve to their real writer file, and sabotaging each one now turns the
suite RED — including `events.archived`, which was green on main.

### The bill this uncovers: 14 columns

3 of the 17 are written by a database function (checked against **production**
via `pg_proc`, not inferred). The remaining **14 are switch-shaped columns with
nothing in the product that can flip them**, which the loose detector was hiding.
They are declared in `tests/db/gates-have-handles.baseline.txt` as a marked
block, with what is measured (no app writer under statement-anchoring; no SQL
writer in prod) and what is **not** (per-column triage). They are not silently
absorbed and the block says explicitly that it is not precedent for a blank
reason on a new column.

SPEC IMPACT: None.
