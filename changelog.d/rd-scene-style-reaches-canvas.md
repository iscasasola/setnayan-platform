## 2026-10-06 · fix(maker): a style pick shows on the canvas in place — and a save never resets the page

Owner, live on iPhone (ec8ec7c), Maker › Invitation › Countdown › Format › Style:
he picked "Big number" and the canvas kept the four boxes. Also: *"When i change
palette style it still resets the page."*

**Measured in the dev Maker lab with production's latencies (`/dev/maker-lab?slow=1`).**
A scene's Style is a different component, so the bridge cannot draw it. The save
was not held, so the only way it reached the canvas was the whole-Maker render it
was waiting for: the save, then a 3–6 s Maker render, then the canvas page loading
behind. In the lab nothing changed for 20 s. Separately, every Maker page frame
(Look, Hero, Reveal, a guided step, the RSVP page) was keyed on the render stamp,
so every save mounted a new frame. That page loaded from the top, so Dress code
was lost and the cover showed instead.

- **`makerRedrawSave` (`lib/maker-refresh.ts`).** A pick the bridge cannot draw is
  saved as held, so no Maker render is waited for. When the last such save lands,
  every page the Maker shows re-renders itself in place: a new `refresh` bridge
  message runs `router.refresh()` inside the page. The document, the scroll and
  the section in view all stay the same.
  - Used for a scene's Style and the Venue map switch (`SceneStyleCanvasRow`),
    the Dress code palette look (`PaletteLookCanvasRow`) and a fixed part's style
    (`FixedSceneStyleRow`).
  - Also used for a background pick that changes who draws the card. That pick
    used to force a whole-Maker render (`releaseCanvas`). It is now held and
    redrawn in place.
  - The Maker keeps its own copy of each canvas (`noteDraftedCanvas`), so the
    next panel builds on the new pick.
- **`MakerPageFrame` is keyed on its page.** A Maker render (`refreshOn`) or a
  redraw refreshes it in place. A page with no bridge is still loaded again, as
  before.
- **Eyebrows at 375.** Each eyebrow's box sized itself to its words alone, and the
  3.5rem rule could not shrink. That squeezed the words to one per line and broke
  "E-Gifts" at its hyphen, even in a 327 px column. The rule is now a width the
  box counts and the first thing to shrink. The words never shrink.
- **Dev Maker lab.** The lab now has a real Countdown with its drafted Style, the
  real E-Gifts, Love Story and note eyebrows, and a Dress code palette stand-in.
  Its draft is held in a cookie, its page stamp changes on every render, the
  real editor bridge is on the canvas, and `?slow=1` adds production-like
  latency.

Lab proof, at 375 and 1440 px:
- Countdown › Big number showed about 3 s after the tap. Before the fix nothing
  changed for 20 s.
- Look › Colours › Palette changed with the view still on Dress code: same
  document, same scroll.

Guarded by `apps/web/lib/a-style-pick-redraws-the-canvas-in-place.test.ts` and
`apps/web/lib/an-eyebrow-keeps-its-words.test.ts`. Five sabotages each turned one
of them red:
- the old unheld style save
- a Look frame keyed on the render stamp again
- a reload in place of the in-place refresh
- a rule that cannot shrink
- a redraw sent after every save instead of after the last one

SPEC IMPACT: None.
