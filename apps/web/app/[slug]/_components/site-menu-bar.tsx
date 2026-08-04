'use client';

import { Home, Info, BookOpen, Camera, Images, Radio, User, Lock } from 'lucide-react';
import { siteMenuTabs, type SiteMenuSectionsPresent } from '../_lib/site-menu';

/**
 * THE EVENT-SITE BOTTOM BAR — icon + label, one shape for everyone.
 *
 * ── WHAT CHANGED, AND WHY ───────────────────────────────────────────────────
 * This was a row of uppercase mono TEXT anchors. The owner designed a proper
 * bottom navigation across five rounds, then saw it live and said plainly:
 * *"bottom nav is not following the design"* and *"the contents of the menu
 * doesn't look clean and correct as what should have been planned"*. He was
 * right — a Camera had been bolted onto the old text bar instead of the
 * designed bar being built.
 *
 * ── THE DESIGN ──────────────────────────────────────────────────────────────
 *  · **Icon + label, always.** Never icons alone — the labelled grid every
 *    GCash user already knows, and the strongest convention in the PH market.
 *  · **Camera in the MIDDLE.** The widest, easiest place for a thumb, because
 *    on the day taking pictures is what people are actually doing.
 *  · **A slot with nothing behind it is not drawn**, and the others widen. A
 *    tab that leads nowhere teaches people the bar is unreliable.
 *  · **Except the camera, which LOCKS rather than vanishing.** An absent camera
 *    says the wedding has none; a dead button says the app is broken; a locked
 *    one with its reason says the truth (owner 2026-08-03 — the host holds the
 *    switch, and the camera is part of what the invitation promises).
 *  · **Watch gets its OWN slot**, never the gallery's: a guest must not lose the
 *    photos the moment a broadcast begins (owner: *"papic button as well"*).
 *  · **A home-indicator strip**, so labels never sit under an iPhone's home bar.
 *
 * Presentational and props-only — zero DB reads. Mounted only when
 * `siteMenuEnabled` (always on for the sample event).
 */

/** The camera slot — Papic. Not an in-page anchor: it LEAVES for the capture
 *  surface, and it is the only slot that can be present-but-not-pressable. */
export type SiteMenuCamera = { href: string } | { locked: true; reason: string } | null;

/** The live broadcast, when one is running. Its own slot, never the gallery's. */
export type SiteMenuWatch = { href: string } | null;

const ICONS = {
  home: Home,
  details: Info,
  story: BookOpen,
  gallery: Images,
  me: User,
} as const;

/** One slot's chrome. `min-w-0` + nowrap + ellipsis because a label that wraps
 *  grows its slot and tilts the whole bar. */
const SLOT =
  'flex h-full flex-col items-center justify-center gap-1 px-0.5 text-center ' +
  'text-xs font-semibold leading-none tracking-tight ' +
  'whitespace-nowrap overflow-hidden text-ellipsis transition-colors';

export function SiteMenuBar({
  sections,
  camera = null,
  watch = null,
}: {
  sections: SiteMenuSectionsPresent;
  camera?: SiteMenuCamera;
  watch?: SiteMenuWatch;
}) {
  const tabs = siteMenuTabs(sections);
  const mid = Math.ceil(tabs.length / 2);
  const before = tabs.slice(0, mid);
  const after = tabs.slice(mid);

  const anchor = (tab: (typeof tabs)[number]) => {
    const Icon = ICONS[tab.key];
    return (
      <li key={tab.key} className="min-w-0 flex-1">
        <a href={tab.anchor} className={`${SLOT} text-ink/65 hover:text-ink`}>
          <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          {tab.label}
        </a>
      </li>
    );
  };

  return (
    <nav
      aria-label="Site sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-cream/95 backdrop-blur"
    >
      <ul className="mx-auto flex h-[3.5rem] max-w-md items-stretch justify-around px-1">
        {before.map(anchor)}

        {camera ? (
          <li className="min-w-0 flex-1">
            {'href' in camera ? (
              <a href={camera.href} className={`${SLOT} text-mulberry hover:text-mulberry-600`}>
                <Camera aria-hidden className="h-[1.375rem] w-[1.375rem]" strokeWidth={1.75} />
                Camera
              </a>
            ) : (
              <span aria-disabled="true" title={camera.reason} className={`${SLOT} text-ink/35`}>
                <span className="relative inline-flex">
                  <Camera aria-hidden className="h-[1.375rem] w-[1.375rem]" strokeWidth={1.75} />
                  <Lock
                    aria-hidden
                    className="absolute -right-1.5 -top-1 h-3 w-3 text-terracotta-700"
                    strokeWidth={2.5}
                  />
                </span>
                Camera
              </span>
            )}
          </li>
        ) : null}

        {watch ? (
          <li className="min-w-0 flex-1">
            <a href={watch.href} className={`${SLOT} text-ink/65 hover:text-ink`}>
              <Radio aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              Watch
            </a>
          </li>
        ) : null}

        {after.map(anchor)}
      </ul>
      {/* The home-indicator strip — without it the labels sit under the home bar. */}
      <div className="min-h-[0.5rem] bg-cream [height:env(safe-area-inset-bottom)]" />
    </nav>
  );
}
