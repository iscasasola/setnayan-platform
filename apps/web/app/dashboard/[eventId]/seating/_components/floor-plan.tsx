'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import type { EventTableRow, TableType } from '@/lib/seating';

type AssignmentSummary = { table_id: string; count: number };

type Props = {
  eventId: string;
  tables: EventTableRow[];
  assignmentCounts: AssignmentSummary[];
  saveAction: (formData: FormData) => Promise<void>;
};

type LocalPos = { x: number; y: number };

type ShapeHint = 'circle' | 'long_banquet' | 'family_head' | 'sweetheart' | 'serpentine';

// Maps canonical TableType (locked 2026-05-09, realigned 2026-05-22) onto a
// rendering hint. Serpentine renders as a wedge-shaped band per the locked
// donut-segment geometry — full chair-level visualization deferred until the
// 2026-05-09 spec's chair-circle interaction work ships.
function shapeFor(type: TableType): ShapeHint {
  if (type.startsWith('round_')) return 'circle';
  if (type.startsWith('long_banquet_')) return 'long_banquet';
  if (type.startsWith('family_head_')) return 'family_head';
  if (type === 'sweetheart_2') return 'sweetheart';
  if (type.startsWith('serpentine_')) return 'serpentine';
  // Defensive fallback — all 13 canonical types are covered above.
  return 'circle';
}

/** Default grid position when x/y haven't been set yet. */
function defaultGrid(index: number, total: number): LocalPos {
  const cols = Math.max(2, Math.ceil(Math.sqrt(total)));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const rows = Math.max(1, Math.ceil(total / cols));
  // Avoid the top 18% (reserved for the stage banner).
  return {
    x: ((col + 0.5) / cols) * 100,
    y: 20 + ((row + 0.5) / rows) * 75,
  };
}

export function FloorPlan({ eventId, tables, assignmentCounts, saveAction }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const fillById = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of assignmentCounts) m.set(a.table_id, a.count);
    return m;
  }, [assignmentCounts]);

  const initialPositions = useMemo<Record<string, LocalPos>>(() => {
    const out: Record<string, LocalPos> = {};
    tables.forEach((t, i) => {
      out[t.table_id] =
        t.x_pos !== null && t.y_pos !== null
          ? { x: Number(t.x_pos), y: Number(t.y_pos) }
          : defaultGrid(i, tables.length);
    });
    return out;
  }, [tables]);

  const [positions, setPositions] = useState<Record<string, LocalPos>>(initialPositions);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);

  // Re-seed positions if the table list changes (added/removed).
  useEffect(() => {
    setPositions((prev) => {
      const next: Record<string, LocalPos> = {};
      tables.forEach((t, i) => {
        if (prev[t.table_id]) {
          next[t.table_id] = prev[t.table_id]!;
        } else if (t.x_pos !== null && t.y_pos !== null) {
          next[t.table_id] = { x: Number(t.x_pos), y: Number(t.y_pos) };
        } else {
          next[t.table_id] = defaultGrid(i, tables.length);
        }
      });
      return next;
    });
  }, [tables]);

  const onPointerDown =
    (tableId: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setDragging(tableId);
      e.currentTarget.setPointerCapture(e.pointerId);
    };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPositions((p) => ({
      ...p,
      [dragging]: { x: Math.max(3, Math.min(97, x)), y: Math.max(3, Math.min(97, y)) },
    }));
  };

  const onPointerUp = async () => {
    if (!dragging) return;
    const id = dragging;
    setDragging(null);
    setDirty((d) => new Set(d).add(id));
  };

  const saveOne = async (tableId: string) => {
    const pos = positions[tableId];
    if (!pos) return;
    setSaving(tableId);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('table_id', tableId);
    fd.set('x_pos', String(pos.x));
    fd.set('y_pos', String(pos.y));
    try {
      await saveAction(fd);
      setDirty((d) => {
        const next = new Set(d);
        next.delete(tableId);
        return next;
      });
    } finally {
      setSaving(null);
    }
  };

  const saveAll = async () => {
    const ids = Array.from(dirty);
    for (const id of ids) {
      await saveOne(id);
    }
  };

  if (tables.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Floor plan
        </h2>
        <div className="flex items-center gap-2">
          {dirty.size > 0 ? (
            <span className="font-mono text-[11px] text-amber-700">
              {dirty.size} unsaved {dirty.size === 1 ? 'move' : 'moves'}
            </span>
          ) : null}
          <button
            type="button"
            onClick={saveAll}
            disabled={dirty.size === 0 || saving !== null}
            className="inline-flex items-center gap-1.5 rounded-md bg-terracotta px-3 py-1.5 text-xs font-medium text-cream transition-colors hover:bg-terracotta-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" strokeWidth={2} />
            {saving ? 'Saving…' : 'Save layout'}
          </button>
        </div>
      </div>

      <div
        ref={canvasRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          if (dragging) setDragging(null);
        }}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-ink/15 bg-cream"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(26,26,26,0.06) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      >
        <StageBanner />

        {tables.map((t) => {
          const pos = positions[t.table_id] ?? { x: 50, y: 50 };
          const filled = fillById.get(t.table_id) ?? 0;
          const shape = shapeFor(t.table_type);
          const overfilled = filled > t.capacity;
          const exactlyFull = filled === t.capacity && filled > 0;
          const isDragging = dragging === t.table_id;
          const isDirty = dirty.has(t.table_id);

          return (
            <button
              key={t.table_id}
              type="button"
              onPointerDown={onPointerDown(t.table_id)}
              aria-label={`${t.table_label} — drag to reposition`}
              className={`absolute -translate-x-1/2 -translate-y-1/2 touch-none select-none transition-transform ${
                isDragging ? 'z-20 scale-105 cursor-grabbing' : 'z-10 cursor-grab'
              }`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <TableShape
                shape={shape}
                label={t.table_label}
                filled={filled}
                capacity={t.capacity}
                overfilled={overfilled}
                exactlyFull={exactlyFull}
                dirty={isDirty}
              />
            </button>
          );
        })}
      </div>

      <p className="text-xs text-ink/55">
        Drag any table to reposition. Save layout commits your moves to the database.
      </p>
    </section>
  );
}

