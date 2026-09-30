# F2 progress — rd/guest-list-search-and-hosts-fold (stacked on #6192 rd/guest-card-and-rows-redesign)

Brief: corpus `CLOUD_PROMPTS_OCT3_2026-09-30.md` § F + controller prompt (F2). Spec: `docs/handoff-2026-09-30/GUEST_LIST_ACCESS_AND_HOSTS.md` §A, §B items 2 and 4; `CHECKIN_COLUMN_AND_PARTS_ROW_PLAN.md`.

## Already done before F2 (do NOT rebuild)
- F1 (#6200, merged into E): Promote-coordinator → planner workspace; Overview helper feed; `/hosts` + `?gview=hosts` redirect; legacy seat migration.
- E (#6192): Check-in column, phone column picker, card redesign.

## Order
A (top bar searches guests) → pop-up "Who can reply?" → B2 (helper grants + colour + activity onto the guest card) → B4 (parts row removed LAST).

## Done
- (nothing yet)

## Next
- A

## Gotchas
- Shared bundle is 16 B under the 206,848 B cap on E: NO new dynamic() chunk, no new route (webpack runtime chunk map grows).
- Who-can-RSVP's only writer is the Maker's draft door (`hubDraftAction` save) — live only after Apply.
