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

---
## BUILDER (Opus 5.5) — state, kept current

### Measured (Rule 0, 2026-10-18)
- 20 enabled types (prod `event_type_vocab`). The setup engine (G1) is admitted per type by a seeded
  `event_type_profiles.look_set` (migration 20271258536791): only wedding · birthday · hangout · date ·
  simple_event have one → the other 15 still walk yesterday's 12-screen quiz (pax · region · 5 axes · reveal).
  CLOUD_PROMPTS_OCT1 "G5" (wake · corporate · the rest) was never built ⇒ seeding the 15 IS their fixed onboarding.
- Answers live in their own `events` columns (owner 2026-10-02 "ONE HOME": papic_on · gifts_on · …).
- Bottom bar: `buildEventMenuSections` hideKeys ('guests' · 'explore'); only 'explore' per type today.
- Maker stages: MAKER_PAGE_STAGES (maker-bar.ts) / ltStages + Page ▾ (maker-shell.tsx); Studio: `studioTiles({offered})`.
- Per-guest max already exists (Papic › guest allotments) → Home "Most shots per guest ▾" not rebuilt (named in PR).

### Decisions taken (from the record; say so in the PR)
- Needs = three nullable booleans on events: `guest_list_on` · `suppliers_on` · `hub_details_on`
  (NULL = never asked = ON, the papic_on shape). One QR = the reply/entry the setup already writes
  (`rsvp_ask_config`), never stored twice.
- Presets (matrix §2): simple (simple_event · date · hangout) · open (birthday · graduation · reunion · celebration ·
  tournament · open_house · grand_opening · concert · wake) · list (christening · anniversary · gender_reveal ·
  corporate · travel) · full (wedding · debut · gala_night). Organiser/expo = Level 2 (not offered).
- The needs screen replaces the engine flow's welcome + name + setup_where; it draws When only on the Simple preset
  (frame 3) and "Make the event" commits there. Other presets continue to the shipped cards ("Continue").
- Wedding keeps its own wizard (matrix §3).

### Steps (commit + push after each)
1. [ ] lib/event-needs.ts (pure) + test
2. [ ] migration: needs columns + grants + events_host rebuild; seed the 15 types' setup five; Ugat
3. [ ] onboarding: needs screen (generic + simple); commit writes the columns; per-type end-to-end tests (20)
4. [ ] per-event hiding: bottom bar · Home (doors · numbers · money · Next · One QR · Switch on more) · Maker stages · Studio tiles
5. [ ] Mood Board level + per-type dress default (only if it avoids the Dress Code editor builder's files)
6. [ ] fragment · shots (375 light+dark, side-by-side) · draft PR · CI
