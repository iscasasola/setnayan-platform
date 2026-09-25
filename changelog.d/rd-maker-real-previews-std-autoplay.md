## 2026-09-26 · fix(event-hub): the Maker's tiles are real previews, the Save the Date plays in order, and Guest bars frame only the slide

Owner, verbatim: *"the navigator preview must really show the preview. it is so hard to see what i
will edit because i do not see it."* · *"i am looking at cale-ice save the date. the sequence created
on their save the date has a sequence. all is on autoplay. but the slides do not follow."* ·
*"guest bars should only show on the slide and not the actual whole stage openning. that role is for
the preview stage"*. (DECISION_LOG row 2026-09-25, recorded by the controller.)

### 1 · Navigator tiles show the section itself

Each tile was a words-only card built from the section's text ("TOGETHER W…", "COUNTING D…").
Now each tile is a **static copy of that section out of the Maker's own canvas**, in a script-less
document as wide as the canvas, scaled into the tile — the theme, fonts, photo/poster, layout and the
couple's words exactly as drawn (`lib/maker-tile-preview.ts` · `scene-snapshot.ts` · `scene-preview.tsx`).

- **Why a copy, measured against the options:** no DOM rasteriser ships in `package.json`, and one
  would have to re-fetch every photo and font as a data URL (R2 photos are cross-origin) and cannot
  draw a playing video; a mini-iframe of the whole page per tile is a full server render + hydration +
  the stage's opening per tile. The copy is one `outerHTML` read of a canvas that already rendered,
  reusing the URLs it already loaded; its own viewport keeps `vw`/`svh`/`fixed` right.
- Sandboxed with **no scripts**; mounted **only while the tile is on screen** (IntersectionObserver on
  the navigator's scroller); fades in over the old words-only card, which stays underneath as the
  stand-in — the tile box never changes size (no layout shift).
- Re-taken when the canvas announces `ready` (edit, Apply, stage change, View as) and when it changes
  width (Desktop ⇄ Phone, window resize). A section the canvas does not draw keeps the words card.
- Drag, the eye, long-press and the "Not shown on …" fold are untouched: the preview sits UNDER the
  tile's button and takes no pointer. Small-screen strip tiles are a little wider (phone 64 px,
  desktop-shaped 112 px) so the picture reads at 375.
- Post Event tiles (#5983) snapshot through their own canvas anchor.

### 2 · Save the Date — Auto plays the scenes in order (root cause)

Reproduced on the local harness (cale-ice-shaped sample: botanical STD theme, veil opening, open
browsing off). The stage is three scenes, film → names & date → entourage, and only the first ever played:

- **Preview / guests:** the film ran its beats (1/7 → 7/7 in ~32 s) and then stood on its close beat
  for the rest of the 2-minute sample. The close has `dur: Infinity` and **nothing listened for the end**,
  so the names and entourage never followed unless someone pressed "See our page".
- **Maker canvas:** the veil opening played inside the canvas and waited for a tap
  (`__stdRevealActive = true`), the film was a full-screen layer covering the names and entourage, and
  the navigator's film handle pointed at the page column under the film, not the film.
- "Auto" on the scene panels means *the theme's default motion*, never a clock between scenes; on this
  stage the three tiles are fixed sections that carry no transition at all.

Fix: the film announces its close (`STD_FILM_CLOSE_EVENT`); `StageAutoplay` holds the close for one Auto
beat, lifts the film (the same event "See our page" sends), then brings each following scene into view
for one Auto beat in the page's order — which is the navigator's order by construction
(`lib/stage-autoplay.ts`, the page's own Auto clock `HUB_AUTO_SCENE_SECONDS`, no new number). Any touch,
wheel or key hands the page back; reduced motion runs no clock. Runs for guests and in
"Preview the whole stage", never in the canvas.

### 3 · Guest bars frame only the slide; the whole stage is the preview tab

- The Maker's canvas (`?editor=1`) no longer plays the stage opening, and draws the Save-the-Date film
  as **one slide in the page's flow** (muted, playing in place — the builder's own preview mode), so the
  canvas is film → names → entourage to edit. The film's handle now sits immediately before the film.
- A canvas reload (the Guest bars switch among them) **returns to the scene being edited** instead of
  the top of the page, with the guest header and tab bar over that slide.
- "Preview the whole stage" (`?preview=draft`) is the complete guest experience: it now also shows the
  guest's bars, plus the opening, the film and Auto. The Reveal panel's "Play the opening" opens that tab
  instead of reloading the canvas.

### Tests

- `lib/the-tiles-are-real-previews.test.ts` — the tile document carries the section, stylesheets and
  dressing; script-only states dropped and motion frozen; nothing executable crosses; device-shaped
  viewport and scale; SOURCE: every shown tile mounts the preview, keyed by its navigator key, under the
  button, sandboxed without scripts, refreshed on `ready` and on resize.
- `lib/stage-autoplay.test.ts` — Auto steps equal the navigator's list for a cale-ice-shaped stage
  (film → names → entourage), one Auto beat each, strictly increasing schedule, every fixed scene has an
  anchor, SOURCE wiring.
- `lib/guest-bars-frame-the-slide.test.ts` — the two host doors told apart; bars/opening/film per door;
  RENDERED handoff + film in each mode; the reload returns to the selected scene; "Play the opening"
  opens the preview tab.
- Sabotage: dropping the canvas reveal gate, the slide branch, or the close event each turns its test red.

SPEC IMPACT: None beyond the DECISION_LOG row the controller already recorded (2026-09-25, "Maker
navigator tiles must be real previews · Save the Date Auto must play in order · Guest bars frame only
the slide"). ⚠ Owner-visible behaviour change for GUESTS: after the Save-the-Date film's closing beat
has been on screen for one Auto beat (4.5 s) with no touch, the film lifts and the page walks
names → entourage. A tap on the close (e.g. Add to calendar) keeps it there.
