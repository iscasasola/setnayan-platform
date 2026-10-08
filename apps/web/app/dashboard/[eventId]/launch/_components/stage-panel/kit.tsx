'use client';

import { useRef, type ReactNode } from 'react';
import { FileText, PencilLine, Store } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { PillThumb } from '@/app/_components/pill-selector';
import { ActionButton } from '@/components/action-button';
import { SP_DD, SP_DD_BUTTON, SP_DD_LABEL, SP_PHASE, SP_PHASE_INSET, SP_PHASES, SP_SWATCH, SP_SWATCH_FACE, SP_SWATCH_MORE, SP_SWATCH_ON, SP_SWITCH } from '@/lib/maker-stage-room';
import { PickMenu } from '../../../website/editor/_components/pick-menu';
import type { PickOption } from '../../../website/editor/_components/pick-menu-types';
import { useStagePanelNow } from './store';
import { MAKER_PARTS, type MakerPartKey } from '@/lib/maker-parts';

/**
 * 🧩 THE PROTOTYPE'S PIECES, IN REACT (`maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`):
 *
 *   Phases    `.sub.phases` — Look | Background | Arrange · Build in | Action | Build out
 *   Dd        `.dd` — a white pill: SMALL CAPS label · value · gold ▾ (the shipped PickMenu,
 *             whose list opens as the Maker's bottom sheet — owner: "every pop-up opens from the bottom")
 *   PanelSwitch `.sw` — 54 × 32, green when on (named apart from the Maker's other `Switch` rows)
 *   Swatch    a colour circle (the approved gallery's kind 21) — Text's and Background's five, and their "+"
 *   QuietBar  `.pane>.jump` — Style › Look's one door ("Edit the E-Gifts"), the app's secondary action button
 *   About     ⓘ — helper words are never a box on the panel (owner rule), only behind ⓘ
 *
 * (Move's ← → ↓ ↑ were four buttons of their own here; a direction is one of four VALUES, so it is a dropdown now —
 * `stage-animate.tsx`, `INTERACTION_RULES.md` § 9.)
 *
 * Every class string is `lib/maker-stage-room.ts`'s, where the guard measures it.
 */

export function Phases<K extends string>({
  label,
  value,
  options,
  onPick,
  data,
}: {
  label: string;
  value: K;
  options: ReadonlyArray<readonly [K, string]>;
  onPick: (k: K) => void;
  data: string;
}) {
  return (
    <div role="group" aria-label={label} className={SP_PHASES} data-stage-phases={data}>
      {/* 🎚 The app's travelling thumb (owner 2026-10-08: "apple the same pill selector") — it measures the picked
          segment, at any width, and again whenever the panel is resized. */}
      <PillThumb />
      {options.map(([k, words]) => (
        <button key={k} type="button" aria-pressed={k === value} data-stage-phase={k} data-seg-inset={SP_PHASE_INSET} onClick={() => onPick(k)} className={SP_PHASE}>
          {words}
        </button>
      ))}
    </div>
  );
}

/** A labelled dropdown (prototype `.dd`). A tap anywhere on the pill opens it. */
export function Dd({
  small,
  label,
  value,
  options,
  onPick,
  buttonText,
  data,
  className = '',
  tone = 'plain',
  about,
}: {
  /** What the row does, behind ⓘ beside the pill (owner 2026-10-07: each Arrange row has an ⓘ). */
  about?: ReactNode;
  /** The small caps word on the pill ("Background", "◆ How it moves"). */
  small: string;
  /** What the dropdown is, for a screen reader. */
  label: string;
  value: string | null;
  options: readonly PickOption[];
  onPick: (k: string) => void;
  buttonText?: string;
  data: string;
  className?: string;
  /** `how` — the prototype's gold-washed "How it moves" pill. */
  tone?: 'plain' | 'how';
}) {
  const box = useRef<HTMLDivElement>(null);
  const pill = (
    <div
      ref={box}
      className={`${SP_DD} ${tone === 'how' ? '!bg-[var(--sp-gold-wash)] !ring-[var(--sp-gold-soft)]' : ''} ${className}`}
      data-stage-dd={data}
      onClick={(e) => {
        /* The small label is part of the pill: a tap there opens it too. */
        if (e.target === box.current || (e.target as HTMLElement).dataset.ddLabel !== undefined) {
          box.current?.querySelector<HTMLButtonElement>('button[aria-haspopup]')?.click();
        }
      }}
    >
      <span className={SP_DD_LABEL} data-dd-label="">
        {small}
      </span>
      <PickMenu label={label} value={value} options={options} onPick={onPick} buttonText={buttonText} className={SP_DD_BUTTON} />
    </div>
  );
  return about ? (
    <div className="flex min-w-0 flex-1 items-center gap-0.5" data-stage-dd-row={data}>
      {pill}
      <About label={small}>{about}</About>
    </div>
  ) : (
    pill
  );
}

