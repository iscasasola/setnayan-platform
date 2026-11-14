## 2026-11-14 · fix(pricing): plan Papic credits are read, and Event Plus no longer says "100"

- **RW-12** · `/pricing` and `/features` now name each event plan's Papic credits from the catalogue row's `included_papic_credits` (Event Ultra's 3,500, Event Plus's 1,000, Event Pro's on /features), never a typed count. Unread, inactive or empty rows keep the old wordy line. `ourPricesFrom` gains `planCredits`; `readFeatureCatalogue` reads the column; `planLines` in `lib/features-page.ts` swaps the line. Guard: `lib/plan-credits-are-read-not-typed.test.ts` (sabotage-checked: a typed 3500 turns it red).
- **RW-15** · migration `20271345494976_event_plus_description_says_no_count.sql` drops the stale "100" from the EVENT_PLUS description instead of retyping 1,000, so the sentence cannot drift from the column again. It changes text only, and only on a row that still holds the stale sentence. Applied by the pipeline, not by hand.
- **RW-13** (an Ultra buy door) is NOT in this PR: the in-event plan offer with an Event Ultra drawer is already built in draft PR #7608 (`claude/truth-prices`, F-W2-29).

SPEC IMPACT: None — the counts are owner-ruled (DECISION_LOG 2026-11-13 "PAPIC CREDITS IN THE EVENT PLANS"); this only makes the screens read them.
