## 2026-09-26 · feat(event-hub): Post Event is many small scenes — before and after the day, with its own presets

Owner, 2026-09-25 (DECISION_LOG "POST EVENT IS MANY SMALL SCENES"): *"the story on
that scene 1 of post event is the whole story, what we want is to cut them into
smaller scenes … giving them freedom to add new scenes. So for post event. scene
creation will have different preset scenes as well."*

Extends P8 (#5983) — nothing it built is replaced.

- **Always its scenes.** The Maker's Post Event navigator now lists every scene
  before the day too (`readPostEventForMaker` runs for every open; it only ever
  WRITES after the day). A scene that fills itself from the day is `waiting`,
  shown as **Not yet**, and says what will fill it ("Your photos from the day
  appear here." — `POST_EVENT_WAITING`). After the day the compile fills the
  same keys. The single "The story after the day" tile is now only the fallback
  when the story's scenes cannot be read.
- **Each scene has its own panel** (`post-event-scene-panel.tsx`): what fills
  it, show / hide, earlier / later, and — for a scene of the couple's own — its
  title and words and a Remove.
- **One source of truth.** No new key and no second order: the Maker drafts a
  copy of the story's own `sections` / `sectionOrder` / `customColumns`
  (`HubDraft.editorial`, `lib/post-event-draft.ts`), the host's canvas and the
  navigator read live-with-the-draft, and **Apply** writes those three keys into
  `event_editorial.draft_json` (nothing that decides who reads the story).
- **Post Event's own presets** (`lib/post-event-presets.ts`): on the Post Event
  stage "+ Add a scene" offers a thank-you note, a letter, a chapter of the day,
  a line to remember, a gallery grid, a film, a wishes wall, Were you there?,
  what's next and in memory — each a couple's own column carrying `preset`. The
  other three stages keep the 25 layouts. The guest page draws each preset in
  the run (the four "a part of the day" presets show the gallery / film /
  wishes / a door to each guest's own day from the data the story already
  redacted for that reader; words alone when that part does not exist yet —
  only the Maker's canvas shows the waiting line).
- **Pro:** show / hide, order and their words are free; a NEW scene of their own
  is Pro — tried in the draft, held at Apply without Event Hub Pro (the rest of
  the draft still applies). Hidden in the store shell.
- The Post Event first-visit tour now describes this and shows before the day.

Tests: `lib/post-event-draft.test.ts`, `lib/post-event-is-many-small-scenes.test.ts`;
`every-maker-form-drafts-or-says-so` now scans the new panel and counts the one
Post Event preset picker.

SPEC IMPACT: `EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md` Phase 8 gains an "as built —
many small scenes" note (where the drafted arrangement lives, the preset set,
the Pro line, what Apply writes); `DECISION_LOG.md` 2026-09-25 row gets its
as-built pointer. Flagged for the owner: Apply writes the scenes into the story
but does not change who can read it (the story's own audience setting still
decides); a column written in the story workroom stays free there, while a new
scene added in the Maker is Pro at Apply.
