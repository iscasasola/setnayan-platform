## 2026-09-27 · fix(maker): the navigator lists every scene; one tap opens its panel

Owner, 2026-09-27, on his own Event Hub: *"i still cannot edit. the editing body page is not
working at all. navigation still does not show the scenes and allow the scenes to be edited on the
editing screen."* Measured on production (Maker → Invitation): the Home tab listed ONE scene while
the canvas drew ten; every other scene hid behind the other tabs.

- **Every scene, one list.** The navigator lists every scene of the stage in canvas order. The
  guest tabs (Home · Details · Story …) are small headers between the groups, and tapping one jumps
  to its group. They no longer filter. "Not shown on … (n)" stays at the bottom.
  (`navigatorRows` in `lib/maker-navigator-tabs.ts`.)
- **One selection.** A tap in the navigator and a tap on the canvas map through the same functions
  (`lib/maker-selection.ts`), so each side's highlight follows the other and the navigator keeps the
  selected tile in view.
- **Never a blank panel.** A fixed scene (Names & date, the entourage, Our story, the film, the
  story after the day) opens its own panel beside the page. The panel has one line about the scene,
  plus either its workspace as a button ("Edit the names, date and photo") or where its content
  comes from (the entourage → the guest list). Tapping the names no longer swaps the whole stage
  for the Hero workspace.
- **Element styles in the panel.** Every scene's panel (and the hero's) lists its parts, and each
  one opens the element sheet from #6019. The RSVP form is excluded.
- A navigator tap scrolls the canvas to the scene's **top** (owner rule 2026-09-27, "a scene is as
  tall as its content"). No scene is resized.

SPEC IMPACT: None. This supersedes the 2026-09-26 "each tab lists its own scenes" navigator
behaviour at the owner's request. `the-event-bar-is-the-stages-own.test.ts` now asserts the tab is
a header, not a filter.
