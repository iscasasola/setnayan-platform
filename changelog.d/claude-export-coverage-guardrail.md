## 2026-07-21 · fix(privacy): export the two missing user-data tables + add an export-coverage guardrail

`app/api/profile/export/route.ts` (the RA 10173 data-subject export) was missing
`event_vendor_working_notes` and `coordinator_broadcasts`. Both are now exported —
and, critically, both are **author-scoped, not event-scoped**:

- **`event_vendor_working_notes`** → `.eq('author_user_id', user.id)`. Migration
  `20270825279091` deliberately inverts Pattern B — `evwn_couple_select` predicates on
  `visibility = 'shared'`, so the couple cannot read a coordinator's private notes even
  on their own event. Event-scoping would therefore return a silently PARTIAL set to a
  couple and, for a coordinator working several events, sweep in other people's notes.
  Even a `'shared'` note has exactly one author; the other party only reads it, so
  event-scoping would drop the coordinator's words into the couple's subject-access
  file — a third-party disclosure.
- **`coordinator_broadcasts`** → `.eq('sender_user_id', user.id)`. One sender, many
  readers (`coordinator_broadcasts_member_read` gives every event member read). The
  message text is the SENDER's personal data; an event-scoped read would hand every
  guest the couple's and coordinator's announcements as if they were the guest's own.

New guardrail `apps/web/lib/export-coverage-guardrail.test.ts` makes this class of
omission impossible to reintroduce silently. It parses every `CREATE TABLE public.*` in
`supabase/migrations`, identifies the tables carrying a subject-identifying `*_user_id`
column (107 of 344), and asserts each falls into exactly one of three per-table buckets:
**EXPORTED** (derived from the route source), **DELIBERATE_EXCLUSIONS** (12 — the
account holder is not the data subject, or the row is a bearer secret), or **KNOWN_GAPS**
(82, each prefixed `TODO(RA10173-backlog):` so they are greppable and countable, with a
ratchet that may only go down). A new user-data table now defaults to a RED test instead
of a silent omission, and a pinned gap that later gets exported forces its own deletion.
The heuristic's limits (DO-block/dynamic-SQL tables, odd column formatting, and the
unenforced 92-table `event_id`-only tier) are documented in the test's header rather
than papered over.

Honest scope: this PR closes 2 of ~99 in-scope tables. The 82-entry backlog is a true,
pre-existing RA 10173 shortfall the guardrail surfaces — not a regression it introduces.

SPEC IMPACT: None (no SKU/schema/pricing change; the RA 10173 backlog surfaced by KNOWN_GAPS should be noted at the bottom of DECISION_LOG.md by the owner).
