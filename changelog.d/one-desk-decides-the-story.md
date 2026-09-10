## 2026-09-09 · feat(story): one desk where the host decides everything

Build order `08` step **1.2**. One queue over four sources — Kwento wishes,
guest letters, challenge answers and what a supplier sent — on
`/dashboard/[eventId]/story`. Accept · edit · reject · undo, each written back
to that source's OWN status column. **Reject is silent**: nobody is told,
nothing is deleted, and undo is a complete restoration at any time.

### The brief was wrong, in the dangerous direction

`03_Data_Requirements.md` § Bonus said all four sources "each [have] their own
status column" and that "nothing new is stored". Measured against production,
**two of the four had nowhere to record a host decision at all**, and they
failed in opposite directions:

* a **challenge answer went public the moment the GUEST consented** — the host
  was never asked;
* a **supplier's frame published itself unless hidden**, and its only lever
  (`hidden_by_couple`, `DEFAULT FALSE`) has never had a writer — so the control
  the design assumed existed did not.

Migration `20271214724787` gives both a `status` born `'pending'`; the public
readers now require it. Monotone — both sources can only ever show LESS. Safe
by arithmetic: all four tables held **0 rows** in production at the merge.

### The grants were the load-bearing half

🪤 `role_table_grants` reports `authenticated` holding **no UPDATE** on
`editorial_vendor_media`. The grant is held **per column, on all 14** — a
table-level audit reads that table as closed while it is open. Both tables are
handled at column level: the mission table's table-wide UPDATE is revoked first
(that is what drops column grants) and re-granted on `status` alone, **8 → 1**,
so a host can no longer write `consent_to_share`, which is the GUEST's own
RA 10173 opt-in. The 14 pre-existing grants on the vendor table are **named and
deliberately NOT narrowed** — they predate this work and narrowing a live grant
is its own change.

### A held-back capture cannot be accepted by ANY route

The host holds `UPDATE (status)`, so an app-side check is advisory — they can
PATCH PostgREST directly. The refusal is a database trigger, mirroring
`consent-veto.ts` and monotone the same way; the supplier half is a CHECK in
the same shape as the shipped `approved_needs_screen`. It refuses **only the
transition to `approved`**, so a late veto can never strand a row.

### Four defects CI found that per-file test runs had hidden

* **`guests.full_name` does not exist.** PostgREST fails the whole query with
  `42703`, so **every byline would have resolved to null forever** — a guest who
  asked to be named would never have been named, and nothing would have thrown.
* **`.from(variableTable)` blinded two scanners.** It is a select `T1` cannot
  check (which is what hid the bug above) and it made `gate-writers` read the
  file as writing every table it can reach. Every table name is a literal now.
* **`col = TRUE` in a trigger reads as a WRITE.** `gates-have-handles` scans
  function bodies with `\mcol\M\s*=[^=]`, which a comparison matches — so the
  trigger registered as a writer of `consent_to_public` and retired a baseline
  line about a **different table**. Both columns are `NOT NULL`, so the bare
  boolean form is exactly equivalent. Second migration in this repo to pay for
  this; the trap is recorded in the migration itself.
* **Six reads did not bind their `.error`.** A refusal is indistinguishable
  from "you have none"; each is bound, logged, and where it changes what the
  host is looking at, said on screen.

🔑 **All four are repo-wide guards that only fire over the WHOLE suite.** They
were missed because the suite was run file by file.

### Deliberately not in this step

The "We made" lane (generated copy lives in `event_editorial.draft_json` —
step 1.3), and partial accept on a capture SET: the split arithmetic and its
sentence are built and tested, but no source in these four tables yet delivers
a multi-capture set, and a button that opens nothing would be a lie.

SPEC IMPACT: `03_Data_Requirements.md` § Bonus corrected in the corpus — "each
with its own status column" and "nothing new to store" were both false for two
of the four sources, and `editorial_vendor_media`'s host lever is described as
existing when it has never had a writer. `08_Build_Order.md` steps 1.1/1.2
annotated with what shipped and what is deliberately left.
