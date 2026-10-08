import type { CSSProperties } from 'react';

/**
 * SLIDER — "more or less", where the exact number matters less than the feel (`INTERACTION_RULES.md` § 9, kind 17;
 * the approved gallery `prototypes/control_templates_2026-10-08.html` § 17).
 *
 * Owner, 2026-10-08, approving the gallery — and on the knob: *"animation press effect"*.
 *
 *   · THE LINE fills in the app's accent up to the knob (`--sn-accent`), grey after it;
 *   · THE KNOB is white with the accent's ring; HELD, it dips, fills with the accent and shows a soft ring — the same
 *     press as every other control — and springs back when let go. Its speed is a share of the family's one speed
 *     (`--sn-pill-dur`). Nothing moves under "reduce motion";
 *   · THE VALUE is shown beside it by the caller (`SLIDER_VALUE` — figures that do not jump as they change);
 *   · 44 px to the finger, whatever the line's own 6 px.
 *
 * It IS the browser's own range (`<input type="range">`): the keyboard, the screen reader and a phone's drag are the
 * platform's. This file adds the name, what the value says (`valueText`) and how far the line is filled; the look is
 * `.sn-slider` in `app/globals.css` — a range's line and knob can only be drawn there.
 *
 * No colour is chosen here, no hook, no state: it renders on the server or the client alike, and costs no request.
 * Guard: `lib/the-slider-is-one-drawing.test.ts`.
 */

/** How far along the line the knob is, 0–100 — what `.sn-slider` fills up to. A range of no length sits in the middle. */
export function sliderFill(value: number, min: number, max: number): number {
  if (!(max > min) || !Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

/** The slider's own classes: the stylesheet's look, 44 px to the finger, as wide as the room it is given. */
export const SLIDER_CLASS = 'sn-slider h-11 w-full min-w-0 cursor-pointer';
/** The value shown beside a slider: figures of one width, so the row does not shift as it is dragged. */
export const SLIDER_VALUE = 'shrink-0 text-right text-[13.5px] font-medium tabular-nums text-ink/75';

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  valueText,
  disabled = false,
  className = '',
  data,
}: {
  /** The slider's name, for a screen reader ("Text size", "Opacity"). */
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** The knob moved (every step of a drag). */
  onChange: (value: number) => void;
  /** What the value SAYS ("1.1 s", "86%") — read out instead of the bare number. */
  valueText?: string;
  disabled?: boolean;
  /** Layout only (a width, a margin) — never a colour. */
  className?: string;
  /** `data-slider="<data>"`. */
  data?: string;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      aria-label={label}
      aria-valuetext={valueText}
      data-slider={data ?? ''}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`${SLIDER_CLASS} ${className}`}
      style={{ '--sn-slider-fill': `${sliderFill(value, min, max)}%` } as CSSProperties}
    />
  );
}
