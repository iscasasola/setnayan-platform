## 2026-11-02 · feat(schedule): a host's moment for one supplier or crew · the claim link moves to the Team row

Schedule and Chapters plan Steps 4 + 6 (corpus `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md`, "A host's moment for one
supplier, coordinator or crew" and §3 Suppliers "Sync").

- **Crew — no new table, no migration (Rule 0).** A crew on a moment is already an `event_schedule_tasks` row
  (`vendor_id` + `crew`, migration 20271300072429 — the shape the supplier's "Who on our side" writes on approval,
  #7161). The crew list the host picks from is the names that supplier's crew already carries on the event, and a new
  name is typed in the same search. A supplier is "on" a moment through `responsible_vendor_ids`, the column their day
  reads as "yours".
- **Suppliers and crew ▾ on the host's moment sheet** (`ForRow`, moment-sheets.tsx; pure half `lib/moment-for.ts`):
  one PickMenu with ticks, sections Suppliers and Crew, search (a typed name is offered as a new crew of each booked
  supplier). Ticking a crew member links their supplier to the moment AND its chapter, then writes one line for them
  (`what` = the moment's name); it shows on that supplier's day (Customer › Schedule) marked yours, with the crew
  member's name. Unticking a crew removes only that crew's lines; unticking a supplier who still has lines is refused in
  words. Visible to guests is never touched — guests read moments only through `onlyWhatGuestsMaySee`.
- **A task line for a supplier links them first** (`runMomentOp`): the Tasks section's Who ▾ now puts the moment on
  that supplier's day too, so a line is never written that their day cannot see.
- `CHAPTER_FIELDS` reads `responsible_vendor_ids` (Home's widget already did — its duplicate dropped).
- **The claim link has one door: the Booked › Team row** (`ClaimDoor`, booked-row.tsx) for a supplier not on Setnayan:
  "Not on Setnayan yet ⓘ · Until they join, you enter their times." + Share, through the one idempotent link writer
  (`createManualVendorInvite`). Removed from the workspace page: the copy box (`claim-link-share.tsx`, deleted), the
  "Invite link expired" card and the "Create a shareable invite link" form with its second writer
  (`createAutoShareInviteAction`, deleted). The Plan accordion's "Not on Setnayan yet — invite them" now opens the
  supplier's Team row (`?tab=budget&team=<id>`).
- Guards: `lib/a-crew-tag-reaches-the-suppliers-day.test.ts` (executed against an in-memory event, through the supplier's
  own day builder and the guests' fence) · `app/dashboard/[eventId]/vendors/the-claim-link-has-one-door.test.ts`. Re-pointed:
  `the-invite-link-outlives-the-modal.test.ts`, `promote-vendor-invite-nudge.test.ts`,
  `one-gate-decides-a-supplier-invite.test.ts`, `create-forms-round-trip.test.ts`. Port and no-card baselines lowered.

SPEC IMPACT: None — builds the plan's own paragraphs as written; a DECISION_LOG "as built" row records the reading
(no crew table; crew list = names on the event's moments; Team row Share is the claim door).
