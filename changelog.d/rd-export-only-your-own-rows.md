## 2026-10-01 · fix(privacy): "Download my data" exports only your own face-tag and godparent rows

The RA 10173 self-serve export (`apps/web/app/api/profile/export/route.ts`)
read `guest_face_enrollments` with no subject filter and trusted RLS — whose
host arm admits every guest's row at the couple's events (and whose
`is_admin()` arm admits every row). A couple's own data file therefore carried
the face-tagging records (consent/provenance metadata, never `face_vector`) of
every guest at their events. The read now resolves the caller's own guest rows
(`event_members.guest_id` where `user_id` = the session uid — the same link the
erasure purge walks) and reads only those, via the new
`apps/web/lib/export-own-face-enrollments.ts`. Owner, 2026-10-01: "yes fix it
now". The DECISION_LOG row records zero enrolments in prod at the time.

Same audit, second hit: `godparents` was also read unfiltered, and
`godparents_owner_all` admits `is_admin()` to every family's godparent names
and emails. Now explicit: `owner_user_id` = the caller, or a dependent the
caller claimed (the `godparents_subject_read` lane). Every other read on the
route already carried an explicit subject filter.

Guards: `apps/web/lib/export-reads-are-subject-scoped.test.ts` isolates every
`.from()` chain on the route and requires that chain to carry its table's named
subject anchor (36/36); `apps/web/tests/db/a-hosts-export-has-no-guests-face-records.db.test.ts`
runs the real read under a host's RLS session: 1 own row, 0 guests' rows.
`tests/db/pglite-postgrest.ts` gains `.order()`.

SPEC IMPACT: None.
