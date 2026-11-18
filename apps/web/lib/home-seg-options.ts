/**
 * The Home pinned row's picker "Home" group — Home's sections as `seg:<section>` keys, with their numbers. PURE and a
 * plain module (no 'use client', no CSS) so it is tested as it is drawn; `home-pin.tsx` re-exports it.
 * 🔒 lib/home-is-the-profile.test.ts · lib/the-memories-picker-counts-say-something.test.ts
 */
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { HomePinOption } from '@/app/dashboard/(launcher)/_components/home-pin';
import type { HomeSegCounts } from '@/app/dashboard/(launcher)/_components/home-segment-bar';
import { countTrail } from '@/lib/count-trail';
import { formatCount } from '@/lib/format-number';
import { HOME_SEG_LABEL, homeSegHref, type HomeSeg } from '@/lib/home-segments';

export type HomeSegOption = HomePinOption & Pick<PickOption, 'dot' | 'dotNote' | 'trail'>;

/**
 * The picker's "Home" group — the sections, as `seg:<section>` keys. Since the tab row went (owner 17 Nov 2026) the
 * group carries the tabs' numbers: a section's count as the row's trailing mark, and a number that waits on you
 * ("2 asking") as the picker's dot. A number Home did not read is never a 0: a section
 * whose read FAILED says "couldn’t count" (`unread`); a section with no number by design (Memories) shows none.
 */
export function homeSegOptions(segs: readonly HomeSeg[], nums: HomeSegCounts = { counts: {}, hot: {} }): HomeSegOption[] {
  return segs.map((s) => {
    const n = nums.counts[s];
    const word = nums.hot[s];
    const base = { key: `seg:${s}`, label: HOME_SEG_LABEL[s], group: 'Home', href: homeSegHref(s) };
    // A number Home asked for and could not read says so (#7909 follow-up, walk 18 Nov) — never a blank row.
    if (typeof n !== 'number') return nums.unread?.[s] ? { ...base, trail: countTrail(null) } : base;
    return word
      ? { ...base, dot: true, dotNote: `${formatCount(n)} ${word}` }
      : { ...base, trail: { text: formatCount(n), tone: 'muted' as const } };
  });
}

