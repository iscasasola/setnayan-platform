'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { ScheduleBlockType } from '@/lib/schedule';
import type { DayActions } from './day-types';
import { useOneOpen } from '@/lib/one-open';

/**
 * EVERY SET OF CHOICES IS ONE `PickMenu` (owner, 2026-09-27: *"this should be a
 * tap to show option to pick or a drop down"* — never a pill row). The rail, the
 * inspector and the sheets take it from here, so the Schedule's dropdown is the
 * Maker's dropdown, byte for byte: phase · starts · runs for · view as · the
 * supplier to tag · from / through / by on a late day.
 */
export { PickMenu } from '../../website/editor/_components/pick-menu';
export type { PickOption } from '../../website/editor/_components/pick-menu';

/** The page's server actions, provided once by `ScheduleDay` (see `DayActions`). */
export const DayActionsContext = createContext<DayActions | null>(null);

export function useDayActions(): DayActions {
  const actions = useContext(DayActionsContext);
  if (!actions) throw new Error('useDayActions outside <ScheduleDay>');
  return actions;
}

/**
 * Small pieces the Schedule rail and its sheets share (Schedule rebuild,
 * slice 1). The prototype groups by whitespace and type scale, never by boxed
 * cards, so these are deliberately quiet: an ⓘ that explains on tap, a switch,
 * and the one accent bar per phase.
 */

/** One quiet accent per phase — the bar on a moment's left edge and the dot on
 *  its chip. Decorative only: no word is ever painted in these. */
export const PHASE_TINT: Record<ScheduleBlockType, string> = {
  pre_ceremony: '#D9CFBF',
  ceremony: '#CBA766',
  cocktails: '#9FB39A',
  reception: '#B98C8C',
  dinner: '#B98C8C',
  program: '#D89B7B',
  dancing: '#8E9BB5',
  send_off: '#7E8B7A',
  after_party: '#7E8B7A',
  custom: '#C7C2B8',
  lodging: '#C7C2B8',
  tour: '#C7C2B8',
};

/** A server action takes FormData; the rail holds plain values. */
export function toFormData(values: Record<string, string | string[] | null | undefined>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) for (const item of v) fd.append(k, item);
    else fd.set(k, v);
  }
  return fd;
}

/**
 * The ⓘ. Hover on a desktop, TAP on a phone — a tap focuses it, and focus is
 * what shows the words, so a thumb gets the same explanation a cursor does.
 *
 * ⓘ IT IS ROUND (owner 2026-09-25: *"(i) is not round"*). The base layer gives
 * every <button> a 44px floor, which drew this 24px circle as a tall capsule
 * beside "Master · everything" and "Runs" (controller, 2026-09-28, phone shots).
 * `.sn-dot-btn` is the repo's one opt-out — it drops the floor, pins the box
 * square and widens the tap target with an invisible halo — and the drawn
 * circle is the design foundation's own `<InfoTip>` trigger, class for class.
 * Not `<InfoTip>` itself: that component PRINTS the label it sits beside, and
 * every ⓘ here already sits beside a label the caller prints ("Runs 1 h 30
 * min", the role pill, an eyebrow), so it would say each twice.
 */
export function Tip({ children, align = 'center' }: { children: ReactNode; align?: 'center' | 'end' }) {
  const [open, setOpen] = useState(false);
  useOneOpen(open, setOpen); // one open at a time — lib/one-open.ts
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label="More about this"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="sn-press sn-dot-btn inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-ink/25 text-[10px] font-semibold leading-none text-ink/55 hover:border-terracotta hover:text-terracotta aria-expanded:border-terracotta aria-expanded:text-terracotta"
      >
        <span aria-hidden="true">i</span>
      </button>
      {open ? (
        <span
          role="tooltip"
          className={`absolute top-[calc(100%+6px)] z-[70] w-max max-w-[15rem] rounded-md bg-ink px-2.5 py-1.5 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-cream shadow-lg ${
            align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2'
          }`}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}

/** The on/off switch the prototype uses for "Visible to guests". */
export function Switch({
  on,
  onChange,
  label,
  hint,
  disabled = false,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-3 py-2.5 text-left disabled:cursor-default"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint ? <span className="block text-xs text-ink/55">{hint}</span> : null}
      </span>
      <span
        aria-hidden
        className={`relative h-6 w-10 flex-none rounded-full transition-colors ${on ? 'bg-success-600' : 'bg-ink/15'}`}
      >
        <span
          className={`absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`}
        />
      </span>
    </button>
  );
}

/**
 * The −/+ pair for a QUANTITY (owner: *"Size is a −/+ stepper"*) — here always
 * minutes, five a press, the same five the rail snaps to. 40px targets on a
 * phone, 32px beside a desktop inspector.
 */
export function Stepper({
  onMinus,
  onPlus,
  unit = '5 min',
  minusLabel = '5 minutes earlier',
  plusLabel = '5 minutes later',
}: {
  onMinus: () => void;
  onPlus: () => void;
  unit?: string;
  minusLabel?: string;
  plusLabel?: string;
}) {
  return (
    <div className="mt-1.5 inline-flex items-center gap-0.5">
      <button
        type="button"
        onClick={onMinus}
        aria-label={minusLabel}
        className="sn-dot-btn grid h-10 w-10 place-items-center rounded-md text-[15px] text-ink/65 ring-1 ring-inset ring-ink/15 hover:bg-ink/[0.06] lg:h-8 lg:w-8"
      >
        −
      </button>
      <span className="px-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ink/45">{unit}</span>
      <button
        type="button"
        onClick={onPlus}
        aria-label={plusLabel}
        className="sn-dot-btn grid h-10 w-10 place-items-center rounded-md text-[15px] text-ink/65 ring-1 ring-inset ring-ink/15 hover:bg-ink/[0.06] lg:h-8 lg:w-8"
      >
        +
      </button>
    </div>
  );
}

/** The small uppercase label the prototype calls `.eye`. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink/55">{children}</span>
  );
}

/** A round 36px tool in the day's toolbar, with its name for screen readers. */
export function ToolButton({
  label,
  onClick,
  active = false,
  badge,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  badge?: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`sn-dot-btn relative grid h-9 w-9 place-items-center rounded-md transition-colors ${
        active ? 'bg-ink text-cream' : 'text-ink/60 hover:bg-ink/[0.06] hover:text-ink'
      }`}
    >
      {children}
      {badge && badge > 0 ? (
        <span className="absolute right-1 top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-mulberry px-0.5 text-[9px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
