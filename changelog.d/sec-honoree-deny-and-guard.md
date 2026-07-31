## 2026-07-30 · fix(security): deny the honoree columns to guests — and rewrite the life-event guard first, because the revoke alone would have deleted the wedding cap

`events.signature_details`, `honoree_label` and `honoree_dependent_id` were readable by **any** event member. `current_event_ids()` is `SELECT event_id FROM event_members WHERE user_id = auth.uid()` with **no member-type filter**, so guest, vendor and coordinator all qualify. `signature_details` is the per-type onboarding payload — for a christening the child's **birth date and sex**, for a gender reveal the **due date**. RA 10173 sensitive personal information, one PostgREST call from anyone who scanned the couple's QR.

`20271008731642` had already locked birth data, budget, `wizard_state`, the Drive folder and the AI tier. These three were missed. They were protected only by a comment in `20270821100000` saying they are *"never rendered on public/vendor/guest surfaces"* — **a comment is not a grant.**

### The part that matters more than the revoke

`create-event/life-event-guard.ts` read those columns through the RLS client as:

```ts
const { data } = await supabase.from('event_members').select('events:event_id(… honoree_label …)')
```

The error was **destructured away**. Revoke the columns and PostgREST errors → `data` undefined → `(data ?? [])` empty → `findBlockingLifeEvent([])` returns null → **"not blocked."**

The one-in-planning cap — debut · christening · birthday · graduation · gender_reveal, one per honoree — would have become **unlimited**, silently, with **green CI**, because nothing checked or logged the error. A security fix would have deleted a product rule the owner had just described as load-bearing. That is why the revoke and the rewrite are one commit and must never be split.

**Two more readers degraded the same way**, both `const { data }` on the base table:

| File | What breaks silently |
|---|---|
| `[eventId]/checklist-actions.ts` | ceremony tailoring drops back to the untailored template |
| `[eventId]/schedule/actions.ts` | `eventType` falls back to `'wedding'`, so the free **non-wedding Run-of-Show seed stops firing** |

Both now read `events_host`. The edit is one token — `.from('events')` → `.from('events_host')`.

### What landed

- **Migration `20271025120000`** — extends `20271008731642`'s deny list with the three columns, recomputing the allow-list from what each role can read *today* so it composes with every earlier narrowing rather than resurrecting a column someone else denied. Rebuilds `public.events_host` (couple/moderator-scoped; guests get zero rows) so hosts keep reading them.
- **The guard now fails closed** — two steps instead of an embed, reads `events_host`, and **throws** on either error. Throwing is correct even though it surfaces as a 500: a cardinality gate that cannot read its own inputs must refuse, not wave the write through.
- **Seven-test suite** asserting exactly that: each read error throws; the read targets `events_host` and never `events`; an in-planning row still blocks; a **pre-epoch** unlabeled row still does **not** (legacy accounts stay free per `LIFE_GATE_EPOCH_ISO = 2026-07-18`); a lifestyle type performs zero reads.
- **Three post-conditions** in the migration: the columns are unreadable by `authenticated` *and* `anon`; the table-level `REVOKE SELECT` did **not** collaterally drop the column-scoped `UPDATE` grants from `20271005100000`; and `events_host` still projects all three — *"or the life-event guard would fail open"*.

### Two near-misses caught while writing this, worth recording

**The view's service-role arm.** I first wrote `OR auth.uid() IS NULL` for the `events_host` predicate. That is **also true for `anon`** — it would have handed every row to unauthenticated callers. The shipped predicate names the role explicitly (`current_user = 'service_role' OR auth.role() = 'service_role'`) and is now reproduced verbatim with a comment saying why the shorthand is wrong.

**The test found the epoch rule, not a bug.** The first "still blocks" fixture used `created_at: 2026-01-01` and correctly did **not** block — unlabeled rows only contend for the singleton slot post-epoch. The fixture was wrong; the code was right. Both cases are now covered.

### A third near-miss, caught by CI rather than by me

`tests/db/std-media-nsfw-verdict.db.test.ts` went red — 16 tests, one `before` hook, `2BP01: cannot drop column std_media_nsfw of table events because other objects depend on it`.

