## 2026-07-26 · fix(copy): Lock records a choice — it does not hold the date

Owner ruling 2026-07-26: **"Lock will only be locked when the vendor approves
their payment."**

That answers the §6.8 question carried open all session, and answers it
**without a schema change**: the 2026-06-12 capacity lock stands — white
(`considering`..`contracted`) consumes nothing, and the date is genuinely held
only at `deposit_paid`. So the couple's Lock is a **claim**, and the copy has to
say so.

**Audited first:** no couple-facing surface currently promises the date is
secured — the only grep hits were code comments. The modal's line was not wrong,
just silent on the one fact that now matters: *who confirms.*

- was: *"Everything in this package will lock on your event home."*
- now: *"This goes on your event home. Your vendor confirms once payment is approved."*

The in-file comment is the real payload — it records why, cites the capacity
lock, and warns the next author **not** to put a "the date is yours" line on the
service-card Lock button when §6.8 ships. That button is where this would bite:
§6.8 itself calls shipping it while telling couples the date is theirs *"the one
outcome that damages trust on both sides."*

Copy-only. No schema, no behaviour, no migration. 4152 unit green,
`tsc --noEmit` exit=0, `next lint` exit=0.

SPEC IMPACT: `HANDOFF_Package_Wave_2026-07-26.md` § 6.8 marked **answered** —
branch (b), no capacity change. Both of today's rulings are in `DECISION_LOG.md`,
including the still-unbuilt one: packages should be **filtered by pax** so a
couple is only shown packages that fit their head count.
