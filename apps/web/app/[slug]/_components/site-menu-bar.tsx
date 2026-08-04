'use client';

import {
  Home,
  Info,
  BookOpen,
  Camera,
  Images,
  Radio,
  User,
  Lock as LockIcon,
} from 'lucide-react';
import type { NavSlot } from '../_lib/site-nav';

/**
 * THE EVENT-SITE BOTTOM BAR.
 *
 * Purely presentational: it renders what `resolveSiteNav` decided and settles
 * nothing itself — not the phase, not a permission, not a destination. That
 * separation is the point. Every rule in this bar is an owner ruling, and when
 * the rules lived half here and half in the resolver they disagreed twice in
 * two days: a camera that vanished instead of locking, and tabs that hid
 * themselves after the page beneath them started rendering. A component that
 * cannot decide cannot quietly contradict a decision.
 *
 * ── THE DESIGN ──────────────────────────────────────────────────────────────
 *  · **Icon + label, always** — never icons alone. The labelled grid every
 *    GCash user already knows, and the strongest convention in the PH market.
 *  · **Camera reads as the action**, in the CTA colour, and the resolver puts
 *    it in the middle — the widest, easiest place for a thumb, because on the
 *    day taking pictures is what people are actually doing.
 *  · **A locked slot is DRAWN, wearing a padlock, carrying its reason.** Never
 *    a link (a link would navigate), never hidden (an absent slot says the
 *    feature does not exist rather than "not yet").
 *  · **Labels can never wrap** — a wrapped label grows its slot and tilts the
 *    whole bar.
 *  · **A home-indicator strip**, so labels never sit under an iPhone's home bar.
 *
 * Mounted only when `siteMenuEnabled` — today, the sample event.
 */

const ICONS = {
  home: Home,
  details: Info,
  story: BookOpen,
  camera: Camera,
  watch: Radio,
  gallery: Images,
  me: User,
} as const;

/** One slot's chrome. `min-w-0` + nowrap + ellipsis keep a long label from
 *  growing its slot and tilting the bar. */
const SLOT =
  'flex h-full flex-col items-center justify-center gap-1 px-0.5 text-center ' +
  'text-xs font-semibold leading-none tracking-tight ' +
  'whitespace-nowrap overflow-hidden text-ellipsis transition-colors';

export function SiteMenuBar({ slots }: { slots: NavSlot[] }) {
  return (
    <nav
      aria-label="Site sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-cream/95 backdrop-blur"
    >
      <ul className="mx-auto flex h-[3.5rem] max-w-md items-stretch justify-around px-1">
        {slots.map((slot) => {
          const Icon = ICONS[slot.key];
          const prominent = slot.key === 'camera';
          const size = prominent ? 'h-[1.375rem] w-[1.375rem]' : 'h-5 w-5';
          return (
            <li key={slot.key} className="min-w-0 flex-1">
              {slot.state === 'live' ? (
                <a
                  href={slot.href}
                  className={`${SLOT} ${
                    prominent ? 'text-mulberry hover:text-mulberry-600' : 'text-ink/65 hover:text-ink'
                  }`}
                >
                  <Icon aria-hidden className={size} strokeWidth={1.75} />
                  {slot.label}
                </a>
              ) : (
                <span
                  aria-disabled="true"
                  title={slot.lockedReason}
                  className={`${SLOT} text-ink/35`}
                >
                  <span className="relative inline-flex">
                    <Icon aria-hidden className={size} strokeWidth={1.75} />
                    <LockIcon
                      aria-hidden
                      className="absolute -right-1.5 -top-1 h-3 w-3 text-terracotta-700"
                      strokeWidth={2.5}
                    />
                  </span>
                  {slot.label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {/* Without this the labels sit under an iPhone's home bar. */}
      <div className="min-h-[0.5rem] bg-cream [height:env(safe-area-inset-bottom)]" />
    </nav>
  );
}
