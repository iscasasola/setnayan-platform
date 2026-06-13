'use client';

import { useEffect, useLayoutEffect, useMemo, useOptimistic, useRef, useState, useTransition } from 'react';

// useLayoutEffect on the server is a no-op + warns; fall back to useEffect there.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
import {
  Armchair,
  CakeSlice,
  Camera,
  ChevronDown,
  DoorOpen,
  Eye,
  EyeOff,
  FileDown,
  Footprints,
  Gift,
  Link2,
  List,
  Map as MapIcon,
  Martini,
  Maximize2,
  Minus,
  Package,
  Plus,
  Printer,
  RotateCcw,
  RotateCw,
  Ruler,
  Save,
  Search,
  Sparkles,
  Store,
  Trash2,
  Truck,
  Unlink,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import {
  BOOTH_CATALOG,
  CHAIR_PX,
  ROLE_TIER_LABELS,
  SIDE_COLORS,
  TABLE_FOOTPRINT_M,
  boothPerimeterSlots,
  clampBoothToPerimeter,
  computeAutoLayout,
  freeBoothSlots,
  defaultTablePosition,
  effectiveCapacity,
  guestTier,
  removedSeatSet,
  roleTier,
  rectChainSnap,
  rotatePoint,
  roundKissSnap,
  serpentineChainSnap,
  TABLE_TYPE_CATALOG,
  TABLE_TYPE_LABEL,
  shapeHintFor,
  tableGeometry,
  type BoothType,
  type EventTableRow,
  type FloorBoothRow,
  type FloorPlanRow,
  type TableType,
} from '@/lib/seating';
import {
  assignGroup,
  assignGuest,
  autoArrange,
  createTable,
  deleteTable,
  linkTables,
  publishSeating,
  saveBooths,
  saveFloorPlan,
  seatRoleAtTable,
  setGuestSeatingPriority,
  setTableSeat,
  unassignGuest,
  unlinkTable,
  updateTableLabel,
  updateTablePosition,
  updateTableRotation,
} from '../actions';
import { useSeatingPresence } from './use-seating-presence';

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
  // Role taxonomy (0001) — drives the popup's "Role" picker tab via roleTier().
  role: string;
  group_category: string;
  // Catering data (0001 RSVP) — surfaced on the picker rows + list view; the
  // caterer report aggregates it per table unit.
  meal_preference: string | null;
  dietary_restrictions: string | null;
  // Explicit priority-tier override (1–4); null = derived from role/group.
  seating_priority: number | null;
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
  booths: FloorBoothRow[];
  // Who I am, for live presence (cursors + "editing Table N" rings).
  me: { id: string; name: string };
};

const NEUTRAL = '#B7B1A6';

type LocalPos = { x: number; y: number };

// Optimistic seating ops — applied instantly client-side, then reconciled when
// the server action's revalidation lands (so seating/unseating feels instant).
type GuestSeatOp =
  | { type: 'seat'; guestId: string; tableId: string; seat: number | null }
  | { type: 'unseat'; guestId: string }
  | { type: 'seatGroup'; ids: string[]; tableId: string }
  | { type: 'priority'; guestId: string; value: number | null };

// Default placement for an un-positioned table — shared with the PDF + day-of
// map (lib/seating) so the layout matches everywhere.
const defaultGrid = defaultTablePosition;

