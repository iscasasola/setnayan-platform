## 2026-09-29 · feat(maker-details): Words · Story & plans — and a fact tapped on a stage opens its Details field

Details part 2b (stacked on part 1, `rd/themes-on-details-page`). Implements DECISION_LOG 2026-09-28
"DETAILS IS THE ONE FILL-IN AREA; STAGES ARE LOOK AND MOTION; TAP IS A SHORTCUT", "NO 'GO EDIT IT
OVER THERE' LINKS", "OPTION B — EVERYTHING MADE ONCE LIVES IN DETAILS" and 2026-09-29 "THE PLAN
ADAPTS TO EVERY EVENT TYPE".

- **Words** — Special message · Thank-you message · Opening line · Kindly reply are Details items.
  Each is the SAME editor part 1 mounted under its print switch (same component, same save path):
  one field, two doors. `same-field.ts` keeps the two doors of a fact one value (the print words
  form reads the FIRST field of a name, so a stale door would otherwise win).
- **Story & plans** — moved whole, never re-drawn:
  · **Love Story** — the scrapbook page (`OurStoryEditorPage maker=1`) is the picture, the Story
    row's `StoryPanel` (its chapters, moments and questions) the editor. The Maker's own Love Story
    page is gone from the work area (it was drawn twice); its layout/theme stays for part 3.
  · **Schedule** — the shipped Schedule page (`CoupleSchedulePage maker=1`: rail, PickMenus,
    announcements, reminders), whole; it is its own editor, so the item has no right column.
  · **RSVP** — the guest's RSVP (`MakerRsvpCanvas`) is the picture, the shipped `MakerRsvpSettings`
    the editor; the reminder-emails tour rides the picture (mounted on first open).
- **Old doors land on the item** — `?tool=love-story` / `?tool=rsvp-page`, a scene's "Open … editor",
  a restored tab: part 3's ONE translation (`movedPageItem` / `movedSelection`, which already named
  them and lights up now that the items exist); `/website/our-story` and `/schedule` redirect to the
  item — only where `makerHasWork` (the couple of an event with an Event Hub; Love Story also needs
  two named people). A coordinator, or a type with no Event Hub, keeps the standalone page. Schedule
  is a `'whole'` page (its own tools, no second editor), RSVP a `'fill'` page (`detailsItemLayout`).
  With Love Story gone too, the work area draws no made-once page — its dead page code is removed.
- Stacked on part 3 (#6102, merged in): merge #6102 into part 1 first.
- **Tap a fact → the same Details field on the right** — the launch page builds the fact editors
  ONCE (`detailsFactEditors`) and hands the same nodes to Details (`facts`) and the shell
  (`factEditors` → `MakerContext`). A tapped special message (or its scene's Content), the love
  story's words, the story section: the inspector draws that node (`data-maker-fact-editor`), with
  what is typed previewed on the scene (`DetailsFactSceneContext` → `useSceneWordsBox`). A heading,
  a label, the joiner stay on their part (`detailsItemForTap`, `STAGE_FACT_TAPS`). A scene the couple
  changed "just here" keeps the box that asked, so its ↺ is never lost.
- **Every event type** — Love Story only where the type has two named people
  (`hasTwoNamedPeople`, moved verbatim out of `wedding-only-parts.ts`); every Words item, the Schedule
  and RSVP for all. No wedding word in any item.
- Tests: `lib/details-words-and-plans.test.ts` (incl. "a tapped fact opens the SAME component",
  sabotaged and seen to fail); source guards moved with the code (`the-made-once-items-are-pages`,
  `details-edits-in-place`, `every-scene-is-in-the-navigator`, `maker-live-savers-draft`,
  `details-adapts-to-the-event-type`). +0 exported server actions · no migration · port-control
  baseline regenerated.

SPEC IMPACT: `Setnayan/DECISION_LOG.md` — one "AS BUILT — DETAILS PART 2b" row (what moved from
where, and the deviations for the owner: the Schedule has no stage tap-editor — it is a whole page,
a tap on its scene still selects the scene; "Reply by" and Requests keep their shipped links out of
the RSVP settings; the hero's names/date/venue taps wait for part 2a's "Your event" items).
