'use client';

import { siteMenuTabs, type SiteMenuSectionsPresent } from '../_lib/site-menu';

// Open-browse guest-site MENU SHELL (council build plan §3 row 6). A fixed
// bottom menu of in-page anchors — Home · Details · Story · Gallery · Me — with
// the SAME structure for every identity tier. Presentational + props-only (zero
// DB reads); the tab list comes from the pure `siteMenuTabs` builder, which
// drops any middle tab whose section did not render (no dead anchors). Mounted
// only when `siteMenuEnabled` (flag-dark; always on for the sample event), so
// production is unaffected until the owner's PR11 walkthrough flip.
//
// Grown from guest-hub-bar.tsx; the guest QR modal + camera actions stay on
// GuestHubBar (both coexist until PR11 retires the old bars). Anchor ids are
// stamped on the section wrappers by SiteBody (SITE_MENU_ANCHORS).

export function SiteMenuBar({ sections }: { sections: SiteMenuSectionsPresent }) {
  const tabs = siteMenuTabs(sections);

  return (
    <nav
      aria-label="Site sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-cream/95 backdrop-blur [padding-bottom:env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {tabs.map((tab) => (
          <li key={tab.key} className="flex-1">
            <a
              href={tab.anchor}
              className="flex h-14 items-center justify-center px-1 text-center font-mono text-[0.7rem] uppercase tracking-[0.12em] text-ink/70 transition hover:text-terracotta"
            >
              {tab.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
