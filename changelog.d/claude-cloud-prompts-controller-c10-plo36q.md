## 2026-10-01 · feat(maker): a Prints door on the top menu, and one theme pick returns background, fonts and colours to the theme

Maker core part 3 (C10), the delta only — most of the cut-down Maker already shipped (inventory in the PR body).

- **Top menu** — the bar is the stages (Save the Date · RSVP · Invitation · On the Day · Post Event) │ Details · **Prints**
  (`maker-bar.ts`, the owner's 2026-09-30 "THE MAKER RE-PLAN IS CUT TO ITS CORE": *Details | stages | Prints*). Prints is a
  door into Details, open on the prints (`makerPrintsDoor`, `isPrintsItem` in `lib/maker-details-items.ts`) — Prints & Tickets
  stays folded into Details and no page of its own was added; Details and Prints share one highlight (`makerOpenTool`). On a
  phone it is the same one picker, with Prints in it. Held by `the-top-menu-is-details-stages-prints.test.ts`.
- **Theme = one pick** — a pick writes `invite_theme` **and** clears the couple's own page colour, button colour and typeface
  (`lib/theme-own-look.ts` `THEME_OWN_LOOK_RESET`) in the same draft patch, so the page really wears the theme's own background,
  fonts and colours; one Undo, one count on Apply, never Pro. They can still override each after. The hero's Main background
  and the candlelight / magic-move switches are deliberately untouched. Held by `lib/a-theme-pick-hands-the-look-back.test.ts`.

No new server action, no new route, no migration, no theme changed.

SPEC IMPACT: None
