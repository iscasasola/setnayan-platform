# MARCH TRAY — progress (branch rd/march-not-walking-tray)

Brief: controller 2026-10-06 — the phone lower third under the Wedding March IS the "Not walking" tray
(DECISION_LOG 2026-10-06 "THE WEDDING MARCH ITEM IS A DRAG-AND-DROP MARCH MAKER"). Controller follow-ups:
(1) owner "No need to show the pdf file" → no Entourage card preview in the march (phone OR desktop);
(2) owner "Wait for apply" → march edits must be drafted. SPLIT: PR 1 (this branch) = tray + no guided chrome
+ no PDF; PR 2 (later branch) = drafted march via the hub draft.

## Decisions (measured)
- No existing column says "has a role but does not walk": guests has none (passed_away / invited_to_blocks mean
  other things); march_walks = one row per WALKER, and a guest with NO row is an unplaced member who WALKS by
  default (alone, end of section — maria-and-jose's couple have no row and walk). A column on guests is ruled
  out (march edits never write guests — march-edits-touch-no-guest.db.test.ts). A flag on march_walks would
  collide with walk numbering that every SQL move counts on.
- => new table `march_not_walking(event_id, guest_id)` + `set_march_walking(event, guest, walks)` SQL fn.
- Print consumers (invitation, everyone page, editorial, print-set card, post-event) keep printing the role:
  a non-walker has no march_walks row → prints alone at the end of their section. Only the Maker march
  (loadMarch) + readMarchLines (the actions' fresh read) drop non-walkers.

## Steps
- [x] migration + Ugat (20271265555437_march_not_walking.sql; tests/db/march-not-walking.db.test.ts green)
- [x] server action + readers (loadMarch, readMarchLines skips tray, setMarchWalking, marchPlaceOf skips non-walkers)
- [x] march-drag tray plans + tests
- [x] tray UI (portal into editor slot) + "+N more" sheet
- [x] workspace: no guided chrome / no PDF under march; guided Next/Skip moved to end of march body (phone)
- [x] lab fixtures (?march=owner), screenshots 375/390/1440 (local, build-sessions/march-tray-shots, untracked)
- [ ] guards, tests, changelog, PR

## Status 2026-10-06 ~10:20
- Crash PR #6379 (rd/march-crash-fix) open, draft, do-not-auto-merge; its commits are cherry-picked here.
- NEXT after this PR: PR 2 "drafted march" (owner "Wait for apply") — every march step (incl. walking) drafted via the
  hub draft; Apply writes through the same actions; remove HubSavesImmediately from the march.
- PR #6380 (this branch) opened DRAFT, do-not-auto-merge. Weekly usage 93% at 10:15 PHT — PR 2 (drafted march) NOT started.
- Pending when this was written: full unit suite run, Sonnet review findings (fix medium+), CI checks on #6379/#6380.

## Status 2026-10-06 ~11:00 — handoff
- #6380 head pushed: full unit suite run locally (7 stale guards found → re-pointed, all green), tsc 0, all blocking
  guard scripts green, Sonnet review: medium findings fixed (slot re-found via MutationObserver, sheet drag, Undo order,
  tray scroll target, parallel tray read). Open owner call: a non-walker's PRINT POSITION moves (role prints, pair does not).
- Not done: guided-flow screenshot on phone (the Maker lab's guide has no march step; the render test
  the-guided-steps-share-one-layout (1) covers it). Low review items: unread tray → read-only march; Space on "+N more".
- NEXT SESSION: PR 2 "drafted march" (owner "Wait for apply"): branch off this one; every MarchStep (incl. 'walking')
  becomes a hub-draft entry (find how non-events edits are drafted: lib/hub-draft.ts, hubDraftAction,
  planHubDraftApply in hub-draft-actions.ts); Apply replays the steps through the shipped actions; remove
  HubSavesImmediately + data-writes-live from details-march.tsx (and the (22) guard's opt-in count).
