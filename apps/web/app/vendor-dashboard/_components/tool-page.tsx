/**
 * 🧰 THE SUPPLIER TOOL PAGES' SHARED PIECES — the owner-approved redraw (21 Nov 2026, DECISION_LOG "11 SUPPLIER TOOL
 * PAGES REDRAW — APPROVED (v3)"; drawing `Setnayan-specs/prototypes/supplier_tools_redraw_2026-11-21/
 * supplier_tools_redraw_v3_fable.html`). Attributes · Repertoire · Recommend · Creators · Theft Watch · Disputes ·
 * Track record · Segments + Questions · My lines · Moodboard library · Manpower wear the November supplier look through
 * these, so no page draws its own copy:
 *
 *  · `ToolPin`     — the drawing's `.pin`: ONE pinned row — back · title · its count or status. Phone: a 40 round ‹
 *                    (`BackButton variant="tool"`, so the home still comes from `lib/page-home.ts`); from 701 the
 *                    "‹ Shop" crumb. Sticky on the page's own ground, the soft hairline under it (no cut line).
 *  · `ToolSection` — the drawing's `.sec`: the supplier label (bold sentence case, its count in a pale pill right after
 *                    it — the house `.hc-k2` reading `--sn-label-*`), an optional ⓘ, words at its right end.
 *  · `ToolChip`    — the drawing's `.chip`: a dot + the state's word on its own tint. The house Badge's tones and
 *                    shape, plus the drawing's `info` (the link blue).
 *  · `ToolFail`    — the drawing's `.fail`: a read that FAILED — amber, its own Try again. Never a 0, never "none",
 *                    never "clean" (controller 21 Nov: "a failed read must never render as empty or clean").
 *  · `ToolLine`    — the drawing's `.ln`: one quiet line, the long shipped sentence inside its ⓘ.
 *
 * Tokens only — every colour is a house token, so the supplier blue (light) and the dark set follow `supplier-look.css`
 * and the theme. A server-safe module: the ⓘ (`InfoTip`) is the only client piece, and it is already shared.
 */
import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { BackButton } from '@/app/_components/back-button';
import { BADGE_CLASS, badgeStyle, type BadgeTone } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';
import { formatCount } from '@/lib/format-number';

/** The page column: the phone's 16 gutter, one 760 reading column on a computer (the drawing's `.dcol`). */
export function ToolPage({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-16 sm:px-6" data-tool-page={name}>
      {children}
    </div>
  );
}

export function ToolPin({
  route,
  title,
  right,
  sub,
}: {
  /** This page's route as on disk — the ‹ reads its home from `lib/page-home.ts`. */
  route: string;
  title: string;
  /** The page's count or status — a `ToolChip`, a few words. */
  right?: ReactNode;
  /** One line under the row (the drawing's `.pinsub`). */
  sub?: ReactNode;
}) {
  return (
    <div
      className="sn-pin-hair sticky top-0 z-[5] -mx-4 mb-1 px-4 pb-2.5 pt-0.5 sm:-mx-6 sm:px-6"
      style={{ background: 'var(--sn-canvas)' }}
      data-tool-pin=""
    >
      <div className="flex min-h-12 items-center gap-2.5">
        <BackButton route={route} variant="tool" />
        <h1 className="min-w-0 flex-1 truncate text-[22px] font-bold leading-tight tracking-[-0.015em] text-ink tab:text-[26px]">
          {title}
        </h1>
        {right ? <span className="inline-flex flex-none items-center gap-2 text-[13px] font-semibold text-[color:var(--m-slate-2)]">{right}</span> : null}
      </div>
      {sub ? <div className="mt-0.5 flex items-center gap-1.5 text-[14px] text-[color:var(--m-slate-2)]">{sub}</div> : null}
    </div>
  );
}

export function ToolSection({
  label,
  count,
  tip,
  right,
  data,
  children,
}: {
  /** Bold sentence case — "Reposts flagged". */
  label: string;
  /** The pale pill right after the label. */
  count?: number;
  /** What the ⓘ beside the label says — the long shipped sentence lives here. */
  tip?: ReactNode;
  /** Words (or one small button) at the label's right end. */
  right?: ReactNode;
  data?: string;
  children?: ReactNode;
}) {
  const name = (
    <>
      {label}
      {count !== undefined ? <em className="tabular-nums">{formatCount(count)}</em> : null}
    </>
  );
  return (
    <section data-tool-section={data ?? label} className="mt-[18px]">
      <h2 className="hc-k2 mb-2 min-h-9 justify-between">
        {tip ? (
          <InfoTip label={label} labelNode={<span className="inline-flex items-center gap-2">{name}</span>} align="start">
            {tip}
          </InfoTip>
        ) : (
          <span className="inline-flex items-center gap-2">{name}</span>
        )}
        {right ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--m-slate-2)]">{right}</span>
        ) : null}
      </h2>
      {children}
    </section>
  );
}

