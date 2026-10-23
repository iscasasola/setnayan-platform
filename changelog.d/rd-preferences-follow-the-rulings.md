## 2026-10-23 · fix(settings): Preferences — Tagalog hidden, Planner mode gone, one back per screen

Owner, 23 Oct.

- **Display language hidden** until the whole app is translated (Tagalog covers 59 labels on 3
  screens). `lib/i18n/tagalog-ready.ts` (`DASHBOARD_TAGALOG_READY = false`) hides the row and makes
  `getLocale()` answer `'en'` without reading `users.locale` — a saved `'tl'` renders English
  everywhere, and every event page spends one read less. No data change; the column, the saved
  choices and both dictionaries are kept — flip the flag to bring it back.
- **Planner mode (Guided · DIY) removed.** Nothing ever read `users.planner_mode` (the 2026-08-17
  handles-have-gates finding): Home's checklist row shows for everyone, which is what "Guided"
  promised, so everyone keeps exactly what they see. `updatePlannerMode` is deleted — **one server
  action freed** (ceiling 1225). Column kept; moved to gates-have-handles' baseline as a retired
  setting; the handles-have-gates "known instance" test is removed as its own text asked.
- "Nudges on your Overview tab" → "Nudges on Home"; the Preferences hint drops "Planner mode, language".
- **One back per screen** (controller add, owner "yes"): the masthead's "Back to events" / "Back to
  Home" chip is gone — the account bar's Events tab (phone) and the rail's Events row (desktop)
  already carry it; an open group keeps its own "‹ Settings". One read less (`fetchUserEvents`).
- Appearance is already one dropdown (#6825) — unchanged.

SPEC IMPACT: DECISION_LOG row "23 Oct: the 1 Oct menu rulings built; Tagalog hidden; Planner mode
removed" (corpus).
