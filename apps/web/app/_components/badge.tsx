import type { ReactNode } from 'react';

/**
 * badge.tsx — kind 11's THIRD member (`INTERACTION_RULES.md` § 9 "Ticks, chips, badges"; approved gallery
 * `prototypes/control_templates_2026-10-08.html` § 11). `chips.tsx` beside it holds the PRESSABLE chips; this file
 * holds the one look for a state that is only SHOWN. Its own file because it is the opposite of a chip in every way
 * the chips' watch holds (`lib/the-chips.test.ts`: a chip is 40 px, never 12-px words, always a toggle) — and
 * because it has nothing to run in the browser: a server component, it adds no client weight to a page that shows
 * a "Live" or a "2 of 3".
 */

/**
 * BADGE — a STATE, shown, never pressed (kind 11's third member; approved gallery § 11 `.badge`: "A badge only
 * shows a state; it is not pressed").
 *
 * Owner, 2026-10-12 ("APPROVE ALL", look call 7): *status chips ("Booked", "Needed") have NO border — soft fill
 * only.* So: 24 px tall, a full pill, 12-px bold words on a soft wash of the state's own colour — no border, no
 * shadow, no icon that comes and goes. A state keeps its own colour and ALWAYS its word (the colour is never the only
 * sign): `ok` (Coming · Booked · Live) · `wait` (No reply yet · 2 of 3) · `no` (Can't come) · `quiet` (Draft).
 *
 * The four colours are the house MEANING tokens (`--color-ok` · `--color-warn` · `--color-danger` · the ink), read
 * through `style` so they flip with the theme — never the accent (a badge is not "on"), never a hex. Not a toggle:
 * no `aria-pressed`, no handler — the chips in `chips.tsx` are the pressable kind.
 */
export type BadgeTone = 'ok' | 'wait' | 'no' | 'quiet';

/** The shape — the same for every tone. `sn-m-status` (globals.css): 🎞 STATUS CHANGE, the motion standard § 4 #22
 *  (owner 18 Nov 2026) — when a row's state changes in place, the chip's colour cross-fades in Quick on Settle (the
 *  colour never overshoots). CSS only: the badge still runs nothing in the browser. Reduced motion: at once. */
export const BADGE_CLASS =
  'sn-m-status inline-flex h-6 flex-none items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-bold leading-none';

const BADGE_TOKEN: Readonly<Record<BadgeTone, string>> = {
  ok: '--color-ok',
  wait: '--color-warn',
  no: '--color-danger',
  quiet: '--color-ink',
};

/** The soft wash and the words for one tone — the state's own colour, on 12 % of itself (the quiet one on 7 %). */
export function badgeStyle(tone: BadgeTone): { color: string; background: string } {
  const token = BADGE_TOKEN[tone];
  return {
    color: tone === 'quiet' ? `color-mix(in srgb, rgb(var(${token})) 62%, transparent)` : `rgb(var(${token}))`,
    background: `color-mix(in srgb, rgb(var(${token})) ${tone === 'quiet' ? 7 : 12}%, transparent)`,
  };
}

export function Badge({ tone, children, data }: { tone: BadgeTone; children: ReactNode; data?: string }) {
  return (
    <span data-badge={tone} data-badge-for={data} className={BADGE_CLASS} style={badgeStyle(tone)}>
      {children}
    </span>
  );
}
