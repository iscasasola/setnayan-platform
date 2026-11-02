## 2026-07-26 · fix(security): guests can no longer read the couple's birth dates, budget or wizard state

**SEC-2b** — the row-level follow-up `20271007100000` (SEC-2) named and
deferred. Verified against production: `has_column_privilege('authenticated',
'public.events', …, 'SELECT')` returned TRUE for `partner_a/b_birth_date`,
`partner_a/b_birth_time`, `bazi_birthdata_consent_at`,
`estimated_budget_centavos`, `budget_band`, `wizard_state`, and
`photo_delivery_folder_id` / `_folder_name` / `_account_email`.

A wedding **guest** holds the `authenticated` role and is admitted to the
couple's `events` row by `public.current_event_ids()` (no `member_type` filter).
The dashboard UI hides all of this — `app/dashboard/[eventId]/layout.tsx:115`
`notFound()`s anyone who is not `member_type='couple'` or an accepted
`event_moderators` row — but the guard was in the UI, not the data layer. The
anon key is public, so a guest with their own session could simply
`GET /rest/v1/events?event_id=eq.<event>&select=partner_a_birth_date,
estimated_budget_centavos,wizard_state`.

Owner intent, verbatim: *"guests cannot see budget and birthdate. just event
date."*

**Why the obvious fix does not work.** Postgres RLS is ROW-level — a policy
cannot say "this session sees 181 of the 192 columns" — and the couple reads
these same columns with the SAME `authenticated` role as the guest, so neither
a policy re-scope nor a bare `REVOKE` can separate them.

**Fix — column REVOKE plus a host-scoped definer view.**

1. `REVOKE SELECT` the eleven columns from `authenticated` + `anon`. A column
   privilege is checked *before and independently of* every policy, so one
   revoke closes them against all three SELECT policies at once (member /
   moderator / **community** — the Samahan policy hands the full row to every
   co-member), every future policy, every PostgREST embed from the 152 FK'd
   tables, `select=*`, and the `WHERE` / `ORDER BY` blind-search oracles.
2. `public.events_host` — a `security_invoker = false` view over `events` whose
   `WHERE` admits only `member_type='couple'` or an accepted, non-removed
   `event_moderator`. That predicate is an exact mirror of the authorization the
   dashboard layout already performs, so **who** can read these columns is
   unchanged; the check simply moves into the database. Guests, plain
   `member_type='coordinator'` members and Samahan co-members get zero rows.

A view rather than a `SECURITY DEFINER` RPC because the host readers are spread
over 13 files and ~30 call sites that each select a *different* mix of private
and public columns — against the view each is a one-token edit
(`.from('events')` → `.from('events_host')`) with select string, filters and row
shape untouched. An RPC would have forced every one of them to split into two
queries and re-assemble the row.

**Two traps handled explicitly.** (a) The allow-list is computed as *"every
column this role can already read, minus my deny-set"* — recomputing it from the
full catalog the way SEC-2 did would have silently **re-granted**
`master_qr_token`; post-condition (b) and a DB test pin the union. (b) A
single-table view with a simple `WHERE` is **auto-updatable**, and this one runs
with definer rights, so only `SELECT` is granted — an `UPDATE` grant would have
bypassed `couple_can_update_event` and RLS entirely.

**Writes are untouched.** `couple_can_update_event` was already scoped to
`current_couple_event_ids()`; every writer does
`.update({…}).eq('event_id', …)` with no private column in its `RETURNING`, and
all four `events` INSERT sites narrow to `event_id` / `slug`. The migration
snapshots `authenticated`'s UPDATE/INSERT privileges *before* the revoke and
diffs against them, rather than asserting a guessed list — the first draft
guessed and the post-condition caught it.

**Readers moved onto `public.events_host`** (13 files):
`dashboard/[eventId]/details/page.tsx` · `budget/page.tsx` ·
`date-selection/page.tsx` · `vendors/page.tsx` ·
`vendors/build-3state-actions.ts` · `studio/photo-delivery/page.tsx` ·
`_components/event-dashboard.tsx` · `wizard-actions.ts` (all 17
read-modify-write cycles; the writes stay on `events`) ·
`dashboard/(account)/create-event/actions.ts` · `api/profile/export/route.ts`
(the one `event_members → events(…birth data)` **embed**, split into a
membership query + a view read to keep the RA 10173 export at couple grain) ·
`lib/checklist-budget.ts` · `lib/budget-allocation-data.ts` ·
`lib/wedding-roadmap-signals.ts`. Everything on the service-role client — the
Drive pipeline, the RA 10173 erasure, the audit before-image, the vendor Event
Brief, `admin_market_analytics` — is unaffected.

