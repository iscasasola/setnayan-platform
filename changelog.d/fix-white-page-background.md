## 2026-07-13 · style(chrome): main page background → plain white

Owner directive 2026-07-13: "the main background color of our pages … we want this to be white. do not place a new layer, find the code and update it." Updated the two real background sources — no overlay/wrapper added:

- `apps/web/app/globals.css` `.sn-ambient` (line ~2901): was a warm `#F2EFE8` base + three colored radial-gradient glows (gold `rgba(203,167,102,.22)` / green `rgba(94,124,82,.12)` / blue `rgba(78,108,130,.13)`) with `background-attachment: fixed`. This class is applied by `SidebarShell` (`app/_components/nav/sidebar-shell.tsx`) on **every** dashboard doorway (vendor / couple / admin), so it IS the visible page canvas there — flattened to solid `#ffffff`.
- `apps/web/app/globals.css` light-mode `:root --color-cream` (line 118): `251 250 247` (#FBFAF7 Atelier paper) → `255 255 255`. This is the `body` page-canvas token (`body { background-color: rgb(var(--color-cream)) }`) that covers marketing / auth / non-shell surfaces, and the `bg-cream` utility. Shift is ~1% so the `bg-cream` ripple on cards/buttons/skeletons is visually negligible; page canvas is now white.

Notes:
- `.sn-glass`/`.sn-card` glass-vibrancy classes are **defined but unused** app-wide, so flattening the ambient backdrop has no glass side effect. Cards on the white canvas keep their border + shadow, so separation is preserved (verified via isolated before/after render).
- Dark-mode `html.dark --color-cream` left untouched (dark mode is dormant/light-locked).
- This deviates from the Atelier-glass reskin's warm-paper direction (owner-locked 2026-07-12); applied as a direct superseding owner directive and logged in `DECISION_LOG.md`.

SPEC IMPACT: DECISION_LOG.md (2026-07-13 row — main page bg white supersedes Atelier warm-paper canvas). Design-token change only; no iteration-spec body edits.
