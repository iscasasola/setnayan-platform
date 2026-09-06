## 2026-09-07 · fix(guards): two blocking guards could not catch what they were written for

Mutation-tested all 24 blocking guards in `ci.yml` — break the thing each one
claims to protect, confirm it goes red, restore. **21 hold. 2 were decoration in
one specific spelling. 1 (the Rust encoder suite) was not exercised.**

**`lint-radius.mjs` — single quotes only.** The inline pattern read
`borderRadius:\s*'\d+px'`, so `borderRadius: "13px"` walked straight past it.
Double quotes are ordinary in TSX. Same file, same value: single-quoted went
red, double-quoted went green.

**`lint-no-function-level-custom-set.mjs` — the CREATE form had to be on its own
line.** `FUNCTION_LEVEL_SET` is `^`-anchored, justified in-file by *"it is
always on its own line at statement level"*. That is an assumption about
FORMATTING, and nothing here enforces migration formatting — Postgres accepts
the whole `CREATE FUNCTION … SET setnayan.x TO 'on' AS $fn$ … $fn$;` on one
line. The same statement, split across lines, went red; on one line, green.

🔑 **The file already knew this lesson one pattern lower.** `ALTER_LEVEL_SET`
exists precisely because *"a guard that catches one spelling of a trap teaches
you that the trap is handled"* — and it is deliberately not line-anchored. The
CREATE half never got the same treatment. New `CREATE_LEVEL_SET` is scoped to
the signature region (`(?:(?!\bAS\b)[^;])*?`) so a legal `SET LOCAL` inside a
body cannot be dragged into a failure — verified: it stays green.

Both fixes verified in both directions: each now catches the form it missed AND
the form it already caught, all 23 node guards re-baselined green on clean code,
and the `SET LOCAL` false-positive case checked explicitly.

⚠ **A note on method, because it nearly produced false findings.** Six of my
first mutations "missed" and every one was MY error, not the guard's — wrong CSS
class, a column outside the guard's pattern, a server component where a client
one was needed, a route outside the scanned roots, `README.md` picked as "the
last migration", an edit that silently never applied. **A mutation that does not
land is indistinguishable from a guard that does not fire.** Every result here
was confirmed by asserting the file actually changed and by reading the guard's
own scope first.

⚠ **NOT EXERCISED: `cargo test -p setnayan-encoder`.** It is a real test suite
rather than a source scan, and mutating it needs a Rust build. Its ability to
fail is unverified.

SPEC IMPACT: None.
