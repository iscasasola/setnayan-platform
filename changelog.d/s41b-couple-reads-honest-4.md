## 2026-09-19 · fix(stories): a community's story strip says "couldn't load" instead of "Nothing yet this day" (S41b · couple 4)

COUPLE-FACING tier of `result-dropped-silently` (S26 baseline, #5625), batch 4:
stories and keepsakes. 23 sites joined (a), and 1 deleted (b).

On screen:

- **Samahan · stories strip**: `fetchSamahanStories` returned `[]` on a refused
  read, and the strip printed "Nothing yet this day." It now returns `null`.
  The page passes `storiesUnreadable`, and the strip says it couldn't load
  before it can say "nothing yet".

(b) deleted: **`lib/activity-attribution.ts`**. Nothing has imported it since its
only consumer, the Home v2 activity feed, was removed in the 2026-07-11 dashboard
dead-code cleanup (`cdda1bd91`). There was no end left to join.

Reason kept, behaviour unchanged (documented fail-closed disclosure surfaces,
null-honest reads, or marketing shelves that hide when empty): story edition
number, storytellers showcase ×2, mutual story days ×3 (flag-gated, fails
closed), after-summary editorial (already `editorialMeasured`), story version
×2, alaala orb ×2, alaala wall ×4 (already `unreadable`), auto-recap ×2,
samahan notify, recap post opt-out, kwento access (fails open, documented),
moodboard render gallery ×2 (already `null`).

SPEC IMPACT: None
