## 2026-10-28 · feat(create-event): "Who is it for?" — your groups, business types only, no generic Celebration, "Ask us to add it"

Owner, verbatim: *"'Who is it for?' prototype: groups added, business types only, Celebration removed, 'Ask us to add
it' looks good."* and *"Other Event - no we need to be specific because the coverage of services."* (DECISION_LOG
2026-10-28 "EVENT TYPES MUST BE SPECIFIC"; prototype `prototypes/who_is_it_for_2026-10-28/`).

- **Your groups** — the "For ▾" dropdown lists the groups the account ORGANIZES (`fetchUserCommunities`, organizer
  rows — the create action refuses anyone else), under a "Your groups" heading. Picking one narrows the grid to the
  types a group may hold (`event_class = 'community_eligible'`, the shipped samahan rule) and the form posts
  `community_id` through the shipped samahan create path, so members see it on the group page.
- **Your business** — business types only: the shipped `for_whom` rule, plus no "Show all event types" doorway for a
  business or a group (it leaked every personal type). Rows sit under "Your business" with "Business events only".
- **Celebration** — hidden from couples for NEW events: migration `20271294233183` sets `enabled = FALSE` (the same
  switch as Admin › Event types › Status "Hidden from couples"); status stays active, no enum or stored value
  touched. Existing generic events get ONE line in Event settings, "Kind of event", to pick a specific type
  (`EventKindLine`, saved through the shipped `updateEventMatchCriteria` — a new `event_type_switch` door, written with
  the viewer's own session so RLS and the SEC-5 price-tier trigger still apply).
- **Can't find yours? Ask us to add it** — the grid's last row opens a sheet; the ask is one row in the new
  `event_type_requests` (RLS pattern A narrowed: insert your own open ask, read your own; admin resolves). It shows in
  Admin › Event types under "Asked for by hosts" with Add as new · It is ▾ · Close. When the type is "In the picker",
  each asker gets an in-app notice (`event_type_added`, its own enum migration `20271293446382`; NOT on the email
  allowlist). A host who started with the closest type sees the asked type on that event's "Kind of event" line.
- The group CHECK `events_community_class_consistency` is widened to gala_night · date · hangout, which their profiles
  already called community_eligible (a group picking one passed the app gate and was refused by the database).
- +0 exported server actions: the admin answers ride `setEventTypeStatus` / `createEventTypeRoster` (`request_id`),
  the switch rides `updateEventMatchCriteria`, the ask is an RLS-bound insert.
- Guards: `who-is-it-for-renders.test.ts` (the real picker, painted — one test per item), 
  `lib/event-types-must-be-specific.test.ts`, `tests/db/event-types-must-be-specific.db.test.ts`; each sabotaged once.

SPEC IMPACT: DECISION_LOG.md 2026-10-28 row "EVENT TYPES MUST BE SPECIFIC" — implementation note appended (where each
of the four items lives, the migration numbers, and the two deviations: groups = organizer groups only; no "Show all"
under a group). No locked decision changed.
