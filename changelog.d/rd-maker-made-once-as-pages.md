## 2026-09-25 · feat(event-hub): Details · Logo · Hero · Reveal · Love Story open as pages in the Maker's body — and the couple picks where the reveal plays

Owner, verbatim: *"on event hub maker, we do not want a pop up for details, logo, hero, reveal and love
story. we want their actual page to be on the body of the editor similar to the different stages."* ·
*"logo and hero and reveal and love story has no navigation since it is just full create your logo"* ·
*"hero is a 1 scene page that create a scene for your hero. Reveal, pick a reveal and see the effects,
fine tune it to your liking. Love story, add and create your story"* · *"they can pick where the want to
keep it. having it on the invitation and on the day will onlay be during the hero scene (First page) after
that, it will disappear."* · *"99% of the viewers will use the phone"*.

**The five made-once items are pages, not pop-ups.** Picking one swaps the Maker's body for that item's
own page, the way a stage swaps in its guest page; its controls sit where a stage's controls sit (the side
from 1024 px, a strip under the page below that — in the flow, never `fixed`, never a dialog). The scene
navigator is not mounted while any of the five is open; it belongs to the four stages.
- `lib/maker-made-once-pages.ts` (pure) — what each page draws; `launch/_components/maker-page.tsx` —
  `MakerPage` (page + controls) and `MakerPageFrame` (the guest page at the toolbar's device width).
- **Hero** — the guest page where the hero leads it (the Invitation, or On the Day), beside the hero's photo
  or card, and the Main background row once Maker P10 ships it on the hero row.
- **Reveal** — the stage it plays on, playing in place on load (and on ▶ / "Play the opening"). Beside it:
  the openings, **Where it plays** (Save the Date · Invitation · On the Day) and **Fine-tune** (butterflies,
  falling petals, veil and petal colours — the keys the Save-the-Date studio already sets). All in the draft.
- **Logo** — the logo studio IS the body (`VectorStudio`, reused; its own container query puts its panel
  beside its canvas from ~700 px). The full-screen sheet, its portal and its focus trap are gone; autosave
  is unchanged (pause · Back · tab hidden · page left · unmount).
- **Love Story** — Our Love Story (the scrapbook, the story's own page) is the body, with "As guests see it"
  one switch away; the Invitation's story words sit beside it. Moments are added and edited in place.
- **Details** — the body is what Details FEEDS: the Event Hub address with its QR, and The Invitation and
  The Finer Details cards drawn by the same route Prints & Tickets uses, redrawn after each save; the fields
  sit beside it. (Fields laid out as a page would only repeat the controls.) A failed read is said.
- Phone: the strip grows while a text field has focus and scrolls it into view; the Maker shell follows the
  on-screen keyboard (`visualViewport`), so the keyboard never covers the field being typed in. Tap targets
  on the new controls are 40–48 px.

**Where the reveal plays — the couple's choice (relaxes the 2026-09-14 Save-the-Date-only rule).**
- Migration `20271247886587_events_reveal_stages.sql` — `events.reveal_stages text[]` (CHECK ⊆
  save_the_date · rsvp · event; NULL = never chosen = the Save the Date only, so every existing page is
  unchanged), granted SELECT + UPDATE to `authenticated` only, `events_host` rebuilt, post-conditions.
- `lib/reveal-stages.ts` — the choice, its default, and the first-page rule. `cinematicRevealPlays` asks it
  (one rule for the Event Hub and the invite door, both passing the couple's stages).
- Off the Save the Date the opening plays on the hero scene only: a guest who lands part-way down is not met
  by it, and once opened it is gone (the veil does not keep its valance; scrolling past the first page
  retires it). The Save the Date keeps its film opening exactly as before.
- Draft: `reveal_stages` (free) and `std_reveal_effects` (a changed effect is Pro at Apply; the film's
  `music` switch stays live-owned — Apply keeps the live value) join `HUB_DRAFT_EVENT_COLUMNS`. Reset never
  touches either.

**Tests.** `lib/the-made-once-items-are-pages.test.ts` (renders the Maker: each of the five draws a page in
the body with its controls beside it, no dialog / sheet / portal / inspector, no navigator; a stage draws
the stage again; no made-once file mounts a pop-up) · `lib/the-couple-picks-where-the-reveal-plays.test.ts`
(all 8 choices × 4 stages; never after the day; the default; the wake / no-film / phases-off fences; the
invite door; the first-page rule reaches the overlay; the draft and Apply rules) · updated
`the-made-once-group-drafts`, `every-maker-form-drafts-or-says-so`, `the-reveal-stops-at-the-save-the-date`
(header: that file holds the default).

SPEC IMPACT: `DECISION_LOG.md` 2026-09-25 rows "MAKER: DETAILS · LOGO · HERO · REVEAL · LOVE STORY OPEN AS
PAGES", "WHAT EACH MADE-ONCE PAGE IS" and "OWNER ANSWERS — SIX CONTROLLER QUESTIONS" (2) are the decisions
this ships; `EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md` Phase 6 as-built note updated (made-once items are
pages; reveal stages column). Not built here, flagged: the hero as a full template/motion scene and "the
hero is the Post Event cover and the Main background" need the guest hero renderer to read a scene canvas.
