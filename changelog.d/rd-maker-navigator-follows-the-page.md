## 2026-09-25 · fix(event-hub): the Maker's scene list follows the page, in the page's order

Owner, verbatim: *"why does the slides not follow the sequence alotted"*, and
*"shouldnt mobile mode also have mobile preview on navigation"*.

**Root cause.** The navigator was built from raw `invitation_widgets` rows — every
hideable row in `display_order`, the same twelve on every stage. The canvas draws
the page's own plan: `resolveSiteBodyPlan` decides which sections a stage has
(`WIDGET_PHASES` + the anonymous allow-list, since the canvas is a host with no
guest cookie), a fixed masthead leads, the entourage follows, and a section with
nothing in it (`special_message`, `what_to_bring`, an empty love story, a gallery
with no photos) renders nothing. So on the Invitation the navigator read
"1 Event details · 2 Countdown · 3 Schedule …" while the canvas drew
"names → countdown → run of show → venue …", and listed sections that never drew.

**What changed.**
- `lib/maker-scene-list.ts` — `makerStageList` / `makerStageLists` ask
  `resolveSiteBodyPlan` for the canvas's own list, then apply the anonymous
  dispatcher's null-render rules case by case. Output per stage: `shown` (fixed
  tiles `f:film · f:editorial · f:hero · f:entourage · f:story` and draggable
  scene tiles `w:<type>`, in canvas order) and `folded` (everything else, each
  with its reason: hidden by you · only on each guest's own link · not part of
  this stage (+ where it does show) · empty).
- The navigator (`editor-shell.tsx`) draws that list: numbered 1…n over what
  shows; fixed sections are locked tiles with a lock and an ⓘ ("Always here on
  this stage …"), not draggable; the rest drag. A "Not shown on <Stage> (n)"
  fold lists the others with an ⓘ reason, an edit button, and the eye for a
  section you hid. Under open browsing the order is set by kind, so the
  navigator says so instead of pretending a drag does something.
- **Drag writes the order the renderer uses.** `swapsForDrop` counts a drop in
  the FULL hideable order (hidden and off-stage rows included) that
  `moveWidgetUp/Down` swap in, and posts that many single swaps through the
  existing draft form (`HubDraftField`, `?chain=`).
- **Tiles take the device's shape** (Desktop 16:10, Phone 9:19.5) and show a
  miniature of the section from its own data — eyebrow, title, first line, its
  colour or photo ground, the theme's tint (`maker-navigator-data.ts`). No iframe
  per tile. Small screens keep the horizontal strip at the bottom.
- **Canvas ⇄ navigator.** In the canvas only (`isEditorCanvas && editorBridge`),
  `site-body.tsx` stamps a hidden `[data-maker-section]` marker before each
  section; `EditorBridge` scrolls to a tile's section (`scrollTo`), replays a
  section in place (`play`), and a tap on a section selects its tile (`edit`).
  Guest HTML is unchanged.
- **▶ Play** is a menu: "Play this scene" replays the selected section's entrance
  in place in the canvas (disabled with an ⓘ until a scene is picked); "Preview
  the whole <Stage>" opens the page-only draft preview in a new tab.
- **Words.** "Setnayan account explainer" → "Two ways to celebrate" (what guests
  read); the always-on parts are named for what a guest sees ("Names & date",
  "Personal greeting", "Guest's QR pass"). "Spec…" was "Special message" cut off
  by a one-line tile — labels wrap now. "Camera cues", "Photos you add" and
  "Each guest's own photos" are an earlier owner rename
  (`the-four-photo-names.test.ts`) and are kept.

**Verified** on the local harness (Next dev + sample-data stand-in, signed in as a
sample host), reading the navigator's tiles against the sections the canvas
actually drew: equal on Save the Date (`film → names → entourage`), Invitation
(`names → countdown → run of show → venue → dress code → camera cues → two ways
to celebrate → entourage`), On the Day (`names → venue → two ways → entourage`)
and Post Event (`story after the day → names → two ways → entourage`). A tile
click scrolled the canvas (0 → 2006px to Dress code); a canvas tap selected the
tile; a drag of Venue onto Countdown wrote two draft swaps and both lists read
`names → venue → countdown → run of show …`; Play this scene started the
section's entrance animation. Screenshots at 1440 Desktop, 1440 Phone and 375.

⚠ **Measured, not assumed:** Countdown, Camera cues ("Photo moments") and "Two ways
to celebrate" DO render on the Invitation — on the harness and on the live
`/cale-ice` page (their headings are `h3`, which an h1/h2 scan misses). They are
listed, not folded.

**Tests.** `lib/the-navigator-follows-the-page.test.ts` — for all four stages the
scene tiles are `resolveSiteBodyPlan(...)`'s own list in its order; the owner's
page stage by stage; nothing lost (shown XOR folded, with a reason); a hidden
section keeps its eye; a reorder moves the navigator as it moves the page;
`swapsForDrop`; open browsing; guest-facing words; `ourStoryRenders` agrees with
`<OurStory>`'s render; the source reads the stage list and stamps the handles.

**Not done here (flagged):** the page's own chapter numbers ("№ 04 · № 05 ·
№ 08") are hard-coded in each widget (`schedule-widget.tsx`, `dress-code-widget.tsx`,
`entourage-section.tsx` …) and keep their gaps when a section is empty. Renumbering
or dropping them is a guest-page design change, not a navigator one. "Both" (device)
is still "Coming next" in the toolbar, so tiles have two shapes, not three.

SPEC IMPACT: None — the navigator now reflects the page's existing rules; no rule changed.
