## 2026-07-16 · feat(nav): desktop-rail identity plaque IS the account menu; wordmark links home; email switcher pill retired (Council Verdict Model B+)

Owner directive ("use the event icon as the popup instead of having 2 there") +
the 2026-07-16 sidebar-identity council verdict, implemented atomically across
all three desktop doorways:

- **`SwitcherPlaqueTrigger`** (new, `account-switcher.tsx`) — ONE dark-glass
  identity plaque that opens the shared switcher panel (`aria-haspopup="dialog"`
  button, whole-surface hit target, trailing chevron affordance, shipped
  `useModalA11y` machinery). Three parameterizations, never forks: couple event
  plaque (monogram chip + name + `{type} · {date}`), vendor business plaque
  (`<VendorAvatar>` chip + Verified line), NEW admin HQ plaque (shield +
  "Setnayan HQ" + admin name — the admin rail previously had no identity
  element). On the collapsed 64px rail it swaps to the previously-unused
  `AccountSwitcherIconTrigger` (same open state + panel).
- **`AccountSwitcherStandalone` email pill DELETED** — it and the couple
  plaque were two adjacent go-home controls; the export's only importer was
  `DoorwaySidebarHeader`.
- **`DoorwaySidebarHeader` v2** — the SETNAYAN wordmark is now a
  `<Link href="/dashboard">` (logo-goes-home; the rail's 1-click home, matching
  the launcher top bar) and the header takes a REQUIRED `identity` trigger slot
  so no rail can ship without the account-menu doorway. Collapsed rail renders
  an icon-only LogoMark home link.
- **`SidebarShell`** — stops blanket-hiding the `sidebarHeader` slot at
  `[data-sidebar-collapsed='1']` (that hid home + all five account actions
  behind a persisted collapse); the header's own data-attr variants take over.
- **Switcher panel (`SwitcherPanelBody`)** — gains an identity header row
  ("Signed in as {name} · {email}" — the deleted pill was the couple rail's
  only signed-in-account disclosure); Home / Shop / HQ convert from
  `router.push` buttons to real `<Link>`s; Home label is "Home · all your
  events" on couple surfaces (`homeLabel` prop). Mobile bottom-sheet + launcher
  avatar menu inherit these body changes but keep their triggers unchanged.
- **Couple rail** — the in-body event plaque `<Link>` (and its now-false
  "switch events" aria) moved out of `customer-sidebar.tsx` into the header
  slot as the trigger; it renders UNCONDITIONALLY (unnamed drafts fall back to
  "Your {Type}") because it is the couple desktop's only path to
  sign-out/profile/Setnayan AI. `eventInitials` moved to the neutral
  `lib/event-initials.ts` (RSC client-proxy gotcha).
- **Vendor rail** — the static `VendorIdentityCard` div deleted; identity is
  the plaque trigger in the header. Vendor + admin top-bar Sign out buttons
  unchanged (1-click sign-out preserved).

Reachability audit (council table): Home = 1 click (wordmark) on every rail
state; Settings/Profile/Setnayan AI/Sign out ≤ 2 clicks on every doorway,
breakpoint, and rail state — nothing worse than before on any surface.

SPEC IMPACT: `Sidebar_Identity_Council_Verdict_2026-07-16.md` (the build spec,
already in the corpus) + `Sidebar_Switcher_Retirement_2026-07-15.md`
(superseded, banner applied) + DECISION_LOG.md rows 2026-07-15/16.
