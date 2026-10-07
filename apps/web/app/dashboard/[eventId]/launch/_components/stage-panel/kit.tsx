'use client';

import { useRef, type ReactNode } from 'react';
import { FileText, PencilLine, Store } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import {
  SP_DD,
  SP_DD_BUTTON,
  SP_DD_LABEL,
  SP_DIR,
  SP_PHASE,
  SP_PHASES,
  SP_SWITCH,
  STAGE_QUIET_ROW,
  STAGE_QUIET_SUPPLIERS,
} from '@/lib/maker-stage-room';
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
 *   Dir       `.dir` — one of ← → ↓ ↑
 *   QuietBar  `.pane>.jump` — Style › Look's one dark bar ("Edit the E-Gifts · Studio ›")
 *   About     ⓘ — helper words are never a box on the panel (owner rule), only behind ⓘ
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
      {options.map(([k, words]) => (
        <button key={k} type="button" aria-pressed={k === value} data-stage-phase={k} onClick={() => onPick(k)} className={SP_PHASE}>
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
}: {
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
  return (
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
      <span aria-hidden className={`relative h-8 w-[54px] rounded-full transition-colors duration-200 ${on ? 'bg-[var(--sp-ok)]' : 'bg-[var(--sp-line2)]'}`}>
        <span
          className={`absolute top-[3px] h-[26px] w-[26px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.25)] transition-[left] duration-200 ${on ? 'left-[25px]' : 'left-[3px]'}`}
        />
      </span>
    </button>
  );
}

/** One of ← → ↓ ↑ (`.dir`). */
export function Dir({ on, glyph, label, onPick }: { on: boolean; glyph: string; label: string; onPick: () => void }) {
  return (
    <button type="button" aria-pressed={on} aria-label={label} data-stage-dir={label} onClick={onPick} className={SP_DIR}>
      <span
        aria-hidden
        className={`inline-flex h-[38px] w-10 items-center justify-center rounded-md border text-[17px] ${
          on ? 'border-[var(--sp-ink)] bg-[var(--sp-ink)] text-white' : 'border-[var(--sp-line)] bg-white text-[var(--sp-ink2)]'
        }`}
      >
        {glyph}
      </span>
    </button>
  );
}

/**
 * Style › Look's ONE quiet bar — the part's words come from Studio (or Suppliers),
 * and this is the only door there. The part's own sentence sits behind ⓘ beside it.
 */
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
    <div className="flex h-11 shrink-0 items-center gap-1.5" data-stage-quiet-row="">
      {quiet ? (
        quiet.kind === 'suppliers' ? (
          <a href={quiet.href} data-stage-quiet="suppliers" className={STAGE_QUIET_SUPPLIERS}>
            <Store aria-hidden className="h-4 w-4 shrink-0 text-[var(--sp-cta)]" strokeWidth={2} />
            <span className="min-w-0 flex-1 truncate">{quiet.words}</span>
            <small className="shrink-0 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--sp-cta)]">{quiet.small}</small>
          </a>
        ) : (
          <button type="button" data-stage-quiet={quiet.kind} onClick={quiet.open} className={STAGE_QUIET_ROW}>
            {quiet.kind === 'info' ? (
              <FileText aria-hidden className="h-4 w-4 shrink-0 opacity-85" strokeWidth={2} />
            ) : (
              <PencilLine aria-hidden className="h-4 w-4 shrink-0 opacity-85" strokeWidth={2} />
            )}
            <span className="min-w-0 flex-1 truncate">{quiet.words}</span>
            <small className="shrink-0 text-[10.5px] font-bold uppercase tracking-[0.12em] opacity-85">{quiet.small}</small>
          </button>
        )
      ) : null}
      {about ? <About label="this part">{about}</About> : null}
    </div>
  );
}
