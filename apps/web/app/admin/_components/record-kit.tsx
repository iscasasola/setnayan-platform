/**
 * 📇 THE PEOPLE RECORD KIT — the pieces the four People records wear (Person · Shop · Event · Venue).
 *
 * Owner, 14 Nov 2026: *"Yes, queue the builds"* — the approved 13 Nov drawing, `Setnayan-specs/prototypes/admin_pub/
 * people.html` (screens `person` · `shop` · `event` · `venue`; BUILDER-NOTES T17 · T18 · T28/T29). A record is:
 *
 *  · `RecordHead`   — the small grey line (what it is · its ID) over the big name, then its badges. The `<h1>` stays in
 *                     the page masthead (one heading per page); this draws the visible name.
 *  · `RecordFacts`  — T18 read-only facts: name on the left, value on the right, one hairline between, never a card.
 *  · `RecordFold`   — one drawing fold: the shared `Fold` (pins slim, reveals on open), title at the left and its ONE
 *                     summary line at the right. `anchor` lets an old address (`#cards`, `?tab=money`) open it.
 *  · `RecordSection` · `RecordRows` · `RecordRow` — a grey capitals label and plain hairline rows, ≥ 56 high, a
 *                     terracotta › when the row opens something.
 *  · `RecordEmpty`  — one plain line where the rows would be.
 *  · A refused read is the admin's shared `ReadFailed` (T29: "not the same as none"), never a 0.
 *  · `RecordNote`   — a quiet line under a fold.
 *
 * Every class is an existing token, copied one for one from the template's row pieces (`template-rows.tsx`, open in
 * PR #7632 for the Accounts list — not on main yet). When that lands, these can become its re-exports.
 *
 * Server-safe: no hooks here (the `Fold` it wraps is the shared client piece).
 */

import Link from 'next/link';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { Fold } from '@/app/_components/fold';

/** The line under a row's name — dark grey, never ink at half strength. */
export const RECORD_SUBLINE = 'text-[13px] leading-snug text-[color:var(--m-slate-2)]';
const HAIRLINE = 'border-[color:var(--m-line)]';

/** The way back to the list this record was opened from. */
export function RecordBack({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={`inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium ${RECORD_SUBLINE} hover:text-ink`}>
      <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.9} />
      {label}
    </Link>
  );
}

export function RecordHead({
  small,
  name,
  lead,
  line,
  badges,
}: {
  /** "Person · S89U-…" — what this record is, and its ID. */
  small: string;
  /** The record's name, as big as the page's title. */
  name: string;
  /** A 56 round mark before the name (initials). */
  lead?: ReactNode;
  /** One line under the name (an email · joined). */
  line?: ReactNode;
  badges?: ReactNode;
}) {
  return (
    <header data-record-head="" className="pb-2 pt-1">
      <div className="flex items-start gap-3">
        {lead ? <span className="flex-none">{lead}</span> : null}
        <div className="min-w-0 flex-1">
          <p className={`truncate ${RECORD_SUBLINE}`}>{small}</p>
          <p className="text-[24px] font-extrabold leading-tight text-ink [overflow-wrap:anywhere]">{name}</p>
          {line ? <p className={`mt-0.5 truncate ${RECORD_SUBLINE}`}>{line}</p> : null}
        </div>
      </div>
      {badges ? <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div> : null}
    </header>
  );
}

/** Initials in a round mark — the record's face when there is no picture. */
export function RecordInitials({ text, square = false }: { text: string; square?: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid h-14 w-14 place-items-center bg-ink text-lg font-semibold text-cream ${square ? 'rounded-xl' : 'rounded-full'}`}
    >
      {text}
    </span>
  );
}

export function RecordFacts({
  items,
  label,
}: {
  items: readonly (readonly [string, ReactNode])[];
  label?: string;
}) {
  return (
    <dl aria-label={label} data-record-facts="" className="[&>div+div]:border-t [&>div+div]:border-[color:var(--m-line)]">
      {items.map(([name, value]) => (
        <div key={name} className="flex min-h-11 items-baseline gap-3 py-2">
          <dt className={`flex-none ${RECORD_SUBLINE}`}>{name}</dt>
          <dd className="min-w-0 flex-1 text-right text-[14px] text-ink [overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RecordFold({
  title,
  summary,
  anchor,
  defaultOpen = false,
  danger = false,
  children,
}: {
  title: string;
  /** One quiet line of what is inside ("3 orders · 1 refund"). A refused read says so here too. */
  summary?: string;
  anchor?: string;
  defaultOpen?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`border-t ${HAIRLINE}`} data-record-fold={anchor ?? title}>
      <Fold title={title} summary={summary} summaryEnd anchor={anchor} defaultOpen={defaultOpen} danger={danger}>
        <div className="pb-4 pt-1">{children}</div>
      </Fold>
    </div>
  );
}

export function RecordFolds({ children }: { children: ReactNode }) {
  return <div className={`mt-4 border-b ${HAIRLINE}`}>{children}</div>;
}

export function RecordSection({
  label,
  right,
  children,
}: {
  label: string;
  /** Words or ONE door at the label's right end. */
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section data-record-section={label} className="mt-3 first:mt-0">
      <h3
        className={`flex min-h-9 items-center gap-2 pb-1 text-[11.5px] font-bold uppercase tracking-[0.1em] ${RECORD_SUBLINE}`}
      >
        <span>{label}</span>
        {right ? (
          <span className="ml-auto text-[13px] font-medium normal-case tracking-normal">{right}</span>
        ) : null}
      </h3>
      {children}
    </section>
  );
}

export function RecordRows({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="[&>li+li]:border-t [&>li+li]:border-[color:var(--m-line)]">
      {children}
    </ul>
  );
}

export function RecordRow({
  title,
  line,
  right,
  href,
  lead,
  muted = false,
}: {
  title: ReactNode;
  line?: ReactNode;
  /** Money, a chip, ONE button — in that order. */
  right?: ReactNode;
  /** The whole row opens this; a terracotta › is drawn. */
  href?: string;
  lead?: ReactNode;
  /** A row that no longer counts (a revoked comp) — drawn quieter. */
  muted?: boolean;
}) {
  const body = (
    <>
      {lead ? <span className="flex-none">{lead}</span> : null}
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold leading-tight text-ink [overflow-wrap:anywhere]">{title}</b>
        {line ? <span className={`mt-0.5 block ${RECORD_SUBLINE} [overflow-wrap:anywhere]`}>{line}</span> : null}
      </span>
      {right ? <span className="flex flex-none flex-wrap items-center justify-end gap-2">{right}</span> : null}
      {href ? <ChevronRight aria-hidden className="h-4 w-4 flex-none text-mulberry" strokeWidth={2.2} /> : null}
    </>
  );
  const shape = `flex min-h-14 w-full items-center gap-2.5 py-2 text-left${muted ? ' opacity-60' : ''}`;
  return (
    <li data-record-row="">
      {href ? (
        <Link href={href} className={`${shape} sn-press`}>
          {body}
        </Link>
      ) : (
        <div className={shape}>{body}</div>
      )}
    </li>
  );
}

export function RecordEmpty({ children }: { children: ReactNode }) {
  return <p className={`py-3 text-[14px] ${RECORD_SUBLINE}`}>{children}</p>;
}

export function RecordNote({ children }: { children: ReactNode }) {
  return <p className={`mt-3 ${RECORD_SUBLINE}`}>{children}</p>;
}
