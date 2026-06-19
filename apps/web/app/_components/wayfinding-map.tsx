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
};

export function WayfindingMap({ tables, entrance, targetTableId }: Props) {
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
      className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-ink/15 bg-cream"
      style={{
        backgroundImage:
          'radial-gradient(circle at 1px 1px, rgba(26,26,26,0.06) 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Stage / head — pinned at the top, matching the editor's StageBanner. */}
      <div
        aria-hidden
        className="absolute left-1/2 top-3 -translate-x-1/2 rounded-md border border-ink/20 bg-ink/[0.04] px-6 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-ink/70"
      >
        Stage / Head
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
      <div
        className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${tEntrance.x}%`, top: `${tEntrance.y}%` }}
      >
        <div className="flex flex-col items-center gap-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-terracotta bg-cream text-terracotta shadow-sm">
            <DoorIcon />
          </span>
          <span className="rounded bg-cream/90 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em] text-ink/70 shadow-sm">
            Entrance
          </span>
        </div>
      </div>

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
            <TableMarker label={table.table_label} shape={shape} isTarget={isTarget} />
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
}: {
  label: string;
  shape: ReturnType<typeof wayfindingShapeFor>;
  isTarget: boolean;
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

  const tone = isTarget
    ? 'border-success-500 bg-success-50 ring-2 ring-success-400/60'
    : 'border-ink/20 bg-cream/70';

  return (
    <div
      className={`flex flex-col items-center justify-center gap-0.5 border-2 px-1.5 text-center shadow-sm ${dimensions} ${tone}`}
    >
      <span
        className={`line-clamp-2 max-w-full text-[9px] font-semibold leading-tight ${
          isTarget ? 'text-success-900' : 'text-ink/55'
        }`}
      >
        {label}
      </span>
      {isTarget ? (
        <span className="font-mono text-[7px] uppercase tracking-[0.14em] text-success-700">
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
