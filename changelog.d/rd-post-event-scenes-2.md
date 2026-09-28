## 2026-09-29 · feat(event-hub): Post Event scenes in their styles (slice 1) — and the one scene-style registry every stage shares

Owner, 2026-09-29, on `prototypes/post_event_scenes_styles_2026-09-29.html`: *"those are all designs that we
they can pick from. all should work. and they pick since we already have the designs"* — and, the same day,
*"we want at least 3 choices for each scene that are premade. even the countdown and other scenes"*.
Slice 1 of three (brief `POST_EVENT_SCENES_BUILD_BRIEF_2026-09-26.md`, L1 · L3 · L4 + the style framework).
Started fresh from `origin/main` (L1): the stale `rd/post-event-scenes` branch's waiting state and drafted
arrangement were carried over by hand, its ten presets and its `customColumns`-as-scenes were not (§3 drift).

**The one scene-style registry — `lib/scene-styles.ts`.** A scene TYPE → its styles, each with a permanent
semantic id (never a letter: where scenes share a name — Schedule, Gallery — ONE value carries across stages),
the stages its renderer draws it on and the event types it suits; the first style drawn on a stage is its
default unless `defaults[stage]` says otherwise. Many files, one registry (`mergeSceneStyleSets`): Post Event's
sets are `lib/scene-styles-post-event.ts`, the other stages' go in `lib/scene-styles-stages.ts` (empty until
that build), and the same id in two files is one style drawn on the union of their stages. Resolver:
`resolveSceneStyle(type, stage, picked, eventType)` — a pick is drawn only where its style is drawn.
Stored as `canvas.style` on a section row (FREE — not a look key; a style alone never frames a scene) and, for
a Post Event scene, `event_editorial.draft_json.sceneLooks[<scene>].style` — except Schedule and Gallery, whose
one value lives on the `schedule` / `our_photos` row (`POST_EVENT_STYLE_HOME`). The Maker's Style row
(`scene-style-row.tsx`, ONE PickMenu with a line per style) is mounted first in every scene's Format tab and
draws nothing until the registry offers that scene two styles on that stage. `lib/scene-styles.test.ts`.

**Post Event, drawn in its styles** (`app/[slug]/_components/editorial/post-event-scene-views.tsx`): Front Page
(full-bleed · magazine · the card — in the spine's place, so the story never prints its name twice), Statistics
(big numbers · receipt · infographic — its own scene, no longer a sidebar), Schedule (one chapter per screen ·
timeline · clock face), Gallery (grid · mosaic · film strip — the preview; the whole gallery still opens up,
tabs per reader) and Thank You (letter · words only · photo + words). Every value arrives through the story's
two fences unchanged; a style never widens what a reader may see. Each scene's label, heading and words are its
three PARTS, found by the shipped selectors, so the couple's own font · size · colour for a part is the same
scoped `<style>` every section uses (`hubElementSceneCss`, scope `pe_<scene>`), and their own words replace the
written line (`sceneLooks[<scene>].words`). Replaced components removed: `ByTheNumbers`, `Stat`, `StripCell`,
`CollagePreview`, `FromTheCouple`, and the chapters' `LivingMoments` mount (port-control baseline regenerated).

**Before the day** the Maker lists every Post Event scene, each `Not yet` with the line that says what fills it
(`POST_EVENT_WAITING`) — from a LIGHT read that writes nothing (`readPostEventBeforeTheDay`); the couple's
canvas and whole-stage preview draw a waiting scene with that line in its style, and a guest never meets one.

**In the Maker** a Post Event scene's panel is Style · Shown · Order · its parts · what fills it
(`post-event-scene-panel.tsx`) — every control a draft save through the one draft door, nothing links out
(the "Show, hide or reorder in your story workroom" link is gone). A part tapped opens the shipped part sheet,
saving into the story's looks and carrying the part's own words field at its top. Apply writes the story's
three keys into its own row (`applyPostEventItems`, `event_editorial` added to `hubDraftWriteTables` — Reset
never produces one). Show / hide, order, a style and the words are FREE; a part's own font and animation are
Pro — held at Apply while the free part beside them goes live (`sceneLooksFreePart`, fail-closed).

**The Post Event Event Bar (E1 · E2)** — `resolveSiteNav`: after the day a guest reads Recap · Film ·
Suppliers · Gallery · Me; a stranger Recap · Film · Suppliers · Gallery; a slot with nothing behind it is
absent. Film opens the film's open-up (`#open-film`); Suppliers lands on the first team scene drawn — both
decided by the SAME predicates the page draws them with (`post-event-bar-facts.ts`). No guest or stranger
camera after the day; the couple keeps theirs (Suppliers yields first if the couple would have six).
`lib/the-post-event-bar.test.ts`. Brief §5 tests 1 · 5 · 6 · 7 each seen to fail once under sabotage.

Gaps, listed not invented: "came" (checked in) is not in the story's data, so Statistics says "said yes";
a chapter carries at most three photos and no count; the Front Page before the day shows no cover photo in
the navigator tile (the light read signs nothing). +0 exported server actions (reuses `hubDraftAction`).
No migration.

SPEC IMPACT: `DECISION_LOG.md` — an "AS BUILT" row for Post Event slice 1 and the shared scene-style registry
(where a style lives, the semantic ids, Schedule · Gallery as one value, the before-the-day light read).