export function SeatingEditor({
  eventId,
  tables: tablesProp,
  guests: guestsProp,
  groups,
  floorPlan,
  booths: boothsProp,
  me,
}: Props) {
  // Optimistic overlays: a seat/unseat/delete shows immediately, then the
  // server action revalidates and these reconcile to the authoritative data.
  const [guests, applyGuestOpt] = useOptimistic(guestsProp, (state: SeatingGuest[], op: GuestSeatOp) => {
    switch (op.type) {
      case 'seat':
        return state.map((g) =>
          g.guest_id === op.guestId ? { ...g, seated_table_id: op.tableId, seat_number: op.seat } : g,
        );
      case 'unseat':
        return state.map((g) =>
          g.guest_id === op.guestId ? { ...g, seated_table_id: null, seat_number: null } : g,
        );
      case 'priority':
        return state.map((g) =>
          g.guest_id === op.guestId ? { ...g, seating_priority: op.value } : g,
        );
      case 'seatGroup': {
        const set = new Set(op.ids);
        return state.map((g) =>
          set.has(g.guest_id) ? { ...g, seated_table_id: op.tableId, seat_number: null } : g,
        );
      }
      default:
        return state;
    }
  });
  const [tables, applyTableOpt] = useOptimistic(
    tablesProp,
    (state: EventTableRow[], op: { type: 'delete'; id: string }) =>
      op.type === 'delete' ? state.filter((t) => t.table_id !== op.id) : state,
  );

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    kind: 'table' | 'stage' | 'entrance' | 'service' | 'dance' | 'booth';
    id: string;
    sx: number;
    sy: number;
    moved: boolean;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Floor-plan kit (all coords/sizes are percent of the canvas): a resizable
  // stage, the main entrance, an optional service door, and a resizable
  // dance-floor zone that tables can't be dropped inside.
  const [stage, setStage] = useState({
    x: floorPlan.stage_x,
    y: floorPlan.stage_y,
    w: floorPlan.stage_w,
    h: floorPlan.stage_h,
  });
  const [entrance, setEntrance] = useState({
    enabled: floorPlan.entrance_enabled,
    x: floorPlan.entrance_x,
    y: floorPlan.entrance_y,
  });
  const [serviceDoor, setServiceDoor] = useState({
    enabled: floorPlan.service_entrance_enabled,
    x: floorPlan.service_entrance_x,
    y: floorPlan.service_entrance_y,
  });
  const [dance, setDance] = useState({
    enabled: floorPlan.dance_enabled,
    x: floorPlan.dance_x,
    y: floorPlan.dance_y,
    w: floorPlan.dance_w,
    h: floorPlan.dance_h,
  });
  // Vendor booths (Photo Booth, Mobile Bar, …) — perimeter-anchored markers.
  // New booths get a tmp- id until the next save returns real rows; the prop
  // re-syncs local state whenever there's nothing unsaved (boothsDirty=false),
  // so a server revalidation can't clobber an in-flight drag.
  const [booths, setBooths] = useState<FloorBoothRow[]>(boothsProp);
  const [boothsDirty, setBoothsDirty] = useState(false);
  const boothsDirtyRef = useRef(false);
  boothsDirtyRef.current = boothsDirty;
  const tmpBoothSeq = useRef(0);
  useEffect(() => {
    if (!boothsDirtyRef.current) setBooths(boothsProp);
  }, [boothsProp]);
  // Live floor-plan geometry for the booth perimeter rules (lib/seating).
  const boothFp = () => ({
    stage_x: stage.x,
    stage_y: stage.y,
    stage_w: stage.w,
    stage_h: stage.h,
    entrance_enabled: entrance.enabled,
    entrance_x: entrance.x,
    entrance_y: entrance.y,
    service_entrance_enabled: serviceDoor.enabled,
    service_entrance_x: serviceDoor.x,
    service_entrance_y: serviceDoor.y,
  });
  // Drag-resize of the stage / dance-floor (SE grip, NW corner anchored) and
  // of the venue walls. Self-contained pointer handlers on the grips; the
  // pxPerMeter is FROZEN at wall-grab so the canvas resizing mid-drag can't
  // feed back into the drag math.
  const rectDragRef = useRef<{
    kind: 'stage' | 'dance';
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    sx: number;
    sy: number;
  } | null>(null);
  const wallDragRef = useRef<{
    edge: 'e' | 's' | 'se';
    startW: number;
    startL: number;
    sx: number;
    sy: number;
    ppm: number;
  } | null>(null);
  const [wallSettled, setWallSettled] = useState(0);
  // Live alignment guides while dragging a table: when the dragged centre
  // lines up with another table's centre (or the room centreline) we snap to
  // it and draw a hairline. Ref (not state) — the drag already re-renders per
  // move via setPositions, so the render below just reads the latest value.
  const guidesRef = useRef<{ x: number | null; y: number | null }>({ x: null, y: null });
  // Venue dimensions (metres) → render the room + tables to scale.
  const [venue, setVenue] = useState({
    enabled: floorPlan.venue_width_m !== null && floorPlan.venue_length_m !== null,
    width: floorPlan.venue_width_m ?? 20,
    length: floorPlan.venue_length_m ?? 30,
  });
  const [showRoomPanel, setShowRoomPanel] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showAddBooth, setShowAddBooth] = useState(false);
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
  // Optimistic rotation override so a rotate tap is instant (the server action
  // revalidates + the prop catches up). Keyed by table_id; falls back to the row.
  const [rotById, setRotById] = useState<Record<string, number>>({});

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
  // Re-render trigger for the per-table popup overlay. Bumped only when the view
  // SETTLES (pan/pinch/zoom-button end) — never per-frame — so the popup
  // repositions to the selected table without touching the 50-table fast path
  // (worldRef still transforms via refs during continuous pan/zoom).
  const [, bumpOverlay] = useState(0);
  // In-context "Seat people" picker inside the per-table popup. Tab + query are
  // component state (not panel-local) so the search input survives re-renders;
  // the panel closes whenever the selection changes.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<'guest' | 'group' | 'role'>('guest');
  const [pickerQ, setPickerQ] = useState('');
  useEffect(() => {
    setPickerOpen(false);
    setPickerQ('');
  }, [highlightId]);
  // Link-mode: started from a table's popup; the NEXT table tapped on the
  // canvas joins it into one named unit (identity + QR only).
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  // Live presence: who else is in this seat plan, which table they have
  // selected, and their cursor on the canvas (Supabase Realtime).
  const { peers, sendCursor } = useSeatingPresence(eventId, me, highlightId);
  const peerList = [...peers.values()];
  const peerOnTable = (tableId: string) => peerList.find((p) => p.table === tableId) ?? null;
  const [showAddTable, setShowAddTable] = useState(false);
  const [confirmAuto, setConfirmAuto] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<EventTableRow | null>(null);
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
  // Phone breakpoint → the per-table popup renders as a bottom sheet (thumb-zone,
  // larger tap targets) instead of a beside-table popover. Tracked live on resize
  // so rotating a tablet or resizing a window swaps the surface correctly.
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsPhone(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Scroll-wheel / trackpad zoom toward the cursor (non-passive so we can
  // preventDefault the page scroll). Re-attached when the plan view mounts.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || view !== 'plan') return;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const z0 = zoomRef.current;
      const p0 = panRef.current;
      const z1 = clampZoom(z0 * Math.exp(-e.deltaY * 0.0015));
      applyView(z1, { x: sx - z1 * ((sx - p0.x) / z0), y: sy - z1 * ((sy - p0.y) / z0) });
      // Reposition the popup once the trackpad/wheel zoom SETTLES (debounced —
      // never per-frame, so the worldRef pan/zoom fast path stays intact).
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => bumpOverlay((v) => v + 1), 140);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (settleTimer) clearTimeout(settleTimer);
    };
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
    const removed = removedSeatSet(t.removed_seats, t.capacity);
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
    // Fill leftovers into the next free, non-deleted chair.
    for (const g of leftovers) {
      let free = -1;
      for (let i = 0; i < occ.length; i++) {
        if (occ[i] === null && !removed.has(i)) {
          free = i;
          break;
        }
      }
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
    const guestId = pickedId;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('table_id', tableId);
    fd.set('guest_id', guestId);
    if (seatNumber !== null) fd.set('seat_number', String(seatNumber));
    setPickedId(null);
    startTransition(async () => {
      applyGuestOpt({ type: 'seat', guestId, tableId, seat: seatNumber });
      await assignGuest(fd);
    });
  };

  const unseat = (guestId: string) => {
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('guest_id', guestId);
    if (pickedId === guestId) setPickedId(null);
    startTransition(async () => {
      applyGuestOpt({ type: 'unseat', guestId });
      await unassignGuest(fd);
    });
  };

  const removeTable = (tableId: string) => {
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('table_id', tableId);
    if (highlightId === tableId) setHighlightId(null);
    startTransition(async () => {
      applyTableOpt({ type: 'delete', id: tableId });
      await deleteTable(fd);
    });
  };

  // Deleting a table cascades its seat assignments (DB ON DELETE CASCADE),
  // silently returning everyone at it to the unseated pool — so a table with
  // seated guests asks first. Empty tables keep one-tap delete.
  const seatedAt = (tableId: string) => guests.filter((g) => g.seated_table_id === tableId).length;
  const requestRemoveTable = (t: EventTableRow) => {
    if (seatedAt(t.table_id) === 0) removeTable(t.table_id);
    else setConfirmDelete(t);
  };

  // Every table's current %-position (saved spot, else its default-grid home) —
  // shared by free-venue booth placement so booths tuck behind the real tables.
  const tablePointsNow = () =>
    tables.map((t, i) => positions[t.table_id] ?? defaultGrid(i, tables.length, !venueScaled));

  // One-click Auto Arrange — three deterministic steps, all free sorting
  // logic (no AI): (1) computeAutoLayout rebuilds the table grid stage-out,
  // (2) booths re-anchor — to the legal wall band in a sized room, or into a
  // tidy row behind the tables in a free venue (gardens / open fields have no
  // walls), (3) the server's role-tier auto-seat fills guests into the layout.
  // Optimistic: the new geometry paints immediately; the server action then
  // persists positions + booths and seats guests in one round-trip.
  const runAutoArrange = () => {
    setConfirmAuto(false);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const fp = boothFp();
    const layout = computeAutoLayout({
      tables,
      floorPlan: {
        ...fp,
        dance_enabled: dance.enabled,
        dance_x: dance.x,
        dance_y: dance.y,
        dance_w: dance.w,
        dance_h: dance.h,
      },
      rect: { width: rect.width, height: rect.height },
      footprintOf: footprintPx,
    });
    // Sized room → hug the walls; free venue → a row behind the tables.
    const slots = venueScaled
      ? boothPerimeterSlots(fp, booths.length)
      : freeBoothSlots(
          { x: stage.x, y: stage.y },
          tables.map((t, i) => layout[t.table_id] ?? positions[t.table_id] ?? defaultGrid(i, tables.length, !venueScaled)),
          booths.length,
        );
    const nextBooths = booths.map((b, i) => ({
      ...b,
      x_pos: slots[i]?.x ?? b.x_pos,
      y_pos: slots[i]?.y ?? b.y_pos,
    }));
    setPositions((p) => ({ ...p, ...layout }));
    setBooths(nextBooths);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('positions', JSON.stringify(layout));
    fd.set('booths', boothsPayload(nextBooths));
    startTransition(async () => {
      const res = await autoArrange(fd);
      // The action persisted everything it was sent — nothing is "unsaved".
      setDirty(new Set());
      setBoothsDirty(false);
      const boothWhere = venueScaled ? 'on the perimeter' : 'behind the tables';
      setNotice(
        res.seated > 0
          ? `Auto-arranged: ${tables.length} tables in priority order, ${nextBooths.length} booth${nextBooths.length === 1 ? '' : 's'} ${boothWhere}, ${res.seated} guest${res.seated === 1 ? '' : 's'} seated.`
          : `Auto-arranged: ${tables.length} tables in priority order${nextBooths.length > 0 ? ` and ${nextBooths.length} booth${nextBooths.length === 1 ? '' : 's'} ${boothWhere}` : ''}. Everyone attending is already seated.`,
      );
    });
  };

  // Tap the P-chip to cycle a guest's explicit priority override: from the
  // derived tier it starts an override at 1, then 2→3→4, then back to derived
  // (null). Optimistic — the chip flips instantly, the server persists.
  const cyclePriority = (g: SeatingGuest) => {
    const next =
      g.seating_priority === null ? 1 : g.seating_priority >= 4 ? null : g.seating_priority + 1;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('guest_id', g.guest_id);
    fd.set('priority', next === null ? '' : String(next));
    startTransition(async () => {
      applyGuestOpt({ type: 'priority', guestId: g.guest_id, value: next });
      await setGuestSeatingPriority(fd);
    });
  };

  // Publish the seating pack + open the printable sign sheets. The print route
  // reads live data so the pack works immediately; publishSeating stamps the
  // "published" timestamps in the background. window.open is called synchronously
  // in the click gesture so it isn't popup-blocked.
  const publishAndPrint = () => {
    const fd = new FormData();
    fd.set('event_id', eventId);
    // Await inside the transition so the callback returns Promise<void>
    // (startTransition rejects a value-returning promise); the {published}
    // result is intentionally ignored — the print route reads live data.
    startTransition(async () => {
      await publishSeating(fd);
    });
    window.open(`/dashboard/${eventId}/seating/print`, '_blank');
  };

  // Rename a table from the popup's inline field. No-op on an empty/unchanged
  // label; revalidation reflects the new name across the sidebar, list + print.
  const renameTable = (tableId: string, label: string) => {
    const trimmed = label.trim();
    const current = tables.find((t) => t.table_id === tableId)?.table_label ?? '';
    if (!trimmed || trimmed === current) return;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('table_id', tableId);
    fd.set('table_label', trimmed.slice(0, 64));
    startTransition(() => updateTableLabel(fd));
  };

  // Bulk-seat a group onto a table (seat-what-fits; the server returns counts
  // and we surface a notice on overflow). Used by the pick-then-tap flow AND
  // the popup's in-context "Seat people" picker.
  const seatGroupMembers = (groupId: string, tableId: string) => {
    const groupLabel = groups.find((g) => g.group_id === groupId)?.label ?? 'group';
    const memberIds = guests.filter((g) => g.group_id === groupId).map((g) => g.guest_id);
    setNotice(null);
    if (memberIds.length === 0) return;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('table_id', tableId);
    fd.set('guest_ids', JSON.stringify(memberIds));
    startTransition(async () => {
      applyGuestOpt({ type: 'seatGroup', ids: memberIds, tableId });
      const res = await assignGroup(fd);
      if (res && res.overflow > 0) {
        const label = tableLabelById.get(tableId) ?? 'that table';
        setNotice(
          `${groupLabel}: seated ${res.seated} of ${res.requested} at ${label} — ${res.overflow} didn't fit. Pick another table for the rest.`,
        );
      }
    });
  };

  const seatGroupAt = (tableId: string) => {
    if (!pickedGroupId) return;
    const groupId = pickedGroupId;
    setPickedGroupId(null);
    seatGroupMembers(groupId, tableId);
  };

  // Seat one guest at a table's next free chair (the picker's Guest tab —
  // also moves an already-seated guest, since assignGuest upserts per guest).
  const seatGuestHere = (t: EventTableRow, guestId: string) => {
    const occ = occupantsFor(t);
    const removed = removedSeatSet(t.removed_seats, t.capacity);
    let free: number | null = null;
    for (let i = 0; i < occ.length; i++) {
      if (occ[i] === null && !removed.has(i)) {
        free = i;
        break;
      }
    }
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('table_id', t.table_id);
    fd.set('guest_id', guestId);
    if (free !== null) fd.set('seat_number', String(free));
    startTransition(async () => {
      applyGuestOpt({ type: 'seat', guestId, tableId: t.table_id, seat: free });
      await assignGuest(fd);
    });
  };

  // Seat a whole role tier here (the picker's Role tab). Server-side
  // seat-what-fits; we surface the overflow notice like group seating.
  const seatTierHere = (t: EventTableRow, tier: 1 | 2 | 3 | 4) => {
    setNotice(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('table_id', t.table_id);
    fd.set('tier', String(tier));
    startTransition(async () => {
      const res = await seatRoleAtTable(fd);
      if (res && res.overflow > 0) {
        setNotice(
          `${ROLE_TIER_LABELS[tier]}: seated ${res.seated} of ${res.requested} at ${t.table_label} — ${res.overflow} didn't fit. Pick another table for the rest.`,
        );
      }
    });
  };

  // Link two tables into one named unit / dissolve a unit (identity + QR only —
  // seating math stays per-table; the print pack emits ONE sign per unit).
  // A successful link is visually quiet (the joined table just adopts the
  // unit's name — it doesn't move), so say what happened in the notice bar;
  // without it a working link reads as "nothing happened".
  const doLinkTables = (fromId: string, toId: string) => {
    setLinkingFrom(null);
    const fromLabel = tableLabelById.get(fromId) ?? 'the first table';
    const toLabel = tableLabelById.get(toId) ?? 'the second table';
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('table_id_a', fromId);
    fd.set('table_id_b', toId);
    startTransition(async () => {
      try {
        await linkTables(fd);
        setNotice(
          `Linked — “${toLabel}” is now part of “${fromLabel}”: one name, one printed QR sign. They stay separate tables on the floor, so drag them side-by-side if you want them touching. Use the unlink button to undo.`,
        );
      } catch {
        setNotice(`Couldn't link “${fromLabel}” and “${toLabel}” — please try again.`);
      }
    });
  };
  const doUnlink = (tableId: string) => {
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('table_id', tableId);
    startTransition(async () => {
      try {
        await unlinkTable(fd);
        setNotice('Unlinked — every table in that unit is back to its own name and QR sign.');
      } catch {
        setNotice(`Couldn't unlink the table — please try again.`);
      }
    });
  };

  // The table's current orientation (optimistic override → row default).
  const rotationOf = (t: EventTableRow) => rotById[t.table_id] ?? t.rotation_deg ?? 0;

  // --- continuous rotation (two-finger twist + the desktop rotate handle) ----
  // Two-finger: first finger starts a table drag; when a SECOND finger lands,
  // the drag converts into a rotate gesture (Δangle between the two pointers).
  // A ~6° dead-zone stops an intended pinch from nudging the table. The live
  // angle previews via rotById (same optimistic path the rotate buttons use)
  // and commits once on release.
  const rotateGestureRef = useRef<{
    tableId: string;
    startAngle: number;
    startRot: number;
    latched: boolean;
    latest: number;
  } | null>(null);
  // Desktop fallback: a handle above the selected table dragged in a circle.
  // cx/cy = the table centre in client coords, frozen at handle-grab.
  const handleRotRef = useRef<{
    tableId: string;
    cx: number;
    cy: number;
    startAngle: number;
    startRot: number;
    latest: number;
  } | null>(null);
  // Serpentine chain snap may rotate the dragged wedge mid-drag (the joint
  // dictates the angle); the final angle commits once on release.
  const serpSnapRotRef = useRef<{ id: string; rot: number } | null>(null);

  const angleDeg = (cx: number, cy: number, px: number, py: number) =>
    (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
  const normDeg = (d: number) => ((Math.round(d) % 360) + 360) % 360;
  const snapDeg = (d: number, step: number) => normDeg(Math.round(d / step) * step);

  // Persist a final orientation exactly (1° granularity — unlike the ±15°
  // buttons, a continuous gesture may land on a fine angle via Shift).
  const commitRotation = (tableId: string, deg: number) => {
    const next = normDeg(deg);
    setRotById((m) => ({ ...m, [tableId]: next }));
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('table_id', tableId);
    fd.set('rotation_deg', String(next));
    startTransition(() => updateTableRotation(fd));
  };

  // Rotate a table by `delta` degrees (or to an absolute angle). Snaps to 15°,
  // updates instantly, persists. Rotation is what lets wedges/banquets connect.
  const rotateTable = (t: EventTableRow, delta: number, absolute = false) => {
    const base = absolute ? 0 : rotationOf(t);
    const next = ((Math.round((base + delta) / 15) * 15) % 360 + 360) % 360;
    setRotById((m) => ({ ...m, [t.table_id]: next }));
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('table_id', t.table_id);
    fd.set('rotation_deg', String(next));
    startTransition(() => updateTableRotation(fd));
  };

  // Delete / restore a single chair (clears the edge where two tables connect).
  const toggleSeat = (tableId: string, seatNumber: number, removed: boolean) => {
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('table_id', tableId);
    fd.set('seat_number', String(seatNumber));
    fd.set('removed', removed ? 'true' : 'false');
    startTransition(() => setTableSeat(fd));
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
    // The dance floor is a no-table zone: a table can't be dropped inside it
    // (drags slide around it via nearestFree, same as around other tables).
    if (dance.enabled) {
      const dzw = (dance.w / 100) * rect.width;
      const dzh = (dance.h / 100) * rect.height;
      const ddx = Math.abs(((x - dance.x) / 100) * rect.width);
      const ddy = Math.abs(((y - dance.y) / 100) * rect.height);
      if (ddx < (m.w + dzw) / 2 && ddy < (m.h + dzh) / 2) return true;
    }
    return tables.some((o, i) => {
      if (o.table_id === moving.table_id) return false;
      // Chainable families never "collide" with their own kind: serpentine
      // wedges chain tip-to-tip and banquet/family-head runs join end-flush,
      // so their bounding boxes overlap BY DESIGN (the box includes chair
      // overhang past the tabletop). Without this exemption the mount-time
      // resolver tears saved chains apart on every reload. Rounds keep
      // colliding — their kiss snap lands just OUTSIDE the threshold.
      const ms = shapeHintFor(moving.table_type);
      const os = shapeHintFor(o.table_type);
      const rectish = (s: typeof ms) => s === 'long_banquet' || s === 'family_head';
      if ((ms === 'serpentine' && os === 'serpentine') || (rectish(ms) && rectish(os))) {
        return false;
      }
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
  // Skipped DURING a wall drag (the canvas resizes every frame, which would
  // reshuffle un-anchored tables); re-resolves once on release via wallSettled.
  useIsoLayoutEffect(() => {
    if (wallDragRef.current) return;
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
  }, [tables, venueScaled, canvasW, wallSettled]);

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
    // This drag-start fully owns the gesture — don't let it bubble to the
    // canvas. onCanvasPointerDown's two-finger-rotate detector can't tell this
    // first finger from a genuine SECOND finger (both arrive with
    // pointersRef.size === 1), so without this it cancels the drag the instant
    // it begins — the table won't move. A real second finger lands on the
    // canvas (not this hub), so it still reaches the rotate detector.
    e.stopPropagation();
    dragRef.current = { kind: 'table', id: t.table_id, sx: e.clientX, sy: e.clientY, moved: false };
    setDragId(t.table_id);
    // Tracked in pointersRef too, so a SECOND finger landing on the canvas can
    // pair with this one and convert the drag into a two-finger rotate.
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Drag the floor-plan elements (same pointer model as a table hub).
  const onMarkerPointerDown =
    (kind: 'stage' | 'entrance' | 'service' | 'dance') => (e: React.PointerEvent) => {
      if (pickedId) {
        // Don't seat onto a marker, and don't start a pan.
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      // Same as the table hub: this drag-start owns the gesture, so keep it off
      // the canvas pointer handler (no stray pan / gesture-detection on a marker
      // drag).
      e.stopPropagation();
      dragRef.current = { kind, id: kind, sx: e.clientX, sy: e.clientY, moved: false };
      setDragId(`__${kind}__`);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

  // Drag a vendor booth — same pointer model, but the move handler runs the
  // hardcoded perimeter snap (clampBoothToPerimeter) on every frame, so a
  // booth can only travel along the legal wall band.
  const onBoothPointerDown = (boothId: string) => (e: React.PointerEvent) => {
    if (pickedId || pickedGroupId) {
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { kind: 'booth', id: boothId, sx: e.clientX, sy: e.clientY, moved: false };
    setDragId(`__booth_${boothId}__`);
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
  // takes precedence and is handled in the move branch below. A second finger
  // landing DURING a table drag converts it into a two-finger ROTATE of that
  // table (touch parity with the desktop rotate handle).
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (d) {
      if (d.kind !== 'table') return; // stage/entrance: ignore extra fingers
      const first = pointersRef.current.get([...pointersRef.current.keys()][0] ?? -1);
      if (!first || pointersRef.current.size !== 1) return;
      const t = tables.find((x) => x.table_id === d.id);
      if (!t) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvasRef.current?.setPointerCapture(e.pointerId);
      rotateGestureRef.current = {
        tableId: d.id,
        startAngle: angleDeg(first.x, first.y, e.clientX, e.clientY),
        startRot: rotationOf(t),
        latched: false,
        latest: rotationOf(t),
      };
      // The drag is over — the gesture is now a rotation.
      dragRef.current = null;
      panStartRef.current = null;
      pinchRef.current = null;
      return;
    }
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
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    // Live presence: share my cursor in world coords (throttled in the hook).
    if (rect && rect.width > 0) {
      sendCursor(
        (((e.clientX - rect.left - panRef.current.x) / zoomRef.current) / rect.width) * 100,
        (((e.clientY - rect.top - panRef.current.y) / zoomRef.current) / rect.height) * 100,
      );
    }
    // 0) two-finger rotate of a table — Δangle between the two pointers, with
    // a ~6° dead-zone so a pinch that brushes a table doesn't nudge it. Live
    // preview through rotById (snapped to 15°); committed once on release.
    const rg = rotateGestureRef.current;
    if (rg && pointersRef.current.size >= 2) {
      const pts = [...pointersRef.current.values()];
      const cur = angleDeg(pts[0]!.x, pts[0]!.y, pts[1]!.x, pts[1]!.y);
      let delta = cur - rg.startAngle;
      // shortest-arc wrap so crossing ±180° doesn't spin the table
      delta = ((delta + 540) % 360) - 180;
      if (!rg.latched && Math.abs(delta) < 6) return;
      rg.latched = true;
      const next = snapDeg(rg.startRot + delta, 15);
      if (next !== rg.latest) {
        rg.latest = next;
        setRotById((m) => ({ ...m, [rg.tableId]: next }));
      }
      return;
    }
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
        // Table chaining: when dragging near a same-family table's connection
        // point, magnet them together — serpentine tips chain into an
        // S / circle (position + rotation), banquet/family-head ends join
        // flush into one continuous run (position + rotation), and rounds
        // kiss edge-to-edge with the chair rings clearing (position only).
        // Wins over the alignment/grid snap; Alt drags free. Chained pairs
        // skip the collision pass (they're MEANT to touch) and overlapsAny
        // exempts the touching families so saved chains survive remounts.
        const movingEarly = tables.find((t) => t.table_id === d.id);
        const movingShape = movingEarly ? shapeHintFor(movingEarly.table_type) : null;
        if (movingEarly && movingShape && !e.altKey && movingShape !== 'sweetheart') {
          const dragPx = { x: (x / 100) * rect.width, y: (y / 100) * rect.height };
          const isRect = (s: ReturnType<typeof shapeHintFor>) =>
            s === 'long_banquet' || s === 'family_head';
          const pxOf = (o: EventTableRow) => {
            const i = tables.indexOf(o);
            const p = positions[o.table_id] ?? defaultGrid(i, tables.length, !venueScaled);
            return { x: (p.x / 100) * rect.width, y: (p.y / 100) * rect.height };
          };
          // Tabletop half-length (rects) — hub only, chairs hang past it.
          const halfLenOf = (o: EventTableRow) => {
            const g = tableGeometry(shapeHintFor(o.table_type), o.capacity);
            return (g.hub.w / 2) * (footprintPx(o).w / g.box.w);
          };
          let snap: { x: number; y: number; rot?: number } | null = null;
          if (movingShape === 'serpentine') {
            const serpBoxW = tableGeometry('serpentine', movingEarly.capacity).box.w;
            snap = serpentineChainSnap(
              dragPx,
              tables
                .filter((o) => o.table_id !== d.id && shapeHintFor(o.table_type) === 'serpentine')
                .map((o) => ({ ...pxOf(o), rot: rotationOf(o), scale: footprintPx(o).w / serpBoxW })),
            );
          } else if (isRect(movingShape)) {
            snap = rectChainSnap(
              dragPx,
              halfLenOf(movingEarly),
              tables
                .filter((o) => o.table_id !== d.id && isRect(shapeHintFor(o.table_type)))
                .map((o) => ({ ...pxOf(o), rot: rotationOf(o), halfLen: halfLenOf(o) })),
            );
          } else if (movingShape === 'round') {
            snap = roundKissSnap(
              dragPx,
              footprintPx(movingEarly).w / 2,
              tables
                .filter((o) => o.table_id !== d.id && shapeHintFor(o.table_type) === 'round')
                .map((o) => ({ ...pxOf(o), radius: footprintPx(o).w / 2 })),
            );
          }
          if (snap) {
            guidesRef.current = { x: null, y: null };
            const nx = Math.max(lo, Math.min(hi, (snap.x / rect.width) * 100));
            const ny = Math.max(lo, Math.min(hi, (snap.y / rect.height) * 100));
            if (snap.rot !== undefined) {
              serpSnapRotRef.current = { id: d.id, rot: snap.rot };
              if (rotationOf(movingEarly) !== snap.rot) {
                setRotById((m) => ({ ...m, [d.id]: snap.rot! }));
              }
            }
            setPositions((p) => ({ ...p, [d.id]: { x: nx, y: ny } }));
            return;
          }
        }
        // Alignment snap: pull to another table's centre (or the room
        // centreline) when within tolerance — the matched axis draws a guide
        // hairline. Hold Alt to drag free of all snapping.
        let ax = x;
        let ay = y;
        let gx: number | null = null;
        let gy: number | null = null;
        if (!e.altKey) {
          const TOL = 1.2; // percent of the canvas
          for (const o of tables) {
            if (o.table_id === d.id) continue;
            const op = positions[o.table_id];
            if (!op) continue;
            if (gx === null && Math.abs(op.x - x) < TOL) {
              ax = op.x;
              gx = op.x;
            }
            if (gy === null && Math.abs(op.y - y) < TOL) {
              ay = op.y;
              gy = op.y;
            }
            if (gx !== null && gy !== null) break;
          }
          // Room centreline detents (symmetric layouts want the middle).
          if (gx === null && Math.abs(50 - x) < TOL) {
            ax = 50;
            gx = 50;
          }
          if (gy === null && Math.abs(50 - y) < TOL) {
            ay = 50;
            gy = 50;
          }
          // Grid snap on any axis that didn't alignment-snap: half-metre steps
          // in a sized room, 2% steps on the free board.
          const gridX = venueScaled ? (0.5 / venue.width) * 100 : 2;
          const gridY = venueScaled ? (0.5 / venue.length) * 100 : 2;
          if (gx === null) ax = Math.round(ax / gridX) * gridX;
          if (gy === null) ay = Math.round(ay / gridY) * gridY;
        }
        guidesRef.current = { x: gx, y: gy };
        // Follow the cursor directly (with the alignment + grid snap above).
        // We deliberately DON'T run the overlap resolver here: it used to
        // spiral an already-touching table far across the room on the first
        // pixel of a drag — the "table jumps a lot to the right when clicked"
        // bug, worst on round/sweetheart (collision-prone) and invisible on
        // banquet/serpentine (same-kind collision is exempt + they chain).
        // The couple can place tables wherever they like, touching included;
        // the mount-time auto-place still gives un-positioned tables a
        // non-overlapping home, so nothing lands stacked on load.
        setPositions((p) => ({ ...p, [d.id]: { x: ax, y: ay } }));
      } else if (d.kind === 'stage') {
        setStage((s) => ({ ...s, x, y }));
      } else if (d.kind === 'dance') {
        setDance((dz) => ({ ...dz, x, y }));
      } else if (d.kind === 'service') {
        setServiceDoor((sd) => ({ ...sd, x, y }));
      } else if (d.kind === 'booth') {
        // In a SIZED room the perimeter rules run live: snap to the nearest
        // legal wall position, clear of the stage wall, door corridors and
        // other booths. In a FREE venue (garden / open field) there are no
        // walls to hug — the booth drops wherever it's dragged (board-clamped,
        // like a table). Owner-directed 2026-06-13.
        const p = venueScaled
          ? clampBoothToPerimeter(
              x,
              y,
              boothFp(),
              booths.filter((b) => b.booth_id !== d.id).map((b) => ({ x: b.x_pos, y: b.y_pos })),
            )
          : { x, y };
        setBooths((bs) => bs.map((b) => (b.booth_id === d.id ? { ...b, x_pos: p.x, y_pos: p.y } : b)));
      } else {
        setEntrance((en) => ({ ...en, x, y }));
      }
      return;
    }
    if (!rect) return;
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
    // End of a two-finger rotate: persist the final angle once (only if it
    // actually latched past the dead-zone) when either finger lifts.
    const rg = rotateGestureRef.current;
    if (rg) {
      rotateGestureRef.current = null;
      if (rg.latched && rg.latest !== rg.startRot) commitRotation(rg.tableId, rg.latest);
    }
    const d = dragRef.current;
    dragRef.current = null;
    setDragId(null);
    guidesRef.current = { x: null, y: null };
    const serpRot = serpSnapRotRef.current;
    serpSnapRotRef.current = null;
    if (d?.moved) {
      if (d.kind === 'table') {
        setDirty((s) => new Set(s).add(d.id));
        // The chain snap rotated the wedge to fit the joint — persist it once.
        if (serpRot && serpRot.id === d.id) {
          const t = tables.find((x) => x.table_id === d.id);
          if (t && (t.rotation_deg ?? 0) !== serpRot.rot) commitRotation(d.id, serpRot.rot);
        }
      } else if (d.kind === 'booth') setBoothsDirty(true);
      else setFloorDirty(true);
    } else if (d && d.kind === 'table' && !pickedId && !pickedGroupId) {
      if (linkingFrom && d.id !== linkingFrom) {
        // Link-mode: this tap joins the two tables into one named unit.
        doLinkTables(linkingFrom, d.id);
      } else {
        // A tap (no drag) on a table selects it → opens the popup toolbar.
        setHighlightId((id) => (id === d.id ? null : d.id));
      }
    }
    if (e) pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) panStartRef.current = null;
    // View settled after a pan/pinch — reposition the popup to its table.
    bumpOverlay((v) => v + 1);
  };

  const addEntrance = () => {
    setEntrance({ enabled: true, x: 50, y: 94 });
    setFloorDirty(true);
  };
  const removeEntrance = () => {
    setEntrance((en) => ({ ...en, enabled: false }));
    setFloorDirty(true);
  };
  const addServiceDoor = () => {
    setServiceDoor({ enabled: true, x: 97, y: 50 });
    setFloorDirty(true);
  };
  const removeServiceDoor = () => {
    setServiceDoor((sd) => ({ ...sd, enabled: false }));
    setFloorDirty(true);
  };
  const addDanceFloor = () => {
    setDance((dz) => ({ ...dz, enabled: true }));
    setFloorDirty(true);
  };
  const removeDanceFloor = () => {
    setDance((dz) => ({ ...dz, enabled: false }));
    setFloorDirty(true);
  };
  // Add a vendor booth. Sized room → it spawns onto the nearest legal
  // perimeter spot (bottom-centre bias), never mid-room. Free venue → into the
  // tidy row behind the tables (no walls to hug); the couple drags from there.
  const addBooth = (type: BoothType) => {
    const label = BOOTH_CATALOG.find((b) => b.type === type)?.label ?? 'Booth';
    const p = venueScaled
      ? clampBoothToPerimeter(
          50,
          96,
          boothFp(),
          booths.map((b) => ({ x: b.x_pos, y: b.y_pos })),
        )
      : freeBoothSlots({ x: stage.x, y: stage.y }, tablePointsNow(), booths.length + 1)[booths.length] ?? {
          x: stage.x,
          y: 90,
        };
    tmpBoothSeq.current += 1;
    setBooths((bs) => [
      ...bs,
      {
        booth_id: `tmp-${tmpBoothSeq.current}`,
        event_id: eventId,
        booth_type: type,
        label,
        x_pos: p.x,
        y_pos: p.y,
        sort_order: bs.length,
      },
    ]);
    setBoothsDirty(true);
  };
  const removeBooth = (boothId: string) => {
    setBooths((bs) => bs.filter((b) => b.booth_id !== boothId));
    setBoothsDirty(true);
  };
  // Serialize local booth state for the server (tmp ids become inserts).
  const boothsPayload = (bs: FloorBoothRow[]) =>
    JSON.stringify(
      bs.map((b, i) => ({
        booth_id: b.booth_id.startsWith('tmp-') ? null : b.booth_id,
        booth_type: b.booth_type,
        label: b.label,
        x_pos: b.x_pos,
        y_pos: b.y_pos,
        sort_order: i,
      })),
    );

  // SE resize grip for the stage / dance-floor rects. NW-corner anchored: the
  // grip drags the bottom-right corner; the centre shifts by half the delta so
  // the top-left edge stays put. Self-contained pointer capture on the grip.
  const onRectGripDown = (kind: 'stage' | 'dance') => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const cur = kind === 'stage' ? stage : dance;
    rectDragRef.current = {
      kind,
      startX: cur.x,
      startY: cur.y,
      startW: cur.w,
      startH: cur.h,
      sx: e.clientX,
      sy: e.clientY,
    };
  };
  const onRectGripMove = (e: React.PointerEvent) => {
    const r = rectDragRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!r || !rect || rect.width === 0) return;
    e.stopPropagation();
    const dW = ((e.clientX - r.sx) / zoomRef.current / rect.width) * 100;
    const dH = ((e.clientY - r.sy) / zoomRef.current / rect.height) * 100;
    const w = Math.max(4, Math.min(96, r.startW + dW));
    const h = Math.max(3, Math.min(96, r.startH + dH));
    const x = r.startX + (w - r.startW) / 2;
    const y = r.startY + (h - r.startH) / 2;
    if (r.kind === 'stage') setStage({ x, y, w, h });
    else setDance((dz) => ({ ...dz, x, y, w, h }));
    setFloorDirty(true);
  };
  const onRectGripUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    rectDragRef.current = null;
  };

  // Venue wall handles (to-scale mode): drag the right/bottom edge or the SE
  // corner to resize the ROOM. px→metres uses the scale FROZEN at grab time —
  // the canvas itself resizes during the drag, so reading it live would feed
  // back into the math. Auto-place is paused during the drag (wallDragRef) and
  // re-resolves once on release (wallSettled).
  const onWallGripDown = (edge: 'e' | 's' | 'se') => (e: React.PointerEvent) => {
    if (!pxPerMeter) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    wallDragRef.current = {
      edge,
      startW: venue.width,
      startL: venue.length,
      sx: e.clientX,
      sy: e.clientY,
      ppm: pxPerMeter,
    };
  };
  const onWallGripMove = (e: React.PointerEvent) => {
    const w = wallDragRef.current;
    if (!w) return;
    e.stopPropagation();
    // Half-metre steps keep the readout clean while dragging.
    const stepM = (px: number) => Math.round((px / w.ppm) * 2) / 2;
    setVenue((v) => ({
      ...v,
      width: w.edge !== 's' ? Math.max(4, Math.min(500, w.startW + stepM(e.clientX - w.sx))) : v.width,
      length: w.edge !== 'e' ? Math.max(4, Math.min(500, w.startL + stepM(e.clientY - w.sy))) : v.length,
    }));
    setFloorDirty(true);
  };
  const onWallGripUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (wallDragRef.current) {
      wallDragRef.current = null;
      setWallSettled((v) => v + 1);
    }
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
    bumpOverlay((v) => v + 1);
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
    bumpOverlay((v) => v + 1);
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

  const layoutDirty = dirty.size > 0 || floorDirty || boothsDirty;
  const saveLayout = () => {
    const ids = Array.from(dirty);
    const fdDirty = floorDirty;
    const bDirty = boothsDirty;
    startTransition(async () => {
      if (bDirty) {
        const fd = new FormData();
        fd.set('event_id', eventId);
        fd.set('booths', boothsPayload(booths));
        await saveBooths(fd);
        setBoothsDirty(false);
      }
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
        fd.set('stage_w', String(stage.w));
        fd.set('stage_h', String(stage.h));
        fd.set('entrance_enabled', entrance.enabled ? 'true' : 'false');
        fd.set('entrance_x', String(entrance.x));
        fd.set('entrance_y', String(entrance.y));
        fd.set('dance_enabled', dance.enabled ? 'true' : 'false');
        fd.set('dance_x', String(dance.x));
        fd.set('dance_y', String(dance.y));
        fd.set('dance_w', String(dance.w));
        fd.set('dance_h', String(dance.h));
        fd.set('service_entrance_enabled', serviceDoor.enabled ? 'true' : 'false');
        fd.set('service_entrance_x', String(serviceDoor.x));
        fd.set('service_entrance_y', String(serviceDoor.y));
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
                const cap = effectiveCapacity(t.capacity, t.removed_seats);
                const full = filled >= cap;
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
                        <span className="block truncate text-sm font-medium text-ink">
                          {t.link_group_id ? (
                            <Link2 className="mr-1 inline h-3 w-3 text-mulberry/70" />
                          ) : null}
                          {t.link_group_label ?? t.table_label}
                        </span>
                        <span className="block text-[11px] text-ink/50">
                          {filled}/{cap} · {TABLE_TYPE_LABEL[t.table_type]}
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
                      onClick={() => requestRemoveTable(t)}
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
                  onCyclePriority={() => cyclePriority(g)}
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
                              onCyclePriority={() => cyclePriority(g)}
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
            {peerList.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-cream"
                style={{ backgroundColor: p.color }}
                title={p.table ? `${p.name} is editing ${tableLabelById.get(p.table) ?? 'a table'}` : `${p.name} is here`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-cream/90" />
                {p.name}
              </li>
            ))}
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
            {view === 'plan' && !serviceDoor.enabled ? (
              <button
                type="button"
                onClick={addServiceDoor}
                title="Optional load-in / caterer door"
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:border-terracotta"
              >
                <Truck className="h-3.5 w-3.5" /> Service door
              </button>
            ) : null}
            {view === 'plan' && !dance.enabled ? (
              <button
                type="button"
                onClick={addDanceFloor}
                title="A no-table zone — tables can't be dropped inside"
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:border-terracotta"
              >
                <Footprints className="h-3.5 w-3.5" /> Dance floor
              </button>
            ) : null}
            {view === 'plan' ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAddBooth((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={showAddBooth}
                  title={
                    venueScaled
                      ? 'Vendor booths anchor to the walls — never blocking the stage or doors'
                      : 'Vendor booths — drop them anywhere; an open venue has no walls'
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:border-terracotta"
                >
                  <Store className="h-3.5 w-3.5" /> Add booth
                  <ChevronDown className="h-3 w-3 text-ink/40" />
                </button>
                {showAddBooth ? (
                  <>
                    <button
                      type="button"
                      aria-hidden
                      tabIndex={-1}
                      onClick={() => setShowAddBooth(false)}
                      className="fixed inset-0 z-30 cursor-default"
                    />
                    <div
                      role="menu"
                      className="absolute left-0 z-40 mt-1 w-48 overflow-hidden rounded-xl border border-ink/10 bg-cream p-1 shadow-lg"
                    >
                      {BOOTH_CATALOG.map((b) => (
                        <button
                          key={b.type}
                          role="menuitem"
                          type="button"
                          onClick={() => {
                            setShowAddBooth(false);
                            addBooth(b.type);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-ink/[0.04]"
                        >
                          <BoothIcon type={b.type} className="h-4 w-4 text-terracotta-700" />
                          {b.label}
                        </button>
                      ))}
                      <p className="px-3 py-1.5 text-[10px] text-ink/45">
                        {venueScaled
                          ? 'Booths snap to the perimeter — clear of the stage wall & door paths.'
                          : 'Open venue — place booths anywhere; no walls to hug.'}
                      </p>
                    </div>
                  </>
                ) : null}
              </div>
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
                    <a
                      role="menuitem"
                      href={`/dashboard/${eventId}/seating/caterer`}
                      target="_blank"
                      onClick={() => setShowExport(false)}
                      className="flex flex-col gap-0.5 rounded-lg px-3 py-2 hover:bg-ink/[0.04]"
                    >
                      <span className="text-sm font-medium text-ink">Caterer meal counts</span>
                      <span className="text-[11px] text-ink/55">Meals per table + dietary notes · print or CSV</span>
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
              onClick={publishAndPrint}
              disabled={tables.length === 0}
              title="Publish the plan and open printable table signs + place cards"
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:border-terracotta disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" /> Publish &amp; print
            </button>
            <button
              type="button"
              onClick={() => setConfirmAuto(true)}
              disabled={isPending || tables.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-mulberry px-3 py-1.5 text-xs font-semibold text-cream hover:bg-mulberry-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" /> Auto Arrange
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

        {linkingFrom ? (
          <div className="flex items-center gap-3 rounded-xl border border-terracotta/40 bg-terracotta/5 px-3 py-2 text-sm">
            <Link2 className="h-4 w-4 shrink-0 text-terracotta-700" />
            <span className="min-w-0 flex-1 truncate">
              Linking{' '}
              <span className="font-semibold text-ink">
                {tableLabelById.get(linkingFrom) ?? 'table'}
              </span>{' '}
              — tap another table to combine them into one named table.
            </span>
            <button
              type="button"
              onClick={() => setLinkingFrom(null)}
              className="rounded-md p-1 text-ink/40 hover:bg-ink/5"
              aria-label="Cancel linking"
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

        {/* Per-table actions (rename · rotate · delete) now live in the floating
            popup overlay anchored beside the selected table on the canvas — see below. */}

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
          {/* alignment guide hairlines — drawn while a table drag snaps to
              another table's centre / the room centreline (guidesRef) */}
          {dragId && guidesRef.current.x !== null ? (
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-0 top-0 z-[15] w-px bg-terracotta/60"
              style={{ left: `${guidesRef.current.x}%` }}
            />
          ) : null}
          {dragId && guidesRef.current.y !== null ? (
            <div
              aria-hidden
              className="pointer-events-none absolute left-0 right-0 z-[15] h-px bg-terracotta/60"
              style={{ top: `${guidesRef.current.y}%` }}
            />
          ) : null}

          {/* live peer cursors (presence) — fade out after 5s of stillness */}
          {peerList.map((p) =>
            p.cursor && Date.now() - p.cursor.ts < 5000 ? (
              <div
                key={p.id}
                aria-hidden
                className="pointer-events-none absolute z-[35] -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${p.cursor.x}%`, top: `${p.cursor.y}%` }}
              >
                <span
                  className="block h-2.5 w-2.5 rounded-full border-2 border-cream shadow-sm"
                  style={{ backgroundColor: p.color }}
                />
                <span
                  className="absolute left-3 top-2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-cream shadow-sm"
                  style={{ backgroundColor: p.color }}
                >
                  {p.name}
                </span>
              </div>
            ) : null,
          )}

          {/* dance-floor zone — a draggable, resizable no-table area. Rendered
              under the tables so it reads as floor, not furniture. */}
          {dance.enabled ? (
            <div
              className="absolute z-[5]"
              style={{
                left: `${dance.x}%`,
                top: `${dance.y}%`,
                width: `${dance.w}%`,
                height: `${dance.h}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <button
                type="button"
                onPointerDown={onMarkerPointerDown('dance')}
                aria-label="Dance floor — drag to move"
                className={`flex h-full w-full select-none items-center justify-center rounded-lg border-2 border-dashed bg-mulberry/[0.04] text-[10px] font-semibold uppercase tracking-[0.2em] text-mulberry/70 ${
                  dragId === '__dance__' ? 'border-mulberry cursor-grabbing' : 'border-mulberry/40 cursor-grab'
                }`}
              >
                Dance floor
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={removeDanceFloor}
                aria-label="Remove dance floor"
                className="absolute -right-2 -top-2 rounded-full border border-ink/15 bg-cream p-0.5 text-ink/45 shadow-sm hover:text-rose-600"
              >
                <X className="h-3 w-3" />
              </button>
              <button
                type="button"
                onPointerDown={onRectGripDown('dance')}
                onPointerMove={onRectGripMove}
                onPointerUp={onRectGripUp}
                onPointerCancel={onRectGripUp}
                aria-label="Resize dance floor"
                title="Drag to resize the dance floor"
                className="absolute -bottom-2 -right-2 z-10 flex h-5 w-5 cursor-nwse-resize items-center justify-center rounded-md border-2 border-mulberry bg-cream text-mulberry shadow-sm"
              >
                <Maximize2 className="h-3 w-3 rotate-90" />
              </button>
            </div>
          ) : null}

          {/* resizable stage (auto-seat anchors its rings here) — drag the body
              to move, the corner grip to resize */}
          <div
            className="absolute z-10"
            style={{
              left: `${stage.x}%`,
              top: `${stage.y}%`,
              width: `${stage.w}%`,
              height: `${stage.h}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <button
              type="button"
              onPointerDown={onMarkerPointerDown('stage')}
              aria-label="Stage — drag to move"
              className={`flex h-full w-full select-none items-center justify-center overflow-hidden rounded-md border bg-cream/85 text-[10px] font-semibold uppercase tracking-[0.25em] text-ink/70 shadow-sm backdrop-blur-sm ${
                dragId === '__stage__' ? 'border-terracotta cursor-grabbing' : 'border-ink/25 cursor-grab'
              }`}
            >
              Stage
            </button>
            <button
              type="button"
              onPointerDown={onRectGripDown('stage')}
              onPointerMove={onRectGripMove}
              onPointerUp={onRectGripUp}
              onPointerCancel={onRectGripUp}
              aria-label="Resize stage"
              title="Drag to resize the stage"
              className="absolute -bottom-2 -right-2 z-10 flex h-5 w-5 cursor-nwse-resize items-center justify-center rounded-md border-2 border-terracotta bg-cream text-terracotta shadow-sm"
            >
              <Maximize2 className="h-3 w-3 rotate-90" />
            </button>
          </div>

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

          {/* optional service entrance (load-in / caterer door) */}
          {serviceDoor.enabled ? (
            <div
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${serviceDoor.x}%`, top: `${serviceDoor.y}%` }}
            >
              <button
                type="button"
                onPointerDown={onMarkerPointerDown('service')}
                aria-label="Service entrance — drag to move"
                className={`flex select-none items-center gap-1.5 rounded-md border bg-cream/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-ink/70 shadow-sm backdrop-blur-sm ${
                  dragId === '__service__' ? 'border-terracotta cursor-grabbing' : 'border-ink/25 cursor-grab'
                }`}
              >
                <Truck className="h-3.5 w-3.5 text-ink/50" /> Service
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={removeServiceDoor}
                aria-label="Remove service entrance"
                className="absolute -right-2 -top-2 rounded-full border border-ink/15 bg-cream p-0.5 text-ink/45 shadow-sm hover:text-rose-600"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : null}

          {/* vendor booths — perimeter-anchored markers; the drag handler runs
              the wall-snap rules live so they can't leave the legal band */}
          {booths.map((b) => (
            <div
              key={b.booth_id}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${b.x_pos}%`, top: `${b.y_pos}%` }}
            >
              <button
                type="button"
                onPointerDown={onBoothPointerDown(b.booth_id)}
                aria-label={`${b.label} — ${venueScaled ? 'drag along the walls' : 'drag to move'}`}
                className={`flex select-none items-center gap-1.5 rounded-md border bg-cream/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-ink/70 shadow-sm backdrop-blur-sm ${
                  dragId === `__booth_${b.booth_id}__`
                    ? 'border-terracotta cursor-grabbing'
                    : 'border-ink/25 cursor-grab'
                }`}
              >
                <BoothIcon type={b.booth_type} className="h-3.5 w-3.5 text-terracotta-700" />
                {b.label}
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => removeBooth(b.booth_id)}
                aria-label={`Remove ${b.label}`}
                className="absolute -right-2 -top-2 rounded-full border border-ink/15 bg-cream p-0.5 text-ink/45 shadow-sm hover:text-rose-600"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

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
            // Linked tables render under the UNIT's name (number when it has one).
            const displayLabel = t.link_group_label ?? t.table_label;
            const num = displayLabel.match(/\d+/)?.[0] ?? '';
            const rot = rotationOf(t); // table orientation (deg)
            const removed = removedSeatSet(t.removed_seats, t.capacity);
            const effCap = effectiveCapacity(t.capacity, t.removed_seats);
            // Serpentine (and any future curved shape) carries a closed polygon
            // we draw as an SVG ribbon instead of a circle/rect hub. Seat-space
            // is y-down, matching SVG; rotate the points by the table orientation.
            const ribbonPath = geo.outline
              ? geo.outline
                  .map((p0) => (rot ? rotatePoint(p0, rot) : p0))
                  .map((p, k) => `${k === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                  .join(' ') + 'Z'
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

                {/* presence ring — someone else has this table selected */}
                {(() => {
                  const peer = peerOnTable(t.table_id);
                  if (!peer) return null;
                  return (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed"
                      style={{
                        width: geo.hub.w + 18,
                        height: geo.hub.h + 18,
                        borderColor: peer.color,
                      }}
                    >
                      <span
                        className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-cream"
                        style={{ backgroundColor: peer.color }}
                      >
                        {peer.name}
                      </span>
                    </span>
                  );
                })()}

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
                  ? geo.seats.map((s0, i) => {
                  const s = rot ? rotatePoint(s0, rot) : s0;
                  const occupant = occ[i] ?? null;
                  const cx = geo.box.w / 2 + s.x;
                  const cy = geo.box.h / 2 + s.y;
                  // A deleted chair: show nothing, or a faint restore "+" when the
                  // table is selected so the couple can bring the chair back.
                  if (removed.has(i)) {
                    if (!highlighted) return null;
                    return (
                      <button
                        key={i}
                        type="button"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          toggleSeat(t.table_id, i, false);
                        }}
                        aria-label={`Restore seat ${i + 1}`}
                        title="Restore this chair"
                        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-ink/30 text-ink/35 transition hover:border-emerald-500 hover:text-emerald-600"
                        style={{ left: cx, top: cy, width: CHAIR_PX, height: CHAIR_PX }}
                      >
                        <Plus className="mx-auto h-1/2 w-1/2" />
                      </button>
                    );
                  }
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
                      {/* delete this chair — only on a selected table, on an empty
                          seat, when not mid-seating. Clears a connection edge. */}
                      {!occupant && highlighted && !pickedId && !pickedGroupId ? (
                        <button
                          type="button"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            toggleSeat(t.table_id, i, true);
                          }}
                          aria-label={`Delete seat ${i + 1}`}
                          title="Delete this chair"
                          className="absolute -right-1 -top-1 z-20 rounded-full border border-ink/15 bg-cream p-0.5 text-ink/40 shadow-sm transition hover:border-rose-400 hover:text-rose-600"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      ) : null}
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
                      {filled}/{effCap}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onPointerDown={onHubPointerDown(t)}
                    aria-label={`${t.table_label} — drag to move`}
                    className={`absolute left-1/2 top-1/2 flex select-none flex-col items-center justify-center border-2 bg-cream text-center shadow-sm transition ${
                      rot ? '' : '-translate-x-1/2 -translate-y-1/2'
                    } ${highlighted ? 'border-terracotta' : 'border-ink/25'} ${
                      pickedId ? 'cursor-pointer' : dragging ? 'cursor-grabbing' : 'cursor-grab'
                    }`}
                    style={{
                      width: geo.hub.w,
                      height: geo.hub.h,
                      borderRadius: geo.hub.shape === 'round' ? '9999px' : geo.hub.radius,
                      transform: rot ? `translate(-50%, -50%) rotate(${rot}deg)` : undefined,
                    }}
                  >
                    <div
                      className="flex flex-col items-center"
                      style={rot ? { transform: `rotate(${-rot}deg)` } : undefined}
                    >
                      <span className="text-sm font-semibold text-ink">{num || '·'}</span>
                      <span className="text-[8px] font-medium uppercase tracking-wide text-ink/45">
                        {filled}/{effCap}
                      </span>
                    </div>
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

          {/* wall handles (to-scale mode) — drag the right/bottom edge or the
              SE corner to resize the ROOM; the typed Room-size inputs stay as
              the precision alternative. px→metres uses the scale frozen at
              grab (the canvas itself resizes mid-drag). */}
          {venueScaled ? (
            <>
              <button
                type="button"
                onPointerDown={onWallGripDown('e')}
                onPointerMove={onWallGripMove}
                onPointerUp={onWallGripUp}
                onPointerCancel={onWallGripUp}
                aria-label="Drag to change the room width"
                title="Drag to resize the room width"
                className="absolute right-0 top-1/2 z-20 h-10 w-2.5 -translate-y-1/2 cursor-ew-resize rounded-l bg-ink/25 hover:bg-terracotta"
              />
              <button
                type="button"
                onPointerDown={onWallGripDown('s')}
                onPointerMove={onWallGripMove}
                onPointerUp={onWallGripUp}
                onPointerCancel={onWallGripUp}
                aria-label="Drag to change the room length"
                title="Drag to resize the room length"
                className="absolute bottom-0 left-1/2 z-20 h-2.5 w-10 -translate-x-1/2 cursor-ns-resize rounded-t bg-ink/25 hover:bg-terracotta"
              />
              <button
                type="button"
                onPointerDown={onWallGripDown('se')}
                onPointerMove={onWallGripMove}
                onPointerUp={onWallGripUp}
                onPointerCancel={onWallGripUp}
                aria-label="Drag to resize the room"
                title="Drag to resize the room"
                className="absolute bottom-0 right-0 z-20 flex h-5 w-5 cursor-nwse-resize items-center justify-center rounded-tl-md border border-ink/30 bg-cream text-ink/60 hover:border-terracotta hover:text-terracotta"
              >
                <Maximize2 className="h-3 w-3 rotate-90" />
              </button>
            </>
          ) : null}

          {/* Per-table popup toolbar — rename · rotate · delete, anchored beside the
              selected table. Settle-positioned (re-rendered on bumpOverlay at
              gesture-end), so it never taxes the continuous pan/zoom fast path. */}
          {(() => {
            const st = highlightId ? tables.find((t) => t.table_id === highlightId) : null;
            if (!st) return null;
            const curRot = rotationOf(st);

            // Phone → a bottom sheet pinned to the thumb zone with ≥44px targets
            // (the beside-table popover is too cramped on a small screen).
            if (isPhone) {
              return (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  className="fixed inset-x-0 bottom-0 z-50 border-t border-ink/15 bg-cream/95 px-4 pt-3 shadow-[0_-4px_20px_rgba(0,0,0,0.12)] backdrop-blur-sm"
                  style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
                >
                  <div className="mx-auto flex max-w-md flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        key={st.table_id}
                        defaultValue={st.table_label}
                        aria-label="Table name"
                        maxLength={64}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                          if (e.key === 'Escape') {
                            e.currentTarget.value = st.table_label;
                            e.currentTarget.blur();
                          }
                        }}
                        onBlur={(e) => renameTable(st.table_id, e.currentTarget.value)}
                        className="h-11 min-w-0 flex-1 rounded-xl border border-ink/15 bg-cream px-3 text-base font-medium text-ink outline-none focus:border-terracotta"
                      />
                      <button
                        type="button"
                        onClick={() => setPickerOpen((v) => !v)}
                        aria-pressed={pickerOpen}
                        aria-label="Seat people at this table"
                        className={`flex h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium ${
                          pickerOpen
                            ? 'border-terracotta bg-terracotta/10 text-terracotta-700'
                            : 'border-ink/15 text-ink/70 hover:bg-ink/5'
                        }`}
                      >
                        <UserPlus className="h-5 w-5" /> Seat
                      </button>
                      {st.link_group_id ? (
                        <button
                          type="button"
                          onClick={() => doUnlink(st.table_id)}
                          aria-label="Unlink this combined table"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ink/15 text-mulberry hover:bg-mulberry/10"
                        >
                          <Unlink className="h-5 w-5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setLinkingFrom(st.table_id);
                            setHighlightId(null);
                          }}
                          aria-label="Link with another table"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ink/15 text-ink/60 hover:bg-ink/5"
                        >
                          <Link2 className="h-5 w-5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setHighlightId(null)}
                        aria-label="Done"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ink/15 text-ink/50 hover:bg-ink/5"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    {pickerOpen ? (
                      <SeatPeoplePanel
                        table={st}
                        occ={occupantsFor(st)}
                        guests={guests}
                        groups={groups}
                        tab={pickerTab}
                        onTab={setPickerTab}
                        q={pickerQ}
                        onQ={setPickerQ}
                        colorFor={colorFor}
                        tableLabelById={tableLabelById}
                        onSeatGuest={(gid) => seatGuestHere(st, gid)}
                        onSeatGroup={(grpId) => seatGroupMembers(grpId, st.table_id)}
                        onSeatTier={(tier) => seatTierHere(st, tier)}
                      />
                    ) : null}
                    <div className="flex items-center gap-2">
                      <div className="flex flex-1 items-center justify-between rounded-xl border border-ink/15 px-1">
                        <button
                          type="button"
                          onClick={() => rotateTable(st, -15)}
                          aria-label="Rotate 15° left"
                          className="flex h-11 w-11 items-center justify-center rounded-lg text-ink/70 hover:bg-ink/5"
                        >
                          <RotateCcw className="h-5 w-5" />
                        </button>
                        <span className="text-sm tabular-nums text-ink/60">{curRot}°</span>
                        <button
                          type="button"
                          onClick={() => rotateTable(st, 15)}
                          aria-label="Rotate 15° right"
                          className="flex h-11 w-11 items-center justify-center rounded-lg text-ink/70 hover:bg-ink/5"
                        >
                          <RotateCw className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => rotateTable(st, 180)}
                          className="h-11 rounded-lg px-3 text-sm font-semibold text-ink/70 hover:bg-ink/5"
                        >
                          Flip
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => requestRemoveTable(st)}
                        aria-label="Delete table"
                        className="flex h-11 items-center gap-1.5 rounded-xl border border-ink/15 px-3 text-sm font-medium text-ink/70 hover:border-rose-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-5 w-5" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            // Desktop / tablet → a popover anchored beside the selected table.
            const rect = canvasRef.current?.getBoundingClientRect();
            const pos = positions[st.table_id];
            if (!rect || !pos) return null;
            const z = zoomRef.current;
            const cx = (pos.x / 100) * rect.width * z + panRef.current.x;
            const cy = (pos.y / 100) * rect.height * z + panRef.current.y;
            const geo = tableGeometry(shapeHintFor(st.table_type), st.capacity);
            const tScale = pxPerMeter ? (TABLE_FOOTPRINT_M[st.table_type] * pxPerMeter) / geo.box.w : 1;
            const halfH = (geo.box.h / 2) * tScale * z;
            // Flip below when the popup would clip the top — accounting for the
            // expanded "Seat people" panel when it's open.
            const POP_H = pickerOpen ? 380 : 52;
            let below = false;
            let top = cy - halfH - 12;
            if (top - POP_H < 4) {
              below = true;
              top = cy + halfH + 12;
            }
            const left = Math.max(10, Math.min(rect.width - 10, cx));
            // Rotate handle sits on the OPPOSITE side of the table from the
            // popup (below when the popup is above, and vice-versa). Drag it in
            // a circle to rotate — 15° snaps, hold Shift for 1° fine-tuning.
            const handleTop = below ? cy - halfH - 24 : cy + halfH + 24;
            return (
              <>
              <button
                type="button"
                aria-label="Rotate table — drag in a circle (hold Shift for 1° steps)"
                title="Drag to rotate · Shift = fine"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  handleRotRef.current = {
                    tableId: st.table_id,
                    cx: rect.left + cx,
                    cy: rect.top + cy,
                    startAngle: angleDeg(rect.left + cx, rect.top + cy, e.clientX, e.clientY),
                    startRot: rotationOf(st),
                    latest: rotationOf(st),
                  };
                }}
                onPointerMove={(e) => {
                  const h = handleRotRef.current;
                  if (!h) return;
                  e.stopPropagation();
                  let delta = angleDeg(h.cx, h.cy, e.clientX, e.clientY) - h.startAngle;
                  delta = ((delta + 540) % 360) - 180;
                  const next = snapDeg(h.startRot + delta, e.shiftKey ? 1 : 15);
                  if (next !== h.latest) {
                    h.latest = next;
                    setRotById((m) => ({ ...m, [h.tableId]: next }));
                  }
                }}
                onPointerUp={(e) => {
                  const h = handleRotRef.current;
                  handleRotRef.current = null;
                  if (h && h.latest !== h.startRot) commitRotation(h.tableId, h.latest);
                  e.stopPropagation();
                }}
                onPointerCancel={() => {
                  handleRotRef.current = null;
                }}
                className="absolute z-40 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 border-terracotta bg-cream text-terracotta shadow-sm hover:bg-terracotta/10 active:cursor-grabbing"
                style={{ left, top: handleTop }}
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute z-40 flex w-max max-w-[22rem] flex-col gap-1.5 rounded-xl border border-ink/15 bg-cream/95 px-1.5 py-1 shadow-lg backdrop-blur-sm"
                style={{ left, top, transform: below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)' }}
              >
                <div className="flex items-center gap-1">
                <input
                  key={st.table_id}
                  defaultValue={st.table_label}
                  aria-label="Table name"
                  maxLength={64}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') {
                      e.currentTarget.value = st.table_label;
                      e.currentTarget.blur();
                    }
                  }}
                  onBlur={(e) => renameTable(st.table_id, e.currentTarget.value)}
                  className="w-28 rounded-lg border border-transparent bg-ink/[0.04] px-2 py-1 text-sm font-medium text-ink outline-none focus:border-terracotta focus:bg-cream"
                />
                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  aria-pressed={pickerOpen}
                  title="Seat people at this table"
                  className={`rounded-lg p-1.5 ${
                    pickerOpen
                      ? 'bg-terracotta/10 text-terracotta-700'
                      : 'text-ink/60 hover:bg-ink/5'
                  }`}
                >
                  <UserPlus className="h-4 w-4" />
                </button>
                {st.link_group_id ? (
                  <button
                    type="button"
                    onClick={() => doUnlink(st.table_id)}
                    title="Unlink this combined table"
                    className="rounded-lg p-1.5 text-mulberry hover:bg-mulberry/10"
                  >
                    <Unlink className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setLinkingFrom(st.table_id);
                      setHighlightId(null);
                    }}
                    title="Link with another table — tap the other table next"
                    className="rounded-lg p-1.5 text-ink/60 hover:bg-ink/5"
                  >
                    <Link2 className="h-4 w-4" />
                  </button>
                )}
                <div className="flex items-center gap-0.5 rounded-lg border border-ink/15 px-0.5">
                  <button
                    type="button"
                    onClick={() => rotateTable(st, -15)}
                    aria-label="Rotate 15° left"
                    className="rounded p-1 text-ink/60 hover:bg-ink/5"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-[11px] tabular-nums text-ink/55">{curRot}°</span>
                  <button
                    type="button"
                    onClick={() => rotateTable(st, 15)}
                    aria-label="Rotate 15° right"
                    className="rounded p-1 text-ink/60 hover:bg-ink/5"
                  >
                    <RotateCw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => rotateTable(st, 180)}
                    title="Flip 180°"
                    className="rounded px-1 py-1 text-[11px] font-semibold text-ink/60 hover:bg-ink/5"
                  >
                    Flip
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => requestRemoveTable(st)}
                  aria-label="Delete table"
                  className="rounded-lg p-1.5 text-ink/50 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setHighlightId(null)}
                  aria-label="Done"
                  className="rounded-lg p-1.5 text-ink/40 hover:bg-ink/5"
                >
                  <X className="h-4 w-4" />
                </button>
                </div>
                {pickerOpen ? (
                  <SeatPeoplePanel
                    table={st}
                    occ={occupantsFor(st)}
                    guests={guests}
                    groups={groups}
                    tab={pickerTab}
                    onTab={setPickerTab}
                    q={pickerQ}
                    onQ={setPickerQ}
                    colorFor={colorFor}
                    tableLabelById={tableLabelById}
                    onSeatGuest={(gid) => seatGuestHere(st, gid)}
                    onSeatGroup={(grpId) => seatGroupMembers(grpId, st.table_id)}
                    onSeatTier={(tier) => seatTierHere(st, tier)}
                  />
                ) : null}
              </div>
              </>
            );
          })()}
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
                  const removed = removedSeatSet(t.removed_seats, t.capacity);
                  const cap = effectiveCapacity(t.capacity, t.removed_seats);
                  const full = seated.length >= cap;
                  const free = occ.findIndex((g, i) => g === null && !removed.has(i));
                  const expanded = expandedCards.has(t.table_id);
                  const halo = dominantColor(occ, colorFor);
                  const open = cap - seated.length;
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
                            <span className="block truncate text-sm font-semibold text-ink">
                              {t.link_group_id ? (
                                <Link2 className="mr-1 inline h-3 w-3 text-mulberry/70" />
                              ) : null}
                              {t.link_group_label ?? t.table_label}
                            </span>
                            <span className="block text-[11px] text-ink/55">{TABLE_TYPE_LABEL[t.table_type]}</span>
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              full ? 'bg-emerald-100 text-emerald-700' : 'bg-ink/5 text-ink/55'
                            }`}
                          >
                            {seated.length}/{cap}
                          </span>
                          <ChevronDown className={`h-4 w-4 text-ink/40 transition ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => requestRemoveTable(t)}
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
                              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                                {g.name}
                                {g.meal_preference && g.meal_preference !== 'no_preference' ? (
                                  <span className="ml-1.5 text-[10px] text-ink/45">· {g.meal_preference}</span>
                                ) : null}
                              </span>
                              {g.dietary_restrictions ? (
                                <span
                                  title={`Dietary: ${g.dietary_restrictions}`}
                                  className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                                >
                                  diet
                                </span>
                              ) : null}
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

      {/* auto-arrange confirm */}
      {confirmAuto ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4" onClick={() => setConfirmAuto(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-ink/10 bg-cream p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-mulberry" />
              <h3 className="text-lg font-semibold text-ink">Auto Arrange</h3>
            </div>
            <p className="text-sm text-ink/70">One click, three steps:</p>
            <ol className="mt-2 space-y-1.5 text-sm text-ink/70">
              <li>
                <span className="font-semibold text-ink/85">1 · Tables</span> — laid out in a grid
                fanning from the stage; head &amp; family tables land nearest it. The dance floor
                stays clear.
              </li>
              <li>
                <span className="font-semibold text-ink/85">2 · Booths</span> —{' '}
                {booths.length > 0 ? `your ${booths.length} booth${booths.length === 1 ? '' : 's'}` : 'any booths'}{' '}
                {venueScaled
                  ? 'anchor to the back wall & sides, never blocking the stage or door paths.'
                  : 'tuck into a row behind the tables, out of the guests’ sightline (an open venue has no walls).'}
              </li>
              <li>
                <span className="font-semibold text-ink/85">3 · Guests</span> —{' '}
                {unseatedCount > 0 ? (
                  <>
                    the <span className="font-semibold">{unseatedCount}</span> unseated, attending{' '}
                    {unseatedCount === 1 ? 'guest is' : 'guests are'} seated by priority tier, highest
                    priority nearest the stage.
                  </>
                ) : (
                  'everyone attending is already seated, so seats stay as they are.'
                )}{' '}
                No one you&rsquo;ve placed is moved; sweetheart tables are skipped.
              </li>
            </ol>
            <p className="mt-2 text-xs text-ink/50">
              Table positions change and are saved. You can drag anything afterwards.
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
                onClick={runAutoArrange}
                className="inline-flex items-center gap-1.5 rounded-lg bg-mulberry px-3 py-1.5 text-sm font-semibold text-cream hover:bg-mulberry-600"
              >
                <Sparkles className="h-4 w-4" /> Auto Arrange
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* delete-table confirm — shown only when seated guests would be released.
          Bottom sheet on phones (thumb zone, safe area), centered card otherwise. */}
      {confirmDelete ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 md:items-center md:p-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full rounded-t-2xl border border-ink/10 bg-cream p-5 shadow-xl md:max-w-sm md:rounded-2xl"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-rose-600" />
              <h3 className="text-lg font-semibold text-ink">
                Delete {confirmDelete.link_group_label ?? confirmDelete.table_label}?
              </h3>
            </div>
            <p className="text-sm text-ink/70">
              <span className="font-semibold">{seatedAt(confirmDelete.table_id)}</span> seated{' '}
              {seatedAt(confirmDelete.table_id) === 1 ? 'guest' : 'guests'} will go back to{' '}
              <span className="font-semibold">Unseated</span>, and the table is removed from the plan.
            </p>
            <div className="mt-4 flex gap-2 md:justify-end">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="h-11 flex-1 rounded-lg border border-ink/15 bg-cream px-3 text-sm text-ink hover:bg-ink/5 md:h-auto md:flex-none md:py-1.5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  removeTable(confirmDelete.table_id);
                  setConfirmDelete(null);
                }}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 text-sm font-semibold text-cream hover:bg-rose-700 md:h-auto md:flex-none md:py-1.5"
              >
                <Trash2 className="h-4 w-4" /> Delete table
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

function BoothIcon({ type, className }: { type: BoothType; className?: string }) {
  const Icon =
    type === 'photo_booth'
      ? Camera
      : type === 'mobile_bar'
        ? Martini
        : type === 'dessert_station'
          ? CakeSlice
          : type === 'gift_table'
            ? Gift
            : type === 'souvenir_table'
              ? Package
              : Store;
  return <Icon className={className} />;
}

function MemberRow({
  guest,
  color,
  picked,
  tableLabel,
  onPick,
  onCyclePriority,
}: {
  guest: SeatingGuest;
  color: string;
  picked: boolean;
  tableLabel: string | null;
  onPick: () => void;
  onCyclePriority: () => void;
}) {
  const tier = guestTier(guest.role, guest.group_category, guest.seating_priority);
  const overridden = guest.seating_priority !== null;
  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        onClick={onPick}
        className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left transition ${
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
      {/* Priority tier chip — P1 seats nearest the stage. Tap cycles an explicit
          override 1→2→3→4→back to the role-derived tier (hollow = derived). */}
      <button
        type="button"
        onClick={onCyclePriority}
        title={`Seating priority: ${ROLE_TIER_LABELS[tier]}${overridden ? ' (set by you — tap to cycle, back to auto after P4)' : ' (from their role — tap to override)'}`}
        aria-label={`Seating priority P${tier}${overridden ? ', overridden' : ', from role'} — change`}
        className={`shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[9px] font-semibold tabular-nums transition ${
          overridden
            ? 'bg-mulberry text-cream hover:bg-mulberry-600'
            : 'bg-ink/5 text-ink/45 hover:bg-ink/10 hover:text-ink/70'
        }`}
      >
        P{tier}
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

// In-context "Seat people" picker — the per-table popup's centerpiece. Three
// grains (Guest · Group · Role), a type-ahead search, and a live capacity
// readout. Top-level component (not nested) so the search input keeps focus
// across parent re-renders.
function SeatPeoplePanel({
  table,
  occ,
  guests,
  groups,
  tab,
  onTab,
  q,
  onQ,
  colorFor,
  tableLabelById,
  onSeatGuest,
  onSeatGroup,
  onSeatTier,
}: {
  table: EventTableRow;
  occ: (SeatingGuest | null)[];
  guests: SeatingGuest[];
  groups: SeatingGroup[];
  tab: 'guest' | 'group' | 'role';
  onTab: (t: 'guest' | 'group' | 'role') => void;
  q: string;
  onQ: (v: string) => void;
  colorFor: (g: SeatingGuest) => string;
  tableLabelById: Map<string, string>;
  onSeatGuest: (guestId: string) => void;
  onSeatGroup: (groupId: string) => void;
  onSeatTier: (tier: 1 | 2 | 3 | 4) => void;
}) {
  const cap = effectiveCapacity(table.capacity, table.removed_seats);
  const seated = occ.filter(Boolean).length;
  const free = Math.max(0, cap - seated);
  const ql = q.trim().toLowerCase();

  const guestRows = guests
    .filter((g) => !ql || g.name.toLowerCase().includes(ql))
    .sort((a, b) => {
      const ua = a.seated_table_id ? 1 : 0;
      const ub = b.seated_table_id ? 1 : 0;
      return ua - ub || a.name.localeCompare(b.name);
    })
    .slice(0, 60);
  const groupRows = groups.filter((g) => !ql || g.label.toLowerCase().includes(ql));
  const tierCount = (tier: 1 | 2 | 3 | 4) =>
    guests.filter(
      (g) =>
        g.rsvp_status === 'attending' &&
        !g.seated_table_id &&
        g.role !== 'bride' &&
        g.role !== 'groom' &&
        roleTier(g.role, g.group_category) === tier,
    ).length;

  return (
    <div className="w-full rounded-xl border border-ink/10 bg-ink/[0.03] p-2">
      <div className="mb-2 flex items-center gap-2">
        <div className="inline-flex flex-1 rounded-lg border border-ink/15 bg-cream p-0.5">
          {(['guest', 'group', 'role'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTab(t)}
              aria-pressed={tab === t}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium capitalize transition ${
                tab === t ? 'bg-ink/[0.06] text-ink' : 'text-ink/55 hover:text-ink'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <span className={`shrink-0 text-[11px] ${free === 0 ? 'text-rose-600' : 'text-ink/55'}`}>
          {seated}/{cap} · {free} free
        </span>
      </div>

      {tab !== 'role' ? (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" />
          <input
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder={tab === 'guest' ? 'Search people…' : 'Search groups…'}
            className="w-full rounded-lg border border-ink/15 bg-cream py-1.5 pl-8 pr-2 text-base outline-none focus:border-terracotta sm:text-sm"
          />
        </div>
      ) : null}

      <ul className="max-h-52 space-y-0.5 overflow-y-auto">
        {tab === 'guest' ? (
          guestRows.length === 0 ? (
            <li className="px-1 py-2 text-xs text-ink/45">No matching guests.</li>
          ) : (
            guestRows.map((g) => {
              const here = g.seated_table_id === table.table_id;
              const movable = !here && (free > 0 || g.seated_table_id !== null);
              const canSeat = !here && free > 0;
              return (
                <li key={g.guest_id}>
                  <button
                    type="button"
                    disabled={here || !canSeat}
                    onClick={() => movable && canSeat && onSeatGuest(g.guest_id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left ${
                      here ? 'opacity-60' : canSeat ? 'hover:bg-ink/[0.04]' : 'opacity-40'
                    }`}
                  >
                    <ChairAvatar guest={g} color={colorFor(g)} size={24} />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{g.name}</span>
                    {g.dietary_restrictions ? (
                      <span
                        title={`Dietary: ${g.dietary_restrictions}`}
                        className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                      >
                        diet
                      </span>
                    ) : null}
                    {here ? (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">
                        here
                      </span>
                    ) : g.seated_table_id ? (
                      <span className="shrink-0 rounded-full bg-ink/5 px-1.5 py-0.5 text-[10px] text-ink/55">
                        {tableLabelById.get(g.seated_table_id) ?? 'seated'}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] text-ink/30">unseated</span>
                    )}
                  </button>
                </li>
              );
            })
          )
        ) : tab === 'group' ? (
          groupRows.length === 0 ? (
            <li className="px-1 py-2 text-xs text-ink/45">No groups yet — make them in the guest list.</li>
          ) : (
            groupRows.map((grp) => (
              <li key={grp.group_id}>
                <button
                  type="button"
                  disabled={free === 0}
                  onClick={() => onSeatGroup(grp.group_id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left ${
                    free === 0 ? 'opacity-40' : 'hover:bg-ink/[0.04]'
                  }`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: grp.color }} />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{grp.label}</span>
                  <span className="shrink-0 text-[11px] text-ink/50">{grp.member_count}</span>
                </button>
              </li>
            ))
          )
        ) : (
          ([1, 2, 3, 4] as const).map((tier) => {
            const n = tierCount(tier);
            return (
              <li key={tier}>
                <button
                  type="button"
                  disabled={n === 0 || free === 0}
                  onClick={() => onSeatTier(tier)}
                  className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left ${
                    n === 0 || free === 0 ? 'opacity-40' : 'hover:bg-ink/[0.04]'
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mulberry/10 text-[10px] font-semibold text-mulberry">
                    {tier}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{ROLE_TIER_LABELS[tier]}</span>
                  <span className="shrink-0 text-[11px] text-ink/50">
                    {n} unseated
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
      <p className="mt-1.5 px-1 text-[10px] leading-snug text-ink/45">
        {tab === 'guest'
          ? 'Tap a person to seat them at the next open chair.'
          : tab === 'group'
            ? 'Seats the whole group here — whoever fits; the rest stay put.'
            : 'Seats every unseated, attending guest of that role tier here.'}
      </p>
    </div>
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
  // A table can't have more seats than its TYPE allows (a Sweetheart seats 2).
  // Capacity is capped at the selected type's seat count and resets to it when
  // the type changes. (owner 2026-06-09)
  const seatsFor = (t: TableType) =>
    TABLE_TYPE_CATALOG.find((c) => c.type === t)?.defaultCapacity ?? 10;
  const [tableType, setTableType] = useState<TableType>('round_10');
  const [capacity, setCapacity] = useState(seatsFor('round_10'));
  const maxSeats = seatsFor(tableType);
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
          value={tableType}
          onChange={(e) => {
            const t = e.target.value as TableType;
            setTableType(t);
            setCapacity(seatsFor(t)); // reset to the new type's seat count
          }}
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
          max={maxSeats}
          value={capacity}
          onChange={(e) => {
            const v = Math.round(Number(e.target.value));
            setCapacity(Number.isFinite(v) ? Math.min(Math.max(1, v), maxSeats) : maxSeats);
          }}
          aria-label="Capacity"
          title={`Up to ${maxSeats} seats for this table type`}
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
