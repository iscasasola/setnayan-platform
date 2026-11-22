## 2026-11-18 · fix(admin): the owner's confirmed request is frozen during its 24-hour wait

Opus review of the admin team slice. Once the owner typed the word, the row was
still writable by any admin's browser session (admin RLS UPDATE policy), so a
staff admin could change what the runner executes (target, payload, action) or
reopen a request the owner had cancelled, and the runner would run it with the
service role. `guard_owner_self_approval` now refuses any browser-session
update to a confirmed row, freezes what was confirmed for every role (the
owner's id may still go to NULL on erasure), and keeps a closed request closed.
Test: `tests/db/admin-areas-and-owner-self-approval.db.test.ts` (fails before).

SPEC IMPACT: None

## 2026-11-22 · fix(admin): "the owner" is read from the sign-in address, not a profile row

Hand-off audit (#7585). `is_platform_owner()` and `isOwnerProfile` trusted `public.users.email` + `is_internal`.
That email is neither unique nor guarded, and an `account_type = 'admin'` session is "privileged" in
`guard_users_privilege_columns`, so it could set its own `is_internal` and copy the owner's address. It would then
count as the owner: every area at both levels, and self-approval of every two-admin action (typed + 24 h) with no
second admin.

- `is_platform_owner()` now joins `auth.users` (unique, changed only by a confirmed email change) and checks
  `is_internal`.
- Every server decision asks the database through `readIsPlatformOwner` (`lib/admin/owner.server.ts`): admin
  powers, starting the owner's wait, and the Team screen's "cannot narrow the owner" refusals. An unreadable
  answer fails closed.
- `isOwnerProfile` is now a display pre-filter only.
- New DB test: a look-alike internal admin is not the owner and cannot type the word. It is sabotage-checked:
  it goes red with the old `public.users` read.

SPEC IMPACT: None. The owner rule (§ 10a: this address AND `is_internal`) is unchanged; only where the address is read changed.
