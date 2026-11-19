'use client';

import { useId, useRef, useState } from 'react';
import { Check, ChevronDown, Martini, Maximize2, Navigation, Pencil, Plus, RotateCw, Signpost, Trash2, X } from 'lucide-react';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { BOOTH_CATALOG, type BoothType } from '@/lib/seating';
import {
  deleteCocktailBooth,
  deleteSign,
  moveCocktailBooth,
  moveSign,
  setCocktailArea,
  upsertCocktailBooth,
  upsertSign,
} from './actions';

type Booth = {
  booth_id: string;
  booth_type: BoothType;
  label: string;
  offerings: string | null;
  x: number;
  y: number;
  is_mine: boolean;
  vendor_name: string | null;
};

type Sign = { sign_id: string; label: string; x: number; y: number; rotation_deg: number };

type Room = { label: string; linked: boolean; x: number; y: number; w: number; h: number };

export type CocktailEditorData = {
  can_arrange: boolean;
  can_booth: boolean;
  venue: { width_m: number | null; length_m: number | null };
  cocktail: Room;
  entrance: { x: number; y: number } | null;
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
  signs: Sign[];
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const isRound = (t: string) => t.startsWith('round') || t.startsWith('crescent');

// Closest point on the room rectangle's edge to an external point — used to draw
// the read-only doorway connector toward the cocktail room's nearest side.
const nearestEdge = (px: number, py: number, rm: Room) => ({
  x: clamp(px, rm.x - rm.w / 2, rm.x + rm.w / 2),
  y: clamp(py, rm.y - rm.h / 2, rm.y + rm.h / 2),
});

type Drag =
  | { kind: 'room'; sx: number; sy: number; ox: number; oy: number; prev: Room }
  | { kind: 'resize'; sx: number; sy: number; ow: number; oh: number; ox: number; oy: number; prev: Room }
  | { kind: 'booth'; id: string; sx: number; sy: number; ox: number; oy: number; prevX: number; prevY: number }
  | { kind: 'sign'; id: string; sx: number; sy: number; ox: number; oy: number; prevX: number; prevY: number };

export function CocktailEditor({ eventId, data }: { eventId: string; data: CocktailEditorData }) {
  const [room, setRoom] = useState<Room>(data.cocktail);
  const [booths, setBooths] = useState<Booth[]>(data.booths);
  const [signs, setSigns] = useState<Sign[]>(data.signs);
  const [notice, setNotice] = useState<string | null>(null);
  // The booth whose offerings copy is being edited (inline panel), + its draft.
  const [editingBooth, setEditingBooth] = useState<string | null>(null);
  const [offeringsDraft, setOfferingsDraft] = useState('');
  const offeringsTitleId = useId();
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const roomRef = useRef<Room>(room);
  roomRef.current = room;
  const signsRef = useRef<Sign[]>(signs);
  signsRef.current = signs;

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
      // Match the server band (vendor_set_cocktail_area clamps [-80,180]) so a
      // couple-docked room living just outside a reception wall isn't snapped
      // back on-canvas (and persisted) the instant a vendor grabs the handle.
      setRoom((rm) => ({ ...rm, x: clamp(d.ox + dx, -80, 180), y: clamp(d.oy + dy, -80, 180) }));
    } else if (d.kind === 'resize') {
      const w = clamp(d.ow + dx, 4, 96);
      const h = clamp(d.oh + dy, 3, 96);
      setRoom((rm) => ({ ...rm, w, h, x: d.ox + (w - d.ow) / 2, y: d.oy + (h - d.oh) / 2 }));
    } else if (d.kind === 'sign') {
      const x = clamp(d.ox + dx, 0, 100);
      const y = clamp(d.oy + dy, 0, 100);
      setSigns((ss) => ss.map((s) => (s.sign_id === d.id ? { ...s, x, y } : s)));
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
    } else if (d.kind === 'sign') {
      const s = signsRef.current.find((x) => x.sign_id === d.id);
      if (!s) return;
      const res = await moveSign(eventId, d.id, s.x, s.y, s.rotation_deg);
      if (!res.ok) {
        setSigns((ss) => ss.map((x) => (x.sign_id === d.id ? { ...x, x: d.prevX, y: d.prevY } : x)));
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
    setNotice(null);
    const res = await upsertCocktailBooth(eventId, null, type, label, room.x, room.y);
    if (!res.ok || !res.boothId) {
      setNotice(res.ok ? 'Could not add the booth.' : res.error);
      return;
    }
    setBooths((bs) => [
      ...bs,
      { booth_id: res.boothId!, booth_type: type, label, offerings: null, x: room.x, y: room.y, is_mine: true, vendor_name: null },
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

  // Open / close the inline "what does this booth serve" editor for a booth.
  const openOfferings = (b: Booth) => {
    if (!(b.is_mine || canArrange)) return;
    setEditingBooth(b.booth_id);
    setOfferingsDraft(b.offerings ?? '');
  };

  // Persist the offerings copy via the same upsert RPC (label + position are
  // re-sent unchanged; the RPC trims/caps to 280 server-side). Optimistic, with
  // rollback on failure — mirrors the drag/relabel paths.
  const saveOfferings = async (b: Booth) => {
    const next = offeringsDraft.trim().slice(0, 280);
    const value = next.length > 0 ? next : null;
    setEditingBooth(null);
    if (value === (b.offerings ?? null)) return;
    setBooths((bs) => bs.map((x) => (x.booth_id === b.booth_id ? { ...x, offerings: value } : x)));
    const res = await upsertCocktailBooth(eventId, b.booth_id, b.booth_type, b.label, b.x, b.y, value);
    if (!res.ok) {
      setBooths((bs) => bs.map((x) => (x.booth_id === b.booth_id ? { ...x, offerings: b.offerings } : x)));
      setNotice(res.error);
    }
  };

  // ── Wayfinding signs (ARRANGE-tier only) ───────────────────────────────────
  const startSign = (s: Sign) => (e: React.PointerEvent) => {
    if (!canArrange) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: 'sign',
      id: s.sign_id,
      sx: e.clientX,
      sy: e.clientY,
      ox: s.x,
      oy: s.y,
      prevX: s.x,
      prevY: s.y,
    };
  };

  const rotateSign = async (s: Sign) => {
    if (!canArrange) return;
    const next = (s.rotation_deg + 45) % 360;
    setSigns((ss) => ss.map((x) => (x.sign_id === s.sign_id ? { ...x, rotation_deg: next } : x)));
    const res = await moveSign(eventId, s.sign_id, s.x, s.y, next);
    if (!res.ok) {
      setSigns((ss) =>
        ss.map((x) => (x.sign_id === s.sign_id ? { ...x, rotation_deg: s.rotation_deg } : x)),
      );
      setNotice(res.error);
    }
  };

  const relabelSign = async (s: Sign) => {
    if (!canArrange) return;
    const label = window.prompt('Sign label', s.label)?.trim();
    if (!label || label === s.label) return;
    setSigns((ss) => ss.map((x) => (x.sign_id === s.sign_id ? { ...x, label } : x)));
    const res = await upsertSign(eventId, s.sign_id, label, s.x, s.y, s.rotation_deg);
    if (!res.ok) {
      setSigns((ss) => ss.map((x) => (x.sign_id === s.sign_id ? { ...x, label: s.label } : x)));
      setNotice(res.error);
    }
  };

  const removeSign = async (s: Sign) => {
    if (!canArrange) return;
    const prev = signs;
    setSigns((ss) => ss.filter((x) => x.sign_id !== s.sign_id));
    const res = await deleteSign(eventId, s.sign_id);
    if (!res.ok) {
      setSigns(prev);
      setNotice(res.error);
    }
  };

  const addSign = async () => {
    if (!canArrange) return;
    setNotice(null);
    const x = room.x;
    const y = clamp(room.y + room.h / 2 + 4, 0, 100);
    const res = await upsertSign(eventId, null, 'Restrooms', x, y, 0);
    if (!res.ok || !res.signId) {
      setNotice(res.ok ? 'Could not add the sign.' : res.error);
      return;
    }
    setSigns((ss) => [...ss, { sign_id: res.signId!, label: 'Restrooms', x, y, rotation_deg: 0 }]);
  };

  return (
    <div className="space-y-4">
      {notice ? (
        <div role="alert" className="flex min-h-11 items-center justify-between gap-3 text-[14px]" style={{ color: 'rgb(var(--color-danger))' }}>
          <span>{notice}</span>
          <ActionButton tone="neutral" quiet iconOnly icon={X} label="Dismiss" onClick={() => setNotice(null)} />
        </div>
      ) : null}

      {/* Add-booth toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <PickMenu
          label="Add booth"
          value=""
          buttonText="Add booth"
          options={BOOTH_CATALOG.map((c) => ({ key: c.type, label: c.label }))}
          onPick={(key) => {
            const c = BOOTH_CATALOG.find((x) => x.type === key);
            if (c) void addBooth(c.type, c.label);
          }}
          className={actionButtonClass('brand')}
          trigger={
            <>
              <Plus aria-hidden strokeWidth={1.9} />
              <span className="lbl">Add booth</span>
              <ChevronDown aria-hidden className="h-4 w-4" strokeWidth={1.9} />
            </>
          }
        />
        {canArrange ? (
          <ActionButton tone="brand" icon={Signpost} label="Add sign" onClick={addSign} />
        ) : null}
        <p className="text-[13px] text-[color:var(--m-slate-2)]">
          {canArrange
            ? 'Drag the room, the corner grip to resize, booths to place them, and signs to point guests.'
            : 'Drag your booth to place it inside the room.'}
        </p>
      </div>

      {/* Blueprint canvas — one shared plan; reception is read-only context */}
      <div
        ref={canvasRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative w-full touch-none overflow-hidden rounded-2xl border border-ink/15 bg-white/70"
        style={{ aspectRatio: `${aspect}` }}
      >
        {/* read-only doorway connector — only when the couple has docked this room
            to the venue entrance. Vendors never toggle the link; this is context. */}
        {room.linked && data.entrance ? (
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {(() => {
              const edge = nearestEdge(data.entrance.x, data.entrance.y, room);
              return (
                <line
                  x1={data.entrance.x}
                  y1={data.entrance.y}
                  x2={edge.x}
                  y2={edge.y}
                  stroke="rgb(var(--color-terracotta))"
                  strokeWidth={0.6}
                  strokeDasharray="2 1.5"
                  strokeOpacity={0.55}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })()}
          </svg>
        ) : null}
        {/* entrance marker — read-only context for the docked room */}
        {room.linked && data.entrance ? (
          <div
            aria-hidden
            className="pointer-events-none absolute z-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-terracotta/40 bg-terracotta/[0.08] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-terracotta-700"
            style={{ left: `${data.entrance.x}%`, top: `${data.entrance.y}%` }}
          >
            Entrance
          </div>
        ) : null}
        {/* stage */}
        <div
          className="absolute flex items-center justify-center rounded-md bg-ink/[0.06] text-[11px] font-semibold uppercase tracking-wider text-[color:var(--m-slate-2)]"
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
              className={`absolute flex h-[7%] min-h-7 w-[7%] min-w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center border border-ink/15 bg-white/70 text-[11px] text-[color:var(--m-slate-2)] ${
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
            className={`pointer-events-auto absolute left-1.5 top-1.5 inline-flex select-none items-center gap-1 rounded-md border border-terracotta/40 bg-white/70 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta-700 shadow-sm ${
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
              className="pointer-events-auto absolute -bottom-2 -right-2 flex h-5 w-5 cursor-nwse-resize items-center justify-center rounded-md border-2 border-terracotta bg-white/70 text-terracotta shadow-sm"
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
                title={
                  [b.label, b.vendor_name, b.offerings].filter(Boolean).join(' · ') || b.label
                }
                className={`flex select-none items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold shadow-sm ${
                  b.is_mine
                    ? 'border-terracotta bg-terracotta text-cream'
                    : 'border-ink/25 bg-white/90 text-ink'
                } ${editable ? 'cursor-grab' : ''}`}
              >
                {b.label}
              </span>
              {editable ? (
                <>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => openOfferings(b)}
                    aria-label={`Edit what ${b.label} serves`}
                    className="absolute -left-2 -top-2 rounded-full border border-ink/15 bg-white/70 p-0.5 text-[color:var(--m-slate-2)] shadow-sm hover:text-terracotta-700"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => removeBooth(b)}
                    aria-label={`Remove ${b.label}`}
                    className="absolute -right-2 -top-2 rounded-full border border-ink/15 bg-white/70 p-0.5 text-[color:var(--m-slate-2)] shadow-sm hover:text-danger-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </>
              ) : null}

            </div>
          );
        })}

        {/* wayfinding signs — ARRANGE-tier editable; booth-tier sees them read-only */}
        {signs.map((s) => (
          <div
            key={s.sign_id}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
          >
            <span
              onPointerDown={canArrange ? startSign(s) : undefined}
              onDoubleClick={canArrange ? () => relabelSign(s) : undefined}
              title={canArrange ? `${s.label} · double-click to rename` : s.label}
              className={`flex select-none items-center gap-1 rounded-md border border-terracotta/40 bg-white/70 px-2 py-1 text-[11px] font-semibold text-terracotta-700 shadow-sm ${
                canArrange ? 'cursor-grab' : ''
              }`}
            >
              <Navigation
                className="h-3 w-3"
                style={{ transform: `rotate(${s.rotation_deg}deg)` }}
              />
              {s.label}
            </span>
            {canArrange ? (
              <>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => rotateSign(s)}
                  aria-label={`Rotate ${s.label}`}
                  className="absolute -left-2 -top-2 rounded-full border border-ink/15 bg-white/70 p-0.5 text-[color:var(--m-slate-2)] shadow-sm hover:text-terracotta-700"
                >
                  <RotateCw className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => removeSign(s)}
                  aria-label={`Remove ${s.label}`}
                  className="absolute -right-2 -top-2 rounded-full border border-ink/15 bg-white/70 p-0.5 text-[color:var(--m-slate-2)] shadow-sm hover:text-danger-600"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </>
            ) : null}
          </div>
        ))}
      </div>

      {(() => {
        const b = booths.find((x) => x.booth_id === editingBooth);
        return (
          <Sheet open={b !== undefined} onClose={() => setEditingBooth(null)} labelledById={offeringsTitleId} rise>
            {b ? (
              <div className="px-4 pb-5 pt-1">
                <div className="flex items-center gap-2">
                  <h2 id={offeringsTitleId} className="flex-1 text-[19px] font-extrabold text-ink">
                    What does {b.label} serve?
                  </h2>
                  <ActionButton tone="neutral" icon={X} label="Close" iconOnly onClick={() => setEditingBooth(null)} />
                </div>
                <label htmlFor={`v-booth-offerings-${b.booth_id}`} className="sr-only">
                  What does this booth serve?
                </label>
                <textarea
                  id={`v-booth-offerings-${b.booth_id}`}
                  value={offeringsDraft}
                  onChange={(e) => setOfferingsDraft(e.target.value.slice(0, 280))}
                  maxLength={280}
                  rows={3}
                  autoFocus
                  placeholder="e.g. Espresso martinis & mocktails"
                  className="mt-3 w-full resize-none rounded-xl border border-[color:var(--m-line)] bg-[color:var(--m-paper)] px-3 py-2 text-[15px] text-ink focus:border-mulberry focus:outline-none"
                />
                <div className="mt-1 flex items-center justify-between text-[13px] text-[color:var(--m-slate-2)]">
                  <span>Guests see this when they tap your booth in the 3D venue walk.</span>
                  <span className="ml-2 shrink-0 tabular-nums">{offeringsDraft.length}/280</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 [&_.ab]:w-full">
                  <ActionButton tone="neutral" icon={X} label="Cancel" onClick={() => setEditingBooth(null)} />
                  <ActionButton tone="brand" main icon={Check} label="Save" onClick={() => saveOfferings(b)} />
                </div>
              </div>
            ) : null}
          </Sheet>
        );
      })()}

      <p className="text-[13px] text-[color:var(--m-slate-2)]">
        Changes save as you go. The couple can turn supplier editing off at any time, and the
        reception layout is theirs alone — you only touch the cocktail area.
      </p>
    </div>
  );
}
