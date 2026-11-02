## 2026-07-31 · a hangout is not a wedding — short-runway checklists, and a ladder that stops saying "Wedding day"

`date` and `hangout` had no checklist of their own, so they fell to `GENERIC_EVENT_CHECKLIST_DEF` — which is the **celebration** template, offsets running **90 → 7 days**. A dinner date next Friday therefore opened with **nine tasks already overdue**, under the heading *"4–2 months before"*, telling the user to book a photographer and draft a guest list.

Two fixes, plus a third caught before commit.

### Templates sized to the event

`DATE_TEMPLATE` and `HANGOUT_TEMPLATE` — four items each, longest lead time **one week**: pick the place · reserve it · confirm the time · (date) anything to bring, (hangout) who's coming and how the bill splits. `tier2Core` is `['restaurant']`, because nobody books a lights-and-sounds crew for coffee.

### A ladder that isn't wedding-shaped

`CHECKLIST_PHASES` topped out at *"18–12 months before"* and ended at *"Wedding day & after"* — for **every type**. Now:

- **`CHECKLIST_PHASES_SHORT`** (This week · A few days before · The day itself) for the short-runway types.
- Everyone else keeps the long ladder's shape — their templates genuinely use month-scale offsets — but `checklistPhaseLabel` swaps the one wedding-**worded** entry (`p9`) for **"The day & after"**. Every other label is already a neutral time window, so one substitution de-weds the whole ladder instead of forking it.

Weddings are untouched: same ladder, same wording, same grouping.

### ⚠ The bug the fix nearly introduced

`groupChecklistByPhase` bucketed items with the **selected** ladder and then filtered the **hardcoded** one. For a short-runway type the buckets are keyed `s1/s2/s3` while the filter walked `p1…p9` — matching nothing. **Every item would have disappeared from the page, with no error.** Not a crash, not an empty state: a silently empty checklist for exactly the two types this PR set out to help.

It is fixed, and `groups are never silently dropped` is the test that exists for it — the most important one in the file.

### Tests

6 new cases: date/hangout have their own def with a ≤7-day horizon · short types get the short ladder and everyone else the long one · a 3-day task reads *"A few days before"* on a hangout and *"The final 2 weeks"* on a wedding · **"Wedding day & after" never captions a non-wedding event** · every item survives grouping on both ladders · an unknown type degrades to the long ladder rather than losing items.

`checklist-event-type-defs.test.ts`'s `ENABLED_TYPES` gained the two new entries, with a note recording which types still ride the generic def **by design** (anniversary · graduation · reunion · gala_night · simple_event) so the next reader doesn't mistake the list for a to-do.

**5,733 unit tests · 677 DB tests · 0 failures.** `tsc` clean · `next lint` clean.

SPEC IMPACT: None. No pricing, entitlement or data-model change — checklist content and grouping only.