export type ToolChipTone = BadgeTone | 'info';

/** The drawing's chip: a dot + the word, on the state's own tint. `info` is the link blue on its wash. */
export function ToolChip({ tone, children, data }: { tone: ToolChipTone; children: ReactNode; data?: string }) {
  const style =
    tone === 'info'
      ? { color: 'rgb(var(--color-link))', background: 'color-mix(in srgb, rgb(var(--color-link)) 12%, transparent)' }
      : badgeStyle(tone);
  return (
    <span data-badge={tone} data-badge-for={data} className={`${BADGE_CLASS} gap-1.5 font-semibold`} style={style}>
      <i aria-hidden className="block h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

/**
 * A read that FAILED (rule 6 · the controller's 21 Nov ruling). Amber words — the bold line says what could not be read,
 * the second what that means — and its own Try again, which reloads the page. Never drawn as empty or clean.
 */
export function ToolFail({
  title,
  line,
  retryHref,
  data,
}: {
  title: string;
  line?: string;
  /** This page's own address — "Try again" reads it again. */
  retryHref?: string;
  data?: string;
}) {
  return (
    <div
      role="alert"
      data-template-fail={data ?? ''}
      className="flex flex-col items-start gap-2 px-0.5 py-2.5 text-[15px]"
      style={{ color: 'rgb(var(--color-warn))' }}
    >
      <b className="font-bold">{title}</b>
      {line ? <span>{line}</span> : null}
      {retryHref ? (
        <ActionButton tone="neutral" icon={<RotateCcw aria-hidden strokeWidth={1.8} />} label="Try again" href={retryHref} prefetch={false} />
      ) : null}
    </div>
  );
}

/** One quiet line — the long shipped sentence in its ⓘ (`tip`). */
export function ToolLine({ children, tip, label, data }: { children: ReactNode; tip?: ReactNode; label?: string; data?: string }) {
  return (
    <div className="my-2 flex items-start gap-1.5 px-0.5 text-[14px] text-[color:var(--m-slate-2)]" data-tool-line={data ?? ''}>
      {tip && label ? (
        <InfoTip label={label} labelNode={children} align="start">
          {tip}
        </InfoTip>
      ) : (
        <span>{children}</span>
      )}
    </div>
  );
}

/**
 * The drawing's `.row` with more than one line under the name (a rate and its audience rate, a chip under the line) —
 * `TemplateRow`'s shape, every line its own block. Sits in `TemplateRows` (one white frame, no line between rows).
 */
export function ToolRow({
  title,
  lines,
  lead,
  right,
  data,
}: {
  title: ReactNode;
  /** Each a line under the name, in order; a falsy entry is skipped. */
  lines?: readonly ReactNode[];
  /** A 40 round (initials, an icon) or a 48 photo. */
  lead?: ReactNode;
  /** A chip, ONE small button, a figure. */
  right?: ReactNode;
  data?: string;
}) {
  return (
    <li data-tool-row={data ?? ''} className="flex min-h-14 items-center gap-3 py-2.5">
      {lead ? <span className="flex-none">{lead}</span> : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="block text-[15px] font-semibold leading-tight text-ink [overflow-wrap:anywhere]">{title}</b>
        {(lines ?? []).filter(Boolean).map((l, i) => (
          <span key={i} className="mt-0.5 block text-[13px] leading-snug text-[color:var(--m-slate-2)]">
            {l}
          </span>
        ))}
      </span>
      {right ? <span className="flex flex-none items-center gap-2">{right}</span> : null}
    </li>
  );
}

/** A 40 round mark before a row's name — initials or an icon, on the tile wash in the link blue. */
export function ToolLead({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[color:var(--surface-soft)] text-[13px] font-bold text-[rgb(var(--color-link))]"
    >
      {children}
    </span>
  );
}

/** The drawing's empty: one plain line where the rows would be — only when the read worked. */
export function ToolEmpty({ children, data }: { children: ReactNode; data?: string }) {
  return (
    <p data-template-empty={data ?? ''} className="flex items-start gap-1.5 px-0.5 py-3 text-[15px] text-[color:var(--m-slate-2)]">
      {children}
    </p>
  );
}
