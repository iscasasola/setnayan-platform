# HANDOVER — claude/who-is-it-for-groups (Builder WF, 2026-10-28) — PAUSED

Contract: corpus `prototypes/who_is_it_for_2026-10-28/` + DECISION_LOG 2026-10-28 "EVENT TYPES MUST BE SPECIFIC"
(implementation note appended on corpus main, b6a9901c). PR **#7001** (draft, `do-not-auto-merge`, autoMergeRequest null).

## Built (all committed + pushed)
1. **Your groups** in "For ▾" (organizer groups only; `buildGroupSubject`, `groupHiddenTypes`, `subjectCommunityId`;
   form posts `community_id`). 2. **Business types only** (no "Show all" for business/group, `subjectMayShowAll`).
3. **Celebration** hidden for new events (migration `20271294233183`, `enabled = FALSE`); Event settings › **Kind of
   event** line (`event-kind-line.tsx`, `event_type_switch` door in `updateEventMatchCriteria`, session client).
4. **Ask us to add it** (`ask-for-event-type.tsx` → `event_type_requests`, RLS pattern A on `user_id`) → Admin › Event
   types "Asked for by hosts" (`event-type-asks.tsx`; answers ride `setEventTypeStatus` / `createEventTypeRoster` via
   `request_id`) → in-app `event_type_added` (enum migration `20271293446382`) when the type is In the picker.
+0 server actions (1225). Maps regenerated: Ugat claim, screens, port, admin jobs/map, exposure, FK map, home-shelf,
erasure (OWN_ROW_DELETES), export (personal-data-export + export-completeness + subject anchors).

## Verified
- Unit: render test (4) + rules test (9) + create-event dir + affected guards green locally; each new guard sabotaged red.
- DB (under lock): 35/35 incl. `event-types-must-be-specific.db.test.ts`, ugat-both-ends, comp-grant, user-fk-behaviour.
- Walk (`shots-2026-10-28/who/walk-wf.mjs`, lab :3655): chromium 390 light 24/24; all configs pass except WebKit
  "Ask send" (Playwright WebKit cannot intercept the 127.0.0.1 auth mock → sheet answers "Sign in again" in words).
  Side-by-sides: `shots-2026-10-28/who/sbs-{A,B,C,D}-{chromium,webkit}-{light,dark}.png`.

## Next step (when resumed)
1. Read CI on the head (`gh pr checks 7001`); round-3 failures were all fixed in later commits — confirm green.
2. Not yet run: db sabotage of the ask policy (`AND status = 'pending'` removed → test 2 red), under the lock.
3. Dark shots of the create grid stayed light (ThemeProvider strips `.dark`; app DARK_READY is empty) — Kind line dark OK.
