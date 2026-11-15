'use client';

/**
 * needs-step.tsx — "WHAT DO YOU NEED?", THE FIRST SCREEN OF EVERY EVENT'S ONBOARDING (Level 1).
 *
 * ⚖ Owner 2026-10-08, DECISION_LOG "ONBOARDING FOLLOWS WHAT THE EVENT NEEDS — NOT EVERY EVENT WALKS
 * THE WHOLE PATH" (+ "ROADMAP AMENDED …" → Level 1 for the twenty types that ship). Drawn from
 * `prototypes/event_needs_onboarding_2026-10-08_fable.html` frame 3 at 375 px, words as drawn:
 *
 *   New hangout
 *   EVENT NAME [ … ] · WHERE [ … ] · WHEN (optional) [ … ]
 *   WHAT DO YOU NEED?  [ Just photos and one QR for everyone ▾ ]
 *   ✓ Photos with Papic        always on
 *   ✓ One QR for everyone      no guest list
 *   ○ Guest list & replies     off
 *   ○ Suppliers                off
 *   ○ Event Hub with details   cover + photos only
 *   [ Make the event ]   You can switch anything on later from Home.
 *
 * ONE dropdown holds the presets (any set of choices is a dropdown); each row flips alone
 * (`toggleNeed`). The type picks the starting preset (`defaultPresetFor`). Under the title, the
 * type's one honest limit line (matrix §1b). Presentational and controlled: the generic wizard and
 * the Get-together form both own the state and draw this.
 */

import { EVENT_DATE_FLOOR_MESSAGE, eventDateFloorRefusal, eventDateMinFor } from '@/lib/event-date-floor';
import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { FormRows, TypedRow } from '@/app/_components/form-row';
import {
  NEED_PRESETS,
  NEED_PRESET_LABEL,
  NEED_ROW_LABEL,
  needOn,
  needRowSub,
  type EventNeeds,
  type NeedPreset,
  type NeedRow,
} from '@/lib/event-needs';

export const NEEDS_NOTE = 'You can switch anything on later from Today.';

type Props = {
  /** "New hangout" — the type's own word. */
  title: string;
  /** The type's limit line (matrix §1b), or null. */
  limitLine: string | null;
  name: string;
  onName: (v: string) => void;
  where: string;
  onWhere: (v: string) => void;
  /** When (optional) — drawn only on the Simple shape; the other presets ask the date on its own screen. */
  /** `dateExempt` — 💍 the founders' (is_internal) account: any date; everyone else from December 19, 2026. */
  when?: { value: string; onChange: (v: string) => void; dateExempt?: boolean } | null;
  preset: NeedPreset;
  onPreset: (p: NeedPreset) => void;
  needs: EventNeeds;
  rows: readonly NeedRow[];
  onToggle: (row: NeedRow) => void;
  /** The button under the rows ("Make the event" / "Continue"). */
  cta: ReactNode;
  /** A notice above the fields (the one-at-a-time life-event heads-up). */
  notice?: ReactNode;
  /** Form field names, for the Get-together's one form (it posts FormData). */
  fieldNames?: { name: string; where?: string; when: string };
  /** A wake speaks quietly. */
  solemn?: boolean;
  /** This type's own Event name example (the birthday's "Lola Rosa turns 80", `lib/onboarding/asked-once.ts`) —
   *  absent = the line below, so no type borrows another's example by default. */
  namePlaceholder?: string;
};

const LABEL = 'block text-[11px] font-bold uppercase tracking-[0.08em] text-ink/55';
// no-card-ok: the edge of an <input> — a field you type into is a pressable thing
const INPUT = 'mt-1 h-11 w-full rounded-xl border border-ink/20 bg-paper px-3.5 text-[15px] text-ink outline-none placeholder:text-ink/40 focus:border-mulberry'; // no-card-ok: <input> field edge
/** A row is a <button role="checkbox"> (frame 3 draws ticks, not switches). 📐 Lane P fix (owner 10 Nov, "uniform …
 *  design templates"): no box around each row any more — the rows are parted by hairline dividers on the list, the
 *  form-row template's look; the tick circle is what shows it is on. */
const ROW = 'flex min-h-[48px] w-full items-center gap-2.5 py-2.5 text-left text-[14px] text-ink';

