## 2026-09-15 · test(rls): the day-of grant guard names a silent refusal, and its shape check sees an off-switch

Follow-up to #5505 (`a-day-of-grant-cannot-be-moved`). Two gaps in that guard,
both found by sabotaging to the edit somebody would plausibly make rather than
to a deletion — a deletion is the one mutation every guard survives being wrong
about.

**1 · The shape check could not see an off-switch.** Adding
`WHEN (OLD.revoked_at IS NOT NULL)` to the trigger leaves the function, the
trigger, its name, all four armed columns and `tgenabled = 'O'` exactly as they
are — every structural claim the test made still passed — while the guard never
fires on a live grant. Measured: the behavioural probes went red (4 of 10), and
the test named "THE SHAPE THAT KEEPS IT SHUT" stayed **green** through it.
Presence is not reach. It now also asserts `pg_get_expr(tgqual, tgrelid) IS NULL`
and goes red (5 of 10) on the same mutation.

**2 · "It raised" and "it did nothing" were being counted as one fact.** The
refusal test asserted an error was thrown and, when none was, reported that the
database had ALLOWED the move — which is false if the row simply did not match.
It now resolves three outcomes separately: raised with our error code (pass);
raised with something else (red, naming the error); nothing raised (red, and the
message distinguishes "the row moved and the database allowed it" from "the row
did not move but NOTHING WAS RAISED — a caller cannot tell refused from already
done"). Measured against a mutation that makes the trigger a no-op and narrows
the UPDATE policy so the statement matches zero rows: the new message is the
silent-refusal one, with the principal, the grant and the target event named.

No production behaviour changes — this PR touches only
`apps/web/tests/db/a-day-of-grant-cannot-be-moved.db.test.ts`.

Sabotage log, all verdicts printed from the TAP summary rather than an exit
status (clean baseline 10/10):

| mutation | red |
|---|---|
| guard body is a no-op returning NEW | 4 — names the shop admin, grant, and stranger event |
| trigger not armed on `event_id` | 5 |
| `event_id` dropped from the comparison, arming kept | 4 |
| guard refuses every UPDATE | 1 — the revoke control |
| guard over-reaches onto `granted_by` | 2 — the RA 10173 erasure control |
| symmetric `WITH CHECK` instead of the trigger | 1 — the reachability control |
| **trigger present, armed, enabled, with a `WHEN` that never fires** | **5** (was 4 before this PR) |
| **zero-row refusal, nothing raised** | **4 — named as silent, not as allowed** |

SPEC IMPACT: None.
