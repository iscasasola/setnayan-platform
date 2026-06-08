'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import {
  Armchair,
  ChevronDown,
  Eye,
  EyeOff,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  UserMinus,
  X,
} from 'lucide-react';
import {
  CHAIR_PX,
  SIDE_COLORS,
  TABLE_TYPE_CATALOG,
  TABLE_TYPE_LABEL,
  shapeHintFor,
  tableGeometry,
  type EventTableRow,
} from '@/lib/seating';
import {
  assignGuest,
  autoSeatGuests,
  createTable,
  deleteTable,
  unassignGuest,
  updateTablePosition,
} from '../actions';

export type SeatingGuest = {
  guest_id: string;
  name: string;
  initials: string;
  photo_url: string | null;
  side: 'bride' | 'groom' | 'both';
  group_id: string | null;
  rsvp_status: string;
  seated_table_id: string | null;
  seat_number: number | null;
};

export type SeatingGroup = {
  group_id: string;
  label: string;
  color: string;
  member_count: number;
};

type Props = {
  eventId: string;
  tables: EventTableRow[];
  guests: SeatingGuest[];
  groups: SeatingGroup[];
};

const NEUTRAL = '#B7B1A6';

type LocalPos = { x: number; y: number };

function defaultGrid(index: number, total: number): LocalPos {
  const cols = Math.max(2, Math.ceil(Math.sqrt(total)));
  const rows = Math.max(1, Math.ceil(total / cols));
  return {
    x: ((index % cols) + 0.5) / cols * 100,
    y: 22 + (Math.floor(index / cols) + 0.5) / rows * 70,
  };
}

