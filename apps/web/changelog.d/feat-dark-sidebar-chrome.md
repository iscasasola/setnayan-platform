## 2026-07-10 · feat(chrome): dark sidebar panel across all doorways (match the energy prototypes)

The DESKTOP left sidebar is now a permanently-dark obsidian panel across all
three doorways (couple · vendor · admin) plus the shared account surface —
matching the `setnayan-{overview,vendor,admin}-energy.html` "Energy, not skin"
prototypes. Mobile bottom navs and the content area / topbar are untouched (the
dark treatment is the side panel only).

**One token set, one place.** `globals.css` gains a dedicated `--m-sidebar-*`
scale (`-bg` obsidian · `-bg-2` elevated tiles · `-fg`/`-fg-soft`/`-fg-muted`
light text tiers · `-line` · `-hover`) that is DARK at `:root` (the app is
light-locked, so one definition keeps the panel dark regardless of theme). The
active accent is a per-doorway pair — `--m-sidebar-accent` (wine `#B23E67`) +
`-fg` (`#F2B9CC`) + `-soft` wash — with `--m-sidebar-accent-violet*` (`#A78BFA`)
for admin. Values reuse the wine/violet doorway family, brightened for legibility
ON dark (the light `--m-nav-active` / `--a-violet` are too dark against obsidian).

**Shared primitives consume the tokens; one scope catches the rest.** The shared
`sidebar-item.tsx` + `sidebar-section.tsx` (and the admin-local
`admin-sidebar-menu.tsx` that mirrors them) now render off `--m-sidebar-*`
directly — verified these primitives render ONLY inside the desktop sidebars
(account · customer · vendor sidebars; admin uses the mirror), never in the
mobile bottom navs. A `.sn-sidebar` scope class on `<aside>` (sidebar-shell.tsx)
paints the panel AND remaps the base `--m-*` tokens the ONE shared descendant we
don't restyle by hand — the AccountSwitcher trigger row — reads from; its panel
portals to `<body>` (outside the scope) so it stays light.

**Per-doorway accent wired through.** `SidebarShell` takes an `accent`
('wine' | 'violet') prop → `.sn-sidebar--violet` for admin; couple + vendor stay
wine (vendor keeps its `--v-blue` as the SECONDARY accent on the identity-card
rail only, never the active state). `DoorwaySidebarHeader` renders the white
wordmark with the doorway-accent "YAN" span (full SETNAYAN spelling preserved,
gold mark glyph reads on obsidian) + a muted eyebrow. The vendor identity card +
footer and the "Verified" line were lifted to the sidebar tokens (the old
`--m-sage-deep` green was too dark on the panel); the `'orange'` count badge
composites a lighter gold on a stronger wash so counts stay legible on obsidian.

Behavior preserved end-to-end: expand/collapse, active-match, badges,
localStorage section state, role filtering, focus rings (now the accent, visible
on dark). Verified: `tsc` clean · `next lint` (0 new errors) · 1343 lib tests
pass · radius / nav-icon / bottom-nav / legibility guards pass · `next build`
exit 0.

SPEC IMPACT: None — pure chrome reskin of the desktop sidebar (no schema, route,
dep, flag, or billing change). Matches the 2026-07-09 "Energy, not skin"
prototypes / dashboard-design-direction memo; logged as chrome, no locked-decision
change.
