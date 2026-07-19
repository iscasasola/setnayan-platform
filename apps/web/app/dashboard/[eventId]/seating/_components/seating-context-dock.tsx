'use client';

/**
 * The Context Dock (Seat_Plan_Controls_Council_Verdict_2026-07-17 · §1). ONE
 * docked contextual surface that replaces the four competing per-object chromes
 * the canvas used to grow — the table-anchored popover, the floating pills, the
 * always-on marker micro-control scatter, and the per-seat × chips. One place to
 * look, one glass recipe, structurally incapable of occluding the selection.
 *
 * This file holds the presentational shell (ContextDock) + two shared pieces the
 * dock and AddTablePanel both use (ShapeGlyph, ShapePicker). All seat-plan state
 * + handlers stay in the 6k-line editor, which composes the verb rows and passes
 * them in as children — extract the shell, don't fork the logic.
 *
 * Kit (Atelier-Glass, owner-locked 2026-07-12): the dock is an `sn-glass` blur
 * surface that REPLACES the popover's blur (net blur count unchanged). Gold stays
 * on Auto Arrange — the dock's "Seat people" is emphasized, never gold. Every
 * touch target ≥44px on the phone sheet. Motion respects `prefers-reduced-motion`.
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { X } from 'lucide-react';
import {
  TABLE_TYPE_CATALOG,
  TABLE_TYPE_LABEL,
  shapeHintFor,
  type TableShapeHint,
  type TableType,
} from '@/lib/seating';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export type DockEdge = 'bottom' | 'top';
export type DockTone = 'neutral' | 'picked-guest' | 'picked-group' | 'notice' | 'edit-chairs';

const TONE_RING: Record<DockTone, string> = {
  neutral: 'border-ink/15',
  'picked-guest': 'border-terracotta/45',
  'picked-group': 'border-mulberry/40',
  notice: 'border-warn-300',
  'edit-chairs': 'border-mulberry/50',
};

/**
 * §1.1 — the docked shell. `variant='dock'` floats bottom-center of the canvas
 * (flipping to top-center when the selection would be occluded — the edge is
 * decided by the parent from a screen-space AABB test, passed in). Attached
 * panels expand AWAY from the occupied edge with a REAL measured max-height (the
 * 380px constant dies). `variant='sheet'` is the phone bottom sheet — its own
 * fixed-bottom surface with ≥44px rows, no flip.
 */
