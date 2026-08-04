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

/**
 * The camera slot — Papic. Not an in-page anchor like the others: it LEAVES for
 * the capture surface, so it is a link, and it is the only slot that can be
 * present-but-not-pressable.
 *
 * Owner rulings it carries (2026-08-03):
 *   · the couple always have theirs — no switch removes it
 *   · everyone else is gated by the HOST'S SWITCH, and when that is closed the
 *     slot is still DRAWN, locked, with the reason. Never silently absent,
 *     never a dead button — the camera is part of what the invitation promises.
 */
export type SiteMenuCamera =
  | { href: string }
  | { locked: true; reason: string }
  | null;

export function SiteMenuBar({
  sections,
  camera = null,
}: {
  sections: SiteMenuSectionsPresent;
  camera?: SiteMenuCamera;
}) {
  const tabs = siteMenuTabs(sections);
  // Papic sits in the MIDDLE — the widest, easiest place for a thumb, because
  // on the day taking pictures is what people are actually doing.
  const mid = Math.ceil(tabs.length / 2);
  const before = tabs.slice(0, mid);
  const after = tabs.slice(mid);

  return (
    <nav
      aria-label="Site sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-cream/95 backdrop-blur [padding-bottom:env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {before.map((tab) => (
          <li key={tab.key} className="flex-1">
            <a
              href={tab.anchor}
              className="flex h-14 items-center justify-center px-1 text-center font-mono text-[0.7rem] uppercase tracking-[0.12em] text-ink/70 transition hover:text-gild"
            >
              {tab.label}
            </a>
          </li>
        ))}
        {camera ? (
          <li className="flex-1">
            {'href' in camera ? (
              <a
                href={camera.href}
                className="flex h-14 items-center justify-center px-1 text-center font-mono text-[0.7rem] uppercase tracking-[0.12em] text-gild transition hover:text-ink"
              >
                Camera
              </a>
            ) : (
              // LOCKED — drawn and honest, never pressable. A dead button that
              // silently does nothing teaches people the bar is unreliable; an
              // absent one tells them the wedding has no camera at all.
              <span
                aria-disabled="true"
                title={camera.reason}
                className="flex h-14 items-center justify-center px-1 text-center font-mono text-[0.7rem] uppercase tracking-[0.12em] text-ink/35"
              >
                Camera
              </span>
            )}
          </li>
        ) : null}
        {after.map((tab) => (
          <li key={tab.key} className="flex-1">
            <a
              href={tab.anchor}
              className="flex h-14 items-center justify-center px-1 text-center font-mono text-[0.7rem] uppercase tracking-[0.12em] text-ink/70 transition hover:text-gild"
            >
              {tab.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
