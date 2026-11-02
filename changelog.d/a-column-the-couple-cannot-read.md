## 2026-08-29 · fix(security): three events columns a signed-in person was refused

`public.events` revokes table-level SELECT and re-grants a per-column allow-list,
so PostgREST refuses the **whole query** when a select names one withheld column.
Three shipped surfaces did exactly that through the couple's own session:

- **The couple's website editor bounced them out.** The read failed, the page saw
  no event, and its last line is `if (!event) redirect(...)`. Every time, silently.
- **The guest-camera switch never appeared.** `if (error || !data) return null`
  rendered nothing — this is the button the owner asked for on 2026-08-07, built
  on 2026-08-08, and on screen not once since.
- **A forced date was never released.** The refused read yields a null row, so the
  helper answered `not_forced_by_this_vendor` — a benign-sounding "nothing to do".

Granted `SELECT` on `site_art_direction`, `papic_guest_capture_early` and
`date_forced_by_lock_of` to `authenticated` only. RLS still scopes rows, so this
changes which columns an already-entitled person sees, never who sees the row.
The deliberate UPDATE revoke on the guest-camera switch is asserted to survive.

**Root cause — prefix order is not apply order.** `site_art_direction` carries a
prefix six days *below* the lock-down and was committed 5h47m *after* it;
production applies such files with `db push --include-all`, so the column landed
after the allow-list had been computed. The two later "recompute" migrations
rebuild that list from `has_column_privilege(...)` — they re-grant only what
already holds the grant, so they are monotonically narrowing and cemented the
absence three times over.

**The guard could not see it**, because it filtered migrations by prefix
(`f.slice(0,14) > LOCKDOWN`) while the failure mode is a file that sorts below and
applies above. The cutoff is removed: every migration is now read at any prefix,
with 120 pre-existing columns grandfathered by NAME (order cannot distort a name).
Coverage went from 13 columns to 123.

Also discharged the guard's own 2026-08-15 promise — *"each line is a promise that
somebody will check it"*. All six were checked by resolving the client at each of
the 21 `events` selects naming them: two were live defects (fixed here), four are
admin-only reads and are now withheld as a decision rather than a debt.

SPEC IMPACT: None — no product rule changes; a shipped control becomes reachable.
