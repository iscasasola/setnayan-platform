'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
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
  return (
    <Link
      href={line.href}
      data-pro-quiet-line={mine ? 'yours' : line.paidPhp > 0 ? 'paid' : 'free'}
      className="flex min-h-11 items-center gap-2 border-b border-ink/10 text-[12.5px] text-ink/60 hover:text-ink"
    >
      <PaidMark state={owned ? 'unlocked' : 'try'} bare label="Event Hub Pro" size="xs" />
      <span className="min-w-0 flex-1 truncate">
        {mine ? (
          <>
            {hubPart(part!).name} is yours · <strong className="font-semibold text-ink">{formatPhp(rest)}</strong> more unlocks everything
          </>
        ) : line.paidPhp > 0 ? (
          <>
            <strong className="font-semibold text-ink">{formatPhp(rest)}</strong> more unlocks everything · you&rsquo;ve paid{' '}
            <strong className="font-semibold text-ink">{formatPhp(line.paidPhp)}</strong>
          </>
        ) : (
          <>
            Pro parts from <strong className="font-semibold text-ink">{formatPhp(line.fromPhp)}</strong> · everything{' '}
            <strong className="font-semibold text-ink">{formatPhp(line.fullPhp)}</strong>
          </>
        )}
      </span>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 opacity-60" strokeWidth={2} />
    </Link>
  );
}
