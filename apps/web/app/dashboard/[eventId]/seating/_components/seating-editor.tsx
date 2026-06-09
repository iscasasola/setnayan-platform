'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';

// useLayoutEffect on the server is a no-op + warns; fall back to useEffect there.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
import {
  Armchair,
  ChevronDown,
  DoorOpen,
  Eye,
  EyeOff,
  FileDown,
  List,
  Map as MapIcon,
  Maximize2,
  Minus,
  Plus,
  Ruler,
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
  TABLE_FOOTPRINT_M,
  defaultTablePosition,
  TABLE_TYPE_CATALOG,
  TABLE_TYPE_LABEL,
  shapeHintFor,
  tableGeometry,
  type EventTableRow,
  type FloorPlanRow,
} from '@/lib/seating';
import {
  assignGroup,
  assignGuest,
  autoSeatGuests,
  createTable,
  deleteTable,
  saveFloorPlan,
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
  floorPlan: FloorPlanRow;
};

const NEUTRAL = '#B7B1A6';

type LocalPos = { x: number; y: number };

// Default placement for an un-positioned table — shared with the PDF + day-of
// map (lib/seating) so the layout matches everywhere.
const defaultGrid = defaultTablePosition;

export function SeatingEditor({ eventId, tables, guests, groups, floorPlan }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    kind: 'table' | 'stage' | 'entrance';
    id: string;
    sx: number;
    sy: number;
    moved: boolean;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Floor-plan markers (draggable stage + single entrance door).
  const [stage, setStage] = useState({ x: floorPlan.stage_x, y: floorPlan.stage_y });
  const [entrance, setEntrance] = useState({
    enabled: floorPlan.entrance_enabled,
    x: floorPlan.entrance_x,
    y: floorPlan.entrance_y,
  });
  // Venue dimensions (metres) → render the room + tables to scale.
  const [venue, setVenue] = useState({
    enabled: floorPlan.venue_width_m !== null && floorPlan.venue_length_m !== null,
    width: floorPlan.venue_width_m ?? 20,
    length: floorPlan.venue_length_m ?? 30,
  });
  const [showRoomPanel, setShowRoomPanel] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [canvasW, setCanvasW] = useState(0);
  const [floorDirty, setFloorDirty] = useState(false);

  const venueScaled = venue.enabled && venue.width > 0 && venue.length > 0;
  // Pixels-per-metre at zoom 1 (the world layer width === canvas width). Tables
  // multiply this by their real footprint to render at true scale.
  const pxPerMeter = venueScaled && canvasW > 0 ? canvasW / venue.width : null;

  // Positions are owned by the auto-place layout-effect below (it resolves a
  // non-overlapping home for every table before paint). Until it runs, the
  // render falls back to defaultGrid, which keeps SSR + first paint stable.
  const [positions, setPositions] = useState<Record<string, LocalPos>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [pickedId, setPickedId] = useState<string | null>(null);
  // A picked group (bulk-seat flow) is mutually exclusive with a picked guest —
  // the effect below clears one when the other is set. `notice` carries the
  // seat-what-fits message after a group overflows a table.
  const [pickedGroupId, setPickedGroupId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (pickedId) setPickedGroupId(null);
  }, [pickedId]);

  // --- zoom + pan (growable floor plan) ------------------------------------
  // The world transform is applied to the DOM directly (refs) so panning /
  // zooming a 50-table plan doesn't re-render every table each frame. React
  // state only tracks `detail` (the level-of-detail flip) which changes rarely.
  const worldRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const panStartRef = useRef<{ px: number; py: number; sx: number; sy: number } | null>(null);
  const pinchRef = useRef<{ dist: number; zoom: number; wx: number; wy: number } | null>(null);
  const [detail, setDetail] = useState(true);
  const detailRef = useRef(true);
  const [search, setSearch] = useState('');
  const [onlyUnseated, setOnlyUnseated] = useState(false);
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showAddTable, setShowAddTable] = useState(false);
  const [confirmAuto, setConfirmAuto] = useState(false);
  // The spatial chair canvas can't hold many tables on a phone, so small
  // screens default to a scrollable table-card list (0008 spec's mobile
  // surface). Both views are available on both platforms via the toggle.
  const [view, setView] = useState<'plan' | 'list'>('plan');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      setView('list');
    }
  }, []);

  // Scroll-wheel / trackpad zoom toward the cursor (non-passive so we can
  // preventDefault the page scroll). Re-attached when the plan view mounts.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || view !== 'plan') return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const z0 = zoomRef.current;
      const p0 = panRef.current;
      const z1 = clampZoom(z0 * Math.exp(-e.deltaY * 0.0015));
      applyView(z1, { x: sx - z1 * ((sx - p0.x) / z0), y: sy - z1 * ((sy - p0.y) / z0) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Re-assert the current world transform after the plan view (re)mounts, so a
  // zoom set before toggling away is preserved on return.
  useEffect(() => {
    if (view === 'plan' && worldRef.current) {
      const p = panRef.current;
      worldRef.current.style.transform = `translate(${p.x}px, ${p.y}px) scale(${zoomRef.current})`;
    }
  }, [view]);

  // Track the canvas width so tables can be scaled to true metres-per-pixel.
  // useLayoutEffect + a synchronous first measure closes the first-paint race
  // where canvasW=0 would briefly render tables unscaled. Re-runs when venue
  // mode toggles (the canvas changes size/aspect then).
  useIsoLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el || view !== 'plan') return;
    const update = () => setCanvasW(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, venueScaled]);

  const guestsById = useMemo(() => new Map(guests.map((g) => [g.guest_id, g])), [guests]);
  const groupColorById = useMemo(
    () => new Map(groups.map((g) => [g.group_id, g.color])),
    [groups],
  );
  const pickedGuest = pickedId ? guestsById.get(pickedId) ?? null : null;
  const pickedGroup = pickedGroupId ? groups.find((g) => g.group_id === pickedGroupId) ?? null : null;
  // Members the bulk-seat will move — everyone whose primary group is the
  // picked one, ignoring the search/unseated filters (seating the WHOLE group).
  const pickedGroupMemberIds = useMemo(
    () => (pickedGroupId ? guests.filter((g) => g.group_id === pickedGroupId).map((g) => g.guest_id) : []),
    [pickedGroupId, guests],
  );

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

  // Bulk-seat the picked group onto a table. The server seats what fits and
  // returns the counts; if any members overflow we surface a notice so the
  // couple can drop the rest on another table.
  const seatGroupAt = (tableId: string) => {
    if (!pickedGroupId) return;
    const groupLabel = groups.find((g) => g.group_id === pickedGroupId)?.label ?? 'group';
    const memberIds = guests.filter((g) => g.group_id === pickedGroupId).map((g) => g.guest_id);
    setPickedGroupId(null);
    setNotice(null);
    if (memberIds.length === 0) return;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('table_id', tableId);
    fd.set('guest_ids', JSON.stringify(memberIds));
    startTransition(async () => {
      const res = await assignGroup(fd);
      if (res && res.overflow > 0) {
        const label = tableLabelById.get(tableId) ?? 'that table';
        setNotice(
          `${groupLabel}: seated ${res.seated} of ${res.requested} at ${label} — ${res.overflow} didn't fit. Pick another table for the rest.`,
        );
      }
    });
  };

  // --- collision avoidance: tables never overlap ----------------------------
  // A table's on-screen footprint in px, honouring the to-scale shrink inside a
  // sized room (same maths as fitView + the table render).
  const footprintPx = (t: EventTableRow) => {
    const geo = tableGeometry(shapeHintFor(t.table_type), t.capacity);
    const s = pxPerMeter ? (TABLE_FOOTPRINT_M[t.table_type] * pxPerMeter) / geo.box.w : 1;
    return { w: geo.box.w * s, h: geo.box.h * s };
  };
  // Breathing gap (px) kept between any two tables.
  const COLLIDE_GAP = 10;
  // Would `moving` sitting at (x%,y%) overlap any OTHER table? AABB test in px.
  // `posFor` yields each table's %-position, or null to skip one (used while the
  // auto-place pass is still deciding where un-placed tables go).
  const overlapsAny = (
    x: number,
    y: number,
    moving: EventTableRow,
    rect: { width: number; height: number },
    posFor: (o: EventTableRow, i: number) => LocalPos | null,
  ) => {
    const m = footprintPx(moving);
    return tables.some((o, i) => {
      if (o.table_id === moving.table_id) return false;
      const op = posFor(o, i);
      if (!op) return false;
      const of = footprintPx(o);
      const dx = Math.abs(((x - op.x) / 100) * rect.width);
      const dy = Math.abs(((y - op.y) / 100) * rect.height);
      return dx < (m.w + of.w) / 2 + COLLIDE_GAP && dy < (m.h + of.h) / 2 + COLLIDE_GAP;
    });
  };
  // Nearest %-position to (x,y) where `moving` clears every other table. Spirals
  // outward from the desired spot; stays inside the walls when a room is sized.
  const nearestFree = (
    x: number,
    y: number,
    moving: EventTableRow,
    rect: { width: number; height: number },
    posFor: (o: EventTableRow, i: number) => LocalPos | null,
  ): LocalPos => {
    if (!overlapsAny(x, y, moving, rect, posFor)) return { x, y };
    const f = footprintPx(moving);
    const stepPx = Math.max(10, Math.min(f.w, f.h) / 2.5);
    const lo = venueScaled ? 2 : -200;
    const hi = venueScaled ? 98 : 600;
    for (let ring = 1; ring <= 48; ring++) {
      const radPx = ring * stepPx;
      for (let deg = 0; deg < 360; deg += 18) {
        const a = (deg * Math.PI) / 180;
        const nx = x + ((Math.cos(a) * radPx) / rect.width) * 100;
        const ny = y + ((Math.sin(a) * radPx) / rect.height) * 100;
        if (nx < lo || nx > hi || ny < lo || ny > hi) continue;
        if (!overlapsAny(nx, ny, moving, rect, posFor)) return { x: nx, y: ny };
      }
    }
    // Spiral missed a gap (dense room) — scan a fine grid for the nearest clear
    // cell. Guarantees a non-overlapping home whenever one physically exists.
    const span = hi - lo;
    const stepPct = span / 72;
    let best: LocalPos | null = null;
    let bestD = Infinity;
    for (let gy = lo; gy <= hi; gy += stepPct) {
      for (let gx = lo; gx <= hi; gx += stepPct) {
        if (overlapsAny(gx, gy, moving, rect, posFor)) continue;
        const d = (gx - x) ** 2 + (gy - y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { x: gx, y: gy };
        }
      }
    }
    return best ?? { x, y };
  };

  // Footprint-aware shelf pack for a sized room: lay tables left→right in rows
  // sized to their REAL to-scale footprint, wrapping at the wall. Gives the
  // resolver a tight, gap-free starting layout so to-scale tables fit whenever
  // the room is physically big enough (a count-based grid can't — its cells
  // ignore that a family-head is far wider than a sweetheart table).
  const venueShelfBase = (rect: { width: number; height: number }): Record<string, LocalPos> => {
    const out: Record<string, LocalPos> = {};
    const pad = rect.width * 0.02;
    let cx = pad;
    let cy = pad;
    let rowH = 0;
    tables.forEach((t) => {
      const f = footprintPx(t);
      if (cx + f.w > rect.width - pad && cx > pad) {
        cx = pad;
        cy += rowH + COLLIDE_GAP;
        rowH = 0;
      }
      out[t.table_id] = {
        x: ((cx + f.w / 2) / rect.width) * 100,
        y: ((cy + f.h / 2) / rect.height) * 100,
      };
      cx += f.w + COLLIDE_GAP;
      rowH = Math.max(rowH, f.h);
    });
    return out;
  };

  // Auto-place: give every table a non-overlapping home. Saved tables anchor
  // exactly where the couple left them; an un-saved table keeps its current spot
  // when it's already clear and only slides aside when it would collide. Runs on
  // mount (resolving the initial grid) and whenever tables / the room change.
  useIsoLayoutEffect(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const shelf = venueScaled ? venueShelfBase(rect) : null;
    setPositions((prev) => {
      const placed: Record<string, LocalPos> = {};
      tables.forEach((t) => {
        if (t.x_pos !== null && t.y_pos !== null) {
          placed[t.table_id] = { x: Number(t.x_pos), y: Number(t.y_pos) };
        }
      });
      tables.forEach((t, i) => {
        if (placed[t.table_id]) return;
        const base = prev[t.table_id] ?? shelf?.[t.table_id] ?? defaultGrid(i, tables.length, !venueScaled);
        placed[t.table_id] = nearestFree(base.x, base.y, t, rect, (o) => placed[o.table_id] ?? null);
      });
      // Cleanup: greedy placement (each table only dodges earlier ones) can leave
      // a straggler overlapping a later table. Re-resolve any residual collision;
      // converges to zero overlaps whenever the room physically has room.
      for (let pass = 0; pass < 3; pass++) {
        let moved = false;
        tables.forEach((t) => {
          if (t.x_pos !== null && t.y_pos !== null) return; // saved anchors hold
          const cur = placed[t.table_id];
          if (cur && overlapsAny(cur.x, cur.y, t, rect, (o) => placed[o.table_id] ?? null)) {
            placed[t.table_id] = nearestFree(cur.x, cur.y, t, rect, (o) => placed[o.table_id] ?? null);
            moved = true;
          }
        });
        if (!moved) break;
      }
      const keys = Object.keys(placed);
      let changed = keys.length !== Object.keys(prev).length;
      for (const k of keys) {
        const a = placed[k];
        const b = prev[k];
        if (!a || !b || Math.abs(a.x - b.x) > 0.01 || Math.abs(a.y - b.y) > 0.01) {
          changed = true;
          break;
        }
      }
      return changed ? placed : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables, venueScaled, canvasW]);

  // --- table reposition (drag the centre hub) ------------------------------
  const onHubPointerDown = (t: EventTableRow) => (e: React.PointerEvent) => {
    if (pickedGroupId) {
      // A group is picked → pressing the hub seats the whole group here.
      e.stopPropagation();
      seatGroupAt(t.table_id);
      return;
    }
    if (pickedId) {
      // A guest is picked → pressing the hub seats them at the next free chair.
      e.stopPropagation();
      const occ = occupantsFor(t);
      const free = occ.indexOf(null);
      place(t.table_id, free >= 0 ? free : null);
      return;
    }
    e.preventDefault();
    dragRef.current = { kind: 'table', id: t.table_id, sx: e.clientX, sy: e.clientY, moved: false };
    setDragId(t.table_id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Drag the stage / entrance markers (same pointer model as a table hub).
  const onMarkerPointerDown =
    (kind: 'stage' | 'entrance') => (e: React.PointerEvent) => {
      if (pickedId) {
        // Don't seat onto a marker, and don't start a pan.
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      dragRef.current = { kind, id: kind, sx: e.clientX, sy: e.clientY, moved: false };
      setDragId(`__${kind}__`);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

  const ZOOM_MIN = 0.1; // low enough that Fit frames even a large free auto-grow board
  const ZOOM_MAX = 2.6;
  const DETAIL_AT = 0.72; // chairs appear at/above this zoom; pucks below
  const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

  // Apply the world transform straight to the DOM (no per-frame re-render);
  // only flip `detail` state when crossing the level-of-detail threshold.
  const applyView = (z: number, p: { x: number; y: number }) => {
    zoomRef.current = z;
    panRef.current = p;
    if (worldRef.current) {
      worldRef.current.style.transform = `translate(${p.x}px, ${p.y}px) scale(${z})`;
    }
    const nd = z >= DETAIL_AT;
    if (nd !== detailRef.current) {
      detailRef.current = nd;
      setDetail(nd);
    }
  };

  // Background drag pans; two fingers pinch-zoom. A table-hub drag (dragRef set)
  // takes precedence and is handled in the move branch below.
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (dragRef.current) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    canvasRef.current?.setPointerCapture(e.pointerId);
    if (pointersRef.current.size >= 2) {
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) || 1;
      const mx = (pts[0]!.x + pts[1]!.x) / 2 - rect.left;
      const my = (pts[0]!.y + pts[1]!.y) / 2 - rect.top;
      pinchRef.current = {
        dist,
        zoom: zoomRef.current,
        wx: (mx - panRef.current.x) / zoomRef.current,
        wy: (my - panRef.current.y) / zoomRef.current,
      };
      panStartRef.current = null;
    } else {
      panStartRef.current = { px: panRef.current.x, py: panRef.current.y, sx: e.clientX, sy: e.clientY };
    }
  };

  const onCanvasPointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    // 1) dragging a table hub (zoom/pan-aware: screen px → world %)
    const d = dragRef.current;
    if (d) {
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
      d.moved = true;
      if (!rect || rect.width === 0) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      // Inside a defined room, keep tables within the walls (2–98%). On the
      // free auto-grow board, allow a wide range so tables can spread out.
      const lo = venueScaled ? 2 : -200;
      const hi = venueScaled ? 98 : 600;
      const x = Math.max(lo, Math.min(hi, (((sx - panRef.current.x) / zoomRef.current) / rect.width) * 100));
      const y = Math.max(lo, Math.min(hi, (((sy - panRef.current.y) / zoomRef.current) / rect.height) * 100));
      if (d.kind === 'table') {
        // Slide around neighbours: snap to the nearest spot that doesn't overlap.
        const moving = tables.find((t) => t.table_id === d.id);
        const free = moving
          ? nearestFree(x, y, moving, rect, (o, i) => positions[o.table_id] ?? defaultGrid(i, tables.length, !venueScaled))
          : { x, y };
        setPositions((p) => ({ ...p, [d.id]: free }));
      } else if (d.kind === 'stage') {
        setStage({ x, y });
      } else {
        setEntrance((en) => ({ ...en, x, y }));
      }
      return;
    }
    if (!rect) return;
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    // 2) pinch-zoom
    if (pinchRef.current && pointersRef.current.size >= 2) {
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) || 1;
      const z1 = clampZoom(pinchRef.current.zoom * (dist / pinchRef.current.dist));
      const mx = (pts[0]!.x + pts[1]!.x) / 2 - rect.left;
      const my = (pts[0]!.y + pts[1]!.y) / 2 - rect.top;
      applyView(z1, { x: mx - z1 * pinchRef.current.wx, y: my - z1 * pinchRef.current.wy });
      return;
    }
    // 3) pan
    if (panStartRef.current) {
      const s = panStartRef.current;
      applyView(zoomRef.current, { x: s.px + (e.clientX - s.sx), y: s.py + (e.clientY - s.sy) });
    }
  };

  const onCanvasPointerUp = (e?: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragId(null);
    if (d?.moved) {
      if (d.kind === 'table') setDirty((s) => new Set(s).add(d.id));
      else setFloorDirty(true);
    }
    if (e) pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) panStartRef.current = null;
  };

  const addEntrance = () => {
    setEntrance({ enabled: true, x: 50, y: 94 });
    setFloorDirty(true);
  };
  const removeEntrance = () => {
    setEntrance((en) => ({ ...en, enabled: false }));
    setFloorDirty(true);
  };

  // Zoom around the viewport centre (for the +/- buttons).
  const zoomAround = (factor: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = rect.width / 2;
    const sy = rect.height / 2;
    const z0 = zoomRef.current;
    const p0 = panRef.current;
    const z1 = clampZoom(z0 * factor);
    applyView(z1, { x: sx - z1 * ((sx - p0.x) / z0), y: sy - z1 * ((sy - p0.y) / z0) });
  };

  // Frame every table in view (the "see all 50" button).
  const fitView = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (tables.length === 0) {
      applyView(1, { x: 0, y: 0 });
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    tables.forEach((t, i) => {
      const pos = positions[t.table_id] ?? defaultGrid(i, tables.length, !venueScaled);
      const geo = tableGeometry(shapeHintFor(t.table_type), t.capacity);
      // Use the ON-SCREEN size (to-scale shrinks tables in venue mode), so the
      // bounding box is tight and Fit zooms in enough to make tables readable.
      const s = pxPerMeter ? (TABLE_FOOTPRINT_M[t.table_type] * pxPerMeter) / geo.box.w : 1;
      const cx = (pos.x / 100) * rect.width;
      const cy = (pos.y / 100) * rect.height;
      minX = Math.min(minX, cx - (geo.box.w * s) / 2);
      maxX = Math.max(maxX, cx + (geo.box.w * s) / 2);
      minY = Math.min(minY, cy - (geo.box.h * s) / 2);
      maxY = Math.max(maxY, cy + (geo.box.h * s) / 2);
    });
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);
    const z1 = clampZoom(Math.min(rect.width / bw, rect.height / bh) * 0.86);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    applyView(z1, { x: rect.width / 2 - z1 * cx, y: rect.height / 2 - z1 * cy });
  };

  // Reset to a clean whole-room overview (zoom 1, no pan) whenever to-scale mode
  // toggles — the height-capped canvas then shows every table at once. The
  // couple zooms in (smooth pan, or Fit) to work on individual tables.
  useEffect(() => {
    if (venueScaled) applyView(1, { x: 0, y: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueScaled]);

  // Free (no room size) mode: the board auto-grows as tables are added, so
  // auto-fit to keep them all framed at comfortable spacing. Fires on the
  // table count changing (the deliberate "board grew" moment) — not while
  // seating guests — so it never yanks the view mid-work.
  const prevFreeCountRef = useRef(-1);
  useEffect(() => {
    if (view !== 'plan' || venueScaled) {
      prevFreeCountRef.current = -1;
      return;
    }
    if (tables.length === 0) {
      applyView(1, { x: 0, y: 0 });
      return;
    }
    if (prevFreeCountRef.current !== tables.length) {
      prevFreeCountRef.current = tables.length;
      fitView();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.length, venueScaled, view]);

  const layoutDirty = dirty.size > 0 || floorDirty;
  const saveLayout = () => {
    const ids = Array.from(dirty);
    const fdDirty = floorDirty;
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
      if (fdDirty) {
        const fd = new FormData();
        fd.set('event_id', eventId);
        fd.set('stage_x', String(stage.x));
        fd.set('stage_y', String(stage.y));
        fd.set('entrance_enabled', entrance.enabled ? 'true' : 'false');
        fd.set('entrance_x', String(entrance.x));
        fd.set('entrance_y', String(entrance.y));
        if (venue.enabled && venue.width > 0 && venue.length > 0) {
          fd.set('venue_width_m', String(venue.width));
          fd.set('venue_length_m', String(venue.length));
        }
        await saveFloorPlan(fd);
      }
      setDirty(new Set());
      setFloorDirty(false);
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
      <aside className="flex max-h-[46vh] flex-col gap-3 overflow-y-auto rounded-2xl border border-ink/10 bg-cream p-3 lg:max-h-[78vh]">
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
                      pickedGroupId
                        ? 'cursor-pointer border-mulberry/30 ring-1 ring-mulberry/20 hover:bg-mulberry/5'
                        : highlightId === t.table_id
                          ? 'border-terracotta bg-terracotta/5'
                          : 'border-transparent hover:bg-ink/[0.03]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        pickedGroupId
                          ? seatGroupAt(t.table_id)
                          : setHighlightId((id) => (id === t.table_id ? null : t.table_id))
                      }
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
                        onClick={() => {
                          setPickedId(null);
                          setNotice(null);
                          setPickedGroupId((id) => (id === grp.group_id ? null : grp.group_id));
                        }}
                        aria-label={
                          pickedGroupId === grp.group_id
                            ? `Cancel seating ${grp.label}`
                            : `Seat ${grp.label} at a table`
                        }
                        title="Seat this whole group at a table"
                        className={`rounded p-1 ${
                          pickedGroupId === grp.group_id
                            ? 'bg-mulberry/10 text-mulberry'
                            : 'text-ink/40 hover:bg-ink/5'
                        }`}
                      >
                        <Armchair className="h-3.5 w-3.5" />
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
            <div className="inline-flex rounded-lg border border-ink/15 p-0.5">
              <button
                type="button"
                onClick={() => setView('plan')}
                aria-pressed={view === 'plan'}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                  view === 'plan' ? 'bg-ink/[0.06] text-ink' : 'text-ink/55 hover:text-ink'
                }`}
              >
                <MapIcon className="h-3.5 w-3.5" /> Floor plan
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                aria-pressed={view === 'list'}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                  view === 'list' ? 'bg-ink/[0.06] text-ink' : 'text-ink/55 hover:text-ink'
                }`}
              >
                <List className="h-3.5 w-3.5" /> List
              </button>
            </div>
            {view === 'plan' ? (
              <button
                type="button"
                onClick={() => setShowRoomPanel((v) => !v)}
                aria-pressed={showRoomPanel}
                className={`inline-flex items-center gap-1.5 rounded-lg border bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:border-terracotta ${
                  venueScaled ? 'border-terracotta/50' : 'border-ink/15'
                }`}
              >
                <Ruler className="h-3.5 w-3.5" />
                {venueScaled ? `${venue.width}×${venue.length} m` : 'Room size'}
              </button>
            ) : null}
            {view === 'plan' && !entrance.enabled ? (
              <button
                type="button"
                onClick={addEntrance}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:border-terracotta"
              >
                <DoorOpen className="h-3.5 w-3.5" /> Add entrance
              </button>
            ) : null}
            {view === 'plan' && layoutDirty ? (
              <button
                type="button"
                onClick={saveLayout}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:border-terracotta disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" /> Save layout ({dirty.size + (floorDirty ? 1 : 0)})
              </button>
            ) : null}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExport((v) => !v)}
                disabled={tables.length === 0}
                aria-haspopup="menu"
                aria-expanded={showExport}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:border-terracotta disabled:opacity-50"
              >
                <FileDown className="h-3.5 w-3.5" /> Export PDF
                <ChevronDown className="h-3 w-3 text-ink/40" />
              </button>
              {showExport ? (
                <>
                  <button
                    type="button"
                    aria-hidden
                    tabIndex={-1}
                    onClick={() => setShowExport(false)}
                    className="fixed inset-0 z-30 cursor-default"
                  />
                  <div
                    role="menu"
                    className="absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-xl border border-ink/10 bg-cream p-1 shadow-lg"
                  >
                    <a
                      role="menuitem"
                      href={`/dashboard/${eventId}/seating/export?mode=moodboard`}
                      onClick={() => setShowExport(false)}
                      className="flex flex-col gap-0.5 rounded-lg px-3 py-2 hover:bg-ink/[0.04]"
                    >
                      <span className="text-sm font-medium text-ink">Mood-board colours</span>
                      <span className="text-[11px] text-ink/55">Floor &amp; tables in your palette</span>
                    </a>
                    <a
                      role="menuitem"
                      href={`/dashboard/${eventId}/seating/export?mode=blueprint`}
                      onClick={() => setShowExport(false)}
                      className="flex flex-col gap-0.5 rounded-lg px-3 py-2 hover:bg-ink/[0.04]"
                    >
                      <span className="text-sm font-medium text-ink">Blueprint</span>
                      <span className="text-[11px] text-ink/55">Clean technical line drawing</span>
                    </a>
                    <p className="px-3 py-1.5 text-[10px] text-ink/45">
                      A4 PDF · floor plan + seating arrangements · with your monogram &amp; website QR.
                    </p>
                  </div>
                </>
              ) : null}
            </div>
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

        {view === 'plan' && showRoomPanel ? (
          <div className="flex flex-wrap items-end gap-4 rounded-xl border border-ink/10 bg-cream p-3">
            <label className="flex items-center gap-2 text-sm text-ink/75">
              <input
                type="checkbox"
                checked={venue.enabled}
                onChange={(e) => {
                  setVenue((v) => ({ ...v, enabled: e.target.checked }));
                  setFloorDirty(true);
                }}
                className="h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
              />
              Show room to scale
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">Width (m)</span>
              <input
                type="number"
                min={1}
                max={500}
                step={0.5}
                value={venue.width}
                onChange={(e) => {
                  setVenue((v) => ({ ...v, width: Number(e.target.value) || 0 }));
                  setFloorDirty(true);
                }}
                className="w-24 rounded-lg border border-ink/15 bg-cream px-2 py-1.5 text-sm outline-none focus:border-terracotta"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">Length (m)</span>
              <input
                type="number"
                min={1}
                max={500}
                step={0.5}
                value={venue.length}
                onChange={(e) => {
                  setVenue((v) => ({ ...v, length: Number(e.target.value) || 0 }));
                  setFloorDirty(true);
                }}
                className="w-24 rounded-lg border border-ink/15 bg-cream px-2 py-1.5 text-sm outline-none focus:border-terracotta"
              />
            </label>
            <p className="flex-1 text-xs text-ink/50">
              Enter your reception room&rsquo;s width × length and tables render at their true footprint, so you can
              see what fits. <span className="text-ink/40">Zoom in to seat people; Fit to see the whole room.</span>
            </p>
          </div>
        ) : null}

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

        {pickedGroup ? (
          <div className="flex items-center gap-3 rounded-xl border border-mulberry/40 bg-mulberry/5 px-3 py-2 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: pickedGroup.color }} />
            <span className="min-w-0 flex-1 truncate">
              Seating <span className="font-semibold text-ink">{pickedGroup.label}</span> (
              {pickedGroupMemberIds.length}{' '}
              {pickedGroupMemberIds.length === 1 ? 'member' : 'members'}) — tap a table.
            </span>
            <button
              type="button"
              onClick={() => setPickedGroupId(null)}
              className="rounded-md p-1 text-ink/40 hover:bg-ink/5"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {notice ? (
          <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span className="min-w-0 flex-1">{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="rounded-md p-1 text-amber-700 hover:bg-amber-100"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {view === 'plan' ? (
        <>
        <div
          ref={canvasRef}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerCancel={onCanvasPointerUp}
          className={`relative cursor-grab touch-none overflow-hidden rounded-2xl border border-ink/15 bg-ink/[0.02] active:cursor-grabbing ${
            venueScaled ? 'mx-auto' : 'aspect-[7/5] w-full'
          }`}
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(30,34,41,0.06) 1px, transparent 0)',
            backgroundSize: '22px 22px',
            // To scale: take the room's aspect ratio, but cap the height (a 64vh
            // budget drives the width) so a portrait room doesn't balloon into a
            // giant canvas. Centered; never wider than the column.
            ...(venueScaled
              ? {
                  aspectRatio: `${venue.width} / ${venue.length}`,
                  width: `min(100%, calc(64vh * ${venue.width} / ${venue.length}))`,
                }
              : {}),
          }}
        >
          {/* world layer — pan/zoom applied to its transform directly via refs */}
          <div ref={worldRef} className="absolute inset-0 will-change-transform" style={{ transformOrigin: '0 0' }}>
          {/* room outline (walls) + metric labels, when a venue size is set */}
          {venueScaled ? (
            <>
              <div className="pointer-events-none absolute inset-0 rounded-lg border-2 border-ink/25" />
              <span className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 rounded bg-cream/80 px-1.5 text-[9px] font-medium text-ink/55">
                {venue.width} m
              </span>
              <span className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 -rotate-90 rounded bg-cream/80 px-1.5 text-[9px] font-medium text-ink/55">
                {venue.length} m
              </span>
            </>
          ) : null}
          {/* draggable stage marker (auto-seat anchors its rings here) */}
          <button
            type="button"
            onPointerDown={onMarkerPointerDown('stage')}
            aria-label="Stage — drag to move"
            className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 select-none rounded-md border bg-cream/85 px-6 py-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-ink/70 shadow-sm backdrop-blur-sm ${
              dragId === '__stage__' ? 'border-terracotta cursor-grabbing' : 'border-ink/25 cursor-grab'
            }`}
            style={{ left: `${stage.x}%`, top: `${stage.y}%` }}
          >
            Stage · Head Table
          </button>

          {/* draggable entrance door marker */}
          {entrance.enabled ? (
            <div
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${entrance.x}%`, top: `${entrance.y}%` }}
            >
              <button
                type="button"
                onPointerDown={onMarkerPointerDown('entrance')}
                aria-label="Entrance — drag to move"
                className={`flex select-none items-center gap-1.5 rounded-md border bg-cream/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-ink/70 shadow-sm backdrop-blur-sm ${
                  dragId === '__entrance__' ? 'border-terracotta cursor-grabbing' : 'border-ink/25 cursor-grab'
                }`}
              >
                <DoorOpen className="h-3.5 w-3.5 text-terracotta-700" /> Entrance
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={removeEntrance}
                aria-label="Remove entrance"
                className="absolute -right-2 -top-2 rounded-full border border-ink/15 bg-cream p-0.5 text-ink/45 shadow-sm hover:text-rose-600"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : null}

          {tables.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-ink/40">
              Add a table from the sidebar to start your floor plan.
            </div>
          ) : null}

          {tables.map((t, i) => {
            const pos = positions[t.table_id] ?? defaultGrid(i, tables.length, !venueScaled);
            const shape = shapeHintFor(t.table_type);
            const geo = tableGeometry(shape, t.capacity);
            const rectish = shape === 'long_banquet' || shape === 'family_head';
            const occ = occupantsFor(t);
            const filled = occ.filter(Boolean).length;
            const halo = dominantColor(occ, colorFor);
            const highlighted = highlightId === t.table_id;
            const dragging = dragId === t.table_id;
            const num = t.table_label.match(/\d+/)?.[0] ?? '';
            // Serpentine (and any future curved shape) carries a closed polygon
            // we draw as an SVG ribbon instead of a circle/rect hub. Seat-space
            // is y-down, matching SVG, so the points feed straight in.
            const ribbonPath = geo.outline
              ? geo.outline.map((p, k) => `${k === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + 'Z'
              : null;
            const showRibbon = ribbonPath !== null && detail;
            // To-scale factor: render the table at its true footprint relative
            // to the room (1 when no venue size is set → unchanged appearance).
            const tableScale = pxPerMeter
              ? (TABLE_FOOTPRINT_M[t.table_type] * pxPerMeter) /
                (detail ? geo.box.w : geo.hub.w + 12)
              : 1;

            return (
              <div
                key={t.table_id}
                className="absolute"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  width: detail ? geo.box.w : geo.hub.w + 12,
                  height: detail ? geo.box.h : geo.hub.h + 12,
                  transform: `translate(-50%, -50%) scale(${tableScale})`,
                  transition: dragging ? 'none' : 'left 140ms ease, top 140ms ease',
                  zIndex: dragging ? 30 : 20,
                }}
              >
                {/* group-tint halo */}
                {halo ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-md"
                    style={{
                      width: geo.hub.w + 56,
                      height: geo.hub.h + 56,
                      backgroundColor: halo,
                      opacity: 0.18,
                    }}
                  />
                ) : null}

                {/* serpentine ribbon body (curved table) — drawn behind the
                    chairs, and itself the drag handle */}
                {showRibbon ? (
                  <svg
                    className="absolute inset-0 h-full w-full overflow-visible"
                    viewBox={`${-geo.box.w / 2} ${-geo.box.h / 2} ${geo.box.w} ${geo.box.h}`}
                    onPointerDown={onHubPointerDown(t)}
                    style={{ cursor: pickedId || pickedGroupId ? 'pointer' : dragging ? 'grabbing' : 'grab' }}
                  >
                    <path
                      d={ribbonPath!}
                      className={`fill-cream ${highlighted ? 'stroke-terracotta' : 'stroke-ink/25'}`}
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                ) : null}

                {/* chairs — only at detail zoom; pucks when zoomed out */}
                {detail
                  ? geo.seats.map((s, i) => {
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
                            if (pickedGroupId) seatGroupAt(t.table_id);
                            else if (pickedId) place(t.table_id, i);
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
                            if (pickedGroupId) seatGroupAt(t.table_id);
                            else if (pickedId) place(t.table_id, i);
                          }}
                          aria-label={`Empty seat ${i + 1}`}
                          className={`block h-full w-full transition ${
                            pickedId || pickedGroupId
                              ? 'text-terracotta hover:text-terracotta-600'
                              : 'text-ink/30 hover:text-ink/50'
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
                    })
                  : null}

                {/* hub (drag handle + place-at-next-free target) — for the
                    serpentine ribbon the SVG above is the body + drag handle, so
                    we show only a centred number/count badge here instead. */}
                {showRibbon ? (
                  <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
                    <span className="text-sm font-semibold text-ink">{num || '·'}</span>
                    <span className="text-[8px] font-medium uppercase tracking-wide text-ink/45">
                      {filled}/{t.capacity}
                    </span>
                  </div>
                ) : (
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
                )}
              </div>
            );
          })}
          </div>
          {/* end world layer */}

          {/* zoom controls */}
          <div className="absolute bottom-3 right-3 z-20 flex flex-col overflow-hidden rounded-lg border border-ink/15 bg-cream/90 shadow-sm backdrop-blur-sm">
            <button
              type="button"
              onClick={() => zoomAround(1.25)}
              aria-label="Zoom in"
              className="px-2 py-1.5 text-ink/70 hover:bg-ink/5"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => zoomAround(0.8)}
              aria-label="Zoom out"
              className="border-t border-ink/10 px-2 py-1.5 text-ink/70 hover:bg-ink/5"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={fitView}
              aria-label="Fit all tables in view"
              className="border-t border-ink/10 px-2 py-1.5 text-ink/70 hover:bg-ink/5"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <p className="text-xs text-ink/50">
          Scroll or pinch to zoom · drag the background to pan · <Maximize2 className="inline h-3 w-3" /> fits every
          table. Zoom in to seat individual chairs; drag a table&rsquo;s centre to move it, then Save layout.
        </p>
        </>
        ) : (
          <div className="space-y-2">
            {tables.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ink/20 bg-cream p-8 text-center text-sm text-ink/50">
                No tables yet — add one from the panel above to start seating.
              </div>
            ) : (
              <ul className="space-y-2">
                {tables.map((t) => {
                  const occ = occupantsFor(t);
                  const seated = occ.filter((g): g is SeatingGuest => g !== null);
                  const full = seated.length >= t.capacity;
                  const free = occ.indexOf(null);
                  const expanded = expandedCards.has(t.table_id);
                  const halo = dominantColor(occ, colorFor);
                  const open = t.capacity - seated.length;
                  return (
                    <li key={t.table_id} className="overflow-hidden rounded-xl border border-ink/10 bg-cream">
                      <div className="flex items-center gap-2 p-3">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: halo ?? NEUTRAL }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            pickedGroupId
                              ? seatGroupAt(t.table_id)
                              : setExpandedCards((s) => {
                                  const n = new Set(s);
                                  n.has(t.table_id) ? n.delete(t.table_id) : n.add(t.table_id);
                                  return n;
                                })
                          }
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">{t.table_label}</span>
                            <span className="block text-[11px] text-ink/55">{TABLE_TYPE_LABEL[t.table_type]}</span>
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              full ? 'bg-emerald-100 text-emerald-700' : 'bg-ink/5 text-ink/55'
                            }`}
                          >
                            {seated.length}/{t.capacity}
                          </span>
                          <ChevronDown className={`h-4 w-4 text-ink/40 transition ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTable(t.table_id)}
                          aria-label={`Delete ${t.table_label}`}
                          className="rounded p-1 text-ink/30 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3">
                        {seated.length === 0 ? (
                          <span className="text-xs text-ink/40">No one seated yet.</span>
                        ) : (
                          seated.map((g) => (
                            <button
                              key={g.guest_id}
                              type="button"
                              onClick={() => setPickedId(g.guest_id)}
                              title={`${g.name} — tap to move`}
                              className="rounded-full"
                            >
                              <ChairAvatar guest={g} color={colorFor(g)} size={28} />
                            </button>
                          ))
                        )}
                        {pickedId && !full ? (
                          <button
                            type="button"
                            onClick={() => place(t.table_id, free >= 0 ? free : null)}
                            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-terracotta px-2.5 py-1 text-xs font-medium text-cream hover:bg-terracotta-600"
                          >
                            <Armchair className="h-3.5 w-3.5" /> Seat here
                          </button>
                        ) : null}
                        {pickedGroupId && !full ? (
                          <button
                            type="button"
                            onClick={() => seatGroupAt(t.table_id)}
                            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-mulberry px-2.5 py-1 text-xs font-medium text-cream hover:bg-mulberry-600"
                          >
                            <Armchair className="h-3.5 w-3.5" /> Seat group here
                          </button>
                        ) : null}
                      </div>

                      {expanded ? (
                        <ul className="space-y-0.5 border-t border-ink/10 p-2">
                          {seated.map((g) => (
                            <li key={g.guest_id} className="flex items-center gap-2 rounded-lg px-1.5 py-1">
                              <ChairAvatar guest={g} color={colorFor(g)} size={24} />
                              <span className="min-w-0 flex-1 truncate text-sm text-ink">{g.name}</span>
                              <button
                                type="button"
                                onClick={() => unseat(g.guest_id)}
                                aria-label={`Unseat ${g.name}`}
                                className="inline-flex items-center gap-1 rounded-md border border-ink/15 px-2 py-1 text-[11px] text-ink/70 hover:border-rose-400 hover:text-rose-600"
                              >
                                <UserMinus className="h-3.5 w-3.5" /> Unseat
                              </button>
                            </li>
                          ))}
                          {open > 0 ? (
                            <li className="px-1.5 py-1 text-[11px] text-ink/40">
                              {open} open {open === 1 ? 'seat' : 'seats'}.
                            </li>
                          ) : null}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="px-1 text-xs text-ink/50">
              Pick a guest in the panel above, then tap <span className="font-medium text-ink/70">Seat here</span> on a
              table. Tap a seated avatar to move them. To seat a whole group at once, tap the{' '}
              <Armchair className="inline h-3 w-3" /> beside a group, then choose a table.
            </p>
          </div>
        )}
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
