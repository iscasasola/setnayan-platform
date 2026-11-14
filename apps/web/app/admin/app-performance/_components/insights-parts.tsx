/**
 * insights-parts.tsx — the few shapes every Insights view is drawn with.
 *
 * Owner, 14 Nov 2026: *"Yes, queue the builds"* — the approved drawing is
 * `Setnayan-specs/prototypes/admin_pub/insights.html` (BUILDER-NOTES, T-rules). Each view there is built from the
 * same handful of pieces, so each is written ONCE here and every view uses these — never a copy per view:
 *
 *   · `Nums`       — the strip of two or three big numbers (`.nums`). A number that could not be read is "—" in
 *                    the warning colour, NEVER 0 (T28/T29).
 *   · `Sec`        — a section head: small caps title, its ⓘ, an optional count or control at the right (`.sec`).
 *   · `Facts`      — read-only name · value pairs, no frame (T18 `.facts`). `null` is "—", never 0.
 *   · `Rows`/`Row` — hairline rows; a row with an address opens it and wears the accent › (`.row`).
 *   · `NotMeasured`— a number nobody measures yet: "—" and why, in its ⓘ (`notMeasured()`).
 *   · `Mix`        — one stacked share bar with its legend (`.mix` + `.leg`), tokens only.
 *   · `Note`       — the closing line of a view; its words live inside an ⓘ, never as a paragraph (T17).
 *
 * Server-safe: no hooks here. The ⓘ is the house `InfoTip` (a client island). Colours come from the tokens.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

import { InfoTip } from '@/app/_components/info-tip';

/** The words a refused read prints where its number would have been (never 0). */
export const UNREAD = '—';

export type NumTone = 'ok' | 'warn' | 'danger';
export type NumItem = {
  /** `null` = the read was refused or never ran — drawn as "—" in the warning colour. */
  value: number | string | null;
  label: string;
  href?: string;
  tone?: NumTone;
};

const TONE_TEXT: Record<NumTone, string> = {
  ok: 'text-[var(--sn-success-deep)]',
  warn: 'text-[var(--sn-warning-deep)]',
  danger: 'text-[var(--sn-danger)]',
};

function shown(value: number | string | null): string {
  if (value === null) return UNREAD;
  return typeof value === 'number' ? value.toLocaleString('en-PH') : value;
}

/** Two or three big numbers in one strip, divided top and bottom by a hairline — no boxes. */
export function Nums({ items, data, testId }: { items: NumItem[]; data?: string; testId?: string }) {
  const cols = items.length === 2 ? 'grid-cols-2' : items.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3';
  return (
    <dl data-insights-nums={data ?? ''} data-testid={testId} className={`my-2.5 grid ${cols} gap-1 border-y border-ink/10 py-3`}>
      {items.map((n) => {
        const tone = n.value === null ? 'warn' : n.tone;
        const inner = (
          <>
            <dd className={`order-1 text-[26px] font-bold leading-none tabular-nums ${tone ? TONE_TEXT[tone] : 'text-ink'}`}>
              {shown(n.value)}
            </dd>
            <dt className="order-2 text-[12px] text-ink/55">{n.label}</dt>
          </>
        );
        return n.href ? (
          <Link
            key={n.label}
            href={n.href}
            className="grid min-h-11 content-center gap-1 rounded-lg text-center hover:bg-ink/[0.03] focus-visible:outline-2 focus-visible:outline-[var(--sn-accent)]"
          >
            {inner}
          </Link>
        ) : (
          <div key={n.label} className="grid min-h-11 content-center gap-1 text-center">
            {inner}
          </div>
        );
      })}
    </dl>
  );
}

