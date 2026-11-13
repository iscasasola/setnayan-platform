'use client';

import Link from 'next/link';
import { NOTICE_ACTION } from '@/app/_components/notices/notice-action';
import { InlineNotice } from '@/app/_components/notices/inline-notice';
import { PaidMark } from '@/app/_components/paid-mark';
import { formatPhp } from '@/lib/php';
import { hubPart, type HubPartId } from '@/lib/hub-parts';
import { useMaker } from './maker-context';

/**
 * 💎 THE QUIET LINE — "₱X more unlocks everything" (owner 2026-10-22; prototype `pro_part_by_part_2026-10-22.html`
 * frame 3). One 12.5 px line at the top of any Maker sheet that holds ◆ rows. It is a PRESS — it opens the parts page —
 * so it carries a chevron and nothing else (frames only on what you press). Three states, from the event's paid total:
 *
 *   · nothing paid       → "◆ Pro parts from ₱500 · everything ₱5,000 ›"
 *   · something paid     → "◆ ₱1,500 more unlocks everything · you've paid ₱3,500 ›" (the diamond turns gold)
 *   · this sheet's part owned → "◆ Style is yours · ₱4,000 more unlocks everything ›"
 *
 * At everything the line is gone — there is nothing left to say — and the store shell never draws it (no web price
 * there): the launch page hands no `proLine` in either case. Every figure is a catalogue read.
 */
export function ProQuietLine({ part }: { part?: HubPartId }) {
  const line = useMaker()?.proLine ?? null;
  if (!line) return null;
  const rest = Math.max(0, line.fullPhp - line.paidPhp);
  if (rest === 0) return null;
  const owned = line.owned.length > 0 || line.paidPhp > 0;
  const mine = part && line.owned.includes(part);
  // 🔔 Inventory #27 — Event Hub Pro: ONE offer line, used in three places (one notice system, owner approved 14 Nov
  // 2026: #26–28 "Merge"). ◆, the prices from the live catalog, "Not now" (back after 30 days), drawn where it stands (InlineNotice), inside what it explains.
  const title = mine
    ? `${hubPart(part!).name} is yours · ${formatPhp(rest)} more unlocks everything`
    : line.paidPhp > 0
      ? `${formatPhp(rest)} more unlocks everything · you’ve paid ${formatPhp(line.paidPhp)}`
      : `Pro parts from ${formatPhp(line.fromPhp)} · everything ${formatPhp(line.fullPhp)}`;
  return (
    <InlineNotice
      kind="offer"
      noticeKey={`hub-pro:${part ?? 'sheet'}`}
      mark={<PaidMark state={owned ? 'unlocked' : 'try'} bare label="Event Hub Pro" size="xs" />}
      title={title}
      actions={
        <Link href={line.href} className={NOTICE_ACTION} data-pro-quiet-line={mine ? 'yours' : line.paidPhp > 0 ? 'paid' : 'free'}>
          Event Hub Pro
        </Link>
      }
    />
  );
}
