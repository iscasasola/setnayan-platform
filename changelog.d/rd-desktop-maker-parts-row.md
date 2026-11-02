## 2026-10-19 · feat(maker-desk): the picked row of the parts column carries ＋ above · grip · 🗑 · ＋ below; one hover ring (desktop Maker, doc PR 4 rest)

Owner rulings: 2026-10-07 "DESKTOP ADAPTATION APPROVED — ALL FIVE A" (`MAKER_DESKTOP_ADAPTATION_2026-10-07_fable.md`
§ Stages, LEFT, and "Mouse"); the desktop system sheet's piece 6, approved 2026-10-15 (one hover ring: 2 px of
#A9834B on pressable things only). Still dark for couples behind `makerDesktopColumnsEnabled`; a phone is untouched.

- **The picked row's four** (`stage-panel/desk.tsx` `DeskParts`): ＋ Add above · grip · 🗑 · ＋ Add below — the
  picked part's own edits (`usePartEdits`, handed in as `tools={edits}`), behind the frame's own gates: ＋ where the
  frame draws ＋ (a reply line: its `lineAdd`), the grip only where the part may move, 🗑 = the tag menu's Remove
  (Delete for a scene of their own). The Reveal and the Cover Scene stay locked (none of the four).
- **The grip, with a mouse**: held, it draws a line above / below the row it would land by — only rows of parts it
  may land among (the page drag's own targets, `moveAmong`); let go, it lands through the drop's one order write
  (`moveNear` → `dropOn`), said on the line under the tools as a page drag is. With the keyboard: ↑ ↓ on the grip,
  one place (the tag's Move up · Move down).
- The picked row is scrolled into view in the column (a part picked on the page may sit low in a long list).
- **One hover ring** (`DESK_HOVER_RING`, `maker-desk.tsx`) on every pressable row of the column and on Style's
  look tiles — the rows' old grey hover goes.
- `usePartEdits` hands out `addAbove` · `addBelow` · `moveAmong` · `moveNear` (no new write: the frame's ＋ door,
  the drop's targets and the drop's write).
- Guard: `lib/the-desktop-parts-row-is-the-frames.test.ts` (no write of its own; the frame's gates; locked first;
  one hover ring) — sabotaged 4 ways, red each.

NOT IN THIS PR (named): a hidden part dimmed in the list — the list is the parts the page draws, and a part taken
off is brought back by ＋ (the phone's way); the doc's dimmed row needs the stage's hidden list beside the drawn
one (next slice, with Arrange's "On this stage" — the phone has no Arrange since 2026-10-09).

SPEC IMPACT: None — builds the approved `MAKER_DESKTOP_ADAPTATION_2026-10-07_fable.md` PR 4 (rest).
