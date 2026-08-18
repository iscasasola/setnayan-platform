## 2026-08-18 · fix(guards): every registered switch must have a writer that names it in ONE chain

**The guard that catches "a switch nobody can press" could not see the switch
becoming un-pressable.** Found by another session on PR #4535 and independently
re-proved here before acting.

`gateWritersOf` answers two **independent file-level** questions joined by `&&`:
does this file write that table *anywhere*, and does it name that column as a
field *anywhere*. **Never the same statement.**

**Measured on main, by mutation:** deleting the only real write of
`events.archived` left the suite **10/10 GREEN**. The detector reported **three**
writers for it where exactly one exists — `chat-actions.ts` has a local variable
of that name writing a *different* table, and `events.ts` has it as a type field
and in a select list.

🔑 **TWO CORRECT PREDICATES ANDED AT THE WRONG SCOPE ARE NOT A CORRECT
PREDICATE.** Each half was carefully written, commented, and separately right.
The join is what made them blind — the failure shape the guard exists to catch,
occurring inside the guard.

### 🛑 The loose net STAYS loose — and I had to be shown why

My first attempt tightened `gateWritersOf` itself. **That was wrong**, and PR
#4535 had already reasoned it out and declined to do it inside a feature PR.

That detector is cast over **264 schema columns**, where a false "no writer"
teaches the next person to baseline working code — and a baseline is a bill. It
**legitimately cannot** see a write spelled `...parsed.patch` (object spread —
the column name never appears anywhere) or `.insert(rows)` where `rows` came out
of a `.map()`. Both are real writers in this repo today:
`vendor_bot_config.enabled` and
`vendor_service_payment_schedules.no_show_forfeit`. Measured, at each step: the
tightening made **14** columns newly report "no writer", and the two checked by
hand were both fine. That is 14 baseline lines declaring working controls
unreachable — worse than the bug.

🔑 **TWO QUESTIONS, TWO AUDIENCES.** The wide net must not cry wolf. The strict
question belongs where the writer is **named and checkable** — the handful of
registered switches, where a false alarm costs one file read and a miss is what
shipped six times.

So this is **purely additive**: a `writesColumnInOneChain` predicate beside the
untouched net, and one assertion applying it to every registered switch. **Zero
new baseline lines.**

⚠ `[^}]` NOT `[\s\S]` in the span — a budgeted window reads straight past the
payload's closing brace into the `.select('event_id, archived')` on the next
line, so deleting the write still matched. #4535 hit that in its own first cut
and wrote it down. A budget also shrinks silently the moment somebody documents
the payload, which defeated two other guards in this repo today.

⛔ A switch written only through an RPC parameter has no single chain to find;
it is skipped **by name**, with its reason, and the skip count is asserted so
this cannot quietly become a loop over nothing.

**Verified:** all five directly-written switches sabotaged one at a time, each
measured by occurrence count — **5/5 red**, including `events.archived`, which is
green on main.

SPEC IMPACT: None.
