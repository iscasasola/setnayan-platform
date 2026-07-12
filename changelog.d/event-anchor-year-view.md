## 2026-07-12 · feat(events): date-anchor model — "Your year" moments surface (PR-F)

The account-level moments calendar — the surface that makes the anchor model felt. Every entry is DERIVED at read time from the couple's anchors (+ a small authored holiday set); nothing is stored, nothing is auto-created (a moment becomes an event only when the couple taps to plan it — the go-signal).

- **`lib/year-moments.ts`** — `buildYearMoments(events, today)`: a pure, dependency-free builder over the anchor derivation engine. Recurring anniversaries derive off `anchor_date` (with the right ordinal + origin-aware label); an on-platform wedding surfaces its own anniversary once it's past (mirroring the reminder cron) or a countdown while it's upcoming; the authored `CALENDAR_HOLIDAYS` set (Christmas · Valentine's — the owner-marked safe defaults) recurs every year. Milestones (1st / silver / golden anniversary, the wedding day) flag for a nudge; ordinary years stay quiet. Sorted soonest-first, windowed to a rolling year. 10 unit tests (incl. a guardrail asserting no memorial/Undas holiday can slip in).
- **`app/dashboard/(account)/year/page.tsx`** — the "Your year" page: a "Worth planning for" section (the milestone nudges) over "The year ahead" (every upcoming moment). Server component; fetches only the anchor columns it needs (not the hot `fetchUserEvents` path); Manila-timezone day boundary via `manilaToday()`. Each moment links to its event; a holiday prompts the create flow.
- **Nav** — a "Your year" entry (CalendarRange) added to the account sidebar, right after My Events.

**Zero PII in this first cut** — moments derive only from anchor/wedding dates + fixed holidays. Milestone BIRTHDAYS need stored birthdates and therefore arrive with the counsel-gated dependent People layer (PR-D); they are deliberately absent here.

SPEC IMPACT: None (design already in the corpus: `Event_Anchor_Minimalist_Setup_Design_2026-07-12.md` § 5 "The Year view").