**Tests are mutation-checked.** `tests/db/events-private-details.db.test.ts`
replays the full migration corpus into PGlite, applies SEC-2 then SEC-2b in
order, and runs as a genuinely unprivileged role (`SET ROLE authenticated` +
`request.jwt.claims`), with a META probe asserting `current_user` is
`authenticated` with no `BYPASSRLS` and no table ownership. **Removing the fix
fails 12 of its 19 subtests**; neutralising only the `REVOKE` (keeping the view)
fails 4 of 19; the exact recipes and surviving-control rationale are recorded in
the test-file header for whoever relaxes the guard later. Two COVERAGE tests
assert against the live catalog that every `events` column is either granted or
deny-listed, and that everything readable on the base table also exists on the
view — so the apply-time snapshot cannot rot when a column is added.

- `supabase/migrations/20271008731642_events_private_details_guest_lock.sql`
- `apps/web/lib/security/events-private-details.ts` (+ `.test.ts`, 21 tests
  including 12 that mutate the real migration text)
- `apps/web/tests/db/events-private-details.db.test.ts` (19 tests)
- `apps/web/lib/security/events-column-select-privileges.ts` —
  `NOT_DENIED_FOR_SELECT` re-labelled as SEC-2-historical, not current truth
- `apps/web/tests/db/events-guest-read-scope.db.test.ts` — scope note on the
  host-read assertion (that suite builds the schema at the SEC-2 point in time)

**Rebase onto `main` — the twelfth column, and the tripwire that found it.**
`20271007917549` (SEC-5) added `events.setnayan_ai_tier_at_purchase` after this
branch was cut. It arrived already SELECT-denied — a column added after SEC-2's
table-level `REVOKE` inherits no privilege, because Postgres enumerates column
privileges at `GRANT` time — and post-condition **(h)** refused to apply this
migration until somebody decided which side it belonged on. Classified
**PRIVATE** (host-only): it records the price *tier* the couple **bought**
Setnayan AI at, which is commercial information about the host, and nothing in
`apps/web` reads it from an authenticated client at all (the only reader is
`tests/db/setnayan-ai-tier-lock.db.test.ts`, as `service_role`), so putting it
behind `events_host` costs nothing. It also carries an oracle the live
`event_type` does not: it is NULL until the entitlement first activates and it
preserves the ORIGINAL tier across an admin re-type. The deny-set is now
**twelve** columns.

**`DROP COLUMN` on `public.events` now needs the view out of the way.**
`events_host` projects every column, so it is a dependent object of all of them
and any `ALTER TABLE public.events DROP COLUMN` fails `2BP01` from here on
(`CASCADE` is the wrong reflex — it drops the view and leaves host readers
`42P01`ing behind a green migration). Two DB suites that simulate a historical
schema state by dropping an `events` column were updated to drop the view first:
`tests/db/facebook-watch-url-grant.db.test.ts` and
`tests/db/open-browse-schema.db.test.ts`. The sequence is recorded in the
migration's maintenance note.

**Export route — error-first, so `?? []` is gone rather than excused.** The
split of the `event_members → events(…birth data)` embed introduced
`const ids = (owned.data ?? []) …` with the error checked two lines below it.
Harmless as written, but `T9` in `lib/export-coverage-guardrail.test.ts` is a
SHAPE guard and it was right to reject it: unwrapping a possibly-null `data`
*upstream* of the only check that distinguishes "the read failed" from "you own
no events" is one reordered edit away from a subject-access file that silently
asserts the couple has no birth data on record. Fixed in the route, not in the
guard — the error is now checked first and handed straight to `listOutcome()`,
which names the section in `not_included` and flips `export_complete`. The
allow-list in T9 was **not** widened.

SPEC IMPACT: `DECISION_LOG.md` — 2026-07-26 row recording that the twelve
private `events` columns are off the guest surface and that `public.events_host`
is the host read path.
