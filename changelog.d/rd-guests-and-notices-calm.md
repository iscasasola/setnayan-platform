## 2026-10-04 · fix(guests): calm guest card and notices — one label style, menus stay on screen, one Sort, message full width

From the owner's live iPhone review of maria-and-jose. Every change extends what
already ships; nothing is redrawn.

- **Notifications** (`app/_components/notifications/notifications-list.tsx`): the
  topic pill sits on its own line above the message, which now has the full
  width (it was a `shrink-0` flex sibling and squeezed the message to one word
  per line); the time and Open / Mark read share the line under it. The removal
  answer's topic reads "About removing an event" (tray label and email reason —
  this notice's words only, no repo-wide sweep). A person's words are shown
  through `lib/brand-words.ts`, so a typed "papic" reads "Papic" (whole words
  only; links are left alone). The thumb bar already clears the last notice
  (account layout `pb-28` + page `py-10`, measured in the lab), so no change there.
- **Guests head** — the "plain black circle" is the round + (`OpenAddGuestButton`).
  It always rendered; the open sheet's 4px backdrop blur dissolved its white +
  into the black. The guest sheets' blur is the Drawer's 1px now.
- **Guest list ⋯ sheet** (`guests-phone-menu.tsx`) and **Add a guest sheet**
  (`add-guest-sheet.tsx`) are drawn on `<body>`: the page `<main>` carries
  `view-transition-name` (`.sn-vt-page`), a stacking context, so their `z-50`
  could never rise above the bottom bar's `z-30`. "Sort" is said once (the row
  label is gone; the dropdown names itself).
- **One segmented control** (`roster-tabs.tsx`, `view-switcher.tsx`): the
  doors are one shipped `.sn-seg` — List · Mind map · Share the link — instead of
  underline tabs beside a pill. List · Mind map stand where Roster stood;
  `lib/roster-doors.ts` is unchanged, so every door reaches where it did.
- **Guest card** (`guest-card-body.tsx`, `guest-ticket-parts.tsx`): every section
  label is the eyebrow's `.sn-eye` (field labels stay field labels). "What they
  see on Me." → "What they see on their phone." — "Me" is the guest's own Event
  Hub tab, a name the host does not know.
- **Menus stay in the card** (`lib/menu-place.ts` `placeMenuIn` + `menuRoomOf`,
  `data-menus-open-below` on the card's ticket row): the host's ⋯ and the Invite
  list open BELOW the ticket row, clamped between the card's edges — they no
  longer spill past the card or cover the ticket, "Tap to view" or the status
  line. Guest-list rows have no box and keep the screen rule. Every ⋯ item has
  an icon (New QR · Unlink account · Delete guest gained one).
- `/dev/guests-lab` (dev-only, 404 in production): the head, the sheet, both
  cards and the notices on fixtures, inside the real layouts' wrappers.

Guards: `the-message-gets-the-whole-width.test.ts`,
`the-guest-list-sheet-is-calm.test.ts`, `the-card-reads-in-one-voice.test.ts`,
`lib/brand-words.test.ts`; `the-row-menu-opens-on-screen`, `a-popover-is-seen`
and `the-live-iphone-test-renders` follow the new shape.

SPEC IMPACT: None — applies existing owner rules (event not celebration, one
segmented control, one label voice, menus on screen); no decision changed.
