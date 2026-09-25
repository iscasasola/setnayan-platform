## 2026-09-25 · feat(event-hub): Our Love Story — each story a scene on the Invitation stage

Event Hub Maker Phase 7 (`EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md`), against the
prototype `our_love_story_scrapbook_2026-09-25.html` and the 2026-09-25 owner rows
("each love story is a scene" · "Max of 5 for free. no media files" · "love story
is part of the inviting stage" · no theme picker in Love Story).

**RULE 0 — extended, not rebuilt.** `/dashboard/[eventId]/website/our-story`, the
`events.love_story` JSONB, `updateOurStory`, the guest `our_love_story` widget and
its phase map (`rsvp` + `editorial`, i.e. Invitation and Post Event) all shipped.
No new page, no migration, no new table.

- **`lib/love-story-moments.ts`** (new, pure) — `love_story.moments[]` beside the
  legacy keys: `{id, date:{y,m?,d?}, line, place?, media?, added_by?, anchor?:
  met|yes, hidden?, canvas}` — `canvas` is the same `HubSectionCanvas` every
  scene carries. Seeded (never written on a read) from `how_we_met` / `spark` /
  `proposal` / `milestones[]` with stable ids; chapters Before us · How we met ·
  Falling · The yes · Toward the day from the two anchors; a year alone sorts
  before a dated moment of the same year; `momentCapRefusal` is the one cap rule
  (free: at most 5 stories and no photo; everyone: 100); `loveStoryScenes` is the
  guest plan — one scene per visible moment with a suggested Maker template — and
  the seam Phase 5's renderer takes over.
- **`loveStoryMomentAction`** (+1 server-action export, in
  `website/our-story/actions.ts`) — intents `add · edit · delete · arrange ·
  pick`. The server reads `eventCoupleWebsiteProActive` and refuses the sixth
  story / any photo for a free event before it writes; new photo refs are
  NSFW-screened fail-closed (the `updateOurPhotos` rule); `pick` only accepts a
  ref one of the couple's own events holds.
- **The scrapbook** — the page now opens as "Our Love Story": masthead with names
  and three stats, ONE theme line ("Theme: X · Change in Event Hub Maker ↗", the
  event's resolved theme via `resolveHubTheme`; palette worn through `--ls-*`),
  years strip / rail, chapters with gentle prompts, the add/edit sheet (When: exact
  day · month · just a year; a line; where; added by; "This one is…"; a live "Will
  sit in"), Pick from our events, and "On our Event Hub" (the moments as scenes).
  The sixth story or any photo shows one line, "Add more stories and your photos ·
  Go Event Hub Pro", linking the existing offer with the catalogue price; in the
  store shell the words alone. The legacy wedding form stays below, collapsed —
  its words still feed `composeOurStory`. Open to every event type (plan D5).
- **Guest widget** — `OurLoveStoryWidget` draws one `<article data-love-scene>`
  per visible moment (legacy stories render through the seed); photos are signed
  in `SiteBody`'s one existing signing pass. `our_love_story` content presence now
  means "has a visible scene", not "the JSON is truthy".
- **Tour** `customer_love_story_v1`; `TourSlide.sells` + `MiniTour`/`GuidedTour`
  `storeShell` drop the Pro slide in the app-store shell.

- **The Maker bar** (P1, #5967, merged) — the "Love Story" tool now opens a door
  to the scrapbook ("Open Our Love Story") above the words row, and no longer says
  "coming in the next build"; the editor's Story row leads with the same door.

⏭ Waits on: **P5** (scene templates/renderer — each moment carries `canvas` and a
template hint), **P2** (#5966, merged while this was in review — its draft holds only
`rsvp_backdrop` among `events` columns (`HUB_DRAFT_EVENT_COLUMNS`), so Love Story
writes stay LIVE, like `updateOurStory`; joining the draft = add `love_story` to
that list, overlay it in the host preview, and re-screen photo refs at Apply),
**P4** (#5969 —
upload pipeline, clips and the 100 MB meter; photos use the shared `FileUpload`
today). Papic booth photos are not offered in Pick yet (private bucket, needs a
per-event sharing answer).

⚠ The owner's own event is hosted by an `is_internal` account, which
`eventSkuActive` treats as holding every SKU — so on `cale-ice` the five-story cap
will NOT appear. That is the entitlement working as written, not a bug in the cap.

SPEC IMPACT: None — implements the 2026-09-25 DECISION_LOG rows and plan Phase 7
as written; the D5 default (every event type) is applied, not re-decided.
