## 2026-09-20 · feat(entourage): the couple sets who walks first

⚖ Owner 2026-09-20, shown the invitation's printing order and asked whether he
wanted the within-role order fixed too: *"Both, and I want to drag them"* —
placed, on his instruction, on the guest list's per-role view.

- **`guests.entourage_order`** (migration `20271236109974`) — nullable integer,
  NULL meaning "never placed by hand". No DEFAULT and no NOT NULL on purpose: a
  default would be a placement nobody made.
- **`EntourageOrderPanel`** — appears above the roster only when the host has
  filtered to a role the invitation prints, and renders itself away for every
  other view. Move ↑ / Move ↓ rather than HTML5 drag, matching
  `admin/website/widget-list.tsx`: drag-and-drop does not exist on touch, and a
  couple arranges their entourage on a phone.
- **`entourage-order-actions.ts`** — writes the full 0..n-1 sequence for the
  role rather than the two rows that moved, so there is no "have we normalised
  yet" state to get wrong on the first drag. `.select()` on every write,
  because a zero-row UPDATE is success-shaped and an RLS refusal returns
  exactly that. A Reset hands the role back to the alphabetical default —
  without it, a couple who drags once can never return to "no opinion".

🔑 **The panel and the invitation share ONE ordering function**
(`holdersOfRoleInPrintOrder`, exported from `lib/entourage.ts`). If the
dashboard sorted independently — its own `sort` param, or raw DB order — then
"move her up" would swap her with whoever the DASHBOARD showed above her, and
the invitation would change somewhere the couple was not looking.

A hand-placed name outranks the alphabetical default, and only where one was
given: place three of twelve ninongs and you get those three on top in your
order, with an alphabetical tail. NULL is never read as 0 — that would rank
everyone untouched above the person deliberately put first.

Guarded in `lib/entourage.test.ts` (28 tests). Three sabotages confirmed red:
NULL treated as 0 (3 failures), `entourage_order` dropped from
`ENTOURAGE_COLUMNS` (1), the override ignored (1).

No GRANT is issued: `public.guests` carries TABLE-level grants (verified in
prod — 60 columns × 4 privileges across anon, authenticated, postgres,
service_role), so the new column inherits them; a column-level GRANT would be a
no-op that reads like a decision.

SPEC IMPACT: None.

### CI follow-up · merging past main widened the dup-rule baseline

Merging `origin/main` in (done independently by two sessions — this fragment
covers the second pass, on top of the merge already pushed as `b4858f5af`)
pulled in every unrelated PR since this branch forked, and `lint:dup-rule`
GUARD 2 flagged 32 pre-existing hand-typed `guests` selects across the app
(guest detail, claims, groups/quick-add actions, papic moderation, widgets,
join/RSVP, seating tour, auto-recap, capture-credit, etc.) as newly missing
`entourage_order` — none of them print the entourage or have any reason to
read it; they crossed GUARD 2's overlap threshold purely because
`ENTOURAGE_COLUMNS` grew by one column. Regenerated the baseline
(`pnpm --filter @setnayan/web dup-rule:baseline`) rather than touch 32 unrelated
files for a column none of them need.

The same regeneration also DROPPED 5 previously-baselined omissions (5 columns
each, in `[slug]/_lib/loaders.ts`, `[slug]/invite/reply/page.tsx`,
`api/v1/events/[eventId]/guests/route.ts`, `guests/checkin/page.tsx`,
`guests/souvenirs/page.tsx`) — adding the 11th column to the same constant
pushed their overlap ratio for the OTHER 5 columns below GUARD 2's trigger
threshold, so the scanner stopped flagging them. That is the scanner's own
percentage-based cutoff, not a hand edit; noting it here since it reads like a
loss of coverage rather than an artefact of the column count changing.

### CI follow-up · the error was checked, never told to anyone

`ugat-both-ends.db.test.ts` failed: `EntourageOrderPanel`'s `.from('guests')`
read `error` only as a branch condition — the failure branch rendered a
static "could not be loaded" message but never logged the actual reason, so a
real RLS refusal or a dropped connection would leave no trace anywhere a
person could find it. Fixed by routing it through the same `logQueryError`
every other read in this app uses (`lib/supabase/error-detect.ts`), tagged
with the event and view so it is findable in the logs. The user-facing message
is unchanged; per the guard's own instruction this is a real fix, not a
baseline entry — `ugat-both-ends.baseline.txt` is untouched.
