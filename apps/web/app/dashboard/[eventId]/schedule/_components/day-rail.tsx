'use client';

/**
 * THE EVENT DAY, AS A TIME RAIL — Schedule rebuild slice 1 (2026-09-27).
 *
 * Build spec: `prototypes/schedule_redesign_2026-09-25.html`, approved in
 * DECISION_LOG "SCHEDULE REDESIGN PROTOTYPE APPROVED" (owner: *"schedule is okay
 * for now"*). What it replaces: a paragraph, eight bordered cards and every
 * block fully expanded with its own Edit time / Assign / Show to guests / delete
 * ("SCHEDULE (event-day view) JOINS THE PAGE REDESIGN").
 *
 * ── WHAT THE COUPLE GETS ────────────────────────────────────────────────────
 *   · the day drawn as a rail — a moment's top is when it starts, its height is
 *     how long it runs;
 *   · tap a moment → the inspector (a side column on a wide screen, a panel
 *     from the bottom on a phone);
 *   · drag a moment to move it, drag its top or bottom edge to change its
 *     length — everything lands on five minutes, and the five-minute ticks are
 *     drawn ONLY while dragging;
 *   · tap an empty time to add a moment there;
 *   · the eye on each moment = shown to guests;
 *   · "Shift everything after" for a day running late;
 *   · suppliers' requests drawn as dashed ghosts where they asked, and one
 *     Requests inbox to approve or decline them.
 *
 * ── WHO MAY CHANGE IT ───────────────────────────────────────────────────────
 * Hosts, and a coordinator the hosts approved (`schedule: 'edit'`) — owner:
 * *"setting up the schedule can be done by hosts of the event and
 * coordinator(upon approval)"*. Everyone else reads. The role is resolved on the
 * server by the SAME rule the `event_schedule_blocks` write policies enforce
 * (`resolveBroadcastAuthority`: couple member, or a delegate holding schedule
 * 'edit' inside the access window), so a control shown here is a write the
 * database will accept. Every write goes through the EXISTING server actions in
 * `../actions.ts` — this file adds no route and no permission.
 *
 * ⚠ A FAILED WRITE IS SAID OUT LOUD. Moves are drawn optimistically; if the
 * action throws, the moment jumps back AND a line says the change did not save.
 * A rail that silently snaps back would read, to the couple, as the app
 * ignoring them — the failure-that-looks-like-success this repo keeps paying for.
 */

import { ExamplePreview } from '@/app/_components/states/empty-state';
import { SAMPLE_CHAPTERS } from '@/lib/empty-look-samples';
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { SCHEDULE_FOCUS_EVENT, takeQueuedScheduleFocus } from './schedule-focus';
import { SCHEDULE_CANVAS_STALE_EVENT, SCHEDULE_QUIET_FIELD, quietDayActions } from './schedule-live';
import { InSlot, pickDetailsPiece } from '../../launch/_components/details-piece';
import { CalendarClock, Check, Eye, EyeOff, MessageSquare, Mic, MoveVertical, Plus } from 'lucide-react';
import { useIsDesktop } from '@/lib/use-responsive';
import { formatCount } from '@/lib/format-number';
import { venueNowMs } from '@/lib/schedule';
import { fromDatetimeLocalValue } from '@/lib/schedule-datetime-local';
import {
  applyDrag,
  findGaps,
  formatClock,
  formatClockRange,
  formatDateHeading,
  formatDuration,
  formatHour,
  groupByWallDate,
  layoutLanes,
  railHours,
  sameSpan,
  snapMinutes,
  spanOf,
  toDatetimeLocal,
  wallDateKey,
  wallMinutes,
  type DragMode,
  type RailSpan,
} from '@/lib/schedule-rail';
import { Sheet } from '@/app/_components/sheet';
import type {
  DayActions,
  DayMoment,
  DayRequest,
  DayRole,
  DaySupplier,
  DayTemplate,
} from './day-types';
import { supplierOnItem } from './day-types';
import { DayActionsContext, PHASE_TINT, Eyebrow, PickMenu, Tip, ToolButton, toFormData } from './day-ui';
import { MomentInspector } from './moment-inspector';
import { UndoToastHost } from '../../guests/_components/undo-toast';
import { AddMomentSheet, RequestsSheet, ShiftSheet } from './day-sheets';
import { ScheduleAddPill, ScheduleSheet } from './schedule-sheet';
import type { RetimePatch } from '@/lib/schedule-ros';
import { StudioDay } from './studio-day';
import { useMaker } from '../../launch/_components/maker-context';
import { useChapters } from './chapters-context';
import { SwipeDeleteButton, SwipeToDelete, useSwipeReveal } from '@/app/_components/swipe-to-delete';
import { lockedShopOnMoments } from '@/lib/supplier-part-lock';
import { lockedLine } from '@/lib/supplier-schedule-marks';
import { TIME_TBA, chapterStage, chapterSuppliers, chapterWhere, gapWords, type Chapter } from '@/lib/schedule-chapters';
import { dayList } from '@/lib/day-list';
import { DayList } from './day-list';
import { EVERYONE, lensAllowed, type ViewLens } from '@/lib/schedule-view-as';
import { ViewAsBody, ViewAsMenu } from './schedule-view-as';

type SheetState =
  | { kind: 'add'; dateKey: string | null; startMin: number }
  | { kind: 'shift'; fromId: string | null }
  | { kind: 'requests' }
  | { kind: 'host' }
  | null;

type Lens = { kind: 'all' } | { kind: 'guest' } | { kind: 'vendor'; id: string };
/** The View as a Schedule OPENS on (owner 9 Nov, "Yes, theirs first"): a picked supplier's / picked client's Schedule tab
 *  opens on that supplier's part — `{ kind: 'vendor', id }` — and the menu still switches to Master and Guests. */
export type ScheduleInitialLens = Lens;
/** The vendor lens's honest empty line — never a silent fall back to Master. */
export function noMomentsForLine(name: string): string {
  return `No moments for ${name} yet`;
}

type DragState = {
  id: string;
  mode: DragMode;
  startY: number;
  dateKey: string;
  orig: { startMin: number; endMin: number };
  preview: { startMin: number; endMin: number };
  moved: boolean;
  hadEnd: boolean;
};

const COULD_NOT_SAVE = 'That change did not save. Check your connection and try again.';

