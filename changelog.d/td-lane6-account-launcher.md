## 2026-11-12 · feat(account): the launcher and the account spokes move onto the 701 line (tablet/desktop plan D5)

Lane 6 of the owner-approved tablet/desktop plan (D5 "Account/launcher onto the 701 line", approved 2026-11-13).
The shipped large-screen system (the `tab:` line at 701, the rail's 72-px strip, the 440-px panel) is unchanged;
these pages only move onto it.

- `dashboard/(launcher)/layout.tsx` and `dashboard/(account)/layout.tsx` hand `boundary="tab"` to the shell AND the
  dock (through `<AccountBarSlot boundary="tab">` → `<AccountBottomNav>` → `<BottomDock>`), so from 701 the rail's
  strip replaces the account bar — one line, as the event tree and the supplier dashboard already do. The `<main>`
  clearance follows the dock to `tab:`.
- People's / Memories' thumb row and a group's chat row take their desktop place at `tab:` instead of `lg:`; People's
  701–1023 rule that kept its row on the (now gone) bar is removed.
- Profile & settings: the page's own `md:` sidebar is gone; its six groups are rows of the app rail from 701
  (`_components/settings-rail-context.tsx`, hidden below 701), and the page is one reading column
  (`tab:max-w-3xl`). The rows ask `SettingsShell` to open a group and the shell says which one it shows, so the
  open group is still decided in one place. The phone list / back link / one-group-at-a-time switch moves
  `md:` → `tab:`; below 701 nothing changes.
- Guards follow the line, none loosened: `the-tablet-band-is-the-strip.test.ts` lists the two account layouts among
  the opted-in trees (and checks the slot passes the line to the dock) and holds the two account thumb rows to
  `tab:`; `the-bottom-bar-stays.test.ts` and `the-account-bar-is-the-ruling.test.ts` pin the `tab:` clearance and
  the `boundary="tab"` wiring.

SPEC IMPACT: None — implements an owner-approved plan row; no decision changed.
