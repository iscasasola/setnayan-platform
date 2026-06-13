'use client';

import { useRef, useState } from 'react';
import { Martini, Maximize2, Plus, Trash2, X } from 'lucide-react';
import { BOOTH_CATALOG, type BoothType } from '@/lib/seating';
import {
  deleteCocktailBooth,
  moveCocktailBooth,
  setCocktailArea,
  upsertCocktailBooth,
} from './actions';

type Booth = {
  booth_id: string;
  booth_type: BoothType;
  label: string;
  x: number;
  y: number;
  is_mine: boolean;
  vendor_name: string | null;
};

type Room = { label: string; x: number; y: number; w: number; h: number };

export type CocktailEditorData = {
  can_arrange: boolean;
  can_booth: boolean;
  venue: { width_m: number | null; length_m: number | null };
  cocktail: Room;
  stage: { x: number; y: number; w: number; h: number };
  dance: { x: number; y: number; w: number; h: number } | null;
  tables: Array<{
    table_id: string;
    label: string;
    table_type: string;
    x: number | null;
    y: number | null;
    rotation_deg: number;
    seated: number;
  }>;
  booths: Booth[];
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const isRound = (t: string) => t.startsWith('round') || t.startsWith('crescent');

type Drag =
  | { kind: 'room'; sx: number; sy: number; ox: number; oy: number; prev: Room }
  | { kind: 'resize'; sx: number; sy: number; ow: number; oh: number; ox: number; oy: number; prev: Room }
  | { kind: 'booth'; id: string; sx: number; sy: number; ox: number; oy: number; prevX: number; prevY: number };

export function CocktailEditor({ eventId, data }: { eventId: string; data: CocktailEditorData }) {
  const [room, setRoom] = useState<Room>(data.cocktail);
  const [booths, setBooths] = useState<Booth[]>(data.booths);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const roomRef = useRef<Room>(room);
  roomRef.current = room;

  const aspect =
    data.venue.width_m && data.venue.length_m ? data.venue.width_m / data.venue.length_m : 4 / 3;
  const canArrange = data.can_arrange;

  const rectPct = (clientX: number, clientY: number) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return null;
    return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100, r };
  };

  // Mirror the server clamp so a booth visually stays in the room while dragging.
  const intoRoom = (x: number, y: number, rm: Room) => ({
    x: clamp(x, rm.x - rm.w / 2, rm.x + rm.w / 2),
    y: clamp(y, rm.y - rm.h / 2, rm.y + rm.h / 2),
  });

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = rectPct(e.clientX, e.clientY);
    if (!p) return;
    const dx = ((e.clientX - d.sx) / p.r.width) * 100;
    const dy = ((e.clientY - d.sy) / p.r.height) * 100;
    if (d.kind === 'room') {
      setRoom((rm) => ({ ...rm, x: clamp(d.ox + dx, 0, 100), y: clamp(d.oy + dy, 0, 100) }));
    } else if (d.kind === 'resize') {
      const w = clamp(d.ow + dx, 4, 96);
      const h = clamp(d.oh + dy, 3, 96);
      setRoom((rm) => ({ ...rm, w, h, x: d.ox + (w - d.ow) / 2, y: d.oy + (h - d.oh) / 2 }));
    } else {
      const pos = intoRoom(d.ox + dx, d.oy + dy, roomRef.current);
      setBooths((bs) => bs.map((b) => (b.booth_id === d.id ? { ...b, x: pos.x, y: pos.y } : b)));
    }
  };

  const onPointerUp = async () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.kind === 'room' || d.kind === 'resize') {
      const rm = roomRef.current;
      const res = await setCocktailArea(eventId, rm.x, rm.y, rm.w, rm.h, rm.label);
      if (!res.ok) {
        setRoom(d.prev);
        setNotice(res.error);
      }
    } else {
      const b = booths.find((x) => x.booth_id === d.id);
      if (!b) return;
      const res = await moveCocktailBooth(eventId, d.id, b.x, b.y);
      if (!res.ok) {
        setBooths((bs) => bs.map((x) => (x.booth_id === d.id ? { ...x, x: d.prevX, y: d.prevY } : x)));
        setNotice(res.error);
      }
    }
  };

  const startRoom = (e: React.PointerEvent) => {
    if (!canArrange) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { kind: 'room', sx: e.clientX, sy: e.clientY, ox: room.x, oy: room.y, prev: room };
  };
  const startResize = (e: React.PointerEvent) => {
    if (!canArrange) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { kind: 'resize', sx: e.clientX, sy: e.clientY, ow: room.w, oh: room.h, ox: room.x, oy: room.y, prev: room };
  };
  const startBooth = (b: Booth) => (e: React.PointerEvent) => {
    if (!(b.is_mine || canArrange)) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { kind: 'booth', id: b.booth_id, sx: e.clientX, sy: e.clientY, ox: b.x, oy: b.y, prevX: b.x, prevY: b.y };
  };

  const addBooth = async (type: BoothType, label: string) => {
    setAdding(false);
    setNotice(null);
    const res = await upsertCocktailBooth(eventId, null, type, label, room.x, room.y);
    if (!res.ok || !res.boothId) {
      setNotice(res.ok ? 'Could not add the booth.' : res.error);
      return;
    }
    setBooths((bs) => [
      ...bs,
      { booth_id: res.boothId!, booth_type: type, label, x: room.x, y: room.y, is_mine: true, vendor_name: null },
    ]);
  };

  const removeBooth = async (b: Booth) => {
    if (!(b.is_mine || canArrange)) return;
    const prev = booths;
    setBooths((bs) => bs.filter((x) => x.booth_id !== b.booth_id));
    const res = await deleteCocktailBooth(eventId, b.booth_id);
    if (!res.ok) {
      setBooths(prev);
      setNotice(res.error);
    }
  };

  return (
    <div className="space-y-4">
      {notice ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Add-booth toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-terracotta/30 bg-terracotta/[0.06] px-3 py-1.5 text-sm font-medium text-terracotta hover:border-terracotta"
          >
            <Plus className="h-4 w-4" /> Add booth
          </button>
          {adding ? (
            <div className="absolute z-20 mt-1 w-52 rounded-xl border border-ink/15 bg-cream p-1.5 shadow-lg">
              {BOOTH_CATALOG.map((c) => (
                <button
                  key={c.type}
                  type="button"
                  onClick={() => addBooth(c.type, c.label)}
                  className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-ink hover:bg-terracotta/10"
                >
                  {c.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <p className="text-xs text-ink/50">
          {canArrange
            ? 'Drag the room to reposition it, the corner grip to resize, and booths to place them.'
            : 'Drag your booth to place it inside the room.'}
        </p>
      </div>

      {/* Blueprint canvas — one shared plan; reception is read-only context */}
      <div
        ref={canvasRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative w-full touch-none overflow-hidden rounded-2xl border border-ink/15 bg-cream"
        style={{ aspectRatio: `${aspect}` }}
      >
        {/* stage */}
        <div
          className="absolute flex items-center justify-center rounded-md bg-ink/[0.06] text-[9px] font-semibold uppercase tracking-wider text-ink/40"
          style={{
            left: `${data.stage.x - data.stage.w / 2}%`,
            top: `${data.stage.y - data.stage.h / 2}%`,
            width: `${data.stage.w}%`,
            height: `${data.stage.h}%`,
          }}
        >
          Stage
        </div>
        {data.dance ? (
          <div
            className="absolute rounded-md border border-dashed border-ink/15"
            style={{
              left: `${data.dance.x - data.dance.w / 2}%`,
              top: `${data.dance.y - data.dance.h / 2}%`,
              width: `${data.dance.w}%`,
              height: `${data.dance.h}%`,
            }}
          />
        ) : null}
        {/* reception tables — read-only context, counts only */}
        {data.tables
          .filter((t) => t.x !== null && t.y !== null)
          .map((t) => (
            <div
              key={t.table_id}
              className={`absolute flex h-[7%] min-h-7 w-[7%] min-w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center border border-ink/15 bg-white/70 text-[8px] text-ink/45 ${
                isRound(t.table_type) ? 'rounded-full' : 'rounded'
              }`}
              style={{ left: `${t.x}%`, top: `${t.y}%` }}
              title={`${t.label} · ${t.seated} seated`}
            >
              {t.label}
            </div>
          ))}

        {/* cocktail room — container (pointer-events-none body) */}
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${room.x - room.w / 2}%`,
            top: `${room.y - room.h / 2}%`,
            width: `${room.w}%`,
            height: `${room.h}%`,
          }}
        >
          <div className="h-full w-full rounded-xl border-2 border-dashed border-terracotta/50 bg-terracotta/[0.05]" />
          <span
            onPointerDown={startRoom}
            className={`pointer-events-auto absolute left-1.5 top-1.5 inline-flex select-none items-center gap-1 rounded-md border border-terracotta/40 bg-cream px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-terracotta shadow-sm ${
              canArrange ? 'cursor-grab' : ''
            }`}
          >
            <Martini className="h-3 w-3" />
            {room.label}
          </span>
          {canArrange ? (
            <button
              type="button"
              onPointerDown={startResize}
              aria-label="Resize cocktail area"
              className="pointer-events-auto absolute -bottom-2 -right-2 flex h-5 w-5 cursor-nwse-resize items-center justify-center rounded-md border-2 border-terracotta bg-cream text-terracotta shadow-sm"
            >
              <Maximize2 className="h-3 w-3 rotate-90" />
            </button>
          ) : null}
        </div>

        {/* booths */}
        {booths.map((b) => {
          const editable = b.is_mine || canArrange;
          return (
            <div
              key={b.booth_id}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${b.x}%`, top: `${b.y}%` }}
            >
              <span
                onPointerDown={startBooth(b)}
                title={b.vendor_name ? `${b.label} · ${b.vendor_name}` : b.label}
                className={`flex select-none items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold shadow-sm ${
                  b.is_mine
                    ? 'border-terracotta bg-terracotta text-cream'
                    : 'border-ink/25 bg-white/90 text-ink/70'
                } ${editable ? 'cursor-grab' : ''}`}
              >
                {b.label}
              </span>
              {editable ? (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => removeBooth(b)}
                  aria-label={`Remove ${b.label}`}
                  className="absolute -right-2 -top-2 rounded-full border border-ink/15 bg-cream p-0.5 text-ink/45 shadow-sm hover:text-rose-600"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-ink/45">
        Changes save as you go. The couple can turn vendor editing off at any time, and the
        reception layout is theirs alone — you only touch the cocktail area.
      </p>
    </div>
  );
}
