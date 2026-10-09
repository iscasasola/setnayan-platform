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

## 2026-10-09 · feat(studio): Studio › Logo's chrome wears the templates (Action button · Form row · Switch · Dropdown · Slider · Pill selector · centred confirm), saves unchanged

The chrome around the Logo's drawing surface moved onto the approved templates. Play / Edit, Add Text · Image · Frame, Centre it, the trace buttons, Cancel and the
layer arrows are the one ActionButton; Layers | the picked layer is the Pill selector; a layer's Name and Words are Form rows (kept when the row is left); Frame and
Motion In · During · Out are the Form row's dropdown; Remove white background is the Form row's switch; the six sliders are the template's range (the centre snap kept); the
trace help sits behind ⓘ; the picked layer wears the accent. Removing a layer now asks once, in the centred confirm box. The canvas, its drag, the trace and
`lib/glyph-path.ts` are untouched. NO write changed: the page's one save (`hubDraftAction`, `monogram_custom_svg` + `monogram_studio_config`, after the pause, only on a
real change) is built in `lib/studio-logo-saves.ts` and held against the payloads recorded from the page before it moved (`lib/studio-logo-posts-the-same.golden.json`, 16
scenarios, 0 diffs with the random layer id masked). A refused or dropped save used to announce the database's own words to the toolbar; it now says one plain sentence. A
name or words typed in a Form row reach the layer when the row is kept, not letter by letter. The page takes its writer from a context (`launch/_components/logo-actions-context.tsx`)
so the Maker lab's stand-in (`app/dev/maker-lab/lab-logo-actions.tsx`) reaches no database. All new client imports ride the lazy `maker-details` chunk.
SPEC IMPACT: None.
