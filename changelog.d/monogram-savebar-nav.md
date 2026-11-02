# Changelog fragment — claude/monogram-savebar-nav

## 2026-07-17 · fix(monogram): v2 sticky Save bar clears the mobile bottom nav

The `monogram_studio_v2` sticky save bar pinned to `bottom-0`, which buried it under the dashboard's fixed `CustomerBottomNav` on phones (caught on the owner's iPhone screenshot pre-flip). Now `bottom-20`, matching the shell's `pb-20` mobile nav clearance (`layout.tsx` `data-shell-main`). Flag-off unchanged; the public studio has no save bar or bottom nav.

SPEC IMPACT: None.
