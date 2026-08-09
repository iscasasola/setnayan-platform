## 2026-08-09 · fix(run-of-show): the coordinator-only gate now actually stops someone

PR #4273 blocked the BUTTON and almost nothing else. Three runtime defects, all
repaired here, plus the two-tables disagreement behind them.

- **A wedding guest could advance the programme.** The gate's first arm selected
  `event_members.member_type` and never compared it (`if (memberRes.data) return
  true`). `event_members` is the event's PEOPLE table — a guest who scanned the
  event QR has a row in it and can read it — so every guest passed. This is
  verbatim the bug `app/[slug]/_lib/host-scope.ts` was written to kill; its
  shipped `isHostMemberType()` / `HOST_MEMBER_TYPES` is what runs now, rather
  than a second private definition of "host".
- **The gate authorized a different event than the RPC acted on.** The check ran
  against the caller-supplied `eventId` while
  `advance_schedule_block(p_block_id)` resolves the event from the block alone.
  A supplier holding block ids from wedding V could create their own event W,
  pass the check on W and advance V. The block's real `event_id` is now read
  server-side; a mismatch is refused, and the permission is evaluated against
  the RESOLVED event.
- **A refusal was announced as "Saved".** The header discarded the action's
  result and let the save veil finish with its default success beat, so a
  refused caller watched a tick land while nothing moved. The header now
  classifies the result, dismisses the veil WITHOUT the success beat on a
  refusal, and renders the sentence. The floor console had the same hole from
  the other end — it mapped three statuses by name and let everything else fall
  through to `{ ok: true }`, so `not_the_coordinator` read as a clean run on the
  live floor; it now uses the shared mapper, where only `ok`/`started`/`already`
  are success.
- **The vendor client workspace passed `canAdvance` unconditionally**, so every
  booked supplier — caterer, florist, band — was shown the control that runs the
  couple's programme. It now comes from the shared gate.
- **Two surfaces decided "booked coordinator" from different tables** whose
  lifecycles are offset (`vendor_schedule_pool_bookings` held-date vs
  `event_vendors.status IN ('contracted', …)`), so a real coordinator could pass
  one and fail the other. Both now answer it through
  `current_coordinator_booked_event_ids()` in the new `lib/run-of-show-gate.ts`.

New: `apps/web/lib/run-of-show-gate.ts` (the one gate, client passed as a
parameter so it is unit-testable) and `advanceRefusalMessage` /
`ADVANCE_SUCCESS_STATUSES` in `apps/web/lib/run-of-show.ts` (pure, shared by both
consumers).

`lib/run-of-show-coordinator-gate.test.ts` was REWRITTEN. Its previous
assertions matched source text — that a name appeared, that one call sat before
another — and every one of them passed against a gate that admitted every
wedding guest. The tests now run the gate against a stubbed Supabase client and
assert the answer. 11 mutations were applied to check they can fail; 10 were
caught (the eleventh, dropping an RPC error check, changes no behaviour because
both branches already fail closed).

Deliberately NOT changed: the couple dashboard's own `canAdvanceRunOfShow` still
uses `Boolean(memberRow)`. That route's layout admits only `member_type =
'couple'` or an accepted moderator, so no guest can reach it, and the value is
shared with the "Tell the host" control whose INSERT policy is a different set —
widening it there would create a fresh silent refusal. The database's own
`advance_schedule_block` gate is unchanged and still wider than this; the
application layer is the narrowing until a migration follows.

SPEC IMPACT: None.