export function ScheduleDay({
  eventId,
  eventType,
  eventDateKey,
  moments,
  requests,
  suppliers,
  role,
  canStage,
  rosEnabled,
  templates,
  isEventDay,
  daysToGo = null,
  emcee,
  hostPanel,
  actions,
  inspectorSlot = null,
  frame = 'page',
  toolsSlot = null,
  openRequests = false,
  initialLens,
  initialLensName = null,
}: {
  /** 👁 The lens the day opens on — 'all' (Master) everywhere unless a picked supplier/client tab names its supplier. */
  initialLens?: ScheduleInitialLens;
  /** The opening vendor lens's name, for when that supplier has no moment tagged yet (so it is not in `suppliers`). */
  initialLensName?: string | null;
  /** 📅 Open the supplier requests sheet with the page (Home's "N to approve", owner 2026-11-01) — only when there are any. */
  openRequests?: boolean;
  /**
   * 📅 Drawn as Suppliers › Booked › Schedule (owner 2026-10-31, live iPhone: *"so many upper space not used"* ·
   * *"the pop up. design template."*): the day's tools ride the page's one line (`toolsSlot`, beside Event Day ▾ and
   * Announce) instead of a row of their own, "+ Add a moment" is the pill in the thumb zone, and a tapped moment opens
   * in the Schedule's ONE pop-up at every width (`schedule-sheet.tsx`). `page`: the standalone page, as shipped.
   */
  frame?: 'page' | 'line';
  /** The id of the element the day's tools are drawn into (`frame="line"`, the Schedule page's one line); null: drawn in place. */
  toolsSlot?: string | null;
  /**
   * 🧩 Inside the Event Hub Maker (Details › Schedule, part 2b — DECISION_LOG "A
   * TOOL MOVED INTO THE MAKER IS REBUILT INTO THE THREE PARTS"): the id of the
   * Details right column's slot. The rail stays the picture; its inspector (the
   * picked moment's fields, or the day's glance) is drawn THERE at every width —
   * the same component, the same state — and the moment picked here is told to
   * the navigator. Null: the page's own side column and phone panel, as ever.
   */
  inspectorSlot?: string | null;
  /** The existing server actions in `../actions`, handed down by the page. */
  actions: DayActions;
  /** Whole days until the event, for the glance column; null past it or undated. */
  daysToGo?: number | null;
  eventId: string;
  eventType: string | null;
  /** events.event_date as "YYYY-MM-DD", or null when no date is set. */
  eventDateKey: string | null;
  moments: DayMoment[];
  requests: DayRequest[];
  suppliers: DaySupplier[];
  role: DayRole;
  /** The coordinator may stage a moment hidden from the couple. */
  canStage: boolean;
  /** The responsible-party + supplier-slice columns are live. */
  rosEnabled: boolean;
  templates: DayTemplate[];
  /** Inside the day-of window — draws Now, done and on-air marks. */
  isEventDay: boolean;
  /** The emcee-script tool (already a working client button). */
  emcee: ReactNode;
  /** The booked host's segments, questions and note box; null with no host. */
  hostPanel: ReactNode | null;
}) {
  const canEdit = role !== 'view';
  const booked = frame === 'line' && inspectorSlot === null;
  /* ⚡ IN THE MAKER EVERY EDIT IS QUIET (`schedule-live.ts`): written with no
     revalidate — so no whole render of the Maker comes back with it — shown on
     the rail at once, laid on the stage canvases, and a removed moment leaves
     the rail as soon as its delete lands. The standalone page is unchanged. */
  const live = inspectorSlot !== null;
  /* 🗓 The new Maker's Studio (`stagesStudio`, the one Maker since 2026-10-25): the day as the prototype's
     timeline (`studio-day.tsx`) in place of the rail — the same state, writes and sheets. */
  const studio = useMaker()?.stagesStudio === true && live;
  /* 📖 CHAPTERS (owner 2026-11-01, "CHAPTERS LIVE ON THE SCHEDULE PAGE"): on the Schedule page the rail's top-level
     blocks ARE the chapters — a tap opens the chapter's page, the add is "+ Add a chapter" (a name and a time), the
     time between chapters is said, a TBA chapter is listed under the rail, and one dated before the day lives in
     Planning Stage. Never in the Maker (`live`): Details › Schedule keeps its moment inspector, unchanged. */
  const chaptersApi = useChapters();
  const ch = live ? null : chaptersApi;
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  /* 👈 A moment's row swiped to Delete (owner 2026-11-03): its inspector opens at the warning. */
  const [askDelete, setAskDelete] = useState<{ id: string; n: number } | null>(null);
  /** ↩ A confirmed delete hides the moment for its Undo window; Undo (or a refusal) shows it again. Its own set, so a
   *  fresh server answer in the window (which clears `gone`) never brings it back early. */
  const [held, setHeld] = useState<ReadonlySet<string>>(() => new Set());
  const hideMoment = (id: string, hide: boolean) =>
    setHeld((g) => {
      const next = new Set(g);
      if (hide) next.add(id);
      else next.delete(id);
      return next;
    });
  /* ➕ Studio's "Add a moment": a moment added in place is on the timeline at once — no render of the Maker brings
     it (its write is quiet) — and cannot be edited until its add has landed (`pending`). */
  const [added, setAdded] = useState<readonly DayMoment[]>([]);
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const dayActions = useMemo(
    () => (live ? quietDayActions(actions, (id) => setGone((g) => new Set(g).add(id))) : actions),
    [actions, live],
  );
  const { bulkRetimeScheduleBlocks, loadScheduleTemplate, toggleBlockVisibility, updateScheduleBlock } =
    dayActions;
  const isDesktop = useIsDesktop();
  const hourPx = isDesktop ? 68 : 64;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  /* 👈 An ask belongs to the swipe that made it: once the moment closes, ⋯ opens it at its fields again. */
  useEffect(() => {
    if (selectedId === null) setAskDelete(null);
  }, [selectedId]);
  const [overrides, setOverrides] = useState<Record<string, Partial<DayMoment>>>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const [sheet, setSheet] = useState<SheetState>(openRequests && requests.length > 0 ? { kind: 'requests' } : null);
  const [lens, setLens] = useState<Lens>(initialLens ?? { kind: 'all' });
  /* 👁 VIEW AS on the Schedule page (Step 3c, `schedule-view-as.tsx`): a guest · a role · a supplier or crew · Suppliers
     by time, drawn in place of the rail. Only where the page drew chapters; the Maker keeps the shipped lens above. */
  const viewAs = ch?.viewAs ?? null;
  // 👤 On the chapters page the lens is the PAGE's (Event Day and a chapter's page share one View as, 2026-11-04).
  const [localLens, setLocalLens] = useState<ViewLens>(EVERYONE);
  const asLens = ch?.lens ?? localLens;
  const setAsLens = ch?.setLens ?? setLocalLens;
  // A Free event draws only the free views (Suppliers by time — owner 2026-11-02); `lensAllowed` is the one question.
  const viewingAs = viewAs !== null && asLens.kind !== 'everyone' && lensAllowed(viewAs.pro, asLens);
  const [notice, setNotice] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [now, setNow] = useState<{ key: string; min: number } | null>(null);

  /** What each moment's last SAVED change was — a refused save goes back to it, not to an older render. */
  const confirmed = useRef<Record<string, Partial<DayMoment>>>({});
  // A fresh server answer supersedes every optimistic guess.
  useEffect(() => {
    overridesRef.current = {};
    setOverrides({});
    setGone(new Set());
    setAdded([]);
    confirmed.current = {};
  }, [moments]);

  /* 🧩 In Details the moment picked on the rail is the navigator's piece too. */
  useEffect(() => {
    if (inspectorSlot && selectedId) pickDetailsPiece('schedule', selectedId);
  }, [inspectorSlot, selectedId]);

  /* 🎯 A moment tapped on a stage of the Event Hub Maker (Details part 2b,
     `schedule-focus.ts`): select it here — its own inspector opens — and bring
     it into view. Taken on mount (Details drew this page just now) and heard
     while mounted. An id that is not one of these moments is ignored. */
  useEffect(() => {
    const focus = (id: string | null) => {
      if (!id || !moments.some((m) => m.block_id === id)) return;
      setSelectedId(id);
      window.setTimeout(() => {
        document.querySelector<HTMLElement>(`[data-rail-moment="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'center' });
      }, 60);
    };
    focus(takeQueuedScheduleFocus());
    const onAsk = (e: Event) => {
      takeQueuedScheduleFocus();
      focus((e as CustomEvent<string>).detail ?? null);
    };
    window.addEventListener(SCHEDULE_FOCUS_EVENT, onAsk);
    return () => window.removeEventListener(SCHEDULE_FOCUS_EVENT, onAsk);
  }, [moments]);

  // The venue's wall clock, read after mount (never during render, so the
  // server and the first client paint agree) and re-read every minute.
  useEffect(() => {
    if (!isEventDay) return;
    const read = () => {
      const iso = new Date(venueNowMs()).toISOString();
      setNow({ key: wallDateKey(iso), min: wallMinutes(iso) });
    };
    read();
    const t = setInterval(read, 60_000);
    return () => clearInterval(t);
  }, [isEventDay]);

  const merged = useMemo(
    () =>
      withChapters([...moments, ...added.filter((a) => !moments.some((m) => m.block_id === a.block_id))], ch?.chapters ?? null)
        .filter((m) => !gone.has(m.block_id) && !held.has(m.block_id) && !(m.parent_block_id && (gone.has(m.parent_block_id) || held.has(m.parent_block_id))))
        .map((m) => ({ ...m, ...(overrides[m.block_id] ?? {}) })),
    [moments, added, overrides, gone, held, ch?.chapters],
  );
  const topLevel = useMemo(() => merged.filter((m) => m.parent_block_id === null), [merged]);
  const partsOf = useMemo(() => {
    const map = new Map<string, DayMoment[]>();
    for (const m of merged) {
      if (!m.parent_block_id) continue;
      const list = map.get(m.parent_block_id) ?? [];
      list.push(m);
      map.set(m.parent_block_id, list);
    }
    return map;
  }, [merged]);

  /** The chapters drawn on the rail: a TBA one is listed under it, one before the day is Planning Stage's. */
  const onRail = useMemo(
    () => (ch ? topLevel.filter((m) => !m.time_tba && chapterStage(m, ch.eventDay) === 'day') : topLevel),
    [ch, topLevel],
  );
  const tbaChapters = useMemo(
    () => (ch ? topLevel.filter((m) => m.time_tba && chapterStage(m, ch.eventDay) === 'day') : []),
    [ch, topLevel],
  );
  const rails = useMemo(() => {
    const grouped = groupByWallDate(onRail);
    if (grouped.length === 0 && eventDateKey) return [{ dateKey: eventDateKey, rows: [] }];
    return grouped;
  }, [onRail, eventDateKey]);

  const selected = merged.find((m) => m.block_id === selectedId) ?? null;
  const visibleCount = topLevel.filter((m) => m.is_public && !m.staged).length;
  const stagedCount = topLevel.filter((m) => m.staged).length;
  const taggedSuppliers = suppliers.filter((s) =>
    merged.some((m) => m.responsible_vendor_ids.includes(s.vendor_id)),
  );

  const overridesRef = useRef(overrides);
  function override(id: string, patch: Partial<DayMoment>) {
    const next = { ...overridesRef.current, [id]: { ...(overridesRef.current[id] ?? {}), ...patch } };
    overridesRef.current = next;
    setOverrides(next);
  }
  /** A change that DID save — what a later refusal goes back to (no render follows a Maker save). */
  function confirm(id: string, patch: Partial<DayMoment>) {
    confirmed.current[id] = { ...(confirmed.current[id] ?? {}), ...patch };
  }
  function revert(ids: string[]) {
    const next = { ...overridesRef.current };
    for (const id of ids) {
      const kept = confirmed.current[id];
      if (kept) next[id] = { ...kept };
      else delete next[id];
    }
    overridesRef.current = next;
    setOverrides(next);
  }

  /** A shift that LANDED is on the rail at once: in the Maker the write is quiet, so no render brings the new times
   *  (the sheet closed over the old ones). On the standalone page the render that follows supersedes these. */
  function landShift(patches: readonly RetimePatch[]) {
    for (const p of patches) {
      const patch = { start_at: p.start_at, end_at: p.end_at };
      override(p.block_id, patch);
      confirm(p.block_id, patch);
    }
  }

  /** Run a write; on a refusal, undo the guess and say so. */
  function write(ids: string[], run: () => Promise<unknown>) {
    setNotice(null);
    const guessed = ids.map((id) => [id, overridesRef.current[id]] as const);
    startTransition(async () => {
      try {
        await run();
        for (const [id, patch] of guessed) if (patch) confirm(id, patch);
      } catch {
        revert(ids);
        // 🔒 A locked supplier's part (audit D7): the calm line, never "check your connection".
        const shop = lockedShopOnMoments(ids, merged, suppliers);
        setNotice(shop ? lockedLine(shop) : COULD_NOT_SAVE);
      }
    });
  }

  function toggleEye(m: DayMoment) {
    if (!canEdit) return;
    override(m.block_id, { is_public: !m.is_public });
    write([m.block_id], () =>
      toggleBlockVisibility(
        toFormData({ event_id: eventId, block_id: m.block_id, desired: m.is_public ? 'false' : 'true' }),
      ),
    );
  }

  // ── drag ──────────────────────────────────────────────────────────────────
  function beginDrag(
    e: React.PointerEvent,
    m: DayMoment,
    dateKey: string,
    span: RailSpan,
    mode: DragMode,
  ) {
    if (!canEdit || lens.kind !== 'all') return;
    const mouse = e.pointerType === 'mouse';
    if (mouse && e.button !== 0) return;
    // On a phone a finger on an UNSELECTED moment is a scroll or a tap, never a
    // drag — otherwise the rail could not be scrolled at all. Tap it first; the
    // selected moment then takes the finger (`touch-action: none`).
    if (!mouse && selectedId !== m.block_id) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const state: DragState = {
      id: m.block_id,
      mode,
      startY: e.clientY,
      dateKey,
      orig: { startMin: span.startMin, endMin: span.endMin },
      preview: { startMin: span.startMin, endMin: span.endMin },
      moved: false,
      hadEnd: span.hasEnd,
    };
    dragRef.current = state;
  }

  function moveDrag(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dy) < 5) return;
    const preview = applyDrag(d.orig, d.mode, (dy / hourPx) * 60);
    const next = { ...d, moved: true, preview };
    dragRef.current = next;
    setDrag(next);
  }

  function endDrag() {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d || !d.moved) return;
    suppressClick.current = true;
    if (sameSpan(d.orig, d.preview)) return;
    commitSpan(d.id, d.dateKey, d.mode, d.orig, d.preview, d.hadEnd);
  }

  function cancelDrag() {
    dragRef.current = null;
    setDrag(null);
  }

  function isoAt(dateKey: string, min: number): string {
    return fromDatetimeLocalValue(toDatetimeLocal(dateKey, min)) ?? '';
  }

  /** Persist a new span — a move carries the moment's parts with it. */
  function commitSpan(
    id: string,
    dateKey: string,
    mode: DragMode,
    orig: { startMin: number; endMin: number },
    next: { startMin: number; endMin: number },
    hadEnd: boolean,
  ) {
    const m = merged.find((x) => x.block_id === id);
    if (!m) return;
    if (mode === 'move') {
      const delta = next.startMin - orig.startMin;
      const parts = partsOf.get(id) ?? [];
      override(id, {
        start_at: isoAt(dateKey, next.startMin),
        end_at: hadEnd ? isoAt(dateKey, next.endMin) : null,
      });
      for (const p of parts) {
        const ps = spanOf(p.start_at, p.end_at);
        override(p.block_id, {
          start_at: isoAt(wallDateKey(p.start_at), ps.startMin + delta),
          end_at: p.end_at ? isoAt(wallDateKey(p.start_at), ps.endMin + delta) : null,
        });
      }
      write([id, ...parts.map((p) => p.block_id)], () =>
        bulkRetimeScheduleBlocks(
          toFormData({
            event_id: eventId,
            from_block_id: id,
            to_block_id: id,
            delta_minutes: String(delta),
          }),
        ),
      );
      return;
    }
    if (mode === 'top') {
      override(id, { start_at: isoAt(dateKey, next.startMin) });
      write([id], () =>
        updateScheduleBlock(
          toFormData({ event_id: eventId, block_id: id, start_at: toDatetimeLocal(dateKey, next.startMin) }),
        ),
      );
      return;
    }
    override(id, { end_at: isoAt(dateKey, next.endMin) });
    write([id], () =>
      updateScheduleBlock(
        toFormData({ event_id: eventId, block_id: id, end_at: toDatetimeLocal(dateKey, next.endMin) }),
      ),
    );
  }

  function onMomentClick(m: DayMoment) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (ch) return ch.open(m.block_id);
    setSelectedId((cur) => (cur === m.block_id ? null : m.block_id));
  }

  function openAdd(dateKey: string | null, startMin: number) {
    if (!canEdit) return;
    if (ch) return ch.add();
    setSelectedId(null);
    setSheet({ kind: 'add', dateKey, startMin });
  }

  /**
   * ➕ STUDIO › SCHEDULE'S "ADD A MOMENT", IN PLACE: ONE write, no render. The row is on the timeline at the tap,
   * under an id made HERE (the block's own uuid, which the action takes only from a quiet Maker write) — so the
   * answer need carry nothing back and the next edit names the same row. A refused add takes the row off again and
   * says so; it never stays looking saved.
   */
  function createInline(input: { label: string; startMin: number; endMin: number }) {
    const dateKey = lastDateKey;
    if (!canEdit || !dateKey) return;
    const id = crypto.randomUUID();
    const start = toDatetimeLocal(dateKey, input.startMin);
    const end = toDatetimeLocal(dateKey, input.endMin);
    setNotice(null);
    setAdded((all) => [
      ...all,
      {
        block_id: id,
        label: input.label,
        block_type: 'custom',
        start_at: isoAt(dateKey, input.startMin),
        end_at: isoAt(dateKey, input.endMin),
        location: null,
        notes: null,
        is_public: true,
        parent_block_id: null,
        run_state: 'upcoming',
        staged: false,
        responsible_party: null,
        responsible_vendor_ids: [],
        audience: null,
      },
    ]);
    setPending((p) => new Set(p).add(id));
    startTransition(async () => {
      try {
        await dayActions.createScheduleBlock(
          toFormData({ event_id: eventId, block_id: id, label: input.label, block_type: 'custom', start_at: start, end_at: end, is_public: 'on', [SCHEDULE_QUIET_FIELD]: '1' }),
        );
        /* The stage canvases draw the day's moments: they load again once, now that it is saved. */
        window.dispatchEvent(new Event(SCHEDULE_CANVAS_STALE_EVENT));
      } catch {
        setAdded((all) => all.filter((m) => m.block_id !== id));
        setNotice(`“${input.label}” was not added. Check your connection and try again.`);
      } finally {
        setPending((p) => {
          const next = new Set(p);
          next.delete(id);
          return next;
        });
      }
    });
  }

  const lastEnd = topLevel.reduce((acc, m) => Math.max(acc, spanOf(m.start_at, m.end_at).endMin), 0);
  const lastDateKey = rails.length > 0 ? rails[rails.length - 1]!.dateKey : eventDateKey;

  const dim = (m: DayMoment): boolean => {
    if (lens.kind === 'guest') return !m.is_public || m.staged;
    if (lens.kind === 'vendor') return !m.responsible_vendor_ids.includes(lens.id);
    return false;
  };

  const lensLabel =
    lens.kind === 'all'
      ? 'Master'
      : lens.kind === 'guest'
        ? 'Guests'
        : (suppliers.find((s) => s.vendor_id === lens.id)?.vendor_name ??
          (initialLens?.kind === 'vendor' && initialLens.id === lens.id ? initialLensName : null) ??
          'Supplier');
  /* 👁 The opening vendor lens stays a choice in View as even with no tagged moment (and before the responsible-party
     columns are live) — shown with its honest "0 moments", never dropped so the menu silently reads Master. */
  const lensOptions = rosEnabled ? [...taggedSuppliers] : [];
  if (initialLens?.kind === 'vendor' && !lensOptions.some((s) => s.vendor_id === initialLens.id)) {
    const known = suppliers.find((s) => s.vendor_id === initialLens.id);
    lensOptions.push(known ?? { vendor_id: initialLens.id, vendor_name: initialLensName ?? 'Supplier' });
  }
  const lensMomentCount = lens.kind === 'vendor' ? topLevel.filter((m) => m.responsible_vendor_ids.includes(lens.id)).length : null;

  // ── render ────────────────────────────────────────────────────────────────
  /* THE SIDE — the picked moment's inspector, or the day in numbers. */
  const side = selected ? (
              <MomentInspector
                key={selected.block_id}
                eventId={eventId}
                eventType={eventType}
                moment={selected}
                parts={partsOf.get(selected.block_id) ?? []}
                suppliers={suppliers}
                rosEnabled={rosEnabled}
                canEdit={canEdit}
                canStage={canStage}
                request={requests.find((r) => r.block_id === selected.block_id) ?? null}
                onClose={() => setSelectedId(null)}
                onShift={() => setSheet({ kind: 'shift', fromId: selected.block_id })}
                onOpenRequests={() => setSheet({ kind: 'requests' })}
                onDeleted={() => setSelectedId(null)}
                onOverride={override}
                onRevert={revert}
                onConfirm={confirm}
                live={live}
                askDelete={askDelete?.id === selected.block_id ? askDelete.n : 0}
                onGone={hideMoment}
              />
            ) : (
              <Glance
                count={topLevel.length}
                visible={visibleCount}
                staged={stagedCount}
                topLevel={topLevel}
                requests={requests.length}
                role={role}
                daysToGo={daysToGo}
                onRequests={() => setSheet({ kind: 'requests' })}
              />
            );

  const addSheet = (
      <AddMomentSheet
        open={sheet?.kind === 'add'}
        onClose={() => setSheet(null)}
        eventId={eventId}
        eventType={eventType}
        dateKey={sheet?.kind === 'add' ? sheet.dateKey : null}
        startMin={sheet?.kind === 'add' ? sheet.startMin : 14 * 60}
        canStage={canStage}
        nextMoment={
          sheet?.kind === 'add'
            ? (topLevel
                .filter(
                  (m) =>
                    wallDateKey(m.start_at) === sheet.dateKey && wallMinutes(m.start_at) >= sheet.startMin,
                )
                .sort((a, b) => wallMinutes(a.start_at) - wallMinutes(b.start_at))[0] ?? null)
            : null
        }
      />
  );

  /* ⚙ THE DAY'S TOOLS LIVE IN SCHEDULE SETTINGS on the chapters page (owner 2026-11-04, "Match the 4 Nov prototype":
     the one line is Event Day ▾ · N chapters · 👤 · ⚙). The same tools, the same sheets — handed up as rows. */
  const settingsTools =
    ch && booked ? (
      <div className="flex flex-col border-t border-ink/10" data-schedule-settings-tools="">
        {canEdit && requests.length > 0 ? (
          <SettingsRow label={`Supplier requests · ${requests.length}`} onClick={() => setSheet({ kind: 'requests' })}>
            <MessageSquare aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </SettingsRow>
        ) : null}
        {hostPanel ? (
          <SettingsRow label="Host / MC — segments, questions, a note" onClick={() => setSheet({ kind: 'host' })}>
            <Mic aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </SettingsRow>
        ) : null}
        {topLevel.length > 0 && emcee ? (
          <div data-settings-closes="" className="flex min-h-14 items-center border-b border-ink/10">
            {emcee}
          </div>
        ) : null}
        {canEdit && topLevel.length > 0 ? (
          <SettingsRow label="Running late — shift the day" onClick={() => setSheet({ kind: 'shift', fromId: null })}>
            <MoveVertical aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </SettingsRow>
        ) : null}
        <p className="pt-2 text-[13px] text-ink/60">
          Moments shown to guests appear on the Event Hub with a live “happening now” on the day. Hidden moments stay
          between you, your coordinator and the suppliers you tag.
        </p>
      </div>
    ) : null;
  const handTools = ch && booked ? ch.setSettingsPart : null;
  /* 👥 What needs you, for the desktop's people column (slice 10) — the same requests sheet. */
  useEffect(() => {
    if (!handTools) return;
    handTools(
      'needs',
      canEdit && requests.length > 0 ? (
        <button
          type="button"
          onClick={() => setSheet({ kind: 'requests' })}
          data-people-needs={requests.length}
          className="sn-press flex min-h-12 w-full items-center justify-between border-b border-ink/10 text-left text-[14px] text-ink"
        >
          <span>Supplier requests</span>
          <span className="font-semibold text-sn-accent">{formatCount(requests.length)} need you ›</span>
        </button>
      ) : null,
    );
  }, [handTools, canEdit, requests.length]);
  useEffect(() => {
    if (handTools) handTools('tools', settingsTools);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handed up when what it offers changes
  }, [handTools, canEdit, requests.length, hostPanel, emcee, topLevel.length]);

  if (studio) {
    return (
      <DayActionsContext.Provider value={dayActions}>

        <StudioDay
          eventId={eventId}
          dateKey={lastDateKey}
          moments={topLevel}
          canEdit={canEdit}
          notice={notice}
          onPatch={(id, patch, send) => {
            override(id, patch);
            write([id], send);
          }}
          onAdd={() => openAdd(lastDateKey, topLevel.length ? Math.min(lastEnd, 23 * 60) : 14 * 60)}
          /* In place where the day has a date and nothing is staged; else the shipped sheet (it asks the date, it stages). */
          onCreate={lastDateKey && !canStage ? createInline : null}
          pendingIds={pending}
          onMore={(id) => setSelectedId(id)}
          onAskDelete={
            canEdit
              ? (id) => {
                  setAskDelete((a) => ({ id, n: (a?.n ?? 0) + 1 }));
                  setSelectedId(id);
                }
              : null
          }
        />
        {/* ⋯ — the shipped inspector (length, notes, show to guests, suppliers, remove): a desk keeps it in
            Details' right column, as the rail did; a phone opens it from the bottom. */}
        {isDesktop && inspectorSlot ? <InSlot id={inspectorSlot}>{side}</InSlot> : null}
        <Sheet open={selected !== null && !isDesktop} onClose={() => setSelectedId(null)} labelledById="studio-moment-more" rise>
          {selected ? (
            <div className="pb-4 pt-2" data-studio-moment-sheet="">
              <h2 id="studio-moment-more" className="sr-only">
                {selected.label}
              </h2>
              <MomentInspector
                key={selected.block_id}
                eventId={eventId}
                eventType={eventType}
                moment={selected}
                parts={partsOf.get(selected.block_id) ?? []}
                suppliers={suppliers}
                rosEnabled={rosEnabled}
                canEdit={canEdit}
                canStage={canStage}
                request={requests.find((r) => r.block_id === selected.block_id) ?? null}
                onClose={() => setSelectedId(null)}
                onShift={() => setSheet({ kind: 'shift', fromId: selected.block_id })}
                onOpenRequests={() => setSheet({ kind: 'requests' })}
                onDeleted={() => setSelectedId(null)}
                onOverride={override}
                onRevert={revert}
                onConfirm={confirm}
                live={live}
                askDelete={askDelete?.id === selected.block_id ? askDelete.n : 0}
                onGone={hideMoment}
              />
            </div>
          ) : null}
        </Sheet>
        {addSheet}
        <ShiftSheet
          open={sheet?.kind === 'shift'}
          onClose={() => setSheet(null)}
          eventId={eventId}
          moments={merged}
          fromId={sheet?.kind === 'shift' ? sheet.fromId : null}
        onShifted={landShift}
        />
        <RequestsSheet
          open={sheet?.kind === 'requests'}
          onClose={() => setSheet(null)}
          eventId={eventId}
          requests={requests}
          moments={merged}
        />
        {/* ↩ The Undo toast a swiped-away part or moment leaves (owner 2026-11-03) — mounted with the day, so it outlives the inspector. */}
      <UndoToastHost />
    </DayActionsContext.Provider>
    );
  }

  return (
    <DayActionsContext.Provider value={dayActions}>

    <div className="space-y-3" data-schedule-day="">
      {/* THE DAY'S TOOLS — one row; names live in aria-label/title, the
          explanation lives behind the ⓘ, never in a paragraph above the rail. */}
      <InSlot id={booked ? toolsSlot : null}>
      {ch && booked ? (
        /* 👤 The round View as (prototype frame 1) — the rest of the day's tools are in ⚙ Schedule settings. */
        <div className="relative flex min-w-0 items-center gap-1" data-schedule-day-tools={frame}>
          {viewAs && topLevel.length > 0 ? (
            <ViewAsMenu
              input={viewAs}
              lens={asLens}
              round
              onLens={(l) => {
                setSelectedId(null);
                setAsLens(l);
              }}
            />
          ) : null}
          {/* ✋ THE ROW'S ONE ACTION (slice 8, "Changed 3"): the supplier requests waiting on you — the same requests
              sheet ⚙ holds. While a filter is on it shrinks to a badge so the row still fits. */}
          {canEdit && requests.length > 0 ? (
            <button
              type="button"
              onClick={() => setSheet({ kind: 'requests' })}
              data-schedule-need-you={requests.length}
              aria-label={`${formatCount(requests.length)} supplier request${requests.length === 1 ? '' : 's'} need you`}
              className={
                viewingAs || ch.dayFilter
                  ? 'sn-press grid h-7 min-w-7 flex-none place-items-center rounded-full bg-sn-accent px-1.5 text-[13px] font-bold tabular-nums text-sn-on-accent'
                  : 'sn-press flex h-11 flex-none items-center whitespace-nowrap px-0.5 text-[13px] font-semibold text-sn-accent'
              }
            >
              {viewingAs || ch.dayFilter ? formatCount(requests.length) : `${formatCount(requests.length)} need you ›`}
            </button>
          ) : null}
        </div>
      ) : (
      <div className={booked ? 'relative flex items-center gap-0.5' : 'relative flex flex-wrap items-center gap-1'} data-schedule-day-tools={frame}>
        {viewAs && topLevel.length > 0 ? (
          <div className="flex items-center gap-1">
            <ViewAsMenu
              input={viewAs}
              lens={asLens}
              compact={booked}
              onLens={(l) => {
                setSelectedId(null);
                setAsLens(l);
              }}
            />
            <Tip>
              {viewAs.pro
                ? 'See the day as a guest, a role or a supplier, or which suppliers work at once. A view only: nothing changes.'
                : 'See which suppliers work at the same time. Seeing the day as a guest, a role or a supplier is part of Pro. A view only: nothing changes.'}
            </Tip>
          </div>
        ) : topLevel.length > 0 ? (
          <div className="flex items-center gap-1">
            {/* VIEW AS — one dropdown (the shared PickMenu), never a chip row.
                Every view is a live filter over this one timeline. */}
            <PickMenu
              label="View as"
              value={lens.kind === 'all' ? 'all' : lens.kind === 'guest' ? 'guest' : `vendor:${lens.id}`}
              compact={booked}
              buttonText={booked ? lensLabel : undefined}
              dataAttr="data-schedule-lens"
              options={[
                { key: 'all', label: 'Master · everything' },
                { key: 'guest', label: 'Guests · what the Event Hub shows' },
                ...lensOptions.map((s) => {
                  const n = topLevel.filter((m) => m.responsible_vendor_ids.includes(s.vendor_id)).length;
                  return { key: `vendor:${s.vendor_id}`, label: `${supplierOnItem(s)} · ${n} moment${n === 1 ? '' : 's'}` };
                }),
              ]}
              onPick={(key) => {
                if (key === 'all') {
                  setLens({ kind: 'all' });
                  return;
                }
                setSelectedId(null);
                setLens(key === 'guest' ? { kind: 'guest' } : { kind: 'vendor', id: key.slice('vendor:'.length) });
              }}
            />
            <Tip>Every view is a live filter over this one timeline. Change the master; each view follows.</Tip>
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-0.5">
          {canEdit && requests.length > 0 ? (
            <ToolButton
              label={`Supplier requests (${requests.length})`}
              badge={requests.length}
              onClick={() => setSheet({ kind: 'requests' })}
            >
              <MessageSquare aria-hidden className="h-[17px] w-[17px]" strokeWidth={1.8} />
            </ToolButton>
          ) : null}
          {hostPanel ? (
            <ToolButton label="Host / MC — segments, questions, a note" onClick={() => setSheet({ kind: 'host' })}>
              <Mic aria-hidden className="h-[17px] w-[17px]" strokeWidth={1.8} />
            </ToolButton>
          ) : null}
          {topLevel.length > 0 ? emcee : null}
          {canEdit && topLevel.length > 0 ? (
            <ToolButton label="Shift the day (running late)" onClick={() => setSheet({ kind: 'shift', fromId: null })}>
              <MoveVertical aria-hidden className="h-[17px] w-[17px]" strokeWidth={1.8} />
            </ToolButton>
          ) : null}
          <span className="hidden sm:inline-flex">
            <Tip align="end">
              Moments shown to guests appear on the Event Hub with a live “happening now” on the
              day. Hidden moments stay between you, your coordinator and the suppliers you tag.
            </Tip>
          </span>
          {canEdit && !booked ? (
            <button
              type="button"
              onClick={() =>
                openAdd(lastDateKey, topLevel.length > 0 ? snapMinutes(lastEnd, 15) : 14 * 60)
              }
              aria-label={ch ? 'Add a chapter' : 'Add moment'}
              className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-2.5 text-[13px] font-semibold text-cream hover:bg-black sm:px-3.5"
            >
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
              <span className="hidden sm:inline">{ch ? 'Add a chapter' : 'Add moment'}</span>
            </button>
          ) : null}
        </div>
      </div>
      )}
      </InSlot>

      {notice ? (
        <p role="alert" className="text-sm font-medium text-danger-700">
          {notice}
        </p>
      ) : null}

      {lens.kind !== 'all' ? (
        <p className="inline-flex items-center gap-2 rounded-full bg-terracotta/15 px-3 py-1.5 text-xs text-ink/75">
          {lens.kind === 'guest' ? 'Guest view' : `${lensLabel}'s view`} ·
          <button
            type="button"
            onClick={() => setLens({ kind: 'all' })}
            className="font-bold text-ink underline"
          >
            back to Master
          </button>
        </p>
      ) : null}
      {lensMomentCount === 0 ? (
        <p className="px-1 text-sm text-ink/60" role="status" data-schedule-lens-empty="">
          {noMomentsForLine(lensLabel)}.
        </p>
      ) : null}

      {viewingAs && viewAs && ch ? <ViewAsBody
          eventId={eventId}
          input={viewAs}
          chapters={ch.chapters}
          lens={asLens}
          onLens={setAsLens}
          pill={!booked}
          nowIso={isEventDay && now ? `${now.key}T${String(Math.floor(now.min / 60)).padStart(2, '0')}:${String(now.min % 60).padStart(2, '0')}:00.000Z` : null}
        /> : null}

      <div className={viewingAs ? 'hidden' : 'lg:flex lg:items-start lg:gap-6'}>
        <div className="min-w-0 flex-1 space-y-8">
          {rails.length === 0 ? (
            <NoDateYet canEdit={canEdit} onAdd={() => openAdd(null, 14 * 60)} />
          ) : null}
          {rails.map(({ dateKey, rows }) => {
            // The hour grid below is drawn only without chapters; this alias keeps its (now unused) chapter doors typed.
            const railChapters: typeof ch = ch;
            /* 📋 SLICE 8 — where chapters are drawn, the day is a LIST of content-sized chapter rows (the prototype's
               "Changed 4"); the hour grid below stays only where no chapters are drawn (the Maker, a failed read). */
            if (ch) {
              const facts = new Map(ch.chapters.map((c) => [c.block_id, c]));
              const names = new Map<string, string>([
                ...suppliers.map((v) => [v.vendor_id, v.vendor_name] as [string, string]),
                ...ch.suppliers.map((v) => [v.id, v.name] as [string, string]),
              ]);
              const shown = ch.dayFilter ? rows.filter((m) => m.block_id === ch.dayFilter) : rows;
              const nowIso =
                isEventDay && now && now.key === dateKey
                  ? `${dateKey}T${String(Math.floor(now.min / 60)).padStart(2, '0')}:${String(now.min % 60).padStart(2, '0')}:00.000Z`
                  : null;
              const list = dayList({
                chapters: shown.map((m) => ({
                  block_id: m.block_id,
                  label: m.label,
                  block_type: facts.get(m.block_id)?.block_type ?? m.block_type,
                  start_at: m.start_at,
                  end_at: m.end_at,
                  location: facts.get(m.block_id)?.location ?? m.location,
                })),
                moments: ch.moments.map((x) => ({
                  block_id: x.block_id,
                  parent_block_id: x.parent_block_id,
                  label: x.label,
                  start_at: x.start_at,
                  end_at: x.end_at,
                  time_tba: x.time_tba,
                  responsible_vendor_ids: x.vendor_ids,
                })),
                names,
                vendorsOf: (id) => {
                  const c = facts.get(id);
                  return c ? chapterSuppliers(c, ch.moments, ch.tasks, ch.suppliers).filter((v) => !v.everyChapter).map((v) => v.id) : [];
                },
                pickingOf: (id) => ch.picking[id] ?? [],
                nowIso,
              });
              return (
                <section key={dateKey} aria-label={formatDateHeading(dateKey)} data-day-list-day={dateKey}>
                  {rails.length > 1 ? <h2 className="pb-1 font-display text-base text-ink">{formatDateHeading(dateKey)}</h2> : null}
                  <DayList
                    rows={list}
                    canEdit={canEdit && lens.kind === 'all'}
                    onOpen={(id) => ch.open(id)}
                    onDelete={(id) => ch.askDelete(id)}
                    onMove={(id, min) => ch.moveChapter(id, min)}
                    onAdd={canEdit ? () => ch.add() : undefined}
                  />
                </section>
              );
            }
            const spans = new Map(rows.map((m) => [m.block_id, spanOf(m.start_at, m.end_at)]));
            const liveSpans = new Map(spans);
            if (drag && drag.moved && liveSpans.has(drag.id)) {
              const s = liveSpans.get(drag.id)!;
              liveSpans.set(drag.id, { ...s, ...drag.preview });
            }
            const dayRequests = requests.filter(
              (r) => r.proposed_start_at && wallDateKey(r.proposed_start_at) === dateKey,
            );
            const hours = railHours([
              ...liveSpans.values(),
              ...dayRequests.map((r) => spanOf(r.proposed_start_at!, r.proposed_end_at)),
            ]);
            const railStart = hours.startHour * 60;
            const railEnd = hours.endHour * 60;
            const lanes = layoutLanes(
              rows.map((m) => ({ id: m.block_id, ...liveSpans.get(m.block_id)! })),
            );
            const gaps = !ch && canEdit && lens.kind === 'all' ? findGaps([...spans.values()], railStart, railEnd) : [];
            const between = ch && lens.kind === 'all' ? betweenChapters([...spans.values()]) : [];
            const top = (min: number) => ((min - railStart) / 60) * hourPx;
            const nowOnRail = isEventDay && now && now.key === dateKey && now.min >= railStart && now.min <= railEnd;
            const dayVisible = rows.filter((m) => m.is_public && !m.staged).length;
            const dayStaged = rows.filter((m) => m.staged).length;
            return (
              <section key={dateKey} aria-label={formatDateHeading(dateKey)}>
                {/* Under Booked the page's date line already says the one day — its heading is for a screen reader only,
                    so the moments start right under the line (owner 2026-10-31, "so many upper space not used"). */}
                <header className={booked && rails.length === 1 ? 'sr-only' : 'flex flex-wrap items-baseline gap-x-3 gap-y-0.5 pb-2 pl-[54px] lg:pl-16'}>
                  <h2 className="font-display text-base text-ink">{formatDateHeading(dateKey)}</h2>
                  <p className="text-xs text-ink/55">
                    <b className="font-semibold text-ink/80">{rows.length}</b> moment{rows.length === 1 ? '' : 's'}
                    {' · '}
                    <b className="font-semibold text-ink/80">{dayVisible}</b> visible to guests
                    {dayStaged > 0 ? (
                      <>
                        {' · '}
                        <b className="font-semibold text-ink/80">{dayStaged}</b> staged
                      </>
                    ) : null}
                  </p>
                </header>

                <div
                  className="relative ml-[54px] lg:ml-16 lg:max-w-[720px]"
                  style={{ height: (hours.endHour - hours.startHour) * hourPx }}
                  onClick={(e) => {
                    if (e.target !== e.currentTarget || !canEdit || lens.kind !== 'all') return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const min = railStart + ((e.clientY - rect.top) / hourPx) * 60;
                    openAdd(dateKey, snapMinutes(min, 15));
                  }}
                >
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-px bg-ink/10" />
                  {Array.from({ length: hours.endHour - hours.startHour + 1 }, (_, i) => (
                    <div
                      key={i}
                      aria-hidden
                      className="pointer-events-none absolute -left-[54px] right-0 flex items-start lg:-left-16"
                      style={{ top: i * hourPx }}
                    >
                      <span className="-translate-y-2 w-11 text-right font-mono text-[10.5px] text-ink/45 lg:w-[52px] lg:text-[11px]">
                        {formatHour(hours.startHour + i)}
                      </span>
                      <span className="ml-2 h-px w-2 bg-ink/10" />
                    </div>
                  ))}

                  {drag && drag.moved && drag.dateKey === dateKey ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-2 inset-y-0"
                      style={{
                        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${hourPx / 12 - 1}px, rgba(203,167,102,0.35) ${hourPx / 12 - 1}px, rgba(203,167,102,0.35) ${hourPx / 12}px)`,
                        backgroundPositionY: `${-(railStart % 5)}px`,
                      }}
                    />
                  ) : null}

                  {nowOnRail && now ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -left-[54px] right-0 z-[7] flex items-center lg:-left-16"
                      style={{ top: top(now.min) }}
                    >
                      <span className="-translate-y-px w-11 text-right font-mono text-[10.5px] font-bold text-mulberry-700 lg:w-[52px]">
                        {formatClock(now.min)}
                      </span>
                      <span className="ml-2 h-1.5 w-1.5 rounded-full bg-mulberry" />
                      <span className="h-px flex-1 bg-mulberry" />
                    </div>
                  ) : null}

                  {gaps.map((g) => (
                    <button
                      key={`gap-${g.startMin}`}
                      type="button"
                      onClick={() => openAdd(dateKey, g.startMin)}
                      className="absolute left-2.5 right-0 z-[1] grid min-h-0 place-items-center rounded-md text-xs font-semibold text-ink/30 transition-colors hover:bg-terracotta/10 hover:text-terracotta-700 hover:ring-1 hover:ring-inset hover:ring-terracotta/40 lg:left-3.5"
                      style={{ top: top(g.startMin) + 2, height: Math.max(((g.endMin - g.startMin) / 60) * hourPx - 6, 18) }}
                    >
                      <span>
                        ＋ <span className="font-mono">{formatClock(g.startMin)}</span>
                      </span>
                    </button>
                  ))}

                  {/* 📖 The time between chapters (the prototype's "1h 30m between"): a tap adds a chapter, for an editor. */}
                  {between.map((g) => {
                    const words = `${gapWords(g.endMin - g.startMin)} between`;
                    const style = { top: top(g.startMin) + 2, height: Math.max(((g.endMin - g.startMin) / 60) * hourPx - 6, 18) };
                    return canEdit ? (
                      <button
                        key={`between-${g.startMin}`}
                        type="button"
                        data-chapter-between=""
                        onClick={() => openAdd(dateKey, g.startMin)}
                        aria-label={`${words} — add a chapter`}
                        className="absolute left-2.5 right-0 z-[1] grid min-h-0 place-items-center rounded-md text-xs font-semibold text-ink/40 hover:bg-terracotta/10 hover:text-terracotta-700 lg:left-3.5"
                        style={style}
                      >
                        {words}
                      </button>
                    ) : (
                      <p
                        key={`between-${g.startMin}`}
                        data-chapter-between=""
                        className="absolute left-2.5 right-0 z-[1] grid place-items-center text-xs font-semibold text-ink/40 lg:left-3.5"
                        style={style}
                      >
                        {words}
                      </p>
                    );
                  })}

                  {rows.length === 0 ? (
                    <EmptyRail
                      canEdit={canEdit}
                      templates={templates}
                      onTemplate={(id) =>
                        write([], () => loadScheduleTemplate(toFormData({ event_id: eventId, template_id: id })))
                      }
                    />
                  ) : null}

                  {/* 📏 Drawn at its TIME's height, like a moment (`min-h-0`): the global 44-px button floor grew a
                      30-minute request past its slot and over the next moment (walk 2026-11-01, "Lumière proposes"
                      over Cocktails). Held by `the-rail-draws-time-at-its-height.test.ts`. */}
                  {canEdit
                    ? dayRequests.map((r) => {
                        const s = spanOf(r.proposed_start_at!, r.proposed_end_at);
                        const overlaps = [...spans.values()].some(
                          (x) => x.startMin < s.endMin && s.startMin < x.endMin,
                        );
                        return (
                          <button
                            key={r.suggestion_id}
                            type="button"
                            onClick={() => setSheet({ kind: 'requests' })}
                            className={`absolute z-[6] flex min-h-0 items-center overflow-hidden whitespace-nowrap rounded-md border-[1.5px] border-dashed border-mulberry bg-mulberry-50 px-2.5 text-[11.5px] font-semibold text-mulberry-700 ${
                              overlaps ? 'left-1/2 right-0' : 'left-2.5 right-0 lg:left-3.5'
                            }`}
                            style={{ top: top(s.startMin), height: Math.max(((s.endMin - s.startMin) / 60) * hourPx - 3, 26) }}
                          >
                            <span className="truncate">
                              {r.kind === 'adjust'
                                ? `${r.by} asks · start ${formatClock(s.startMin)}`
                                : `${r.by} proposes · ${r.proposed_label ?? 'a new moment'}`}
                            </span>
                          </button>
                        );
                      })
                    : null}

                  {rows.map((m) => {
                    const span = liveSpans.get(m.block_id)!;
                    const lane = lanes.get(m.block_id) ?? { lane: 0, lanes: 1 };
                    const height = Math.max(((span.endMin - span.startMin) / 60) * hourPx - 3, 30);
                    const isSel = selectedId === m.block_id;
                    const isDragging = drag?.id === m.block_id && drag.moved;
                    const short = height < 52;
                    const faded = dim(m);
                    const parts = partsOf.get(m.block_id) ?? [];
                    const width = `calc((100% - 14px) / ${lane.lanes} - ${lane.lanes > 1 ? 4 : 0}px)`;
                    const left = `calc(10px + (100% - 14px) / ${lane.lanes} * ${lane.lane})`;
                    return (
                      <RailSwipe
                        key={m.block_id}
                        enabled={Boolean(ch) && canEdit && lens.kind === 'all' && !m.staged && !faded}
                        label={`Delete ${m.label}`}
                        top={top(span.startMin)}
                        height={height}
                        onDelete={() => railChapters?.askDelete(m.block_id)}
                      >
                      {(sw) => (
                      <div
                        data-rail-moment={m.block_id}
                        role="button"
                        tabIndex={faded ? -1 : 0}
                        aria-pressed={isSel}
                        aria-label={`${m.label}, ${formatClockRange(span.startMin, span.endMin)}${m.is_public ? '' : ', hidden from guests'}`}
                        onClick={() => onMomentClick(m)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (railChapters) return railChapters.open(m.block_id);
                            setSelectedId((cur) => (cur === m.block_id ? null : m.block_id));
                          }
                        }}
                        onPointerDown={(e) => beginDrag(e, m, dateKey, spans.get(m.block_id)!, 'move')}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                        onPointerCancel={cancelDrag}
                        {...(sw?.rowProps ?? {})}
                        className={`group absolute z-[2] flex min-h-0 overflow-hidden rounded-md text-left transition-[box-shadow,opacity,transform] ${
                          short ? 'flex-row items-center gap-2.5 py-0' : 'flex-col py-2'
                        } pl-3 pr-10 ${
                          m.staged
                            ? 'bg-ink/[0.03] outline-dashed outline-[1.5px] -outline-offset-2 outline-terracotta'
                            : m.is_public
                              ? 'bg-white shadow-[0_1px_2px_rgba(40,34,24,0.05),0_18px_40px_-26px_rgba(30,26,18,0.4)]'
                              : 'bg-ink/[0.03] ring-1 ring-inset ring-ink/[0.07]'
                        } ${isSel || isDragging ? 'z-[5] translate-x-0.5 ring-2 ring-terracotta' : ''} ${
                          isDragging ? 'cursor-grabbing shadow-2xl' : canEdit ? 'cursor-pointer' : ''
                        } ${faded ? 'pointer-events-none opacity-[0.14]' : isEventDay && (m.run_state === 'done' || m.run_state === 'skipped') ? 'opacity-60' : ''} ${
                          isEventDay && m.run_state === 'live' ? 'ring-[1.5px] ring-mulberry' : ''
                        }`}
                        style={{
                          top: top(span.startMin),
                          height,
                          left,
                          width,
                          touchAction: isSel && canEdit ? 'none' : undefined,
                          // 🗑 A chapter swipes left to reveal Delete (`RailSwipe`); a selected block keeps the finger.
                          ...(sw ? { transform: sw.rowStyle.transform, transition: sw.rowStyle.transition, touchAction: isSel && canEdit ? 'none' : 'pan-y' } : {}),
                        }}
                      >
                        <span
                          aria-hidden
                          className="absolute inset-y-0 left-0 w-1"
                          style={{ background: PHASE_TINT[m.block_type] ?? PHASE_TINT.custom }}
                        />
                        {isSel && canEdit ? (
                          <>
                            <span
                              aria-hidden
                              onPointerDown={(e) => beginDrag(e, m, dateKey, spans.get(m.block_id)!, 'top')}
                              className="absolute left-1/2 top-0 z-[4] flex h-3 w-12 -translate-x-1/2 cursor-ns-resize items-start justify-center"
                              style={{ touchAction: 'none' }}
                            >
                              <i className="mt-0.5 h-1 w-8 rounded-full bg-terracotta" />
                            </span>
                            <span
                              aria-hidden
                              onPointerDown={(e) => beginDrag(e, m, dateKey, spans.get(m.block_id)!, 'bottom')}
                              className="absolute bottom-0 left-1/2 z-[4] flex h-3 w-12 -translate-x-1/2 cursor-ns-resize items-end justify-center"
                              style={{ touchAction: 'none' }}
                            >
                              <i className="mb-0.5 h-1 w-8 rounded-full bg-terracotta" />
                            </span>
                          </>
                        ) : null}
                        <p
                          className={`truncate font-semibold leading-tight ${short ? 'text-[12.5px]' : 'text-[13px] lg:text-sm'} ${
                            m.is_public && !m.staged ? 'text-ink' : 'text-ink/60'
                          }`}
                        >
                          {m.label}
                          {isEventDay && m.run_state === 'live' ? (
                            <span className="ml-2 align-[1px] text-[9px] font-extrabold tracking-[0.16em] text-mulberry-700">
                              NOW
                            </span>
                          ) : null}
                          {isEventDay && m.run_state === 'done' ? (
                            <Check aria-label="done" className="ml-1.5 inline h-3 w-3 text-success-700" strokeWidth={2.5} />
                          ) : null}
                          {/* 🗓 Skipped on the day by the coordinator or their crew (Change the schedule) — said, never a ✓. */}
                          {m.run_state === 'skipped' ? (
                            <span className="ml-2 align-[1px] text-[9px] font-extrabold tracking-[0.16em] text-ink/60" data-moment-skipped="">
                              SKIPPED
                            </span>
                          ) : null}
                          {m.staged ? (
                            <span className="ml-2 align-[1px] text-[9px] font-extrabold tracking-[0.14em] text-terracotta-700">
                              STAGED · ONLY YOU
                            </span>
                          ) : null}
                        </p>
                        <p className="flex items-center gap-2 whitespace-nowrap font-mono text-[11px] text-ink/55">
                          <span>
                            {span.hasEnd || drag?.id === m.block_id
                              ? formatClockRange(span.startMin, span.endMin)
                              : `${formatClock(span.startMin)}${ch ? ' onward' : ''}`}
                          </span>
                          {!short && m.responsible_party ? (
                            <span className="hidden truncate font-sans text-ink/60 sm:inline">
                              · {m.responsible_party}
                            </span>
                          ) : null}
                          {!short && m.location && !ch ? (
                            <span className="hidden truncate font-sans text-ink/55 lg:inline">{m.location}</span>
                          ) : null}
                        </p>
                        {/* 📍 A chapter says where it is, on a phone too (prototype frame 1) — "Venue TBA" until it has one. */}
                        {ch && !short ? (
                          <p className="truncate text-[12.5px] text-ink/60" data-rail-where="">
                            {chapterWhere({ location: m.location, spot: null })}
                          </p>
                        ) : null}
                        {/* 🗓 The suppliers this item is given to — shop name ·
                            Booked / Shortlisted (owner 2026-10-20). One line, on
                            the phone too: it is who answers for the moment. */}
                        {!short && m.responsible_vendor_ids.length > 0
                          ? (() => {
                              const onIt = suppliers.filter((s) => m.responsible_vendor_ids.includes(s.vendor_id));
                              return onIt.length > 0 ? (
                                <p className="truncate text-[11px] text-ink/60" data-rail-supplier="">
                                  {onIt.map((s) => supplierOnItem(s)).join(', ')}
                                </p>
                              ) : null;
                            })()
                          : null}
                        {!short && parts.length > 0 && height > 84 ? (
                          <div className="mt-1.5 hidden flex-wrap gap-1 sm:flex">
                            {parts.map((p) => (
                              <span
                                key={p.block_id}
                                className="rounded-full bg-terracotta/15 px-2 py-0.5 text-[10px] font-semibold text-terracotta-700"
                              >
                                {p.label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {!m.staged ? (
                          <button
                            type="button"
                            aria-label={m.is_public ? 'Shown to guests — tap to hide' : 'Hidden from guests — tap to show'}
                            title={m.is_public ? 'Shown to guests · tap to hide' : 'Hidden from guests · tap to show'}
                            disabled={!canEdit}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleEye(m);
                            }}
                            className="sn-dot-btn absolute right-1.5 top-1/2 z-[3] grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-ink/45 hover:bg-ink/[0.06] hover:text-ink disabled:hover:bg-transparent"
                          >
                            {m.is_public ? (
                              <Eye aria-hidden className="h-4 w-4" strokeWidth={1.8} />
                            ) : (
                              <EyeOff aria-hidden className="h-4 w-4" strokeWidth={1.8} />
                            )}
                          </button>
                        ) : null}
                      </div>
                      )}
                      </RailSwipe>
                    );
                  })}

                  {drag && drag.moved && drag.dateKey === dateKey ? (
                    <div
                      aria-live="polite"
                      className="pointer-events-none absolute right-0 z-10 -translate-y-8 rounded-md bg-ink px-2 py-1 font-mono text-[11px] text-cream"
                      style={{ top: top(drag.preview.startMin) }}
                    >
                      <b className="text-terracotta-200">{formatClockRange(drag.preview.startMin, drag.preview.endMin)}</b>
                      {' · snaps to 5 min'}
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
          {/* 📖 Chapters with no time yet (owner 2026-11-01, "Time TBA"): listed under the rail — never drawn at a
              guessed hour. A tap opens the chapter. */}
          {tbaChapters.length > 0 ? (
            <ul data-chapters-tba="" className="ml-[54px] border-t border-ink/10 lg:ml-16 lg:max-w-[720px]">
              {tbaChapters.map((m) => (
                <li key={m.block_id} className="border-b border-ink/10">
                  <SwipeToDelete label={`Delete ${m.label}`} disabled={!(Boolean(ch) && canEdit)} hover={Boolean(ch) && canEdit} radiusClass="" onDelete={(close) => { close(); ch?.askDelete(m.block_id); }}>
                  <button
                    type="button"
                    data-chapter-tba={m.block_id}
                    onClick={() => ch?.open(m.block_id)}
                    className="sn-press flex min-h-14 w-full items-center gap-4 py-2 text-left"
                  >
                    <span className="w-20 flex-none text-[13px] text-ink/60">{TIME_TBA}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-ink">{m.label}</span>
                      <span className="block truncate text-[13px] text-ink/60">{chapterWhere({ location: m.location, spot: null })}</span>
                    </span>
                  </button>
                  </SwipeToDelete>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* THE SIDE — a wide screen only. Nothing selected: the day in
            numbers. Selected: the one inspector. On a phone the inspector is
            the panel below instead, so it is reachable at every width. */}
        {/* 🖥 Where chapters are drawn, a desktop's side is the page's own people column (slice 10), not this. */}
        {isDesktop && !inspectorSlot && !(booked && selected) && !ch ? (
          <aside className="sticky top-20 w-[380px] flex-none self-start">
            {side}
          </aside>
        ) : null}
      </div>

      {/* 🧩 In the Maker's Details the inspector is the right column's, at every width. */}
      {inspectorSlot ? <InSlot id={inspectorSlot}>{side}</InSlot> : null}

      {/* 🗂 A tapped moment opens in the Schedule's ONE pop-up (`schedule-sheet.tsx`, owner 2026-10-31 *"the pop up.
          design template."*) — the house sheet with its backdrop, rising from the bottom on a phone; under Booked, at
          every width (a drawer from the right on a computer, frame 19b). It was a hand-made panel of its own. */}
      {selected && !inspectorSlot && (!isDesktop || booked) ? (
        <ScheduleSheet
          open
          onClose={() => setSelectedId(null)}
          id="schedule-moment-title"
          title={canEdit ? 'Moment' : 'Moment · view only'}
          aside={selected.label}
          data="moment"
          foot={null}
        >
          <MomentInspector
            key={selected.block_id}
            eventId={eventId}
            eventType={eventType}
            moment={selected}
            parts={partsOf.get(selected.block_id) ?? []}
            suppliers={suppliers}
            rosEnabled={rosEnabled}
            canEdit={canEdit}
            canStage={canStage}
            request={requests.find((r) => r.block_id === selected.block_id) ?? null}
            onClose={() => setSelectedId(null)}
            onShift={() => setSheet({ kind: 'shift', fromId: selected.block_id })}
            onOpenRequests={() => setSheet({ kind: 'requests' })}
            onDeleted={() => setSelectedId(null)}
            onOverride={override}
            onRevert={revert}
            onConfirm={confirm}
            live={live}
            inSheet
            askDelete={askDelete?.id === selected.block_id ? askDelete.n : 0}
            onGone={hideMoment}
          />
        </ScheduleSheet>
      ) : null}

      {/* ＋ Under Booked the day's one add is the pill in the thumb zone (frame 19), not a button in a row up top. */}
      {booked && canEdit && (rails.length > 0 || ch) ? (
        <ScheduleAddPill
          label={ch ? 'Add a chapter' : 'Add a moment'}
          data={ch ? 'chapter' : 'moment'}
          view="event-day"
          hidden={selected !== null || Boolean(ch?.openId)}
          inlineOnDesktop={Boolean(ch)}
          onPress={() => openAdd(lastDateKey, topLevel.length > 0 ? snapMinutes(lastEnd, 15) : 14 * 60)}
        />
      ) : null}

      {addSheet}
      <ShiftSheet
        open={sheet?.kind === 'shift'}
        onClose={() => setSheet(null)}
        eventId={eventId}
        moments={merged}
        fromId={sheet?.kind === 'shift' ? sheet.fromId : null}
        onShifted={landShift}
      />
      <RequestsSheet
        open={sheet?.kind === 'requests'}
        onClose={() => setSheet(null)}
        eventId={eventId}
        requests={requests}
        moments={merged}
      />
      {hostPanel ? (
        <Sheet open={sheet?.kind === 'host'} onClose={() => setSheet(null)} labelledById="host-mc-title" wide rise>
          <div className="space-y-5 px-5 pb-6 pt-5">
            <h2 id="host-mc-title" className="pr-12 font-display text-[22px] leading-tight text-ink">
              Host / MC
            </h2>
            {hostPanel}
          </div>
        </Sheet>
      ) : null}
    </div>
      {/* ↩ The Undo toast a swiped-away part or moment leaves (owner 2026-11-03) — mounted with the day, so it outlives the inspector. */}
      <UndoToastHost />
    </DayActionsContext.Provider>
  );
}

/** Nothing selected, wide screen: the day at a glance, in numbers. */
function Glance({
  count,
  visible,
  staged,
  topLevel,
  requests,
  role,
  daysToGo,
  onRequests,
}: {
  count: number;
  visible: number;
  staged: number;
  topLevel: DayMoment[];
  requests: number;
  role: DayRole;
  /** Whole days until the event (prototype `.g-plan`); null past it or undated. */
  daysToGo: number | null;
  onRequests: () => void;
}) {
  let first = Infinity;
  let last = -Infinity;
  for (const m of topLevel) {
    const s = spanOf(m.start_at, m.end_at);
    first = Math.min(first, s.startMin);
    last = Math.max(last, s.endMin);
  }
  return (
    <div className="space-y-4 pt-2 font-display text-[21px] leading-snug text-ink/80">
      <p>
        <b className="font-normal text-ink">{formatCount(count)}</b> moment{count === 1 ? '' : 's'} ·{' '}
        <b className="font-normal text-ink">{visible}</b> shown to guests
        {staged > 0 ? (
          <span className="mt-0.5 block font-sans text-[12.5px] text-ink/55">{staged} staged, only you see them</span>
        ) : null}
      </p>
      {count > 0 && Number.isFinite(first) ? (
        <p>
          Your day runs <b className="font-normal text-ink">{formatClockRange(first, last)}</b>
          <span className="mt-0.5 block font-sans text-[12.5px] text-ink/55">{formatDuration(last - first)}</span>
        </p>
      ) : null}
      {daysToGo !== null && daysToGo > 0 ? (
        <p>
          <b className="font-normal text-ink">{daysToGo}</b> day{daysToGo === 1 ? '' : 's'} to go
        </p>
      ) : null}
      {role !== 'view' && requests > 0 ? (
        <p>
          <b className="font-normal text-ink">{formatCount(requests)}</b> supplier request{requests === 1 ? '' : 's'}
          <button
            type="button"
            onClick={onRequests}
            className="mt-0.5 block font-sans text-[12.5px] font-semibold text-terracotta-700 underline"
          >
            Review
          </button>
        </p>
      ) : null}
      <p className="flex items-center gap-2 font-sans text-[12.5px] text-ink/55">
        {role === 'view' ? (
          <>
            <Tip>You can see everything and change nothing. Ask a host if something needs changing.</Tip>
            View only
          </>
        ) : (
          <>
            <Tip>
              Tap a moment to edit it · drag it to move · drag its edge to change the length · tap an
              empty time to add one.
            </Tip>
            How to edit
          </>
        )}
      </p>
    </div>
  );
}

function NoDateYet({ canEdit, onAdd }: { canEdit: boolean; onAdd: () => void }) {
  return (
    <div className="py-10 text-center">
      <CalendarClock aria-hidden className="mx-auto mb-2 h-6 w-6 text-ink/35" strokeWidth={1.5} />
      <p className="text-sm font-medium text-ink">No moments yet.</p>
      {canEdit ? (
        <button
          type="button"
          onClick={onAdd}
          className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-cream"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} /> Add the first moment
        </button>
      ) : null}
    </div>
  );
}

/** An empty day: start from a template (into an empty schedule only) or tap a time. */
function EmptyRail({
  canEdit,
  templates,
  onTemplate,
}: {
  canEdit: boolean;
  templates: DayTemplate[];
  onTemplate: (id: string) => void;
}) {
  if (!canEdit) {
    return (
      <p className="absolute left-3.5 right-0 top-16 z-[8] text-sm text-ink/60">
        Nothing on the schedule yet.
      </p>
    );
  }
  return (
    <div className="absolute left-2.5 right-0 top-[4.5rem] z-[8] max-w-[520px] rounded-2xl bg-white/90 px-5 pb-4 pt-5 shadow-[0_28px_54px_-30px_rgba(30,26,18,0.5)] backdrop-blur lg:left-3.5 lg:px-7">
      {templates.length > 0 ? (
        <>
          <div className="flex items-center gap-2">
            <Eyebrow>Start from a template</Eyebrow>
            <Tip>A template loads into an empty schedule only — it never overwrites moments you have built.</Tip>
          </div>
          <p className="mb-3 mt-1.5 max-w-[38ch] text-[13.5px] text-ink/65">
            Nothing on the rail yet. Load a skeleton, then reshape every moment — or tap a time on the rail.
          </p>
          <ul>
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onTemplate(t.id)}
                  className="-mx-2.5 flex w-[calc(100%+1.25rem)] items-center justify-between gap-3 rounded-md border-b border-ink/[0.06] px-2.5 py-3 text-left hover:bg-ink/[0.05]"
                >
                  <span>
                    <b className="block text-[14.5px] font-semibold text-ink">{t.label}</b>
                    <small className="text-xs text-ink/55">{t.description}</small>
                  </span>
                  <span className="whitespace-nowrap font-mono text-[11px] text-ink/55">{formatCount(t.count)} moments</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-[13.5px] text-ink/65">Nothing on the rail yet — tap a time to add the first moment.</p>
      )}
      <ChaptersExample />
    </div>
  );
}

/**
 * 👻 THE EVENT DAY'S EXAMPLE (Build 5 Lane H; owner 2026-11-09, DECISION_LOG 🧱👻 ×2; prototype frame "Event ·
 * Schedule"): three sample chapters on the rail's own hour column and block — the time, the chapter, where and how long,
 * and the time free between them (`lib/empty-look-samples.ts`), greyed under "Example". Drawn only by `EmptyRail`, which
 * the rail mounts on a day it READ with no moments on it; the "+ Add a chapter" pill stays the door.
 */
export function ChaptersExample() {
  return (
    <ExamplePreview className="mt-3">
      <ol className="flex flex-col">
        {SAMPLE_CHAPTERS.map((c) => (
          <li key={c.name} className="flex min-h-14 gap-3">
            <span className="w-[52px] flex-none pt-1 text-right text-[11.5px] tabular-nums text-ink/55">{c.time}</span>
            <span className="relative min-w-0 flex-1 border-l-[1.5px] border-ink/10 pb-2 pl-3">
              <span aria-hidden className="absolute -left-[5px] top-2 h-2 w-2 rounded-full bg-ink/45" />
              <span className="block rounded-xl border-l-[3px] border-ink/40 bg-ink/[0.06] px-2.5 py-2 text-[13.5px] font-semibold text-ink">
                {c.name}
                <small className="block text-[11.5px] font-normal text-ink/55">{c.place}</small>
              </span>
              {c.gap ? <span className="block py-1.5 text-[11.5px] text-ink/55">{c.gap}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </ExamplePreview>
  );
}

/** One row of ⚙ Schedule settings: an icon, the tool's words, the whole row pressable. Closes the settings first. */
function SettingsRow({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      data-settings-closes=""
      onClick={onClick}
      className="sn-press flex min-h-14 w-full items-center gap-3 border-b border-ink/10 text-left text-[15px] text-ink"
    >
      <span className="grid h-9 w-9 flex-none place-items-center rounded-full border border-ink/15 text-ink/75">{children}</span>
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  );
}

/**
 * 🗑 A CHAPTER ON THE RAIL SWIPES LEFT TO DELETE (owner 2026-11-03, prototype frame 3) — the shared gesture
 * (`app/_components/swipe-to-delete.tsx`) on a block that places itself: the revealed Delete sits behind it at the
 * same height, and asks (the page's warning, then Undo). Off for the Maker, a lens, a staged block and anyone who may
 * not edit — those blocks are exactly as they were.
 */
function RailSwipe({
  enabled,
  label,
  top,
  height,
  onDelete,
  children,
}: {
  enabled: boolean;
  label: string;
  top: number;
  height: number;
  onDelete: () => void;
  children: (swipe: ReturnType<typeof useSwipeReveal> | null) => React.ReactNode;
}) {
  const swipe = useSwipeReveal({ enabled });
  if (!enabled) return <>{children(null)}</>;
  return (
    <>
      {swipe.tx !== 0 ? (
        <SwipeDeleteButton
          label={label}
          open={swipe.open}
          onDelete={() => {
            swipe.close();
            onDelete();
          }}
          className="absolute right-0 z-[1] rounded-md"
          style={{ top, height }}
        />
      ) : null}
      {children(swipe)}
    </>
  );
}

/**
 * 📖 The chapters laid on the day's top-level blocks: a chapter made, renamed, moved or deleted on its page is on the
 * rail at once (those saves are quiet — no render brings them). A block the chapters no longer hold is gone with its
 * moments; a chapter not among the blocks yet is added. `null` (no chapters here — the Maker): the blocks as they are.
 */
function withChapters(blocks: DayMoment[], chapters: readonly Chapter[] | null): DayMoment[] {
  if (!chapters) return blocks;
  const byId = new Map(chapters.map((c) => [c.block_id, c]));
  const kept = blocks.filter((b) => (b.parent_block_id ? byId.has(b.parent_block_id) || !blocks.some((x) => x.block_id === b.parent_block_id) : byId.has(b.block_id)));
  const out = kept.map((b) => {
    const c = b.parent_block_id ? null : byId.get(b.block_id);
    return c ? { ...b, label: c.label, start_at: c.start_at, end_at: c.end_at, location: c.location, is_public: c.is_public, time_tba: c.time_tba === true } : b;
  });
  for (const c of chapters) {
    if (blocks.some((b) => b.block_id === c.block_id)) continue;
    out.push({
      block_id: c.block_id,
      label: c.label,
      block_type: (c.block_type as DayMoment['block_type'] | null | undefined) ?? 'custom',
      start_at: c.start_at,
      end_at: c.end_at,
      location: c.location,
      notes: c.notes,
      is_public: c.is_public,
      parent_block_id: null,
      run_state: 'upcoming',
      staged: false,
      responsible_party: null,
      responsible_vendor_ids: [],
      audience: null,
      time_tba: c.time_tba === true,
    });
  }
  return out;
}

/** The empty stretches BETWEEN chapters (never before the first or after the last), 30 minutes or more. */
function betweenChapters(spans: readonly RailSpan[]): { startMin: number; endMin: number }[] {
  const sorted = [...spans].sort((a, b) => a.startMin - b.startMin);
  const out: { startMin: number; endMin: number }[] = [];
  let reach = -Infinity;
  for (const s of sorted) {
    if (reach > -Infinity && s.startMin - reach >= 30) out.push({ startMin: reach, endMin: s.startMin });
    reach = Math.max(reach, s.endMin);
  }
  return out;
}
