## 2026-07-04 · feat(admin): HQ mobile nav renders the same 6 menus as desktop (single source of truth)

- Owner directive: same menu content on desktop and mobile, different orientation only. Admin mobile landings (/admin/more, /admin/directory) now DERIVE their groups + items from ADMIN_NAV_GROUPS (the desktop sidebar array) instead of hand-mirrored hardcoded lists — the drift that let mobile show the old "Content / System Settings / Marketing" structure is gone. Mobile full menu (/admin/more) = the desktop 6 menus (Overview · Accounts · Studio · Ugat Console · App Performance · Money) verbatim, 66 items. Per-item descriptions moved into a shared ADMIN_NAV_DESCRIPTIONS map keyed by item.key. /admin/work stays the bespoke queue-triage feed (counts/badges, not a menu mirror).
- Bottom-nav ≤5-tab strip realigned to the new IA (retired the Marketing tab); the complete 6-group menu is always reachable in More.
- Stacks on the desktop 6-menu re-cut (PR #2778).

SPEC IMPACT: None.
