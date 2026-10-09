## 2026-10-09 · feat(maker): The Day's toolbar is the approved prototype's — the Camera is a full-screen page with its three looks

The new Maker's toolbar (Edit · Style · Background · Animate, phone only, behind `makerStagesStudioEnabled`) on **The
Day**, part by part, against the approved prototype (`public/review/studio-head-prototype.html`, walked headless at
375 × 812 and 375 × 667) and the owner's rulings (`Maker_Two_Bars_LOCKED_2026-10-09.md`, "The Day › Camera").

**The Camera** (owner: *"Camera is a full screen design"* · *"edit is greyed out too. only have style"*)
- It could not be picked at all: its page was a small grey shape with no marker, nothing was picked on arriving, and
  every tool was "live" over four empty rows — the three looks were unreachable.
- The Camera's page IS the camera now: one part, edge to edge above the guests' bar, drawn from the camera's own
  pieces in the look picked (`stage-panel/camera-page.tsx`, `camera-face.tsx` — the same mechanism as the Reveal:
  drawn into the Maker's canvas from the lazy toolbar; nothing in a guest's page, and the live camera is still never
  opened in the Maker). It is picked on arriving and by a tap; picked, its frame is inside its edge.
- Only Style is live. Edit, Background and Animate are grey and each says the prototype's own line (*"Nothing to
  edit on the camera."* · *"The camera is the whole screen."* · *"Nothing to animate on the camera."*).
- Style is the three looks that exist — Classic · Your brand · Challenges — as the toolbar's Style cards over all
  four rows (`StyleCards` gains a `picture` render so the Camera draws no card of its own). A pick shows on the card
  and on the page at once. The prototype's **Minimal** and **Film** are a proposal the app does not have: not built.
- What a pick saves is unchanged (`{ events: { style_preferences: { camera_look } } }`, intent `save`). It now goes
  through the draft door the work area lends — `hubDraftAction` itself on a real event — so it can be tried on the lab.

**Happening now** — Style slid over four empty rows; it is grey now and says *"Style has nothing to change on this
part."* (`MAKER_PARTS_NO_LOOK`, `lib/maker-parts.ts`).

**Left as shipped, and named** (`lib/the-day-toolbar-is-the-prototypes.test.ts` `NOT_AS_DRAWN`): the prototype draws
"Open in Studio › Look" on the Reveal and Happening now and "Open in Studio › Prints" on the pass — Studio has no place
behind the first two, and the pass's ticket style is picked right there under Style (which the prototype greys). The
Day's Gallery has no look cards (the prototype's three are tagged NEW — a proposal). Background and Animate on the
fixed blocks stay grey (another builder's work).

**Lab** — `/dev/maker-lab` draws The Day as the real canvas files it (`app/dev/maker-lab/guest/lab-day.tsx`): five
pages, the day's own parts on the page the one filing puts them on, the Camera a page. Dev-only.

Guards: new `the-day-toolbar-is-the-prototypes.test.ts` (5; eight sabotages seen red and restored). Re-aimed, each with
its reason in place: `every-style-card-is-phone-shaped` (the Camera's cards joined the toolbar's Style cards),
`the-stages-panel-is-the-prototypes`, `a-tool-with-nothing-to-do-says-so`, `the-toolbar-is-four-rows`,
`the-preview-only-selects`.

First load: nothing added. The new modules are imported only by `stage-tools.tsx` and `stage-panel/camera-look.tsx`,
both reached only through `details-lazy.tsx`'s `dynamic()` (chunk `maker-details`); guard (5) holds that. `next build`
was not run.

SPEC IMPACT: None.

## 2026-10-09 · feat(maker): Post Event's toolbar is the prototype's — the scene's words, "Shown to guests" and its place are Edit's; Style is its look cards alone

The new Maker's toolbar on **Post Event** (phone only, behind `makerStagesStudioEnabled`), against the approved
prototype (By the numbers · Wishes · Supplier stories · Watch live, walked headless at 375 × 812 and 375 × 667).

**What was wrong** — the scene's own panel (`post-event-scene-panel.tsx`, the desktop's inspector) was drawn whole
under Style: its cards and then This scene · Shown to guests · Order · Its parts — 334 px and more in a 210-px room
with no scroller, so the switch, the order and "Its parts" could not be reached; and Edit's first row was empty.

**Edit** (`stage-panel/post-event-edit.ts`, `post-event-shown.tsx`, `stage-edit.tsx` `second`)
- Row 1: the scene's words, typed right there — ONE box: the text last tapped on the page, else the Heading, else the
  scene's first. Only the parts the scene's STYLE draws (the panel's "Its parts"); the page shows the words as typed.
- Row 2: **Shown to guests**, the app's one switch. Off, the scene leaves the page at once and stays picked, so it can
  be switched on again in the same place. A scene with no switch of its own leaves the row empty.
- Row 4: ↑ Earlier · ↓ Later · Remove (unchanged — the frame's own writes).
- The one ⓘ on the "You're editing" line holds the panel's own sentences, word for word (`POST_EVENT_ABOUT`).

**Style** — the scene's look cards in the toolbar's four rows and nothing else (`PostEventScenePanel` when the toolbar
is on). The desktop's panel is every row, exactly as before.

**Every save posts what it posted** (golden, executed against a fake door in
`lib/the-post-event-toolbar-is-the-prototypes.test.ts`): the words `{ editorial: postEventSetWords(…) }`, the switch
`{ editorial: postEventShow(…) }`, a style the panel's own `pickStyle` — the one draft door, `intent=save`, followed by
a Maker render (never held: every writer of the story builds on the arrangement the last render read).

**Also**
- Four Post Event scenes have ONE look of their own (Before & After · Song · What comes next · Live Photo Wall): their
  Style is grey and says *"Style has nothing to change on this part."* instead of sliding over four empty rows
  (`MAKER_PARTS_NO_LOOK`, held equal to the style registry).
- The "You're editing" line was cut by less than a pixel beside an ⓘ ("PHOTO NOTE…" — the browser rounds
  `scrollWidth`): the words are now measured to the fraction, so the part's name stays whole (`stage-tools.tsx`).
- Background and Animate stay grey on a Post Event scene (the shipped rule; the prototype's are tagged NEW).

**Has no place in four rows — not built, nothing invented:** the "Filled from" line · the "Its parts" buttons (a
part's own font, colour, size and motion; its WORDS are reachable — tap the line on the page and Edit's box follows) ·
the nine addable scenes (still added with ＋ on the page, as before).

**Found, not changed:** ten Post Event scenes are not in the part map (`lib/maker-parts.ts`; measured with
`makerPartOfCanvas('editorial', 'p:<scene>')`) — Front Page, the day's chapters, Gallery, Videos, Messages, Where
Everyone Sat, Entourage, Thank You, Suppliers We Loved, Powered by Setnayan. A tap on one names no part: Style works
(its cards), Edit's rows are empty. And "Were you there?" has one look, but shares its part with The Day's Photos of
you, so its Style is live over empty rows.

Guards: new `the-post-event-toolbar-is-the-prototypes.test.ts` (6; eleven sabotages seen red and restored).
`the-post-event-panel-wears-the-templates` passes unchanged.

First load: nothing added. `post-event-edit.ts` and `post-event-shown.tsx` are imported only by `stage-tools.tsx` and
`stage-panel/part-words.ts`; the panel's toolbar branch is inside `post-event-scene-panel.tsx`, itself reached only
through `scene-styles-lazy.tsx`'s `dynamic()`. All in the `maker-details` chunk. `next build` was not run.

SPEC IMPACT: None.