/** ⓘ — the only place the panel says anything in sentences. */
export function About({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="inline-flex h-11 w-8 shrink-0 items-center justify-center" data-stage-about="">
      <InfoTip label="" ariaLabel={`About ${label}`} align="end">
        {children}
      </InfoTip>
    </span>
  );
}

/** The prototype's switch (`.sw`). */
export function PanelSwitch({ on, label, onChange, data }: { on: boolean; label: string; onChange: (on: boolean) => void; data: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} data-stage-switch={data} onClick={() => onChange(!on)} className={SP_SWITCH}>
      {/* The app's ONE switch look (`.sn-switch`, globals.css — owner 2026-10-08: "switch is teracota or greyed out"). */}
      <span aria-hidden data-on={on} className="sn-switch sn-press-ring relative h-8 w-[54px] rounded-full">
        <span
          className={`sn-switch-knob absolute top-[3px] h-[26px] w-[26px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.25)] transition-[left] ${on ? 'left-[25px]' : 'left-[3px]'}`}
        />
      </span>
    </button>
  );
}

/**
 * 🎨 A COLOUR CIRCLE (approved gallery, kind 21 — owner 2026-10-08; the Look's own two are circles too): the colour
 * edge to edge in a 32 px circle on a 44 px tap. Picked, it wears the accent's ring; a press rings it like every
 * template. `face` paints the circle (a colour, or the theme's stripes).
 */
export function Swatch({ on, label, face, onPick, data }: { on: boolean; label: string; face: ReactNode; onPick: () => void; data: Record<string, string> }) {
  return (
    <button type="button" aria-pressed={on} aria-label={label} onClick={onPick} className={SP_SWATCH} {...data}>
      <span aria-hidden className={`${SP_SWATCH_FACE} ${on ? SP_SWATCH_ON : ''}`}>
        {face}
      </span>
    </button>
  );
}

/** "+" — any colour: opens the ONE colour picker. */
export function SwatchMore({ open, onOpen, data }: { open: boolean; onOpen: () => void; data: Record<string, string> }) {
  return (
    <button type="button" aria-haspopup="dialog" aria-expanded={open} aria-label="Any colour" onClick={onOpen} className={SP_SWATCH} {...data}>
      <span aria-hidden className={SP_SWATCH_MORE}>
        +
      </span>
    </button>
  );
}

/**
 * Style › Look's ONE door — the part's words come from Studio (or Suppliers), and this is the only way there. It is
 * the app's SECONDARY ACTION BUTTON (`ActionButton`, `components/action-button.tsx` — owner 2026-10-08, the approved
 * gallery's kind 9: one main button a screen, the rest quieter), never an ink-black bar of the panel's own: icon and
 * word, the pill, the press. The part's own sentence sits behind ⓘ beside it.
 */
/** The door, laid along the row: it takes the row's width, its word starts at the left and is cut, never wrapped. */
const QUIET_DOOR = '!h-11 min-w-0 !flex-1 !justify-start overflow-hidden [&>.lbl]:min-w-0 [&>.lbl]:truncate';

export function QuietBar() {
  const { quiet, about, picked } = useStagePanelNow();
  const name = picked && picked in MAKER_PARTS ? MAKER_PARTS[picked as MakerPartKey].label : null;
  if (!quiet && !about) return null;
  /* No door to name: the part's NAME heads the row and its sentences sit behind ⓘ — once, never a row holding
     only an ⓘ (owner, the pass: "a lone ⓘ" → "the copy appears once, behind ⓘ"). */
  if (!quiet) {
    return (
      <div className="flex h-11 shrink-0 items-center gap-1.5" data-stage-quiet-row="" data-stage-quiet-name="">
        <span className="min-w-0 flex-1 truncate px-1 text-[13px] font-semibold text-[var(--sp-ink2)]">{name ?? 'This part'}</span>
        <About label="this part">{about}</About>
      </div>
    );
  }
  return (
    <div className="flex h-11 shrink-0 items-center gap-1.5" data-stage-quiet-row="" data-stage-quiet={quiet.kind}>
      {quiet.kind === 'suppliers' ? (
        /* Suppliers is another page of the app: a plain door, never fetched before it is pressed. */
        <ActionButton tone="neutral" icon={Store} label={quiet.words} href={quiet.href} prefetch={false} className={QUIET_DOOR} />
      ) : (
        <ActionButton tone="neutral" icon={quiet.kind === 'info' ? FileText : PencilLine} label={quiet.words} onClick={quiet.open} className={QUIET_DOOR} />
      )}
      {about ? <About label="this part">{about}</About> : null}
    </div>
  );
}
