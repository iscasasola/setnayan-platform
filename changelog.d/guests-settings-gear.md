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

### ⚙ rides each pinned row · Suppliers gets its ⚙ (same PR)

Owner, 2026-10-27 — "EVERY MENU'S ⚙ RIDES ITS PINNED ROW TOO" (*"where is the settings for each?…"*), "THE PINNED ROW
IS THE APP-WIDE TEMPLATE", and "SUPPLIERS GETS ITS ⚙ — THE SUPPLIER SETTINGS MOVE THERE" (*"and move them to
suppliers"* — reverses call 3, which kept Suppliers `reserved`).

- **Guests** — ONE mounted ⚙ that both faces of the one header show: it ends the first row (`data-first-row`) and is
  never faded; pinned, the summary face stops 52 px short of it (`.stick.pinned[data-has-gear] .face`). So the
  "exactly one mount per live menu" guard still counts one.
- **Home** — the pinned line is `<names> · <date> · ⚙`; the ⚙ (`ActionButton tone="neutral" iconOnly`, named
  "Event Details") opens Event Details and is `invisible` until the band sticks — at rest the Countdown is still the
  one door (`one-door-to-event-details.test.ts` amended to allow exactly this one, hidden at rest).
- **Suppliers ⚙** — `SETTINGS_ENTRY.suppliers` → `first-row-gear`, live; ONE `MenuSettingsButton menu="suppliers"` ends
  the Find · Build · Booked row (which is the pinned row). Its sheet (`suppliers-settings-rows.tsx`, reads
  `lib/suppliers-settings.server.ts`): **Costs** — How you see costs, one `PickMenu` (Realtime · Final only),
  `updatePaxSettings` with the stored reply-by riding along · **Payments** — the next supplier payments (read) ·
  Budget › (`?part=budget`) · **Photos** — each booked supplier's "Their photos in your Memories" switch, saved in
  place by the new `setVendorCapturesHiddenHere` (same scoped RLS update as `setVendorCapturesHidden`; a zero-row
  update is a refusal). **Removed from Event Details:** the How you see costs row, the Supplier payments rows (and
  the upcoming-items read that only fed them), the photos switch in Event access (`SupplierPhotosSwitch`).
  `/details/field/costs-view` → `/vendors?settings=1&row=costs-view`. Purchases and Access people stay.
- **Guards:** `lib/the-pinned-row-is-one-row.test.ts` — every pinned face ENDS with its ⚙ (Guests, Home, Suppliers);
  7 sabotages red. `every-menu-has-one-settings-button` — Suppliers held live, mounted once in services-takeover
  (owner reversed call 3). `one-home-per-setting` — suppliers 4/4 rows over 3 states. `moved-settings-forward` —
  + costs-view. Guards the Guests move had left red (Setup segment / rows) re-aimed at the shipped shape.

SPEC IMPACT: `DECISION_LOG.md` row "GUESTS ⚙ — THE SETTINGS SEGMENT BECOMES THE GEAR" (with the one-date ruling
flagged for the owner); `0001_creating_guest_list/0001_creating_guest_list.md` § Guests ⚙ + `tests.md` redirect
checkboxes; settings-per-menu PLAN build record § B + the ⚙-pinned / Suppliers ⚙ build note.