export function SeatingEditor({ eventId, tables, guests, groups }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; sx: number; sy: number; moved: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  const [positions, setPositions] = useState<Record<string, LocalPos>>(() => {
    const out: Record<string, LocalPos> = {};
    tables.forEach((t, i) => {
      out[t.table_id] =
        t.x_pos !== null && t.y_pos !== null
          ? { x: Number(t.x_pos), y: Number(t.y_pos) }
          : defaultGrid(i, tables.length);
    });
    return out;
  });
  const [dragId, setDragId] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyUnseated, setOnlyUnseated] = useState(false);
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showAddTable, setShowAddTable] = useState(false);
  const [confirmAuto, setConfirmAuto] = useState(false);

  const guestsById = useMemo(() => new Map(guests.map((g) => [g.guest_id, g])), [guests]);
  const groupColorById = useMemo(
    () => new Map(groups.map((g) => [g.group_id, g.color])),
    [groups],
  );
  const pickedGuest = pickedId ? guestsById.get(pickedId) ?? null : null;

  const colorFor = (g: SeatingGuest): string => {
    if (g.group_id) {
      if (hiddenGroups.has(g.group_id)) return NEUTRAL;
      return groupColorById.get(g.group_id) ?? SIDE_COLORS[g.side];
    }
    return SIDE_COLORS[g.side];
  };

  const occupantsFor = (t: EventTableRow): (SeatingGuest | null)[] => {
    const occ: (SeatingGuest | null)[] = new Array(t.capacity).fill(null);
    const leftovers: SeatingGuest[] = [];
    for (const g of guests) {
      if (g.seated_table_id !== t.table_id) continue;
      if (g.seat_number !== null && g.seat_number >= 0 && g.seat_number < t.capacity && occ[g.seat_number] === null) {
        occ[g.seat_number] = g;
      } else {
        leftovers.push(g);
      }
    }
    for (const g of leftovers) {
      const free = occ.indexOf(null);
      if (free < 0) break;
      occ[free] = g;
    }
    return occ;
  };

  const seatedCount = guests.filter((g) => g.seated_table_id).length;
  const totalCapacity = tables.reduce((acc, t) => acc + t.capacity, 0);
  const unseatedCount = guests.length - seatedCount;

  // --- seat / move / unseat -------------------------------------------------
  const place = (tableId: string, seatNumber: number | null) => {
    if (!pickedId) return;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('table_id', tableId);
    fd.set('guest_id', pickedId);
    if (seatNumber !== null) fd.set('seat_number', String(seatNumber));
    setPickedId(null);
    startTransition(() => assignGuest(fd));
  };

  const unseat = (guestId: string) => {
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('guest_id', guestId);
    if (pickedId === guestId) setPickedId(null);
    startTransition(() => unassignGuest(fd));
  };

  const removeTable = (tableId: string) => {
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('table_id', tableId);
    startTransition(() => deleteTable(fd));
  };

  const runAutoSeat = () => {
    setConfirmAuto(false);
    const fd = new FormData();
    fd.set('event_id', eventId);
    startTransition(() => autoSeatGuests(fd));
  };

  // --- table reposition (drag the centre hub) ------------------------------
  const onHubPointerDown = (t: EventTableRow) => (e: React.PointerEvent) => {
    if (pickedId) {
      // A guest is picked → pressing the hub seats them at the next free chair.
      e.stopPropagation();
      const occ = occupantsFor(t);
      const free = occ.indexOf(null);
      place(t.table_id, free >= 0 ? free : null);
      return;
    }
    e.preventDefault();
    dragRef.current = { id: t.table_id, sx: e.clientX, sy: e.clientY, moved: false };
    setDragId(t.table_id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onCanvasPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
    d.moved = true;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPositions((p) => ({
      ...p,
      [d.id]: { x: Math.max(4, Math.min(96, x)), y: Math.max(4, Math.min(96, y)) },
    }));
  };

  const onCanvasPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragId(null);
    if (d?.moved) setDirty((s) => new Set(s).add(d.id));
  };

  const saveLayout = () => {
    const ids = Array.from(dirty);
    startTransition(async () => {
      for (const id of ids) {
        const pos = positions[id];
        if (!pos) continue;
        const fd = new FormData();
        fd.set('event_id', eventId);
        fd.set('table_id', id);
        fd.set('x_pos', String(pos.x));
        fd.set('y_pos', String(pos.y));
        await updateTablePosition(fd);
      }
      setDirty(new Set());
    });
  };

  // --- sidebar member filtering --------------------------------------------
  const q = search.trim().toLowerCase();
  const memberVisible = (g: SeatingGuest) =>
    (!q || g.name.toLowerCase().includes(q)) && (!onlyUnseated || !g.seated_table_id);

  const individuals = guests.filter((g) => !g.group_id && memberVisible(g));
  const tableLabelById = useMemo(
    () => new Map(tables.map((t) => [t.table_id, t.table_label])),
    [tables],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* ---------------- Sidebar ---------------- */}
      <aside className="flex max-h-[78vh] flex-col gap-3 overflow-y-auto rounded-2xl border border-ink/10 bg-cream p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people…"
              className="w-full rounded-lg border border-ink/15 bg-cream py-1.5 pl-8 pr-2 text-sm outline-none focus:border-terracotta"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowAddTable((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-terracotta px-2.5 py-1.5 text-xs font-medium text-cream hover:bg-terracotta-600"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Table
          </button>
        </div>

        <label className="flex items-center gap-2 px-0.5 text-xs text-ink/65">
          <input
            type="checkbox"
            checked={onlyUnseated}
            onChange={(e) => setOnlyUnseated(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-ink/30 text-terracotta focus:ring-terracotta"
          />
          Only show unseated
        </label>

        {showAddTable ? <AddTablePanel eventId={eventId} onDone={() => setShowAddTable(false)} /> : null}

        {/* Tables */}
        <Section label={`Tables · ${tables.length}`}>
          {tables.length === 0 ? (
            <p className="px-1 py-2 text-xs text-ink/45">No tables yet — add one above.</p>
          ) : (
            <ul className="space-y-1">
              {tables.map((t) => {
                const occ = occupantsFor(t);
                const filled = occ.filter(Boolean).length;
                const full = filled >= t.capacity;
                return (
                  <li
                    key={t.table_id}
                    className={`group flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                      highlightId === t.table_id ? 'border-terracotta bg-terracotta/5' : 'border-transparent hover:bg-ink/[0.03]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setHighlightId((id) => (id === t.table_id ? null : t.table_id))}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: dominantColor(occ, colorFor) ?? NEUTRAL }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{t.table_label}</span>
                        <span className="block text-[11px] text-ink/50">
                          {filled}/{t.capacity} · {TABLE_TYPE_LABEL[t.table_type]}
                        </span>
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                          full ? 'bg-emerald-100 text-emerald-700' : 'bg-ink/5 text-ink/50'
                        }`}
                      >
                        {full ? 'Filled' : 'Open'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTable(t.table_id)}
                      aria-label={`Delete ${t.table_label}`}
                      className="rounded p-1 text-ink/30 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* Individual members */}
        <Section label={`Individual Members · ${individuals.length}`}>
          {individuals.length === 0 ? (
            <p className="px-1 py-2 text-xs text-ink/45">Everyone here is in a group.</p>
          ) : (
            <ul className="space-y-0.5">
              {individuals.map((g) => (
                <MemberRow
                  key={g.guest_id}
                  guest={g}
                  color={colorFor(g)}
                  picked={pickedId === g.guest_id}
                  tableLabel={g.seated_table_id ? tableLabelById.get(g.seated_table_id) ?? null : null}
                  onPick={() => setPickedId((id) => (id === g.guest_id ? null : g.guest_id))}
                />
              ))}
            </ul>
          )}
        </Section>

        {/* Member groups */}
        {groups.length > 0 ? (
          <Section label={`Member Groups · ${groups.length}`}>
            <ul className="space-y-1">
              {groups.map((grp) => {
                const members = guests.filter((g) => g.group_id === grp.group_id && memberVisible(g));
                const isOpen = openGroups.has(grp.group_id);
                const hidden = hiddenGroups.has(grp.group_id);
                return (
                  <li key={grp.group_id} className="rounded-lg border border-ink/10">
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenGroups((s) => {
                            const n = new Set(s);
                            n.has(grp.group_id) ? n.delete(grp.group_id) : n.add(grp.group_id);
                            return n;
                          })
                        }
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: grp.color }} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{grp.label}</span>
                        <span className="text-[11px] text-ink/50">{grp.member_count}</span>
                        <ChevronDown className={`h-3.5 w-3.5 text-ink/40 transition ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setHiddenGroups((s) => {
                            const n = new Set(s);
                            n.has(grp.group_id) ? n.delete(grp.group_id) : n.add(grp.group_id);
                            return n;
                          })
                        }
                        aria-label={hidden ? 'Show colour on canvas' : 'Hide colour on canvas'}
                        className="rounded p-1 text-ink/40 hover:bg-ink/5"
                      >
                        {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    {isOpen ? (
                      <ul className="space-y-0.5 border-t border-ink/10 p-1">
                        {members.length === 0 ? (
                          <li className="px-1 py-1 text-[11px] text-ink/40">No matching members.</li>
                        ) : (
                          members.map((g) => (
                            <MemberRow
                              key={g.guest_id}
                              guest={g}
                              color={colorFor(g)}
                              picked={pickedId === g.guest_id}
                              tableLabel={
                                g.seated_table_id ? tableLabelById.get(g.seated_table_id) ?? null : null
                              }
                              onPick={() => setPickedId((id) => (id === g.guest_id ? null : g.guest_id))}
                            />
                          ))
                        )}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Section>
        ) : null}
      </aside>

      {/* ---------------- Canvas ---------------- */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ul className="flex flex-wrap gap-2 text-[11px]">
            <Pill>{tables.length} tables</Pill>
            <Pill>
              {seatedCount}/{totalCapacity} seated
            </Pill>
            <Pill tone={unseatedCount > 0 ? 'warn' : 'ok'}>{unseatedCount} unseated</Pill>
          </ul>
          <div className="flex items-center gap-2">
            {dirty.size > 0 ? (
              <button
                type="button"
                onClick={saveLayout}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:border-terracotta disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" /> Save layout ({dirty.size})
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setConfirmAuto(true)}
              disabled={isPending || unseatedCount === 0 || tables.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-mulberry px-3 py-1.5 text-xs font-semibold text-cream hover:bg-mulberry-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" /> Auto-seat guests
            </button>
          </div>
        </div>

        {pickedGuest ? (
          <div className="flex items-center gap-3 rounded-xl border border-terracotta/40 bg-terracotta/5 px-3 py-2 text-sm">
            <ChairAvatar guest={pickedGuest} color={colorFor(pickedGuest)} size={28} />
            <span className="min-w-0 flex-1 truncate">
              Seating <span className="font-semibold text-ink">{pickedGuest.name}</span> — tap a chair or a table.
            </span>
            {pickedGuest.seated_table_id ? (
              <button
                type="button"
                onClick={() => unseat(pickedGuest.guest_id)}
                className="inline-flex items-center gap-1 rounded-md border border-ink/15 bg-cream px-2 py-1 text-xs text-ink hover:border-rose-400 hover:text-rose-600"
              >
                <UserMinus className="h-3.5 w-3.5" /> Unseat
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setPickedId(null)}
              className="rounded-md p-1 text-ink/40 hover:bg-ink/5"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div
          ref={canvasRef}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerLeave={onCanvasPointerUp}
          className="relative aspect-[7/5] w-full overflow-hidden rounded-2xl border border-ink/15 bg-ink/[0.02]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(30,34,41,0.06) 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        >
          <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-md border border-ink/20 bg-cream/80 px-6 py-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-ink/70 backdrop-blur-sm">
            Stage · Head Table
          </div>

          {tables.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-ink/40">
              Add a table from the sidebar to start your floor plan.
            </div>
          ) : null}

          {tables.map((t) => {
            const pos = positions[t.table_id] ?? { x: 50, y: 50 };
            const shape = shapeHintFor(t.table_type);
            const geo = tableGeometry(shape, t.capacity);
            const rectish = shape === 'long_banquet' || shape === 'family_head';
            const occ = occupantsFor(t);
            const filled = occ.filter(Boolean).length;
            const halo = dominantColor(occ, colorFor);
            const highlighted = highlightId === t.table_id;
            const dragging = dragId === t.table_id;
            const num = t.table_label.match(/\d+/)?.[0] ?? '';

            return (
              <div
                key={t.table_id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: geo.box.w, height: geo.box.h, zIndex: dragging ? 30 : 20 }}
              >
                {/* group-tint halo */}
                {halo ? (
                  <span
                    aria-hidden
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-md"
                    style={{
                      width: geo.hub.w + 56,
                      height: geo.hub.h + 56,
                      backgroundColor: halo,
                      opacity: 0.18,
                    }}
                  />
                ) : null}

                {/* chairs */}
                {geo.seats.map((s, i) => {
                  const occupant = occ[i] ?? null;
                  const cx = geo.box.w / 2 + s.x;
                  const cy = geo.box.h / 2 + s.y;
                  return (
                    <div
                      key={i}
                      className="absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left: cx, top: cy, width: CHAIR_PX, height: CHAIR_PX }}
                    >
                      {occupant ? (
                        <button
                          type="button"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            if (pickedId) place(t.table_id, i);
                            else setPickedId(occupant.guest_id);
                          }}
                          title={occupant.name}
                          className="relative block h-full w-full"
                        >
                          {/* the chair, tinted in the guest's group/side colour */}
                          <Armchair
                            className="absolute inset-0 h-full w-full"
                            strokeWidth={1.8}
                            style={{ color: colorFor(occupant) }}
                          />
                          {/* the guest sitting on it */}
                          <SeatBadge guest={occupant} color={colorFor(occupant)} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            if (pickedId) place(t.table_id, i);
                          }}
                          aria-label={`Empty seat ${i + 1}`}
                          className={`block h-full w-full transition ${
                            pickedId ? 'text-terracotta hover:text-terracotta-600' : 'text-ink/30 hover:text-ink/50'
                          }`}
                        >
                          <Armchair className="h-full w-full" strokeWidth={1.6} />
                        </button>
                      )}
                      {occupant
                        ? (() => {
                            const lbl = seatLabel(s.x, s.y, rectish);
                            return (
                              <span
                                className={`pointer-events-none absolute z-10 line-clamp-2 break-words text-[9px] font-medium leading-[1.05] text-ink/85 ${lbl.className}`}
                                style={lbl.style}
                              >
                                {occupant.name}
                              </span>
                            );
                          })()
                        : null}
                    </div>
                  );
                })}

                {/* hub (drag handle + place-at-next-free target) */}
                <button
                  type="button"
                  onPointerDown={onHubPointerDown(t)}
                  aria-label={`${t.table_label} — drag to move`}
                  className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 select-none flex-col items-center justify-center border-2 bg-cream text-center shadow-sm transition ${
                    highlighted ? 'border-terracotta' : 'border-ink/25'
                  } ${pickedId ? 'cursor-pointer' : dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                  style={{
                    width: geo.hub.w,
                    height: geo.hub.h,
                    borderRadius: geo.hub.shape === 'round' ? '9999px' : geo.hub.radius,
                  }}
                >
                  <span className="text-sm font-semibold text-ink">{num || '·'}</span>
                  <span className="text-[8px] font-medium uppercase tracking-wide text-ink/45">
                    {filled}/{t.capacity}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-ink/50">
          Tap a guest in the sidebar, then tap a chair to seat them. Drag a table&rsquo;s centre to move it, then
          Save layout. <span className="text-ink/40">Auto-seat fills unseated guests by role tier, closest to the stage first.</span>
        </p>
      </div>

      {/* auto-seat confirm */}
      {confirmAuto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => setConfirmAuto(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-ink/10 bg-cream p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-mulberry" />
              <h3 className="text-lg font-semibold text-ink">Auto-seat guests</h3>
            </div>
            <p className="text-sm text-ink/70">
              Seat the <span className="font-semibold">{unseatedCount}</span> unseated, attending{' '}
              {unseatedCount === 1 ? 'guest' : 'guests'} across {tables.length}{' '}
              {tables.length === 1 ? 'table' : 'tables'} by role tier — closest to the stage first. This won&rsquo;t
              move anyone you&rsquo;ve already placed, and it skips sweetheart tables.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAuto(false)}
                className="rounded-lg border border-ink/15 bg-cream px-3 py-1.5 text-sm text-ink hover:bg-ink/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runAutoSeat}
                className="inline-flex items-center gap-1.5 rounded-lg bg-mulberry px-3 py-1.5 text-sm font-semibold text-cream hover:bg-mulberry-600"
              >
                <Sparkles className="h-4 w-4" /> Auto-seat
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 px-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">{label}</p>
      {children}
    </div>
  );
}

function Pill({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'warn' | 'ok' }) {
  const cls =
    tone === 'warn'
      ? 'bg-amber-100 text-amber-800'
      : tone === 'ok'
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-ink/5 text-ink/65';
  return <li className={`rounded-full px-2.5 py-1 font-medium ${cls}`}>{children}</li>;
}

function MemberRow({
  guest,
  color,
  picked,
  tableLabel,
  onPick,
}: {
  guest: SeatingGuest;
  color: string;
  picked: boolean;
  tableLabel: string | null;
  onPick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition ${
          picked ? 'bg-terracotta/10 ring-1 ring-terracotta/40' : 'hover:bg-ink/[0.03]'
        }`}
      >
        <ChairAvatar guest={guest} color={color} size={24} />
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{guest.name}</span>
        {tableLabel ? (
          <span className="shrink-0 rounded-full bg-ink/5 px-1.5 py-0.5 text-[10px] text-ink/55">{tableLabel}</span>
        ) : (
          <span className="shrink-0 text-[10px] text-ink/30">unseated</span>
        )}
      </button>
    </li>
  );
}

function ChairAvatar({ guest, color, size }: { guest: SeatingGuest; color: string; size: number }) {
  const style = { width: size, height: size, boxShadow: `0 0 0 2px ${color}` } as const;
  if (guest.photo_url) {
    return (
      <span className="relative inline-block overflow-hidden rounded-full bg-ink/10" style={style}>
        {/* eslint-disable-next-line @next/next/no-img-element -- avatar hosts vary (R2 / Google); plain img avoids next/image host allowlisting */}
        <img src={guest.photo_url} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold text-cream"
      style={{ ...style, backgroundColor: color, fontSize: Math.max(8, size * 0.36) }}
    >
      {guest.initials}
    </span>
  );
}

// Places a guest's full name OUTSIDE their chair so the table stays readable:
// banquet rows get the name stacked above (top row) / below (bottom row); round
// tables fan the name out radially (left/right/above/below) from the centre.
function seatLabel(sx: number, sy: number, rect: boolean): {
  className: string;
  style: React.CSSProperties;
} {
  const base: React.CSSProperties = {
    // banquet chairs sit close together → keep each name in its own chair-wide
    // column so adjacent names wrap instead of colliding. Round tables fan out
    // radially with room for a wider label.
    width: rect ? 44 : 88,
    // cream halo so names stay legible over chairs + the grid, in both themes
    textShadow: '0 0 4px rgb(var(--color-cream)), 0 1px 2px rgb(var(--color-cream))',
  };
  const lift = CHAIR_PX / 2 - 2;
  if (rect) {
    return sy < 0
      ? { className: 'text-center', style: { ...base, left: '50%', top: '50%', transform: `translate(-50%, calc(-100% - ${lift}px))` } }
      : { className: 'text-center', style: { ...base, left: '50%', top: '50%', transform: `translate(-50%, ${lift}px)` } };
  }
  const len = Math.hypot(sx, sy) || 1;
  const ux = sx / len;
  const uy = sy / len;
  const off = CHAIR_PX / 2 + 4;
  const lx = ux * off;
  const ly = uy * off;
  if (ux > 0.34) {
    return { className: 'text-left', style: { ...base, left: '50%', top: '50%', transform: `translate(${lx}px, calc(-50% + ${ly}px))` } };
  }
  if (ux < -0.34) {
    return { className: 'text-right', style: { ...base, left: '50%', top: '50%', transform: `translate(calc(-100% + ${lx}px), calc(-50% + ${ly}px))` } };
  }
  if (uy < 0) {
    return { className: 'text-center', style: { ...base, left: '50%', top: '50%', transform: `translate(-50%, calc(-100% + ${ly}px))` } };
  }
  return { className: 'text-center', style: { ...base, left: '50%', top: '50%', transform: `translate(-50%, ${ly}px)` } };
}

// The guest "sitting on" a chair — a small badge centred on the seat of the
// Armchair glyph (translated slightly up so it reads as a person on the chair).
function SeatBadge({ guest, color }: { guest: SeatingGuest; color: string }) {
  const base =
    'absolute left-1/2 top-1/2 inline-flex items-center justify-center overflow-hidden rounded-full border border-cream';
  const style = { width: 21, height: 21, transform: 'translate(-50%, -58%)' } as const;
  if (guest.photo_url) {
    return (
      <span className={`${base} bg-ink/10`} style={style}>
        {/* eslint-disable-next-line @next/next/no-img-element -- avatar hosts vary (R2 / Google); plain img avoids next/image host allowlisting */}
        <img src={guest.photo_url} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span
      className={`${base} font-semibold text-cream`}
      style={{ ...style, backgroundColor: color, fontSize: 9 }}
    >
      {guest.initials}
    </span>
  );
}

function AddTablePanel({ eventId, onDone }: { eventId: string; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  return (
    <form
      action={(fd) => {
        fd.set('event_id', eventId);
        startTransition(async () => {
          await createTable(fd);
          onDone();
        });
      }}
      className="space-y-2 rounded-xl border border-ink/10 bg-ink/[0.03] p-3"
    >
      <input
        name="table_label"
        required
        maxLength={64}
        placeholder="Table name · e.g. Sponsors 1"
        className="w-full rounded-lg border border-ink/15 bg-cream px-2 py-1.5 text-sm outline-none focus:border-terracotta"
      />
      <div className="flex gap-2">
        <select
          name="table_type"
          defaultValue="round_10"
          className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-cream px-2 py-1.5 text-sm outline-none focus:border-terracotta"
        >
          {TABLE_TYPE_CATALOG.map((t) => (
            <option key={t.type} value={t.type}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          name="capacity"
          type="number"
          min={1}
          max={32}
          defaultValue={10}
          aria-label="Capacity"
          className="w-16 rounded-lg border border-ink/15 bg-cream px-2 py-1.5 text-sm outline-none focus:border-terracotta"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-lg px-2.5 py-1.5 text-xs text-ink/60 hover:bg-ink/5">
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1 rounded-lg bg-terracotta px-2.5 py-1.5 text-xs font-medium text-cream hover:bg-terracotta-600 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Add table
        </button>
      </div>
    </form>
  );
}

function dominantColor(occ: (SeatingGuest | null)[], colorFor: (g: SeatingGuest) => string): string | null {
  const tally = new Map<string, number>();
  for (const g of occ) {
    if (!g || !g.group_id) continue;
    const c = colorFor(g);
    if (c === NEUTRAL) continue;
    tally.set(c, (tally.get(c) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [c, n] of tally) {
    if (n > bestN) {
      best = c;
      bestN = n;
    }
  }
  return best;
}
