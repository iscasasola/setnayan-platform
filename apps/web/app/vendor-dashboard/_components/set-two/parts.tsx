import Link from 'next/link';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { pageBackLink } from '@/lib/page-home';
import { SupplierThumbRow } from '../supplier-thumb-row';
import s from './set-two.module.css';

/**
 * parts.tsx — the pieces of the November supplier look the eight "set two" pages are drawn from (owner-approved 21 Nov
 * 2026, DECISION_LOG "STOP ADDING AFTER THE CAKE MAKER — BUILD AND FIX ONLY" point 2; drawing
 * `prototypes/supplier_pages_set2_2026-11-21/supplier_pages_set2_v2_fable.html`). Server-safe: no state, no effects.
 *
 *   PartPage   the page column — full bleed on a phone, the house measure on a computer (passed in, see below);
 *   PartPin    the pinned row: the round back · the title over "Back to …" · ⓘ, a pill or the main button at the end.
 *              The back reads the ONE map (`lib/page-home.ts`, `pageBackLink`) — the page names its own route, never
 *              a free href, so it cannot disagree with the map;
 *   PartTop    the top block (the facts, the title, the glow);
 *   PartSec    a section head; PartList + PartRow the card of rows; PartCard a plain card; PartNote a note;
 *   PartTiles  three count tiles; PartFoot the one main button in the thumb zone.
 *
 * Copy is the page's own — these pieces carry no words of their own except the "Back to" of the pinned row.
 */

type Icon = ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number | string }>;

/**
 * `column` is the page's house measure, written AT THE CALL SITE so `the-columns-are-the-system.test.ts` reads it there:
 * a secondary page reads at `mx-auto w-full tab:max-w-3xl` (48 rem), the wide stage is `tab:max-w-5xl`.
 */
export function PartPage({ column, mark, children }: { column: string; mark: string; children: ReactNode }) {
  return (
    <div className={`${column} ${s.page}`} data-set-two={mark}>
      {children}
    </div>
  );
}

/** The round back + the title. `route` is this page's own route pattern, as on disk. */
export function PartPin({
  route,
  params,
  title,
  end,
}: {
  route: string;
  params?: Readonly<Record<string, string>>;
  title: ReactNode;
  end?: ReactNode;
}) {
  const back = pageBackLink(route, params);
  return (
    <div className={s.pin} data-set-two-pin="">
      {back ? (
        <Link href={back.href} aria-label={`Back to ${back.label}`} className={s.round} data-set-two-back="">
          <ArrowLeft aria-hidden strokeWidth={1.75} />
        </Link>
      ) : null}
      <h1 className={s.pinTitle}>
        {title}
        {back ? <small>Back to {back.label}</small> : null}
      </h1>
      {end}
    </div>
  );
}

