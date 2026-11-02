## 2026-10-04 · fix(dress-code): an INC wedding's empty dress code starts with the modest guidance again

Removing the old `/website/dress-code` page (#6318) dropped its INC starter:
an Iglesia ni Cristo host who opened an empty dress code used to find the
modest, formal guidance already filled in, with a one-line note. Restored on
both places the dress code is edited now, through one shared rule
(`studio/mood-board/_components/inc-dress-code-starter.ts` ·
`incDressCodeStarter`):

- the Mood Board's Do's and don'ts form (`dress-code-lists-form.tsx`, fed by
  `mood-board-editor.tsx`) — the starter do's and don'ts + the note;
- the Maker's Dress code panel (`DressCodePanel`, fed by
  `website/editor/page.tsx`) — headline, line, do's and don'ts + the note.
  The Maker's scene tiles keep reading the SAVED dress code, so a starter is
  never shown as if the couple had chosen it.

Fires only when the event is INC (either rite column) AND nothing at all is
set. Form defaults only — nothing is written until the host presses Save.
Guard: `inc-dress-code-starter.test.ts` (INC + empty → pre-filled + note ·
INC + anything set → untouched · not INC → nothing · rendering calls no
action · both surfaces ask the one rule), each held by a sabotage run.

SPEC IMPACT: None — implements DECISION_LOG 2026-10-04 "YES TO ALL" ("restore
the INC modest-dress starter text inside the Mood Board's dress-code form
(lost in #6318)"); no corpus edit needed.
