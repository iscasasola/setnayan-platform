'use client';

import { Home, Info, BookOpen, Camera, Images, Radio, User, Lock } from 'lucide-react';
import type { NavSlot } from '../_lib/site-nav';

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

/** One icon per slot the resolver can emit. Exhaustive over NavSlotKey, so a
 *  new slot in the rules engine is a TYPE ERROR here rather than a blank tab. */
const ICONS: Record<NavSlot['key'], typeof Home> = {
  home: Home,
  details: Info,
  story: BookOpen,
  camera: Camera,
  watch: Radio,
  gallery: Images,
  me: User,
};

/** One slot's chrome. `min-w-0` + nowrap + ellipsis because a label that wraps
 *  grows its slot and tilts the whole bar. */
const SLOT =
  'flex h-full flex-col items-center justify-center gap-1 px-0.5 text-center ' +
  'text-xs font-semibold leading-none tracking-tight ' +
  'whitespace-nowrap overflow-hidden text-ellipsis transition-colors';

export function SiteMenuBar({ slots }: { slots: readonly NavSlot[] }) {
  // The camera is pulled OUT and re-inserted at the centre. That is a LAYOUT
  // decision — the one kind this component may still make. It never decides
  // whether a slot exists, where it points, or whether it is locked; those come
  // resolved. Owner design: the camera sits in the middle because on the day,
  // taking pictures is what people are actually doing.
  const camera = slots.find((s) => s.key === 'camera') ?? null;
  const rest = slots.filter((s) => s.key !== 'camera');
  const mid = Math.ceil(rest.length / 2);
  const before = rest.slice(0, mid);
  const after = rest.slice(mid);

  /** A locked slot is DRAWN and unpressable, never absent: an absent tab says
   *  the wedding has no such thing, a dead link says the app is broken, and a
   *  padlock with its reason says the truth. */
  const renderSlot = (slot: NavSlot) => {
    const Icon = ICONS[slot.key];
    return (
      <li key={slot.key} className="min-w-0 flex-1">
        {slot.state === 'locked' ? (
          <span aria-disabled="true" title={slot.lockedReason} className={`${SLOT} text-ink/35`}>
            <span className="relative inline-flex">
              <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              <Lock
                aria-hidden
                className="absolute -right-1.5 -top-1 h-3 w-3 text-terracotta-700"
                strokeWidth={2.5}
              />
            </span>
            {slot.label}
          </span>
        ) : (
          <a href={slot.href} className={`${SLOT} text-ink/65 hover:text-ink`}>
            <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            {slot.label}
          </a>
        )}
      </li>
    );
  };

  /** The camera keeps its own chrome — the CTA colour and a slightly larger
   *  glyph — because the design makes it the destination. */
  const renderCamera = (slot: NavSlot) => (
    <li key="camera" className="min-w-0 flex-1">
      {slot.state === 'locked' ? (
        <span aria-disabled="true" title={slot.lockedReason} className={`${SLOT} text-ink/35`}>
          <span className="relative inline-flex">
            <Camera aria-hidden className="h-[1.375rem] w-[1.375rem]" strokeWidth={1.75} />
            <Lock
              aria-hidden
              className="absolute -right-1.5 -top-1 h-3 w-3 text-terracotta-700"
              strokeWidth={2.5}
            />
          </span>
          {slot.label}
        </span>
      ) : (
        <a href={slot.href} className={`${SLOT} text-mulberry hover:text-mulberry-600`}>
          <Camera aria-hidden className="h-[1.375rem] w-[1.375rem]" strokeWidth={1.75} />
          {slot.label}
        </a>
      )}
    </li>
  );

  return (
    <>
    {/* The bar reserves its own space (PR11, 2026-08-05).
        Being `fixed`, it is out of flow and covers the last ~3.5rem of the
        document. Whatever ended up at the foot of the page was therefore
        UNTAPPABLE: for a visitor with no invitation that is "Open my
        invitation" — the single control that gets them in — and for a guest it
        is Sign out. This element sits in normal flow at the end of the page, so
        the document simply grows by the height the bar occupies. Putting it
        here rather than on a page wrapper means the space is reserved wherever
        the bar renders and nowhere it does not — the two can never drift. */}
    <div aria-hidden className="h-[calc(3.5rem+env(safe-area-inset-bottom))] print:hidden" />
    <nav
      aria-label="Site sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-cream/95 backdrop-blur"
    >
      <ul className="mx-auto flex h-[3.5rem] max-w-md items-stretch justify-around px-1">
        {before.map(renderSlot)}
        {camera ? renderCamera(camera) : null}
        {after.map(renderSlot)}
      </ul>
      {/* The home-indicator strip — without it the labels sit under the home bar. */}
      <div className="min-h-[0.5rem] bg-cream [height:env(safe-area-inset-bottom)]" />
    </nav>
    </>
  );
}
