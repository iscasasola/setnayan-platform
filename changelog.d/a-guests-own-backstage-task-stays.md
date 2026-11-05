## 2026-11-05 · test(schedule): a guest's own task inside backstage stays on their card

Owner, 5 Nov ("yes", confirming the event-chapters call left open in #7278): a guest given a task inside a chapter's backstage (Ingress · Egress) still sees that one line on Event Hub › Me — the moment, its time and what they do there. Every other backstage moment stays hidden, and no other guest sees it.

This was already how `yourSchedule` (`lib/guest-your-schedule.ts`) behaves; nothing guarded it. New test `1e` in `lib/a-guest-never-sees-backstage.test.ts`. Mutation-checked: skipping a guest's own backstage line turns it red (6 pass · 1 fail), restoring it turns it green.

SPEC IMPACT: None — DECISION_LOG row 2026-11-05 records the owner's answers to the event-chapters open calls.