The dependency is **new, and mine**. `public.events_host` projects EVERY column of `public.events`, computed at build time. Until this PR the view was last built by `20271008731642` — *before* `std_media_nsfw` existed — so it never referenced that column and the test's rewind fixture could drop it freely. This migration rebuilds the view from the columns present now, which include it, and the dependency appears.

The repo had already solved this. `tests/db/facebook-watch-url-grant.db.test.ts:132` carries the same two lines and the reasoning for them, so this is that pattern applied, not a new workaround:

```ts
await db.exec(`DROP VIEW IF EXISTS public.events_host;`);
await db.exec(`ALTER TABLE public.events DROP COLUMN IF EXISTS std_media_nsfw;`);
```

Dropping the view is faithful to what the fixture simulates rather than a way around the error — the whole point is to rewind to the day the privilege migrations ran, and `events_host` did not exist then either.

**Worth carrying forward:** any future migration that rebuilds `events_host` widens its column set to whatever exists at that moment, and can therefore break a `DROP COLUMN` fixture written earlier. The failure is loud (2BP01, in `before`), so it cannot ship silently — but it will surface in a file unrelated to the change.

**Full suites after the fix: 659 DB tests and 5,688 unit tests, 0 failures.**

SPEC IMPACT: None. No product behaviour changes — the cap, its honoree key and its epoch exemption all behave exactly as before. Security posture and failure mode only.


## 2026-07-31 · the stacked person_connections migration was REMOVED — another session shipped it first, better

PR #3941 stacked a `person_connections` policy split on this branch. While it waited, another session merged **`20271025100000_person_connections_per_command_policies.sql`** to `main`, closing the same forgery/self-confirm hole.

Keeping both would have been worse than duplicate authorship. **Postgres RLS policies are PERMISSIVE — they OR together.** Mine dropped only `person_connections_participant`, not main's four new policies, so after both ran the table would carry both sets, and a row passing *either* INSERT policy would be admitted. The `status = 'pending'` pin that was the entire point of my migration would have been satisfiable by going around it. (In practice the deploy would have failed first — my post-condition asserts exactly four policies, and there would have been more — so this could not have shipped silently. It still could not have shipped at all.)

Main's version is **strictly stronger**, so mine is superseded rather than merely redundant:

| | mine (#3941) | main's |
|---|---|---|
| INSERT pins status | `= 'pending'` | `IN ('draft','pending')` — adds drafts |
| Only the recipient may answer | policy `USING`/`WITH CHECK` | `person_connections_transition_guard` trigger |
| Only a *pending* row may be answered | ✅ | ✅ |
| draft → pending only by the declarer | — | ✅ |
| Nothing returns to draft | — | ✅ |
| confirmed/declined is **final** | — | ✅ |

Their split is also the better shape: RLS decides *reachability*, a trigger enforces the *state machine*. A policy pair cannot express "answered is final" without reading the pre-image on every command.

Removed from this branch: the migration and its changelog fragment. Nothing is lost — the rule it protected is enforced on `main` today, and more completely.

**The lesson worth keeping:** a stacked PR is a bet that nobody else touches the same table. When it loses, the failure mode is not a merge conflict — git merged this cleanly. It is two migrations that both "work" and silently OR into a weaker policy set. **Before merging any long-lived branch carrying an RLS migration, re-check whether `main` grew a policy on that table.**

Re-verified on the merged tree: **677 DB tests · 5,727 unit tests · 0 failures**; `tsc` clean; migration-doctor, timestamp, exposure-baseline and dup-rule guards all exit 0. Regenerated baseline shows exactly this PR's intended narrowing and nothing else:

```
-col public.events.honoree_label          anon=SIU authenticated=SIU
+col public.events.honoree_label          anon=IU  authenticated=IU
-col public.events.honoree_dependent_id   anon=SIU authenticated=SIU
+col public.events.honoree_dependent_id   anon=IU  authenticated=IU
-col public.events.signature_details      anon=SIU authenticated=SIU
+col public.events.signature_details      anon=IU  authenticated=IU
```
