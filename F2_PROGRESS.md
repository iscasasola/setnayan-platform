# F2 progress — rd/guest-list-search-and-hosts-fold (stacked on #6192 rd/guest-card-and-rows-redesign)

Brief: corpus `CLOUD_PROMPTS_OCT3_2026-09-30.md` § F + controller prompt (F2). Spec: `docs/handoff-2026-09-30/GUEST_LIST_ACCESS_AND_HOSTS.md` §A, §B items 2 and 4; `CHECKIN_COLUMN_AND_PARTS_ROW_PLAN.md`.

## Already done before F2 (do NOT rebuild)
- F1 (#6200, merged into E): Promote-coordinator → planner workspace; Overview helper feed; `/hosts` + `?gview=hosts` redirect; legacy seat migration.
- E (#6192): Check-in column, phone column picker, card redesign.

## Order
A (top bar searches guests) → pop-up "Who can reply?" → B2 (helper grants + colour + activity onto the guest card) → B4 (parts row removed LAST).

## 🎯 TARGET (controller, owner reminder 2026-10-01) — NOT optional polish
The approved phone design `~/Documents/Claude/Projects/Setnayan/prototypes/phone_app_simple_2026-10-01_fable.html`,
frame 2 "Guests", IS the Guest list on a phone: title + ⋯ · one search (top bar) · ONE Filter ▾ (RSVP · Side ·
Role · Group) · one counts line · rows; Sort / Show / Import / Share / Finalize / Guests reply? behind ⋯; first
guest inside the top third at 390×844. Desktop keeps its header row but the SAME controls (one Filter ▾ + ⋯) —
"desktop may show more, never different". Report must include a 390 px screenshot.

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

## Phone head as built (measured, local harness at 390×844)
- Top bar (search) · "Guests" + ⋯ line (⋯ = Sort · doors · add doors) (phone-only, visible; the sr-only <h1> stays) · Filter ▾ line · counts line
  (no total) with a VISIBLE "Show ▾" (owner 2026-10-01: phone picks ONE column; desktop shows several) · rows · round + (the phone's Add). First guest row top = **279 px** (< 281 top third), no sideways scroll.
- Computer: add box · Filter ▾ · Sort ▾ · ⋯ in one row; doors row; meters. Capture bar's four doors are in ⋯ on a phone.
- Harness: `apps/web/app/dev/f2-guests-lab/page.tsx` — LOCAL ONLY, in `.git/info/exclude`, never commit. Mirrors the
  page's head with fixture data (no sign-in, no reads). Dev server: launch.json `f2` :3481.
- Owner correction (2026-10-01): EVERY PERSON IS THEIR OWN ROW — never merge a pair; guard in the-fable-card-and-rows.
- Known diffs vs the approved rows (NOT changed — pinned by E's guards; owner call): phone row shows a dashed "+"
  add-to-group after the role (`AddToGroupControl`, pinned by the-phone-card-edits-what-the-desktop-row-edits.test.ts);
  frame 2 puts search on the title line — we keep it in the shell top bar (F brief).

## Owner rulings 2026-10-01 (in this build)
- Phone: only the round + adds; its four ways also in ⋯. Keep the rows' dashed "+" add-to-group.
- Desktop: "keep it similar" — the SAME round + and the SAME add sheet (no header capture bar); dashed "+" on desktop rows.
- The + lives in the HEADER beside ⋯ at both widths — NO floating button (DECISION_LOG "THE BOTTOM BAR IS HOME · GUESTS · SUPPLIERS · HUB · MORE"); `CustomerNavFab` returns null on /guests.
- Phone Show ▾ visible on the counts line; desktop shows several columns.
- Every person is their own row (never merge a pair).
- Add sheet tips (lib/quick-add-tips.ts): one example + one Tips ▾. NOT added: the "one name per line in Quick add list" tip and tips on the Quick add list page — that page is first-name/last-name fields, not parsed lines, so both would be untrue (flagged to controller).

## Checks as of e692506fb+ (2026-10-01)
- Local: full typecheck clean; full unit suite 20,995 pass / 1 fail → the one failure (numbers-carry-commas flagged the name `guestsMenu`) fixed by renaming to `moreMenu`; CI guard scripts all pass; port-controls OK.
- CI (on 9dda59e84): production build ✅, bundle-size ✅ (shared 202.0 KB within the 202 KB cap), Maker 501.6 KB ≤ 505 KB.
- Screenshots (f658cd034 — header +, Playwright over the local harness; earlier ones at 89f4a1f9c): scratchpad `f2/lab-390.png`, `lab-390-add-sheet.png`, `lab-desktop.png`, `lab-desktop-add-sheet.png`. Measured: phone first row 279 px, Show ▾ visible on phone / hidden on desktop, header + beside ⋯ at both widths (0 fixed-position add buttons), 8/8 desktop rows carry the dashed +, no header capture bar, no sideways scroll.

## Left / verify (HANDOFF 2026-10-01 — next account starts here)
- PR #6215 (DRAFT, base rd/guest-card-and-rows-redesign, label do-not-auto-merge, auto-merge NOT armed). Never merge.
- CI on the last push was still running at handoff: read `gh pr checks 6215` — typecheck, unit suite, production build, bundle-size (shared cap 206,848 B; E was at 206,832 — no new dynamic() chunk was added) are the ones to watch. Local full tsc/unit/build were NOT run (heavy lock busy; CI is the gate).
- Local runs done: every CI guard script (all pass after the no-card fix), port-controls OK, and every test under guests/, hosts/, _components/, frontdoor/, (launcher)/ plus lib tests touching the changed files (all pass after the loading.tsx fix).
- 390 px screenshot NOT taken: needs a dev server (`f2` entry added to the primary checkout's .claude/launch.json, port 3481; `.env.local` copied into wt-f2/apps/web) and a signed-in host on a test event. Measure the first guest row is inside 281 px at 390×844.
- Update the PR body from the draft at the end of this session's notes (body in PR is still the part-A version) — see the report below for the flags.
- Full unit suite + every CI guard + bundle check (build) — see PR checks.
- Not on this branch (in flight elsewhere): manual "Finalize the list" (#6198) and "Guests reply?" (G1) — the ⋯ has neither yet.
- Show ▾ moved into ⋯ (phone-column-channel.ts). Meters hidden below lg (one counts line).
- 390 px screenshot: needs a signed-in session on a running build — see report.

## Gotchas
- Bracketed test paths: `npx tsx <file>` (no --test) runs them; `tsx --test` with brackets runs 0.
- eslint: `ESLINT_USE_FLAT_CONFIG=false npx eslint <files>` from apps/web.
- Shared bundle is 16 B under the 206,848 B cap on E: NO new dynamic() chunk, no new route (webpack runtime chunk map grows).
- Who-can-RSVP's only writer is the Maker's draft door (`hubDraftAction` save) — live only after Apply.
