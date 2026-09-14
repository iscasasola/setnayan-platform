## 2026-09-14 · fix(guests): a typed name splits into prefix / first / middle / last / suffix

A guest typed as "Atty. Bob Casasola Jr." was stored with the **honorific as the
first name**. Every write path split the line with `words[0] = first, rest = last`,
so prod carried `first_name='Mr.', last_name='Antonio Loo'` — and, measured
2026-09-14, **30 of 100 guests** on the live roster had a bare title
("Mr.", "Atty.", "Judge", "Ombudsman") sitting in `first_name`. Multi-word titles
were torn in half: "Associate Dean Cecilio Duka" was stored as
`first='Associate', last='Dean Cecilio Duka'`.

**New:** `apps/web/lib/person-name-parse.ts` — one pure parser, used by all five
write paths. Designed against the real prod roster (a Philippine legal/academic
list), so it handles multi-word titles ("Regional Prosecutor", "IBP Governor"),
stacked titles ("ED Atty."), middle initials, surname particles ("dela Peña"),
hyphenated married surnames ("Sacdalan-dela Rosa"), the leading-vs-trailing `Sr.`
collision (Sister vs Senior), a title glued on with no space ("Mrs.Yolanda"), and
the `Ma.` trap — "Ma. Teresita" is *María*, a given name, and looks exactly like
`Mr.` to a naive abbreviation rule.

**Schema:** `guests` gains `name_prefix`, `middle_name`, `name_suffix` — all
NULLABLE with no default. Absent means absent; only `first_name`/`last_name`
remain NOT NULL, and both parsers back off rather than let a title or suffix
consume the only word.

**Wired:** capture bar (`guest-parse.ts`), quick-add sheet, detailed
`/guests/new` form, CSV import, and the guest detail editor — where clearing a
box removes a part, so a wrong auto-split can always be corrected by hand.

**Not included:** the backfill of the 40 existing rows this parser would rewrite.
They are live guests on a real event and are applied as a separate, owner-reviewed
step — a schema migration is the wrong place to silently rewrite people's names.

SPEC IMPACT: None — no locked decision covers guest name structure. The guest
schema shape lives in the repo, not the corpus.

**Exposure baseline:** re-based, +3 lines. The three columns carry `anon=SIU
authenticated=SIU` — byte-identical to the `last_name` line directly above them,
because `guests` is granted at TABLE level (verified against prod) and RLS is
row-level. A title is no more sensitive than the name it precedes, and narrowing
was not available: a column-level REVOKE against a table grant is a silent no-op.
