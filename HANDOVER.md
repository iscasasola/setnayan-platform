# HANDOVER — rd/onboarding-level-1 · started 2026-10-18 ~14:00 PHT by the controller

Owner 2026-10-18 list item 2 ("Onboarding for more event types beyond wedding, birthday, hangout, date and get-together")
+ "Continue as it becomes available". Ship-on-green authorised through 19 Oct (controller ships).
THE PLAN (read all, via `git -C ~/Documents/Claude/Projects/Setnayan show origin/main:<path>`, never pull/edit that checkout):
EVENT_COVERAGE_MATRIX_2026-10-08_fable.md (§0 "real delta") · prototypes/event_needs_onboarding_2026-10-08_fable.html ·
DECISION_LOG 2026-10-08 rows "ONBOARDING FOLLOWS WHAT THE EVENT NEEDS", "EVENT TYPE SHAPES THE MAKER", "ASKS THE SMALL
DECISIONS UP FRONT" and the amendment: Level 1 = the fixed onboarding for the 20 SHIPPING types (before Apple); NEW types
(expo, seasons, car show, cosplay, ticketing) are Level 2 — NOT this PR.
EXISTS (inventory 2026-10-18): 20 live types in event_type_vocab; app/onboarding/wedding (17 screens), app/onboarding/simple,
app/onboarding/[type]; lib/onboarding/type-questions.ts (wake, birthday, debut, gender_reveal, christening, corporate,
tournament, travel, celebration, anniversary, graduation, reunion). MISSING (§0): per-event "needs" switch + needs-picker
screen; Mood Board level switch; per-type dress default; Home / bottom bar / Maker / Studio hiding PER EVENT (today per type).
BUILD Level 1 exactly as the prototype draws it (BUILD CONTRACT: no skipping, no re-inventing, words fixed; anything that
cannot ship is named in the PR). Every one of the 20 types must complete onboarding end to end (test per type).
Migrations via pnpm migration:new. Phone first, 375 px shots per type group (light + dark) + side-by-side vs the prototype.
Other builders are in the Maker (own-section photos, two-hosts round 3 save paths, call times in the Dress Code editor),
sign-in (Google), Papic capture, Budget page, Logo maker. If you must touch a Maker/Home file they touch, change only the
per-event hiding hook and say so in the PR. Own walk folder (scratchpad/onboarding-walk/). Never open the owner's cale-ice.
Shots → ~/Documents/Claude/Projects/shots-2026-10-18/<pr>/. Fragment changelog.d/rd-onboarding-level-1.md.
