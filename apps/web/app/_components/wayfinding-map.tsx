'use client';

import { useMemo } from 'react';
import { fitFloorTransform, type EventTableRow } from '@/lib/seating';
import {
  type EntrancePos,
  wayfindingPath,
  wayfindingPosition,
  wayfindingShapeFor,
} from '@/lib/indoor-blueprint';

/**
 * apps/web/app/_components/wayfinding-map.tsx
 *
 * Read-only floor-plan renderer for the Indoor Blueprint "find your table"
 * wayfinding (closes the partial INDOOR_BLUEPRINT SKU). Renders the SAME
 * canonical layout the seating editor (FloorPlan) arranges — stage banner at
 * top, tables positioned by x_pos/y_pos on a 0–100 grid, the conventional
 * table shapes — but non-interactive, with one table highlighted as the
 * guest's destination, an entrance marker, and a drawn path from the entrance
 * to the target table.
 *
 * Shared by:
 *   • the couple's preview (/dashboard/[eventId]/studio/indoor-blueprint)
 *   • the guest's find-my-table view (/[slug]/find-my-table)
 *
 * 'use client' only because it draws an interactive-free but
 * SVG/aspect-ratio-sensitive map; it carries no client state or effects, so
 * it's cheap to mount. NO DB access — the caller (a gated surface) fetches
 * tables/assignments and passes them in.
 *
 * Palette: Clean Editorial via legacy classes / CSS vars (ink · terracotta ·
 * cream · mulberry · emerald accent), html.dark-aware — never hardcoded hex.
 * The terracotta path + emerald target are the two visual anchors a guest
 * scans first.
 */

type Props = {
  tables: EventTableRow[];
  entrance: EntrancePos;
  /** table_id the guest is seated at, or null (couple preview with no target). */
  targetTableId: string | null;
  /**
   * `'theme'` — the couple's look, for `/[slug]/find-seat` (owner 2026-09-27,
   * prototype `find_your_seat_2026-09-27.html`): the target in the theme's
   * accent with a YOU pin instead of the app's emerald, a translucent card over
   * the theme's ground, the theme's radius. `'plain'` (default) is byte-for-byte
   * the map every other caller has always drawn.
   */
  look?: 'plain' | 'theme';
  /** Drawn faintly with no table lit — a guest who is not seated yet (A4). */
  faint?: boolean;
};

export function WayfindingMap({ tables, entrance, targetTableId, look = 'plain', faint = false }: Props) {
  const themed = look === 'theme';
  const positioned = useMemo(
    () =>
      tables.map((t, i) => ({
        table: t,
        pos: wayfindingPosition(t, i, tables.length),
        shape: wayfindingShapeFor(t.table_type),
      })),
    [tables],
  );

  const target = positioned.find((p) => p.table.table_id === targetTableId) ?? null;

  // Path points (0–100 grid) → an SVG polyline string. Only drawn when there's
  // a target to walk to.
  const pathPoints = target ? wayfindingPath(entrance, target.pos) : null;

  // The free auto-grow board can save table positions beyond 0–100; fit such a
  // spread layout back into the 0–100 map box (no-op for in-bounds layouts).
  const tf = useMemo(
    () =>
      fitFloorTransform([
        ...positioned.map((p) => p.pos),
        entrance,
        ...(pathPoints ?? []),
      ]),
    [positioned, entrance, pathPoints],
  );
  const tEntrance = tf(entrance.x, entrance.y);
  const polyline = pathPoints
    ? pathPoints.map((p) => { const q = tf(p.x, p.y); return `${q.x},${q.y}`; }).join(' ')
    : null;

  return (
    <div
      className={
        themed
          ? 'relative aspect-[4/3] w-full overflow-hidden rounded-[var(--hub-radius,1rem)] border border-ink/25 bg-cream/60'
          : 'relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-ink/15 bg-cream'
      }
      style={{
        backgroundImage:
          'radial-gradient(circle at 1px 1px, rgba(26,26,26,0.06) 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Stage / head — pinned at the top, matching the editor's StageBanner. */}
      <div
        aria-hidden
        className={
          themed
            ? 'absolute left-1/2 top-3 -translate-x-1/2 rounded-[var(--hub-radius,0.375rem)] border border-dashed border-ink/40 bg-ink/[0.06] px-8 py-1 text-xs uppercase tracking-[0.22em] text-ink/75'
            : 'absolute left-1/2 top-3 -translate-x-1/2 rounded-md border border-ink/20 bg-ink/[0.04] px-6 py-1.5 font-mono text-xs uppercase tracking-[0.12em] text-ink/70'
        }
      >
        {themed ? 'Stage' : 'Stage / Head'}
      </div>

      {/* Path overlay — a full-canvas SVG in the 0–100 coordinate space so the
          polyline lines up exactly with the percentage-positioned table
          markers. preserveAspectRatio="none" lets the SVG stretch to the 4:3
          box so 0–100 maps to the container edges. */}
      {polyline ? (
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <polyline
            points={polyline}
            fill="none"
            stroke="currentColor"
            className="text-terracotta"
            strokeWidth={1.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="2.4 2"
          />
        </svg>
      ) : null}

      {/* Entrance marker. */}
      {themed ? (
        // The prototype's door: a small ring with its label BESIDE it, so a door
        // at the bottom edge (the default, y 96) is not cut off by the frame.
        // Held just inside the edge; the path's last dash hides under the ring.
        <div
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${tEntrance.x}%`, top: `${Math.min(tEntrance.y, 94)}%` }}
        >
          <span className="relative flex h-[26px] w-[26px] items-center justify-center rounded-full border-[1.5px] border-terracotta bg-cream text-terracotta-700">
            <DoorIcon />
            <span className="absolute left-full top-1/2 ml-1.5 -translate-y-1/2 whitespace-nowrap text-xs text-ink/80">
              Entrance
            </span>
          </span>
        </div>
      ) : (
      <div
        className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${tEntrance.x}%`, top: `${tEntrance.y}%` }}
      >
        <div className="flex flex-col items-center gap-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-terracotta bg-cream text-terracotta-700 shadow-sm">
            <DoorIcon />
          </span>
          <span className="rounded bg-cream/90 px-1.5 py-0.5 text-xs font-semibold text-ink/75 shadow-sm">
            Entrance
          </span>
        </div>
      </div>
      )}

      {/* Tables — non-interactive. The target table glows emerald; the rest are
          muted so the guest's eye lands on their destination first. */}
      {positioned.map(({ table, pos, shape }) => {
        const isTarget = table.table_id === targetTableId;
        const q = tf(pos.x, pos.y);
        return (
          <div
            key={table.table_id}
            className={`absolute -translate-x-1/2 -translate-y-1/2 ${isTarget ? 'z-20' : 'z-0'}`}
            style={{ left: `${q.x}%`, top: `${q.y}%` }}
          >
            <TableMarker label={table.table_label} shape={shape} isTarget={isTarget} themed={themed} faint={faint} />
          </div>
        );
      })}
    </div>
  );
}

