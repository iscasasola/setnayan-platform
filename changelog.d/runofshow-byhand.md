## 2026-08-10 · fix(run-of-show): the coordinator-only gate now actually refuses — and the guard survives the sabotage that beat two previous ones

Third attempt, done by hand. The two agent-written attempts each shipped a gate
that blocked the **button** and nothing else; an adversarial reviewer beat both
guards with one edit.

### The two defects, verified against `main` before touching anything

**1 · A WEDDING GUEST COULD ADVANCE THE PROGRAMME.** The gate read
`if (memberRes.data) return true;` — it SELECTed `member_type` and never compared
it. `public.member_type` is ('couple','guest','vendor','coordinator'), and a guest
who scans the event QR gets a row they can read. Its own docblock said the arm was
*"any `event_members` row"*, so the code and the comment agreed with each other and
both were wrong. **This is the third recurrence of the bug
`app/[slug]/_lib/host-scope.ts` was written to kill**, exactly as that file predicted.

**2 · IT AUTHORIZED ONE WEDDING AND MOVED ANOTHER.** `advance_schedule_block` takes
only `p_block_id` and resolves the event from it, while the check ran against the
caller-supplied `eventId`. Nothing bound them: hold block ids from wedding V, create
your own event W, pass W, and V advances.

### The subtlety both agent rounds missed

The obvious repair — reuse `isHostMemberType()` (couple ∪ coordinator) — is **also
wrong**. `app/host/accept/[token]/actions.ts` upserts `member_type: 'coordinator'`
for **every** accepted host invite, whatever that delegate's grid says. So a
view-only delegate carries a coordinator row and a couple-or-coordinator test waves
them through. `couple` stands alone; `coordinator` must be corroborated by the
delegate grid or the booked-coordinator arm.

### Fixed

- The decision is a pure function (`lib/run-of-show-advance-gate.ts`) over the row
  shapes production actually produces.
- The orchestration takes its clients as arguments (`lib/run-of-show-advance.ts`),
  so a test can drive the real path.
- The block's own event is resolved server-side and a mismatch is refused outright.
- Every read is error-checked and **fails closed** — the docblock always claimed
  this; now it is true.
- The server action is 107 lines and holds only session-reading and revalidation.

### 🔑 Why this guard is different

The previous two were **source-shape assertions** — careful ones, that stripped
comments and sliced function bodies. They still could not fail: the reviewer kept
the authorization call and discarded its result, and the suite stayed green while
anyone could advance. The new test watches the database instead: **on a refusal,
`advance_schedule_block` is never called.**

| sabotage | before | now |
|---|---|---|
| keep the call, discard its result | ✅ green | ❌ **5 fail** |
| untie the block from the event | — | ❌ 2 fail |
| admit any membership row again | ✅ green | ❌ 9 fail |
| stop failing closed on a read error | — | ❌ 3 fail |

The old `run-of-show-coordinator-gate.test.ts` is **replaced, not deleted** — it now
guards the one genuinely structural rule: there is exactly ONE gate and it is not
re-inlined into the action. Two copies of a permission check is how the day-of
console and the floor console came to disagree about who counts as booked.

⚠ Deliberately NOT changed, and worth an owner view: accepting a host invite mints a
`coordinator` membership row for everyone. That is load-bearing for other surfaces
(the event picker, the check-in desk), so this change works around it rather than
altering it.

SPEC IMPACT: supersedes PR #4286, which should be closed.