export function ContextDock({
  variant,
  edge = 'bottom',
  tone = 'neutral',
  glyph,
  name,
  boundsRef,
  panel,
  children,
  onDismiss,
}: {
  variant: 'dock' | 'sheet';
  edge?: DockEdge;
  tone?: DockTone;
  /** Type glyph — echoed so the referent is never lost (§1.1). */
  glyph?: ReactNode;
  /** Name echo (table label / marker name). */
  name?: string;
  /** The canvas cell — measured to bound the attached panel's height. */
  boundsRef?: RefObject<HTMLElement | null>;
  /** Attached panel (SeatPeoplePanel / ShapePicker / booth picker). */
  panel?: ReactNode;
  /** The verb row. */
  children: ReactNode;
  /** Optional dismiss affordance for the pill/notice states. */
  onDismiss?: () => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [panelMax, setPanelMax] = useState<number | null>(null);

  // §1.1 — measure the real gap between the bar and the opposite canvas edge, so
  // the attached panel scrolls inside a true max-height instead of a magic 380.
  useIsoLayoutEffect(() => {
    if (variant !== 'dock' || !panel) return;
    const measure = () => {
      const bar = barRef.current;
      const bounds = boundsRef?.current;
      if (!bar || !bounds) return;
      const b = bar.getBoundingClientRect();
      const r = bounds.getBoundingClientRect();
      const GAP = 12;
      const avail = edge === 'bottom' ? b.top - r.top - GAP : r.bottom - b.bottom - GAP;
      const next = Math.max(120, Math.round(avail));
      setPanelMax((cur) => (cur === null || Math.abs(cur - next) > 1 ? next : cur));
    };
    measure();
    const bounds = boundsRef?.current;
    const ro = bounds ? new ResizeObserver(measure) : null;
    if (bounds && ro) ro.observe(bounds);
    window.addEventListener('resize', measure);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [variant, panel, edge, boundsRef, name]);

  if (variant === 'sheet') {
    // Phone bottom sheet (§1.3) — the dock's sibling density. Fixed to the thumb
    // zone; the whole sheet scrolls, so no measured max-height is needed.
    return (
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className={`fixed inset-x-0 bottom-0 z-50 border-t bg-cream/95 px-4 pt-3 shadow-[0_-4px_20px_rgba(0,0,0,0.12)] backdrop-blur-sm ${TONE_RING[tone]}`}
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-md flex-col gap-2.5">
          {name !== undefined ? (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink/55">
              {glyph}
              <span className="min-w-0 flex-1 truncate">{name}</span>
              {onDismiss ? (
                <button
                  type="button"
                  onClick={onDismiss}
                  aria-label="Close"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink/40 hover:bg-ink/5"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ) : null}
          {panel}
          {children}
        </div>
      </div>
    );
  }

  const barBlock = (
    <div
      ref={barRef}
      className={`pointer-events-auto flex max-w-[min(92vw,32rem)] items-center gap-1.5 rounded-xl border bg-cream/95 px-1.5 py-1 shadow-lg backdrop-blur-sm ${TONE_RING[tone]}`}
    >
      {glyph !== undefined || name !== undefined ? (
        <span className="ml-1 flex min-w-0 max-w-[8rem] shrink items-center gap-1 text-ink/55">
          {glyph}
          {name !== undefined ? (
            <span className="min-w-0 truncate text-[11px] font-medium">{name}</span>
          ) : null}
        </span>
      ) : null}
      {children}
    </div>
  );

  const panelBlock = panel ? (
    <div
      className="pointer-events-auto w-[min(92vw,22rem)] overflow-y-auto rounded-xl"
      style={panelMax !== null ? { maxHeight: `${panelMax}px` } : undefined}
    >
      {panel}
    </div>
  ) : null;

  // Bottom edge → panel above the bar (stack: panel, bar). Top edge → panel below
  // the bar (stack: bar, panel). The container is anchored to the occupied edge.
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 z-30 flex flex-col items-center gap-1.5 px-4 ${
        edge === 'bottom' ? 'bottom-4' : 'top-4'
      }`}
    >
      {edge === 'bottom' ? (
        <>
          {panelBlock}
          {barBlock}
        </>
      ) : (
        <>
          {barBlock}
          {panelBlock}
        </>
      )}
    </div>
  );
}

/**
 * A tiny footprint glyph per table shape family — the dock's type echo (§1.1)
 * and the shape picker's swatch (§4). Stroke inherits `currentColor`.
 */
export function ShapeGlyph({
  shape,
  className,
}: {
  shape: TableShapeHint;
  className?: string;
}) {
  const common = {
    className,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    'aria-hidden': true,
  } as const;
  switch (shape) {
    case 'round':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.4" />
        </svg>
      );
    case 'long_banquet':
      return (
        <svg {...common}>
          <rect x="1.5" y="5" width="13" height="6" rx="1.4" />
        </svg>
      );
    case 'family_head':
      return (
        <svg {...common}>
          <rect x="3" y="4.5" width="10" height="7" rx="1.2" />
          <line x1="3" y1="8" x2="13" y2="8" />
        </svg>
      );
    case 'sweetheart':
      return (
        <svg {...common}>
          <rect x="4" y="4.5" width="8" height="7" rx="3" />
        </svg>
      );
    case 'serpentine':
      return (
        <svg {...common}>
          <path d="M1.5 10c2-4 4.5-4 6.5 0s4.5 4 6.5 0" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.4" />
        </svg>
      );
  }
}

const SHAPE_FAMILIES: ReadonlyArray<{ label: string; shape: TableShapeHint }> = [
  { label: 'Round', shape: 'round' },
  { label: 'Long banquet', shape: 'long_banquet' },
  { label: 'Family head', shape: 'family_head' },
  { label: 'Sweetheart', shape: 'sweetheart' },
  { label: 'Serpentine', shape: 'serpentine' },
];

const capacityOf = (t: TableType): number =>
  TABLE_TYPE_CATALOG.find((c) => c.type === t)?.defaultCapacity ?? 10;

/**
 * §4 — the visual shape picker. Replaces the instant-swap native `<select>`. The
 * 13-type catalog in its 5 family groups, each a footprint glyph + mono capacity,
 * the current type ringed. Selecting a type previews it (`onPreview`) and shows a
 * one-line impact readout. Commit gate: a single tap applies when the table is
 * empty; an explicit Apply / Cancel appears when anyone is seated — `onApply`
 * fires only on Apply, never on select. Reused at create time via `mode='create'`.
 */
export function ShapePicker({
  value,
  seatedCount = 0,
  mode = 'change',
  onApply,
  onPreview,
  onCancel,
}: {
  value: TableType;
  seatedCount?: number;
  mode?: 'change' | 'create';
  onApply: (t: TableType) => void;
  onPreview?: (t: TableType | null) => void;
  onCancel?: () => void;
}) {
  // In change mode with seated guests, a pick is staged until Apply. Empty tables
  // (and create mode) apply on the single tap.
  const [pending, setPending] = useState<TableType | null>(null);
  const gated = mode === 'change' && seatedCount > 0;

  const choose = (t: TableType) => {
    if (t === value && !pending) return;
    if (gated) {
      setPending(t);
      onPreview?.(t);
    } else {
      onApply(t);
    }
  };

  const shown = pending ?? value;
  const newCap = capacityOf(shown);
  const impact =
    pending && seatedCount > newCap
      ? `${seatedCount - newCap} guest${seatedCount - newCap === 1 ? '' : 's'} will need reseating`
      : pending
        ? `keeps all ${seatedCount} seated`
        : null;

  return (
    <div className="w-full rounded-xl border border-ink/10 bg-ink/[0.03] p-2">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
          {mode === 'create' ? 'Table shape' : 'Change shape'}
        </span>
        {onCancel ? (
          <button
            type="button"
            onClick={() => {
              onPreview?.(null);
              onCancel();
            }}
            aria-label="Close shape picker"
            className="rounded-md p-1 text-ink/40 hover:bg-ink/5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto pr-0.5">
        {SHAPE_FAMILIES.map((fam) => {
          const types = TABLE_TYPE_CATALOG.filter((t) => t.shapeHint === fam.shape);
          if (types.length === 0) return null;
          return (
            <div key={fam.shape}>
              <p className="px-1 pb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink/40">
                {fam.label}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {types.map((t) => {
                  const active = shown === t.type;
                  return (
                    <button
                      key={t.type}
                      type="button"
                      onClick={() => choose(t.type)}
                      aria-pressed={active}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition ${
                        active
                          ? 'border-terracotta bg-terracotta/[0.06] text-ink'
                          : 'border-ink/12 text-ink/70 hover:border-terracotta/50 hover:bg-ink/[0.03]'
                      }`}
                    >
                      <ShapeGlyph
                        shape={t.shapeHint}
                        className={`h-4 w-4 shrink-0 ${active ? 'text-terracotta-700' : 'text-ink/45'}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium leading-tight">
                          {t.label}
                        </span>
                        <span className="block font-mono text-[9px] text-ink/45">
                          {t.defaultCapacity} seats
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {gated && pending ? (
        <div className="mt-2 border-t border-ink/10 pt-2">
          <p
            className={`mb-2 px-1 text-[11px] leading-snug ${
              seatedCount > newCap ? 'text-warn-800' : 'text-ink/60'
            }`}
          >
            {value === pending
              ? `Already a ${TABLE_TYPE_LABEL[pending].toLowerCase()}.`
              : `Change to ${TABLE_TYPE_LABEL[pending].toLowerCase()} — ${impact}.`}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPending(null);
                onPreview?.(null);
              }}
              className="rounded-lg border border-ink/15 bg-cream px-3 py-1.5 text-xs text-ink hover:bg-ink/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onPreview?.(null);
                if (pending !== value) onApply(pending);
                setPending(null);
              }}
              disabled={pending === value}
              className="rounded-lg bg-terracotta px-3 py-1.5 text-xs font-semibold text-cream hover:bg-terracotta-600 disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Re-export for callers that want the shape family of a live table type. */
export { shapeHintFor };
