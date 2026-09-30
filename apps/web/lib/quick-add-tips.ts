/**
 * quick-add-tips.ts — the add sheet's one example line and its Tips ▾.
 *
 * ⚖ Owner 2026-10-01 (via the controller): *"And tips on adding names with the +
 * or other grouping or information they can do for quick add"*. The grammar
 * already ships — `lib/guest-parse.ts` — so these words only say what it reads,
 * and only what THIS event can use: a side word only where the event has sides,
 * a role word only where the event's role set offers that role (the parser
 * quietly falls back to "Guest" otherwise, and a tip must not promise it).
 *
 * Pure, so `quick-add-tips.test.ts` runs every line through the real parser.
 */

import type { GuestRole } from './guests';

export type QuickAddTips = {
  /** One short line under "Type a name…". */
  example: string;
  /** The Tips ▾ fold, one line each. */
  tips: string[];
};

export function quickAddTips({
  hasSides,
  offeredRoles,
}: {
  hasSides: boolean;
  offeredRoles: readonly GuestRole[];
}): QuickAddTips {
  const vip = offeredRoles.includes('vip' as GuestRole);
  const ninong = offeredRoles.includes('principal_sponsor_ninong' as GuestRole);
  const ninang = offeredRoles.includes('principal_sponsor_ninang' as GuestRole);

  const example = ['e.g. Ana Cruz +1', hasSides ? 'groom' : null, ninang ? 'ninang' : null, '#Barkada']
    .filter(Boolean)
    .join(' ');

  const roleWords = [vip ? 'vip' : null, ninong ? 'ninong' : null, ninang ? 'ninang' : null].filter(Boolean);
  const tips = [
    '+1 / +2 adds their guests',
    '#Name puts them in a group (use several)',
    ...(hasSides ? ['bride / groom / both sets the side'] : []),
    ...(roleWords.length ? [`${roleWords.join(' / ')} sets the role`] : []),
  ];
  return { example, tips };
}
