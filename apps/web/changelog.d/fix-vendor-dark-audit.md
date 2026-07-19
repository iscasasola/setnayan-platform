## 2026-07-11 · fix(vendor,chrome): audit fixes — vendor Services/Manpower + repertoire gate + dark-sidebar violet wash, contrast, accent dots

Confirmed-audit-finding sweep across the vendor nav + the shared dark-sidebar chrome. No behavioural surface beyond nav reachability + legibility; no schema, no money, no routes added.

**VENDOR FINDING 1 — desktop "Services" stranded Manpower.** The `VENDOR_SIDEBAR_TREE` Services primary (`vendor-sidebar.tsx`) pointed `href` at `/vendor-dashboard/services`, which redirects to `/shop` — so clicking it landed OUT of section and `<SidebarItem>` never auto-expanded the nested service tools (Manpower had no desktop entry point at all). (a) Re-pointed the parent `href` at the first real in-section child, `/vendor-dashboard/attributes`, so the click lands in-section and the tools expand. (b) Added a `manpower` entry to `SPECIALIST_TOOLS` (`lib/vendor-service-tools.ts`, mirroring the Moodboard shape, `HardHat` icon, crew-heavy service categories) so Manpower also has an in-body desktop card link on My Shop.

**VENDOR FINDING 2 — Repertoire gating dropped on desktop.** `VendorSidebar` destructured `showRepertoire` but never used it, so non-music vendors saw "Repertoire" under Services and dead-ended on the "for music acts" explainer (mobile `/more` correctly gated it). Now the nested `repertoire` child is filtered out of the Services primary when `!showRepertoire`, mirroring `vendor-dashboard/more/page.tsx`.

**VENDOR FINDING 3 — comment cited wrong constant.** `vendor-nav-fab.tsx` said `bookings` lives in `VENDOR_SCOPED_BOTTOM_NAV_KEYS` (that set is only `{'profile'}`); corrected to `VENDOR_SCOPED_NAV_ITEM_KEYS` (the set that actually contains `bookings`). Comment-only.

**DARK-SIDEBAR FINDING 1 — admin violet active-row wash rendered wine.** `.sn-sidebar--violet` (`globals.css`) overrode `--m-sidebar-accent`/`-fg` but not `--m-sidebar-accent-soft`, whose `:root` `color-mix(var(--m-sidebar-accent) …)` bakes to wine at `:root` computed-value time and inherits unchanged. Redeclared `--m-sidebar-accent-soft: color-mix(in srgb, var(--m-sidebar-accent-violet) 28%, transparent)` inside the violet scope so the admin active-row wash reads violet.

**DARK-SIDEBAR FINDING 2 — AccountSwitcher initials contrast.** The avatar-initials span (`account-switcher.tsx`) uses `var(--m-orange-2)` (#A88340), ~3.98:1 on the terracotta-tinted obsidian panel (below WCAG 4.5:1). Added `--m-orange-2: var(--m-orange-3);` (#E0CCA0) scoped to `.sn-sidebar`, lifting the initials to ~8.9:1 on the same backdrop.

**DARK-SIDEBAR FINDING 3 — accent dot only on admin.** `DoorwaySidebarHeader` renders the eyebrow accent dot only when `accentColor` is passed, and only `admin/layout.tsx` passed it. Passed `accentColor="var(--m-sidebar-accent)"` to the couple (`dashboard/[eventId]/layout.tsx`), vendor (`vendor-dashboard/layout.tsx`), and account (`dashboard/(account)/layout.tsx`) headers — each resolves to wine via the sidebar token; admin stays violet, untouched.

SPEC IMPACT: None.