function TableMarker({
  label,
  shape,
  isTarget,
  themed = false,
  faint = false,
}: {
  label: string;
  shape: ReturnType<typeof wayfindingShapeFor>;
  isTarget: boolean;
  themed?: boolean;
  faint?: boolean;
}) {
  // Same dimension hints as the editor's TableShape so the read-only map
  // matches the couple's arrangement visually.
  const dimensions =
    shape === 'circle'
      ? 'h-16 w-16 rounded-full'
      : shape === 'long_banquet'
        ? 'h-10 w-28 rounded-md'
        : shape === 'family_head'
          ? 'h-12 w-36 rounded-md'
          : shape === 'sweetheart'
            ? 'h-12 w-12 rounded-full'
            : 'h-14 w-28 rounded-tr-[2rem] rounded-br-[2rem] rounded-tl-md rounded-bl-md';

  if (themed) {
    // The theme's own ink for "you", never the app's emerald: the accent fill
    // with its label ink (the pair the theme measures for a button), falling
    // back to ink on paper for an event with no theme.
    const themedTone = isTarget
      ? 'border-[var(--hub-accent,rgb(var(--color-ink)))] bg-[var(--hub-accent,rgb(var(--color-ink)))] text-[var(--hub-accent-ink,rgb(var(--color-cream)))] shadow-md'
      : faint
        ? 'border-dashed border-ink/35 bg-transparent text-ink/55'
        : 'border-ink/45 bg-cream/75 text-ink/70';
    return (
      <div className="relative flex flex-col items-center">
        {isTarget ? (
          <span
            aria-hidden
            className="absolute -top-7 flex flex-col items-center text-[0.625rem] font-bold uppercase leading-none tracking-[0.2em] text-[var(--hub-accent,rgb(var(--color-ink)))]"
          >
            You
            <svg width="12" height="14" viewBox="0 0 24 28" className="mt-0.5 fill-current">
              <path d="M12 0C5.4 0 0 5.2 0 11.6 0 20.3 12 28 12 28s12-7.7 12-16.4C24 5.2 18.6 0 12 0z" />
              <circle cx="12" cy="11.5" r="4" className="fill-cream" />
            </svg>
          </span>
        ) : null}
        <div
          className={`flex items-center justify-center border px-1.5 text-center ${dimensions} ${themedTone}`}
        >
          <span className={`line-clamp-2 max-w-full leading-tight ${isTarget ? 'text-xs font-bold' : 'text-xs'}`}>
            {label}
          </span>
          {isTarget ? <span className="sr-only">, your table</span> : null}
        </div>
      </div>
    );
  }

  const tone = isTarget
    ? 'border-success-500 bg-success-50 ring-2 ring-success-400/60'
    : 'border-ink/20 bg-cream/70';

  return (
    <div
      className={`flex flex-col items-center justify-center gap-0.5 border-2 px-1.5 text-center shadow-sm ${dimensions} ${tone}`}
    >
      <span
        className={`line-clamp-2 max-w-full font-semibold leading-tight ${
          isTarget ? 'text-xs text-success-900' : 'text-xs text-ink/60'
        }`}
      >
        {label}
      </span>
      {isTarget ? (
        <span className="text-xs font-bold leading-tight text-success-700">
          You&rsquo;re here
        </span>
      ) : null}
    </div>
  );
}

function DoorIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13 4h3a2 2 0 0 1 2 2v14" />
      <path d="M2 20h3" />
      <path d="M13 20h9" />
      <path d="M10 12v.01" />
      <path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z" />
    </svg>
  );
}
