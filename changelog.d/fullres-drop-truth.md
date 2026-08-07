## 2026-08-07 · fix(papic): the deletion job said it was off, and warned couples 107 days early

The one piece of code that **permanently deletes couples' original photos**
carried a header saying it deletes nothing unless switched on. **It is switched
on** — the gate is "delete unless explicitly disabled", which is the owner's
decision and correct. The label was the defect, and it is the first thing anyone
reads before touching irreversible deletion.

**The same false sentence sat in a second file**, so correcting one copy would
have left the other. That is why the guard below reads the real expression once
and applies the check to *both*.

### The live wrong number

The warning email hand-typed a 90-day window while the drop used 183. **The one
notice a couple ever gets — "download your originals soon" — fired at day 76 for
a deletion at day 183. 107 days early.** The warning arrives, nothing happens for
three and a half months, and by the time it matters they have every reason to
ignore it. Now **derived** from the same constant, never re-typed.

### The lead-time hole underneath it

Fixing the number alone was not enough. The warning audience was chosen by each
**photo's own age**, while the drop's clock is
`max(first capture + 183 days, event date + 30 days)`. For an engagement shoot
months before the wedding the post-event term binds — so an age-only warning is
still early for exactly the case the owner asked about.

The warning now **intersects with the same clock the sweep uses**, with **both**
offsets pulled back by the lead time. Pulling back only one would give zero
notice on those events. It **fails closed**: on any error it warns nobody this
pass — a missed nudge is recoverable next run, a false *"your photos go in two
weeks"* is not.

### Also corrected

*"3-month"* → 6-month · *"the 90-day window"* → 183-day · *"Weekly Vercel cron"*
(there is no such schedule — `crons` is empty; it runs off admin traffic) ·
*"prod has only the excluded sample photos"* → prod has **zero** photo rows.

### 🛡 Guards, all sabotage-tested

- The drop is ON by default **and no copy claims otherwise** — verified by
  restoring the false line in the *cron* file alone, which fails by name.
- The warning must **derive** its retention default — verified by re-typing 90.
- The warning must honour the post-event grace, with both offsets pulled back.

⚠ Deliberately **not** a per-file "if it mentions the env var it must not say
dry-run" check: the cron copy never mentions the variable, so that shape would
have passed vacuously on the very file that carried the lie.

⏭ **Still needs the owner:** whether `PAPIC_FULLRES_DROP_ENABLED` is set in
hosting. It is server-only and unreadable from code, database or the live site.
Nothing here changes the switch — only the labels, the warning date, and the
guards.

SPEC IMPACT: None — closes an item in `WHAT_IS_LEFT.md` §1.
