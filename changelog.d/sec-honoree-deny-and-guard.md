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

SPEC IMPACT: None. No product behaviour changes — the cap, its honoree key and its epoch exemption all behave exactly as before. Security posture and failure mode only.
