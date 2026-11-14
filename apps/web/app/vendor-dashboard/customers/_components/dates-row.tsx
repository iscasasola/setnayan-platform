import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge, type BadgeTone } from '@/app/_components/badge';
import { SaveFileLink } from '@/app/_components/save-file-link';

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
  line2,
  badge,
  href,
  lead,
  end,
  data,
  strong,
  download = false,
  tour,
  onOpen,
}: {
  title: ReactNode;
  line?: ReactNode;
  /** 🗓 A second quiet line (a booked day's "you arrive · done") — its own line, so neither wraps at 390 px. */
  line2?: ReactNode;
  badge?: { tone: BadgeTone; word: string } | null;
  href?: string | null;
  lead?: ReactNode;
  end?: ReactNode;
  /** `data-dates-row="<data>"`. */
  data?: string;
  /** A number at the right, read big (frame 35: "Holding this date … 2"). */
  strong?: ReactNode;
  /** The row saves a file (the phone calendar's .ics) — through SaveFileLink, never a client navigation and never a
   *  bare `<a download>` (the iPhone app's web view renders that in place, with no way back). */
  download?: boolean | string;
  /** 🔦 A spotlight tour's anchor token (`data-tour`). */
  tour?: string;
  /** The row opens something in place (a sheet) instead of going somewhere — the whole row is one button. Ignored
   *  with `href` or `end`, so a press still means one thing. */
  onOpen?: () => void;
}) {
  const inner = (
    <>
      {lead ?? null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium leading-tight text-ink">{title}</span>
        {line ? <span className="mt-0.5 block truncate text-[13px] text-[color:var(--m-slate-2)]">{line}</span> : null}
        {line2 ? (
          <span className="block truncate text-[13px] text-[color:var(--m-slate-2)]" data-dates-row-line2="">
            {line2}
          </span>
        ) : null}
      </span>
      {strong !== undefined && strong !== null ? <span className="text-[17px] font-semibold tabular-nums text-ink">{strong}</span> : null}
      {badge ? (
        <Badge tone={badge.tone} data="dates-row">
          {badge.word}
        </Badge>
      ) : null}
      {end ?? null}
      {href && !end ? <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2} /> : onOpen && !end ? <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2} /> : null}
    </>
  );
  const rowClass = 'flex min-h-14 items-center gap-3 border-t border-ink/10 py-2.5 first:border-t-0';
  if (href && !end && download) {
    return (
      <SaveFileLink
        href={href}
        filename={typeof download === 'string' ? download : (href.split('?')[0] ?? '').split('/').pop() || 'download'}
        className={`sn-press ${rowClass}`}
        data-dates-row={data ?? ''}
        data-tour={tour}
      >
        {inner}
      </SaveFileLink>
    );
  }
  if (onOpen && !href && !end) {
    return (
      <button type="button" onClick={onOpen} className={`sn-press w-full text-left ${rowClass}`} data-dates-row={data ?? ''} data-tour={tour}>
        {inner}
      </button>
    );
  }
  return href && !end ? (
    <Link href={href} scroll className={`sn-press ${rowClass}`} data-dates-row={data ?? ''} data-tour={tour}>
      {inner}
    </Link>
  ) : (
    <div className={rowClass} data-dates-row={data ?? ''} data-tour={tour}>
      {inner}
    </div>
  );
}

/**
 * The round icon tile at a row's left (the approved prototype's look pass, 2026-10-14: "icons on rows") — a soft
 * disc with the row's mark. Shown, never pressed.
 */
export function RowTile({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden className="grid h-11 w-11 flex-none place-items-center rounded-full bg-ink/[0.05] text-ink/70 [&>svg]:h-5 [&>svg]:w-5">
      {children}
    </span>
  );
}
