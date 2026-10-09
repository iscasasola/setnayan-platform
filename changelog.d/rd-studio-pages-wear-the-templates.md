## 2026-10-09 · feat(studio): Studio › E-Gifts wears the templates (Switch · Form row · the one dropdown), saves unchanged

The first of the remaining Studio pages moved onto the approved control templates (`INTERACTION_RULES.md` § 9). "Accept gifts?" and each way to
give (GCash · Maya · Bank transfer · PayPal) are the Form row's Switch; a way's number, the name on the account and the registry link are Form
rows (tap the pill, type, tap out or Enter keeps it); the thank-you words are one long Form row with its help behind ⓘ, and "Start from" is the
Form row's dropdown. The hand-made `StudioSwitch` is gone. NO write changed: the same actions, fields and moments (the live ways and registry link
stay live, "Accept gifts?" and the thank-you words stay drafted until ✓ Apply) — the fields are built once in `lib/studio-egifts-saves.ts` and held
against the payloads recorded from the page before it moved (`lib/studio-egifts-posts-the-same.golden.json`). The thank-you words are now sent
when their row is left rather than on each pause in typing (one write, never more). A failed save says so under its row in plain words and never
looks saved; a write that threw (a dropped connection) used to say nothing and now says so.
Files: `launch/_components/studio-tools.tsx`, `pabuya/_components/pabuya-message-editor.tsx`, `launch/_components/details-answers.tsx` (`as="switch"`),
`launch/_components/details-answers-parts.tsx`, `launch/_components/maker-details.tsx` (passes `studio`), `lib/studio-egifts-saves.ts`.
SPEC IMPACT: None.

## 2026-10-09 · feat(studio): the labs' Studio presses reach no database — stand-ins for E-Gifts' writes (`StudioActionsContext`)

The Studio pages take their writes from a context under the actions' own names (`launch/_components/studio-actions-context.tsx`: setEgiftMethodEnabled · saveEgiftMethod · savePabuyaMessage · hubDraftAction ·
the QR upload's storage); the app never provides it, the dev labs do (`app/dev/details-lab/lab-studio-actions.tsx`): the writes succeed locally so the row shows its saved state, the QR upload goes through the lab's
storage stand-in, and `&refuse=1` refuses with database-looking words so the plain sentence can be seen. Guard `app/dev/details-lab/the-studio-lab-cannot-reach-the-database.test.ts`. Every Studio page converted
from now on adds its writes here, in its own commit.
SPEC IMPACT: None.

## 2026-10-09 · feat(studio): Studio › Prints wears the templates (Action button · Switch · Form row · the one dropdown), saves unchanged

Part one of Prints. Every Save on the page (a piece's Classic / themed / Sample files, the whole set, every guest's pass, the free prints, the pass zip and the Pro door beside it) is the ONE ActionButton
(`PrintSaveButton variant="action"`: the same fetch, share sheet and download, the same "Preparing…" · "Tap to save" · error · "Saved." states; the row's one filled step is terracotta). A piece's name, its sizes and its
size ▾ are one Form row. Every include switch (Parents · Opening line · E-Gifts · … twelve) is the Form row's Switch posting through the same print words form, with the fields under a switch that is off still mounted
and still posted as before; the seat plan's 3D · 2D · List is the one dropdown (three choices); the print words form's Save is the ActionButton; "Event Hub QR code · Always printed" is a Form row. The shipped Maker's
Details keeps its own `Toggle`, `Segmented` and `SaveWords`. NO WRITE CHANGED and the page holds no price, no order and no confirm step: the words about Pro and the one door to the unlock page are held byte-identical
(`lib/studio-prints-money-is-unchanged.golden.json`); the form's posted FormData is held against what the old page posted (`lib/studio-prints-posts-the-same.golden.json`). The labs: a Save asks no route (a stand-in PDF)
and the print words form is taken on the lab's side — nothing reaches the database. Not moved yet: the Menu editor, the poster photo, the pass card's look, "Changed since you printed", Kindly reply and the parents' cards
(see the guard `lib/studio-prints-are-the-templates.test.ts` for why). Template additions (additive): `SwitchRow formId`, `ChosenRow line`.
SPEC IMPACT: None.