function StageBanner() {
  return (
    <div
      aria-hidden
      className="absolute left-1/2 top-3 -translate-x-1/2 rounded-md border border-ink/20 bg-ink/[0.04] px-6 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-ink/70"
    >
      Stage / Head
    </div>
  );
}

function TableShape({
  shape,
  label,
  filled,
  capacity,
  overfilled,
  exactlyFull,
  dirty,
}: {
  shape: ReturnType<typeof shapeFor>;
  label: string;
  filled: number;
  capacity: number;
  overfilled: boolean;
  exactlyFull: boolean;
  dirty: boolean;
}) {
  const tone = overfilled
    ? 'border-rose-500 bg-rose-50'
    : exactlyFull
      ? 'border-emerald-500 bg-emerald-50'
      : 'border-ink/30 bg-cream';

  // Family head sized wider than long banquet per 2026-05-09 spec lock
  // ("long rectangulars, not ovals — sized larger than the standard long banquet").
  // Serpentine uses asymmetric border-radius to suggest the donut-wedge curve;
  // proper chair-level quarter-donut SVG geometry is a follow-up alongside the
  // chair-circle interaction work from the same spec lock.
  const dimensions =
    shape === 'circle'
      ? 'h-20 w-20 rounded-full'
      : shape === 'long_banquet'
        ? 'h-12 w-32 rounded-md'
        : shape === 'family_head'
          ? 'h-14 w-40 rounded-md'
          : shape === 'sweetheart'
            ? 'h-14 w-14 rounded-full'
            : 'h-16 w-32 rounded-tr-[2rem] rounded-br-[2rem] rounded-tl-md rounded-bl-md';

  return (
    <div
      className={`flex flex-col items-center justify-center gap-0.5 border-2 px-2 text-center shadow-sm transition-colors ${dimensions} ${tone}`}
    >
      <span className="line-clamp-1 max-w-full text-[10px] font-semibold text-ink">
        {label}
      </span>
      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink/55">
        {filled}/{capacity}
        {dirty ? ' •' : ''}
      </span>
    </div>
  );
}
