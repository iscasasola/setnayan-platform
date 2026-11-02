## 2026-08-26 · fix(admin): every queue either settles, or says why it cannot

Accounting the 19 act-now queues after the settle-in-place work found **three that were
simply silent**: expanding **booking fees**, **completions** or **partnerships** showed
neither a control nor an explanation. A reader learned nothing and could only conclude the
feature was unfinished.

`JUDGEMENT_QUEUES` already carried the house rule in its own docblock — *"being explicit
beats being silent: a reader should learn WHY there is no button here, not assume the
feature is unfinished"* — but **judgement had been treated as the only honest reason to
withhold a button.** It is not.

- **completions** joins `JUDGEMENT_QUEUES`, where it always belonged: force-complete unlocks
  a couple's public review and uphold non-delivery freezes it — both notify the couple and
  both move a rating. That is a ruling, not a fact to tick.
- **booking fees** and **partnerships** get a new map, `SETTLED_ELSEWHERE`: *"A fee is
  confirmed on Payments, where the supplier's receipt is"* and *"These wait on the other
  supplier, not on us."*

### The guard is the real deliverable

`every-queue-says-why.test.ts` **walks the real `QUEUE_DEFS`** and demands every key be
accounted for by one of the three maps — so **the next queue anybody adds fails here until
it is given a panel or a reason**, instead of shipping silent. A hand-enumerated list is a
list of the queues somebody thought of.

🪤 **Two failures in my own guard, both caught by mutation, both worth recording:**

1. **The parser matched one SPELLING of a key.** A JS object literal writes `disputes:`
   unquoted and `'user-reports':` quoted (the hyphen forces quotes). Matching only the
   quoted form reported two properly-covered queues as silent — **a false positive inside
   the guard itself**, the same one-spelling family that has now cost this project four
   times in two days.
2. **A sentence that cannot be shown is not a sentence.** Deleting
   `...Object.keys(SETTLED_ELSEWHERE)` from `EXPANDABLE_QUEUES` left the sentences defined
   and **unreachable** — the row stops offering expansion — and the check stayed **GREEN**,
   because it only asked whether a map held the key. A fourth assertion now pins
   reachability for BOTH maps. 🔑 Same family as a granted RPC with no callers.

Verification: `tsc --noEmit` **exit 0**; unit suite **10,138 pass / 0 fail**; **eleven** lint
scripts, all exit 0. **Five mutations, all red** — including a brand-new queue added to
`QUEUE_DEFS` with neither a panel nor a reason (19→20 keys), which is the case this exists for.

SPEC IMPACT: None — copy and a guard; no rule, price or behaviour changes.
