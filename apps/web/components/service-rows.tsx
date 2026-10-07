'use client';

/**
 * The More-menu service pages' one shape (corpus
 * `MORE_MENU_PAGES_AUDIT_2026-10-07_fable.md` + its 375 px prototypes in
 * `prototypes/more-menu-pages-2026-10-07/`): a title, the brand line, ONE
 * sentence with the rest behind ⓘ, then ROWS ON PAPER — never cards.
 *
 *   ServiceHead   — "Live stream" / "LIVE WATCH · <status>" / one line + ⓘ
 *   RowGroup      — a small uppercase label over a run of rows ("Set once")
 *   ServiceRow    — glyph · label · value · › — a button (opens a sheet),
 *                   a door (`href`), or a still row carrying a switch
 *
 * No borders around anything but the hairline between rows (the no-boxes
 * rule). The glyph is the prototype's 22 px terracotta-tint square.
 */
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { InfoTip } from '@/app/_components/info-tip';

export function ServiceHead({
  title,
  brand,
  status,
  line,
  info,
}: {
  /** The plain name ("Live stream"). */
  title: string;
  /** The brand ("Live Watch") — printed small, uppercase. */
  brand: string;
  /** The one-word state beside the brand ("Off air", "Added"). */
  status?: string | null;
  /** The ONE sentence the page says out loud. */
  line: string;
  /** Everything else — behind the ⓘ beside that sentence. */
  info: ReactNode;
}) {
  return (
    <header className="space-y-1">
      <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
      <p className="flex flex-wrap items-center gap-1.5 text-xs uppercase tracking-[0.06em] text-ink/60">
        <span>{brand}</span>
        {status ? (
          <>
            <span aria-hidden>·</span>
            <span className="rounded-full border border-ink/15 px-2 py-0.5 text-[11px] normal-case tracking-normal">
              {status}
            </span>
          </>
        ) : null}
      </p>
      <InfoTip
        label={line}
        labelAs="p"
        align="start"
        className="pt-1"
        labelClassName="text-sm text-ink/65"
      >
        {info}
      </InfoTip>
    </header>
  );
}

export function RowGroup({ label, children }: { label?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-4">
      {label ? (
        <h2 className="mb-0.5 text-[11px] uppercase tracking-[0.1em] text-ink/60">{label}</h2>
      ) : null}
      <div className="divide-y divide-ink/[0.14]">{children}</div>
    </section>
  );
}

type RowCommon = {
  /** The 22 px glyph — a lucide icon element or a number. */
  glyph: ReactNode;
  label: string;
  /** The answer as it stands ("Connected", "Add Live Watch · ₱2,500"). */
  value?: ReactNode;
  /** A switch (or other control) rendered at the row's end, OUTSIDE the button. */
  end?: ReactNode;
  'data-testid'?: string;
};

function Glyph({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-mulberry/[0.09] text-xs text-mulberry [&_svg]:h-3.5 [&_svg]:w-3.5"
    >
      {children}
    </span>
  );
}

function Inner({ glyph, label, value, chevron }: RowCommon & { chevron: boolean }) {
  return (
    <>
      <Glyph>{glyph}</Glyph>
      <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{label}</span>
      {value != null ? <span className="shrink-0 text-[13px] text-ink/60">{value}</span> : null}
      {chevron ? <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.75} /> : null}
    </>
  );
}

const ROW = 'flex min-h-[44px] w-full items-center gap-2.5 py-1.5 text-left';

/**
 * One row. Exactly one of `onClick` (opens something here — a sheet) or `href`
 * (a door) or neither (a still row, usually carrying a switch in `end`).
 * ⚠ `end` is a SIBLING of the button, never inside it — a form or switch
 * nested in a `<button>` is invalid HTML (lint-nested-forms).
 */
export function ServiceRow(
  props: RowCommon & ({ onClick: () => void; href?: undefined } | { href: string; onClick?: undefined } | { onClick?: undefined; href?: undefined }),
) {
  const { end } = props;
  let body: ReactNode;
  if (props.onClick) {
    body = (
      <button type="button" onClick={props.onClick} className={`${ROW} min-w-0 flex-1`} data-testid={props['data-testid']}>
        <Inner {...props} chevron />
      </button>
    );
  } else if (props.href) {
    body = (
      <Link href={props.href} className={`${ROW} min-w-0 flex-1`} data-testid={props['data-testid']}>
        <Inner {...props} chevron />
      </Link>
    );
  } else {
    body = (
      <div className={`${ROW} min-w-0 flex-1`} data-testid={props['data-testid']}>
        <Inner {...props} chevron={false} />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      {body}
      {end ? <div className="shrink-0">{end}</div> : null}
    </div>
  );
}
