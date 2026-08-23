## 2026-08-24 · fix(explore): "Usually responds in Xm" needs more than one reply, and 0 is not instant

Card Family stream § 3c (the reply-time badge). Migration `20271160094275`.

**Two live defects on the public marketplace card, both fixed by giving the median a sample.**

`vendor_activity_stats.avg_response_minutes` is the MEDIAN of (first reply − thread opened),
and the row stored it with no sample size beside it:

1. **No floor at all.** One inquiry answered in twelve minutes, once, earned a shop the words
   *"Usually responds in 12m"* in front of every couple browsing. "Usually" is a claim about a
   habit; one event is not one.
2. **The no-data sentinel is a number.** `lib/vendor-activity.ts` writes **0** when no thread
   has been replied to at all. `isFirstLookEligible` reads `<= 0` as unknown — the marketplace
   card checked only `!== null`, so `0 < 240` passed and a shop that had **never answered
   anybody** was advertised as *"Usually responds in 0m"*. The strongest possible claim, for
   the weakest possible reason, by the one consumer that never learned the convention.

🔑 **A sentinel held in one consumer's head is not a rule.** Two readers of one number
disagreed about what 0 meant, and the one that got it wrong is the one couples read. Both
facts are now decided once, in `lib/vendor-reply-time.ts`, and the sample size travels with
the median in the database (`vendor_activity_stats.replied_thread_count`).

**The floor is three replies** — the same disclosure floor the Card Record already uses for
every aggregate it publishes about other people. Below it the badge is **absent**, never
hedged: "based on 1 reply" is still a claim, and it teaches a reader to trust the unhedged
ones for reasons they cannot check.

The new column is `NOT NULL DEFAULT 0` — **fail closed**, so every existing row starts below
the floor and the badge is withheld until the stats pass writes a real count. That pass runs
on ordinary chat activity, so it self-heals with no backfill and no cron. Deliberately **not**
backfilled: re-deriving "replied" in SQL would create the second definition of the word this
column exists to prevent.

⛔ **Not touched:** `isFirstLookEligible`, which reads the same column in the couple tree. It
already honours the sentinel, and it feeds a RANKING nudge rather than a claim shown to
anybody — changing what it counts would move search ordering, which is not a side effect of
fixing a badge. Named, not changed.

SPEC IMPACT: None. Prod holds 0 chat threads and 0 activity rows, so no badge exists to change
today.
