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

SPEC IMPACT: None beyond the approved contract — status in the corpus at
`LOOK_RESTUDY_BUILD_STATUS_2026-10-08.md` (deviations listed there).