export function NeedsStep({
  title,
  limitLine,
  name,
  onName,
  where,
  onWhere,
  when = null,
  preset,
  onPreset,
  needs,
  rows,
  onToggle,
  cta,
  notice,
  fieldNames,
  solemn = false,
  namePlaceholder,
}: Props) {
  return (
    <div data-needs-step="" className="flex flex-col gap-2.5">
      <h1 className="font-serif text-[26px] font-semibold leading-tight text-ink">{title}</h1>
      {limitLine ? (
        <p data-needs-limit="" className="-mt-1 text-[13px] leading-snug text-ink/60">
          {limitLine}
        </p>
      ) : null}
      {notice}

      {/* ✍ THE FIELD TEMPLATE (`TypedRow`, owner 1 Nov 2026: every field follows it): the name on the left, the pill on
          the right; a tap stretches the box across the row. Inside the Get-together's one form, `fieldNames` makes the
          rows post under the same names the raw boxes did. */}
      <FormRows width="wide" className="mt-1">
        <TypedRow
          name="Event name"
          value={name}
          required
          empty={namePlaceholder ?? (solemn ? 'For Lola Rosa' : 'Movie night sa bahay')}
          fieldName={fieldNames?.name}
          onType={onName}
          onKeep={(t) => onName(t)}
          data="needs-name"
          pillAttrs={{ 'data-needs-name': '' }}
        />
        <TypedRow
          name="Where"
          value={where}
          empty={solemn ? 'The chapel, parish or home' : 'Pasig · our place'}
          fieldName={fieldNames?.where}
          onType={onWhere}
          onKeep={(t) => onWhere(t)}
          data="needs-where"
          pillAttrs={{ 'data-needs-where': '' }}
        />
      </FormRows>

      {when ? (
        <label className="block">
          <span className={LABEL}>
            When <span className="font-medium normal-case tracking-normal">(optional)</span>
          </span>
          <input
            type="date"
            name={fieldNames?.when}
            value={when.value}
            onChange={(e) => when.onChange(e.target.value)}
            min={eventDateMinFor(new Date().toISOString().slice(0, 10), when.dateExempt === true)}
            className={INPUT}
            data-needs-when=""
          />
          {/* 💍 The first-event-day rule, said beside the date (lib/event-date-floor.ts). */}
          {eventDateFloorRefusal({ date: when.value, exempt: when.dateExempt === true }) ? (
            <span role="alert" data-event-date-floor="" className="mt-1 block text-xs text-danger-700">
              {EVENT_DATE_FLOOR_MESSAGE}
            </span>
          ) : null}
        </label>
      ) : null}

      <div className="block">
        <span className={LABEL}>What do you need?</span>
        <div className="mt-1">
          <PickMenu
            label="What do you need?"
            value={preset}
            options={NEED_PRESETS.map((p) => ({ key: p, label: NEED_PRESET_LABEL[p] }))}
            onPick={(key) => onPreset(key as NeedPreset)}
            dataAttr="data-needs-preset"
          />
        </div>
      </div>

      <ul className="flex flex-col divide-y divide-ink/10" aria-label="What this event needs">
        {rows.map((row) => {
          const on = needOn(row, needs);
          const locked = row === 'papic';
          return (
            <li key={row}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-disabled={locked || undefined}
                onClick={() => (locked ? undefined : onToggle(row))}
                data-need-row={row}
                data-on={on ? '' : undefined}
                className={`${ROW} ${locked ? 'cursor-default' : ''}`}
              >
                <span
                  aria-hidden
                  className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                    locked
                      ? 'border-ink bg-ink text-paper'
                      : on
                        ? 'border-[color:rgb(var(--color-ok))] bg-[color:rgb(var(--color-ok))] text-paper'
                        : 'border-ink/25'
                  }`}
                >
                  {on ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate">{NEED_ROW_LABEL[row]}</span>
                <span className="shrink-0 whitespace-nowrap text-[11.5px] text-ink/55">{needRowSub(row, needs)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-1">{cta}</div>
      <p className="text-center text-[11.5px] text-ink/55">{NEEDS_NOTE}</p>
    </div>
  );
}

