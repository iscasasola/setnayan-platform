/**
 * 📐 THE TEMPLATE'S ROW PIECES — the design template (owner-approved 2026-11-14,
 * `Setnayan-specs/prototypes/design_template_sheet_2026-11-14_fable.html`) drawn ONCE so couple, supplier and admin
 * pages wear the same pieces (rule 14 · uniformity). Every value here is an existing token; nothing is a new look.
 * The shapes copy the approved admin drawing's classes one for one (`prototypes/admin_pub/admin.css` — `.sec` ·
 * `.row` · `.na` · `.nums` · `.fail` · `.empty`):
 *
 *  · `TemplateSection` — rule 2: a small grey capitals label, no box, 18 of air above; an optional ⓘ (rule 7) and
 *    words on its right ("₱750 on 2 bookings").
 *  · `TemplateRows` + `TemplateRow` — rule 2: plain rows on the page, one hairline between them, ≥ 56 high: bold
 *    name, one dark-grey line under it, the right side (money bold, a chip, one button, ⋯), and a terracotta › when
 *    the whole row opens something.
 *  · `edge` — rule 11: a gold edge = due, red = late; the edge is the only colour on the row.
 *  · `TemplateNums` — rule 13 / the Money frame: read-only numbers between two hairlines, never in cards.
 *  · `TemplateFail` — rule 6: a failed read never looks like "none" — amber words with their own Try again.
 *  · `TemplateEmpty` — rule 6: empty is one plain line where the rows would be. No card, no icon box.
 *
 * Text strengths are the template's three (rule 13): full ink for the name and money, `--m-slate-2` (dark grey,
 * AA on white and on the warm surface) for the line under it — never ink at half strength.
 *
 * A server-safe module (no hooks): it costs the shared bundle nothing but the ⓘ, which is already shared.
 */

import Link from 'next/link';
import { ChevronRight, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';

import { ActionButton } from '@/components/action-button';

import { InfoTip } from './info-tip';

/** The line under a row's name — rule 13's "dark grey for the line under it". */
export const TEMPLATE_SUBLINE = 'text-[13px] leading-snug text-[color:var(--m-slate-2)]';

/** Money — the words' own font, bold, even-width digits (rule 13: never a typewriter font). */
export const TEMPLATE_MONEY = 'font-bold tabular-nums text-ink';

export function TemplateSection({
  label,
  tip,
  right,
  first = false,
  children,
  data,
}: {
  label: string;
  /** What the ⓘ beside the label says — one short line (rule 7). */
  tip?: ReactNode;
  /** Words at the label's right end, in sentence case. */
  right?: ReactNode;
  /** The first section on a page sits close under the pinned row. */
  first?: boolean;
  children?: ReactNode;
  data?: string;
}) {
  return (
    <section data-template-section={data ?? label} className={first ? 'mt-1' : 'mt-[18px]'}>
      <h2 className="flex min-h-9 items-center gap-2 pb-1 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">
        {tip ? (
          <InfoTip label={label} align="start" labelClassName="uppercase">
            {tip}
          </InfoTip>
        ) : (
          <span>{label}</span>
        )}
        {right ? (
          <span className="ml-auto text-[13px] font-medium normal-case tracking-normal text-[color:var(--m-slate-2)]">{right}</span>
        ) : null}
      </h2>
      {children}
    </section>
  );
}

export function TemplateRows({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="[&>li+li]:border-t [&>li+li]:border-[color:var(--m-line)]">
      {children}
    </ul>
  );
}

export type TemplateEdge = 'due' | 'late';

const EDGE_COLOUR: Readonly<Record<TemplateEdge, string>> = {
  due: 'var(--m-orange)',
  late: 'rgb(var(--color-danger))',
};

export function TemplateRow({
  title,
  line,
  right,
  href,
  edge,
  lead,
  data,
}: {
  title: ReactNode;
  /** One line under the name. */
  line?: ReactNode;
  /** Money, a chip, ONE button, ⋯ — in that order. */
  right?: ReactNode;
  /** The whole row opens this; a terracotta › is drawn. Rows with a `right` button keep their own targets. */
  href?: string;
  /** Rule 11 — the needs-you edge. */
  edge?: TemplateEdge;
  /** A 40 round mark before the name (initials, an icon). */
  lead?: ReactNode;
  data?: string;
}) {
  const body = (
    <>
      {edge ? (
        <i
          aria-hidden
          data-template-edge={edge}
          className="block h-9 w-1 flex-none rounded-sm"
          style={{ background: EDGE_COLOUR[edge] }}
        />
      ) : null}
      {lead ? <span className="flex-none">{lead}</span> : null}
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[15px] font-semibold leading-tight text-ink">{title}</b>
        {line ? <span className={`mt-0.5 block truncate ${TEMPLATE_SUBLINE}`}>{line}</span> : null}
      </span>
      {right ? <span className="flex flex-none items-center gap-2 whitespace-nowrap">{right}</span> : null}
      {href ? <ChevronRight aria-hidden className="h-4 w-4 flex-none text-mulberry" strokeWidth={2.2} /> : null}
    </>
  );
  const shape = `flex min-h-14 w-full items-center gap-2.5 py-2 text-left${edge ? ' min-h-16' : ''}`;
  return (
    <li data-template-row={data ?? ''}>
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

/** Read-only numbers between two hairlines (rule 2/13 — never number cards). */
export function TemplateNums({ items }: { items: readonly { label: string; value: ReactNode; tone?: 'warn' | 'danger' | 'ok' }[] }) {
  return (
    <dl
      className="my-2.5 grid gap-1 border-y border-[color:var(--m-line)] py-3 text-center"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((it) => (
        <div key={it.label} className="grid min-h-11 content-center gap-0.5">
          <dt className="order-2 text-[12px] text-[color:var(--m-slate-2)]">{it.label}</dt>
          <dd
            className="order-1 text-[24px] font-bold leading-none tabular-nums text-ink"
            style={it.tone ? { color: `rgb(var(--color-${it.tone === 'danger' ? 'danger' : it.tone}))` } : undefined}
          >
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A read that failed — amber, its own Try again. Never a 0, never "none". */
export function TemplateFail({ children, retryHref, data }: { children: ReactNode; retryHref?: string; data?: string }) {
  return (
    <p
      role="alert"
      data-template-fail={data ?? ''}
      className="flex min-h-11 items-center gap-2.5 py-2 text-[14px]"
      style={{ color: 'rgb(var(--color-warn))' }}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {retryHref ? <ActionButton tone="warn" icon={<RotateCw aria-hidden strokeWidth={1.9} />} label="Try again" href={retryHref} prefetch={false} /> : null}
    </p>
  );
}

/** Empty — one plain line where the rows would be. */
export function TemplateEmpty({ children, data }: { children: ReactNode; data?: string }) {
  return (
    <p data-template-empty={data ?? ''} className={`py-3 text-[14px] ${TEMPLATE_SUBLINE}`}>
      {children}
    </p>
  );
}
