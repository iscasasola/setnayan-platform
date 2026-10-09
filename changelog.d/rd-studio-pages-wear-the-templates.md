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
