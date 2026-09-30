# F2 progress — rd/guest-list-search-and-hosts-fold (stacked on #6192 rd/guest-card-and-rows-redesign)

Brief: corpus `CLOUD_PROMPTS_OCT3_2026-09-30.md` § F + controller prompt (F2). Spec: `docs/handoff-2026-09-30/GUEST_LIST_ACCESS_AND_HOSTS.md` §A, §B items 2 and 4; `CHECKIN_COLUMN_AND_PARTS_ROW_PLAN.md`.

## Already done before F2 (do NOT rebuild)
- F1 (#6200, merged into E): Promote-coordinator → planner workspace; Overview helper feed; `/hosts` + `?gview=hosts` redirect; legacy seat migration.
- E (#6192): Check-in column, phone column picker, card redesign.

## Order
A (top bar searches guests) → pop-up "Who can reply?" → B2 (helper grants + colour + activity onto the guest card) → B4 (parts row removed LAST).

## Done
- A · top bar searches guests (`lib/search-scope.ts` guests scope, `app/dashboard/(launcher)/_components/guests-top-search.tsx`, FindAddRow = Add + Filter + Sort, `guests-search.tsx` deleted, guard `guests/the-top-bar-searches-guests.test.ts`). port baseline regenerated.

- Pop-up "Who can reply?" (`lib/who-can-reply.ts`, `guests/_components/who-can-reply-ask.tsx`), guards `lib/who-can-reply.test.ts`, `guests/the-first-visit-asks-who-can-reply.test.ts`, extended `lib/who-can-rsvp-is-one-value.test.ts`.
- B2 helper pieces on the card (`lib/guest-helper-card.server.ts`, `guest-helper-access.tsx`), guard `the-helper-pieces-live-on-the-card.test.ts`.
- B4 parts row removed; redirects; guards updated (pillar-parts, roster-doors, event-viewer, skeleton).
- Phone frame 2 (`guests-phone-menu.tsx`, FindAddRow Filter ▾, round + FAB), guard `the-phone-guest-list-is-frame-2.test.ts`.

## Next (was)
- Pop-up "Who can reply?" (writes rsvp_ask_config.whoCanRsvp through `hubDraftAction` save — the only writer; draft → live at Apply: FLAG to controller). Invite MiniTour renders only when the pop-up is not showing.
- B2: on the guest card, Limited helper only: CoordinatorGrantChips + CoordinatorSeatControls (no Remove — Access→None is removal) + CoordinatorColourDomains (via loadCoordinatorColourGrantees) + this person's activity lines (fetchDelegateActivity filtered by user).
- B4: remove PillarPartPicker/guestListParts from guests page; ?gview=checkin → /guests/checkin; ?gview=hosts → /guests; keep /hosts redirect page.
- Controller add (2026-10-01): PHONE Guest list = frame 2 of corpus `prototypes/phone_app_simple_2026-10-01_fable.html`: title + ⋯ · search (top bar hosts it on phone) · ONE Filter ▾ · counts line · rows; setup (Sort · Show ▾ · Import · Share · Finalize) behind ⋯; add → round +. Don't do Home/Your Team/More.

## Left / verify
- Full unit suite + every CI guard + bundle check (build) — see PR checks.
- Not on this branch (in flight elsewhere): manual "Finalize the list" (#6198) and "Guests reply?" (G1) — the ⋯ has neither yet.
- Show ▾ (phone column picker from E) stays as the column header, not moved into ⋯.

## Gotchas
- Bracketed test paths: `npx tsx <file>` (no --test) runs them; `tsx --test` with brackets runs 0.
- eslint: `ESLINT_USE_FLAT_CONFIG=false npx eslint <files>` from apps/web.
- Shared bundle is 16 B under the 206,848 B cap on E: NO new dynamic() chunk, no new route (webpack runtime chunk map grows).
- Who-can-RSVP's only writer is the Maker's draft door (`hubDraftAction` save) — live only after Apply.
