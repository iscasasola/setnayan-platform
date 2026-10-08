'use client';

import { PickMenu } from './pick-menu';
import type { ReactNode } from 'react';
import { PILL_TRACK_CLASS, PILL_TRACK_GROUND, PillThumb, pillSegClass } from '@/app/_components/pill-selector';
import { Minus, Plus, RotateCcw } from 'lucide-react';

/**
 * 🧰 THE INSPECTOR'S PIECES — the Keynote/Pages inspector's parts, in the
 * Maker's own look (owner 2026-09-27: *"use keynote and pages as inspiration
 * on how to make our toolbars look"*; the approved prototype
 * `prototypes/maker_toolbars_keynote_pages_2026-09-27.html`).
 *
 * One tab row under the title (never repeated in the top bar — owner:
 * *"repeated. just place it on the sidebar"*), then rows: a small grey label on
 * the left, the control on the right, a hairline between rows. No cards.
 *
 * 📱 Phone first: every target is at least 44 px tall below `lg` (the sheet is
 * thumb-driven); from `lg` — the desktop right column — the rows tighten to
 * the prototype's 34–36 px.
 */

/** The tab row — Format · Animate · Arrange · Content, or Text · Animate · Arrange. */
export function InspectorTabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: ReadonlyArray<{ key: K; label: string }>;
  value: K;
  onChange: (key: K) => void;
  label: string;
}) {
  return (
    <>
    {/* 📱 On a phone the tabs are ONE dropdown (owner 2026-10-02: "any set of
        choices is one dropdown, never a pill row"); the desktop keeps its tabs. */}
    <div className="flex shrink-0 px-3 pt-1 lg:hidden" data-inspector-tabs-pick="">
      <PickMenu
        label={label}
        value={value}
        options={tabs.map((t) => ({ key: t.key, label: t.label }))}
        onPick={(k) => onChange(k as K)}
        className="w-full"
      />
    </div>
    <div role="tablist" aria-label={label} className="hidden border-b border-ink/10 px-3 pt-1 lg:flex" data-inspector-tabs="">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          data-inspector-tab={t.key}
          onClick={() => onChange(t.key)}
          className={`sn-press -mb-px min-h-11 flex-1 whitespace-nowrap border-b-2 px-1 text-[13px] font-semibold transition-colors duration-sn-control ease-sn lg:min-h-10 ${
            value === t.key ? 'border-ink text-ink' : 'border-transparent text-ink/50 hover:text-ink'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
    </>
  );
}

/** One row: a label, then the control. `wrap` lets a long control take the next line. */
export function IRow({
  label,
  children,
  wrap = false,
  data,
}: {
  label?: ReactNode;
  children: ReactNode;
  wrap?: boolean;
  data?: string;
}) {
  return (
    <div
      data-inspector-row={data}
      className={`flex items-center gap-2.5 border-b border-ink/[0.07] py-2.5 ${wrap ? 'flex-wrap' : ''}`}
    >
      {label !== undefined ? <p className="w-[4.5rem] shrink-0 text-[12.5px] text-ink/60">{label}</p> : null}
      {children}
    </div>
  );
}

/** A small uppercase section heading inside a tab ("Show", "Order", "Background"). */
export function ISection({ children }: { children: ReactNode }) {
  return <p className="pb-1.5 pt-4 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink/45">{children}</p>;
}

/** A one-line quiet note under a row. */
export function IHint({ children, data }: { children: ReactNode; data?: string }) {
  return (
    <p data-inspector-hint={data} className="py-2 text-[12px] leading-snug text-ink/55">
      {children}
    </p>
  );
}

/**
 * A SEGMENTED SELECTOR IS A PILL WHOSE THUMB SLIDES (owner 2026-10-08, DECISION_LOG "SELECTORS ARE PILLS THAT
 * SLIDE"). The shape, the motion and the thumb are the APP's — `app/_components/pill-selector.tsx` (read its
 * docblock for the rule and for when a selector is the wrong control). `ISegmented` / `ISeg` stay here, where the
 * Maker imports them, and DRAW it: the shared track, the shared choice look, the shared thumb.
 */

/** The selector's track — shared by `ISegmented` and any segmented row of LINKS (`/schedule`'s views). */
export const I_SEGMENTED_CLASS = `${PILL_TRACK_CLASS} flex-wrap gap-0.5 ${PILL_TRACK_GROUND}`;

/**
 * One segment's look, on or off — `ISeg`'s, exported so a segment that must stay
 * a LINK (a view with its own address: open in a new tab, deep link, Back) wears
 * exactly the same control instead of a second one. The desktop's right column keeps its tighter rows (`lg:`).
 */
export function iSegClass(on: boolean, tone: 'plain' | 'wine' = 'plain'): string {
  return `${pillSegClass(on, tone)} lg:min-h-8`;
}

export function ISegmented({
  children,
  label,
  grow = true,
  slide = true,
}: {
  children: ReactNode;
  label?: string;
  grow?: boolean;
  /**
   * The thumb that travels between the choices. `false` for a row that is NOT an either-or — several may be on at
   * once (Bold · Italic · Underline): each then keeps its own fill and nothing slides.
   */
  slide?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`${I_SEGMENTED_CLASS} ${grow ? 'flex-1' : ''}`}
    >
      {slide ? <PillThumb /> : null}
      {children}
    </div>
  );
}

export function ISeg({
  on,
  onClick,
  children,
  disabled = false,
  title,
  data,
  className = '',
  tone = 'plain',
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
  data?: string;
  className?: string;
  /** `wine` — the chosen segment filled in the Setnayan wine (`mulberry`, the CTA token) with white words: a SECTION switch (the part sheet's Text · Motion · Arrange). */
  tone?: 'plain' | 'wine';
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      title={title}
      data-seg={data}
      data-seg-tone={tone}
      onClick={onClick}
      className={`${iSegClass(on, tone)} ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * THE − / + STEPPER. `value` is shown only where the prototype prints one
 * (line and letter spacing); SIZE shows none (owner, answer 3: *"-+ only"*).
 * A press that would leave the safe range is disabled — rails on — and says so.
 */
export function IStepper({
  label,
  value,
  canDown,
  canUp,
  onDown,
  onUp,
  data,
}: {
  /** What is being stepped, for a screen reader ("Size", "Line spacing"). */
  label: string;
  value?: string | null;
  canDown: boolean;
  canUp: boolean;
  onDown: () => void;
  onUp: () => void;
  data?: string;
}) {
  const btn =
    'sn-press inline-flex h-11 w-12 items-center justify-center text-ink/70 transition-colors duration-sn-control ease-sn hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed disabled:text-ink/25 disabled:hover:bg-transparent lg:h-9 lg:w-10';
  return (
    <span
      role="group"
      aria-label={label}
      data-stepper={data}
      className="inline-flex shrink-0 items-stretch overflow-hidden rounded-md border border-ink/15 bg-white"
    >
      <button
        type="button"
        aria-label={`${label}: smaller`}
        title={canDown ? undefined : 'As small as it safely goes'}
        disabled={!canDown}
        onClick={onDown}
        data-step="down"
        className={btn}
      >
        <Minus aria-hidden className="h-4 w-4" strokeWidth={2.2} />
      </button>
      {value !== undefined ? (
        <span
          aria-live="polite"
          className="grid min-w-[3.25rem] place-items-center border-x border-ink/10 px-1.5 text-[13px] tabular-nums text-ink"
        >
          {value ?? 'Auto'}
        </span>
      ) : (
        <span aria-hidden className="w-px bg-ink/10" />
      )}
      <button
        type="button"
        aria-label={`${label}: larger`}
        title={canUp ? undefined : 'As large as it safely goes'}
        disabled={!canUp}
        onClick={onUp}
        data-step="up"
        className={btn}
      >
        <Plus aria-hidden className="h-4 w-4" strokeWidth={2.2} />
      </button>
    </span>
  );
}

/** A ↺ reset, as quiet text (one word per concept). */
export function IReset({ onClick, children, data }: { onClick: () => void; children: ReactNode; data?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-inspector-reset={data}
      className="sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full px-1 text-[12.5px] font-semibold text-ink/60 transition-colors duration-sn-control ease-sn hover:text-ink lg:min-h-9"
    >
      <RotateCcw aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      {children}
    </button>
  );
}

/** A plain secondary button (Preview, Move up …). */
export function IButton({
  onClick,
  children,
  fill = false,
  disabled = false,
  data,
  type = 'button',
}: {
  onClick?: () => void;
  children: ReactNode;
  fill?: boolean;
  disabled?: boolean;
  data?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-inspector-button={data}
      className={`sn-press inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-colors duration-sn-control ease-sn disabled:cursor-not-allowed disabled:opacity-40 lg:min-h-9 ${
        fill ? 'bg-ink text-cream hover:bg-ink/90' : 'bg-white text-ink shadow-[inset_0_0_0_1px_rgba(0,0,0,.12)] hover:bg-ink/5'
      }`}
    >
      {children}
    </button>
  );
}
