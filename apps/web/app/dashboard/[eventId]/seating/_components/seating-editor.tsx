'use client';

import { useEffect, useLayoutEffect, useMemo, useOptimistic, useRef, useState, useTransition } from 'react';

// useLayoutEffect on the server is a no-op + warns; fall back to useEffect there.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
import {
  Armchair,
  CakeSlice,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Lock,
  LockOpen,
  ClipboardList,
  DoorOpen,
  Eye,
  EyeOff,
  FileDown,
  Footprints,
  Gift,
  HelpCircle,
  Link2,
  List,
  Loader2,
  Martini,
  Maximize2,
  Minus,
  MoreHorizontal,
  Navigation,
  Package,
  Plus,
  Printer,
  RotateCcw,
  RotateCw,
  Ruler,
  Search,
  Signpost,
  Sparkles,
  Store,
  Trash2,
  Truck,
  Ungroup,
  UserMinus,
  UserPlus,
  X,
  Music,
  ChefHat,
  Mic,
  Users,
  Wand2,
  Video,
  AlertTriangle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ContextDock, ShapeGlyph, ShapePicker, type DockEdge } from './seating-context-dock';
import { DayOfEditingBanner } from './day-of-editing-banner';
import { isEventDayActive } from '@/lib/day-of-mode';
import {
  SeatingFrame,
  CommandBar,
  BannerSlot,
  FrameBody,
  BarMenu,
  MenuRow,
  MenuCaption,
  MenuDivider,
  SaveStatusChip,
  SeatingViewSegment,
  type SaveState,
} from './seating-frame';
import { DropConfirmBubble, type DropConfirmState } from './drop-confirm-bubble';
import {
  BOOTH_CATALOG,
  CHAIR_PX,
  SIDE_COLORS,
  TABLE_FOOTPRINT_M,
  boothTypeForVendorCategory,
  boothPresenceLabel,
  boothPerimeterSlots,
  clampBoothToPerimeter,
  solveAutoLayout,
  freeBoothSlots,
  defaultPriorityOrder,
  defaultTablePosition,
  effectiveCapacity,
  groupTablesIntoUnits,
  guestTier,
  removedSeatSet,
  roleTier,
  rotatePoint,
  nextTableName,
  obbOf,
  checkPlacement,
  firstDropViolation,
  zoneDropViolation,
  zoneDisplayName,
  layoutViolations,
  legalJoinPose,
  isLegalJoint,
  atLegalJoint,
  chainableShapes,
  stageZone,
  TABLE_TYPE_CATALOG,
  TABLE_TYPE_LABEL,
  shapeHintFor,
  tableGeometry,
  tableNumberEndsInFour,
  relaxLowestPriorityRule,
  type BoothType,
  type EventTableRow,
  type TableDisplayUnit,
  type PriorityOrder,
  type KeepApartRule,
  type AutoSeatGuest,
  type FloorBoothRow,
  type FloorPlanRow,
  sanitizeCapacity,
  weldCommitBatch,
  DEFAULT_ROOM_M,
  type FloorSignRow,
  type TableShapeHint,
  type TableType,
  type WorldPose,
  type OracleZone,
  type DropHit,
} from '@/lib/seating';
import { resolveRoleSet, type RoleSet } from '@/lib/role-sets';
import { VENDOR_CATEGORY_LABEL, type BoothVendorOption } from '@/lib/vendors';
// Feature C (2D booth footprint + facing): reuse the 3D booth dims + facing
// derivation so the 2D editor and the 3D venue walk agree (no magic numbers,
// one source for "which wall a booth backs onto").
import { BOOTH_FOOTPRINT_M, boothFacingDeg2D } from '@/lib/seating-3d';
import {
  addSeatingConstraint,
  assignGroup,
  assignGuest,
  autoArrange,
  buildSeatingDraft,
  createTable,
  deleteTable,
  lockAndFill,
  removeSeatingConstraint,
  toggleSeatLock,
  publishSeating,
  saveBooths,
  saveFloorPlan,
  savePriorityOrder,
  commitWeld,
  saveSigns,
  saveVenuePhotoVisibility,
  seatRoleAtTable,
  setGuestSeatingPriority,
  setTableSeat,
  unassignGuest,
  unlinkTable,
  updateTableLabel,
  updateTablePosition,
  updateTableRotation,
  updateTableType,
} from '../actions';
import { useSeatingPresence } from './use-seating-presence';
import { useSeatingLock } from './use-seating-lock';
import { useSeatingLiveRefresh } from './use-seating-live-refresh';
import { SeatingLockError } from '../seating-lock-error';
import { usePrefersReducedMotion } from '@/lib/use-responsive';

// True when a thrown error is the server lock-guard's "you no longer hold the
// editor lock" signal (SeatingLockError · code 'seating_lock_not_held'). Server
// actions don't preserve the class instance across the RSC boundary, so we
// match defensively: instanceof first (client-thrown / preserved), then the
// error's code, then its message text (dev) — covering prod digests too, where
// the message is replaced but the original copy is unique enough to match.
function isSeatingLockLost(err: unknown): boolean {
  if (err instanceof SeatingLockError) return true;
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: unknown; message?: unknown };
  if (e.code === 'seating_lock_not_held') return true;
  return typeof e.message === 'string' && e.message.includes('locked by someone else on this event');
}

// Feature B — room-size presets. One-tap common reception footprints (metres,
// width × length). "Standard 20×30" is the historical default (venue useState).
// The typed Width/Length inputs stay as the precision path (min 1 / max 500 m).
const ROOM_PRESETS: ReadonlyArray<{ label: string; width: number; length: number }> = [
  { label: 'Intimate', width: 14, length: 10 },
  { label: 'Standard', width: 20, length: 30 },
  { label: 'Grand', width: 30, length: 20 },
  { label: 'Garden', width: 60, length: 40 },
  { label: 'Estate', width: 120, length: 90 },
  { label: 'Field', width: 200, length: 200 },
];

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
  // Smart seat-plan Phase 4: this guest's seat is locked (pinned) — lock-and-fill
  // keeps it fixed and seats everyone else around it.
  seat_locked: boolean;
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
  // Iteration 0053 P4 Unit 6: the event's role-set key (string, RSC-serializable).
  // The editor re-resolves it client-side to tier/label by the event type.
  roleSetKey: string;
  // Chinese (Tsinoy) tradition avoids table number 4 (四 ≈ 死). ADVISORY ONLY:
  // when true, a manual "Table 4" (ones-digit-4) shows a gentle notice but the
  // save still proceeds. Derived from isChineseWedding() in the page (primary OR
  // secondary Chinese rite). Optional → non-Chinese events behave identically.
  chineseTradition?: boolean;
  tables: EventTableRow[];
  guests: SeatingGuest[];
  groups: SeatingGroup[];
  floorPlan: FloorPlanRow;
  booths: FloorBoothRow[];
  signs: FloorSignRow[];
  // Booth picker (decision #9): the event's BOOKED vendors — the only vendors
  // the couple may drop as a booth. Empty when nothing's booked yet.
  bookedVendors: BoothVendorOption[];
  // Keep-apart rules (smart seat-plan Phase 3) — couple-private guest pairs.
  constraints: KeepApartRule[];
  // Who I am, for live presence (cursors + "editing Table N" rings).
  me: { id: string; name: string };
  // ── Scroll-less frame (council verdict 2026-07-15): the page header's stats,
  // the two seating policies, the walkthrough link, and the day-of / walima /
  // capacity banners moved into the editor's command bar + banner slot, so the
  // data they need arrives as props. ─────────────────────────────────────────
  eventDate: string | null;
  /** Walima gender-separation advisory (null when not requested). */
  genderSeparationNote: string | null;
  /** How many non-declined guests exceed total effective seats (0 = enough). */
  seatShortfall: number;
  nonDeclinedCount: number;
  totalSeats: number;
  autoplaceEnabled: boolean;
  adjacencyEnabled: boolean;
  /** RSVP-confirmed guests (stats chip "reserved" framing). */
  reservedCount: number;
  /** Reserved guests still without a chair (stats chip "to seat"). */
  toSeatReserved: number;
  /** The two policy toggles are plain server-action forms, passed down verbatim. */
  setSeatingAutoplace: (formData: FormData) => void | Promise<void>;
  setSeatingGroupAdjacency: (formData: FormData) => void | Promise<void>;
  /** Initial view — 'list' when the lab's mirrored segment links here (?view=list). */
  initialView?: 'plan' | 'list';
};

const NEUTRAL = '#B7B1A6';

// The booth picker's "Stations" section — the NON-vendor fixtures the couple
// places directly (Front Desk + a generic custom booth). Every OTHER booth type
// is now driven by a booked vendor's category (chosen from "Your booked
// vendors"), so it is deliberately omitted from the manual station list.
const STATION_BOOTHS = BOOTH_CATALOG.filter(
  (c) => c.type === 'registration_desk' || c.type === 'custom',
);

// Chinese (Tsinoy) tradition avoids the number 4 (四 sounds like 死, "death").
// ADVISORY copy only — surfaced via setNotice when a Chinese-wedding couple names
// a table with a ones-digit-4 number. We never block the save; the couple may
// keep "Table 4" if they insist.
const TABLE_FOUR_ADVISORY =
  'Heads up: many Chinese families avoid table number 4 (四 sounds like 死). You can still use it.';

type LocalPos = { x: number; y: number };

// Optimistic seating ops — applied instantly client-side, then reconciled when
// the server action's revalidation lands (so seating/unseating feels instant).
type GuestSeatOp =
  | { type: 'seat'; guestId: string; tableId: string; seat: number | null }
  | { type: 'unseat'; guestId: string }
  | { type: 'seatGroup'; ids: string[]; tableId: string }
  | { type: 'priority'; guestId: string; value: number | null }
  | { type: 'lock'; guestId: string; locked: boolean };

// Default placement for an un-positioned table — shared with the PDF + day-of
// map (lib/seating) so the layout matches everywhere.
const defaultGrid = defaultTablePosition;

