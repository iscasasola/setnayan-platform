## 2026-10-04 · fix(maker): the RSVP row opens its editor (guarded) · the old dress-code page forwards to the Mood Board

**B2 — the Maker's RSVP row (audit `INVITATION_RSVP_GUEST_FLOW_REMAINING_2026-10-04.md` § B2, row R2).**
One DEAD_TAP was recorded on "RSVP · Questions · who can reply · reply by" on
build 5666406, before the phone rebuild. Traced from the code today, the row is
WIRED: on a desk it is `<button data-details-nav-item="rsvp">` → `select`; on a
phone the strip is gone and the row is a `menuitemradio` in the editor sheet's
one dropdown (`SheetSections`, `onPick={select}`); the picked item's editor is
the one not hidden, and the RSVP item's editor is `MakerRsvpSettings`
(`maker-rsvp-ask.tsx`). The old dead tap was most likely a re-tap of the row
already picked on the old phone strip. No code change; a new guard
`launch/_components/the-rsvp-row-opens-its-editor.test.ts` holds the chain
(render + source, 7 sabotages each red).

**B7 — replace means remove (DECISION_LOG 2026-10-01 "THE DRESS CODE IS SET IN
THE MOOD BOARD").** `/dashboard/[eventId]/website/dress-code` (page + loading) is
deleted. Its fields and writer moved to the Mood Board:
`website/dress-code/_components/*` → `studio/mood-board/_components/`,
`website/dress-code/actions.ts` → `studio/mood-board/dress-code-actions.ts`
(the Maker's Dress code scene in `website/editor` imports them from there). The
old address forwards 308 to `studio/mood-board` (`lib/legacy-redirects.ts`; a
couple then lands on the Maker's Mood Board item). Repointed: the Nikah card's
modesty link ("…in your Mood Board"), the role-name revalidate, the editor's
rail row, the writer's error/saved landings; dropped the unused
`routes…website.dressCode` and its nav-registry slot. Regenerated: Root map
screens + retarget baseline, port-control baseline, no-card baseline (paths
moved, nothing raised). The old page's INC starter text in the editor is gone
with it — the guest's dress-code scene already says the INC/Muslim modest
guidance itself (`dressRiteOf`), so guests are told the same.

SPEC IMPACT: None — implements DECISION_LOG 2026-10-01 "THE DRESS CODE IS SET IN THE MOOD BOARD"; the audit rows R2 / M12 can be closed by the controller once merged and live.
