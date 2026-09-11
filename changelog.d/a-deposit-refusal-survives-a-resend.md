## 2026-09-11 · fix(deposits): a supplier's refusal, and Setnayan's ruling, survive the couple sending it again

FOLLOW-UPS A item 1, found in H4 (#5443). `guard_event_vendor_deposit_ack` let
a session clear the deposit's refusal and its ruling, and `recordDeposit`'s
re-send did exactly that through the couple's own session. So re-sending took the
dispute off `/admin/disputes` without a trace, and any couple could do the same
with one PATCH.

The re-send stays; it is the deposit's deliberate design. Migration
`20271223918326_a_deposit_refusal_survives_a_resend.sql`:
- **New table `event_vendor_deposit_refusals`:** one history row per refusal
  that ends. It records the supplier's words, any ruling, how the refusal ended
  (the couple sent it again · the supplier confirmed · Setnayan ruled it stands
  · the booking was removed · tooling) and who ended it.
  - Only a SECURITY DEFINER trigger on `event_vendors` writes it, never a
    session: RLS on, no policies, no grant to anon or authenticated.
  - It has no foreign key, so the history outlives its booking row.
- **New `resend_vendor_deposit(p_event_vendor_id, p_actor_user_id)`:**
  server-only. `recordDeposit` calls it on the admin client, after its own
  couple/coordinator authorization. It writes the history row itself
  (`couple_resent`, and who) before clearing. The trigger's own insert for that
  refusal is then a no-op, because the table is unique on (booking,
  refused-at). No session can insert into the history, and nothing consults a
  value a session could set, so no session can make a closure read
  `couple_resent`. It only clears a standing refusal, so a "payment stands"
  ruling on a confirmed deposit is no longer wiped by a re-record.
- **`guard_event_vendor_deposit_ack`:** re-signed from its live production body
  (md5 equal to `pg_get_functiondef` on prod). It changes only in the two
  clearing clauses and their comment (line-hash diff in the PR): a session may no
  longer clear the seven columns.
- **`/admin/disputes`:** each open deposit dispute lists that booking's earlier
  refusals and how they ended. A new "Answered by sending it again · last 30
  days" list keeps re-sent disputes visible.

Guards:
- `tests/db/a-deposit-refusal-survives-a-resend.db.test.ts`: 11 cases,
  including a neutralisation run and a forged-closure attempt. It was
  mutation-checked 7 ways.
- `tests/db/the-couple-keeps-their-record.db.test.ts`: its "the couple may CLEAR"
  case now proves the couple may neither set nor clear, while RLS still lets
  them write the row, and the re-send reaches the supplier through the definer.
- `lib/the-couple-keeps-their-record.test.ts`: the pin moves to the RPC call.
- `lib/deposit-refusal-history.test.ts`: the page's wording and reads.
- Rosters: erasure `AUTHOR_UUID_NULLS` for the three stamps, and an export
  exclusion. The exposure baseline doesn't change, because the table has no role
  grants.

SPEC IMPACT: None.