export function SeatingEditor({
  eventId,
  roleSetKey,
  chineseTradition = false,
  tables: tablesProp,
  guests: guestsProp,
  groups,
  floorPlan,
  booths: boothsProp,
  signs: signsProp,
  bookedVendors,
  constraints: constraintsProp,
  me,
  eventDate,
  genderSeparationNote,
  seatShortfall,
  nonDeclinedCount,
  totalSeats,
  autoplaceEnabled,
  adjacencyEnabled,
  reservedCount,
  toSeatReserved,
  setSeatingAutoplace,
  setSeatingGroupAdjacency,
  initialView = 'plan',
}: Props) {
  // Iteration 0053 P4 Unit 6: the event's role set drives seating tiers + labels.
  // Pure client-safe lookup; wedding → WEDDING_ROLE_SET (byte-identical). Declared
  // first so the priority-order useState initializer below can read it.
  const roleSet = useMemo(() => resolveRoleSet(roleSetKey), [roleSetKey]);
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
      case 'lock':
        return state.map((g) =>
          g.guest_id === op.guestId ? { ...g, seat_locked: op.locked } : g,
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
    kind: 'table' | 'stage' | 'entrance' | 'service' | 'dance' | 'cocktail' | 'booth' | 'sign';
    id: string;
    sx: number;
    sy: number;
    moved: boolean;
  } | null>(null);
  // SNAP-BACK DROP RULE (owner 2026-07-17 · "undroppable when overlap"). The
  // dragged table (or linked unit) follows the pointer FREELY; enforcement is at
  // RELEASE — an invalid drop is NO drop and returns to the drag-START pose.
  //  · `dragStartRef` — the moved unit's start pose(s), captured once per gesture
  //    (the shared #3358 baseline pattern, extended to carry the full pose set),
  //    so the release can restore exactly where the drag began.
  //  · `dragInvalid` — per-frame legality of the current drag pose; drives the
  //    warm-red ring/tint so refusal is legible BEFORE release (gold when valid).
  //  · `snapBackIds` — tables mid-return; they get the kit-ease left/top
  //    transition (~280 ms) instead of the usual 140 ms so the bounce-back reads
  //    as a deliberate refusal (instant under reduced motion).
  const dragStartRef = useRef<Record<string, LocalPos> | null>(null);
  const [dragInvalid, setDragInvalid] = useState(false);
  const [snapBackIds, setSnapBackIds] = useState<ReadonlySet<string>>(() => new Set());
  // Universal confirm-on-drop (owner 2026-07-17 · Confirm-on-drop + universal
  // draggability) — the SAME shared bubble component the 3D lab uses. `dropConfirm`
  // positions it at the drop point; `pendingDropRef` holds the ✓ commit / ✗ revert
  // out of render. `markerStartRef` is the zone/marker/booth/sign twin of
  // dragStartRef — the start pose so an invalid or cancelled release returns it.
  const [dropConfirm, setDropConfirm] = useState<DropConfirmState | null>(null);
  const pendingDropRef = useRef<{ commit: () => void; revert: () => void } | null>(null);
  const lastPointerRef = useRef<{ cx: number; cy: number }>({ cx: 0, cy: 0 });
  const markerStartRef = useRef<{ kind: string; pos: { x: number; y: number } } | null>(null);
  const reducedMotion = usePrefersReducedMotion();
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
    // Door (shallow) vs walk-through (deeper, back flush to the nearest wall).
    // Schema value stays 'tunnel'; the UI labels it "Walk-through".
    kind: floorPlan.entrance_kind,
    depthM: floorPlan.entrance_depth_m,
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
  // Cocktail / waiting-area room — a SECOND room on the same canvas (sits
  // outside the reception walls). Booths place inside; tables/chairs blocked.
  const [cocktail, setCocktail] = useState({
    enabled: floorPlan.cocktail_enabled,
    x: floorPlan.cocktail_x,
    y: floorPlan.cocktail_y,
    w: floorPlan.cocktail_w,
    h: floorPlan.cocktail_h,
    label: floorPlan.cocktail_label,
    vendorEdit: floorPlan.cocktail_vendor_edit,
    // Dock mode: when linked, the room docks beside the reception at the
    // entrance door with a drawn doorway (arrive→register→enter).
    linked: floorPlan.cocktail_linked,
  });
  // True when a booth centre sits inside the cocktail room (used to tag the
  // booth's zone on save — geometry is the source of truth).
  const inCocktail = (bx: number, by: number) =>
    cocktail.enabled &&
    Math.abs(bx - cocktail.x) <= cocktail.w / 2 &&
    Math.abs(by - cocktail.y) <= cocktail.h / 2;
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
  // Wayfinding signs (rotatable arrow + label) — same local-state-then-save
  // model as booths: tmp- ids until the next save returns real rows.
  const [signs, setSigns] = useState<FloorSignRow[]>(signsProp);
  const [signsDirty, setSignsDirty] = useState(false);
  const signsDirtyRef = useRef(false);
  signsDirtyRef.current = signsDirty;
  const tmpSignSeq = useRef(0);
  useEffect(() => {
    if (!signsDirtyRef.current) setSigns(signsProp);
  }, [signsProp]);
  // Dock the cocktail room beside the reception at the entrance door: cross-axis
  // aligned to the door, out-axis pushed GAP + half-extent outside the wall
  // nearest the entrance. Coordinates may exceed 0–100 (the room lives OUTSIDE
  // the reception; the server clamp is widened to match).
  const dockCocktail = (
    c: { x: number; y: number; w: number; h: number },
    en: { x: number; y: number },
  ): { x: number; y: number } => {
    const GAP = 6;
    const dTop = en.y;
    const dRight = 100 - en.x;
    const dBottom = 100 - en.y;
    const dLeft = en.x;
    const min = Math.min(dTop, dRight, dBottom, dLeft);
    if (min === dTop) return { x: en.x, y: en.y - (GAP + c.h / 2) };
    if (min === dRight) return { x: en.x + (GAP + c.w / 2), y: en.y };
    if (min === dBottom) return { x: en.x, y: en.y + (GAP + c.h / 2) };
    return { x: en.x - (GAP + c.w / 2), y: en.y };
  };
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
  // Feature A — stage / dance-floor WALL-SNAP. Booths already hug the perimeter
  // (clampBoothToPerimeter); the stage + dance rects moved freely. When a rect's
  // nearest edge comes within WALL_SNAP_TOL of a room wall (0 / 100 %), snap that
  // EDGE flush to the wall — axis-independent, using the rect's own width/height.
  // Percent units + a small tolerance mirror the booth perimeter clamp's
  // wall-hug convention (lib/seating), so it reads consistently. These rects
  // have no facing, so there is no rotation — only an x/y translate. Away from a
  // wall the rect keeps following the cursor untouched.
  const WALL_SNAP_TOL = 4; // percent of the canvas (≈ the booth WALL_INSET feel)
  const snapRectToWalls = (cx: number, cy: number, w: number, h: number) => {
    let x = cx;
    let y = cy;
    const halfW = w / 2;
    const halfH = h / 2;
    if (Math.abs(cx - halfW) <= WALL_SNAP_TOL) x = halfW; // left edge → wall 0
    else if (Math.abs(100 - (cx + halfW)) <= WALL_SNAP_TOL) x = 100 - halfW; // right edge → wall 100
    if (Math.abs(cy - halfH) <= WALL_SNAP_TOL) y = halfH; // top edge → wall 0
    else if (Math.abs(100 - (cy + halfH)) <= WALL_SNAP_TOL) y = 100 - halfH; // bottom edge → wall 100
    return { x, y };
  };
  // Drag-resize of the stage / dance-floor (SE grip, NW corner anchored) and
  // of the venue walls. Self-contained pointer handlers on the grips; the
  // pxPerMeter is FROZEN at wall-grab so the canvas resizing mid-drag can't
  // feed back into the drag math.
  const rectDragRef = useRef<{
    kind: 'stage' | 'dance' | 'cocktail';
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
  // Guest-photo visibility in the public 3D venue walk (owner 2026-07-03).
  // Optimistic local mirror of floorPlan.venue_photo_visibility so the choice
  // reflects instantly; the server persist reconciles on revalidation. (The
  // open/close boolean is gone — the Share & print ▾ menu manages its own.)
  const [photoVis, setPhotoVis] = useState<'table' | 'all' | 'none'>(floorPlan.venue_photo_visibility);
  // Context Dock (verdict §1.4) — markers/booths/signs join the same selection
  // model as tables: tap = select (ring) → the object's verbs render in the dock.
  // Singleton markers carry id=null; booths/signs carry their row id. Mutually
  // exclusive with a selected TABLE (highlightId) — selecting one clears the other.
  type MarkerKind = 'stage' | 'entrance' | 'service' | 'dance' | 'cocktail' | 'booth' | 'sign';
  const [selMarker, setSelMarker] = useState<{ kind: MarkerKind; id: string | null } | null>(null);
  const [canvasW, setCanvasW] = useState(0);
  const [floorDirty, setFloorDirty] = useState(false);

  const venueScaled = venue.enabled && venue.width > 0 && venue.length > 0;
  // The COORDINATE room box (contract v2 · § 2 · GUN B): the venue metres when
  // sized, else the default 20×30 board. ALWAYS defined — it's the coordinate
  // denominator, and the canvas letterboxes to its aspect so a percent is
  // isotropic on the free board exactly like a sized room.
  const roomM = venueScaled ? { w: venue.width, d: venue.length } : DEFAULT_ROOM_M;
  // Pixels-per-metre at zoom 1 (the world layer width === canvas width). Tables
  // multiply this by their real footprint to render at true scale. The canvas
  // preserves the room aspect ratio, so px-per-metre is isotropic (x === y).
  // `pxPerMeter` stays SIZED-ROOM-only (it still gates the metric aisle/grid/
  // scale-bar/oracle — those are meaningless without a real venue); `metricPpm`
  // is the ALWAYS-defined table-render scale (GUN B: the free board renders at
  // true metric size against the 20×30 box, no more `scale : 1`).
  const pxPerMeter = venueScaled && canvasW > 0 ? canvasW / venue.width : null;
  const metricPpm = canvasW > 0 ? canvasW / roomM.w : null;

  // Feature B — metre-aware dot grid. The free board keeps its fixed 22px dots;
  // a sized room coarsens the dot spacing to a "nice" number of metres kept
  // ≥ ~16px, so a 200 m field doesn't smear into a dense speckle. Isotropic, so
  // one spacing drives both axes (square dots).
  const gridPx = (() => {
    if (!pxPerMeter) return 22;
    for (const m of [0.5, 1, 2, 5, 10, 20, 50, 100]) {
      if (m * pxPerMeter >= 16) return m * pxPerMeter;
    }
    return 100 * pxPerMeter;
  })();

  // Feature B — adaptive scale bar. Pick a "nice" metre length so the bar reads
  // ~95px (in the ~80–110px band) at the current px-per-metre, keeping big rooms
  // legible. null on the free board (no metre scale to show).
  const scaleBar = (() => {
    if (!pxPerMeter) return null;
    const NICE = [1, 2, 5, 10, 20, 50, 100];
    let metres = NICE[0]!;
    let bestErr = Infinity;
    for (const m of NICE) {
      const err = Math.abs(m * pxPerMeter - 95);
      if (err < bestErr) {
        bestErr = err;
        metres = m;
      }
    }
    return { metres, px: metres * pxPerMeter };
  })();

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

  // Council verdict § 3 — the one global "Walkway width" (metric), the clear
  // space kept between any two table footprints (chair-back to chair-back).
  // Defaults to the legacy 0.6 m so no saved room turns red on upgrade (the
  // 2026-07-11 grandfather rule + § 9.4 sign-off). Raising it enforces a wider
  // aisle live. Session-scoped in V1 (persisting needs an additive
  // event_floor_plan.aisle_m column — owner-open, out of the no-schema-change
  // scope of this PR). New rooms are nudged to Service 0.9 m via the control.
  const [aisleM, setAisleM] = useState(0.6);
  // Read-only mount audit (§ 6): tables with persisted overlaps at load — surfaced
  // as a dismissible pill, never auto-rearranged. { tableId → worst grade }.
  const [mountAudit, setMountAudit] = useState<Map<string, 'overlap' | 'tight'>>(new Map());
  const [auditDismissed, setAuditDismissed] = useState(false);
  // A drag that welded a compatible neighbour → link the two on release (§ 2).
  const weldRef = useRef<{ moverId: string; anchorId: string } | null>(null);

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
  // Dock sub-states for the selected TABLE (verdict §1.2 / §3 / §4). `editChairs`
  // is the surgical chair-edit mode (× / + ghosts render ONLY in it); `dockOverflow`
  // is the ⋯ menu; `shapePickerOpen` is the Change-shape panel; `previewType` ghosts
  // the candidate footprint on canvas; `degEdit` holds the click-to-type rotation.
  const [editChairs, setEditChairs] = useState(false);
  const [dockOverflow, setDockOverflow] = useState(false);
  const [shapePickerOpen, setShapePickerOpen] = useState(false);
  const [previewType, setPreviewType] = useState<TableType | null>(null);
  const [degEdit, setDegEdit] = useState<string | null>(null);
  // Transient "Seat N removed · Undo" inline notice for the Seats stepper (§3).
  const [seatNotice, setSeatNotice] = useState<{ tableId: string; seat: number } | null>(null);
  // §5.3 — the Auto Arrange gold split-button's caret menu (Build draft / Fill).
  const [autoMenuOpen, setAutoMenuOpen] = useState(false);
  useEffect(() => {
    // Selecting a different table (or deselecting) resets every table sub-state.
    setPickerOpen(false);
    setPickerQ('');
    setEditChairs(false);
    setDockOverflow(false);
    setShapePickerOpen(false);
    setPreviewType(null);
    setDegEdit(null);
    setSeatNotice(null);
  }, [highlightId]);
  useEffect(() => {
    // Picking a guest / group exits edit-chairs mode (§3 — chair edits and people
    // edits never overlap).
    if (pickedId || pickedGroupId) setEditChairs(false);
  }, [pickedId, pickedGroupId]);
  useEffect(() => {
    // Selecting a marker resets the marker booth/offerings focus + degrees.
    setDegEdit(null);
  }, [selMarker]);
  // Link-mode: started from a table's popup; the NEXT table tapped on the
  // canvas joins it into one named unit (identity + QR only).
  // Exclusive editor lock (PR 2 · owner lock 2026-06-13): ONE editor per event,
  // co-owners included. We attempt to acquire on mount; if a live peer already
  // holds it we drop to view-only and surface a "Take over editing" button. A
  // SOLO editor simply holds the lock (just a 30s heartbeat — no banner, no
  // regression). `canEdit` is the single gate every edit affordance checks.
  //
  // The holder re-broadcasts a fresh heartbeat on presence every 30s; we feed
  // that live value back into the hook (liveHolderHeartbeatAt below) so the
  // hook judges stale-takeover off the FRESHEST beat, not the one-shot value
  // frozen in the acquire envelope (which would falsely "go stale" ~90s after
  // we landed in view-only even while the holder is alive). The state is
  // declared here, fed into the hook, then refreshed by the effect after the
  // presence peer list resolves below — breaking the lock↔presence data cycle.
  const [liveHolderHeartbeatAt, setLiveHolderHeartbeatAt] = useState<string | null>(null);
  const lock = useSeatingLock(eventId, me.name, liveHolderHeartbeatAt);
  const canEdit = lock.status === 'editing';
  // View-only surface follows the editor live (the 3D lab, or another viewer) —
  // the EDITING surface never auto-refreshes (would clobber unsaved drafts).
  useSeatingLiveRefresh(eventId, !canEdit);
  useEffect(() => {
    // Try to take the lock as soon as the editor opens (the surface itself is
    // the intent to edit). Idempotent — re-acquire just refreshes when it's ours.
    lock.acquire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Live presence: who else is in this seat plan, which table they have
  // selected, their cursor — and who holds the editor lock (so every peer can
  // render the banner + compute stale-takeover from the server heartbeat).
  const { peers, sendCursor } = useSeatingPresence(eventId, me, highlightId, {
    lockHolderId: canEdit ? me.id : null,
    lockHolderLabel: canEdit ? me.name : null,
    lockHeartbeatAt: lock.holderHeartbeatAt,
  });
  const peerList = [...peers.values()];
  const peerOnTable = (tableId: string) => peerList.find((p) => p.table === tableId) ?? null;
  // The peer who claims the lock (if any) — used for the view-only banner copy.
  const lockHolderPeer = peerList.find((p) => p.lockHolderId) ?? null;
  // Feed the holder's LIVE presence heartbeat back into the lock hook so its
  // stale-takeover clock tracks the freshest beat (see liveHolderHeartbeatAt
  // above). When no peer is broadcasting a lock, clear it so the hook falls
  // back to its own frozen envelope value.
  const lockHolderPeerHeartbeat = lockHolderPeer?.lockHeartbeatAt ?? null;
  useEffect(() => {
    setLiveHolderHeartbeatAt(lockHolderPeerHeartbeat);
  }, [lockHolderPeerHeartbeat]);
  const [showAddTable, setShowAddTable] = useState(false);
  const [confirmAuto, setConfirmAuto] = useState(false);
  // A pending delete carries every table it removes: one member for a per-table
  // delete (canvas popups), all members for a joined-unit delete (list rows).
  const [confirmDelete, setConfirmDelete] = useState<{ label: string; members: EventTableRow[] } | null>(
    null,
  );
  // The spatial chair canvas can't hold many tables on a phone, so small
  // screens default to a scrollable table-card list (0008 spec's mobile
  // surface). Both views are available on both platforms via the toggle.
  const [view, setView] = useState<'plan' | 'list'>(initialView);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  useEffect(() => {
    // Mobile default is List (verdict §7) — unless the URL explicitly asked for
    // the List view (the lab's mirrored segment links here with ?view=list).
    if (initialView !== 'list' && typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      setView('list');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Left-panel breakpoint (verdict §7): below `lg` the stacked panel-above-canvas
  // sandwich is replaced by a bottom drawer over a full-height canvas. Tracked in
  // JS so we render EITHER the desktop aside OR the drawer (one panel instance,
  // no duplicate mount of AddTablePanel / the member lists).
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Left panel → three tabs (People / Tables / Rules), full height (verdict §3).
  // The active tab persists per user; the picked-guest echo lives in the canvas
  // contextual pill so pick-to-seat survives a tab switch.
  const [panelTab, setPanelTab] = useState<'people' | 'tables' | 'rules'>('people');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('seating:panel-tab');
      if (saved === 'people' || saved === 'tables' || saved === 'rules') setPanelTab(saved);
    } catch {
      /* localStorage unavailable (private mode) — default People */
    }
  }, []);
  const selectPanelTab = (t: 'people' | 'tables' | 'rules') => {
    setPanelTab(t);
    try {
      localStorage.setItem('seating:panel-tab', t);
    } catch {
      /* ignore */
    }
  };

  // Mobile bottom drawer (verdict §7): 3 snap points — peek (~handle) / half / full.
  // Drag the handle to resize (snaps to nearest on release); tap cycles up.
  type DrawerSnap = 'peek' | 'half' | 'full';
  const [drawerSnap, setDrawerSnap] = useState<DrawerSnap>('peek');
  const [drawerDragPx, setDrawerDragPx] = useState<number | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerDrag = useRef<{ startY: number; startH: number; moved: boolean } | null>(null);

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
    // Render-crash guard (Sync verdict 2026-07-16 · c): a malformed persisted
    // capacity (negative / non-integer / absurd) would make `new Array(cap)`
    // throw RangeError mid-render → a between-hooks throw → React #310. Sanitize
    // to a safe integer so the table renders DEGRADED, never crashes. (Reads are
    // already healed in fetchTables; this is belt-and-braces for any other path.)
    const cap = sanitizeCapacity(t.capacity);
    const removed = removedSeatSet(t.removed_seats, cap);
    const occ: (SeatingGuest | null)[] = new Array(cap).fill(null);
    const leftovers: SeatingGuest[] = [];
    for (const g of guests) {
      if (g.seated_table_id !== t.table_id) continue;
      if (g.seat_number !== null && g.seat_number >= 0 && g.seat_number < cap && occ[g.seat_number] === null) {
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

  // Linked tables collapse into ONE display unit (combined name + summed seats)
  // for the panel + caterer lists, so a joined set reads as a single pooled
  // table ("Table 3 & 4 · 20 seats") and the caterer counts it once. The canvas
  // still draws each physical table separately — only the lists collapse.
  const displayUnits = useMemo(() => groupTablesIntoUnits(tables), [tables]);
  // Raw seat array (with nulls) across every member of a unit — feeds the filled
  // count + dominant colour the same way occupantsFor does for a single table.
  const unitOcc = (u: TableDisplayUnit): (SeatingGuest | null)[] =>
    u.members.flatMap((m) => occupantsFor(m));
  // First member of a unit with an open, non-removed chair — so "Seat here" on a
  // joined unit overflows into the next table. null when the whole unit is full.
  const firstFreeSeat = (u: TableDisplayUnit): { tableId: string; seat: number } | null => {
    for (const m of u.members) {
      const removed = removedSeatSet(m.removed_seats, m.capacity);
      const occ = occupantsFor(m);
      const seat = occ.findIndex((g, i) => g === null && !removed.has(i));
      if (seat >= 0) return { tableId: m.table_id, seat };
    }
    return null;
  };
  // Tapping a unit row highlights its lead; light up every member of that link
  // group on the canvas so the whole joined unit reads as one (mirrors dragGroup).
  const highlightGroupId = useMemo(
    () => (highlightId ? tables.find((t) => t.table_id === highlightId)?.link_group_id ?? null : null),
    [highlightId, tables],
  );

  // Run a lock-gated server action and react to a lost-lock signal. After a
  // takeover, the client still believes canEdit===true until the <=30s heartbeat
  // returns 'lost'; in that window a gated action throws SeatingLockError. Rather
  // than a generic "try again", we proactively drop to view-only (clear editing)
  // and post a brief notice so the user understands their changes are paused.
  // Re-throws any OTHER error so existing per-caller handling (e.g. link/unlink's
  // own catch) still runs. Returns null on a lock loss so callers can short out.
  // Returns true (and drops to view-only + notices) when `err` is the lock-lost
  // signal; false otherwise so callers can rethrow. Shared by runGated and the
  // try/catch callers (link/unlink/saveLayout/AddTablePanel).
  const handleLockLost = (err: unknown): boolean => {
    if (!isSeatingLockLost(err)) return false;
    lock.notifyLost();
    setNotice('Editing was taken over by another co-host — you’re viewing only now. Your last change wasn’t saved.');
    return true;
  };
  const runGated = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (err) {
      if (handleLockLost(err)) return null;
      throw err;
    }
  };

  // --- seat / move / unseat -------------------------------------------------
  const place = (tableId: string, seatNumber: number | null) => {
    if (!canEdit) return;
    if (!pickedId) return;
    const guestId = pickedId;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('table_id', tableId);
    fd.set('guest_id', guestId);
    if (seatNumber !== null) fd.set('seat_number', String(seatNumber));
    setPickedId(null);
    startTransition(async () => {
      applyGuestOpt({ type: 'seat', guestId, tableId, seat: seatNumber });
      await runGated(() => assignGuest(fd));
    });
  };

  const unseat = (guestId: string) => {
    if (!canEdit) return;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('guest_id', guestId);
    if (pickedId === guestId) setPickedId(null);
    startTransition(async () => {
      applyGuestOpt({ type: 'unseat', guestId });
      await runGated(() => unassignGuest(fd));
    });
  };

  const removeTable = (tableId: string) => {
    if (!canEdit) return;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('table_id', tableId);
    if (highlightId === tableId) setHighlightId(null);
    startTransition(async () => {
      applyTableOpt({ type: 'delete', id: tableId });
      await runGated(() => deleteTable(fd));
    });
  };

  // Deleting a table cascades its seat assignments (DB ON DELETE CASCADE),
  // silently returning everyone at it to the unseated pool — so a table with
  // seated guests asks first. Empty tables keep one-tap delete.
  const seatedAt = (tableId: string) => guests.filter((g) => g.seated_table_id === tableId).length;
  const requestRemoveTable = (t: EventTableRow) => {
    if (seatedAt(t.table_id) === 0) removeTable(t.table_id);
    else setConfirmDelete({ label: t.link_group_label ?? t.table_label, members: [t] });
  };
  // List rows act on the whole display unit: an unlinked table is one member; a
  // joined unit removes every member (each cascades its own seat assignments).
  const requestRemoveUnit = (u: TableDisplayUnit) => {
    const seated = u.members.reduce((n, m) => n + seatedAt(m.table_id), 0);
    if (seated === 0) u.members.forEach((m) => removeTable(m.table_id));
    else setConfirmDelete({ label: u.label, members: u.members });
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
    if (!canEdit) return; // view-only: someone else holds the editor lock.
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const fp = boothFp();
    // Council verdict § 5: Auto Arrange is now a VERIFIED metric solver over the
    // same oracle — every placed slot passes checkPlacement (no silent stacking).
    // Booths become hard no-go zones; the metric walkway drives the gaps.
    const boothZones =
      pxPerMeter && venueScaled
        ? booths.map((b) => ({
            x: (b.x_pos / 100) * rect.width,
            y: (b.y_pos / 100) * rect.height,
            w: BOOTH_FOOTPRINT_M.w * pxPerMeter,
            h: BOOTH_FOOTPRINT_M.d * pxPerMeter,
          }))
        : [];
    const solved = solveAutoLayout({
      tables,
      floorPlan: {
        ...fp,
        dance_enabled: dance.enabled,
        dance_x: dance.x,
        dance_y: dance.y,
        dance_w: dance.w,
        dance_h: dance.h,
        cocktail_enabled: cocktail.enabled,
        cocktail_x: cocktail.x,
        cocktail_y: cocktail.y,
        cocktail_w: cocktail.w,
        cocktail_h: cocktail.h,
      },
      rect: { width: rect.width, height: rect.height },
      footprintOf: footprintPx,
      aisleM: pxPerMeter ? aisleM : undefined,
      pxPerMeter: pxPerMeter ?? undefined,
      booths: boothZones,
    });
    const layout = { ...solved.placed };
    // Best-effort home for any overflow the solver couldn't fit cleanly (never
    // silent — the banner below states the honest count). Kept on-canvas via the
    // existing spiral rather than a fake parked coordinate.
    const overflow = solved.unplaced.filter((id) => !layout[id]);
    for (const id of overflow) {
      const t = tables.find((x) => x.table_id === id);
      if (!t) continue;
      const i = tables.indexOf(t);
      const base = positions[id] ?? defaultGrid(i, tables.length, !venueScaled);
      layout[id] = nearestFree(base.x, base.y, t, rect, (o) => layout[o.table_id] ?? null);
    }
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
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('positions', JSON.stringify(layout));
    fd.set('booths', boothsPayload(nextBooths));
    startTransition(async () => {
      const res = await runGated(() => autoArrange(fd));
      if (!res) return; // lock lost — runGated already dropped us to view-only.
      // The action persisted everything it was sent — nothing is "unsaved".
      setDirty(new Set());
      setBoothsDirty(false);
      const boothWhere = venueScaled ? 'on the perimeter' : 'behind the tables';
      // Keep-apart outcome (Phase 3) — only when rules exist.
      const keepApartNote =
        res.totalRules > 0
          ? ` Honored ${res.satisfiedRules}/${res.totalRules} keep-apart rule${res.totalRules === 1 ? '' : 's'}${
              res.unsatisfiedRules > 0
                ? ` — couldn't separate ${res.unsatisfiedRules} (not enough room; try more tables).`
                : '.'
            }`
          : '';
      // Honest overflow (§ 5): if the walkway is too wide for the room, say so —
      // with the real count that WOULD fit at the 0.6 m Tight floor (a second
      // solver pass, so the suggestion is true, not a guess).
      const fitCount = Object.keys(solved.placed).length;
      const overflowNote =
        overflow.length > 0
          ? ` ⚠ ${overflow.length} table${overflow.length === 1 ? "" : "s"} couldn't fit cleanly at the ${aisleM.toFixed(1)} m walkway (${fitCount} of ${tables.length} fit)${
              solved.altPlacedAtFloor > fitCount ? ` — at 0.6 m (Tight) ${solved.altPlacedAtFloor} fit` : ''
            }. Try a narrower walkway, fewer tables, or a bigger room.`
          : '';
      setNotice(
        (res.seated > 0
          ? `Auto-arranged: ${tables.length} tables in priority order, ${nextBooths.length} booth${nextBooths.length === 1 ? '' : 's'} ${boothWhere}, ${res.seated} guest${res.seated === 1 ? '' : 's'} seated.`
          : `Auto-arranged: ${tables.length} tables in priority order${nextBooths.length > 0 ? ` and ${nextBooths.length} booth${nextBooths.length === 1 ? '' : 's'} ${boothWhere}` : ''}. Everyone who hasn't declined already has a seat.`) +
          keepApartNote +
          overflowNote,
      );
    });
  };

  // "Build my seating" — one tap turns a blank floor into a full, editable draft
  // (UX goal: draft, don't blank). The server action recommends a table set from
  // the guest list, lays it out stage-out, and seats the confirmed guests; then
  // the page revalidates and the draft paints. Gated like every other edit.
  const buildDraft = () => {
    if (!canEdit) return; // view-only: someone else holds the editor lock.
    if (tables.length > 0) return; // guard: only ever builds onto a blank floor.
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    startTransition(async () => {
      const res = await runGated(() => buildSeatingDraft(fd));
      if (!res) return; // lock lost — runGated already dropped us to view-only.
      if (res.tables === 0) {
        setNotice('Add your guests first — then “Build my seating” lays out the whole floor for you.');
        return;
      }
      setNotice(
        res.seated > 0
          ? `Built a starting floor: ${res.tables} tables placed and ${res.seated} confirmed guest${res.seated === 1 ? '' : 's'} seated by role. Drag a table to move it, or tap a guest then a chair to reseat — nothing’s locked in.`
          : `Built a starting floor: ${res.tables} tables placed. As guests confirm, tap Auto Arrange to seat them — or drag them in yourself.`,
      );
    });
  };

  // Tap the P-chip to cycle a guest's explicit priority override: from the
  // derived tier it starts an override at 1, then 2→3→4, then back to derived
  // (null). Optimistic — the chip flips instantly, the server persists.
  const cyclePriority = (g: SeatingGuest) => {
    if (!canEdit) return;
    const next =
      g.seating_priority === null ? 1 : g.seating_priority >= 4 ? null : g.seating_priority + 1;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('guest_id', g.guest_id);
    fd.set('priority', next === null ? '' : String(next));
    startTransition(async () => {
      applyGuestOpt({ type: 'priority', guestId: g.guest_id, value: next });
      await runGated(() => setGuestSeatingPriority(fd));
    });
  };

  // Smart seat-plan Phase 2 — the couple's seating-priority tier order (who Auto
  // Arrange seats nearest the stage). Seeded from the saved order (or the locked
  // default); reorder persists via savePriorityOrder. Reorder works two ways so
  // it's usable on every device: HTML5 drag for desktop pointers (the requested
  // "drag to reorder") + up/down buttons for touch / keyboard / a11y (HTML5 drag
  // doesn't fire on touch, and the seat plan is mobile-used).
  const [priorityOrder, setPriorityOrder] = useState<PriorityOrder>(
    () => floorPlan.priority_order ?? defaultPriorityOrder(roleSet),
  );
  const [dragTierIndex, setDragTierIndex] = useState<number | null>(null);
  const persistPriority = (next: PriorityOrder) => {
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('priority_order', JSON.stringify(next));
    startTransition(async () => {
      await runGated(() => savePriorityOrder(fd));
    });
  };
  const reorderPriorityTo = (from: number, to: number) => {
    if (
      !canEdit ||
      from === to ||
      from < 0 ||
      from >= priorityOrder.length ||
      to < 0 ||
      to >= priorityOrder.length
    ) {
      return;
    }
    const next = priorityOrder.slice();
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    setPriorityOrder(next); // optimistic — the list reflows instantly
    persistPriority(next);
  };
  const movePriorityTier = (index: number, dir: -1 | 1) => reorderPriorityTo(index, index + dir);

  // Keep-apart rules (smart seat-plan Phase 3) — couple-private guest pairs the
  // solver separates onto different tables (group-aware). Optimistic local list
  // seeded from props; add/remove persist via the lock-gated actions.
  const [keepApart, setKeepApart] = useState<KeepApartRule[]>(constraintsProp);
  const sameRule = (x: KeepApartRule, a: string, b: string) =>
    (x.guest_a_id === a && x.guest_b_id === b) || (x.guest_a_id === b && x.guest_b_id === a);
  const addKeepApart = (aId: string, bId: string) => {
    if (!canEdit || !aId || !bId || aId === bId) return;
    if (keepApart.some((r) => sameRule(r, aId, bId))) return; // already a rule (either order)
    setKeepApart((prev) => [...prev, { guest_a_id: aId, guest_b_id: bId }]);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('guest_a_id', aId);
    fd.set('guest_b_id', bId);
    startTransition(async () => {
      await runGated(() => addSeatingConstraint(fd));
    });
  };
  const removeKeepApart = (rule: KeepApartRule) => {
    if (!canEdit) return;
    setKeepApart((prev) => prev.filter((r) => !sameRule(r, rule.guest_a_id, rule.guest_b_id)));
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('guest_a_id', rule.guest_a_id);
    fd.set('guest_b_id', rule.guest_b_id);
    startTransition(async () => {
      await runGated(() => removeSeatingConstraint(fd));
    });
  };

  // Smart seat-plan Phase 4 — lock-and-fill + live keep-apart explainability.
  // A guest's link-group "same table" unit key (null when unseated).
  const unitOfGuestId = (gid: string): string | null => {
    const g = guestsById.get(gid);
    if (!g?.seated_table_id) return null;
    const t = tables.find((x) => x.table_id === g.seated_table_id);
    return t ? t.link_group_id ?? t.table_id : null;
  };
  // A rule is LIVE-violated when both guests currently share a unit (computed
  // from the current seating, so it updates as the couple moves people).
  const isRuleViolated = (r: KeepApartRule): boolean => {
    const ua = unitOfGuestId(r.guest_a_id);
    return ua != null && ua === unitOfGuestId(r.guest_b_id);
  };
  const violatedRules = keepApart.filter(isRuleViolated);
  const lockedCount = guests.filter((g) => g.seat_locked).length;

  const toggleLock = (g: SeatingGuest) => {
    if (!canEdit || !g.seated_table_id) return;
    const next = !g.seat_locked;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('guest_id', g.guest_id);
    fd.set('locked', String(next));
    startTransition(async () => {
      applyGuestOpt({ type: 'lock', guestId: g.guest_id, locked: next });
      await runGated(() => toggleSeatLock(fd));
    });
  };

  const [confirmFill, setConfirmFill] = useState(false);
  // Scroll-less frame (council verdict 2026-07-15): permanent save chip + the
  // "N notices" banner-collapse state.
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [noticesExpanded, setNoticesExpanded] = useState(false);
  const runFillAroundLocked = () => {
    setConfirmFill(false);
    if (!canEdit) return;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    startTransition(async () => {
      const res = await runGated(() => lockAndFill(fd));
      if (!res) return;
      const keepApartNote =
        res.totalRules > 0
          ? ` Honored ${res.satisfiedRules}/${res.totalRules} keep-apart rule${res.totalRules === 1 ? '' : 's'}${
              res.unsatisfiedRules > 0 ? ` — couldn't separate ${res.unsatisfiedRules}.` : '.'
            }`
          : '';
      setNotice(
        `Filled around ${lockedCount} locked seat${lockedCount === 1 ? '' : 's'}: ${res.seated} guest${
          res.seated === 1 ? '' : 's'
        } re-seated.` + keepApartNote,
      );
    });
  };

  // One-tap relax: drop the lowest-priority rule among those currently violated.
  const relaxLowest = () => {
    if (!canEdit || violatedRules.length === 0) return;
    const asAuto: AutoSeatGuest[] = guests.map((g) => ({
      guest_id: g.guest_id,
      role: g.role,
      group_category: g.group_category,
      rsvp_status: g.rsvp_status,
      plus_one_of_guest_id: null,
      last_name: '',
      first_name: '',
      group_id: g.group_id,
      seating_priority: g.seating_priority,
    }));
    const rule = relaxLowestPriorityRule(violatedRules, asAuto, priorityOrder, roleSet);
    if (rule) removeKeepApart(rule);
  };

  // Set the guest-photo visibility for the public 3D venue walk. Optimistic:
  // the choice flips instantly, then persists lock-gated (runGated drops us to
  // view-only + reverts if a peer took the editor). Reverts on any error too.
  const setPhotoVisibility = (next: 'table' | 'all' | 'none') => {
    if (!canEdit || next === photoVis) return;
    const prev = photoVis;
    setPhotoVis(next);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('venue_photo_visibility', next);
    startTransition(async () => {
      try {
        const res = await runGated(() => saveVenuePhotoVisibility(fd));
        if (res === null) setPhotoVis(prev); // lock lost — revert to server truth.
      } catch {
        setPhotoVis(prev);
        setNotice('Couldn’t save the photo setting — please try again.');
      }
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
    if (!canEdit) return;
    const trimmed = label.trim();
    const current = tables.find((t) => t.table_id === tableId)?.table_label ?? '';
    if (!trimmed || trimmed === current) return;
    // Advisory only (never blocks): a Chinese-wedding couple renaming a table to a
    // ones-digit-4 number gets a gentle heads-up; the rename proceeds regardless.
    if (chineseTradition && tableNumberEndsInFour(trimmed)) setNotice(TABLE_FOUR_ADVISORY);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('table_id', tableId);
    fd.set('table_label', trimmed.slice(0, 64));
    startTransition(async () => {
      await runGated(() => updateTableLabel(fd));
    });
  };

  // Bulk-seat a group onto a table (seat-what-fits; the server returns counts
  // and we surface a notice on overflow). Used by the pick-then-tap flow AND
  // the popup's in-context "Seat people" picker.
  const seatGroupMembers = (groupId: string, tableId: string) => {
    if (!canEdit) return;
    const groupLabel = groups.find((g) => g.group_id === groupId)?.label ?? 'group';
    const memberIds = guests.filter((g) => g.group_id === groupId).map((g) => g.guest_id);
    setNotice(null);
    if (memberIds.length === 0) return;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('table_id', tableId);
    fd.set('guest_ids', JSON.stringify(memberIds));
    startTransition(async () => {
      applyGuestOpt({ type: 'seatGroup', ids: memberIds, tableId });
      const res = await runGated(() => assignGroup(fd));
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
    if (!canEdit) return;
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
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('table_id', t.table_id);
    fd.set('guest_id', guestId);
    if (free !== null) fd.set('seat_number', String(free));
    startTransition(async () => {
      applyGuestOpt({ type: 'seat', guestId, tableId: t.table_id, seat: free });
      await runGated(() => assignGuest(fd));
    });
  };

  // Seat a whole role tier here (the picker's Role tab). Server-side
  // seat-what-fits; we surface the overflow notice like group seating.
  const seatTierHere = (t: EventTableRow, tier: 1 | 2 | 3 | 4) => {
    if (!canEdit) return;
    setNotice(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('table_id', t.table_id);
    fd.set('tier', String(tier));
    startTransition(async () => {
      const res = await runGated(() => seatRoleAtTable(fd));
      if (res && res.overflow > 0) {
        setNotice(
          `${roleSet.tierLabels[tier]}: seated ${res.seated} of ${res.requested} at ${t.table_label} — ${res.overflow} didn't fit. Pick another table for the rest.`,
        );
      }
    });
  };

  // Break a legacy grouped unit apart. CREATING a link is deferred to a future
  // PR (owner 2026-07-16 — this PR connects tables by drag-snap POSITIONING, not
  // by linking); `doLinkTables` / the link gestures are retired. Existing
  // `link_group_id` data is left intact and can still be un-grouped here.
  const doUnlink = (tableId: string) => {
    if (!canEdit) return;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('table_id', tableId);
    startTransition(async () => {
      try {
        await unlinkTable(fd);
        setNotice('Broken apart — every table in that unit is independent again, with its own name and QR sign.');
      } catch (err) {
        if (!handleLockLost(err)) {
          setNotice(`Couldn't break the unit apart — please try again.`);
        }
      }
    });
  };

  // The table's current orientation (optimistic override → row default).
  const rotationOf = (t: EventTableRow) => rotById[t.table_id] ?? t.rotation_deg ?? 0;

  // Frozen geometry of a linked unit at gesture-start (see groupSnap below) —
  // carried on the rotate refs so a continuous twist rotates the WHOLE unit.
  type GroupSnap = {
    cx: number;
    cy: number;
    rectW: number;
    rectH: number;
    pts: { id: string; px: number; py: number; rot0: number }[];
  };

  // --- continuous rotation (two-finger twist + the desktop rotate handle) ----
  // Two-finger: first finger starts a table drag; when a SECOND finger lands,
  // the drag converts into a rotate gesture (Δangle between the two pointers).
  // A ~6° dead-zone stops an intended pinch from nudging the table. The live
  // angle previews via rotById (same optimistic path the rotate buttons use)
  // and commits once on release. When the grabbed table belongs to a linked
  // unit the gesture rotates the whole unit (snap captured at grab time).
  const rotateGestureRef = useRef<{
    tableId: string;
    startAngle: number;
    startRot: number;
    latched: boolean;
    latest: number;
    members: string[];
    snap: GroupSnap | null;
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
    members: string[];
    snap: GroupSnap | null;
  } | null>(null);
  // Serpentine chain snap may rotate the dragged wedge mid-drag (the joint
  // dictates the angle); the final angle commits once on release. Carries the
  // snap centre + catch radius so the drag can HYSTERESIS-clear the stale chain
  // angle once it leaves 1.4× the catch radius (verdict § 1 root cause 6 —
  // otherwise a free-position wedge persists a phantom chain angle).
  const serpSnapRotRef = useRef<{ id: string; rot: number; cx: number; cy: number; r: number } | null>(null);

  const angleDeg = (cx: number, cy: number, px: number, py: number) =>
    (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
  const normDeg = (d: number) => ((Math.round(d) % 360) + 360) % 360;
  const snapDeg = (d: number, step: number) => normDeg(Math.round(d / step) * step);

  // Persist a final orientation exactly (1° granularity — unlike the ±15°
  // buttons, a continuous gesture may land on a fine angle via Shift).
  const commitRotation = (tableId: string, deg: number) => {
    if (!canEdit) return;
    const next = normDeg(deg);
    // § 1 root cause 4: only a legal angle persists. If the target angle would
    // collide with a non-joint neighbour, refuse it (revert to the stored angle)
    // — legal-joint partners are exempt so a chain-snapped joint still commits.
    const t = tables.find((x) => x.table_id === tableId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (t && rect && rect.width > 0) {
      const cur = positions[tableId] ?? defaultGrid(tables.indexOf(t), tables.length, !venueScaled);
      if (rotationBlocked(t, cur.x, cur.y, next, rect)) {
        setRotById((m) => {
          if (!(tableId in m)) return m;
          const n = { ...m };
          delete n[tableId];
          return n;
        });
        setNotice('No room to rotate that table there — move it to more open space first.');
        return;
      }
    }
    setRotById((m) => ({ ...m, [tableId]: next }));
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('table_id', tableId);
    fd.set('rotation_deg', String(next));
    startTransition(async () => {
      await runGated(() => updateTableRotation(fd));
    });
  };

  // --- linked-table grouping (Keynote-style "group as one") ----------------
  // Tables sharing a link_group_id are ONE unit: dragging moves them together
  // and rotating spins the whole unit around its shared centre (each member
  // orbits the centroid AND turns on its own axis by the same angle). "Break
  // apart" (unlink) dissolves the unit back into independent tables.
  const groupMemberIds = (tableId: string): string[] => {
    const t = tables.find((x) => x.table_id === tableId);
    if (!t?.link_group_id) return t ? [t.table_id] : [];
    return tables.filter((x) => x.link_group_id === t.link_group_id).map((x) => x.table_id);
  };

  // Freeze a unit's geometry at gesture-start: every member's position in
  // canvas PIXELS (grab-time canvas size) plus the unit centroid. A continuous
  // rotate then maps absolute angle → absolute layout with no frame-to-frame
  // drift. Percentages can't rotate directly — a non-square canvas would shear
  // them — hence the px round-trip.
  const groupSnap = (memberIds: string[], rect: DOMRect): GroupSnap => {
    const pts = memberIds.map((id) => {
      const idx = tables.findIndex((x) => x.table_id === id);
      const t = tables[idx];
      const p = positions[id] ?? defaultGrid(idx, tables.length, !venueScaled);
      return {
        id,
        px: (p.x / 100) * rect.width,
        py: (p.y / 100) * rect.height,
        rot0: t ? rotationOf(t) : 0,
      };
    });
    const cx = pts.reduce((s, p) => s + p.px, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.py, 0) / pts.length;
    return { cx, cy, rectW: rect.width, rectH: rect.height, pts };
  };

  // Apply an absolute rotation `deltaDeg` from a snapshot → optimistic
  // positions + per-table angles. Returns the next maps for persistence.
  const applyGroupRotation = (snap: GroupSnap, deltaDeg: number) => {
    const nextPos: Record<string, LocalPos> = {};
    const nextRot: Record<string, number> = {};
    for (const p of snap.pts) {
      const r = rotatePoint({ x: p.px - snap.cx, y: p.py - snap.cy }, deltaDeg);
      nextPos[p.id] = {
        x: ((snap.cx + r.x) / snap.rectW) * 100,
        y: ((snap.cy + r.y) / snap.rectH) * 100,
      };
      nextRot[p.id] = normDeg(p.rot0 + deltaDeg);
    }
    setPositions((pp) => ({ ...pp, ...nextPos }));
    setRotById((m) => ({ ...m, ...nextRot }));
    return { nextPos, nextRot };
  };

  // Persist a whole unit's new positions + angles together. Rotation already
  // persists instantly (unlike position, which waits for Save) — so the orbit
  // it induces must persist too, or the unit would reload deformed (angles
  // saved, positions not). Persisted members drop out of the pending-Save set.
  const persistGroupTransform = (
    nextPos: Record<string, LocalPos>,
    nextRot: Record<string, number>,
  ) => {
    if (!canEdit) return;
    const lockId = lock.lockId ?? '';
    const ids = Object.keys(nextRot);
    startTransition(async () => {
      await runGated(async () => {
        for (const id of ids) {
          const fr = new FormData();
          fr.set('event_id', eventId);
          fr.set('lock_id', lockId);
          fr.set('table_id', id);
          fr.set('rotation_deg', String(nextRot[id]));
          await updateTableRotation(fr);
          const fp = new FormData();
          fp.set('event_id', eventId);
          fp.set('lock_id', lockId);
          fp.set('table_id', id);
          fp.set('x_pos', String(nextPos[id]!.x));
          fp.set('y_pos', String(nextPos[id]!.y));
          await updateTablePosition(fp);
        }
      });
    });
    setDirty((s) => {
      const n = new Set(s);
      ids.forEach((id) => n.delete(id));
      return n;
    });
  };

  // Rotate a whole unit by a discrete step (the ±15° / Flip buttons).
  const rotateGroupBy = (memberIds: string[], deltaDeg: number) => {
    if (!canEdit || !deltaDeg) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const snap = groupSnap(memberIds, rect);
    // § 1 root cause 4: refuse a unit twist that would collide with a non-member.
    if (groupRotationBlocked(snap, deltaDeg)) {
      setNotice('No room to rotate this linked group here — move it to more open space first.');
      return;
    }
    const { nextPos, nextRot } = applyGroupRotation(snap, deltaDeg);
    persistGroupTransform(nextPos, nextRot);
  };

  // Rotate a table by `delta` degrees (or to an absolute angle). Snaps to 15°,
  // updates instantly, persists. Rotation is what lets wedges/banquets connect.
  // A linked table rotates its whole unit around the shared centre.
  const rotateTable = (t: EventTableRow, delta: number, absolute = false) => {
    if (!canEdit) return;
    const members = groupMemberIds(t.table_id);
    if (members.length > 1 && !absolute) {
      rotateGroupBy(members, delta);
      return;
    }
    const base = absolute ? 0 : rotationOf(t);
    const next = ((Math.round((base + delta) / 15) * 15) % 360 + 360) % 360;
    // § 1 root cause 4: refuse a single-table rotation with no room (joint-exempt).
    const rectR = canvasRef.current?.getBoundingClientRect();
    if (rectR && rectR.width > 0) {
      const cur = positions[t.table_id] ?? defaultGrid(tables.indexOf(t), tables.length, !venueScaled);
      if (rotationBlocked(t, cur.x, cur.y, next, rectR)) {
        setNotice('No room to rotate that table there — move it to more open space first.');
        return;
      }
    }
    setRotById((m) => ({ ...m, [t.table_id]: next }));
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('table_id', t.table_id);
    fd.set('rotation_deg', String(next));
    startTransition(async () => {
      await runGated(() => updateTableRotation(fd));
    });
  };

  // Change a table's STYLE (long → round, etc.). Capacity resets to the new
  // shape and guests in chairs the new shape lacks are returned to the pool;
  // the notice reports how many. Optimistic so the shape flips instantly.
  const changeStyle = (t: EventTableRow, newType: TableType) => {
    if (!canEdit) return;
    if (newType === t.table_type) return;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('table_id', t.table_id);
    fd.set('table_type', newType);
    const newLabel = TABLE_TYPE_LABEL[newType];
    startTransition(async () => {
      const res = await runGated(() => updateTableType(fd));
      if (!res) return; // lock lost — runGated already dropped us to view-only.
      setNotice(
        res.unseated > 0
          ? `“${t.table_label}” is now a ${newLabel.toLowerCase()} — ${res.unseated} guest${res.unseated === 1 ? '' : 's'} in seats the new shape doesn’t have ${res.unseated === 1 ? 'was' : 'were'} returned to the unseated list.`
          : `“${t.table_label}” is now a ${newLabel.toLowerCase()}.`,
      );
    });
  };

  // Commit an EXACT orientation (the dock's click-to-type degrees · verdict §2).
  // Unlike the ±15° buttons this bypasses the 15° snap; group-aware.
  const commitRotationExact = (t: EventTableRow, deg: number) => {
    if (!canEdit) return;
    const cur = rotationOf(t);
    const target = normDeg(deg);
    if (target === cur) return;
    const members = groupMemberIds(t.table_id);
    if (members.length > 1) rotateGroupBy(members, target - cur);
    else commitRotation(t.table_id, target);
  };

  // ── Seats stepper (verdict §3, the 90% path) — bulk chair remove/restore over
  //    the same `toggleSeat` action. `−` removes the HIGHEST-index empty seat,
  //    `+` restores the LOWEST-index removed seat. Presentation only. ───────────
  const emptySeatIndices = (t: EventTableRow): number[] => {
    const removed = removedSeatSet(t.removed_seats, t.capacity);
    const occ = occupantsFor(t);
    const out: number[] = [];
    for (let i = 0; i < occ.length; i++) if (occ[i] === null && !removed.has(i)) out.push(i);
    return out;
  };
  const removedSeatIndices = (t: EventTableRow): number[] =>
    [...removedSeatSet(t.removed_seats, t.capacity)].sort((a, b) => a - b);
  const decSeat = (t: EventTableRow) => {
    if (!canEdit) return;
    const empties = emptySeatIndices(t);
    if (empties.length === 0) return; // every remaining chair is occupied
    const seat = empties[empties.length - 1]!; // highest-index empty
    toggleSeat(t.table_id, seat, true);
    setSeatNotice({ tableId: t.table_id, seat });
  };
  const incSeat = (t: EventTableRow) => {
    if (!canEdit) return;
    const removed = removedSeatIndices(t);
    if (removed.length === 0) return; // none removed to restore
    toggleSeat(t.table_id, removed[0]!, false); // lowest-index removed
    setSeatNotice(null);
  };
  const undoSeatRemoval = () => {
    if (!seatNotice) return;
    toggleSeat(seatNotice.tableId, seatNotice.seat, false);
    setSeatNotice(null);
  };

  // Delete / restore a single chair (clears the edge where two tables connect).
  const toggleSeat = (tableId: string, seatNumber: number, removed: boolean) => {
    if (!canEdit) return;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('table_id', tableId);
    fd.set('seat_number', String(seatNumber));
    fd.set('removed', removed ? 'true' : 'false');
    startTransition(async () => {
      await runGated(() => setTableSeat(fd));
    });
  };

  // --- collision avoidance: tables never overlap ----------------------------
  // A table's on-screen footprint in px, honouring the to-scale shrink inside a
  // sized room (same maths as fitView + the table render).
  const footprintPx = (t: EventTableRow) => {
    const geo = tableGeometry(shapeHintFor(t.table_type), t.capacity);
    // GUN B: true metric footprint on BOTH boards (metricPpm is always defined
    // once the canvas is measured); the scale : 1 fallback only covers the
    // canvasW === 0 first paint.
    const s = metricPpm ? (TABLE_FOOTPRINT_M[t.table_type] * metricPpm) / geo.box.w : 1;
    return { w: geo.box.w * s, h: geo.box.h * s };
  };
  // Half the TABLETOP length (px) of a rectangular run — hub only, chairs hang
  // past it. Used to test whether two runs are joined flush (rectRunsJoined).
  const halfLenOf = (t: EventTableRow) => {
    const g = tableGeometry(shapeHintFor(t.table_type), t.capacity);
    return (g.hub.w / 2) * (footprintPx(t).w / g.box.w);
  };
  // Breathing gap (px) kept between any two tables on the FREE board (no metre
  // scale). In a sized room the metric Walkway width (aisleM) drives the gap.
  const COLLIDE_GAP = 10;
  const gapPxNow = () => (pxPerMeter ? aisleM * pxPerMeter : COLLIDE_GAP);
  // Council verdict 2026-07-16: every collision test routes through the ONE
  // placement oracle (lib/seating.ts). `scaleOf`/`poseAt` build the rotation-
  // aware world pose the oracle consumes; `zonesFor` collects the no-go rects.
  const scaleOf = (t: EventTableRow) => {
    const geo = tableGeometry(shapeHintFor(t.table_type), t.capacity);
    return footprintPx(t).w / geo.box.w;
  };
  const poseAt = (
    t: EventTableRow,
    xPct: number,
    yPct: number,
    rect: { width: number; height: number },
  ): WorldPose => ({
    tableId: t.table_id,
    shape: shapeHintFor(t.table_type),
    capacity: t.capacity,
    x: (xPct / 100) * rect.width,
    y: (yPct / 100) * rect.height,
    rot: rotationOf(t),
    scale: scaleOf(t),
    linkGroupId: t.link_group_id ?? null,
  });
  const zonesFor = (rect: { width: number; height: number }): OracleZone[] => {
    const toPx = (p: number, axis: 'w' | 'h') => (p / 100) * (axis === 'w' ? rect.width : rect.height);
    const out: OracleZone[] = [];
    // The stage platform is a sweetheart-exempt no-go zone: only the couple's
    // sweetheart table may sit on it (owner 2026-07-16 · shared oracle rule,
    // identical in 3D). Every other table over the stage reads as a collision
    // and heals via the same slide / monotone-escape as any obstacle. Sized room
    // only — the free auto-grow board is place-anywhere in both projections.
    if (venueScaled)
      out.push(stageZone({ stage_x: stage.x, stage_y: stage.y, stage_w: stage.w, stage_h: stage.h }, rect));
    // The dance floor + cocktail room are no-table zones.
    if (dance.enabled)
      out.push({ id: 'dance', x: toPx(dance.x, 'w'), y: toPx(dance.y, 'h'), w: toPx(dance.w, 'w'), h: toPx(dance.h, 'h') });
    if (cocktail.enabled)
      out.push({ id: 'cocktail', x: toPx(cocktail.x, 'w'), y: toPx(cocktail.y, 'h'), w: toPx(cocktail.w, 'w'), h: toPx(cocktail.h, 'h') });
    // Vendor booths are obstacles too — real metre footprint (sized room only).
    if (pxPerMeter) {
      const bw = BOOTH_FOOTPRINT_M.w * pxPerMeter;
      const bh = BOOTH_FOOTPRINT_M.d * pxPerMeter;
      booths.forEach((b, i) =>
        out.push({ id: `booth${i}`, x: toPx(b.x_pos, 'w'), y: toPx(b.y_pos, 'h'), w: bw, h: bh }),
      );
    }
    return out;
  };
  // All OTHER table poses (posFor yields each table's %-position, or null to
  // skip one while the auto-place pass is still deciding).
  const othersFor = (
    moving: EventTableRow,
    rect: { width: number; height: number },
    posFor: (o: EventTableRow, i: number) => LocalPos | null,
  ): WorldPose[] => {
    const out: WorldPose[] = [];
    tables.forEach((o, i) => {
      if (o.table_id === moving.table_id) return;
      const op = posFor(o, i);
      if (!op) return;
      out.push(poseAt(o, op.x, op.y, rect));
    });
    return out;
  };
  // Would `moving` sitting at (x%,y%) violate the oracle — a body overlap OR a
  // walkway-clearance shortfall — against any other table, zone or booth? The
  // ONLY sanctioned contact is same-link_group_id membership (the weld model);
  // the retired distance-only serpentine/rect join exemptions are gone (verdict
  // § 1 root cause 1) so a snapped-but-unlinked pair now reads as a collision
  // and heals via slide/monotone-escape — a drop can never persist the overlap.
  const overlapsAny = (
    x: number,
    y: number,
    moving: EventTableRow,
    rect: { width: number; height: number },
    posFor: (o: EventTableRow, i: number) => LocalPos | null,
  ) => {
    const res = checkPlacement(
      poseAt(moving, x, y, rect),
      { others: othersFor(moving, rect, posFor), zones: zonesFor(rect) },
      { gapPx: gapPxNow() },
    );
    return !res.valid;
  };
  // Council verdict § 1 root cause 4 — every rotate path validates through the
  // oracle so only a LEGAL angle ever persists. Would `t`, sitting at (x%,y%)
  // rotated to `deg`, collide? Legal-joint partners (a serpentine tip-join / rect
  // flush / round kiss) and same-unit members are exempt — so a chain-snapped
  // joint angle passes even before the link commits. Free board: never blocked.
  const rotationBlocked = (
    t: EventTableRow,
    xPct: number,
    yPct: number,
    deg: number,
    rect: { width: number; height: number },
  ): boolean => {
    if (!venueScaled) return false;
    const pose: WorldPose = { ...poseAt(t, xPct, yPct, rect), rot: deg };
    const jp = { shape: pose.shape, capacity: pose.capacity, x: pose.x, y: pose.y, rot: deg, scale: pose.scale };
    const ppm = pxPerMeter ?? 40;
    const posFor = (o: EventTableRow, i: number) =>
      positions[o.table_id] ?? defaultGrid(i, tables.length, !venueScaled);
    const others = othersFor(t, rect, posFor).filter((op) => {
      // A clean geometric joint (chain-class, coincident ends, tangent-continuous)
      // is valid adjacency — not a collision. No link needed. `jp` carries the
      // candidate rotation being tested.
      if (atLegalJoint(jp, op)) return false;
      return true;
    });
    return !checkPlacement(pose, { others, zones: zonesFor(rect) }, { gapPx: gapPxNow() }).valid;
  };
  // A whole linked unit's would-be rotation — poses computed WITHOUT mutating
  // state. Blocked iff any member collides with a NON-member (members exempt
  // each other by link membership). Used to refuse a unit twist with no room.
  const groupRotationBlocked = (snap: GroupSnap, deltaDeg: number): boolean => {
    if (!venueScaled) return false;
    const rect = { width: snap.rectW, height: snap.rectH };
    const memberIds = new Set(snap.pts.map((p) => p.id));
    const nonMembers = tables.filter((o) => !memberIds.has(o.table_id));
    const zones = zonesFor(rect);
    for (const p of snap.pts) {
      const t = tables.find((x) => x.table_id === p.id);
      if (!t) continue;
      const r = rotatePoint({ x: p.px - snap.cx, y: p.py - snap.cy }, deltaDeg);
      const pose: WorldPose = {
        tableId: p.id,
        shape: shapeHintFor(t.table_type),
        capacity: t.capacity,
        x: snap.cx + r.x,
        y: snap.cy + r.y,
        rot: normDeg(p.rot0 + deltaDeg),
        scale: scaleOf(t),
        linkGroupId: t.link_group_id ?? null,
      };
      const others: WorldPose[] = nonMembers.map((o) => {
        const op = positions[o.table_id] ?? defaultGrid(tables.indexOf(o), tables.length, !venueScaled);
        return poseAt(o, op.x, op.y, rect);
      });
      if (!checkPlacement(pose, { others, zones }, { gapPx: gapPxNow() }).valid) return true;
    }
    return false;
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

  // Oracle-valid spawn (world %) for a NEW table of `type`/`capacity`, via the
  // SAME nearestFree the drag/auto-place paths use — so CREATE persists a
  // non-overlapping, off-stage home and the 3D view reads the identical spot
  // (owner 2026-07-16 · full authoring parity). Sized room only; the free board
  // stays position-less (place-anywhere → the client grid resolves it on render,
  // matching the 3D side which also returns null there).
  const computeSpawnFor = (type: TableType, capacity: number): { x: number; y: number } | null => {
    if (!venueScaled) return null;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const pseudo: EventTableRow = {
      table_id: '__new__',
      public_id: '__new__',
      event_id: eventId,
      table_label: '',
      table_type: type,
      capacity,
      sort_order: tables.length,
      x_pos: null,
      y_pos: null,
    };
    const base = defaultGrid(tables.length, tables.length + 1, !venueScaled);
    const posFor = (o: EventTableRow, i: number) => positions[o.table_id] ?? defaultGrid(i, tables.length, !venueScaled);
    return nearestFree(base.x, base.y, pseudo, rect, posFor);
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
  //
  // Also skipped while an optimistic mutation is in flight (`isPending`). Delete
  // mutates the table SET via `useOptimistic` (applyTableOpt), which yields a
  // fresh `tables` array reference on every render as the optimistic and base
  // states settle. This effect keys off that reference AND writes `positions`,
  // so an in-flight delete re-ran it → rewrote positions → re-rendered → re-ran
  // every frame, exhausting React's update depth ("Something on our end didn't
  // work" on delete — surfaced once the post-#3305 collision model began moving
  // tables during the churn). The transient optimistic set is never worth
  // re-placing; we re-resolve once cleanly when the mutation settles.
  useIsoLayoutEffect(() => {
    if (wallDragRef.current || isPending) return;
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
  }, [tables, venueScaled, canvasW, wallSettled, isPending]);

  // Council verdict § 6 — READ-ONLY mount audit. Saved anchors are NEVER
  // rearranged on load (the resolver above honours them verbatim); this just
  // reports which tables sit in a real persisted overlap (or a tight gap after
  // the walkway was widened) so the editor can surface a dismissible "N overlaps
  // — Review" pill. Zero mutation. Runs on mount / settle / walkway change, not
  // per drag frame. `overlap` = body intersection · `tight` = gap < walkway.
  useIsoLayoutEffect(() => {
    // Skipped while an optimistic mutation is in flight — same reason as the
    // auto-place resolver above: an in-flight delete churns the `useOptimistic`
    // `tables` reference every render, and recomputing + writing the audit map
    // each time drove the same "Maximum update depth" loop. Re-audit once the
    // mutation settles.
    if (isPending) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || !venueScaled) {
      setMountAudit((m) => (m.size === 0 ? m : new Map()));
      return;
    }
    const poses: WorldPose[] = tables.map((t, i) => {
      const p = positions[t.table_id] ?? defaultGrid(i, tables.length, !venueScaled);
      return poseAt(t, p.x, p.y, rect);
    });
    const violations = layoutViolations(poses, zonesFor(rect), gapPxNow());
    const next = new Map<string, 'overlap' | 'tight'>();
    for (const row of violations) {
      next.set(row.tableId, row.violations.some((v) => v.kind === 'overlap') ? 'overlap' : 'tight');
    }
    setMountAudit((prev) => {
      if (prev.size === next.size && [...next].every(([k, v]) => prev.get(k) === v)) return prev;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables, venueScaled, canvasW, wallSettled, aisleM, isPending]);

  // --- table reposition (drag the centre hub) ------------------------------
  const onHubPointerDown = (t: EventTableRow) => (e: React.PointerEvent) => {
    // View-only (a peer holds the editor lock): no drag, no seating. Let the
    // event bubble so the canvas can still pan/zoom for inspection.
    if (!canEdit) return;
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
    (kind: 'stage' | 'entrance' | 'service' | 'dance' | 'cocktail') => (e: React.PointerEvent) => {
      if (!canEdit) return; // view-only: floor-plan markers aren't draggable.
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
      // Capture the marker's drag-START centre so an invalid / cancelled release
      // returns it (the zone twin of dragStartRef · owner 2026-07-17).
      const src =
        kind === 'stage' ? stage : kind === 'dance' ? dance : kind === 'cocktail' ? cocktail : kind === 'service' ? serviceDoor : entrance;
      markerStartRef.current = { kind, pos: { x: src.x, y: src.y } };
      setDragId(`__${kind}__`);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

  // Drag a vendor booth — same pointer model, but the move handler runs the
  // hardcoded perimeter snap (clampBoothToPerimeter) on every frame, so a
  // booth can only travel along the legal wall band.
  const onBoothPointerDown = (boothId: string) => (e: React.PointerEvent) => {
    if (!canEdit) return; // view-only: booths aren't draggable.
    if (pickedId || pickedGroupId) {
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { kind: 'booth', id: boothId, sx: e.clientX, sy: e.clientY, moved: false };
    const b0 = booths.find((x) => x.booth_id === boothId);
    markerStartRef.current = b0 ? { kind: 'booth', pos: { x: b0.x_pos, y: b0.y_pos } } : null;
    setDragId(`__booth_${boothId}__`);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onSignPointerDown = (signId: string) => (e: React.PointerEvent) => {
    if (!canEdit) return;
    if (pickedId || pickedGroupId) {
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { kind: 'sign', id: signId, sx: e.clientX, sy: e.clientY, moved: false };
    const s0 = signs.find((x) => x.sign_id === signId);
    markerStartRef.current = s0 ? { kind: 'sign', pos: { x: s0.x_pos, y: s0.y_pos } } : null;
    setDragId(`__sign_${signId}__`);
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
      const members = groupMemberIds(d.id);
      const rect = canvasRef.current?.getBoundingClientRect();
      rotateGestureRef.current = {
        tableId: d.id,
        startAngle: angleDeg(first.x, first.y, e.clientX, e.clientY),
        startRot: rotationOf(t),
        latched: false,
        latest: rotationOf(t),
        members,
        snap: members.length > 1 && rect && rect.width > 0 ? groupSnap(members, rect) : null,
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
        if (rg.snap) {
          // Linked unit → orbit + spin every member from the frozen snapshot.
          applyGroupRotation(rg.snap, next - rg.startRot);
        } else {
          setRotById((m) => ({ ...m, [rg.tableId]: next }));
        }
      }
      return;
    }
    // 1) dragging a table hub (zoom/pan-aware: screen px → world %)
    const d = dragRef.current;
    if (d) {
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
      if (!d.moved) {
        // First real movement of THIS gesture — snapshot the moved unit's START
        // pose(s) while `positions` still holds the pre-drag layout, so an invalid
        // release can return it exactly to where the drag began (snap-back rule).
        if (d.kind === 'table') {
          const unit = groupMemberIds(d.id);
          const start: Record<string, LocalPos> = {};
          for (const id of unit) {
            const i = tables.findIndex((t) => t.table_id === id);
            start[id] = positions[id] ?? defaultGrid(i, tables.length, !venueScaled);
          }
          dragStartRef.current = start;
        } else {
          dragStartRef.current = null;
        }
        setDragInvalid(false);
        setSnapBackIds((s) => (s.size ? new Set() : s)); // a fresh drag clears any prior snap-back
      }
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
        // Linked unit → move every member as ONE rigid block (Keynote-style):
        // the whole unit translates by the grabbed table's delta, with no
        // internal chaining/align snap (the unit is already assembled). The
        // delta is clamped so no member leaves the board, keeping it rigid.
        const unit = groupMemberIds(d.id);
        if (unit.length > 1) {
          const posOf = (id: string) => {
            const i = tables.findIndex((t) => t.table_id === id);
            return positions[id] ?? defaultGrid(i, tables.length, !venueScaled);
          };
          const prev = posOf(d.id);
          let dx = x - prev.x;
          let dy = y - prev.y;
          for (const id of unit) {
            const mp = posOf(id);
            dx = Math.max(lo - mp.x, Math.min(hi - mp.x, dx));
            dy = Math.max(lo - mp.y, Math.min(hi - mp.y, dy));
          }
          setPositions((p) => {
            const n = { ...p };
            for (const id of unit) {
              const mp = p[id] ?? posOf(id);
              n[id] = { x: mp.x + dx, y: mp.y + dy };
            }
            return n;
          });
          guidesRef.current = { x: null, y: null };
          return;
        }
        // Table chaining: when dragging near a same-family table's connection
        // point, magnet them together — serpentine tips chain into an
        // S / circle (position + rotation), banquet/family-head ends join
        // flush into one continuous run (position + rotation), and rounds
        // kiss edge-to-edge with the chair rings clearing (position only).
        // Wins over the alignment/grid snap; Alt drags free. When it fires we
        // return early (the collision pass never runs), and overlapsAny exempts
        // the resulting tip/flush contact (chainJoined) so the snapped join —
        // and any explicit linked unit — survives remounts. A near-miss that
        // DOESN'T snap now falls through to the collision pass instead of
        // free-overlapping (the owner-reported "serpentines stack" bug).
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
          // halfLenOf (tabletop half-length, hub only) is defined at component scope.
          let snap: { x: number; y: number; rot?: number } | null = null;
          let catchR = 36;
          // Chain-class shapes (banquet + serpentine) weld end-to-end, now
          // INCLUDING cross-family (owner 2026-07-16): a dragged serpentine snaps
          // onto a banquet end and vice-versa. One unified pass over every
          // chain-class neighbour through `legalJoinPose` (the single snap/join
          // oracle) picks the nearest legal candidate — same-family and cross —
          // so a straight run flows tangent-continuous into a curve. Round keeps
          // its separate same-family kiss.
          if (movingShape === 'serpentine' || isRect(movingShape)) {
            catchR =
              movingShape === 'serpentine'
                ? Math.max(48, footprintPx(movingEarly).w * 0.5)
                : Math.max(40, halfLenOf(movingEarly) * 0.9);
            const moverJoin = {
              shape: movingShape,
              capacity: movingEarly.capacity,
              x: dragPx.x,
              y: dragPx.y,
              rot: rotationOf(movingEarly),
              scale: scaleOf(movingEarly),
            };
            let bestD = catchR * catchR;
            for (const o of tables) {
              if (o.table_id === d.id) continue;
              const oShape = shapeHintFor(o.table_type);
              if (!chainableShapes(oShape, movingShape)) continue;
              const p = pxOf(o);
              const cand = legalJoinPose(
                { shape: oShape, capacity: o.capacity, x: p.x, y: p.y, rot: rotationOf(o), scale: scaleOf(o) },
                moverJoin,
                catchR,
              );
              if (!cand) continue;
              const dd = (cand.x - dragPx.x) ** 2 + (cand.y - dragPx.y) ** 2;
              if (dd < bestD) {
                bestD = dd;
                snap = cand;
              }
            }
          }
          // Round / sweetheart / king DON'T snap — they're standalone furniture
          // (owner 2026-07-16): drag freely and collide like any solid table.
          if (snap) {
            const nx = Math.max(lo, Math.min(hi, (snap.x / rect.width) * 100));
            const ny = Math.max(lo, Math.min(hi, (snap.y / rect.height) * 100));
            const snapRot = snap.rot ?? rotationOf(movingEarly);
            const ppm = pxPerMeter ?? 40;
            // Weld model (§ 2): snap is LINK. Identify which same-family neighbour
            // we welded onto, then run the ghost through the oracle vs ALL third
            // parties + zones/booths (the weld anchor is the one legal contact,
            // excluded). If the welded pose collides elsewhere → "No room": refuse
            // the weld and fall through to the plain slide.
            const snappedJoinPose = {
              shape: movingShape,
              capacity: movingEarly.capacity,
              x: snap.x,
              y: snap.y,
              rot: snapRot,
              scale: scaleOf(movingEarly),
            };
            const anchor = tables.find(
              (o) =>
                o.table_id !== d.id &&
                chainableShapes(shapeHintFor(o.table_type), movingShape) &&
                isLegalJoint(
                  {
                    shape: shapeHintFor(o.table_type),
                    capacity: o.capacity,
                    x: pxOf(o).x,
                    y: pxOf(o).y,
                    rot: rotationOf(o),
                    scale: scaleOf(o),
                  },
                  snappedJoinPose,
                  ppm,
                ),
            );
            const ghostPose: WorldPose = {
              tableId: d.id,
              shape: movingShape,
              capacity: movingEarly.capacity,
              x: snap.x,
              y: snap.y,
              rot: snapRot,
              scale: scaleOf(movingEarly),
              linkGroupId: movingEarly.link_group_id ?? null,
            };
            const posFor = (o: EventTableRow, i: number) =>
              positions[o.table_id] ?? defaultGrid(i, tables.length, !venueScaled);
            const thirdParties = othersFor(movingEarly, rect, posFor).filter(
              (p) => p.tableId !== anchor?.table_id,
            );
            const ghostOk =
              !!anchor &&
              checkPlacement(ghostPose, { others: thirdParties, zones: zonesFor(rect) }, { gapPx: gapPxNow() }).valid;
            if (ghostOk) {
              guidesRef.current = { x: null, y: null };
              if (snap.rot !== undefined) {
                serpSnapRotRef.current = { id: d.id, rot: snap.rot, cx: snap.x, cy: snap.y, r: catchR };
                if (rotationOf(movingEarly) !== snap.rot) {
                  setRotById((m) => ({ ...m, [d.id]: snap.rot! }));
                }
              }
              weldRef.current = { moverId: d.id, anchorId: anchor.table_id };
              setPositions((p) => ({ ...p, [d.id]: { x: nx, y: ny } }));
              return;
            }
            // No room at the weld → drop weld intent, hysteresis-clear a stale
            // chain angle, and fall through to the alignment-snap + slide path.
            weldRef.current = null;
          }
          // Hysteresis: once the drag leaves 1.4× the catch radius of the last
          // snap centre, release the phantom chain angle (revert to the table's
          // stored rotation) so a free-position drop never persists a stale angle.
          const held = serpSnapRotRef.current;
          if (held && held.id === d.id) {
            const dist = Math.hypot(dragPx.x - held.cx, dragPx.y - held.cy);
            if (dist > held.r * 1.4) {
              serpSnapRotRef.current = null;
              weldRef.current = null;
              setRotById((m) => {
                if (!(d.id in m)) return m;
                const n = { ...m };
                delete n[d.id];
                return n;
              });
            }
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
        // FREE FOLLOW + per-frame warning (owner 2026-07-17 · snap-back drop
        // rule, supersedes the monotone-escape slide/§4). The table follows the
        // pointer 1:1 — no escape constraint holds it out of an overlap mid-drag.
        // In a sized room we run the shared oracle purely for FEEDBACK: the drag
        // ring/tint goes warm-red the moment the current pose fails, so refusal is
        // legible BEFORE release. Enforcement moved to onCanvasPointerUp — an
        // invalid release is NO drop and snaps back to the drag-start pose. The
        // free board is place-anywhere (a metric walkway is meaningless without a
        // metre scale), so it never flags.
        const posFor = (o: EventTableRow, i: number) =>
          positions[o.table_id] ?? defaultGrid(i, tables.length, !venueScaled);
        setPositions((p) => ({ ...p, [d.id]: { x: ax, y: ay } }));
        if (venueScaled && movingEarly) {
          const world = { others: othersFor(movingEarly, rect, posFor), zones: zonesFor(rect) };
          const valid = checkPlacement(poseAt(movingEarly, ax, ay, rect), world, { gapPx: gapPxNow() }).valid;
          setDragInvalid((cur) => (cur === !valid ? cur : !valid));
        } else if (dragInvalid) {
          setDragInvalid(false);
        }
      } else if (d.kind === 'stage') {
        // Wall-snap only in a sized (walled) room; a free board has no walls.
        const p = venueScaled ? snapRectToWalls(x, y, stage.w, stage.h) : { x, y };
        setStage((s) => ({ ...s, x: p.x, y: p.y }));
      } else if (d.kind === 'dance') {
        const p = venueScaled ? snapRectToWalls(x, y, dance.w, dance.h) : { x, y };
        setDance((dz) => ({ ...dz, x: p.x, y: p.y }));
      } else if (d.kind === 'cocktail') {
        // Dragging the room is the natural "separate" gesture — auto-unlink so
        // the couple can place it freely (re-link via the room's link toggle).
        setCocktail((c) => (c.linked ? { ...c, x, y, linked: false } : { ...c, x, y }));
      } else if (d.kind === 'service') {
        setServiceDoor((sd) => ({ ...sd, x, y }));
      } else if (d.kind === 'booth') {
        // In a SIZED room the perimeter rules run live: snap to the nearest
        // legal wall position, clear of the stage wall, door corridors and
        // other booths. In a FREE venue (garden / open field) there are no
        // walls to hug — the booth drops wherever it's dragged (board-clamped,
        // like a table). Owner-directed 2026-06-13.
        // Inside the cocktail room a booth places FREELY (it's a no-wall second
        // room); elsewhere in a sized venue it snaps to the reception perimeter.
        const p =
          venueScaled && !inCocktail(x, y)
            ? clampBoothToPerimeter(
                x,
                y,
                boothFp(),
                booths.filter((b) => b.booth_id !== d.id).map((b) => ({ x: b.x_pos, y: b.y_pos })),
              )
            : { x, y };
        setBooths((bs) => bs.map((b) => (b.booth_id === d.id ? { ...b, x_pos: p.x, y_pos: p.y } : b)));
      } else if (d.kind === 'sign') {
        const sx = Math.max(0, Math.min(100, x));
        const sy = Math.max(0, Math.min(100, y));
        setSigns((ss) => ss.map((s) => (s.sign_id === d.id ? { ...s, x_pos: sx, y_pos: sy } : s)));
        setSignsDirty(true);
      } else {
        setEntrance((en) => ({ ...en, x, y }));
        // Keep a linked cocktail room docked to the moving entrance.
        setCocktail((c) =>
          c.linked && c.enabled ? { ...c, ...dockCocktail(c, { x, y }) } : c,
        );
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

  // ── Confirm-on-drop helpers (owner 2026-07-17) — one shared bubble, both
  // projections. The bubble anchors at the drop point in canvas-relative coords,
  // flipping toward the interior near the right / top edges so it never occludes.
  const bubbleAnchor = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const { cx, cy } = lastPointerRef.current;
    if (!rect) return { x: cx, y: cy, flipX: false, flipY: false };
    const x = cx - rect.left;
    const y = cy - rect.top;
    return { x, y, flipX: x > rect.width - 260, flipY: y < 150 };
  };
  const askConfirmDrop = (commit: () => void, revert: () => void) => {
    pendingDropRef.current = { commit, revert };
    setDropConfirm({ kind: 'confirm', ...bubbleAnchor() });
  };
  const showRejectDrop = (hit: DropHit) => {
    pendingDropRef.current = null;
    const name = hit.otherId
      ? tables.find((t) => t.table_id === hit.otherId)?.table_label ?? 'another table'
      : hit.zoneId
        ? zoneDisplayName(hit.zoneId)
        : 'another element';
    const message =
      hit.kind === 'tight'
        ? `Too close to ${name} — needs ${aisleM.toFixed(1)} m clear.`
        : `This area intersects with ${name} — please choose a different area.`;
    setDropConfirm({ kind: 'reject', message, ...bubbleAnchor() });
  };
  const onDropConfirm = () => {
    const p = pendingDropRef.current;
    pendingDropRef.current = null;
    setDropConfirm(null);
    p?.commit();
  };
  const onDropCancel = () => {
    const p = pendingDropRef.current;
    pendingDropRef.current = null;
    setDropConfirm(null);
    p?.revert();
  };
  // The moved zone's oracle footprint at its released centre (for zoneDropViolation).
  const movedZoneFootprint = (
    kind: 'stage' | 'dance' | 'cocktail',
    pos: { x: number; y: number },
    rectWH: { width: number; height: number },
  ): OracleZone => {
    if (kind === 'stage')
      return stageZone({ stage_x: pos.x, stage_y: pos.y, stage_w: stage.w, stage_h: stage.h }, rectWH);
    const src = kind === 'dance' ? dance : cocktail;
    return {
      id: kind,
      x: (pos.x / 100) * rectWH.width,
      y: (pos.y / 100) * rectWH.height,
      w: (src.w / 100) * rectWH.width,
      h: (src.h / 100) * rectWH.height,
    };
  };

  const onCanvasPointerUp = (e?: React.PointerEvent) => {
    if (e) lastPointerRef.current = { cx: e.clientX, cy: e.clientY };
    // End of a two-finger rotate: persist the final angle once (only if it
    // actually latched past the dead-zone) when either finger lifts.
    const rg = rotateGestureRef.current;
    if (rg) {
      rotateGestureRef.current = null;
      if (rg.latched && rg.latest !== rg.startRot) {
        if (rg.snap) {
          // § 1 root cause 4: refuse a unit twist with no room — revert the
          // optimistic preview to its pre-gesture pose (delta 0).
          if (groupRotationBlocked(rg.snap, rg.latest - rg.startRot)) {
            applyGroupRotation(rg.snap, 0);
            setNotice('No room to rotate this linked group there — move it to more open space first.');
          } else {
            const { nextPos, nextRot } = applyGroupRotation(rg.snap, rg.latest - rg.startRot);
            persistGroupTransform(nextPos, nextRot);
          }
        } else {
          commitRotation(rg.tableId, rg.latest);
        }
      }
    }
    const d = dragRef.current;
    dragRef.current = null;
    setDragId(null);
    guidesRef.current = { x: null, y: null };
    const serpRot = serpSnapRotRef.current;
    serpSnapRotRef.current = null;
    const weld = weldRef.current;
    weldRef.current = null;
    if (d?.moved) {
      if (d.kind === 'table') {
        // A linked unit moved as one — every member's position changed.
        const moved = groupMemberIds(d.id);
        // SNAP-BACK DROP RULE (owner 2026-07-17 · "undroppable when overlap").
        // Validate the RELEASE through the shared `dropAccepted` oracle. A WELD
        // snap is a sanctioned join (valid by construction) → always drops. In a
        // sized room, otherwise, an invalid release is NO drop: return the moved
        // unit (single table or whole welded group) to its drag-START pose with a
        // kit-eased bounce, persist nothing, mark nothing dirty. Legacy healing is
        // preserved — the start pose is the table's own spot, so dragging OUT to a
        // valid pose sticks and any invalid release just returns it (never stucker).
        const rectSnap = canvasRef.current?.getBoundingClientRect();
        let dropHit: DropHit | null = null;
        if (!weld && venueScaled && rectSnap && rectSnap.width > 0) {
          const rectWH = { width: rectSnap.width, height: rectSnap.height };
          const memberSet = new Set(moved);
          const poseOfId = (id: string): WorldPose => {
            const idx = tables.findIndex((x) => x.table_id === id);
            const t = tables[idx]!;
            const p = positions[id] ?? defaultGrid(idx, tables.length, !venueScaled);
            return poseAt(t, p.x, p.y, rectWH);
          };
          const movedPoses = moved.map(poseOfId);
          const others = tables
            .filter((o) => !memberSet.has(o.table_id))
            .map((o) => poseOfId(o.table_id));
          dropHit = firstDropViolation(movedPoses, others, zonesFor(rectWH), { gapPx: gapPxNow() });
        }
        if (dropHit) {
          // Invalid release → snap back to the drag-START pose AND name what it hit
          // (owner 2026-07-17 · the silent snap-back is superseded by the named
          // refusal; the bounce animation remains).
          const start = dragStartRef.current;
          if (start) {
            setPositions((p) => {
              const n = { ...p };
              for (const id of moved) if (start[id]) n[id] = start[id]!;
              return n;
            });
          }
          setDragInvalid(false);
          setSnapBackIds(new Set(moved));
          showRejectDrop(dropHit);
          // Drop the kit-ease flag once the bounce-back has played (instant under
          // reduced motion, where the transition is suppressed anyway).
          const clearing = moved;
          window.setTimeout(() => {
            setSnapBackIds((s) => {
              if (!s.size) return s;
              const n = new Set(s);
              for (const id of clearing) n.delete(id);
              return n;
            });
          }, 340);
          if (e) pointersRef.current.delete(e.pointerId);
          if (pointersRef.current.size < 2) pinchRef.current = null;
          if (pointersRef.current.size === 0) panStartRef.current = null;
          bumpOverlay((v) => v + 1);
          return;
        }
        const moverPos = positions[d.id];
        const anchorTable = weld ? tables.find((x) => x.table_id === weld.anchorId) : undefined;
        const anchorPos = weld ? positions[weld.anchorId] : undefined;
        if (weld && weld.moverId === d.id && canEdit && moverPos && anchorPos && anchorTable) {
          // ATOMIC WELD (Sync verdict 2026-07-16 · § 5 · GUN C — positioning, NOT
          // linking). A connective snap changes the mover's position AND rotation;
          // persist BOTH the mover and the (now-connected) anchor in ONE round trip
          // and drop both from the dirty set, so abandoning the editor can never
          // leave a wedge "rotated-as-if-joined but standing at its pre-drag spot"
          // (the owner's screenshot). No link_group_id is written — they stay two
          // independent tables that simply sit connected.
          const moverTable = tables.find((x) => x.table_id === d.id);
          const moverRot =
            serpRot && serpRot.id === d.id
              ? serpRot.rot
              : rotById[d.id] ?? moverTable?.rotation_deg ?? 0;
          const batch = weldCommitBatch(
            { tableId: d.id, xPct: moverPos.x, yPct: moverPos.y, rotationDeg: moverRot },
            { tableId: weld.anchorId, xPct: anchorPos.x, yPct: anchorPos.y, rotationDeg: rotationOf(anchorTable) },
          );
          setRotById((m) => ({ ...m, [d.id]: moverRot }));
          setDirty((s) => {
            const n = new Set(s);
            n.delete(d.id);
            n.delete(weld.anchorId);
            return n;
          });
          const fd = new FormData();
          fd.set('event_id', eventId);
          fd.set('lock_id', lock.lockId ?? '');
          fd.set('poses', JSON.stringify(batch));
          startTransition(async () => {
            await runGated(() => commitWeld(fd));
          });
        } else {
          // Plain move (single table or a linked unit moved as one) → confirm-on-
          // drop (owner 2026-07-17). The table is already at the drop pose
          // (optimistic during drag); ✓ marks it dirty (Save persists each own
          // x/y — the join, if any, survives reload from each table's own
          // coordinates); ✗ / Esc returns it to the drag-START pose with the bounce.
          const startPositions = dragStartRef.current;
          askConfirmDrop(
            () => {
              setDirty((s) => {
                const n = new Set(s);
                moved.forEach((id) => n.add(id));
                return n;
              });
              if (serpRot && serpRot.id === d.id) {
                const t = tables.find((x) => x.table_id === d.id);
                if (t && (t.rotation_deg ?? 0) !== serpRot.rot) commitRotation(d.id, serpRot.rot);
              }
            },
            () => {
              if (startPositions) {
                setPositions((p) => {
                  const n = { ...p };
                  for (const id of moved) if (startPositions[id]) n[id] = startPositions[id]!;
                  return n;
                });
              }
              setSnapBackIds(new Set(moved));
              const clearing = moved;
              window.setTimeout(() => {
                setSnapBackIds((s) => {
                  if (!s.size) return s;
                  const n = new Set(s);
                  for (const id of clearing) n.delete(id);
                  return n;
                });
              }, 340);
            },
          );
        }
      } else {
        // A NON-table element moved (owner 2026-07-17 · universal draggability +
        // confirm-on-drop). The stage / dance floor / cocktail room carry a
        // footprint → route their release through the SHARED zone-drop rule (the
        // bypass this editor left open for markers); an invalid drop names what it
        // hit and returns to the drag-START centre. Entrances / service doors /
        // signs / booths carry no table-collision footprint (booths are perimeter-
        // clamped live) → place-anywhere, but every element still confirms-on-drop.
        const rectM = canvasRef.current?.getBoundingClientRect();
        const ms = markerStartRef.current;
        let zoneHit: DropHit | null = null;
        if (
          venueScaled &&
          rectM &&
          rectM.width > 0 &&
          (d.kind === 'stage' || d.kind === 'dance' || d.kind === 'cocktail')
        ) {
          const rectWH = { width: rectM.width, height: rectM.height };
          const cur =
            d.kind === 'stage' ? { x: stage.x, y: stage.y } : d.kind === 'dance' ? { x: dance.x, y: dance.y } : { x: cocktail.x, y: cocktail.y };
          const mz = movedZoneFootprint(d.kind, cur, rectWH);
          const tablePoses = tables.map((t) => {
            const idx = tables.findIndex((x) => x.table_id === t.table_id);
            const p = positions[t.table_id] ?? defaultGrid(idx, tables.length, !venueScaled);
            return poseAt(t, p.x, p.y, rectWH);
          });
          const otherZones = zonesFor(rectWH).filter((z) => z.id !== mz.id);
          zoneHit = zoneDropViolation(mz, tablePoses, otherZones, { gapPx: gapPxNow() });
        }
        if (zoneHit) {
          // Invalid → return the marker to its drag-START centre + named refusal.
          if (ms) {
            const p = ms.pos;
            if (d.kind === 'stage') setStage((s) => ({ ...s, x: p.x, y: p.y }));
            else if (d.kind === 'dance') setDance((dz) => ({ ...dz, x: p.x, y: p.y }));
            else if (d.kind === 'cocktail') setCocktail((c) => ({ ...c, x: p.x, y: p.y }));
          }
          showRejectDrop(zoneHit);
        } else {
          // Valid → confirm-on-drop. The marker is already at the drop spot
          // (optimistic during drag); ✓ marks the layer dirty, ✗ returns it.
          const kind = d.kind;
          const dropId = d.id;
          askConfirmDrop(
            () => {
              if (kind === 'booth') setBoothsDirty(true);
              else if (kind === 'sign') setSignsDirty(true);
              else setFloorDirty(true);
            },
            () => {
              if (!ms) return;
              const p = ms.pos;
              if (kind === 'stage') setStage((s) => ({ ...s, x: p.x, y: p.y }));
              else if (kind === 'dance') setDance((dz) => ({ ...dz, x: p.x, y: p.y }));
              else if (kind === 'cocktail') setCocktail((c) => ({ ...c, x: p.x, y: p.y }));
              else if (kind === 'service') setServiceDoor((sd) => ({ ...sd, x: p.x, y: p.y }));
              else if (kind === 'booth') setBooths((bs) => bs.map((b) => (b.booth_id === dropId ? { ...b, x_pos: p.x, y_pos: p.y } : b)));
              else if (kind === 'sign') setSigns((ss) => ss.map((s) => (s.sign_id === dropId ? { ...s, x_pos: p.x, y_pos: p.y } : s)));
              else setEntrance((en) => ({ ...en, x: p.x, y: p.y }));
            },
          );
        }
      }
    } else if (d && !d.moved && !pickedId && !pickedGroupId && canEdit) {
      // A tap (no drag) selects the object → its verbs render in the Context Dock
      // (§1.4). Tables + every marker/booth/sign now share the one selection model
      // (the ambient ×/toggle scatter is gone). Tap-to-link stays retired.
      if (d.kind === 'table') selectTable(d.id);
      else if (d.kind === 'booth') selectMarker('booth', d.id);
      else if (d.kind === 'sign') selectMarker('sign', d.id);
      else if (
        d.kind === 'stage' ||
        d.kind === 'entrance' ||
        d.kind === 'service' ||
        d.kind === 'dance' ||
        d.kind === 'cocktail'
      ) {
        selectMarker(d.kind, null);
      }
    }
    if (e) pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) panStartRef.current = null;
    // View settled after a pan/pinch — reposition the popup to its table.
    bumpOverlay((v) => v + 1);
  };

  const addEntrance = () => {
    setEntrance({ enabled: true, x: 50, y: 94, kind: 'door', depthM: 3 });
    // A linked cocktail room docks to the new entrance immediately.
    setCocktail((c) => (c.linked && c.enabled ? { ...c, ...dockCocktail(c, { x: 50, y: 94 }) } : c));
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
  const addCocktailArea = () => {
    // Enable + dock to the entrance door (when linked and an entrance exists).
    const docked =
      cocktail.linked && entrance.enabled
        ? dockCocktail({ x: cocktail.x, y: cocktail.y, w: cocktail.w, h: cocktail.h }, entrance)
        : { x: cocktail.x, y: cocktail.y };
    setCocktail((c) => ({ ...c, enabled: true, x: docked.x, y: docked.y }));

    // Seed a default "Front Desk" registration booth in the room (idempotent —
    // never double-seeds across local state + the last-fetched prop).
    if (![...booths, ...boothsProp].some((b) => b.booth_type === 'registration_desk')) {
      tmpBoothSeq.current += 1;
      const id = `tmp-${tmpBoothSeq.current}`;
      setBooths((bs) => [
        ...bs,
        {
          booth_id: id,
          event_id: eventId,
          booth_type: 'registration_desk' as BoothType,
          label: 'Front Desk',
          x_pos: docked.x,
          y_pos: docked.y,
          sort_order: bs.length,
          zone: 'cocktail',
          event_vendor_id: null,
          offerings: null,
        },
      ]);
      setBoothsDirty(true);
    }

    // Seed a default "Restrooms" wayfinding sign (idempotent) — placed near the
    // entrance, clamped on-canvas (signs are 0–100), pointing right by default.
    if (signs.length === 0 && signsProp.length === 0) {
      const cl = (n: number) => Math.max(4, Math.min(96, n));
      tmpSignSeq.current += 1;
      setSigns((ss) => [
        ...ss,
        {
          sign_id: `tmp-${tmpSignSeq.current}`,
          event_id: eventId,
          label: 'Restrooms',
          x_pos: cl(entrance.enabled ? entrance.x + 10 : 75),
          y_pos: cl(entrance.enabled ? Math.min(96, entrance.y) : 88),
          rotation_deg: 90,
          sort_order: ss.length,
        },
      ]);
      setSignsDirty(true);
    }

    setFloorDirty(true);
  };
  const removeCocktailArea = () => {
    setCocktail((c) => ({ ...c, enabled: false }));
    setFloorDirty(true);
  };
  // Toggle the cocktail room's dock mode. Linking re-docks to the entrance;
  // unlinking leaves the room where it is so the couple can free-place it.
  const toggleCocktailLink = () => {
    setCocktail((c) => {
      const linked = !c.linked;
      if (linked && entrance.enabled) return { ...c, linked, ...dockCocktail(c, entrance) };
      return { ...c, linked };
    });
    setFloorDirty(true);
  };
  // Add a vendor booth. Sized room → it spawns onto the nearest legal
  // perimeter spot (bottom-centre bias), never mid-room. Free venue → into the
  // tidy row behind the tables (no walls to hug); the couple drags from there.
  // Place-then-pick (owner-directed 2026-06-13): one click drops a BLANK pin;
  // the couple taps it to choose which booth it is. Placement is the same
  // wall/free logic — only the type starts 'unassigned'. The picker opens
  // immediately so the next step is obvious.
  const addBooth = () => {
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
    const id = `tmp-${tmpBoothSeq.current}`;
    setBooths((bs) => [
      ...bs,
      {
        booth_id: id,
        event_id: eventId,
        booth_type: 'unassigned',
        label: 'New booth',
        x_pos: p.x,
        y_pos: p.y,
        sort_order: bs.length,
        // Zone is re-derived from geometry on save; couple-placed booths carry
        // no vendor link.
        zone: inCocktail(p.x, p.y) ? 'cocktail' : 'reception',
        event_vendor_id: null,
        offerings: null,
      },
    ]);
    setBoothsDirty(true);
    // Select the new pin → its dock opens with the type-picker as the panel
    // (place-then-pick, now via the Context Dock · §1.4).
    selectMarker('booth', id);
  };
  // Assign / change a booth's type from the picker's "Stations" section (a
  // NON-vendor fixture like Front Desk / Custom). Picking a fixture UN-LINKS any
  // booked vendor the booth carried (event_vendor_id → null), so a station is
  // never mistaken for a vendor booth. The label follows the type unless the
  // couple has renamed it to something off-catalog.
  const setBoothType = (boothId: string, type: Exclude<BoothType, 'unassigned'>) => {
    const catalogLabels = new Set<string>([
      'New booth',
      ...BOOTH_CATALOG.map((b) => b.label),
    ]);
    const newLabel = BOOTH_CATALOG.find((b) => b.type === type)?.label ?? 'Booth';
    setBooths((bs) =>
      bs.map((b) =>
        b.booth_id === boothId
          ? {
              ...b,
              booth_type: type,
              label: catalogLabels.has(b.label) ? newLabel : b.label,
              // Fixture path un-links any previously-linked vendor.
              event_vendor_id: null,
            }
          : b,
      ),
    );
    setBoothsDirty(true);
    // Keep the popover open after picking a type so the couple can (optionally)
    // type the offerings copy in the same sheet — the field lives below the list.
  };
  // Link a booth to a BOOKED vendor from the picker's "Your booked vendors"
  // section: the booth type + label follow the vendor (category → 2D icon +
  // footprint via boothTypeForVendorCategory; name → label), and
  // event_vendor_id carries the link that fetchBooths joins for the 3D card.
  const setBoothVendor = (boothId: string, vendor: BoothVendorOption) => {
    const type = boothTypeForVendorCategory(vendor.category);
    setBooths((bs) =>
      bs.map((b) =>
        b.booth_id === boothId
          ? {
              ...b,
              booth_type: type,
              label: vendor.vendor_name,
              event_vendor_id: vendor.vendor_id,
            }
          : b,
      ),
    );
    setBoothsDirty(true);
  };
  // Edit a booth's guest-facing "offerings" copy (what it serves) — surfaced on
  // the 3D venue-walk booth card. Trimmed/capped on save (server + DB CHECK);
  // here we hard-cap the raw input at 280 so the counter can't run negative.
  const setBoothOfferings = (boothId: string, offerings: string) => {
    const next = offerings.slice(0, 280);
    setBooths((bs) =>
      bs.map((b) => (b.booth_id === boothId ? { ...b, offerings: next.length > 0 ? next : null } : b)),
    );
    setBoothsDirty(true);
  };
  const removeBooth = (boothId: string) => {
    setBooths((bs) => bs.filter((b) => b.booth_id !== boothId));
    setBoothsDirty(true);
    setSelMarker((cur) => (cur?.kind === 'booth' && cur.id === boothId ? null : cur));
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
        // Geometry decides the zone: a booth dropped inside the cocktail room
        // is a cocktail booth, otherwise reception.
        zone: inCocktail(b.x_pos, b.y_pos) ? 'cocktail' : 'reception',
        event_vendor_id: b.event_vendor_id ?? null,
        // Guest-facing "what this booth serves" copy for the 3D walk card.
        offerings: b.offerings ?? null,
      })),
    );

  // Wayfinding signs — serialize for the replace-all saveSigns (tmp ids → null).
  const signsPayload = (ss: FloorSignRow[]) =>
    JSON.stringify(
      ss.map((s, i) => ({
        sign_id: s.sign_id.startsWith('tmp-') ? null : s.sign_id,
        label: s.label,
        x_pos: s.x_pos,
        y_pos: s.y_pos,
        rotation_deg: s.rotation_deg,
        sort_order: i,
      })),
    );
  const addSign = () => {
    if (signs.length >= 24) return;
    tmpSignSeq.current += 1;
    setSigns((ss) => [
      ...ss,
      {
        sign_id: `tmp-${tmpSignSeq.current}`,
        event_id: eventId,
        label: 'Restrooms',
        x_pos: 50,
        y_pos: 50,
        rotation_deg: 90,
        sort_order: ss.length,
      },
    ]);
    setSignsDirty(true);
  };
  // Sign rotation — 45° coarse steps (verdict §2, signage tier), now via the
  // dock cluster (⟲/⟳). `rotateSign` keeps the +45° default; `rotateSignBy`
  // takes a signed delta for the ⟲ button.
  const rotateSignBy = (signId: string, delta: number) => {
    setSigns((ss) =>
      ss.map((s) =>
        s.sign_id === signId ? { ...s, rotation_deg: (((s.rotation_deg + delta) % 360) + 360) % 360 } : s,
      ),
    );
    setSignsDirty(true);
  };
  const relabelSign = (signId: string, label: string) => {
    const v = label.trim().slice(0, 40);
    if (!v) return;
    setSigns((ss) => ss.map((s) => (s.sign_id === signId ? { ...s, label: v } : s)));
    setSignsDirty(true);
  };
  const removeSign = (signId: string) => {
    setSigns((ss) => ss.filter((s) => s.sign_id !== signId));
    setSignsDirty(true);
    setSelMarker((cur) => (cur?.kind === 'sign' && cur.id === signId ? null : cur));
  };

  // ── Context Dock selection (verdict §1.4) — table ⇄ marker are mutually
  //    exclusive; tap toggles selection. Selecting one clears the other. ────────
  const selectTable = (id: string) => {
    setSelMarker(null);
    setHighlightId((cur) => (cur === id ? null : id));
  };
  const selectMarker = (kind: MarkerKind, id: string | null = null) => {
    setHighlightId(null);
    setSelMarker((cur) => (cur && cur.kind === kind && cur.id === id ? null : { kind, id }));
  };
  const clearSelection = () => {
    setHighlightId(null);
    setSelMarker(null);
  };
  // Remove the selected marker/booth/sign from the dock (§1.4). Stage has no
  // remove (honest permanence).
  const removeSelectedMarker = () => {
    const m = selMarker;
    if (!m) return;
    if (m.kind === 'dance') removeDanceFloor();
    else if (m.kind === 'cocktail') removeCocktailArea();
    else if (m.kind === 'entrance') removeEntrance();
    else if (m.kind === 'service') removeServiceDoor();
    else if (m.kind === 'booth' && m.id) removeBooth(m.id);
    else if (m.kind === 'sign' && m.id) removeSign(m.id);
    setSelMarker(null);
  };

  // Canvas keyboard parity (verdict §1.2): Delete/Backspace deletes the selected
  // object (same confirms); Esc exits edit-chairs, else deselects. Ignored while
  // typing in a field so the name / degree inputs keep their own key handling.
  useEffect(() => {
    if (view !== 'plan') return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable);
      if (typing) return;
      if (e.key === 'Escape') {
        if (editChairs) {
          setEditChairs(false);
          e.preventDefault();
          return;
        }
        if (highlightId || selMarker) {
          clearSelection();
          e.preventDefault();
        }
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && canEdit) {
        if (highlightId) {
          const t = tables.find((x) => x.table_id === highlightId);
          if (t) {
            requestRemoveTable(t);
            e.preventDefault();
          }
        } else if (selMarker && selMarker.kind !== 'stage') {
          removeSelectedMarker();
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, editChairs, highlightId, selMarker, canEdit, tables]);

  // SE resize grip for the stage / dance-floor rects. NW-corner anchored: the
  // grip drags the bottom-right corner; the centre shifts by half the delta so
  // the top-left edge stays put. Self-contained pointer capture on the grip.
  const onRectGripDown = (kind: 'stage' | 'dance' | 'cocktail') => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const cur = kind === 'stage' ? stage : kind === 'cocktail' ? cocktail : dance;
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
    else if (r.kind === 'cocktail')
      setCocktail((c) => {
        const next = { ...c, x, y, w, h };
        // While linked, keep the resized room's near edge GAP off the door.
        return c.linked && entrance.enabled ? { ...next, ...dockCocktail(next, entrance) } : next;
      });
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
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    tables.forEach((t, i) => {
      const pos = positions[t.table_id] ?? defaultGrid(i, tables.length, !venueScaled);
      const geo = tableGeometry(shapeHintFor(t.table_type), t.capacity);
      // Use the ON-SCREEN size (to-scale shrinks tables to the room box on BOTH
      // boards now — GUN B), so the bounding box is tight and Fit zooms in enough
      // to make tables readable.
      const s = metricPpm ? (TABLE_FOOTPRINT_M[t.table_type] * metricPpm) / geo.box.w : 1;
      const cx = (pos.x / 100) * rect.width;
      const cy = (pos.y / 100) * rect.height;
      minX = Math.min(minX, cx - (geo.box.w * s) / 2);
      maxX = Math.max(maxX, cx + (geo.box.w * s) / 2);
      minY = Math.min(minY, cy - (geo.box.h * s) / 2);
      maxY = Math.max(maxY, cy + (geo.box.h * s) / 2);
    });
    // Frame the cocktail room too — it can dock OUTSIDE the reception walls
    // (off the 0–100 canvas), so Fit must include it or it'd be out of view.
    if (cocktail.enabled) {
      minX = Math.min(minX, ((cocktail.x - cocktail.w / 2) / 100) * rect.width);
      maxX = Math.max(maxX, ((cocktail.x + cocktail.w / 2) / 100) * rect.width);
      minY = Math.min(minY, ((cocktail.y - cocktail.h / 2) / 100) * rect.height);
      maxY = Math.max(maxY, ((cocktail.y + cocktail.h / 2) / 100) * rect.height);
      if (entrance.enabled) {
        minX = Math.min(minX, (entrance.x / 100) * rect.width);
        maxX = Math.max(maxX, (entrance.x / 100) * rect.width);
        minY = Math.min(minY, (entrance.y / 100) * rect.height);
        maxY = Math.max(maxY, (entrance.y / 100) * rect.height);
      }
    }
    if (!Number.isFinite(minX)) {
      applyView(1, { x: 0, y: 0 });
      return;
    }
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

  // When the cocktail room is first enabled it docks OUTSIDE the reception walls
  // (off the 0–100 canvas), so frame it or it'd open out of view.
  const prevCocktailEnabledRef = useRef(cocktail.enabled);
  useEffect(() => {
    if (cocktail.enabled && !prevCocktailEnabledRef.current) fitView();
    prevCocktailEnabledRef.current = cocktail.enabled;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cocktail.enabled]);

  const layoutDirty = dirty.size > 0 || floorDirty || boothsDirty || signsDirty;
  const saveLayout = () => {
    if (!canEdit) return;
    const ids = Array.from(dirty);
    const fdDirty = floorDirty;
    const bDirty = boothsDirty;
    const sDirty = signsDirty;
    const lockId = lock.lockId ?? '';
    startTransition(async () => {
      // Multi-step save — if any step reports the lock was lost (a peer took
      // over mid-save), drop to view-only and stop instead of erroring out the
      // remaining writes. Other errors propagate as before.
      try {
        if (bDirty) {
          const fd = new FormData();
          fd.set('event_id', eventId);
          fd.set('lock_id', lockId);
          fd.set('booths', boothsPayload(booths));
          await saveBooths(fd);
          setBoothsDirty(false);
        }
        if (sDirty) {
          const fd = new FormData();
          fd.set('event_id', eventId);
          fd.set('lock_id', lockId);
          fd.set('signs', signsPayload(signs));
          await saveSigns(fd);
          setSignsDirty(false);
        }
        for (const id of ids) {
          const pos = positions[id];
          if (!pos) continue;
          const fd = new FormData();
          fd.set('event_id', eventId);
          fd.set('lock_id', lockId);
          fd.set('table_id', id);
          fd.set('x_pos', String(pos.x));
          fd.set('y_pos', String(pos.y));
          await updateTablePosition(fd);
        }
        if (fdDirty) {
          const fd = new FormData();
          fd.set('event_id', eventId);
          fd.set('lock_id', lockId);
          fd.set('stage_x', String(stage.x));
          fd.set('stage_y', String(stage.y));
          fd.set('stage_w', String(stage.w));
          fd.set('stage_h', String(stage.h));
          fd.set('entrance_enabled', entrance.enabled ? 'true' : 'false');
          fd.set('entrance_x', String(entrance.x));
          fd.set('entrance_y', String(entrance.y));
          fd.set('entrance_kind', entrance.kind);
          fd.set('entrance_depth_m', String(entrance.depthM));
          fd.set('dance_enabled', dance.enabled ? 'true' : 'false');
          fd.set('dance_x', String(dance.x));
          fd.set('dance_y', String(dance.y));
          fd.set('dance_w', String(dance.w));
          fd.set('dance_h', String(dance.h));
          fd.set('service_entrance_enabled', serviceDoor.enabled ? 'true' : 'false');
          fd.set('service_entrance_x', String(serviceDoor.x));
          fd.set('service_entrance_y', String(serviceDoor.y));
          fd.set('cocktail_enabled', cocktail.enabled ? 'true' : 'false');
          fd.set('cocktail_x', String(cocktail.x));
          fd.set('cocktail_y', String(cocktail.y));
          fd.set('cocktail_w', String(cocktail.w));
          fd.set('cocktail_h', String(cocktail.h));
          fd.set('cocktail_label', cocktail.label);
          fd.set('cocktail_vendor_edit', cocktail.vendorEdit ? 'true' : 'false');
          fd.set('cocktail_linked', cocktail.linked ? 'true' : 'false');
          if (venue.enabled && venue.width > 0 && venue.length > 0) {
            fd.set('venue_width_m', String(venue.width));
            fd.set('venue_length_m', String(venue.length));
          }
          await saveFloorPlan(fd);
        }
        setDirty(new Set());
        setFloorDirty(false);
        setSavedAt(
          new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        );
      } catch (err) {
        if (handleLockLost(err)) {
          setNotice('Editing was taken over by another co-host — you’re viewing only now. Your unsaved layout changes weren’t saved.');
          return;
        }
        throw err;
      }
    });
  };

  // ── Scroll-less frame plumbing (council verdict 2026-07-15) ───────────────
  const router = useRouter();
  const labUrl = `/dashboard/${eventId}/seating/lab`;

  // The canvas cell now absorbs all remaining height (verdict §1). Measure it so
  // to-scale mode can letterbox the room ratio INSIDE the fill (not a vh guess),
  // and re-frame on mount + resize.
  const regionRef = useRef<HTMLDivElement>(null);
  const [region, setRegion] = useState({ w: 0, h: 0 });
  useIsoLayoutEffect(() => {
    const el = regionRef.current;
    if (!el || view !== 'plan') return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setRegion({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);
  // Re-fit whenever the region size changes (mount + every resize).
  const fitViewRef = useRef<() => void>(() => {});
  fitViewRef.current = fitView;
  useEffect(() => {
    if (view !== 'plan' || region.w === 0) return;
    fitViewRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region.w, region.h, view]);
  // To-scale letterbox box: the largest room-aspect rectangle that fits the
  // measured cell. GUN B (Sync verdict 2026-07-16 · § 2): the FREE board now
  // letterboxes to the DEFAULT 20×30 aspect exactly like a sized room — so the
  // canvas carries the room aspect and `(x/100)·rect.width` / `(y/100)·rect.height`
  // become ISOTROPIC and canvas-INDEPENDENT (the anisotropic fill-the-cell shear
  // that made a free-board percent mean different things on each axis is gone).
  const scaledBox =
    region.w > 0 && region.h > 0
      ? (() => {
          const ratio = roomM.w / roomM.d;
          let w = region.w;
          let h = w / ratio;
          if (h > region.h) {
            h = region.h;
            w = h * ratio;
          }
          return { w: Math.floor(w), h: Math.floor(h) };
        })()
      : null;

  // Permanent save-status chip state (no autosave in v1 — sign-off S2).
  const saveState: SaveState = isPending ? 'saving' : layoutDirty ? 'dirty' : 'saved';
  const unsavedCount =
    dirty.size + (floorDirty ? 1 : 0) + (boothsDirty ? 1 : 0) + (signsDirty ? 1 : 0);
  // Either seating policy Off → the closed Arrange menu shows a state badge.
  const arrangePolicyOff = !autoplaceEnabled || !adjacencyEnabled;

  // Day-of live? Drives banner priority (DayOf > capacity shortfall > walima).
  const [dayOfLive, setDayOfLive] = useState(false);
  useEffect(() => {
    if (!eventDate) {
      setDayOfLive(false);
      return;
    }
    const tick = () => setDayOfLive(isEventDayActive(eventDate));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [eventDate]);

  // ⌘S / Ctrl+S saves the layout (menu-row shortcut suffices for v1 — no ⌘K).
  const cmdSaveRef = useRef<() => void>(() => {});
  cmdSaveRef.current = () => {
    if (layoutDirty && canEdit) saveLayout();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        cmdSaveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // beforeunload guard on unsaved layout — the manual-save safety net. Plus the
  // DIRTY MARKER (Sync verdict 2026-07-16 · § 5 · GUN C · auto-save-on-exit door
  // audit): the SPA-nav door out of a dirty editor can't be intercepted (App
  // Router has no route events — verdict § 8.4), so instead of silent staleness
  // we make it VISIBLE. While the layout is dirty we stamp a localStorage marker
  // `seating-dirty:{eventId}`; the 3D lab (any tab) reads it and shows a
  // non-blocking "return to the editor to save" banner. Cleared the instant the
  // layout goes clean. `beforeunload` still covers hard unloads; `pagehide`
  // re-stamps so a tab-close leaves the marker for the next surface to surface.
  const dirtyMarkerKey = `seating-dirty:${eventId}`;
  useEffect(() => {
    const stamp = () => {
      try {
        localStorage.setItem(
          dirtyMarkerKey,
          JSON.stringify({ dirtyIds: Array.from(dirty), ts: Date.now() }),
        );
      } catch {
        /* private mode — best-effort only */
      }
    };
    const clear = () => {
      try {
        localStorage.removeItem(dirtyMarkerKey);
      } catch {
        /* ignore */
      }
    };
    if (layoutDirty) stamp();
    else clear();
    if (!layoutDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onPageHide = () => stamp();
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onPageHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutDirty, dirty, dirtyMarkerKey]);

  // 2D/3D segment: 2D↔List swap in-page; 3D is an honest route swap to the lab
  // (same doc, same actions, same lock). Cross-projection editing rule
  // (2026-07-16): the switch is one-tap "Save & view" — auto-save-on-switch
  // replaces the blocking dirty guard. A clean switch goes straight through; a
  // dirty one saves first and hops when the save lands. On a save FAILURE the
  // layout stays dirty, so the effect never fires — we stay put and the error is
  // surfaced (saveLayout's own notice). A switch never loses work, never blocks.
  const switchAfterSaveRef = useRef(false);
  useEffect(() => {
    if (switchAfterSaveRef.current && !isPending && !layoutDirty) {
      switchAfterSaveRef.current = false;
      router.push(labUrl);
    }
  }, [isPending, layoutDirty, router, labUrl]);
  const onSelectView = (target: '2d' | '3d' | 'list') => {
    if (target === '3d') {
      if (layoutDirty && canEdit) {
        // Save & view: persist the pending layout, then the effect above hops to
        // the lab once the save settles clean (the 3D plan reads saved truth).
        switchAfterSaveRef.current = true;
        saveLayout();
        return;
      }
      router.push(labUrl);
      return;
    }
    setView(target === 'list' ? 'list' : 'plan');
  };

  // Banner slot (verdict §1, row 2): ONE single-line strip max. Priority
  // DayOf > capacity shortfall > walima; the losers collapse into a "N notices"
  // badge on the command bar that expands on tap. Never two stacked banners.
  const bannerItems: { key: string; node: React.ReactNode }[] = [];
  if (dayOfLive) {
    bannerItems.push({ key: 'dayof', node: <DayOfEditingBanner eventDate={eventDate} /> });
  }
  if (seatShortfall > 0) {
    bannerItems.push({
      key: 'capacity',
      node: (
        <div className="flex items-center gap-2 border-b border-warn-200/70 bg-warn-50/60 px-4 py-1.5 text-xs text-ink/80">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warn-700" />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium text-warn-800">Not enough seats:</span>{' '}
            <span className="font-mono">{nonDeclinedCount}</span> guests but only{' '}
            <span className="font-mono">{totalSeats}</span> {totalSeats === 1 ? 'seat' : 'seats'} — add
            more tables{autoplaceEnabled ? ' (auto-seating fills them as you add)' : ''}.
          </span>
        </div>
      ),
    });
  }
  if (genderSeparationNote) {
    bannerItems.push({
      key: 'walima',
      node: (
        <div className="flex items-center gap-2 border-b border-success-200/70 bg-success-50/50 px-4 py-1.5 text-xs text-ink/80">
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium text-success-800">Walima seating:</span> {genderSeparationNote}
          </span>
        </div>
      ),
    });
  }
  const bannerWinner = bannerItems[0] ?? null;
  const collapsedNotices = bannerItems.slice(1);

  // --- sidebar member filtering --------------------------------------------
  const q = search.trim().toLowerCase();
  const memberVisible = (g: SeatingGuest) =>
    (!q || g.name.toLowerCase().includes(q)) && (!onlyUnseated || !g.seated_table_id);

  const individuals = guests.filter((g) => !g.group_id && memberVisible(g));
  const tableLabelById = useMemo(
    () => new Map(tables.map((t) => [t.table_id, t.table_label])),
    [tables],
  );

  // The link_group_id of the table currently being dragged (null when none /
  // ungrouped). Drives the rigid-move render: every member of the dragged unit
  // gets the no-transition + raised-z treatment, so the linked table moves in
  // lockstep instead of easing 140ms behind (the "tailing" bug).
  const dragGroupId = useMemo(
    () => (dragId ? tables.find((t) => t.table_id === dragId)?.link_group_id ?? null : null),
    [dragId, tables],
  );

  // ── Mobile drawer drag handlers (verdict §7) ──────────────────────────────
  // Force the drawer to its handle when the <768px per-table sheet is up, so the
  // two never stack (verdict §7 exclusion rule).
  // Force the mobile drawer to its handle whenever the phone Context Dock sheet
  // is up (a selected table OR marker), so the two never stack (§1.3 / §7).
  const drawerForcedPeek = isPhone && (highlightId !== null || selMarker !== null);
  const effectiveSnap: DrawerSnap = drawerForcedPeek ? 'peek' : drawerSnap;
  const DRAWER_PEEK_PX = 52;
  const drawerHeight =
    drawerDragPx !== null
      ? `${drawerDragPx}px`
      : effectiveSnap === 'full'
        ? '88dvh'
        : effectiveSnap === 'half'
          ? '50dvh'
          : `${DRAWER_PEEK_PX}px`;
  const onDrawerHandleDown = (e: React.PointerEvent) => {
    if (drawerForcedPeek) return;
    const h = drawerRef.current?.getBoundingClientRect().height ?? DRAWER_PEEK_PX;
    drawerDrag.current = { startY: e.clientY, startH: h, moved: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onDrawerHandleMove = (e: React.PointerEvent) => {
    const d = drawerDrag.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > 4) d.moved = true;
    const vh = window.innerHeight;
    setDrawerDragPx(Math.min(vh * 0.9, Math.max(DRAWER_PEEK_PX, d.startH - dy)));
  };
  const onDrawerHandleUp = () => {
    const d = drawerDrag.current;
    if (!d) return;
    if (d.moved) {
      const vh = window.innerHeight;
      const cur = drawerDragPx ?? d.startH;
      const snaps: [DrawerSnap, number][] = [
        ['peek', DRAWER_PEEK_PX],
        ['half', vh * 0.5],
        ['full', vh * 0.88],
      ];
      let best: DrawerSnap = 'peek';
      let bestD = Infinity;
      for (const [snap, px] of snaps) {
        const dist = Math.abs(cur - px);
        if (dist < bestD) {
          bestD = dist;
          best = snap;
        }
      }
      setDrawerSnap(best);
    } else {
      // A tap (no drag) cycles peek → half → full → peek.
      setDrawerSnap((s) => (s === 'peek' ? 'half' : s === 'half' ? 'full' : 'peek'));
    }
    setDrawerDragPx(null);
    drawerDrag.current = null;
  };

  // ── Left-panel content, shared by the desktop aside + the mobile drawer ────
  const searchRow = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search people…"
        className="w-full rounded-lg border border-ink/15 bg-cream py-1.5 pl-8 pr-2 text-sm outline-none focus:border-terracotta"
      />
    </div>
  );

  const peoplePane = (
    <div className="flex flex-col gap-3">
      {/* "Only show unseated" filter — pinned at the top of the People pane. */}
      <label className="sticky top-0 z-10 -mx-3 -mt-3 flex items-center gap-2 border-b border-ink/10 bg-cream px-3 py-2 text-xs text-ink/65">
        <input
          type="checkbox"
          checked={onlyUnseated}
          onChange={(e) => setOnlyUnseated(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-ink/30 text-terracotta focus:ring-terracotta"
        />
        Only show unseated
      </label>

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
                roleSet={roleSet}
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
                            roleSet={roleSet}
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
    </div>
  );

  const tablesPane = (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setShowAddTable((v) => !v)}
        disabled={!canEdit}
        title={!canEdit ? 'View only — someone else is editing this seat plan' : undefined}
        className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-terracotta px-2.5 py-2 text-xs font-medium text-cream hover:bg-terracotta-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Table
      </button>

      {showAddTable && canEdit ? (
        <AddTablePanel
          eventId={eventId}
          lockId={lock.lockId}
          chineseTradition={chineseTradition}
          defaultLabel={nextTableName(tables.map((t) => t.table_label))}
          computeSpawn={computeSpawnFor}
          onTableFourWarning={() => setNotice(TABLE_FOUR_ADVISORY)}
          onDone={() => setShowAddTable(false)}
          onLockLost={handleLockLost}
        />
      ) : null}

      <Section label={`Tables · ${displayUnits.length}`}>
        {displayUnits.length === 0 ? (
          <p className="px-1 py-2 text-xs text-ink/45">
            No tables yet — tap “Build my seating” on the floor, or add one above.
          </p>
        ) : (
          <ul className="space-y-1">
            {displayUnits.map((u) => {
              const occ = unitOcc(u);
              const filled = occ.filter(Boolean).length;
              const cap = u.capacity;
              const full = filled >= cap;
              return (
                <li
                  key={u.key}
                  className={`group flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                    pickedGroupId
                      ? 'cursor-pointer border-mulberry/30 ring-1 ring-mulberry/20 hover:bg-mulberry/5'
                      : highlightId === u.lead.table_id
                        ? 'border-terracotta bg-terracotta/5'
                        : 'border-transparent hover:bg-ink/[0.03]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      pickedGroupId
                        ? seatGroupAt(u.lead.table_id)
                        : setHighlightId((id) => (id === u.lead.table_id ? null : u.lead.table_id))
                    }
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: dominantColor(occ, colorFor) ?? NEUTRAL }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {u.isLinked ? (
                          <span title="Grouped (legacy)" className="mr-1 inline-flex">
                            <Link2 className="inline h-3 w-3 text-mulberry/70" aria-label="Grouped (legacy)" />
                          </span>
                        ) : null}
                        {u.label}
                      </span>
                      <span className="block font-mono text-[11px] text-ink/50">
                        {filled}/{cap} {cap === 1 ? 'seat' : 'seats'} ·{' '}
                        {u.members.length > 1
                          ? `${u.members.length} tables joined`
                          : TABLE_TYPE_LABEL[u.lead.table_type]}
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                        full ? 'bg-success-100 text-success-700' : 'bg-ink/5 text-ink/50'
                      }`}
                    >
                      {full ? 'Filled' : 'Open'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => requestRemoveUnit(u)}
                    aria-label={`Delete ${u.label}`}
                    className="rounded p-1 text-ink/30 opacity-0 transition hover:bg-danger-50 hover:text-danger-600 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );

  const rulesPane = (
    <div className="flex flex-col gap-3">
      {/* Seating Priority (smart seat-plan Phase 2). The order decides who Auto
          Arrange seats nearest the stage. Drag to reorder on desktop; the
          up/down arrows do the same on touch / keyboard. */}
      <Section label="Seating Priority">
        <p className="px-1 pb-1.5 text-[11px] text-ink/50">
          Who sits nearest the stage. Drag to reorder — Auto Arrange fills these tiers top to bottom.
        </p>
        <ul className="space-y-1">
          {priorityOrder.map((t, i) => (
            <li
              key={t.tier}
              draggable={canEdit}
              onDragStart={() => setDragTierIndex(i)}
              onDragOver={(e) => {
                if (dragTierIndex !== null) e.preventDefault();
              }}
              onDrop={() => {
                if (dragTierIndex !== null) reorderPriorityTo(dragTierIndex, i);
                setDragTierIndex(null);
              }}
              onDragEnd={() => setDragTierIndex(null)}
              className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                dragTierIndex === i ? 'border-mulberry/40 bg-mulberry/5' : 'border-ink/10'
              } ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`}
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-ink/30" aria-hidden />
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink/5 font-mono text-[10px] font-semibold text-ink/60">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{t.label}</span>
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => movePriorityTier(i, -1)}
                  disabled={i === 0 || !canEdit}
                  aria-label={`Move ${t.label} up`}
                  className="rounded p-1 text-ink/40 hover:bg-ink/5 disabled:opacity-30"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => movePriorityTier(i, 1)}
                  disabled={i === priorityOrder.length - 1 || !canEdit}
                  aria-label={`Move ${t.label} down`}
                  className="rounded p-1 text-ink/40 hover:bg-ink/5 disabled:opacity-30"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Seating Guide — keep-apart rules (smart seat-plan Phase 3). Couple-
          private: Auto Arrange seats these pairs (and their whole groups) at
          different tables. */}
      <Section label="Seating Guide">
        <p className="px-1 pb-1.5 text-[11px] text-ink/50">
          Keep guests apart — Auto Arrange seats them at different tables (their whole groups too). Only you see this.
        </p>
        {keepApart.length > 0 ? (
          <ul className="mb-2 space-y-1">
            {keepApart.map((r) => {
              const violated = isRuleViolated(r);
              return (
                <li
                  key={`${r.guest_a_id}|${r.guest_b_id}`}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                    violated ? 'border-danger-300 bg-danger-50' : 'border-ink/10'
                  }`}
                >
                  {/* §6.3 — text badge, not a chain glyph (Unlink retired). */}
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide ${
                      violated ? 'bg-danger-100 text-danger-700' : 'bg-mulberry/10 text-mulberry'
                    }`}
                    aria-hidden
                  >
                    Keep apart
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    <span className="font-medium">{guestsById.get(r.guest_a_id)?.name ?? 'Guest'}</span>
                    <span className="text-ink/45"> can&apos;t sit with </span>
                    <span className="font-medium">{guestsById.get(r.guest_b_id)?.name ?? 'Guest'}</span>
                    {violated ? (
                      <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-danger-600">
                        · seated together
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeKeepApart(r)}
                    disabled={!canEdit}
                    aria-label="Remove keep-apart rule"
                    className="rounded p-1 text-ink/30 hover:bg-danger-50 hover:text-danger-600 disabled:opacity-30"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-1 pb-1.5 text-[11px] text-ink/40">No keep-apart rules yet.</p>
        )}
        {violatedRules.length > 0 && canEdit ? (
          <button
            type="button"
            onClick={relaxLowest}
            className="mb-2 inline-flex items-center gap-1 rounded-lg border border-ink/15 bg-cream px-2.5 py-1.5 text-[11px] font-medium text-ink/80 hover:border-terracotta"
          >
            {/* §6.3 — worded "Relax", no chain glyph. */}
            Relax the lowest-priority rule
          </button>
        ) : null}
        {canEdit ? <KeepApartAdder guests={guests} onAdd={addKeepApart} /> : null}
      </Section>
    </div>
  );

  // The tab strip + active pane. `panelBody` is rendered by EITHER the desktop
  // aside OR the mobile drawer (never both — `isNarrow` gates which).
  const panelTabs = (
    <div role="tablist" aria-label="Seat-plan panel" className="flex shrink-0 gap-1 border-b border-ink/10 px-2">
      {([
        ['people', 'People', unseatedCount, false] as const,
        ['tables', 'Tables', 0, false] as const,
        ['rules', 'Rules', violatedRules.length, true] as const,
      ]).map(([key, label, count, warm]) => {
        const active = panelTab === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => selectPanelTab(key)}
            className={`relative flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition ${
              active ? 'border-terracotta text-ink' : 'border-transparent text-ink/50 hover:text-ink'
            }`}
          >
            {label}
            {count > 0 ? (
              <span
                className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] font-semibold tabular-nums ${
                  warm ? 'bg-danger-100 text-danger-700' : 'bg-ink/8 text-ink/55'
                }`}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );

  const panelBody = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 p-3 pb-2">{searchRow}</div>
      {panelTabs}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {panelTab === 'people' ? peoplePane : panelTab === 'tables' ? tablesPane : rulesPane}
      </div>
    </div>
  );

  // ── Command-bar menu bodies, shared by the desktop `+ Add / Arrange / Share`
  //    dropdowns and the mobile `⋯` overflow sheet (verdict §7). One source of
  //    truth for the rows so nothing drifts between the two surfaces. ──────────
  const addMenuBody = (
    <>
      <MenuCaption>Place on the floor</MenuCaption>
      <MenuRow icon={Plus} label="New table…" hint="Pick from the 13-type catalog" onClick={() => { selectPanelTab('tables'); setShowAddTable(true); }} disabled={!canEdit} />
      <MenuRow icon={DoorOpen} label="Entrance" onClick={addEntrance} disabled={!canEdit || view !== 'plan' || entrance.enabled} />
      <MenuRow icon={Truck} label="Service door" hint="Optional load-in / caterer door" onClick={addServiceDoor} disabled={!canEdit || view !== 'plan' || serviceDoor.enabled} />
      <MenuRow icon={Footprints} label="Dance floor" onClick={addDanceFloor} disabled={!canEdit || view !== 'plan' || dance.enabled} />
      <MenuRow icon={Martini} label="Cocktail area" hint="A second room — booths only, no tables" onClick={addCocktailArea} disabled={!canEdit || view !== 'plan' || cocktail.enabled} />
      <MenuRow icon={Signpost} label="Sign" badge={`${signs.length}/24`} onClick={addSign} disabled={!canEdit || view !== 'plan' || signs.length >= 24} />
      <MenuRow icon={Store} label="Vendor booth" onClick={addBooth} disabled={!canEdit || view !== 'plan'} />
      {/* §5.4 — "+ Add" is purely additive now; Room size & scale moved to
          Arrange (it's a policy, not a placeable). */}
    </>
  );
  const arrangeMenuBody = (
    <>
      <MenuCaption>Seating policies</MenuCaption>
      <form action={setSeatingAutoplace} className="px-1">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="enabled" value={autoplaceEnabled ? 'false' : 'true'} />
        <button
          type="submit"
          className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-ink/[0.04]"
        >
          <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-ink/55" strokeWidth={1.75} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              Auto-seating
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${autoplaceEnabled ? 'bg-success-100 text-success-700' : 'bg-ink/5 text-ink/50'}`}>
                {autoplaceEnabled ? 'On' : 'Off'}
              </span>
            </span>
            <span className="text-[11px] leading-snug text-ink/55">
              {autoplaceEnabled ? 'New guests get a provisional seat; role/group changes re-seat them.' : 'Seat guests manually with Auto Arrange or drag.'}
            </span>
          </span>
        </button>
      </form>
      <form action={setSeatingGroupAdjacency} className="px-1">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="enabled" value={adjacencyEnabled ? 'false' : 'true'} />
        <button
          type="submit"
          className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-ink/[0.04]"
        >
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-ink/55" strokeWidth={1.75} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              Keep groups together
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${adjacencyEnabled ? 'bg-success-100 text-success-700' : 'bg-ink/5 text-ink/50'}`}>
                {adjacencyEnabled ? 'On' : 'Off'}
              </span>
            </span>
            <span className="text-[11px] leading-snug text-ink/55">
              {adjacencyEnabled ? 'An overflowing group spills to the nearest table.' : 'Classic stage-order fill.'}
            </span>
          </span>
        </button>
      </form>
      <MenuDivider />
      {/* Council verdict § 3 — the one global Walkway width (metric). The clear
          space kept between any two table footprints (chair-back to chair-back).
          Drives live collision + Auto Arrange. Disabled on a free board. */}
      <MenuCaption>Walkway width</MenuCaption>
      <div className="px-3 pb-1.5">
        {venueScaled ? (
          <>
            <div className="flex gap-1">
              {([
                { m: 0.6, label: 'Tight' },
                { m: 0.9, label: 'Service' },
                { m: 1.5, label: 'Comfort' },
              ] as const).map((o) => (
                <button
                  key={o.m}
                  type="button"
                  onClick={() => setAisleM(o.m)}
                  disabled={!canEdit}
                  className={`flex-1 rounded-md border px-1.5 py-1 text-center text-[11px] font-medium transition-colors disabled:opacity-50 ${
                    Math.abs(aisleM - o.m) < 0.05
                      ? 'border-mulberry bg-mulberry/10 text-mulberry'
                      : 'border-ink/15 text-ink/60 hover:bg-ink/[0.04]'
                  }`}
                >
                  {o.label}
                  <span className="block text-[9px] opacity-70">{o.m.toFixed(1)} m</span>
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAisleM((v) => Math.max(0.6, Math.round((v - 0.1) * 10) / 10))}
                disabled={!canEdit || aisleM <= 0.6}
                className="h-6 w-6 rounded-md border border-ink/15 text-ink/60 hover:bg-ink/[0.04] disabled:opacity-40"
                aria-label="Narrower walkway"
              >
                −
              </button>
              <span className="min-w-[3.5rem] text-center text-xs font-semibold tabular-nums text-ink">
                {aisleM.toFixed(1)} m
              </span>
              <button
                type="button"
                onClick={() => setAisleM((v) => Math.min(2.0, Math.round((v + 0.1) * 10) / 10))}
                disabled={!canEdit || aisleM >= 2.0}
                className="h-6 w-6 rounded-md border border-ink/15 text-ink/60 hover:bg-ink/[0.04] disabled:opacity-40"
                aria-label="Wider walkway"
              >
                +
              </button>
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-ink/50">
              {aisleM <= 0.6
                ? 'Single-file — staff can’t pass with trays.'
                : aisleM < 0.95
                  ? 'Room for staff with trays (PH banquet minimum).'
                  : aisleM < 1.5
                    ? 'Comfortable service aisle.'
                    : 'Guest aisle — gowns and easy passing.'}
            </p>
            {mountAudit.size > 0 ? (
              <p className="mt-1 text-[10px] leading-snug text-terracotta">
                {mountAudit.size} table{mountAudit.size === 1 ? '' : 's'} too close at this walkway — drag them apart or narrow the walkway to heal.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-[11px] leading-snug text-ink/50">
            Set your room size to control walkway width.
          </p>
        )}
      </div>
      <MenuDivider />
      {/* §5.2 — Room size & scale lives here now (policy, not a placeable). The
          auto verbs (Build draft / Fill-around-locked) moved to the gold
          split-button caret (§5.3). */}
      <MenuRow
        icon={Ruler}
        label="Room size & scale…"
        hint={venueScaled ? `${venue.width}×${venue.length} m` : 'Set the reception footprint'}
        onClick={() => setShowRoomPanel((v) => !v)}
        disabled={!canEdit || view !== 'plan'}
      />
    </>
  );
  const shareMenuBody = (
    <>
      <MenuCaption>Export PDF</MenuCaption>
      <MenuRow icon={FileDown} label="Mood-board colours" hint="Floor & tables in your palette" href={`/dashboard/${eventId}/seating/export?mode=moodboard`} />
      <MenuRow icon={FileDown} label="Blueprint" hint="Clean technical line drawing" href={`/dashboard/${eventId}/seating/export?mode=blueprint`} />
      <MenuRow icon={FileDown} label="Caterer meal counts" hint="Meals per table + dietary · print or CSV" href={`/dashboard/${eventId}/seating/caterer`} target="_blank" />
      <MenuDivider />
      <MenuCaption>Guest photos in the 3D walk</MenuCaption>
      <MenuRow icon={Eye} label="Own table only" badge={photoVis === 'table' ? '✓' : undefined} onClick={() => setPhotoVisibility('table')} disabled={!canEdit} keepOpen />
      <MenuRow icon={Camera} label="All guests" badge={photoVis === 'all' ? '✓' : undefined} onClick={() => setPhotoVisibility('all')} disabled={!canEdit} keepOpen />
      <MenuRow icon={EyeOff} label="No photos" badge={photoVis === 'none' ? '✓' : undefined} onClick={() => setPhotoVisibility('none')} disabled={!canEdit} keepOpen />
      <MenuDivider />
      <MenuRow icon={Video} label="Walkthrough videos" href={`/dashboard/${eventId}/seating/walkthrough`} />
      <MenuRow icon={Printer} label="Publish & print" hint="Freeze a snapshot + printable signs / place cards" onClick={publishAndPrint} disabled={isPending || tables.length === 0} emphasized />
    </>
  );

  // ═══════════ The Context Dock (verdict §1) — one contextual surface ═══════════
  // Precedence: picked-guest > picked-group > selected-table (edit-chairs is a
  // variant) > selected-marker > notice. A notice displaced by a higher state
  // falls back to the command-bar "N notices" expander.
  const selTable = view === 'plan' && highlightId ? tables.find((t) => t.table_id === highlightId) ?? null : null;
  const selM = view === 'plan' ? selMarker : null;
  const dockPrimary: 'picked-guest' | 'picked-group' | 'table' | 'marker' | 'notice' | null =
    pickedGuest ? 'picked-guest'
    : pickedGroup ? 'picked-group'
    : selTable ? 'table'
    : selM ? 'marker'
    : notice ? 'notice'
    : null;
  const displacedNotice = notice && dockPrimary !== 'notice' && dockPrimary !== null ? notice : null;

  // §1.1 occlusion flip — deterministic bottom→top when the selection's screen
  // AABB (region-local) intersects the bottom dock rect. No measurement of the
  // object beyond its known footprint; two positions, zero auto-pan.
  const selectionAABB = (): { x0: number; y0: number; x1: number; y1: number } | null => {
    const regionRect = regionRef.current?.getBoundingClientRect();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!regionRect || !canvasRect) return null;
    const ox = canvasRect.left - regionRect.left;
    const oy = canvasRect.top - regionRect.top;
    const z = zoomRef.current;
    const toRegion = (xPct: number, yPct: number) => ({
      x: ox + (xPct / 100) * canvasRect.width * z + panRef.current.x,
      y: oy + (yPct / 100) * canvasRect.height * z + panRef.current.y,
    });
    if (selTable) {
      const pos = positions[selTable.table_id];
      if (!pos) return null;
      const geo = tableGeometry(shapeHintFor(selTable.table_type), selTable.capacity);
      const tScale = pxPerMeter ? (TABLE_FOOTPRINT_M[selTable.table_type] * pxPerMeter) / geo.box.w : 1;
      const hw = (geo.box.w / 2) * tScale * z;
      const hh = (geo.box.h / 2) * tScale * z;
      const c = toRegion(pos.x, pos.y);
      return { x0: c.x - hw, y0: c.y - hh - 28, x1: c.x + hw, y1: c.y + hh };
    }
    if (selM) {
      let xPct = 50;
      let yPct = 50;
      let hwPct = 6;
      let hhPct = 4;
      if (selM.kind === 'stage') { xPct = stage.x; yPct = stage.y; hwPct = stage.w / 2; hhPct = stage.h / 2; }
      else if (selM.kind === 'dance') { xPct = dance.x; yPct = dance.y; hwPct = dance.w / 2; hhPct = dance.h / 2; }
      else if (selM.kind === 'cocktail') { xPct = cocktail.x; yPct = cocktail.y; hwPct = cocktail.w / 2; hhPct = cocktail.h / 2; }
      else if (selM.kind === 'entrance') { xPct = entrance.x; yPct = entrance.y; }
      else if (selM.kind === 'service') { xPct = serviceDoor.x; yPct = serviceDoor.y; }
      else if (selM.kind === 'booth') { const b = booths.find((x) => x.booth_id === selM.id); if (b) { xPct = b.x_pos; yPct = b.y_pos; } }
      else if (selM.kind === 'sign') { const s = signs.find((x) => x.sign_id === selM.id); if (s) { xPct = s.x_pos; yPct = s.y_pos; } }
      const c = toRegion(xPct, yPct);
      const hw = (hwPct / 100) * canvasRect.width * z;
      const hh = (hhPct / 100) * canvasRect.height * z;
      return { x0: c.x - hw, y0: c.y - hh, x1: c.x + hw, y1: c.y + hh };
    }
    return null;
  };
  const computeDockEdge = (): DockEdge => {
    if (dockPrimary !== 'table' && dockPrimary !== 'marker') return 'bottom';
    const region = regionRef.current?.getBoundingClientRect();
    const aabb = selectionAABB();
    if (!region || !aabb) return 'bottom';
    const DOCK_H = 68;
    const halfW = Math.min(region.width - 32, 512) / 2;
    const cxDock = region.width / 2;
    const dock = {
      x0: cxDock - halfW,
      x1: cxDock + halfW,
      y0: region.height - 16 - DOCK_H,
      y1: region.height - 16,
    };
    const intersects =
      aabb.x0 < dock.x1 && aabb.x1 > dock.x0 && aabb.y0 < dock.y1 && aabb.y1 > dock.y0;
    return intersects ? 'top' : 'bottom';
  };

  // ── Verb-row pieces (desktop dock density) ──────────────────────────────────
  const dockSeatsStepper = (t: EventTableRow) => {
    const effCap = effectiveCapacity(t.capacity, t.removed_seats);
    const canDec = emptySeatIndices(t).length > 0;
    const canInc = removedSeatIndices(t).length > 0;
    return (
      <div className="flex items-center rounded-lg border border-ink/15">
        <button
          type="button"
          onClick={() => decSeat(t)}
          disabled={!canDec || !canEdit}
          aria-label="Remove a chair"
          className="flex h-8 w-8 items-center justify-center rounded-l-lg text-ink/60 hover:bg-ink/5 disabled:opacity-30"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="px-1 font-mono text-[11px] tabular-nums text-ink/70" aria-label={`${effCap} of ${t.capacity} seats`}>
          {effCap}/{t.capacity}
        </span>
        <button
          type="button"
          onClick={() => incSeat(t)}
          disabled={!canInc || !canEdit}
          aria-label="Restore a chair"
          className="flex h-8 w-8 items-center justify-center rounded-r-lg text-ink/60 hover:bg-ink/5 disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    );
  };
  const dockRotateCluster = (t: EventTableRow, step: number) => {
    const deg = rotationOf(t);
    return (
      <div className="flex items-center rounded-lg border border-ink/15">
        <HoldButton
          onFire={() => rotateTable(t, -step)}
          disabled={!canEdit}
          ariaLabel={`Rotate ${step}° left`}
          className="flex h-8 w-8 items-center justify-center rounded-l-lg text-ink/60 hover:bg-ink/5 disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" />
        </HoldButton>
        {degEdit !== null && highlightId === t.table_id ? (
          <input
            autoFocus
            aria-label="Rotation degrees"
            value={degEdit}
            onChange={(e) => setDegEdit(e.target.value.replace(/[^0-9-]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = Number(degEdit);
                if (Number.isFinite(v)) commitRotationExact(t, v);
                setDegEdit(null);
              }
              if (e.key === 'Escape') setDegEdit(null);
            }}
            onBlur={() => {
              const v = Number(degEdit);
              if (Number.isFinite(v)) commitRotationExact(t, v);
              setDegEdit(null);
            }}
            className="w-9 bg-transparent text-center font-mono text-[11px] tabular-nums text-ink outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => canEdit && setDegEdit(String(deg))}
            title="Click to type an exact angle"
            className="w-9 text-center font-mono text-[11px] tabular-nums text-ink/60 hover:text-ink"
          >
            {deg}°
          </button>
        )}
        <HoldButton
          onFire={() => rotateTable(t, step)}
          disabled={!canEdit}
          ariaLabel={`Rotate ${step}° right`}
          className="flex h-8 w-8 items-center justify-center rounded-r-lg text-ink/60 hover:bg-ink/5 disabled:opacity-40"
        >
          <RotateCw className="h-4 w-4" />
        </HoldButton>
      </div>
    );
  };
  const dockOverflowMenu = (t: EventTableRow) => (
    <div className="relative">
      <button
        type="button"
        onClick={() => setDockOverflow((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={dockOverflow}
        aria-label="More table options"
        className={`flex h-8 w-8 items-center justify-center rounded-lg text-ink/60 hover:bg-ink/5 ${dockOverflow ? 'bg-ink/5' : ''}`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {dockOverflow ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setDockOverflow(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute bottom-full right-0 z-50 mb-1 w-48 overflow-hidden rounded-xl border border-ink/10 bg-cream p-1 shadow-lg"
          >
            <button type="button" role="menuitem" onClick={() => { setDockOverflow(false); setShapePickerOpen(true); setPickerOpen(false); }} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-ink/[0.04]">
              Change shape…
            </button>
            <button type="button" role="menuitem" onClick={() => { setDockOverflow(false); setEditChairs(true); setPickerOpen(false); setShapePickerOpen(false); }} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-ink/[0.04]">
              Edit chairs…
            </button>
            <button type="button" role="menuitem" onClick={() => { setDockOverflow(false); rotateTable(t, 180); }} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-ink/[0.04]">
              Rotate 180°
            </button>
            {t.link_group_id ? (
              <button type="button" role="menuitem" onClick={() => { setDockOverflow(false); doUnlink(t.table_id); }} className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm text-mulberry hover:bg-mulberry/[0.06]">
                <Ungroup className="h-4 w-4" /> Break apart
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );

  return (
    <SeatingFrame>
      {/* ═══════════ ROW 1 — COMMAND BAR (the page's only blurred surface) ═══════════ */}
      <CommandBar>
        {/* View axis — [2D · 3D · List] (verdict §4). Prefetch the lab on hover. */}
        <SeatingViewSegment
          active={view === 'list' ? 'list' : '2d'}
          onSelect={onSelectView}
          on3DHover={() => router.prefetch(labUrl)}
        />

        {/* §5.5 — stats chip becomes a DOORWAY: one actionable number ("N to
            seat"). Tap flips the People pane to the unseated filter; the full
            readout is the hover/press title. (Phone: the count lives on the
            drawer peek handle instead.) */}
        <button
          type="button"
          onClick={() => { selectPanelTab('people'); setOnlyUnseated(true); if (isNarrow) setDrawerSnap('half'); }}
          title={`${seatedCount}/${totalCapacity} seated · ${tables.length} tables · ${unseatedCount} unseated — tap to show who's left`}
          className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-ink/12 bg-cream px-3 py-1.5 font-mono text-[11px] text-ink/70 hover:border-terracotta sm:inline-flex"
        >
          <span className={toSeatReserved > 0 ? 'font-semibold text-terracotta' : ''}>
            {toSeatReserved} to seat
          </span>
        </button>

        {/* Live peers + view-only lock pill (verdict §2). */}
        {/* §5.7 — peers collapse to an avatar stack + "+N" (still hidden <md). */}
        {peerList.length > 0 ? (
          <span
            className="hidden shrink-0 items-center md:inline-flex"
            title={peerList.map((p) => (p.table ? `${p.name} — editing ${tableLabelById.get(p.table) ?? 'a table'}` : `${p.name} is here`)).join(' · ')}
          >
            {peerList.slice(0, 3).map((p, i) => (
              <span
                key={p.id}
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-cream text-[10px] font-semibold text-cream ${i > 0 ? '-ml-1.5' : ''}`}
                style={{ backgroundColor: p.color }}
              >
                {p.name.trim().charAt(0).toUpperCase() || '·'}
              </span>
            ))}
            {peerList.length > 3 ? (
              <span className="-ml-1.5 flex h-6 items-center rounded-full border-2 border-cream bg-ink/60 px-1.5 text-[10px] font-semibold text-cream">
                +{peerList.length - 3}
              </span>
            ) : null}
          </span>
        ) : null}
        {!canEdit ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink/15 bg-ink/[0.03] px-2.5 py-1 text-[11px] font-medium text-ink/70">
            <Eye className="h-3.5 w-3.5 text-ink/50" />
            {lock.status === 'acquiring' ? 'Opening…' : 'Viewing only'}
            <button
              type="button"
              onClick={lock.acquire}
              disabled={lock.status === 'acquiring'}
              className="rounded-md bg-ink/80 px-1.5 py-0.5 text-[10px] font-semibold text-cream hover:bg-ink disabled:opacity-50"
            >
              {lock.status === 'stale_takeover_available' ? 'Take over' : 'Edit'}
            </button>
          </span>
        ) : null}

        {(() => {
          // §1.1 — a transient notice displaced by a higher dock state falls back
          // to this "N notices" expander (never lost, never fighting the dock).
          const count = collapsedNotices.length + (displacedNotice ? 1 : 0);
          if (count === 0) return null;
          return (
            <button
              type="button"
              onClick={() => setNoticesExpanded((v) => !v)}
              aria-expanded={noticesExpanded}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-warn-300 bg-warn-50 px-2 py-1 text-[11px] font-medium text-warn-800 hover:bg-warn-100"
            >
              <AlertTriangle className="h-3 w-3" />
              {count} notice{count === 1 ? '' : 's'}
            </button>
          );
        })()}

        <div className="flex-1" />

        {/* Desktop: the three labeled menus (verdict §2). Below `lg` they collapse
            into the single `⋯` overflow sheet at the end of the bar (verdict §7). */}
        <div className="hidden items-center gap-2 lg:flex">
          {/* ── + Add ▾ — place objects + room size ── */}
          <BarMenu label="Add" icon={Plus} width="w-64" disabled={!canEdit}>
            {addMenuBody}
          </BarMenu>
          {/* ── Arrange ⚙▾ — policies + fill-around-locked + draft ── */}
          <BarMenu label="Arrange" icon={Wand2} width="w-72" stateBadge={arrangePolicyOff}>
            {arrangeMenuBody}
          </BarMenu>
          {/* ── Share & print ▾ — publish, PDFs, guest photos, walkthrough ── */}
          <BarMenu label="Share & print" icon={Printer} width="w-72" align="right" disabled={tables.length === 0}>
            {shareMenuBody}
          </BarMenu>
        </div>

        {/* ── Mobile `⋯` overflow sheet (verdict §7) — + Add / Arrange / Share in
            one menu; the save chip + Auto Arrange stay visible in the bar. ── */}
        <div className="lg:hidden">
          <BarMenu label="More" icon={MoreHorizontal} width="w-72" align="right" title="More seat-plan tools">
            {/* §5.10 — section headers over the 3-body concatenation. */}
            <MenuCaption>Add</MenuCaption>
            {addMenuBody}
            <MenuDivider />
            <MenuCaption>Arrange</MenuCaption>
            {arrangeMenuBody}
            <MenuDivider />
            <MenuCaption>Share</MenuCaption>
            {shareMenuBody}
          </BarMenu>
        </div>

        {/* Permanent save-status chip (verdict §2 SAVE). */}
        <SaveStatusChip
          state={saveState}
          unsavedCount={unsavedCount}
          savedAt={savedAt}
          onSave={saveLayout}
          disabled={!canEdit}
        />

        {/* §5.3 — the one gold: Auto Arrange split-button. Primary opens the
            one-dialog confirm; the caret holds Build-my-seating-draft + Fill-
            around-locked (moved out of Arrange). Empty floor disables the
            command-bar gold with a reason (gold transfers to the starter card). */}
        <div className="relative flex shrink-0">
          <button
            type="button"
            onClick={() => setConfirmAuto(true)}
            disabled={isPending || tables.length === 0 || !canEdit}
            title={
              tables.length === 0
                ? 'Add tables first'
                : !canEdit
                  ? 'View only — someone else is editing this seat plan'
                  : undefined
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-l-lg bg-mulberry px-3 text-xs font-semibold text-cream hover:bg-mulberry-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="sm:hidden">Auto</span>
            <span className="hidden sm:inline">Auto Arrange</span>
          </button>
          <button
            type="button"
            onClick={() => setAutoMenuOpen((v) => !v)}
            disabled={!canEdit}
            aria-haspopup="menu"
            aria-expanded={autoMenuOpen}
            aria-label="More auto-layout options"
            className="inline-flex h-9 items-center rounded-r-lg border-l border-cream/25 bg-mulberry px-1.5 text-cream hover:bg-mulberry-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {autoMenuOpen ? (
            <>
              <button type="button" aria-hidden tabIndex={-1} onClick={() => setAutoMenuOpen(false)} className="fixed inset-0 z-40 cursor-default" />
              <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-ink/10 bg-cream p-1 shadow-lg">
                <MenuRow icon={Sparkles} label="Build my seating draft" hint="Lay out the whole floor in one tap" onClick={() => { setAutoMenuOpen(false); buildDraft(); }} disabled={!canEdit || isPending || tables.length > 0} />
                {lockedCount > 0 ? (
                  <MenuRow icon={Lock} label={`Fill around ${lockedCount} locked`} hint="Keep locked seats; re-seat everyone else around them" onClick={() => { setAutoMenuOpen(false); setConfirmFill(true); }} disabled={isPending || !canEdit} />
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </CommandBar>

      {/* ═══════════ ROW 2 — BANNER SLOT (one strip max + "N notices") ═══════════ */}
      <BannerSlot>
        {bannerWinner ? (
          <div key={bannerWinner.key}>{bannerWinner.node}</div>
        ) : null}
        {noticesExpanded ? (
          <>
            {collapsedNotices.map((n) => <div key={n.key}>{n.node}</div>)}
            {displacedNotice ? (
              <div className="flex items-center gap-2 border-b border-warn-200/70 bg-warn-50/60 px-4 py-1.5 text-xs text-ink/80">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warn-700" />
                <span className="min-w-0 flex-1">{displacedNotice}</span>
                <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="rounded p-0.5 text-warn-700 hover:bg-warn-100">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </BannerSlot>

      {/* ═══════════ ROW 3 — BODY: [320px panel | canvas] ═══════════ */}
      <FrameBody>
        {/* ---------------- Left panel — 3 tabs, full height (verdict §3) ---------------- */}
        {/* Desktop: the 320px grid column. Mobile (<lg): a bottom drawer renders
            the SAME `panelBody` instead — see after </FrameBody>. */}
        {isNarrow ? null : (
          <aside className="flex min-h-0 flex-col overflow-hidden bg-cream lg:h-full lg:border-r lg:border-ink/10">
            {panelBody}
          </aside>
        )}

      {/* ---------------- Canvas cell — fills all remaining height (verdict §1) ---------------- */}
      <div ref={regionRef} className="relative min-h-0 flex-1 overflow-hidden lg:flex-none">

        {/* Room size & scale — right-anchored popover over the canvas (verdict
            §2 row 2). Floats (absolute) so it never pushes the canvas down. */}
        {view === 'plan' && showRoomPanel ? (
          <div className="absolute right-2 top-2 z-40 flex max-h-[calc(100%-1rem)] w-[min(92vw,40rem)] flex-wrap items-end gap-4 overflow-y-auto rounded-xl border border-ink/10 bg-cream p-3 shadow-lg">
            <div className="flex w-full items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">Room size &amp; scale</span>
              <button
                type="button"
                onClick={() => setShowRoomPanel(false)}
                aria-label="Close room size"
                className="rounded-md p-1 text-ink/40 hover:bg-ink/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
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
            {/* Feature B — room-size presets: one tap sets a common footprint and
                switches to-scale mode on (the typed inputs stay for fine-tuning). */}
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">Presets</span>
              <div className="flex flex-wrap gap-1.5">
                {ROOM_PRESETS.map((p) => {
                  const active = venueScaled && venue.width === p.width && venue.length === p.length;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setVenue({ enabled: true, width: p.width, length: p.length });
                        setFloorDirty(true);
                      }}
                      title={`${p.width} × ${p.length} m`}
                      aria-pressed={active}
                      className={`rounded-lg border px-2 py-1 text-xs font-medium ${
                        active
                          ? 'border-terracotta bg-terracotta/10 text-terracotta-700'
                          : 'border-ink/15 bg-cream text-ink/70 hover:border-terracotta hover:text-terracotta'
                      }`}
                    >
                      {p.label}{' '}
                      <span className="tabular-nums text-ink/40">
                        {p.width}×{p.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Stage + dance-floor dimensions in metres. Sizes store as percent
                of the canvas, so they only map to metres once a room size is
                set; otherwise size the stage/dance with their drag grips. */}
            {venueScaled ? (
              <>
                <MetreSizeField
                  label="Stage W (m)"
                  metres={(stage.w / 100) * venue.width}
                  onMetres={(m) => {
                    setStage((s) => ({ ...s, w: Math.max(2, Math.min(100, (m / venue.width) * 100)) }));
                    setFloorDirty(true);
                  }}
                />
                <MetreSizeField
                  label="Stage L (m)"
                  metres={(stage.h / 100) * venue.length}
                  onMetres={(m) => {
                    setStage((s) => ({ ...s, h: Math.max(2, Math.min(100, (m / venue.length) * 100)) }));
                    setFloorDirty(true);
                  }}
                />
                {dance.enabled ? (
                  <>
                    <MetreSizeField
                      label="Dance W (m)"
                      metres={(dance.w / 100) * venue.width}
                      onMetres={(m) => {
                        setDance((d) => ({ ...d, w: Math.max(2, Math.min(100, (m / venue.width) * 100)) }));
                        setFloorDirty(true);
                      }}
                    />
                    <MetreSizeField
                      label="Dance L (m)"
                      metres={(dance.h / 100) * venue.length}
                      onMetres={(m) => {
                        setDance((d) => ({ ...d, h: Math.max(2, Math.min(100, (m / venue.length) * 100)) }));
                        setFloorDirty(true);
                      }}
                    />
                  </>
                ) : null}
                {cocktail.enabled ? (
                  <>
                    <MetreSizeField
                      label="Cocktail W (m)"
                      metres={(cocktail.w / 100) * venue.width}
                      onMetres={(m) => {
                        setCocktail((c) => ({
                          ...c,
                          w: Math.max(2, Math.min(100, (m / venue.width) * 100)),
                        }));
                        setFloorDirty(true);
                      }}
                    />
                    <MetreSizeField
                      label="Cocktail L (m)"
                      metres={(cocktail.h / 100) * venue.length}
                      onMetres={(m) => {
                        setCocktail((c) => ({
                          ...c,
                          h: Math.max(2, Math.min(100, (m / venue.length) * 100)),
                        }));
                        setFloorDirty(true);
                      }}
                    />
                  </>
                ) : null}
              </>
            ) : null}
            <p className="flex-1 text-xs text-ink/50">
              Enter your reception room&rsquo;s width × length and tables render at their true footprint, so you can
              see what fits.{' '}
              {venueScaled ? (
                <span className="text-ink/40">Stage &amp; dance-floor sizes are in metres too.</span>
              ) : (
                <span className="text-ink/40">Zoom in to seat people; Fit to see the whole room.</span>
              )}
            </p>
          </div>
        ) : null}

        {/* ═══════════ THE CONTEXT DOCK (verdict §1) — one contextual surface ═══════════
            Replaces the four competing chromes (popover · floating pills · marker
            scatter · seat × chips). Precedence resolved above; bottom↔top flip is
            deterministic; the phone sheet is the dock's sibling density. */}
        {(() => {
          if (dockPrimary === null) return null;
          const edge = computeDockEdge();

          // §1.5 view-only honesty — when a table/marker is selected but a peer
          // holds the editor lock, the dock is a READ-ONLY summary + exactly one
          // Take-over button. Disabled looks disabled; the old silent no-op dies.
          if (!canEdit && (dockPrimary === 'table' || dockPrimary === 'marker')) {
            let glyph: React.ReactNode = null;
            let name = '';
            let summary: string | null = null;
            if (selTable) {
              glyph = <ShapeGlyph shape={shapeHintFor(selTable.table_type)} className="h-3.5 w-3.5" />;
              name = selTable.table_label;
              summary = `${seatedAt(selTable.table_id)}/${effectiveCapacity(selTable.capacity, selTable.removed_seats)}`;
            } else if (selM) {
              name = selM.kind === 'booth'
                ? (booths.find((x) => x.booth_id === selM.id)?.label ?? 'Booth')
                : selM.kind === 'sign'
                  ? (signs.find((x) => x.sign_id === selM.id)?.label ?? 'Sign')
                  : selM.kind.charAt(0).toUpperCase() + selM.kind.slice(1);
            }
            return (
              <ContextDock variant={isPhone ? 'sheet' : 'dock'} edge={isPhone ? 'bottom' : edge} tone="neutral" glyph={glyph} name={name} boundsRef={regionRef} onDismiss={isPhone ? clearSelection : undefined}>
                {summary ? <span className="px-1 font-mono text-[11px] tabular-nums text-ink/60">{summary} seated</span> : null}
                <button
                  type="button"
                  onClick={lock.acquire}
                  disabled={lock.status === 'acquiring'}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-ink/80 px-3 font-semibold text-cream hover:bg-ink disabled:opacity-50 ${isPhone ? 'h-11 text-sm' : 'h-8 text-xs'}`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  {lock.status === 'stale_takeover_available' ? 'Take over' : 'Edit'}
                </button>
                {!isPhone ? (
                  <button type="button" onClick={clearSelection} aria-label="Done" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink/40 hover:bg-ink/5">
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </ContextDock>
            );
          }

          // ── Pill states (bottom, no flip; shown in both plan + list views) ──
          if (dockPrimary === 'picked-guest' && pickedGuest) {
            return (
              <ContextDock variant="dock" edge="bottom" tone="picked-guest" boundsRef={regionRef}>
                <ChairAvatar guest={pickedGuest} color={colorFor(pickedGuest)} size={24} />
                <span className="min-w-0 flex-1 truncate px-1 text-sm">
                  Seating <span className="font-semibold text-ink">{pickedGuest.name}</span> — tap a chair or a table.
                </span>
                {pickedGuest.seated_table_id ? (
                  <button
                    type="button"
                    onClick={() => unseat(pickedGuest.guest_id)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-ink/15 px-2 text-xs text-ink hover:border-danger-400 hover:text-danger-600"
                  >
                    <UserMinus className="h-3.5 w-3.5" /> Unseat
                  </button>
                ) : null}
                <button type="button" onClick={() => setPickedId(null)} aria-label="Cancel" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/40 hover:bg-ink/5">
                  <X className="h-4 w-4" />
                </button>
              </ContextDock>
            );
          }
          if (dockPrimary === 'picked-group' && pickedGroup) {
            return (
              <ContextDock variant="dock" edge="bottom" tone="picked-group" boundsRef={regionRef}>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: pickedGroup.color }} />
                <span className="min-w-0 flex-1 truncate px-1 text-sm">
                  Seating <span className="font-semibold text-ink">{pickedGroup.label}</span> ({pickedGroupMemberIds.length}{' '}
                  {pickedGroupMemberIds.length === 1 ? 'member' : 'members'}) — tap a table.
                </span>
                <button type="button" onClick={() => setPickedGroupId(null)} aria-label="Cancel" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/40 hover:bg-ink/5">
                  <X className="h-4 w-4" />
                </button>
              </ContextDock>
            );
          }

          // ── Selected TABLE (edit-chairs is a variant of this state) ──
          if (dockPrimary === 'table' && selTable) {
            const st = selTable;
            const variant = isPhone ? 'sheet' : 'dock';
            const seated = seatedAt(st.table_id);
            const panel = shapePickerOpen ? (
              <ShapePicker
                value={st.table_type}
                seatedCount={seated}
                onApply={(tt) => { changeStyle(st, tt); setShapePickerOpen(false); }}
                onPreview={setPreviewType}
                onCancel={() => { setShapePickerOpen(false); setPreviewType(null); }}
              />
            ) : pickerOpen ? (
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
                onUnseat={unseat}
                roleSet={roleSet}
              />
            ) : null;

            const nameField = (big: boolean) => (
              <input
                key={st.table_id}
                defaultValue={st.table_label}
                aria-label="Table name"
                maxLength={64}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') { e.currentTarget.value = st.table_label; e.currentTarget.blur(); }
                }}
                onBlur={(e) => renameTable(st.table_id, e.currentTarget.value)}
                className={
                  big
                    ? 'h-11 min-w-0 flex-1 rounded-xl border border-ink/15 bg-cream px-3 text-base font-medium text-ink outline-none focus:border-terracotta'
                    : 'w-24 rounded-lg border border-transparent bg-ink/[0.04] px-2 py-1 text-sm font-medium text-ink outline-none focus:border-terracotta focus:bg-cream'
                }
              />
            );
            const seatPeopleBtn = (big: boolean) => (
              <button
                type="button"
                onClick={() => { setPickerOpen((v) => !v); setShapePickerOpen(false); }}
                aria-pressed={pickerOpen}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 font-medium ${big ? 'h-11 text-sm' : 'h-8 text-xs'} ${
                  pickerOpen ? 'border-terracotta bg-terracotta/10 text-terracotta-700' : 'border-ink/15 text-ink/75 hover:bg-ink/5'
                }`}
              >
                <UserPlus className={big ? 'h-5 w-5' : 'h-4 w-4'} /> Seat people
              </button>
            );

            // Edit-chairs banner variant (§3).
            if (editChairs) {
              const banner = (
                <>
                  <span className="min-w-0 flex-1 px-1 text-[13px] text-ink/80">
                    Editing chairs — tap a chair to remove, a ghost to restore.
                    {seatNotice && seatNotice.tableId === st.table_id ? (
                      <>
                        {' · '}
                        <button type="button" onClick={undoSeatRemoval} className="font-semibold text-terracotta-700 underline">
                          Undo seat {seatNotice.seat + 1}
                        </button>
                      </>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditChairs(false)}
                    className={`inline-flex shrink-0 items-center rounded-lg bg-mulberry px-3 font-semibold text-cream hover:bg-mulberry-600 ${isPhone ? 'h-11 text-sm' : 'h-8 text-xs'}`}
                  >
                    Done
                  </button>
                </>
              );
              return (
                <ContextDock variant={variant} edge={variant === 'dock' ? edge : 'bottom'} tone="edit-chairs" glyph={<ShapeGlyph shape={shapeHintFor(st.table_type)} className="h-3.5 w-3.5" />} name={variant === 'sheet' ? st.table_label : undefined} boundsRef={regionRef}>
                  {banner}
                </ContextDock>
              );
            }

            const undoStrip =
              seatNotice && seatNotice.tableId === st.table_id ? (
                <button
                  type="button"
                  onClick={undoSeatRemoval}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-ink/15 bg-cream px-2 font-mono text-[10px] text-ink/70 hover:border-terracotta"
                >
                  Seat {seatNotice.seat + 1} removed · Undo
                </button>
              ) : null;

            const body = isPhone ? (
              // §1.3 — phone sheet, reordered to dock parity, ≥44px rows.
              <div className="flex w-full flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  {nameField(true)}
                  {seatPeopleBtn(true)}
                  <button type="button" onClick={clearSelection} aria-label="Done" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ink/15 text-ink/50 hover:bg-ink/5">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {dockSeatsStepper(st)}
                  {undoStrip}
                </div>
                <div className="flex items-center gap-2">
                  {dockRotateCluster(st, 15)}
                  <button type="button" onClick={() => rotateTable(st, 180)} className="inline-flex h-11 items-center rounded-xl border border-ink/15 px-3 text-sm font-medium text-ink/70 hover:bg-ink/5">
                    180°
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => { setShapePickerOpen(true); setPickerOpen(false); }} className="inline-flex h-11 items-center rounded-xl border border-ink/15 px-3 text-sm text-ink/75 hover:bg-ink/5">Change shape…</button>
                  <button type="button" onClick={() => { setEditChairs(true); setPickerOpen(false); setShapePickerOpen(false); }} className="inline-flex h-11 items-center rounded-xl border border-ink/15 px-3 text-sm text-ink/75 hover:bg-ink/5">Edit chairs…</button>
                  {st.link_group_id ? (
                    <button type="button" onClick={() => doUnlink(st.table_id)} className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-ink/15 px-3 text-sm text-mulberry hover:bg-mulberry/10">
                      <Ungroup className="h-4 w-4" /> Break apart
                    </button>
                  ) : null}
                </div>
                <div className="h-2" />
                <button type="button" onClick={() => requestRemoveTable(st)} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-danger-300 px-3 text-sm font-medium text-danger-600 hover:bg-danger-50">
                  <Trash2 className="h-5 w-5" /> Delete table
                </button>
              </div>
            ) : (
              // §1.2 — desktop dock, one row, exact order.
              <>
                <ShapeGlyph shape={shapeHintFor(st.table_type)} className="ml-1 h-3.5 w-3.5 shrink-0 text-ink/45" />
                {nameField(false)}
                {seatPeopleBtn(false)}
                {dockSeatsStepper(st)}
                {undoStrip}
                {dockRotateCluster(st, 15)}
                {dockOverflowMenu(st)}
                <span className="mx-0.5 h-6 w-px shrink-0 bg-ink/15" />
                <button type="button" onClick={() => requestRemoveTable(st)} aria-label="Delete table" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink/50 hover:bg-danger-50 hover:text-danger-600">
                  <Trash2 className="h-4 w-4" />
                </button>
                <button type="button" onClick={clearSelection} aria-label="Done" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink/40 hover:bg-ink/5">
                  <X className="h-4 w-4" />
                </button>
              </>
            );
            return (
              <ContextDock
                variant={variant}
                edge={variant === 'dock' ? edge : 'bottom'}
                tone="neutral"
                glyph={variant === 'sheet' ? undefined : undefined}
                boundsRef={regionRef}
                panel={panel}
              >
                {body}
              </ContextDock>
            );
          }

          // ── Selected MARKER (§1.4) ──
          if (dockPrimary === 'marker' && selM) {
            const big = isPhone;
            const actBtn = `inline-flex shrink-0 items-center gap-1 rounded-lg border font-medium ${big ? 'h-11 px-3 text-sm' : 'h-8 px-2.5 text-xs'}`;
            const removeBtn = (
              <button type="button" onClick={removeSelectedMarker} className={`${actBtn} border-danger-300 text-danger-600 hover:bg-danger-50`}>
                <Trash2 className={big ? 'h-5 w-5' : 'h-4 w-4'} /> Remove
              </button>
            );
            const doneBtn = (
              <button type="button" onClick={clearSelection} aria-label="Done" className={`${actBtn} border-ink/15 text-ink/60 hover:bg-ink/5`}>
                Done
              </button>
            );
            const seg = (opts: { key: string; label: string; active: boolean; onClick: () => void }[], label: string) => (
              <div role="group" aria-label={label} className="flex shrink-0 overflow-hidden rounded-lg border border-ink/15 text-[11px] font-semibold">
                {opts.map((o) => (
                  <button key={o.key} type="button" onClick={o.onClick} aria-pressed={o.active} className={`${big ? 'h-11' : 'h-8'} px-2.5 ${o.active ? 'bg-terracotta text-cream' : 'text-ink/60 hover:bg-ink/[0.04]'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            );

            let glyph: React.ReactNode = null;
            let name: string | undefined;
            let panel: React.ReactNode = null;
            let mBody: React.ReactNode = null;

            if (selM.kind === 'booth') {
              const b = booths.find((x) => x.booth_id === selM.id);
              if (!b) return null;
              glyph = <BoothIcon type={b.booth_type} className="h-3.5 w-3.5 text-terracotta-700" />;
              name = b.booth_type === 'unassigned' ? 'Pick type' : boothPresenceLabel(b);
              panel = (
                <BoothPickerPanel
                  booth={b}
                  booths={booths}
                  bookedVendors={bookedVendors}
                  eventId={eventId}
                  onSetVendor={(v) => setBoothVendor(b.booth_id, v)}
                  onSetType={(t) => setBoothType(b.booth_id, t)}
                  onSetOfferings={(v) => setBoothOfferings(b.booth_id, v)}
                />
              );
              mBody = (<>{removeBtn}{doneBtn}</>);
            } else if (selM.kind === 'entrance') {
              glyph = <DoorOpen className="h-3.5 w-3.5 text-terracotta-700" />;
              name = entrance.kind === 'tunnel' ? 'Walk-through' : 'Entrance';
              mBody = (
                <>
                  {seg(
                    [
                      { key: 'door', label: 'Door', active: entrance.kind === 'door', onClick: () => { setEntrance((en) => ({ ...en, kind: 'door' })); setFloorDirty(true); } },
                      { key: 'tunnel', label: 'Walk-through', active: entrance.kind === 'tunnel', onClick: () => { setEntrance((en) => ({ ...en, kind: 'tunnel' })); setFloorDirty(true); } },
                    ],
                    'Entrance style',
                  )}
                  {entrance.kind === 'tunnel' ? (
                    <div className="flex shrink-0 items-center rounded-lg border border-ink/15">
                      <button type="button" aria-label="Decrease depth" onClick={() => { setEntrance((en) => ({ ...en, depthM: Math.max(1.5, Math.round((en.depthM - 0.5) * 2) / 2) })); setFloorDirty(true); }} className={`flex ${big ? 'h-11 w-11' : 'h-8 w-8'} items-center justify-center rounded-l-lg text-ink/60 hover:bg-ink/5`}>
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="px-1 font-mono text-[11px] tabular-nums text-ink/70">{entrance.depthM.toFixed(1)}m</span>
                      <button type="button" aria-label="Increase depth" onClick={() => { setEntrance((en) => ({ ...en, depthM: Math.min(8, Math.round((en.depthM + 0.5) * 2) / 2) })); setFloorDirty(true); }} className={`flex ${big ? 'h-11 w-11' : 'h-8 w-8'} items-center justify-center rounded-r-lg text-ink/60 hover:bg-ink/5`}>
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                  {removeBtn}
                  {doneBtn}
                </>
              );
            } else if (selM.kind === 'cocktail') {
              glyph = <Martini className="h-3.5 w-3.5 text-terracotta-700" />;
              name = cocktail.label;
              mBody = (
                <>
                  {seg(
                    [
                      { key: 'linked', label: 'With entrance', active: cocktail.linked, onClick: () => { if (!cocktail.linked) toggleCocktailLink(); } },
                      { key: 'separate', label: 'Separate', active: !cocktail.linked, onClick: () => { if (cocktail.linked) toggleCocktailLink(); } },
                    ],
                    'Cocktail room placement',
                  )}
                  {removeBtn}
                  {doneBtn}
                </>
              );
            } else if (selM.kind === 'dance') {
              glyph = <Footprints className="h-3.5 w-3.5 text-mulberry/70" />;
              name = 'Dance floor';
              mBody = (<>{removeBtn}{doneBtn}</>);
            } else if (selM.kind === 'service') {
              glyph = <Truck className="h-3.5 w-3.5 text-ink/50" />;
              name = 'Service door';
              mBody = (<>{removeBtn}{doneBtn}</>);
            } else if (selM.kind === 'sign') {
              const s = signs.find((x) => x.sign_id === selM.id);
              if (!s) return null;
              glyph = <Navigation className="h-3.5 w-3.5 text-mulberry/70" />;
              name = undefined;
              mBody = (
                <>
                  <input
                    key={s.sign_id}
                    defaultValue={s.label}
                    aria-label="Sign label"
                    maxLength={24}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = s.label; e.currentTarget.blur(); } }}
                    onBlur={(e) => relabelSign(s.sign_id, e.currentTarget.value)}
                    className={big ? 'h-11 min-w-0 flex-1 rounded-xl border border-ink/15 bg-cream px-3 text-base font-medium text-ink outline-none focus:border-terracotta' : 'w-28 rounded-lg border border-transparent bg-ink/[0.04] px-2 py-1 text-sm font-medium text-ink outline-none focus:border-terracotta focus:bg-cream'}
                  />
                  <div className="flex shrink-0 items-center rounded-lg border border-ink/15">
                    <button type="button" aria-label="Rotate 45° left" onClick={() => rotateSignBy(s.sign_id, -45)} className={`flex ${big ? 'h-11 w-11' : 'h-8 w-8'} items-center justify-center rounded-l-lg text-ink/60 hover:bg-ink/5`}>
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <span className="w-9 text-center font-mono text-[11px] tabular-nums text-ink/60">{s.rotation_deg}°</span>
                    <button type="button" aria-label="Rotate 45° right" onClick={() => rotateSignBy(s.sign_id, 45)} className={`flex ${big ? 'h-11 w-11' : 'h-8 w-8'} items-center justify-center rounded-r-lg text-ink/60 hover:bg-ink/5`}>
                      <RotateCw className="h-4 w-4" />
                    </button>
                  </div>
                  {removeBtn}
                  {doneBtn}
                </>
              );
            } else {
              // stage — honest permanence: no remove.
              glyph = <span className="font-mono text-[9px] font-semibold uppercase tracking-wide text-ink/50">Stage</span>;
              name = 'Stage';
              mBody = (
                <>
                  <span className="px-1 text-[11px] text-ink/45">· permanent</span>
                  {doneBtn}
                </>
              );
            }

            return (
              <ContextDock
                variant={isPhone ? 'sheet' : 'dock'}
                edge={isPhone ? 'bottom' : edge}
                tone="neutral"
                glyph={glyph}
                name={name}
                boundsRef={regionRef}
                panel={panel}
                onDismiss={isPhone ? clearSelection : undefined}
              >
                {mBody}
              </ContextDock>
            );
          }

          // ── Notice (lowest precedence) ──
          if (dockPrimary === 'notice' && notice) {
            return (
              <ContextDock variant="dock" edge="bottom" tone="notice" boundsRef={regionRef}>
                <span className="min-w-0 flex-1 px-1 text-sm text-warn-900">{notice}</span>
                <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="flex h-8 w-8 items-center justify-center rounded-lg text-warn-700 hover:bg-warn-100">
                  <X className="h-4 w-4" />
                </button>
              </ContextDock>
            );
          }
          return null;
        })()}

        {view === 'plan' ? (
        <>
        <div
          ref={canvasRef}
          // Opt this canvas out of the app-wide pinch-zoom suppression
          // (<ZoomGuard/> skips [data-allow-zoom] subtrees) — the editor runs
          // its own pointer-event pan/pinch on `touch-none`, so it needs raw
          // two-finger gestures here while the rest of the app stays zoom-locked.
          data-allow-zoom=""
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerCancel={onCanvasPointerUp}
          className="absolute inset-0 m-auto cursor-grab touch-none overflow-hidden border border-ink/15 bg-ink/[0.02] active:cursor-grabbing"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(30,34,41,0.06) 1px, transparent 0)',
            backgroundSize: `${gridPx}px ${gridPx}px`,
            // The canvas fills the cell (verdict §1 — no aspect-[7/5] box, no 64vh
            // cap). To-scale mode letterboxes the room ratio INSIDE the fill,
            // sized to the measured region so a portrait room doesn't distort.
            ...(scaledBox
              ? { width: `${scaledBox.w}px`, height: `${scaledBox.h}px` }
              : {}),
          }}
        >
          {/* Universal confirm-on-drop bubble (owner 2026-07-17) — screen-space
              child of the canvas (outside the pan/zoom world layer), anchored at
              the drop point. Shared component with the 3D lab. */}
          <DropConfirmBubble state={dropConfirm} onConfirm={onDropConfirm} onCancel={onDropCancel} />
          {/* world layer — pan/zoom applied to its transform directly via refs */}
          <div ref={worldRef} className="absolute inset-0 will-change-transform" style={{ transformOrigin: '0 0' }}>
          {/* room outline (walls) + metric labels, when a venue size is set */}
          {venueScaled ? (
            <>
              {/* Blueprint (directive 2026-07-15): hairline walls, mono dims. */}
              <div className="pointer-events-none absolute inset-0 rounded-lg border border-ink/30" />
              <span className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 rounded bg-cream/80 px-1.5 font-mono text-[9px] font-medium tracking-tight text-ink/55">
                {venue.width} m
              </span>
              <span className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 -rotate-90 rounded bg-cream/80 px-1.5 font-mono text-[9px] font-medium tracking-tight text-ink/55">
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
                aria-label="Dance floor — tap to edit, drag to move"
                className={`flex h-full w-full select-none items-center justify-center rounded-lg border bg-mulberry/[0.04] font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mulberry/70 ${
                  selMarker?.kind === 'dance'
                    ? 'border-mulberry ring-2 ring-mulberry/30'
                    : dragId === '__dance__'
                      ? 'border-mulberry border-dashed cursor-grabbing'
                      : 'border-mulberry/40 border-dashed cursor-grab'
                }`}
              >
                Dance floor
              </button>
              {/* Resize grip renders ONLY while selected (§1.4). Ambient × deleted
                  — Remove now lives in the dock. */}
              {selMarker?.kind === 'dance' ? (
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
              ) : null}
            </div>
          ) : null}

          {/* Cocktail / waiting-area room — a SECOND room on the same canvas
              (booths only; tables are blocked from it via overlapsAny). Unlike
              the dance floor it's a CONTAINER, so the body is pointer-events-
              none (booths inside stay clickable); move via the label chip,
              resize via the corner grip. */}
          {/* Doorway connector — drawn from the reception entrance to the docked
              cocktail room's near edge (arrive → register → enter). */}
          {cocktail.enabled && cocktail.linked && entrance.enabled ? (
            <svg
              aria-hidden
              className="pointer-events-none absolute inset-0 z-[3] h-full w-full overflow-visible text-terracotta"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <line
                x1={entrance.x}
                y1={entrance.y}
                x2={Math.max(cocktail.x - cocktail.w / 2, Math.min(cocktail.x + cocktail.w / 2, entrance.x))}
                y2={Math.max(cocktail.y - cocktail.h / 2, Math.min(cocktail.y + cocktail.h / 2, entrance.y))}
                stroke="currentColor"
                strokeWidth={2}
                strokeDasharray="4 3"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                opacity={0.6}
              />
            </svg>
          ) : null}

          {cocktail.enabled ? (
            <div
              className="pointer-events-none absolute z-[4]"
              style={{
                left: `${cocktail.x}%`,
                top: `${cocktail.y}%`,
                width: `${cocktail.w}%`,
                height: `${cocktail.h}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div
                className={`h-full w-full rounded-xl border bg-terracotta/[0.04] ${
                  selMarker?.kind === 'cocktail'
                    ? 'border-terracotta ring-2 ring-terracotta/25'
                    : 'border-dashed border-terracotta/45'
                }`}
              />
              <button
                type="button"
                onPointerDown={onMarkerPointerDown('cocktail')}
                aria-label={`${cocktail.label} — tap to edit, drag to move`}
                className={`pointer-events-auto absolute left-1.5 top-1.5 inline-flex select-none items-center gap-1 rounded-md border bg-cream px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-terracotta shadow-sm ${
                  dragId === '__cocktail__'
                    ? 'border-terracotta cursor-grabbing'
                    : 'border-terracotta/40 cursor-grab'
                }`}
              >
                <Martini className="h-3 w-3" />
                {cocktail.label}
              </button>
              {/* Ambient link toggle + × deleted — the worded
                  [With entrance | Separate] segmented + Remove live in the dock
                  now (§1.4 / §6.3). Resize grip only while selected. */}
              {selMarker?.kind === 'cocktail' ? (
                <button
                  type="button"
                  onPointerDown={onRectGripDown('cocktail')}
                  onPointerMove={onRectGripMove}
                  onPointerUp={onRectGripUp}
                  onPointerCancel={onRectGripUp}
                  aria-label="Resize cocktail area"
                  title="Drag to resize the cocktail area"
                  className="pointer-events-auto absolute -bottom-2 -right-2 z-10 flex h-5 w-5 cursor-nwse-resize items-center justify-center rounded-md border-2 border-terracotta bg-cream text-terracotta shadow-sm"
                >
                  <Maximize2 className="h-3 w-3 rotate-90" />
                </button>
              ) : null}
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
              aria-label="Stage — tap to select, drag to move"
              className={`flex h-full w-full select-none items-center justify-center overflow-hidden rounded-md border bg-cream/85 font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-ink/70 shadow-sm backdrop-blur-sm ${
                selMarker?.kind === 'stage'
                  ? 'border-terracotta ring-2 ring-terracotta/25'
                  : dragId === '__stage__'
                    ? 'border-terracotta cursor-grabbing'
                    : 'border-ink/25 cursor-grab'
              }`}
            >
              Stage
            </button>
            {/* Resize grip only while selected (§1.4). Stage keeps NO remove. */}
            {selMarker?.kind === 'stage' ? (
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
            ) : null}
          </div>

          {/* Walk-through entrance footprint — a deeper rectangle whose back edge
              is flush to the nearest wall, extending inward by the couple's
              chosen depth. Only when kind==='tunnel'; the DoorOpen pill below
              stays the mouth label. Sits under the pill (z-0). */}
          {entrance.enabled && entrance.kind === 'tunnel'
            ? (() => {
                // Nearest wall (argmin distance) — same pattern as stageWallOf.
                const dTop = entrance.y;
                const dBottom = 100 - entrance.y;
                const dLeft = entrance.x;
                const dRight = 100 - entrance.x;
                const min = Math.min(dTop, dBottom, dLeft, dRight);
                // Depth as a % of the room dimension along the inward axis; a
                // free board (no metre size) uses a fixed ~12% fallback.
                const vertical = min === dTop || min === dBottom;
                const roomDim = venueScaled ? (vertical ? venue.length : venue.width) : 0;
                const depthPct = roomDim > 0 ? Math.min(60, (entrance.depthM / roomDim) * 100) : 12;
                const MOUTH = 13; // clear width of the walk-through, % of canvas
                let left: number;
                let top: number;
                let width: number;
                let height: number;
                if (min === dTop) {
                  width = MOUTH;
                  height = depthPct;
                  left = entrance.x - MOUTH / 2;
                  top = 0;
                } else if (min === dBottom) {
                  width = MOUTH;
                  height = depthPct;
                  left = entrance.x - MOUTH / 2;
                  top = 100 - depthPct;
                } else if (min === dLeft) {
                  width = depthPct;
                  height = MOUTH;
                  left = 0;
                  top = entrance.y - MOUTH / 2;
                } else {
                  width = depthPct;
                  height = MOUTH;
                  left = 100 - depthPct;
                  top = entrance.y - MOUTH / 2;
                }
                return (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute z-0 rounded-sm border border-terracotta/40 bg-terracotta/[0.06]"
                    style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                  />
                );
              })()
            : null}

          {/* draggable entrance door marker */}
          {entrance.enabled ? (
            <div
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${entrance.x}%`, top: `${entrance.y}%` }}
            >
              <button
                type="button"
                onPointerDown={onMarkerPointerDown('entrance')}
                aria-label="Entrance — tap to edit, drag to move"
                className={`flex select-none items-center gap-1.5 rounded-md border bg-cream/85 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-ink/70 shadow-sm backdrop-blur-sm ${
                  selMarker?.kind === 'entrance'
                    ? 'border-terracotta ring-2 ring-terracotta/25'
                    : dragId === '__entrance__'
                      ? 'border-terracotta cursor-grabbing'
                      : 'border-ink/25 cursor-grab'
                }`}
              >
                <DoorOpen className="h-3.5 w-3.5 text-terracotta-700" />{' '}
                {entrance.kind === 'tunnel' ? 'Walk-through' : 'Entrance'}
              </button>
              {/* Ambient × + the Door/Walk-through toggle + depth stepper are
                  deleted — they live in the dock now (§1.4). */}
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
                aria-label="Service entrance — tap to edit, drag to move"
                className={`flex select-none items-center gap-1.5 rounded-md border bg-cream/85 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-ink/70 shadow-sm backdrop-blur-sm ${
                  selMarker?.kind === 'service'
                    ? 'border-terracotta ring-2 ring-terracotta/25'
                    : dragId === '__service__'
                      ? 'border-terracotta cursor-grabbing'
                      : 'border-ink/25 cursor-grab'
                }`}
              >
                <Truck className="h-3.5 w-3.5 text-ink/50" /> Service
              </button>
              {/* Ambient × deleted — Remove lives in the dock now (§1.4). */}
            </div>
          ) : null}

          {/* vendor booths — perimeter-anchored markers; the drag handler runs
              the wall-snap rules live so they can't leave the legal band */}
          {booths.map((b) => {
            const unassigned = b.booth_type === 'unassigned';
            // Presence label (owner directive 2026-07-16): a booth mirrors the 3D
            // slot — a FINALIZED vendor's name when linked, "SETNAYAN" otherwise.
            // The blank pre-pick pin keeps its "Pick type" editor prompt.
            const markerLabel = unassigned ? 'Pick type' : boothPresenceLabel(b);
            const boothSelected = selMarker?.kind === 'booth' && selMarker.id === b.booth_id;
            return (
              <div
                key={b.booth_id}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${b.x_pos}%`, top: `${b.y_pos}%` }}
              >
                {venueScaled && pxPerMeter ? (
                  // Feature C — true metre footprint + inward facing arrow + upright
                  // label. The body draws BOOTH_FOOTPRINT_M (reused from the 3D lib)
                  // at px-per-metre and rotates to face the room centre (same
                  // derivation as the 3D boothFacingY). The arrow is a child of the
                  // rotated body → points INWARD for free; the label counter-rotates
                  // so text stays upright. Footprint is small, so the label chip may
                  // overflow it — kept legible, centred on the booth.
                  (() => {
                    const deg = boothFacingDeg2D(
                      { xPct: b.x_pos, yPct: b.y_pos },
                      { w: venue.width, d: venue.length },
                    );
                    const fpW = BOOTH_FOOTPRINT_M.w * pxPerMeter; // lateral (along the wall)
                    const fpH = BOOTH_FOOTPRINT_M.d * pxPerMeter; // depth (into the room)
                    return (
                      <button
                        type="button"
                        onPointerDown={onBoothPointerDown(b.booth_id)}
                        aria-label={`${unassigned ? 'New booth — tap to pick a type' : markerLabel} — tap to edit, drag along the walls`}
                        style={{ width: `${fpW}px`, height: `${fpH}px`, transform: `rotate(${deg}deg)` }}
                        className={`relative block select-none rounded-sm border shadow-sm backdrop-blur-sm ${
                          unassigned
                            ? 'border-dashed border-terracotta/60 bg-terracotta/[0.10]'
                            : 'border-ink/30 bg-terracotta/[0.06]'
                        } ${
                          boothSelected
                            ? 'border-terracotta ring-2 ring-terracotta/30'
                            : dragId === `__booth_${b.booth_id}__`
                              ? 'border-terracotta cursor-grabbing'
                              : 'cursor-grab'
                        }`}
                      >
                        <ChevronUp
                          aria-hidden
                          className="pointer-events-none absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-full text-terracotta-700"
                        />
                        <span
                          style={{ transform: `translate(-50%, -50%) rotate(${-deg}deg)` }}
                          className="pointer-events-none absolute left-1/2 top-1/2 flex items-center gap-1 whitespace-nowrap rounded bg-cream/90 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/70 shadow-sm"
                        >
                          <BoothIcon type={b.booth_type} className="h-3 w-3 text-terracotta-700" />
                          {markerLabel}
                        </span>
                      </button>
                    );
                  })()
                ) : (
                  <button
                    type="button"
                    onPointerDown={onBoothPointerDown(b.booth_id)}
                    aria-label={`${unassigned ? 'New booth — tap to pick a type' : markerLabel} — tap to edit, drag to move`}
                    className={`flex select-none items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] shadow-sm backdrop-blur-sm ${
                      unassigned
                        ? 'border-dashed border-terracotta/60 bg-terracotta/[0.06] text-terracotta-700'
                        : 'bg-cream/85 text-ink/70'
                    } ${
                      boothSelected
                        ? 'border-terracotta ring-2 ring-terracotta/30'
                        : dragId === `__booth_${b.booth_id}__`
                          ? 'border-terracotta cursor-grabbing'
                          : `${unassigned ? '' : 'border-ink/25'} cursor-grab`
                    }`}
                  >
                    <BoothIcon type={b.booth_type} className="h-3.5 w-3.5 text-terracotta-700" />
                    {markerLabel}
                  </button>
                )}
                {/* Ambient × + the on-canvas type picker are deleted — Remove +
                    the vendor/station/offerings picker live in the dock now (§1.4). */}
              </div>
            );
          })}

          {/* Wayfinding signs — rotatable arrow + label (Restrooms, Parking…) */}
          {signs.map((s) => (
            <div
              key={s.sign_id}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${s.x_pos}%`, top: `${s.y_pos}%` }}
            >
              <button
                type="button"
                onPointerDown={onSignPointerDown(s.sign_id)}
                aria-label={`${s.label} sign — tap to edit, drag to move`}
                className={`flex select-none items-center gap-1 rounded-full border bg-cream px-2 py-1 text-[10px] font-semibold text-mulberry shadow-sm ${
                  selMarker?.kind === 'sign' && selMarker.id === s.sign_id
                    ? 'border-mulberry ring-2 ring-mulberry/30'
                    : dragId === `__sign_${s.sign_id}__`
                      ? 'border-mulberry cursor-grabbing'
                      : 'border-mulberry/40 cursor-grab'
                }`}
              >
                <Navigation
                  className="h-3 w-3"
                  style={{ transform: `rotate(${s.rotation_deg}deg)` }}
                />
                {s.label}
              </button>
              {/* Ambient rotate + × and the double-click window.prompt rename are
                  deleted — inline rename, 45° rotate cluster + Remove live in the
                  dock now (§1.4 / §2). */}
            </div>
          ))}

          {tables.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              {(() => {
                const draftable = guests.filter(
                  (g) => g.rsvp_status !== 'declined' && g.role !== 'bride' && g.role !== 'groom',
                ).length;
                // §7 — blueprint-styled starter card: a faint dashed room + ghost
                // table behind three check-off steps (no new actions; each ticks
                // as its state lands). Gold transfers HERE (the command-bar Auto
                // is disabled-with-reason on an empty floor).
                const Step = ({ done, num, label, hint, onClick, gold, disabled }: {
                  done: boolean; num: number; label: string; hint?: string;
                  onClick?: () => void; gold?: boolean; disabled?: boolean;
                }) => (
                  <button
                    type="button"
                    onClick={onClick}
                    disabled={disabled}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      gold
                        ? 'border-mulberry/40 bg-mulberry/[0.06] hover:border-mulberry'
                        : 'border-ink/12 hover:border-terracotta/50 hover:bg-ink/[0.02]'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold ${
                        done ? 'bg-success-100 text-success-700' : gold ? 'bg-mulberry text-cream' : 'bg-ink/8 text-ink/60'
                      }`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : num}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm font-medium ${gold ? 'text-mulberry' : 'text-ink'}`}>{label}</span>
                      {hint ? <span className="block text-[11px] text-ink/50">{hint}</span> : null}
                    </span>
                  </button>
                );
                return (
                  <div className="pointer-events-auto w-full max-w-sm rounded-2xl border-2 border-dashed border-ink/15 bg-cream/95 p-5 shadow-sm">
                    <div aria-hidden className="mx-auto mb-3 flex h-16 items-center justify-center rounded-lg border border-dashed border-ink/20 bg-ink/[0.02]">
                      <span className="h-8 w-8 rounded-full border border-dashed border-ink/25" />
                    </div>
                    <h3 className="text-center text-base font-semibold text-ink">Lay out your floor</h3>
                    <p className="mt-1 mb-3 text-center text-xs text-ink/55">Three steps — we do the heavy lifting.</p>
                    <div className="flex flex-col gap-2">
                      <Step num={1} done={venueScaled} label="Set room size" hint={venueScaled ? `${venue.width}×${venue.length} m` : 'Match your reception footprint'} onClick={() => setShowRoomPanel(true)} disabled={!canEdit} />
                      <Step num={2} done={false} label="Add your first table" hint="Pick from the 13-type catalog" onClick={() => { selectPanelTab('tables'); setShowAddTable(true); if (isNarrow) setDrawerSnap('half'); }} disabled={!canEdit} />
                      <Step num={3} done={false} gold label="Build my seating draft" hint={draftable > 0 ? `Seat your ${draftable} guest${draftable === 1 ? '' : 's'} by role` : 'Add guests first'} onClick={buildDraft} disabled={!canEdit || isPending || draftable === 0} />
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : null}

          {tables.map((t, i) => {
            const pos = positions[t.table_id] ?? defaultGrid(i, tables.length, !venueScaled);
            const shape = shapeHintFor(t.table_type);
            // Linked serpentine → even chair spacing (chairs flow continuously
            // across a junction), matching the 3D lab. Non-serpentine shapes
            // ignore the flag.
            const geo = tableGeometry(shape, t.capacity, t.link_group_id != null);
            const rectish = shape === 'long_banquet' || shape === 'family_head';
            const occ = occupantsFor(t);
            const filled = occ.filter(Boolean).length;
            const halo = dominantColor(occ, colorFor);
            const highlighted =
              highlightId === t.table_id ||
              (highlightGroupId != null && t.link_group_id === highlightGroupId);
            // The whole linked unit drags as one: treat every member of the
            // dragged unit as "dragging" so none of them eases (tails) behind.
            const dragging =
              dragId === t.table_id ||
              (dragGroupId != null && t.link_group_id === dragGroupId);
            // Snap-back drop rule (owner 2026-07-17): `snappingBack` = this table
            // (or its unit) is mid-return after an invalid drop → give it the kit-
            // ease bounce (instant under reduced motion). `showInvalidRing` = it's
            // being dragged over an oracle-rejected pose → warm-red the ring so the
            // refusal is legible BEFORE release.
            const snappingBack = snapBackIds.has(t.table_id);
            const showInvalidRing = dragging && dragInvalid;
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
            // to the room. GUN B (Sync verdict 2026-07-16): metric on BOTH boards
            // — the free board now scales against the 20×30 box exactly like a
            // sized room, so 2D matches what 3D always showed. (1 only at the
            // canvasW === 0 first paint.)
            const tableScale = metricPpm
              ? (TABLE_FOOTPRINT_M[t.table_type] * metricPpm) /
                (detail ? geo.box.w : geo.hub.w + 12)
              : 1;

            return (
              <div
                key={t.table_id}
                // Bounce when this table becomes the selected one (tap → popup).
                // `.sn-bounce` animates the standalone `scale` property, which
                // composes with the inline translate/scale transform below.
                className={`absolute${highlighted ? ' sn-bounce' : ''}`}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  width: detail ? geo.box.w : geo.hub.w + 12,
                  height: detail ? geo.box.h : geo.hub.h + 12,
                  transform: `translate(-50%, -50%) scale(${tableScale})`,
                  transition: dragging
                    ? 'none'
                    : snappingBack
                      ? reducedMotion
                        ? 'none'
                        : 'left 280ms cubic-bezier(0.2,0.7,0.2,1), top 280ms cubic-bezier(0.2,0.7,0.2,1)'
                      : 'left 140ms ease, top 140ms ease',
                  zIndex: dragging ? 30 : 20,
                }}
              >
                {/* warm-red invalid-drop ring — while this table (or its unit) is
                    dragged over an oracle-rejected pose, so the "no room here"
                    refusal is legible before release (owner 2026-07-17). */}
                {showInvalidRing ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                    style={{
                      width: geo.hub.w + 20,
                      height: geo.hub.h + 20,
                      borderColor: '#d9534f',
                      boxShadow: '0 0 0 3px rgba(217,83,79,0.18)',
                    }}
                  />
                ) : null}
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
                      className={`fill-cream ${highlighted ? 'stroke-terracotta' : 'stroke-ink/30'}`}
                      strokeWidth={1.25}
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
                  // §3 — chair ×/+ chips render ONLY in edit-chairs mode. The hit
                  // area is padded to ≥44px on-screen (independent of the chair's
                  // rendered size at DETAIL_AT zoom), matching the 3D lab grammar.
                  const editHit = Math.min(
                    96,
                    Math.max(CHAIR_PX, Math.round(44 / Math.max(0.5, zoomRef.current * tableScale))),
                  );
                  // A removed chair: nothing outside edit-chairs; a restore "+"
                  // ghost inside it so the couple can bring the chair back.
                  if (removed.has(i)) {
                    if (!(highlighted && editChairs)) return null;
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
                        className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-dashed border-ink/30 bg-cream/70 text-ink/45 transition hover:border-success-500 hover:text-success-600"
                        style={{ left: cx, top: cy, width: editHit, height: editHit }}
                      >
                        <Plus style={{ width: CHAIR_PX / 2, height: CHAIR_PX / 2 }} />
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
                          // Bounce this chair when its guest becomes the picked one.
                          className={`relative block h-full w-full${
                            pickedId === occupant.guest_id ? ' sn-bounce' : ''
                          }`}
                        >
                          {/* Blueprint seat slot (directive 2026-07-15) — a seat
                              footprint tinted in the guest's colour, NOT a chair
                              illustration. Identity + selection clarity stay on
                              the SeatBadge above it. */}
                          <span
                            aria-hidden
                            className="absolute inset-[10%] rounded-sm border"
                            style={{
                              borderColor: colorFor(occupant),
                              backgroundColor: colorFor(occupant),
                              opacity: 0.24,
                            }}
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
                          className={`flex h-full w-full items-center justify-center transition ${
                            pickedId || pickedGroupId
                              ? 'text-terracotta hover:text-terracotta-600'
                              : 'text-ink/35 hover:text-ink/55'
                          }`}
                        >
                          {/* Blueprint empty-seat slot — a footprint outline, not
                              a chair. `border-current` inherits the pick/idle
                              colour so the affordance stays obvious. */}
                          <span className="block h-[70%] w-[70%] rounded-sm border border-current" />
                        </button>
                      )}
                      {/* §3 — delete this chair. ONLY in edit-chairs mode now (no
                          longer a default-state scatter). Padded ≥44px hit area,
                          centered over the empty seat. */}
                      {!occupant && highlighted && editChairs && !pickedId && !pickedGroupId ? (
                        <button
                          type="button"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            toggleSeat(t.table_id, i, true);
                          }}
                          aria-label={`Delete seat ${i + 1}`}
                          title="Delete this chair"
                          className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-ink/15 bg-cream/80 text-ink/45 shadow-sm transition hover:border-danger-400 hover:text-danger-600"
                          style={{ width: editHit, height: editHit }}
                        >
                          <X style={{ width: CHAIR_PX / 2.5, height: CHAIR_PX / 2.5 }} />
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
                    <span className="font-mono text-sm font-semibold text-ink">{num || '·'}</span>
                    <span className="font-mono text-[8px] font-medium uppercase tracking-wide text-ink/45">
                      {filled}/{effCap}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onPointerDown={onHubPointerDown(t)}
                    aria-label={`${t.table_label} — drag to move`}
                    // Blueprint: hairline footprint (directive) — border-2 → border.
                    className={`absolute left-1/2 top-1/2 flex select-none flex-col items-center justify-center border bg-cream text-center shadow-sm transition ${
                      rot ? '' : '-translate-x-1/2 -translate-y-1/2'
                    } ${highlighted ? 'border-terracotta' : 'border-ink/30'} ${
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
                      <span className="font-mono text-sm font-semibold text-ink">{num || '·'}</span>
                      <span className="font-mono text-[8px] font-medium uppercase tracking-wide text-ink/45">
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

          {/* §3 — edit-chairs mode tints the canvas so the surgical chair-edit
              state reads as a distinct mode (the ×/+ chips render only now). */}
          {editChairs && highlightId ? (
            <div aria-hidden className="pointer-events-none absolute inset-0 z-[12] bg-mulberry/[0.06]" />
          ) : null}

          {/* Feature B — adaptive scale bar. Fixed to the canvas (not the
              pan/zoom world layer) at the room's default overview px-per-metre,
              so big rooms stay legible. */}
          {scaleBar ? (
            // §5.4 — the passive scale bar is now the spatial doorway to the
            // room-size popover (same home as Arrange → Room size & scale).
            <button
              type="button"
              onClick={() => setShowRoomPanel(true)}
              disabled={!canEdit}
              aria-label="Room size & scale"
              title="Room size & scale"
              className="absolute bottom-[64px] left-3 z-20 flex flex-col items-start gap-0.5 rounded px-1 hover:bg-cream/60 disabled:cursor-default lg:bottom-3"
            >
              <span className="rounded bg-cream/80 px-1 font-mono text-[9px] font-medium tabular-nums text-ink/60">
                {scaleBar.metres} m
              </span>
              <div
                className="h-1.5 border-x-2 border-b-2 border-ink/45"
                style={{ width: `${scaleBar.px}px` }}
              />
            </button>
          ) : null}

          {/* zoom controls — §5.9: Fit first/largest, every target ≥44px. */}
          <div className="absolute bottom-[64px] right-3 z-20 flex flex-col overflow-hidden rounded-lg border border-ink/15 bg-cream/90 shadow-sm backdrop-blur-sm lg:bottom-3">
            <button
              type="button"
              onClick={fitView}
              aria-label="Fit all tables in view"
              title="Fit"
              className="flex h-11 w-11 items-center justify-center text-ink/70 hover:bg-ink/5"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => zoomAround(1.25)}
              aria-label="Zoom in"
              className="flex h-11 w-11 items-center justify-center border-t border-ink/10 text-ink/70 hover:bg-ink/5"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => zoomAround(0.8)}
              aria-label="Zoom out"
              className="flex h-11 w-11 items-center justify-center border-t border-ink/10 text-ink/70 hover:bg-ink/5"
            >
              <Minus className="h-4 w-4" />
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

          {/* On-object chrome for the selected table (verdict §1 / §2): ONLY the
              rotate handle survives on-canvas — the anchored popover + its POP_H
              flip heuristic are DELETED (their verbs live in the Context Dock,
              rendered at the canvas bottom-center below). A ghost footprint shows
              while the shape picker previews a candidate type (§4). */}
          {(() => {
            const st = highlightId ? tables.find((t) => t.table_id === highlightId) : null;
            if (!st) return null;
            const rect = canvasRef.current?.getBoundingClientRect();
            const pos = positions[st.table_id];
            if (!rect || !pos) return null;
            const z = zoomRef.current;
            const cx = (pos.x / 100) * rect.width * z + panRef.current.x;
            const cy = (pos.y / 100) * rect.height * z + panRef.current.y;
            const geo = tableGeometry(shapeHintFor(st.table_type), st.capacity);
            const tScale = pxPerMeter ? (TABLE_FOOTPRINT_M[st.table_type] * pxPerMeter) / geo.box.w : 1;
            const halfH = (geo.box.h / 2) * tScale * z;
            const left = Math.max(10, Math.min(rect.width - 10, cx));
            // §2 — the rotate handle's canonical home is 12 o'clock on the object
            // ("opposite the popover" dies with the popover).
            const handleTop = cy - halfH - 24;
            // §4 — ghost-preview the candidate footprint on canvas while the shape
            // picker stages a change (before Apply).
            const previewNode =
              previewType && previewType !== st.table_type
                ? (() => {
                    const pShape = shapeHintFor(previewType);
                    const pGeo = tableGeometry(pShape, effectiveCapacity(st.capacity, st.removed_seats));
                    const pScale = pxPerMeter
                      ? (TABLE_FOOTPRINT_M[previewType] * pxPerMeter) / pGeo.box.w
                      : 1;
                    return (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-dashed border-terracotta/70 bg-terracotta/[0.06]"
                        style={{
                          left,
                          top: cy,
                          width: pGeo.box.w * pScale * z,
                          height: pGeo.box.h * pScale * z,
                          borderRadius: pShape === 'round' ? '9999px' : 12,
                        }}
                      />
                    );
                  })()
                : null;
            if (isPhone || !canEdit) return previewNode;
            return (
              <>
                {previewNode}
                <button
                  type="button"
                  aria-label="Rotate table — drag in a circle (hold Shift for 1° steps)"
                  title="Drag to rotate · Shift = 1°"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    const members = groupMemberIds(st.table_id);
                    handleRotRef.current = {
                      tableId: st.table_id,
                      cx: rect.left + cx,
                      cy: rect.top + cy,
                      startAngle: angleDeg(rect.left + cx, rect.top + cy, e.clientX, e.clientY),
                      startRot: rotationOf(st),
                      latest: rotationOf(st),
                      members,
                      snap: members.length > 1 ? groupSnap(members, rect) : null,
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
                      if (h.snap) {
                        applyGroupRotation(h.snap, next - h.startRot);
                      } else {
                        setRotById((m) => ({ ...m, [h.tableId]: next }));
                      }
                    }
                  }}
                  onPointerUp={(e) => {
                    const h = handleRotRef.current;
                    handleRotRef.current = null;
                    if (h && h.latest !== h.startRot) {
                      if (h.snap) {
                        if (groupRotationBlocked(h.snap, h.latest - h.startRot)) {
                          applyGroupRotation(h.snap, 0);
                          setNotice('No room to rotate this linked group there — move it to more open space first.');
                        } else {
                          const { nextPos, nextRot } = applyGroupRotation(h.snap, h.latest - h.startRot);
                          persistGroupTransform(nextPos, nextRot);
                        }
                      } else {
                        commitRotation(h.tableId, h.latest);
                      }
                    }
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
              </>
            );
          })()}

        </div>
        </>
        ) : (
          <div className="absolute inset-0 space-y-2 overflow-y-auto p-3">
            {tables.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ink/20 bg-cream p-8 text-center text-sm text-ink/50">
                No tables yet — tap “Build my seating” on the Map, or add one from the panel above.
              </div>
            ) : (
              <ul className="space-y-2">
                {displayUnits.map((u) => {
                  const occ = unitOcc(u);
                  const seated = occ
                    .filter((g): g is SeatingGuest => g !== null)
                    .sort((a, b) => a.name.localeCompare(b.name));
                  const cap = u.capacity;
                  const full = seated.length >= cap;
                  const freeSeat = firstFreeSeat(u);
                  const expanded = expandedCards.has(u.key);
                  const halo = dominantColor(occ, colorFor);
                  const open = cap - seated.length;
                  return (
                    <li key={u.key} className="overflow-hidden rounded-xl border border-ink/10 bg-cream">
                      <div className="flex items-center gap-2 p-3">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: halo ?? NEUTRAL }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            pickedGroupId
                              ? seatGroupAt(u.lead.table_id)
                              : setExpandedCards((s) => {
                                  const n = new Set(s);
                                  n.has(u.key) ? n.delete(u.key) : n.add(u.key);
                                  return n;
                                })
                          }
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">
                              {u.isLinked ? (
                                <span title="Grouped (legacy)" className="mr-1 inline-flex">
                                  <Link2 className="inline h-3 w-3 text-mulberry/70" aria-label="Grouped (legacy)" />
                                </span>
                              ) : null}
                              {u.label}
                            </span>
                            <span className="block text-[11px] text-ink/55">
                              {u.members.length > 1
                                ? `${u.members.length} tables joined`
                                : TABLE_TYPE_LABEL[u.lead.table_type]}
                            </span>
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              full ? 'bg-success-100 text-success-700' : 'bg-ink/5 text-ink/55'
                            }`}
                          >
                            {seated.length}/{cap}
                          </span>
                          <ChevronDown className={`h-4 w-4 text-ink/40 transition ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => requestRemoveUnit(u)}
                          aria-label={`Delete ${u.label}`}
                          className="rounded p-1 text-ink/30 hover:bg-danger-50 hover:text-danger-600"
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
                            onClick={() => freeSeat && place(freeSeat.tableId, freeSeat.seat)}
                            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-terracotta px-2.5 py-1 text-xs font-medium text-cream hover:bg-terracotta-600"
                          >
                            <Armchair className="h-3.5 w-3.5" /> Seat here
                          </button>
                        ) : null}
                        {pickedGroupId && !full ? (
                          <button
                            type="button"
                            onClick={() => seatGroupAt(u.lead.table_id)}
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
                                {g.rsvp_status !== 'attending' ? (
                                  <span
                                    title="Held — this guest hasn't confirmed yet"
                                    className="ml-1.5 rounded-full bg-warn-100 px-1.5 py-0.5 text-[10px] font-semibold text-warn-800"
                                  >
                                    held
                                  </span>
                                ) : null}
                                {g.meal_preference && g.meal_preference !== 'no_preference' ? (
                                  <span className="ml-1.5 text-[10px] text-ink/45">· {g.meal_preference}</span>
                                ) : null}
                              </span>
                              {g.dietary_restrictions ? (
                                <span
                                  title={`Dietary: ${g.dietary_restrictions}`}
                                  className="shrink-0 rounded-full bg-warn-100 px-1.5 py-0.5 text-[10px] font-semibold text-warn-800"
                                >
                                  diet
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => toggleLock(g)}
                                disabled={!canEdit}
                                aria-label={g.seat_locked ? `Unlock ${g.name}'s seat` : `Lock ${g.name}'s seat`}
                                title={g.seat_locked ? 'Locked — “Fill around locked” keeps this seat' : 'Lock this seat'}
                                className={`inline-flex items-center rounded-md border px-1.5 py-1 text-[11px] disabled:opacity-30 ${
                                  g.seat_locked
                                    ? 'border-mulberry/40 bg-mulberry/10 text-mulberry'
                                    : 'border-ink/15 text-ink/45 hover:border-mulberry/40 hover:text-mulberry'
                                }`}
                              >
                                {g.seat_locked ? (
                                  <Lock className="h-3.5 w-3.5" />
                                ) : (
                                  <LockOpen className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => unseat(g.guest_id)}
                                aria-label={`Unseat ${g.name}`}
                                className="inline-flex items-center gap-1 rounded-md border border-ink/15 px-2 py-1 text-[11px] text-ink/70 hover:border-danger-400 hover:text-danger-600"
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
      </FrameBody>

      {/* ═══════════ Mobile bottom drawer (verdict §7) — replaces the stacked
          panel on <lg screens; 3 snap points over a full-height canvas. Yields
          to the <768px per-table sheet (drawer never stacks with it). ═══════════ */}
      {isNarrow ? (
        <div
          ref={drawerRef}
          className="fixed inset-x-0 bottom-0 z-40 flex flex-col overflow-hidden rounded-t-2xl border-t border-ink/15 bg-cream shadow-[0_-8px_30px_rgba(0,0,0,0.14)] motion-safe:transition-[height] motion-safe:duration-200"
          style={{ height: drawerHeight }}
        >
          <button
            type="button"
            onPointerDown={onDrawerHandleDown}
            onPointerMove={onDrawerHandleMove}
            onPointerUp={onDrawerHandleUp}
            onPointerCancel={onDrawerHandleUp}
            aria-label={`Seat-plan panel — ${effectiveSnap === 'peek' ? 'tap or drag up to open' : 'drag to resize'}`}
            className="flex shrink-0 touch-none cursor-grab flex-col items-center justify-center gap-1 active:cursor-grabbing"
            style={{ height: DRAWER_PEEK_PX }}
          >
            <span aria-hidden className="h-1 w-9 rounded-full bg-ink/25" />
            <span className="font-mono text-[11px] text-ink/60">
              {toSeatReserved} to seat · {tables.length} tables
            </span>
          </button>
          <div className="min-h-0 flex-1 overflow-hidden">{panelBody}</div>
        </div>
      ) : null}

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
                <span className="font-semibold text-ink/85">3 · Guests</span> — every unseated guest who
                hasn&rsquo;t declined is seated by priority tier, highest priority nearest the stage;
                pending replies get a <span className="font-semibold">held</span> seat you can confirm
                later. No one you&rsquo;ve placed is moved; sweetheart tables are skipped.
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

      {/* Fill-around-locked confirm (smart seat-plan Phase 4) — it CLEARS unlocked
          seats and re-seats around the locked ones, so it asks first. */}
      {confirmFill ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4" onClick={() => setConfirmFill(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-ink/10 bg-cream p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center gap-2">
              <Lock className="h-5 w-5 text-mulberry" />
              <h3 className="text-lg font-semibold text-ink">Fill around locked seats</h3>
            </div>
            <p className="text-sm text-ink/70">
              Your <span className="font-semibold">{lockedCount}</span> locked seat
              {lockedCount === 1 ? '' : 's'} stay exactly where they are. Everyone else is{' '}
              <span className="font-semibold">un-seated and re-seated</span> around them, by priority
              {keepApart.length > 0 ? ' and your keep-apart rules' : ''}.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmFill(false)}
                className="rounded-lg border border-ink/15 bg-cream px-3 py-1.5 text-sm text-ink hover:bg-ink/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runFillAroundLocked}
                className="inline-flex items-center gap-1.5 rounded-lg bg-mulberry px-3 py-1.5 text-sm font-semibold text-cream hover:bg-mulberry-600"
              >
                <Lock className="h-4 w-4" /> Fill the rest
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
            {(() => {
              const seatedTotal = confirmDelete.members.reduce((n, m) => n + seatedAt(m.table_id), 0);
              const joined = confirmDelete.members.length > 1;
              return (
                <>
                  <div className="mb-2 flex items-center gap-2">
                    <Trash2 className="h-5 w-5 text-danger-600" />
                    <h3 className="text-lg font-semibold text-ink">Delete {confirmDelete.label}?</h3>
                  </div>
                  <p className="text-sm text-ink/70">
                    <span className="font-semibold">{seatedTotal}</span> seated{' '}
                    {seatedTotal === 1 ? 'guest' : 'guests'} will go back to{' '}
                    <span className="font-semibold">Unseated</span>, and the{' '}
                    {joined ? `${confirmDelete.members.length} joined tables are` : 'table is'} removed from
                    the plan.
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
                        confirmDelete.members.forEach((m) => removeTable(m.table_id));
                        setConfirmDelete(null);
                      }}
                      className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-danger-600 px-3 text-sm font-semibold text-cream hover:bg-danger-700 md:h-auto md:flex-none md:py-1.5"
                    >
                      <Trash2 className="h-4 w-4" /> {joined ? 'Delete unit' : 'Delete table'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}

    </SeatingFrame>
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

// Two-guest picker for adding a keep-apart rule (smart seat-plan Phase 3). Native
// <select>s so it works on touch + desktop + keyboard alike. Owns its own draft
// selection; commits via onAdd then resets.
function KeepApartAdder({
  guests,
  onAdd,
}: {
  guests: SeatingGuest[];
  onAdd: (a: string, b: string) => void;
}) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const sorted = useMemo(() => [...guests].sort((x, y) => x.name.localeCompare(y.name)), [guests]);
  const selCls = 'min-w-0 flex-1 rounded-lg border border-ink/15 bg-cream px-2 py-1.5 text-sm text-ink';
  return (
    <div className="space-y-1.5 rounded-lg border border-dashed border-ink/15 p-2">
      <select aria-label="First guest" value={a} onChange={(e) => setA(e.target.value)} className={selCls}>
        <option value="">Guest…</option>
        {sorted.map((g) => (
          <option key={g.guest_id} value={g.guest_id}>
            {g.name}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-[11px] text-ink/45">can&apos;t sit with</span>
        <select aria-label="Second guest" value={b} onChange={(e) => setB(e.target.value)} className={selCls}>
          <option value="">Guest…</option>
          {sorted.map((g) => (
            <option key={g.guest_id} value={g.guest_id}>
              {g.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!a || !b || a === b}
          onClick={() => {
            onAdd(a, b);
            setA('');
            setB('');
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-mulberry px-2.5 py-1.5 text-xs font-medium text-cream hover:bg-mulberry-600 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
    </div>
  );
}

// A button that fires once on tap/keyboard and repeats while held (verdict §2 —
// the dock rotate cluster's press-and-hold). A quick tap fires exactly once; a
// hold accelerates; the trailing synthetic click after a hold is suppressed.
function HoldButton({
  onFire,
  disabled,
  ariaLabel,
  className,
  children,
}: {
  onFire: () => void;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeated = useRef(false);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const start = () => {
    if (disabled) return;
    let delay = 400;
    const tick = () => {
      repeated.current = true;
      onFire();
      delay = Math.max(70, delay * 0.82);
      timer.current = setTimeout(tick, delay);
    };
    timer.current = setTimeout(tick, delay);
  };
  useEffect(() => stop, []);
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onPointerDown={() => start()}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onClick={() => {
        if (repeated.current) {
          repeated.current = false;
          return; // a hold already fired the repeats
        }
        onFire();
      }}
      className={className}
    >
      {children}
    </button>
  );
}

function BoothIcon({ type, className }: { type: BoothType; className?: string }) {
  const Icon =
    type === 'unassigned'
      ? HelpCircle
      : type === 'photo_booth'
        ? Camera
        : type === 'mobile_bar'
          ? Martini
          : type === 'dessert_station'
            ? CakeSlice
            : type === 'gift_table'
              ? Gift
              : type === 'souvenir_table'
                ? Package
                : type === 'registration_desk'
                  ? ClipboardList
                  : type === 'band'
                    ? Music
                    : type === 'live_cooking'
                      ? ChefHat
                      : type === 'live_performance'
                        ? Mic
                        : Store;
  return <Icon className={className} />;
}

// A metres number input for the stage / dance-floor dimensions in the room
// panel. Shows one decimal; commits the typed value on change.
function MetreSizeField({
  label,
  metres,
  onMetres,
}: {
  label: string;
  metres: number;
  onMetres: (m: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">{label}</span>
      <input
        type="number"
        min={0.5}
        max={200}
        step={0.5}
        value={Math.round(metres * 10) / 10}
        onChange={(e) => {
          const m = Number(e.target.value);
          if (Number.isFinite(m) && m > 0) onMetres(m);
        }}
        className="w-24 rounded-lg border border-ink/15 bg-cream px-2 py-1.5 text-sm outline-none focus:border-terracotta"
      />
    </label>
  );
}


function MemberRow({
  guest,
  color,
  picked,
  tableLabel,
  onPick,
  onCyclePriority,
  roleSet,
}: {
  guest: SeatingGuest;
  color: string;
  picked: boolean;
  tableLabel: string | null;
  onPick: () => void;
  onCyclePriority: () => void;
  roleSet: RoleSet;
}) {
  const tier = guestTier(guest.role, guest.group_category, guest.seating_priority, roleSet);
  const overridden = guest.seating_priority !== null;
  return (
    // Virtualization (verdict §3): `content-visibility:auto` skips layout/paint
    // for off-screen rows — the dependency-free fix for the 250-pax list. The
    // intrinsic size keeps the scrollbar honest before a row is rendered.
    <li className="flex items-center gap-1 [contain-intrinsic-size:auto_34px] [content-visibility:auto]">
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
        title={`Seating priority: ${roleSet.tierLabels[tier]}${overridden ? ' (set by you — tap to cycle, back to auto after P4)' : ' (from their role — tap to override)'}`}
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
  onUnseat,
  roleSet,
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
  // Verdict §1.2 — seated rows gain a per-row Unseat for parity with List rows.
  onUnseat?: (guestId: string) => void;
  roleSet: RoleSet;
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
  // Count of seatable (not-declined) unseated guests in a tier — matches the
  // seatRoleAtTable action so the "Seat role tier here" button isn't disabled
  // when a tier's only unseated members are pending/maybe (held).
  const tierCount = (tier: 1 | 2 | 3 | 4) =>
    guests.filter(
      (g) =>
        g.rsvp_status !== 'declined' &&
        !g.seated_table_id &&
        g.role !== 'bride' &&
        g.role !== 'groom' &&
        roleTier(g.role, g.group_category, roleSet) === tier,
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
        <span className={`shrink-0 text-[11px] ${free === 0 ? 'text-danger-600' : 'text-ink/55'}`}>
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
                <li key={g.guest_id} className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={here || !canSeat}
                    onClick={() => movable && canSeat && onSeatGuest(g.guest_id)}
                    className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1.5 text-left ${
                      here ? 'opacity-60' : canSeat ? 'hover:bg-ink/[0.04]' : 'opacity-40'
                    }`}
                  >
                    <ChairAvatar guest={g} color={colorFor(g)} size={24} />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{g.name}</span>
                    {g.dietary_restrictions ? (
                      <span
                        title={`Dietary: ${g.dietary_restrictions}`}
                        className="shrink-0 rounded-full bg-warn-100 px-1.5 py-0.5 text-[10px] font-semibold text-warn-800"
                      >
                        diet
                      </span>
                    ) : null}
                    {here ? (
                      <span className="shrink-0 rounded-full bg-success-100 px-1.5 py-0.5 text-[10px] text-success-700">
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
                  {here && onUnseat ? (
                    <button
                      type="button"
                      onClick={() => onUnseat(g.guest_id)}
                      aria-label={`Unseat ${g.name}`}
                      title="Unseat"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ink/15 text-ink/55 hover:border-danger-400 hover:text-danger-600"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
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
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{roleSet.tierLabels[tier]}</span>
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
            : 'Seats every unseated guest of that role tier here (pending replies get a held seat).'}
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

function AddTablePanel({
  eventId,
  lockId,
  chineseTradition = false,
  defaultLabel,
  computeSpawn,
  onTableFourWarning,
  onDone,
  onLockLost,
}: {
  eventId: string;
  lockId: string | null;
  // Chinese (Tsinoy) tradition avoids table number 4 (四 ≈ 死). ADVISORY ONLY:
  // when true and the entered label is a ones-digit-4 number, we surface a gentle
  // notice (via onTableFourWarning) but still create the table.
  chineseTradition?: boolean;
  // Auto-incrementing "Table N" default (next free number over the existing
  // labels) so rapid adds increment instead of every new table landing on the
  // same name. The couple can still overwrite it with a custom name.
  defaultLabel: string;
  // Oracle-valid spawn (world %) for the chosen type/capacity, or null on the
  // free board. Persisted so the 3D view reads the identical spot (CREATE parity).
  computeSpawn?: (type: TableType, capacity: number) => { x: number; y: number } | null;
  onTableFourWarning?: () => void;
  onDone: () => void;
  // Called when createTable reports the editor lock was lost (peer takeover) so
  // the parent drops to view-only + notices, instead of an unhandled throw.
  onLockLost: (err: unknown) => boolean;
}) {
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
        fd.set('lock_id', lockId ?? '');
        // Oracle-valid spawn (sized room) so the new table persists a
        // non-overlapping, off-stage home the 3D view reads identically.
        const spawn = computeSpawn?.(tableType, capacity) ?? null;
        if (spawn) {
          fd.set('x_pos', String(spawn.x));
          fd.set('y_pos', String(spawn.y));
        }
        // Advisory only (never blocks the create): a Chinese-wedding couple adding
        // a ones-digit-4 table gets a gentle heads-up; the table is still created.
        const label = fd.get('table_label');
        if (chineseTradition && typeof label === 'string' && tableNumberEndsInFour(label.trim())) {
          onTableFourWarning?.();
        }
        startTransition(async () => {
          try {
            await createTable(fd);
          } catch (err) {
            if (onLockLost(err)) return; // handled — dropped to view-only
            throw err;
          }
          onDone();
        });
      }}
      className="space-y-2 rounded-xl border border-ink/10 bg-ink/[0.03] p-3"
    >
      <input
        name="table_label"
        required
        maxLength={64}
        defaultValue={defaultLabel}
        placeholder="Table name · e.g. Sponsors 1"
        className="w-full rounded-lg border border-ink/15 bg-cream px-2 py-1.5 text-sm outline-none focus:border-terracotta"
      />
      {/* §4 — the SAME visual shape picker as the dock's Change-shape, so shape
          choice looks identical at create time and change time. */}
      <input type="hidden" name="table_type" value={tableType} />
      <ShapePicker
        value={tableType}
        mode="create"
        onApply={(t) => {
          setTableType(t);
          setCapacity(seatsFor(t)); // reset to the new type's seat count
        }}
      />
      <div className="flex items-center gap-2">
        <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">Seats</label>
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

// The booth type-picker, now the selected-booth dock's attached panel (§1.4).
// Booked-vendor rows + Station rows + the 280-char Offerings copy — the same
// content the old on-canvas popover held, extracted so the dock reuses it.
function BoothPickerPanel({
  booth,
  booths,
  bookedVendors,
  eventId,
  onSetVendor,
  onSetType,
  onSetOfferings,
}: {
  booth: FloorBoothRow;
  booths: FloorBoothRow[];
  bookedVendors: BoothVendorOption[];
  eventId: string;
  onSetVendor: (v: BoothVendorOption) => void;
  onSetType: (t: Exclude<BoothType, 'unassigned'>) => void;
  onSetOfferings: (v: string) => void;
}) {
  const placedVendorIds = new Set(
    booths.map((x) => x.event_vendor_id).filter((id): id is string => !!id),
  );
  const availableVendors = bookedVendors.filter(
    (v) => !placedVendorIds.has(v.vendor_id) || v.vendor_id === booth.event_vendor_id,
  );
  return (
    <div className="w-full overflow-hidden rounded-xl border border-ink/10 bg-cream p-1">
      <p className="px-3 pb-1 pt-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/45">
        Your booked vendors
      </p>
      {availableVendors.length === 0 ? (
        <div className="px-3 pb-2 pt-0.5 text-[11px] leading-snug text-ink/50">
          {bookedVendors.length === 0 ? (
            <>
              No finalized vendors yet —{' '}
              <a
                href={`/dashboard/${eventId}/vendors`}
                className="font-medium text-terracotta-700 underline hover:text-terracotta"
              >
                lock a vendor in Merkado
              </a>{' '}
              to place them here. Until then this slot shows Setnayan.
            </>
          ) : (
            'All your finalized vendors are already placed.'
          )}
        </div>
      ) : (
        availableVendors.map((v) => {
          const t = boothTypeForVendorCategory(v.category);
          const active = booth.event_vendor_id === v.vendor_id;
          return (
            <button
              key={v.vendor_id}
              type="button"
              onClick={() => onSetVendor(v)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-ink/[0.04] ${
                active ? 'text-terracotta-700' : 'text-ink'
              }`}
            >
              <BoothIcon type={t} className="h-4 w-4 shrink-0 text-terracotta-700" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{v.vendor_name}</span>
                <span className="block truncate text-[10px] text-ink/45">
                  {VENDOR_CATEGORY_LABEL[v.category]}
                </span>
              </span>
            </button>
          );
        })
      )}
      <div className="mt-1 border-t border-ink/10 pt-1">
        <p className="px-3 pb-1 pt-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/45">
          Stations
        </p>
        {STATION_BOOTHS.map((c) => (
          <button
            key={c.type}
            type="button"
            onClick={() => onSetType(c.type)}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-ink/[0.04] ${
              booth.booth_type === c.type && !booth.event_vendor_id ? 'text-terracotta-700' : 'text-ink'
            }`}
          >
            <BoothIcon type={c.type} className="h-4 w-4 text-terracotta-700" />
            {c.label}
          </button>
        ))}
      </div>
      <div className="mt-1 border-t border-ink/10 px-2 pb-1.5 pt-2">
        <label
          htmlFor={`booth-offerings-${booth.booth_id}`}
          className="mb-1 block font-mono text-[9px] uppercase tracking-[0.15em] text-ink/45"
        >
          Offerings
        </label>
        <textarea
          id={`booth-offerings-${booth.booth_id}`}
          value={booth.offerings ?? ''}
          onChange={(e) => onSetOfferings(e.target.value)}
          maxLength={280}
          rows={2}
          placeholder="e.g. Espresso martinis & mocktails"
          className="w-full resize-none rounded-lg border border-ink/15 bg-white/80 px-2 py-1.5 text-sm text-ink placeholder:text-ink/35 focus:border-terracotta focus:outline-none"
        />
        <div className="mt-0.5 flex items-center justify-between">
          <span className="text-[10px] text-ink/40">Guests see this on the 3D venue walk.</span>
          <span className="text-[10px] tabular-nums text-ink/40">
            {(booth.offerings ?? '').length}/280
          </span>
        </div>
      </div>
    </div>
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
