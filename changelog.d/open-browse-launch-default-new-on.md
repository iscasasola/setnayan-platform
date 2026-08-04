
---

## 2026-08-04 · CI unblocked — the guard that failed IS the hold this PR releases

`open-browse-schema.db.test.ts` asserted *"events.website_open_browse defaults FALSE
(the go-live hold)"*. That is exactly the hold migration `20271102765509` releases, so the
failing check was the guard working, not a defect. Inverted to assert TRUE, with the old
wording kept in a comment so the next reader knows the flip was deliberate.

**Added a launch-safety test that was missing.** The council's *"no backfill"* rule — an
in-flight wedding must never have her guest site reshape overnight — is the reason this is
safe to merge, and **nothing asserted it**. The migration is a bare `SET DEFAULT`, which by
definition cannot touch existing rows, but a future "helpful" `UPDATE` appended to the same
file would have shipped silently. The new test creates an event with `FALSE`, re-applies the
launch migration verbatim, and asserts it still reads `FALSE`.

8/8 db tests pass. **Auto-merge deliberately NOT armed** — the PR title says the owner merges
this to go live, and merging flips the guest website on for every newly-created event.

⏭ **Reminder for whoever merges:** verify the OBJECT afterwards, not `schema_migrations` —
`SELECT column_default FROM information_schema.columns WHERE table_name='events' AND
column_name='website_open_browse';` must read `true`. And set
`NEXT_PUBLIC_WEBSITE_MENU_ENABLED='true'` in the same window, or new open-browse events ship
without the nav to browse them.

SPEC IMPACT: None until merged. Merging is the documented go-live step.
