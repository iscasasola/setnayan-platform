## 2026-08-21 · fix(marketplace): three queries were refused by the database on every load — and the cure was already written down in this repo

Found in the **production runtime logs** while auditing the owner's own Marketplace page. It fires on every visit; the most recent at the time of writing was 09:22:15.

## One ambiguity, three silent losses

`event_vendors` reaches `events` by **one direct foreign key** and — measured against production — **nineteen junction tables** that join the two as well. PostgREST will not guess: a bare `events!inner` embed is refused outright with `PGRST201`, `data` comes back null, `?? []` turns it into an empty list, and the page renders as though there were simply nothing to show.

Three sites carried it, and each lost something a person was meant to see:

| where | what has not been happening |
|---|---|
| the no-cron **ripe-review sweep** | no supplier has EVER been flipped to `delivered` 24h after their event, so **not one `review_request` notification has ever fired** |
| the **same-date hold warning** | the caution that another couple is holding this supplier on your date — never once shown |
| the **wizard's same-date exclusion** | suppliers already booked that day are recommended anyway |

🔑 **THE CURE WAS ALREADY IN THE CODEBASE.** `lib/ghosting.ts` carries this exact fix and a comment saying that query had already been killed silently **twice** — once by a phantom column, once by this ambiguity — and that *"both times the only symptom was an email that never arrived."* It never propagated to its three siblings.

That is the whole finding: not a bug nobody understood, a **fix nobody copied**.

## The fix

All three now name the foreign key and alias the embed exactly as `ghosting.ts` does — `event:events!event_vendors_event_id_fkey!inner(…)` — with their filters following the alias. The alias is safe: none of the three reads the embedded object, they only filter on it.

⚠ **`event_members` is deliberately NOT touched.** Measured the same way: one direct foreign key to `events`, **zero** junction tables. A bare `events!inner` there is unambiguous, and a test asserts it stays that way so nobody "fixes" it into a hint that does not exist.

## Why the review flow looked empty

This connects to a separate thread: the finished-event summary and the phone's After tab both promise **"Review"**, and there has never been anything to review. Part of the reason is here — the trigger that makes a booking reviewable in the first place has been dead the whole time. (The 30-day auto-complete path still worked; the 24-hours-after-the-event path did not.)

⚠ **Nothing changes on the owner's screen today.** The sweep only runs when a couple opens their own vendors page, and exactly one supplier in production is currently eligible — on an event that is not his. This fixes the first real booking, not a visible number.

## Verification

- 5 sabotages, each measured by occurrence count, each RED: each of the three FK hints removed individually · the hint kept but the **filter** reverted (the query is refused a second way) · a brand-new bare embed added elsewhere in the tree.
- The guard walks every `.tsx`/`.ts` under `apps/web`, finds each `.from('event_vendors')` chain, bounds it by **structure** (the next `.from(`) rather than a character window, and fails on any `events` embed that does not name the key.
- Unit suite **9195 pass / 0 fail**. Typecheck and `next lint` clean.

SPEC IMPACT: None — no SKU, price, schema or migration. Three queries that were being refused now run.
