## 2026-07-11 · feat(vendors): couple-side relationship workspace shell — tabbed, chat-first (flag-gated)

First surface of the unified Relationship Workspace (owner: "full redesign now"). Behind
`NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_ENABLED` (default OFF), the couple's per-vendor
workspace renders as one chat-first TABBED page (Chat · Quote · Payments · Files ·
Schedule · Call · Details) instead of the long-scroll layout. Flag OFF = the current
page, byte-for-byte unchanged (adversarially verified).

- New shared primitive `app/_components/relationship-tab-shell.tsx` (`RelationshipTabShell`)
  — responsive (mobile tab-strip + desktop context rail), one-panel-mounted, URL-synced
  (`?tab=`), keyboard-navigable tabs. Reused by both sides.
- New flag `lib/relationship-workspace-flag.ts`.
- The couple workspace page extracts every existing section's JSX verbatim into consts,
  then branches: flag OFF renders them in the original order/wrappers; flag ON re-groups
  them into the shell. The **Chat tab embeds the live thread** (ChatMessageStream +
  gated composer + ChatThreadMenu, mirroring the messages thread page, RLS-scoped) with a
  link-block fallback for off-platform/no-thread; the **Call tab** reuses ThreadCallLauncher
  with a no-thread empty state; Payments/Quote/Files/Schedule/Details reuse the existing
  cards untouched.
- Adversarially verified (5 dimensions): flag-off byte-identity ✓, RSC client/server
  boundary ✓, chat-embed auth/RLS ✓, content coverage (every section once, no dup/drop) ✓,
  build hygiene ✓. Fixed the two findings (Call blank-panel empty state + Chat unblock
  menu).

SPEC IMPACT: Implements the couple side of Relationship_Workspace_and_Appointments_
2026-07-11.md (the unified chat-first tabbed workspace). Gated by
`NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_ENABLED` (OFF in prod). Vendor-side mirror +
3-pane/realtime polish are follow-ups. Logged in DECISION_LOG.md 2026-07-11.
