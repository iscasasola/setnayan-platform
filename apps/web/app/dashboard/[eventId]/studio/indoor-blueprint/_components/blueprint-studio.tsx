'use client';

import { useRef, useState, useTransition } from 'react';
import { DoorOpen, Save } from 'lucide-react';
import type { EventTableRow } from '@/lib/seating';
import { clampPct, type EntrancePos } from '@/lib/indoor-blueprint';
import { WayfindingMap } from '@/app/_components/wayfinding-map';

/**
 * Couple-facing Indoor Blueprint studio. Two jobs:
 *   1. Place the venue entrance — drag the entrance handle onto the floor plan,
 *      then Save. Persists via the saveEntrance server action.
 *   2. Preview a guest's view — pick a seated guest and see the exact
 *      "find your table" map that guest will see on the day, highlighted table
 *      + path from the entrance.
 *
 * The map itself is the shared read-only <WayfindingMap>; this wrapper adds the
 * draggable entrance handle (the only interactive element) and the preview
 * selector. Drag math mirrors the seating FloorPlan's pointer handlers.
 */

type GuestOption = { tableId: string; guestName: string; tableLabel: string };

type Props = {
  eventId: string;
  tables: EventTableRow[];
  initialEntrance: EntrancePos;
  guestOptions: GuestOption[];
  saveAction: (formData: FormData) => Promise<void>;
};

export function BlueprintStudio({
  eventId,
  tables,
  initialEntrance,
  guestOptions,
  saveAction,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [entrance, setEntrance] = useState<EntrancePos>(initialEntrance);
  const [dragging, setDragging] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  // Preview target: default to the first seated guest's table, if any.
  const [targetTableId, setTargetTableId] = useState<string | null>(
    guestOptions[0]?.tableId ?? null,
  );

  const onCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setEntrance({ x: clampPct(x), y: clampPct(y) });
  };

  const onCanvasPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    setDirty(true);
  };

  const save = () => {
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('entrance_x', String(entrance.x));
    fd.set('entrance_y', String(entrance.y));
    startTransition(async () => {
      await saveAction(fd);
      setDirty(false);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          <DoorOpen aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Drag the entrance handle onto your floor plan
        </p>
        <div className="flex items-center gap-2">
          {dirty ? (
            <span className="font-mono text-[11px] text-warn-700">Unsaved</span>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-mulberry px-3 py-1.5 text-xs font-medium text-cream transition-colors hover:bg-mulberry-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" strokeWidth={2} />
            {pending ? 'Saving…' : 'Save entrance'}
          </button>
        </div>
      </div>

      {/* Map + draggable entrance handle overlaid on the same coordinate box.
          The handle sits in its own absolutely-positioned layer above the
          read-only map; everything else (tables, path, stage) comes from
          WayfindingMap and is non-interactive. */}
      <div
        ref={canvasRef}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerLeave={() => dragging && setDragging(false)}
        className="relative touch-none"
      >
        <WayfindingMap tables={tables} entrance={entrance} targetTableId={targetTableId} />

        {/* Draggable handle — sits exactly over the entrance marker drawn by
            WayfindingMap. The map's marker is the visual; this is the hit
            target. */}
        <button
          type="button"
          aria-label="Drag to set the venue entrance"
          onPointerDown={(e) => {
            e.preventDefault();
            setDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          className={`absolute z-30 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full ${
            dragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{ left: `${entrance.x}%`, top: `${entrance.y - 6}%` }}
        />
      </div>

      {guestOptions.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-ink/10 bg-cream p-4 sm:flex-row sm:items-center sm:justify-between">
          <label
            htmlFor="preview-guest"
            className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55"
          >
            Preview a guest&rsquo;s view
          </label>
          <select
            id="preview-guest"
            value={targetTableId ?? ''}
            onChange={(e) => setTargetTableId(e.target.value || null)}
            className="input-field max-w-xs text-sm"
          >
            {guestOptions.map((g, i) => (
              <option key={`${g.tableId}-${i}`} value={g.tableId}>
                {g.guestName} → {g.tableLabel}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-ink/15 bg-cream p-4 text-sm text-ink/55">
          Seat your guests on the{' '}
          <a
            href={`/dashboard/${eventId}/seating`}
            className="font-medium text-terracotta underline-offset-4 hover:underline"
          >
            seating chart
          </a>{' '}
          and you&rsquo;ll be able to preview each guest&rsquo;s &ldquo;find your
          table&rdquo; map here.
        </p>
      )}
    </div>
  );
}
