## 2026-09-29 · feat(event-hub): every remaining Post Event scene in its styles (slice 2)

Slice 2 of three, stacked on slice 1 (#6106). Owner, 2026-09-29: *"those are all designs that we they can
pick from. all should work."* Every scene type of `prototypes/post_event_scenes_styles_2026-09-29.html` that
the platform has data for is now drawn in all of its styles and registered in the one scene-style registry
(`lib/scene-styles-post-event.ts` — 14 types · 42 styles; `lib/every-post-event-style-is-drawn.test.ts` fails
if a registered style has no branch, or a type no scene on the page).

**New in their styles** (`post-event-scene-views-2.tsx`, `-3.tsx`):
- **The Road to the Day** (countdown ★ · diary · scrapbook) — their Love Story's moments, then the platform's
  dated steps the story's spine already files (the date set, the look saved, the team booked, the camera
  opened), guest-layer entries only where the reader may see that layer. Drawn right after the Front Page;
  the spine no longer draws the road a second time.
- **Statistics · Schedule · Gallery · Front Page · Thank You** unchanged from slice 1.
- **Photo notes** — "Kwento", shown by its plain name (`PHOTO_NOTES_LABEL`): photo + note card ★ · scrapbook
  pairs · swipe story; the whole wall still opens full screen.
- **Messages** — the guests' letters: one letter at a time ★ (the prototype's own note: letters get B because
  they are long) · note wall · quote cards. The three voices carry into every style (parents lead, a role
  badge only beside a name) — `voices.test.ts` now scans this scene.
- **Papic Challenge** — Q&A cards ★ · photo answers grid · share of answers (a challenge has no fixed choices,
  so the third style compares what IS held: the share each question drew).
- **Supplier Stories** — credits roll ★ · photo strip · side by side; it credits the booked team as well as
  their own frames, so the article's team list steps aside while it is drawn, and the bar's Suppliers slot
  lands on it (`postEventSupplierStoriesDrawn`, one predicate for both).
- **Live Stream** (replay card ★ · full replay · highlights by chapter, each chapter at its place in the
  recording via the spine's `filmTimecode`) and **Videos** (featured ★ · playlist row · grid) — two scenes of
  the one film block (owner 2026-09-26: two types). ONE film open-up: the replay's, else the videos'.
- **Where Everyone Sat** — floor plan ★ · 3D room · list by table, from the story's room (a label and a
  position per table, never a name); a guest's own table — from their signed Papic session — in gold.
- **Entourage** — roll call ★ · portrait grid · family tree, from the SAME loader the invitation lists it with.
- **Before & After** (one style) — the Save the Date's cover beside the story's, only when a cover was chosen
  for after the day (`coverChosen`, `eventHeroUrl` on the story's data).
- New story blocks + switches `seating` · `entourage` · `beforeAfter` (orderable, shown by default, and in
  the story workroom's lists too). The compile learns them (tables, entourage people, a chosen cover); the
  navigator tiles use plain names (Front Page · Statistics · Photo notes · Messages · Papic Challenge ·
  Supplier Stories · Live Stream · Videos · Thank You · Song …), "Suppliers", never "Vendors".
- Before the day every styled scene waits on the couple's canvas with its line (and only before the day).

Gaps, listed not invented: **Clips** (the couple's own ≤15 s uploads) has no store yet — not registered;
supplier media carry no time, so "their frame beside a guest's capture of the same minute" pairs the frame
with the couple's own words instead; the seat plan holds no names or per-table counts, so no tablemates are
printed; portraits need captures tagged to each person — initials stand in; the road holds no pre-event
photos (a scrapbook of notes). No migration. +0 exported server actions.

SPEC IMPACT: `DECISION_LOG.md` — an "AS BUILT" row for slice 2 (the new blocks, Live Stream / Videos split,
Messages defaulting to One letter at a time, the gaps above).
