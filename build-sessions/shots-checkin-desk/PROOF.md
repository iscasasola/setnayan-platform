# #7908 · Check-in desk in three parts — BUILD_RULES §4 proof (22 Nov 2026)

## 1 · Screenshots (this folder)

All shots come from the dev labs on **fixture data** (`/dev/checkin-desk-lab`, `/dev/supplier-set-two-day-lab`).
None come from real data: a cloud builder has no signed-in prod session and never touches production.

| Frame | 375 light | 375 dark | Desktop 1280 |
|---|---|---|---|
| Host · Guests | `375-light-1-host-guests` | `375-dark-1-…` | `1280-1-host-guests` (two columns, a guest picked) |
| Host · Suppliers | `375-light-2-host-suppliers` | `375-dark-2-…` | `1280-2-host-suppliers` |
| Host · Team | `375-light-3-host-team` | `375-dark-3-…` | `1280-3-host-team` |
| ⚙ Who runs the desk | `375-light-4-who-runs-the-desk` | `375-dark-4-…` | `1280-4-who-runs-the-desk` |
| As coordinator | `375-light-5-as-coordinator` | `375-dark-5-…` | — |
| As helper (Guests only, no ⚙) | `375-light-6-as-helper` | `375-dark-6-…` | — |
| As the supplier at the door | `375-light-7-as-door-supplier` | `375-dark-7-…` | — |
| Supplier Event Hub › Scanner row | `375-light-8-supplier-hub-door-row` | `375-dark-8-…` | `1280-8-supplier-hub-door-row` |

⚠ **Dark is a PREVIEW.** `/dashboard/*/guests/checkin` is not on `DARK_READY` (lib/appearance.ts), and neither is
`/vendor-dashboard/on-the-day/live/*`. Production paints both pages light for everyone, by the house rule that nobody
meets a half-dark screen. The dark shots force `.dark` on the page to show the tokens hold. Adding these routes to
the ready-list is its own rollout step and is not in this PR.

## 2 · Drawing parity (`event_pages_guests_doors_2026-11-16_fable.html` § Check-in desk)

Matches: one dropdown "Desk · Guests ▾" with the parts named beside it · Guests as shipped · Suppliers board (On site
vs their arrive time → On time · Late · Not yet; "No times yet") · Team (who is on the desk now) · ⚙ Who runs the
desk (Hosts always · Coordinator · Helpers · A supplier at the door, Off by default) · two columns from 1280
(headcount, Scan, name search left; the arriving guest and recent arrivals right).

Differences, listed:
- The drawing's back link reads "‹ Guests". The page keeps the shipped "Back to guest list". The relabel belongs to the
  batch-2 look pass for every Guests page, not to this desk.
- The Team part reads "Scanning · Souvenirs · Away Nm" off each person's last scan or souvenir hand-out (a 5-minute
  window). There is no live presence signal, so somebody standing at the desk who has not scanned yet does not show.

## 3 · Every way in, per role

| Role | Way in | Gate |
|---|---|---|
| Host | Guests page link · Clearance "Close check-in" · Guests journey Day-of · `?gview=checkin` · after the day "Who came" | couple member → every part + ⚙ |
| Coordinator (planner seat) | event layout's coordinating line · supplier Hub "Check-in desk" rows (On the day + Event Hub › Scanner) | parts the hosts gave (default all three) |
| Helper | Guests page link (their seat opens the event) | parts the hosts gave (default Guests) |
| Supplier at the door | **new:** Event Hub › Scanner "Check-in desk · The hosts gave you …" | only when picked in ⚙; Off by default |
| Anyone else / a part turned Off | — | "Not shared with you" page; actions refuse with "The hosts haven't given you this part of the desk." |
| Unread choice | — | page opens the shipped Guests desk with its notice; actions answer "try again" (the offline queue retries) |

Known limit: a coordinator, helper or door supplier still needs the guest list shared with them to open the desk at all
(the shipped `isDelegateWithoutArea(guest_list)` gate). This is unchanged from before this PR.

## 4 · Guards (run from `apps/web`)

See the PR STATUS comment for the full `pnpm preflight` table on the hand-off head.

## 5 · Overlap with other open PRs

- #7868 (event addresses): also edits `scripts/lint-events-column-grants.mjs` NO_GRANT_NEEDED,
  `lib/ugat/baselines/no-door.baseline.txt` and `lib/request-key.test.ts`. Whichever merges second keeps both entries.
- #8094 · #8088 · #8057 · #8046 · #7968: also touch `lib/ugat/baselines/no-door.baseline.txt` (one line each, sorted).

## 6 · BUILD_RULES §2 rules not followed

- "Screenshots from real data": fixture data only (see 1).
- "Dark is part of done": dark shown as a preview only; the routes are not on the ready-list (see 1).
