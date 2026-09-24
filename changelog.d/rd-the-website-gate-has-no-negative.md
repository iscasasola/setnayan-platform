## 2026-09-24 · fix(nav): a question put to the owner was not a question — retracting it

PR #5938 fixed the Event Hub tab never rendering on a planning phone, and raised what looked like a
second finding: the plan phase gates that row on `websiteEnabled`, the day-of and after rosters do
not, so **an event kind with no website surface would be offered a Hub it does not have.** It was
pinned in a test called `📌 OPEN: …` and escalated to the owner as a decision.

**It was not a decision.** Owner, verbatim: *"all events has a website"* — *"the only difference is
the type of suppliers and the services and the complexity of AI to handle that service."* Measured
against production the same minute, and he is right:

```sql
select event_type, ('website' = any(enabled_surfaces)) as has_website
from event_type_profiles order by 2, 1;
-- 17 rows · has_website = true on every one
```

All five code fallbacks agree. `websiteEnabled` is `true` for every event that can exist, so the
disagreement between the phases **describes a state nothing can reach**, and asking the owner to
rule on it spent his attention on nothing.

🔑 **The lesson is the shape of the question, not the answer.** A gate with no reachable negative
case cannot protect anything — it can only subtract, which is exactly what it did: the row vanished
from every planning phone because the flag arrived `undefined`, never because it arrived `false`.
**Before escalating an inconsistency, measure whether either side is reachable.** An unreachable
branch is dead code, not a decision.

⚠ **The gate stays.** Deleting it would be the opposite mistake — removing the mechanism that makes
an opt-out possible, on the strength of one day's reading. What replaces the false question is a
**tripwire**: if any code profile ever ships without the website surface, the test fails and names
the decision that would then, for the first time, be real. Probed — dropping `'website'` from
`SIMPLE_PROFILE` goes red with that message; restored, 4 pass, `dirty=0`.

SPEC IMPACT: None. No behaviour changes; a test that asserted an unreachable state is replaced by
one that asserts the measured fact and fires if it stops being true.
