import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge, type BadgeTone } from '@/app/_components/badge';

/**
 * CUSTOMERS › DATES — one row (S-PR3; frames 04 · 35). The People row's shape without the avatar: a title, one quiet
 * line, a state badge (kind 11, soft fill, never pressed) and — when the row goes somewhere — the terracotta arrow.
 * Hairline between rows, no box (owner 2026-10-12, look call 8). The whole row is the one tap.
 *
 * `lead` is a small mark at the left (a blocked day's hatch); `end` is a control that is NOT the row's tap (a
 * switch, a Chat button, a ✕) — a row with an `end` never also links, so a press always means one thing.
 */
export function DatesRow({
  title,
  line,
  badge,
  href,
  lead,
  end,
  data,
  strong,
  download = false,
}: {
  title: ReactNode;
  line?: ReactNode;
  badge?: { tone: BadgeTone; word: string } | null;
  href?: string | null;
  lead?: ReactNode;
  end?: ReactNode;
  /** `data-dates-row="<data>"`. */
  data?: string;
  /** A number at the right, read big (frame 35: "Holding this date … 2"). */
  strong?: ReactNode;
  /** The row downloads a file (the phone calendar's .ics) — a plain link, never a client navigation. */
  download?: boolean;
}) {
  const inner = (
    <>
      {lead ?? null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium leading-tight text-ink">{title}</span>
        {line ? <span className="mt-0.5 block truncate text-[13px] text-ink/60">{line}</span> : null}
      </span>
      {strong !== undefined && strong !== null ? <span className="text-[17px] font-semibold tabular-nums text-ink">{strong}</span> : null}
      {badge ? (
        <Badge tone={badge.tone} data="dates-row">
          {badge.word}
        </Badge>
      ) : null}
      {end ?? null}
      {href && !end ? <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2} /> : null}
    </>
  );
  const rowClass = 'flex min-h-[60px] items-center gap-3 border-t border-ink/10 py-2.5 first:border-t-0';
  if (href && !end && download) {
    return (
      <a href={href} download className={`sn-press ${rowClass}`} data-dates-row={data ?? ''}>
        {inner}
      </a>
    );
  }
  return href && !end ? (
    <Link href={href} scroll className={`sn-press ${rowClass}`} data-dates-row={data ?? ''}>
      {inner}
    </Link>
  ) : (
    <div className={rowClass} data-dates-row={data ?? ''}>
      {inner}
    </div>
  );
}
