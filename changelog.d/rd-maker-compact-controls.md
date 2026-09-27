## 2026-09-27 · feat(maker): each guest's own parts in place; one picker for the tabs; the toolbar never clips

Three owner rulings from his session on the Maker, 2026-09-27.

- **Each guest's own parts are drawn in place** in the Maker: the Personal greeting, the Guest's QR
  pass and the RSVP, right after the names, as "Your guest". There is no sample content (owner: "no
  sample content"). They were under "Not shown on Invitation" before. Each is a tappable scene:
  - the greeting and the pass say "Each guest sees their own", with a link to the guest list;
  - the RSVP says "This scene is made in the RSVP editor", with an **Open RSVP editor** button.

  They extend `MAKER_FIXED_LABEL`, `MAKER_FIXED_SOURCE` and `MAKER_FIXED_TOOL`; no second mechanism.
  Guests never receive this markup (`isMakerCanvas` only).
- **The navigator's tab row is one control** ("Home ▾") beside the palette icon (owner: *"this should
  be a tap to show option to pick or a drop down"*). The pill row used to wrap to 140px in the 168px
  column. Picking a tab jumps the navigator and the canvas to that group; it never filters and never
  changes stage.
- **The toolbar never clips.** When the stage row cannot fit, it collapses to "● Invitation ▾" +
  "Pages ▾" (owner: *"convert this to a drop down/tap to show options for smaller screens"*). This is
  decided by measured overflow (ResizeObserver), not a breakpoint. When even the two pickers cannot
  fit (a 1024px laptop leaves the bar about 150px), they take their own row inside the toolbar. The
  pickers run the same `onPress` as the buttons.

  Measured with the real `MakerShell`, with nothing clipped at any width:

  | Width | What the toolbar shows |
  |---|---|
  | 1024 | pickers on their own row |
  | 1440 | pickers inline |
  | 1920 | the full row |
  | 390 | pickers |

- **The "iframe pile-up" is the navigator's live thumbnails**, not a leak. Each is a srcDoc frame
  laid out at the canvas width (862×539 is the 16:10 tile before its `scale()`), one per tile in
  view, reused when its copy changes. The canvas iframe is keyed and replaced on each save, never
  stacked. `the-maker-controls-are-compact.test.ts` pins that.

SPEC IMPACT: None. This implements the owner's 2026-09-27 rulings as relayed by the controller.
