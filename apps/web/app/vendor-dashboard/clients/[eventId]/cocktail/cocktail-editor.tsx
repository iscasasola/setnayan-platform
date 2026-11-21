'use client';

import { useId, useRef, useState } from 'react';
import { TypedRow, FormRows } from '@/app/_components/form-row';
import { PartNote, setTwo } from '@/app/vendor-dashboard/_components/set-two/parts';
import { SupplierThumbRow } from '@/app/vendor-dashboard/_components/supplier-thumb-row';
import { Check, ChevronDown, Info, Martini, Maximize2, Navigation, Pencil, Plus, RotateCw, Signpost, Trash2, X } from 'lucide-react';
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
  | { kind: 'booth'; id: string; sx: number; sy: number; ox: number; oy: number; prevX: number; prevY: number; moved?: boolean }
  | { kind: 'sign'; id: string; sx: number; sy: number; ox: number; oy: number; prevX: number; prevY: number; moved?: boolean };

/** A press that travels less than this is a TAP — it opens the booth's or the sign's sheet instead of moving it. */
const TAP_SLOP_PX = 4;

export function CocktailEditor({ eventId, data }: { eventId: string; data: CocktailEditorData }) {
  const [room, setRoom] = useState<Room>(data.cocktail);
  const [booths, setBooths] = useState<Booth[]>(data.booths);
  const [signs, setSigns] = useState<Sign[]>(data.signs);
  const [notice, setNotice] = useState<string | null>(null);
  // The booth whose offerings copy is being edited (inline panel), + its draft.
  const [editingBooth, setEditingBooth] = useState<string | null>(null);
  const [editingSign, setEditingSign] = useState<string | null>(null);
  const signTitleId = useId();
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
    if ((d.kind === 'booth' || d.kind === 'sign') && !d.moved) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < TAP_SLOP_PX) return;
      d.moved = true;
    }
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
      // A tap, not a drag: the sign's sheet (its name, Rotate, Remove) — the drawing's "a sign opens the same small sheet".
      if (!d.moved) {
        setEditingSign(s.sign_id);
        return;
      }
      const res = await moveSign(eventId, d.id, s.x, s.y, s.rotation_deg);
      if (!res.ok) {
        setSigns((ss) => ss.map((x) => (x.sign_id === d.id ? { ...x, x: d.prevX, y: d.prevY } : x)));
        setNotice(res.error);
      }
    } else {
      const b = booths.find((x) => x.booth_id === d.id);
      if (!b) return;
      // A tap, not a drag: the booth's sheet (what it serves, Save, Remove at the bottom).
      if (!d.moved) {
        openOfferings(b);
        return;
      }
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

  const relabelSign = async (s: Sign, typed: string) => {
    if (!canArrange) return;
    const label = typed.trim();
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

  const signOpen = signs.find((x) => x.sign_id === editingSign);

  return (
    <div data-cocktail-editor="">
      {notice ? (
        <PartNote
          tone="danger"
          icon={Info}
          role="alert"
          end={<ActionButton tone="neutral" quiet iconOnly icon={X} label="Dismiss" onClick={() => setNotice(null)} />}
        >
          {notice}
        </PartNote>
      ) : null}

      {/* Blueprint canvas — one shared plan; reception is read-only context */}
      <div
        ref={canvasRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative mx-3 mt-2 w-auto touch-none overflow-hidden rounded-[var(--m-r-md)] bg-[rgb(var(--sn-frame-bg))] shadow-[var(--sn-frame-shadow-tile)] tab:mx-0"
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
                  stroke="rgb(var(--sn-accent))"
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
            className="pointer-events-none absolute z-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--sn-frame-bg))] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sn-accent shadow-sm"
            style={{ left: `${data.entrance.x}%`, top: `${data.entrance.y}%` }}
          >
            Entrance
          </div>
        ) : null}
        {/* stage */}
        <div
          className="absolute flex items-center justify-center rounded-lg bg-[color:var(--surface-soft)] text-[10px] font-bold uppercase tracking-wider text-[rgb(var(--color-link))]"
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
              className={`absolute flex h-[7%] min-h-7 w-[7%] min-w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-[color:var(--m-paper-2)] text-[10px] font-bold text-[color:var(--m-slate-2)] ${
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
          <div className="h-full w-full rounded-[var(--m-r-md)] border-2 border-dashed border-sn-accent bg-[color:var(--surface-soft)] opacity-95" />
          <span
            onPointerDown={startRoom}
            className={`pointer-events-auto absolute left-1.5 top-1.5 inline-flex select-none items-center gap-1 rounded-[var(--m-r-sm)] bg-[rgb(var(--sn-frame-bg))] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-sn-accent ${
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
              className="sn-hit-2d pointer-events-auto absolute -bottom-2 -right-2 flex h-[22px] !min-h-0 w-[22px] !min-w-0 cursor-nwse-resize items-center justify-center rounded-full border-[3px] border-[rgb(var(--sn-frame-bg))] bg-sn-accent text-sn-on-accent"
            >
              <Maximize2 className="h-2.5 w-2.5 rotate-90" />
            </button>
          ) : null}
        </div>

        {/* booths — yours wears the accent and the pen; a tap opens its sheet, a drag places it */}
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
                role={editable ? 'button' : undefined}
                tabIndex={editable ? 0 : undefined}
                aria-label={editable ? `${b.label} — open its sheet` : undefined}
                onKeyDown={editable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openOfferings(b); } } : undefined}
                title={[b.label, b.vendor_name, b.offerings].filter(Boolean).join(' · ') || b.label}
                className={`flex select-none items-center gap-1 whitespace-nowrap rounded-[var(--m-r-sm)] px-2 py-1 text-[11px] font-bold ${
                  b.is_mine
                    ? 'bg-sn-accent text-sn-on-accent shadow-[0_0_0_3px_var(--surface-soft)]'
                    : 'bg-[rgb(var(--sn-frame-bg))] text-ink shadow-[var(--sn-frame-shadow-tile),0_0_0_1px_var(--m-line)]'
                } ${editable ? 'cursor-grab' : ''}`}
              >
                {b.label}
                {b.is_mine ? <Pencil aria-hidden className="h-3 w-3" /> : null}
              </span>
            </div>
          );
        })}

        {/* wayfinding signs — ARRANGE-tier editable (a tap opens its sheet); booth-tier sees them read-only */}
        {signs.map((s) => (
          <div
            key={s.sign_id}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
          >
            <span
              onPointerDown={canArrange ? startSign(s) : undefined}
              role={canArrange ? 'button' : undefined}
              tabIndex={canArrange ? 0 : undefined}
              aria-label={canArrange ? `${s.label} — open its sheet` : undefined}
              onKeyDown={canArrange ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingSign(s.sign_id); } } : undefined}
              title={s.label}
              className={`flex select-none items-center gap-1 whitespace-nowrap rounded-full px-2 py-[3px] text-[10px] font-bold ${setTwo.mapPill} ${
                canArrange ? 'cursor-grab' : ''
              }`}
            >
              <Navigation className="h-3 w-3" style={{ transform: `rotate(${s.rotation_deg}deg)` }} />
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <p className="px-4 pt-2 text-[13px] text-[color:var(--m-slate-2)] tab:px-1">
        {canArrange
          ? 'Drag the room, the corner grip to resize, booths to place them, and signs to point guests.'
          : 'Drag your booth to place it inside the room.'}
      </p>
      <p className="px-4 pt-2 text-[13px] text-[color:var(--m-slate-2)] tab:px-1">
        Changes save as you go. The couple can turn supplier editing off at any time, and the reception layout is theirs
        alone — you only touch the cocktail area.
      </p>

      {/* Add booth · Add sign — the thumb row (the shell's pinned bar from 701) */}
      <SupplierThumbRow name="cocktail" label="Cocktail area actions">
        <PickMenu
          label="Add booth"
          value=""
          buttonText="Add booth"
          options={BOOTH_CATALOG.map((c) => ({ key: c.type, label: c.label }))}
          onPick={(key) => {
            const c = BOOTH_CATALOG.find((x) => x.type === key);
            if (c) void addBooth(c.type, c.label);
          }}
          className={actionButtonClass('brand', { main: true })}
          trigger={
            <>
              <Plus aria-hidden strokeWidth={1.9} />
              <span className="lbl">Add booth</span>
              <ChevronDown aria-hidden className="h-4 w-4" strokeWidth={1.9} />
            </>
          }
        />
        {canArrange ? <ActionButton tone="neutral" icon={Signpost} label="Add sign" onClick={addSign} /> : null}
      </SupplierThumbRow>

      {(() => {
        const b = booths.find((x) => x.booth_id === editingBooth);
        return (
          <Sheet open={b !== undefined} onClose={() => setEditingBooth(null)} labelledById={offeringsTitleId} rise>
            {b ? (
              <div className="px-4 pb-5 pt-1">
                <div className="flex items-center gap-2">
                  <h2 id={offeringsTitleId} className="flex-1 text-[17px] font-bold text-ink">
                    What does {b.label} serve?
                  </h2>
                  <ActionButton tone="neutral" quiet icon={X} label="Close" iconOnly onClick={() => setEditingBooth(null)} />
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
                  className="mt-3 w-full resize-none rounded-[var(--m-r-lg)] bg-[color:var(--m-paper-2)] px-[14px] py-[10px] text-[15px] text-ink focus:outline-none focus:ring-2 focus:ring-sn-accent"
                />
                <div className="mt-1 flex items-center justify-between text-[13px] text-[color:var(--m-slate-2)]">
                  <span>Guests see this when they tap your booth in the 3D venue walk.</span>
                  <span className="ml-2 shrink-0 tabular-nums">{offeringsDraft.length}/280</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 [&_.ab]:w-full">
                  <ActionButton tone="neutral" icon={X} label="Cancel" onClick={() => setEditingBooth(null)} />
                  <ActionButton tone="brand" main icon={Check} label="Save" onClick={() => saveOfferings(b)} />
                </div>
                <div className="mt-3 [&_.ab]:w-full">
                  <ActionButton
                    tone="danger"
                    icon={Trash2}
                    label={`Remove ${b.label}`}
                    onClick={() => {
                      setEditingBooth(null);
                      void removeBooth(b);
                    }}
                  />
                </div>
              </div>
            ) : null}
          </Sheet>
        );
      })()}

      <Sheet open={signOpen !== undefined} onClose={() => setEditingSign(null)} labelledById={signTitleId} rise>
        {signOpen ? (
          <div className="px-4 pb-5 pt-1">
            <div className="flex items-center gap-2">
              <h2 id={signTitleId} className="flex-1 text-[17px] font-bold text-ink">
                {signOpen.label}
              </h2>
              <ActionButton tone="neutral" quiet icon={X} label="Close" iconOnly onClick={() => setEditingSign(null)} />
            </div>
            <FormRows width="wide" className="mt-2">
              <TypedRow
                name="Sign label"
                value={signOpen.label}
                required
                maxLength={60}
                onKeep={(t) => void relabelSign(signOpen, t)}
                data="cocktail-sign-label"
              />
            </FormRows>
            <div className="mt-4 grid grid-cols-2 gap-2 [&_.ab]:w-full">
              <ActionButton tone="neutral" icon={RotateCw} label="Rotate" onClick={() => void rotateSign(signOpen)} />
              <ActionButton
                tone="danger"
                icon={Trash2}
                label="Remove"
                onClick={() => {
                  setEditingSign(null);
                  void removeSign(signOpen);
                }}
              />
            </div>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
