## 2026-10-08 · feat(studio): Background — one Source, picture cards, Video ◆, Shade (restudy 2/9)

Owner, verbatim (2026-10-08): *"main background does not show the animated
backgrounds, color, upload media and everything we can do for the background
restudy this and create a better approach to design background."* →
*"restudy is good"* (DECISION_LOG "APPROVED — THE LOOK RESTUDY: BACKGROUND ·
ELEMENTS · MUSIC"; contract `BACKGROUND_RESTUDY_2026-10-08_fable.md` § 2.1 and
§ 6 row 2). Stacked on restudy 1/9 (`rd/look-three-tabs`).

The new Maker's Studio only (flag off = every couple today keeps the shipped
Look as restudy 1/9 left it). No new data, no migration, no new server action:
every tap is the save its old row made, through the same draft door.

- **Source ▾** — ONE dropdown: Colour · Pattern · Scene ◆ · Video ◆ · Your photo
  or video ◆ (`lib/background-source.ts`). The source is READ off what is
  stored (`backgroundSourceOf`); picking one only shows its cards. What the
  main background is sits behind the row's ⓘ (it was a paragraph under the bar).
- **Picture cards** for the source on screen, each over a drawn CSS fallback —
  never a broken image: Colour = Plain · Dawn · Diagonal · Glow of the page
  colour; Pattern = Fine lines · Dots · Lace · Grid (the guest page's own CSS,
  now `lib/main-ground-patterns.ts`); Scene = the ten ready-made stills; Video =
  the nine theme loops; Your photo or video = the cover photo, their own
  pictures and clips, and an Upload card that opens the shipped uploader in
  place. The hero video's uploader (moved out of Music in 1/9) sits here.
- **Video ◆ cards are the loops themselves**: a muted `<video preload="metadata">`
  over the poster over the loop's two sampled colours; it plays only while most
  of the card is on screen (`IntersectionObserver`), there is no `<video>` at
  all under "reduce motion", and a loop that fails removes itself.
- **Colour** opens the Mood Board's one picker (`StudioColourField`), for the
  page and for a pattern. A Colour card picked from a picture takes the picture
  off and sets the colour in ONE draft save.
- **Shade ▾ on every source**, with **Candlelight ◆** as its darkest step
  (`events.site_art_direction`, written from here; in the Studio it no longer
  sits under Elements › Colours). Blur ▾ · Focus ▾ · Motion ▾ (Parallax ◆) keep
  their rows where they apply. "Match my photo's colours" is one dropdown.
- **A draft can take a live Candlelight off the canvas** — the stated limit in
  `host-draft-look.tsx` is fixed (`CandlelightOffOnCanvas`, the host's canvas
  only; guests' HTML is unchanged).
- **One mount of each control**: with the Background panel on screen, Look does
  not draw the page fill, the hero video or the old extras a second time; with
  no panel (the app-store shell) they stay rows of Look.

After the controller's walk of the preview (2026-10-08, real event, 375):

- **A Pattern card shows its pattern on any page colour.** On a dark paper
  (`#1e2229`) Fine lines · Dots · Lace were three identical dark rectangles: the
  card drew the page's pattern in the DASHBOARD's ink. Measured by running the
  page's own look resolver — the guest page was right (its ink flips light:
  the stroke reads 1.17–1.34 : 1 there, against 1.00–1.01 : 1 on the card). The
  card now draws the same definition in an ink measured for its paper, strong
  enough to tell apart at card size (`lib/main-ground-pattern-cards.ts`,
  ≥ 1.6 : 1, held for eight papers). The guest page is untouched.
- The card strip snaps to the panel's padding (the first card's ring was cut).

Deviations from the prototype, each said in the PR: Scene carries ◆ (the shipped
Pro rule holds a ready-made scene as own media); on a flat colour or pattern
Shade ▾ lists As is · Candlelight (the shipped veil is measured over a picture);
the greyed Motion/Blur rows and the "Effects" block are plan row 8; rows are the
Studio's hairline rows (the glass-row class clips the ⓘ popover).

Guard: `lib/the-background-has-one-source.test.ts` (8 tests), plus re-aimed
assertions in `studio-screens-follow-the-prototype` and
`studio-round-3-follows-the-owner`. Each seen red under a sabotage.

Guests: same stored values → same pixels. The only guest-tree edits are a
byte-for-byte move of the pattern CSS into a lib const and the host-canvas-only
Candlelight marker.

After the owner's look at the preview (2026-10-08), three rulings, built on this branch:

- **A Background card is phone-shaped** — *"we are on mobile view, so show in mobile
  view, not like a header that is short and wide or at least square or 4:3 or 3:4"*.
  Every card (Colour, Pattern, Scene, Video, Your photo or video, the cover, Upload)
  wears the Maker's one picture-card frame, `.sn-phone-card`: 3 : 4 portrait, a fixed
  width, never stretching in a wide panel (he saw 436 × 86 cards at ~896 px) — the
  strip scrolls. The card of the picture ON the page is cropped where the page crops
  it: the guest page's own rule, now ONE function (`mainGroundPosition`,
  `lib/hub-canvas.ts`), read by `main-ground.tsx` and by the card. The name stays on
  one line and its ◆ is never cut. Guard: `the-background-has-one-source` (9).
- **A pick shows at once, and says what it is waiting for** — *"took 8 seconds before
  a background shows"* · *"when i press, and it has a loading state, we want to know
  something is pressed and loading files... applying to your Hub."* In the Studio a
  pick is now four things in order: the tapped card is ringed and wears a small
  progress mark from the tap; the canvas wears the pick (its still first, its loop
  when it moves; a colour or pattern at once) on a layer the editor bridge owns; the
  draft save runs behind it HELD (`makerRedrawSave` — no whole-Maker render; the
  canvas page re-renders itself in place and only then does the preview step aside);
  and ONE polite line says "Loading files…", then "Applying to your Hub…" — never
  flashed for a wait under ~300 ms, gone when the canvas shows it. A later tap wins
  (every pick has a number; an older answer moves nothing). A refused save or a
  picture that could not be read puts the old background back, takes the preview off
  the canvas and says so in place with Try again — never a success look.
  Before: the pick waited on its save, the save owed a whole-Maker render, and that
  render loaded a NEW canvas document (`editor-shell.tsx`, `setCanvasStamp(next)` →
  `BufferedCanvasFrame frameKey`). The stopwatch is in the code
  (`performance.mark('bg-pick:*')`). New: `lib/background-pick.ts`,
  `app/[slug]/_components/main-ground-preview.ts` (the bridge's half — every field of
  a message is checked before it becomes CSS). Guard:
  `lib/a-background-pick-shows-at-once.test.ts` (8 tests).
  The shipped Maker (flag off) is unchanged. A file just uploaded still brings the
  Maker's render (it has no address the canvas could wear yet).
- **No "hero" card without a cover photo** — *"why same as hero? i thought our hero
  uses no background to use our main background?"* The card that follows the cover is
  drawn only when the event has a cover photo, shows that photo, and is named "Your
  cover photo"; with none there is no card at all (it was an empty grey placeholder).
  An event stored as following a cover that is gone reads as what guests see (Video
  on a theme with a loop, else Colour). In the Studio, picking it reads the photo's
  colours in the pick itself and saves the follow in one save. Guard:
  `the-background-has-one-source` (10).

Guests: nothing of theirs changes. The preview layer is drawn by the editor bridge,
which only ever mounts in the host's Maker canvas.

SPEC IMPACT: None beyond the approved contract — status in the corpus at
`LOOK_RESTUDY_BUILD_STATUS_2026-10-08.md` (deviations listed there).