export function PartTop({
  kicker,
  title,
  end,
  back,
  heading = 2,
  children,
}: {
  /** 1 on a page with no pinned row (a part of their event): the block's title is the page's heading. */
  heading?: 1 | 2;
  /** A part of their event: the quiet round back that leads the title row from 701 (the dark line's Close on a phone). */
  back?: { href: string; label: string } | null;
  kicker?: ReactNode;
  /** The block's own heading (a page under the dark line or a fee's facts); a pinned-row page passes none. */
  title?: ReactNode;
  end?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={s.top} data-set-two-top="">
      {kicker ? <div className={s.kicker}>{kicker}</div> : null}
      {title ? (
        <div className={s.topRow}>
          {back ? (
            <Link href={back.href} aria-label={`Back to ${back.label}`} className={`${s.round} ${s.roundQuiet} ${s.topBack}`}>
              <ArrowLeft aria-hidden strokeWidth={1.75} />
            </Link>
          ) : null}
          {heading === 1 ? <h1 className={s.topTitle}>{title}</h1> : <h2 className={s.topTitle}>{title}</h2>}
          {end}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function PartSec({ children, end, tone }: { children: ReactNode; end?: ReactNode; tone?: 'warn' | 'ok' }) {
  return (
    <h3 className={`${s.sec} ${tone === 'warn' ? s.secWarn : tone === 'ok' ? s.secOk : ''}`}>
      {children}
      {end ? <span className={s.secEnd}>{end}</span> : null}
    </h3>
  );
}

export function PartList({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${s.list} ${className}`}>{children}</div>;
}

export function PartRow({
  icon: RowIc,
  iconTone,
  title,
  sub,
  end,
  href,
  wrap = false,
  top = false,
  go,
  mark,
  dense = false,
}: {
  /** A count row (a label and a number): 40 px, the drawing's compact row. */
  dense?: boolean;
  icon?: Icon;
  iconTone?: 'ok' | 'danger';
  title: ReactNode;
  sub?: ReactNode;
  end?: ReactNode;
  href?: string;
  /** Let the title and the line under it wrap (a sentence, not a name). */
  wrap?: boolean;
  top?: boolean;
  /** Draw the › — on by default for a row that opens. */
  go?: boolean;
  mark?: string;
}) {
  const inner = (
    <>
      {RowIc ? (
        <span
          aria-hidden
          className={`${s.rowIcon} ${iconTone === 'ok' ? s.rowIconOk : iconTone === 'danger' ? s.rowIconDanger : ''}`}
        >
          <RowIc strokeWidth={1.75} />
        </span>
      ) : null}
      <span className={`${s.rowBody} ${wrap ? s.wrap : ''}`}>
        <b className={s.rowTitle}>{title}</b>
        {sub ? <span className={s.rowSub}>{sub}</span> : null}
      </span>
      {end}
      {(go ?? Boolean(href)) ? <ChevronRight aria-hidden className={s.go} strokeWidth={1.75} /> : null}
    </>
  );
  const cls = `${s.row} ${top ? s.rowTop : ''} ${dense ? s.rowDense : ''}`;
  return href ? (
    <Link href={href} className={cls} data-set-two-row={mark}>
      {inner}
    </Link>
  ) : (
    <div className={cls} data-set-two-row={mark}>
      {inner}
    </div>
  );
}

/** The reference beside an amount, in the row's title. */
export function PartRef({ children }: { children: ReactNode }) {
  return <span className={s.ref}>{children}</span>;
}

export function PartCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${s.card} ${className}`}>{children}</div>;
}

export type NoteTone = 'warn' | 'ok' | 'danger' | 'accent' | 'plain' | 'quiet';

const NOTE_TONE: Record<NoteTone, string> = {
  warn: s.noteWarn!,
  ok: s.noteOk!,
  danger: s.noteDanger!,
  accent: s.noteAccent!,
  plain: s.notePlain!,
  quiet: '',
};

export function PartNote({
  tone = 'quiet',
  icon: NoteIc,
  role,
  end,
  mark,
  children,
}: {
  tone?: NoteTone;
  icon?: Icon;
  role?: 'status' | 'alert';
  /** A small button inside the note (Try again). */
  end?: ReactNode;
  mark?: string;
  children: ReactNode;
}) {
  return (
    <div role={role} className={`${s.note} ${NOTE_TONE[tone]}`} data-set-two-note={mark}>
      {NoteIc ? <NoteIc aria-hidden strokeWidth={1.75} /> : null}
      <div className={s.noteBody}>{children}</div>
      {end}
    </div>
  );
}

export function PartText({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`${s.txt} ${className}`}>{children}</p>;
}

export type PartTile = { key: string; value: ReactNode; label: ReactNode; sub?: ReactNode; hot?: boolean };

export function PartTiles({ tiles }: { tiles: readonly PartTile[] }) {
  return (
    <div className={s.tiles} data-set-two-tiles="">
      {tiles.map((t) => (
        <div key={t.key} className={`${s.tile} ${t.hot ? s.tileHot : ''}`}>
          <b>{t.value}</b>
          <em>{t.label}</em>
          {t.sub ? <small>{t.sub}</small> : null}
        </div>
      ))}
    </div>
  );
}

/**
 * The one main button (or the equal pair) in the thumb zone: the supplier's own floating row (`SupplierThumbRow`) — on a
 * phone it floats over the dock; from 701 it moves up into the shell's pinned bar, at the right (the drawing's "on a
 * computer the main button sits at the right of the pinned row"). A submit button here names its form (`form=`).
 */
export function PartFoot({ mark, label, children }: { mark: string; label: string; children: ReactNode }) {
  return (
    <SupplierThumbRow name={mark} label={label}>
      {children}
    </SupplierThumbRow>
  );
}

/** The class names, for a page that draws a piece the parts do not cover (a form row, the big amount). */
export const setTwo = s;
