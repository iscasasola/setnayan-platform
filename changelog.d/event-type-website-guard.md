## 2026-08-09 · fix(admin): an event type can no longer be saved with a dead public page

**Item 81.** The admin "Onboarding profile" editor let someone save an event type with the
day-of page and/or the gallery switched ON while the website was OFF. Both of those pages
*render on* the couple's public event site, and `website` is the surface that makes that site
editable and carries the ONLY "go live" control in the product. The combination produces a
page nobody can ever open — the exact dead end the owner hit on `simple_event`
(2026-08-02, *"the host of the event cannot launch his on the day website"*).

Migration `20271102084500` repaired the rows that existed at that moment. Nothing stopped the
next save from putting one back — and the editor's own default prefill for a brand-new event
type omitted `website`, so it actively handed the admin the broken combination.

**What changed**

- `apps/web/lib/event-type-profile.ts` — new `SURFACES_THAT_RENDER_ON_THE_WEBSITE`
  (`day_of`, `gallery`), `surfacesStrandedWithoutWebsite()` (raw surface list, for the
  FormData selection), `profileSurfacesStrandedWithoutWebsite()` (reuses the existing
  `surfaceEnabled`), and `strandedWithoutWebsiteMessage()` for the admin-facing copy.
- `apps/web/app/admin/event-types/actions.ts` — `upsertEventTypeProfile` now **refuses** a
  violating combination and redirects with a clear error, **before** the row reaches the
  database. Deliberately a refusal, not a silent auto-tick: the admin must see which choice
  they are making.
- `apps/web/app/admin/event-types/[eventType]/profile/page.tsx` — the new-event-type prefill
  (`GENERIC_SURFACES`) now includes `website`, so the default is a combination the save path
  accepts rather than one it immediately rejects.

**Guards (both mutation-tested)**

- `apps/web/lib/event-type-website-surface-guard.test.ts` — the rule itself, every hardcoded
  fallback profile, the refusal copy, and two source assertions scoped to the extracted
  `upsertEventTypeProfile` **body with comments stripped**: the check exists, it redirects
  with an error, and it runs *before* `.upsert(`. Plus a parse of the editor prefill so the
  default can never drift back into a shape the save path refuses.
- `apps/web/tests/db/event-type-website-surface.db.test.ts` — replays every migration into
  PGlite and reads the real `event_type_profiles` table, so **every event type the migrations
  actually produce** is checked, not a hand-maintained code roster. `resolveProfile` prefers
  the DB row over the hardcoded profile, so the seeded row is what prod reads. Carries a row-
  count floor and a "some row actually enables a dependent surface" check — an empty or failed
  read must fail loudly rather than satisfy the invariant vacuously.

| # | Sabotage | Result |
|---|---|---|
| 1 | delete the check from `upsertEventTypeProfile` | RED — save-path test |
| 2 | move the check to *after* the `.upsert(` | RED — ordering assertion |
| 3 | revert `website` out of the editor prefill | RED — prefill test |
| 4 | make `surfacesStrandedWithoutWebsite` always return `[]` | RED — rule test |
| 5 | seed an event type (`gala_night`) without `website` in the last migration | RED — db test, named the type |
| 6 | empty `event_type_profiles` entirely | RED — row-count floor (did not pass vacuously) |

SPEC IMPACT: None. This enforces an existing owner decision (2026-08-02, migration
20271102084500) at the save path; it introduces no new product rule, price or scope.
