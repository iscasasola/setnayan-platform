## 2026-10-09 · feat(studio): Studio › Mood Board & Dress Code wears the templates (Form row · ActionButton · top toast · centred confirm), saves unchanged

The Mood Board page moved onto the approved control templates (`INTERACTION_RULES.md` § 9). The five main colours, the room's parts, the flower parts and a
supplier's suggested change are Form rows (the colour pill opens the ONE colour picker); each role's outfit is the Form row's dropdown; every button (✨ Auto,
Keep / Undo it, Search ideas, Use as my five main colours, Use for …, Compare, Make more, the ＋ on a role) is the one ActionButton; a result is the top toast with
Undo where it can be undone; the headings' longer lines are behind the ⓘ. Taking a photo off a board now asks once, in the centred confirm box. The Do's & Don'ts are
Form rows (same form, same action, same fields, drafted when a row is kept), and they gain the row that was missing: HOW they look to guests (Two notes · Ticks and
crosses · Side by side — `canvas.dos`, the pick the toolbar's Style used to carry; owner, decided 2026-10-09).
NO write changed: the same actions, fields and moments (`lib/studio-mood-board-saves.ts`, held byte for byte against the payloads recorded from the page before it
moved — `lib/studio-mood-board-posts-the-same.golden.json`). Three failures that used to look like success now say so in plain words: a refused or dropped colour /
outfit save (the board goes back to what the draft holds), a photo that would not come off (it used to disappear from the screen and stay on the board), a photo
that would not upload (it printed the database's own words). The page takes its writers from a context so the dev lab's presses reach no database
(`app/dev/details-lab/lab-mood-board-actions.tsx`, `the-mood-board-lab-cannot-reach-the-database.test.ts`).
One read added to the Mood Board's existing parallel batch: the Dress code scene's row (the home of the look pick). All new client files are lazy (`maker-mood-board`).
Files: `studio/mood-board/_components/{mood-board-studio,studio-dos,mood-board-actions-context,auto-palette-sheet,mood-board-editor,dress-code-lists-form}.tsx`,
`lib/studio-mood-board-saves.ts`, `app/dev/details-lab/*`.
SPEC IMPACT: None (implements `Maker_Two_Bars_LOCKED_2026-10-09.md` DECIDED item 3).
