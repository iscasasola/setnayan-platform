/**
 * panel-kit.tsx — the shapes every Admin › Categories drawer panel shares (owner 2026-10-29, "Approve panels" —
 * prototype `carry-2026-10-29/admin-categories-proto/index.html`, `head()` and `fold()`):
 *
 *   · `PanelHead` — a tappable BREADCRUMB (each crumb opens that level; the current level is its icon + word), the
 *     NAME (wraps, never cut), ONE count line, and an ⓘ holding the developer key ("key massage-chair" lives in
 *     the ⓘ, not on the page — house rule: title + one short line, the rest in the ⓘ);
 *   · `PanelFold` — the guest card's fold (`Fold summaryEnd`): title left · one-line summary right · chevron ·
 *     hairline · ONE OPEN AT A TIME · the open head PINS slim under the drawer's pinned row (`pin`). A danger fold
 *     (Delete · Combine) is red and always last.
 *
 * Server-safe (no 'use client'): `Fold` and `InfoTip` are the shared client parts, used as they are.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Fold } from '@/app/_components/fold';
import { InfoTip } from '@/app/_components/info-tip';
import { LevelIcon } from './map-rows';
import type { Level } from './map-rows';

export type Crumb = { level: Level; label: string; href?: string };

export function PanelHead({
  crumbs,
  title,
  sub,
  keyText,
  keyNote,
  gap = false,
}: {
  crumbs: readonly Crumb[];
  title: string;
  /** The ONE count line — "4 services · 3 parts · 6 cards". */
  sub: string;
  /** The developer key, shown only inside the ⓘ. */
  keyText?: string;
  keyNote?: string;
  /** The count line names a gap ("0 services") — drawn in the page's gap tone. */
  gap?: boolean;
}) {
  return (
    <header className="pb-2 pt-3" data-panel-head="">
      <nav aria-label="Where it sits" className="mb-1 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[13px] text-ink/70">
        {crumbs.map((c, i) => (
          <span key={`${c.level}-${i}`} className="inline-flex items-center gap-1">
            {i > 0 ? <span aria-hidden>›</span> : null}
            {c.href ? (
              <Link
                href={c.href}
                scroll={false}
                data-crumb={c.level}
                className="sn-press inline-flex min-h-8 items-center gap-1 rounded-full border border-ink/15 px-2 text-ink/80 hover:bg-ink/5"
              >
                <LevelIcon level={c.level} className="h-3.5 w-3.5" />
                <span className="[overflow-wrap:anywhere]">{c.label}</span>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 text-ink/55">
                <LevelIcon level={c.level} className="h-3.5 w-3.5" />
                {c.label}
              </span>
            )}
          </span>
        ))}
      </nav>
      <h2 className="mb-0.5 text-[22px] font-semibold leading-tight text-ink [overflow-wrap:anywhere]">{title}</h2>
      {keyText ? (
        <InfoTip label={sub} labelClassName={`text-[13px] ${gap ? 'text-terracotta-700' : 'text-ink/70'}`} ariaLabel="About the key" align="start">
          <b>Key</b> <span className="font-mono">{keyText}</span>
          <br />
          {keyNote ?? 'A developer key — what links, the database and a shop’s card point at. It never changes, even when the name does.'}
        </InfoTip>
      ) : (
        <p className="text-[13px] text-ink/70">{sub}</p>
      )}
    </header>
  );
}

/** One fold of a drawer panel. `danger` = red title, always the last fold. */
export function PanelFold({
  id,
  title,
  summary,
  children,
  danger = false,
  last = false,
  open = false,
}: {
  id: string;
  title: string;
  summary: string;
  children: ReactNode;
  danger?: boolean;
  last?: boolean;
  open?: boolean;
}) {
  return (
    <Fold
      title={title}
      summary={summary}
      summaryEnd
      pin
      popovers
      danger={danger}
      defaultOpen={open}
      anchor={danger ? 'drawer-danger' : undefined}
      data={`drawer-${id}`}
      className={last ? '' : 'border-b border-ink/10'}
    >
      <div className="flex flex-col gap-3 pb-4 pt-1">{children}</div>
    </Fold>
  );
}

/** Read-only words (edited in another list — said so in a quiet help line). */
export function Quiet({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] text-ink/70">{children}</p>;
}

export function Says({ children }: { children: ReactNode }) {
  return <p className="text-[14px] text-ink" data-read-only="">{children}</p>;
}
