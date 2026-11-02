## 2026-07-11 · fix(guests): compensate orphaned guest_group on failed capture-bar add

The Living Roster capture bar's single-add (`addSingleGuest`) mints every parsed
`#Group` UP FRONT, then inserts the guest. When that insert failed — an invalid
side, the post-finalize guest-count gate, the bride/groom singleton `23505`, or
any DB/RLS error — the freshly-minted groups were left behind as **empty
orphans** in the Groups sidebar. The pre-existing name-guard only closed the
mononym miss; every other failure still orphaned.

Fix = compensation + a `created` provenance flag (`quickCreateGroup` is
find-or-create idempotent, so its old success shape couldn't tell a fresh insert
from the `23505` reuse of a group the couple already had):

- `quickCreateGroup` now returns `created: boolean` on its success variant —
  `true` only on a fresh insert, `false` on the reuse path. Purely additive; the
  three consumers (`inline-actions`, `quick-add-sheet`, `chip-editors`) only read
  `.ok`/`.group`, so it typechecks across all callers.
- On `quickAddGuest` failure, `addSingleGuest` now deletes exactly the groups
  **this call freshly created** — never a pre-existing/found one — using the
  couple-scoped `.eq('group_id').eq('event_id')` delete pattern
  (`deleteGuestGroup` / `couple_writes_guest_group` RLS), then revalidates so the
  removed group doesn't linger in the sidebar. The real add error is always the
  returned value; a failed cleanup is logged (`graceful_degrade`) and swallowed.
- Concurrency guard: each delete is preceded by a memberships-`count===0` check,
  because `guest_group_memberships.group_id → guest_groups(group_id)` is
  `ON DELETE CASCADE` — so a group a concurrent same-couple tab just populated is
  left intact (the residual atomic-guarded-delete TOCTOU is deferred; it needs a
  migration and is not part of the persistent orphan window).
- Orchestration extracted to the DB-free `lib/add-single-guest-core.ts`
  (`runAddSingleGuest` + injected deps); `addSingleGuest` is now a thin wrapper
  injecting the real server actions. New unit suites pin the flow
  (`lib/add-single-guest-core.test.ts`) and the never-delete-a-pre-existing
  invariant (`lib/guest-group-compensation.test.ts`) — the flow test goes red if
  the compensation block is removed.

Known adjacent bug (out of scope, flagged for owner): `quickCreateGroup`'s
`23505` reuse-select uses `.ilike('label').maybeSingle()` with no `team_side`
filter while the unique index is `(event_id, lower(label), team_side)` — a
cross-side duplicate label can make `maybeSingle` see >1 row. Does not affect
this fix (fresh insert always yields `created:true`, so the flag stays reliable).

SPEC IMPACT: None (bug fix to existing 0001 guest-groups behavior; no SKU, price,
schema, or decision change).