/** A section head. `about` puts the explanation in the ⓘ beside the title (T17). */
export function Sec({
  title,
  about,
  count,
  right,
  id,
}: {
  title: string;
  about?: ReactNode;
  count?: number | string | null;
  right?: ReactNode;
  id?: string;
}) {
  const label = 'text-[11px] font-bold uppercase tracking-[0.12em] text-ink/55';
  return (
    <div data-insights-sec="" className="flex min-h-11 items-center gap-2 pb-1 pt-4">
      {about ? (
        <InfoTip label={title} labelAs="h2" labelId={id} labelClassName={label} align="start">
          {about}
        </InfoTip>
      ) : (
        <h2 id={id} className={label}>
          {title}
        </h2>
      )}
      {count === undefined ? null : (
        <span className={`text-[11px] font-bold tabular-nums ${count === null ? TONE_TEXT.warn : 'text-ink'}`}>
          {shown(count)}
        </span>
      )}
      {right ? <span className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-ink/70">{right}</span> : null}
    </div>
  );
}

/** Read-only facts — name on the left, value on the right; `null` is "—" in the warning colour, never 0. */
export function Facts({ rows, data }: { rows: [name: string, value: ReactNode | null][]; data?: string }) {
  return (
    <dl
      data-insights-facts={data ?? ''}
      className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-1.5 border-t border-ink/10 py-2.5 text-[14px]"
    >
      {rows.map(([name, value]) => (
        <div key={name} className="contents">
          <dt className="text-ink/55">{name}</dt>
          <dd className={`min-w-0 break-words font-semibold ${value === null ? TONE_TEXT.warn : 'text-ink'}`}>
            {value === null ? UNREAD : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A list of hairline rows (the first has no rule above it). */
export function Rows({ children, label, data }: { children: ReactNode; label?: string; data?: string }) {
  return (
    <ul aria-label={label} data-insights-rows={data ?? ''} className="mt-0.5 [&>li:first-child]:border-t-0">
      {children}
    </ul>
  );
}

/**
 * One row: a title, an optional quiet second line, and what sits at the right (a number, a badge).
 * With `href` the whole row opens that place and wears the accent › — T14 "tap opens".
 */
export function Row({
  title,
  sub,
  trail,
  href,
  tone,
  data,
}: {
  title: ReactNode;
  sub?: ReactNode;
  trail?: ReactNode;
  href?: string;
  /** Colours the second line: `warn` for a read that failed, `danger` for something broken. */
  tone?: NumTone;
  data?: string;
}) {
  const body = (
    <>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold leading-tight text-ink">{title}</span>
        {sub ? (
          <span className={`mt-px block truncate text-[13px] ${tone ? TONE_TEXT[tone] : 'text-ink/65'}`}>{sub}</span>
        ) : null}
      </span>
      <span className="flex items-center gap-2 whitespace-nowrap text-[14px] tabular-nums text-ink/70">
        {trail}
        {href ? <ChevronRight aria-hidden className="h-4 w-4 text-[var(--sn-accent)]" strokeWidth={2.2} /> : null}
      </span>
    </>
  );
  const cls = 'grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 py-2 text-left';
  return (
    <li data-insights-row={data ?? ''} className="border-t border-ink/10">
      {href ? (
        <Link href={href} className={`${cls} hover:bg-ink/[0.02] focus-visible:outline-2 focus-visible:outline-[var(--sn-accent)]`}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}

/** A number nobody measures yet: "—" and the reason in its ⓘ — never a simulated value, never 0. */
export function NotMeasured({ name, why }: { name: string; why: ReactNode }) {
  return (
    <Row
      data="not-measured"
      title={
        <InfoTip label={name} align="start">
          {why}
        </InfoTip>
      }
      sub="not measured yet"
      trail={<span className="text-ink/45">{UNREAD}</span>}
    />
  );
}

/** A small pill for a row's right side. Tokens only. */
export function Badge({ children, tone }: { children: ReactNode; tone?: NumTone | 'info' }) {
  const bg =
    tone === 'ok'
      ? 'bg-[var(--sn-success-soft)] text-[var(--sn-success-deep)]'
      : tone === 'warn'
        ? 'bg-[var(--sn-warning-soft)] text-[var(--sn-warning-deep)]'
        : tone === 'danger'
          ? 'bg-[var(--sn-danger-soft)] text-[var(--sn-danger)]'
          : tone === 'info'
            ? 'bg-[var(--sn-info-soft)] text-[var(--sn-info)]'
            : 'bg-ink/[0.06] text-ink/70';
  return <span className={`inline-flex min-h-6 items-center rounded-full px-2 text-[12px] font-semibold ${bg}`}>{children}</span>;
}

/** The three series colours a stacked bar may use — accent · info · hairline grey (the drawing's T · B · G). */
export const MIX_COLOURS = ['var(--sn-accent)', 'var(--sn-info)', 'var(--sn-line)'] as const;

/** One stacked share bar and its legend. Parts with no share are left out of the bar but kept in the legend. */
export function Mix({ parts, label }: { parts: { label: string; value: number; legend: string }[]; label: string }) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  return (
    <figure className="m-0" data-insights-mix="">
      <div role="img" aria-label={label} className="my-2 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-ink/[0.06]">
        {total > 0
          ? parts.map((p, i) =>
              p.value > 0 ? (
                <i
                  key={p.label}
                  className="block h-full"
                  style={{ width: `${(p.value / total) * 100}%`, background: MIX_COLOURS[i % MIX_COLOURS.length] }}
                />
              ) : null,
            )
          : null}
      </div>
      <figcaption className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] text-ink/65">
        {parts.map((p, i) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <i aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: MIX_COLOURS[i % MIX_COLOURS.length] }} />
            {p.legend}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** A view's closing line: a short label whose explanation lives in its ⓘ (T17 — no paragraph copy on a page). */
export function Note({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p data-insights-note="" className="mt-4 border-t border-ink/10 pt-3 text-[13px] text-ink/60">
      <InfoTip label={label} align="start">
        {children}
      </InfoTip>
    </p>
  );
}

/** A view's opening line: the one-sentence explanation of the whole view, inside an ⓘ (`.one` in the drawing). */
export function One({ label, children, extra }: { label: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <div data-insights-one="" className="mb-0.5 mt-1.5 flex min-w-0 flex-wrap items-center gap-1 text-[13.5px] text-ink/70">
      <InfoTip label={label} align="start">
        {children}
      </InfoTip>
      {extra}
    </div>
  );
}
