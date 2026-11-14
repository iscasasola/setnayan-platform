/**
 * catalogue-rows.tsx — the few pieces every Catalogue screen is drawn with.
 *
 * Owner, 14 Nov 2026: *"Yes, queue the builds"* — the approved admin drawing
 * (`Setnayan-specs/prototypes/admin_pub/catalogue.html`, BUILDER-NOTES T17 · T18 · T28/T29).
 *
 *  · T18 FRAMES ONLY ON WHAT YOU PRESS. A section is grey capitals and hairline rows — no tile. A row is a door
 *    (the whole row presses, `›` in the accent at the right end) and rises to the shipped page it names.
 *  · T17 DETAILS INSIDE THE ⓘ. A row is a title and at most one short line; anything longer sits behind the ⓘ.
 *  · T28/T29 HONEST STATES. A number that could not be read prints "—" in the warning ink, never a 0 — a refused
 *    read is not the same as none.
 *
 * Plain server markup on the house tokens (`--sn-*`, `ink`) — no colour is written here.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { Badge } from '@/app/_components/badge';
import { formatCount } from '@/lib/format-number';

/** A section's label: grey capitals, no box; its explaining line (when there is one) behind the ⓘ. */
export function Sec({ label, tip, count }: { label: string; tip?: string; count?: number | null }) {
  const cls = 'text-xs font-semibold uppercase tracking-[0.06em] text-ink/70';
  return (
    <h2 className="mb-1 mt-[18px] flex items-center justify-between gap-2" data-catalogue-sec={label}>
      {tip ? (
        <InfoTip label={label} labelAs="span" labelClassName={cls} align="start">
          {tip}
        </InfoTip>
      ) : (
        <span className={cls}>{label}</span>
      )}
      {count === undefined ? null : (
        <span className="font-mono text-xs tabular-nums text-ink/70">{count === null ? '—' : formatCount(count)}</span>
      )}
    </h2>
  );
}

/** Hairline rows under one section. */
export function Rows({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ul aria-label={label} className="divide-y divide-ink/10 border-y border-ink/10">
      {children}
    </ul>
  );
}

/**
 * One row that opens (T14): icon · title · one short line · an optional waiting badge · `›`. The whole row is the
 * press, 44 px at least. `waiting` > 0 draws the amber badge; `null` means the count could not be read.
 */
export function ViewRow({
  href,
  icon: Icon,
  title,
  line,
  waiting,
  data,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  line?: string;
  /** How many wait on the admin here. `undefined` = this row counts nothing; `null` = could not count. */
  waiting?: number | null;
  data?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        data-catalogue-row={data ?? title}
        className="flex min-h-11 items-center gap-3 py-2.5 transition-colors hover:bg-[var(--sn-paper)]"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink/5">
          <Icon aria-hidden className="h-[18px] w-[18px] text-ink/70" strokeWidth={1.75} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-semibold text-ink">{title}</span>
          {line ? <span className="truncate text-[13px] text-ink/70">{line}</span> : null}
        </span>
        {waiting === null ? (
          <Badge tone="quiet" data="waiting-unread">
            —
          </Badge>
        ) : waiting && waiting > 0 ? (
          <Badge tone="wait" data="waiting">
            {formatCount(waiting)}
          </Badge>
        ) : null}
        <span aria-hidden className="shrink-0 text-lg leading-none text-[color:var(--sn-accent)]">
          ›
        </span>
      </Link>
    </li>
  );
}

/** One number in the strip under the Next card. `null` = could not be read → "—" in the warning ink. */
export type Num = { value: number | null; label: string; href?: string; tone?: 'warn' };

/** The read-only number strip (T18: facts are not framed). Each number may open its list. */
export function Nums({ nums }: { nums: Num[] }) {
  return (
    <dl className="mb-1 mt-3 grid grid-cols-3 gap-2" data-catalogue-nums="">
      {nums.map((n) => {
        const unread = n.value === null;
        const inner = (
          <>
            <dt className="text-xs text-ink/70">{n.label}</dt>
            <dd
              className={`font-mono text-xl font-bold tabular-nums ${
                unread || n.tone === 'warn' ? 'text-warn-800' : 'text-ink'
              }`}
              aria-label={unread ? `${n.label}: couldn’t count — not the same as none` : undefined}
            >
              {unread ? '—' : formatCount(n.value as number)}
            </dd>
          </>
        );
        return n.href ? (
          <Link key={n.label} href={n.href} className="flex min-h-11 flex-col-reverse justify-center">
            {inner}
          </Link>
        ) : (
          <div key={n.label} className="flex min-h-11 flex-col-reverse justify-center">
            {inner}
          </div>
        );
      })}
    </dl>
  );
}

/** The page frame every Catalogue screen shares — the same measure as the Work list. */
export function CataloguePage({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-3 sm:px-6 lg:max-w-5xl lg:pt-6">{children}</div>;
}
