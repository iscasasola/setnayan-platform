## 2026-10-27 · feat(guests): the "Settings" segment becomes Guests ⚙ — three clusters, one home (settings per menu B)

Owner, 2026-10-27 (settings per menu, call 1 — "yes"): the Guest list's pill is **List · Map**; its settings open
from the ⚙ at the right end of that row (the shared `MenuSettingsButton`, PR A), as a sheet, in place.

- **Guests ⚙** — `GuestSetupRows` regrouped under three heads: **Getting in** (How guests get in · Invitations ·
  Your one link) · **Replies** (RSVP asks · Reply by · **Requests to join** — new row, opens `/guests/claims`) ·
  **Closing the list** (Finalize / Reopen). Same writers (`hubDraftAction`, `updatePaxSettings`,
  `setGuestListFinalized`); every row still saves in place. The page streams the rows with the list (Suspense) for
  the couple only, reusing its own guest read; `?settings=1&row=<key>` opens the sheet on a row; closing drops those
  words from the address without a navigation.
- **Deleted:** the `seg('share','Settings')` segment; Event Details' rows How guests get in · What to ask · Guests
  reply by · Guest list closes (their `RECORD_ROW_EDITOR` keys).
- **📅 One date, one row (flagged):** Event Details' "Guest list closes" and "Guests reply by" were two names over ONE
  column (`events.guest_list_edit_deadline`) and one writer — and since 2026-09-30 no date closes the list (only
  Finalize does). So the plan's "Guest list closes ›" row is Reply by; "Closing the list" holds Finalize.
- **Redirects:** `/guests?gview=share` · `?view=share` → `/guests?settings=1`; `/details/field/guests-get-in ·
  rsvp-questions · reply-by · list-closes` → `/guests?settings=1&row=get-in · asks · reply-by · reply-by`
  (`MOVED_SETTINGS` in `lib/legacy-redirects.ts`, a 308 in the middleware). The Maker's "send" link opens
  `?settings=1&row=invitations`.
- **Port-control map:** `SETTINGS_ROWS` (`lib/event-settings-record.ts`) — get-in · invitations · one-link · asks ·
  reply-by · requests · finalize → `menu: 'guests'`, cluster, writer. `SETTINGS_ENTRY.guests.live = true`.
- **Guards:** `guests/one-door-to-guests-settings.test.ts` (5, six sabotages red) · `lib/one-home-per-setting.test.ts`
  (3, three sabotages red; prints "guests: 7/7 rows over 3 states") · `lib/moved-settings-forward.test.ts` (4, three
  sabotages red) · `every-menu-has-one-settings-button` now counts guests=1.

SPEC IMPACT: `DECISION_LOG.md` row "GUESTS ⚙ — THE SETTINGS SEGMENT BECOMES THE GEAR" (with the one-date ruling
flagged for the owner); `0001_creating_guest_list/0001_creating_guest_list.md` § Guests ⚙ + `tests.md` redirect
checkboxes; settings-per-menu PLAN build record § B.
