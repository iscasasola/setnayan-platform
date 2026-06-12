'use client';

import { useRef, useState } from 'react';
import { moveFloorObject } from '../actions';

/**
 * Drag-to-place pin canvas for an event area (cocktail garden, foyer) or the
 * reception room. Pointer-events drag with optimistic position; the save
 * fires once on drag end (verification economy — no per-move writes).
 * Read-only callers (delegate without seat_plan edit) still see pins; their
 * drag save fails silently server-side and the pin snaps back on refresh.
 */

export type CanvasPin = {
  object_id: string;
  label: string;
  object_type: string;
  x_pos: number;
  y_pos: number;
  vendor_name: string | null;
};

const TYPE_EMOJI: Record<string, string> = {
  booth: '📸',
  station: '🍡',
  bar: '🍹',
  photo_wall: '🖼️',
  dessert: '🍰',
  custom: '📍',
};

export function AreaCanvas({
  eventId,
  pins,
  aspect,
}: {
  eventId: string;
  pins: CanvasPin[];
  aspect: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(
    Object.fromEntries(pins.map((p) => [p.object_id, { x: p.x_pos, y: p.y_pos }])),
  );
  const dragging = useRef<string | null>(null);

  function pctFromEvent(e: React.PointerEvent): { x: number; y: number } | null {
    const el = ref.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)),
    };
  }

  function onPinDown(e: React.PointerEvent, id: string) {
    dragging.current = id;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onMove(e: React.PointerEvent) {
    const id = dragging.current;
    if (!id) return;
    const p = pctFromEvent(e);
    if (p) setPositions((prev) => ({ ...prev, [id]: p }));
  }

  function onUp() {
    const id = dragging.current;
    dragging.current = null;
    if (!id) return;
    const p = positions[id];
    if (p) void moveFloorObject(eventId, id, p.x, p.y);
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerUp={onUp}
      className="relative w-full touch-none overflow-hidden rounded-xl border border-dashed border-ink/20 bg-white/60"
      style={{ aspectRatio: `${aspect}` }}
    >
      {pins.length === 0 ? (
        <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-ink/40">
          No pins yet — add a booth below, then drag it where it belongs.
        </p>
      ) : null}
      {pins.map((p) => {
        const pos = positions[p.object_id] ?? { x: p.x_pos, y: p.y_pos };
        return (
          <button
            key={p.object_id}
            type="button"
            onPointerDown={(e) => onPinDown(e, p.object_id)}
            className="absolute flex max-w-32 -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center active:cursor-grabbing"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            title={p.vendor_name ? `${p.label} · ${p.vendor_name}` : p.label}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-terracotta/40 bg-terracotta/10 text-sm shadow-sm">
              {TYPE_EMOJI[p.object_type] ?? '📍'}
            </span>
            <span className="mt-0.5 max-w-full truncate rounded bg-white/85 px-1 text-[9px] font-medium leading-tight text-ink/75">
              {p.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
