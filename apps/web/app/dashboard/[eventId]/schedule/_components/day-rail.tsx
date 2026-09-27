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

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import {
  CalendarClock,
  Check,
  Eye,
  EyeOff,
  MessageSquare,
  Mic,
  MoveVertical,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { useIsDesktop } from '@/lib/use-responsive';
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
import { DayActionsContext, PHASE_TINT, Eyebrow, Tip, ToolButton, toFormData } from './day-ui';
import { MomentInspector } from './moment-inspector';
import { AddMomentSheet, RequestsSheet, ShiftSheet } from './day-sheets';

type SheetState =
  | { kind: 'add'; dateKey: string | null; startMin: number }
  | { kind: 'shift'; fromId: string | null }
  | { kind: 'requests' }
  | { kind: 'host' }
  | null;

type Lens = { kind: 'all' } | { kind: 'guest' } | { kind: 'vendor'; id: string };

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
  emcee,
  hostPanel,
  actions,
}: {
  /** The existing server actions in `../actions`, handed down by the page. */
  actions: DayActions;
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
  const { bulkRetimeScheduleBlocks, loadScheduleTemplate, toggleBlockVisibility, updateScheduleBlock } =
    actions;
  const isDesktop = useIsDesktop();
  const hourPx = isDesktop ? 68 : 64;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Partial<DayMoment>>>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [lens, setLens] = useState<Lens>({ kind: 'all' });
  const [lensOpen, setLensOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [now, setNow] = useState<{ key: string; min: number } | null>(null);

  // A fresh server answer supersedes every optimistic guess.
  useEffect(() => {
    setOverrides({});
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
    () => moments.map((m) => ({ ...m, ...(overrides[m.block_id] ?? {}) })),
    [moments, overrides],
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

  const rails = useMemo(() => {
    const grouped = groupByWallDate(topLevel);
    if (grouped.length === 0 && eventDateKey) return [{ dateKey: eventDateKey, rows: [] }];
    return grouped;
  }, [topLevel, eventDateKey]);

  const selected = merged.find((m) => m.block_id === selectedId) ?? null;
  const visibleCount = topLevel.filter((m) => m.is_public && !m.staged).length;
  const stagedCount = topLevel.filter((m) => m.staged).length;
  const taggedSuppliers = suppliers.filter((s) =>
    merged.some((m) => m.responsible_vendor_ids.includes(s.vendor_id)),
  );

  function override(id: string, patch: Partial<DayMoment>) {
    setOverrides((o) => ({ ...o, [id]: { ...(o[id] ?? {}), ...patch } }));
  }
  function revert(ids: string[]) {
    setOverrides((o) => {
      const next = { ...o };
      for (const id of ids) delete next[id];
      return next;
    });
  }

  /** Run a write; on a refusal, undo the guess and say so. */
  function write(ids: string[], run: () => Promise<unknown>) {
    setNotice(null);
    startTransition(async () => {
      try {
        await run();
      } catch {
        revert(ids);
        setNotice(COULD_NOT_SAVE);
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
    setSelectedId((cur) => (cur === m.block_id ? null : m.block_id));
  }

  function openAdd(dateKey: string | null, startMin: number) {
    if (!canEdit) return;
    setSelectedId(null);
    setSheet({ kind: 'add', dateKey, startMin });
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
        : (suppliers.find((s) => s.vendor_id === lens.id)?.vendor_name ?? 'Supplier');

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <DayActionsContext.Provider value={actions}>
    <div className="space-y-3" data-schedule-day="">
      {/* THE DAY'S TOOLS — one row; names live in aria-label/title, the
          explanation lives behind the ⓘ, never in a paragraph above the rail. */}
      <div className="relative flex flex-wrap items-center gap-1">
        {topLevel.length > 0 ? (
          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={lensOpen}
              onClick={() => setLensOpen((v) => !v)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink/75 ring-1 ring-inset ring-ink/15 hover:bg-ink/[0.05]"
            >
              <SlidersHorizontal aria-hidden className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span className="sr-only">View as: </span>
              {lensLabel}
              <span aria-hidden className="text-ink/45">▾</span>
            </button>
            {lensOpen ? (
              <div
                role="menu"
                className="absolute left-0 top-11 z-[45] w-64 rounded-2xl bg-white/95 p-2 shadow-[0_28px_54px_-30px_rgba(30,26,18,0.5)] ring-1 ring-ink/10 backdrop-blur"
              >
                <div className="flex items-center justify-between px-2 pb-2 pt-1">
                  <Eyebrow>View as</Eyebrow>
                  <Tip align="end">
                    Every view is a live filter over this one timeline. Change the master; each
                    view follows.
                  </Tip>
                </div>
                <LensOption
                  label="Master"
                  hint="everything"
                  on={lens.kind === 'all'}
                  onPick={() => {
                    setLens({ kind: 'all' });
                    setLensOpen(false);
                  }}
                />
                <LensOption
                  label="Guests"
                  hint="what the Event Hub shows"
                  on={lens.kind === 'guest'}
                  onPick={() => {
                    setLens({ kind: 'guest' });
                    setSelectedId(null);
                    setLensOpen(false);
                  }}
                />
                {rosEnabled
                  ? taggedSuppliers.map((s) => {
                      const n = topLevel.filter((m) => m.responsible_vendor_ids.includes(s.vendor_id)).length;
                      return (
                        <LensOption
                          key={s.vendor_id}
                          label={s.vendor_name}
                          hint={`${n} moment${n === 1 ? '' : 's'}`}
                          on={lens.kind === 'vendor' && lens.id === s.vendor_id}
                          onPick={() => {
                            setLens({ kind: 'vendor', id: s.vendor_id });
                            setSelectedId(null);
                            setLensOpen(false);
                          }}
                        />
                      );
                    })
                  : null}
              </div>
            ) : null}
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
          {canEdit ? (
            <button
              type="button"
              onClick={() =>
                openAdd(lastDateKey, topLevel.length > 0 ? snapMinutes(lastEnd, 15) : 14 * 60)
              }
              aria-label="Add moment"
              className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-2.5 text-[13px] font-semibold text-cream hover:bg-black sm:px-3.5"
            >
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
              <span className="hidden sm:inline">Add moment</span>
            </button>
          ) : null}
        </div>
      </div>

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

      <div className="lg:flex lg:items-start lg:gap-6">
        <div className="min-w-0 flex-1 space-y-8">
          {rails.length === 0 ? (
            <NoDateYet canEdit={canEdit} onAdd={() => openAdd(null, 14 * 60)} />
          ) : null}
          {rails.map(({ dateKey, rows }) => {
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
            const gaps = canEdit && lens.kind === 'all' ? findGaps([...spans.values()], railStart, railEnd) : [];
            const top = (min: number) => ((min - railStart) / 60) * hourPx;
            const nowOnRail = isEventDay && now && now.key === dateKey && now.min >= railStart && now.min <= railEnd;
            const dayVisible = rows.filter((m) => m.is_public && !m.staged).length;
            const dayStaged = rows.filter((m) => m.staged).length;
            return (
              <section key={dateKey} aria-label={formatDateHeading(dateKey)}>
                <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 pb-2 pl-[54px] lg:pl-16">
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
                      className="absolute left-2.5 right-0 z-[1] grid place-items-center rounded-md text-xs font-semibold text-ink/30 transition-colors hover:bg-terracotta/10 hover:text-terracotta-700 hover:ring-1 hover:ring-inset hover:ring-terracotta/40 lg:left-3.5"
                      style={{ top: top(g.startMin) + 2, height: Math.max(((g.endMin - g.startMin) / 60) * hourPx - 6, 18) }}
                    >
                      <span>
                        ＋ <span className="font-mono">{formatClock(g.startMin)}</span>
                      </span>
                    </button>
                  ))}

                  {rows.length === 0 ? (
                    <EmptyRail
                      canEdit={canEdit}
                      templates={templates}
                      onTemplate={(id) =>
                        write([], () => loadScheduleTemplate(toFormData({ event_id: eventId, template_id: id })))
                      }
                    />
                  ) : null}

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
                            className={`absolute z-[6] flex items-center overflow-hidden whitespace-nowrap rounded-md border-[1.5px] border-dashed border-mulberry bg-mulberry-50 px-2.5 text-[11.5px] font-semibold text-mulberry-700 ${
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
                      <div
                        key={m.block_id}
                        role="button"
                        tabIndex={faded ? -1 : 0}
                        aria-pressed={isSel}
                        aria-label={`${m.label}, ${formatClockRange(span.startMin, span.endMin)}${m.is_public ? '' : ', hidden from guests'}`}
                        onClick={() => onMomentClick(m)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedId((cur) => (cur === m.block_id ? null : m.block_id));
                          }
                        }}
                        onPointerDown={(e) => beginDrag(e, m, dateKey, spans.get(m.block_id)!, 'move')}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                        onPointerCancel={cancelDrag}
                        className={`group absolute z-[2] flex overflow-hidden rounded-md text-left transition-[box-shadow,opacity,transform] ${
                          short ? 'flex-row items-center gap-2.5 py-0' : 'flex-col py-2'
                        } pl-3 pr-10 ${
                          m.staged
                            ? 'bg-ink/[0.03] outline-dashed outline-[1.5px] -outline-offset-2 outline-terracotta'
                            : m.is_public
                              ? 'bg-white shadow-[0_1px_2px_rgba(40,34,24,0.05),0_18px_40px_-26px_rgba(30,26,18,0.4)]'
                              : 'bg-ink/[0.03] ring-1 ring-inset ring-ink/[0.07]'
                        } ${isSel || isDragging ? 'z-[5] translate-x-0.5 ring-2 ring-terracotta' : ''} ${
                          isDragging ? 'cursor-grabbing shadow-2xl' : canEdit ? 'cursor-pointer' : ''
                        } ${faded ? 'pointer-events-none opacity-[0.14]' : isEventDay && m.run_state === 'done' ? 'opacity-60' : ''} ${
                          isEventDay && m.run_state === 'live' ? 'ring-[1.5px] ring-mulberry' : ''
                        }`}
                        style={{
                          top: top(span.startMin),
                          height,
                          left,
                          width,
                          touchAction: isSel && canEdit ? 'none' : undefined,
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
                              : formatClock(span.startMin)}
                          </span>
                          {!short && m.responsible_party ? (
                            <span className="hidden truncate font-sans text-ink/60 sm:inline">
                              · {m.responsible_party}
                            </span>
                          ) : null}
                          {!short && m.location ? (
                            <span className="hidden truncate font-sans text-ink/55 lg:inline">{m.location}</span>
                          ) : null}
                        </p>
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
                            className="absolute right-1.5 top-1/2 z-[3] grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-ink/45 hover:bg-ink/[0.06] hover:text-ink disabled:hover:bg-transparent"
                          >
                            {m.is_public ? (
                              <Eye aria-hidden className="h-4 w-4" strokeWidth={1.8} />
                            ) : (
                              <EyeOff aria-hidden className="h-4 w-4" strokeWidth={1.8} />
                            )}
                          </button>
                        ) : null}
                      </div>
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
        </div>

        {/* THE SIDE — a wide screen only. Nothing selected: the day in
            numbers. Selected: the one inspector. On a phone the inspector is
            the panel below instead, so it is reachable at every width. */}
        {isDesktop ? (
          <aside className="sticky top-20 w-[380px] flex-none self-start">
            {selected ? (
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
              />
            ) : (
              <Glance
                count={topLevel.length}
                visible={visibleCount}
                staged={stagedCount}
                topLevel={topLevel}
                requests={requests.length}
                role={role}
                onRequests={() => setSheet({ kind: 'requests' })}
              />
            )}
          </aside>
        ) : null}
      </div>

      {!isDesktop && selected ? (
        <div
          role="dialog"
          aria-label={`Moment: ${selected.label}`}
          className="fixed inset-x-0 bottom-0 z-[60] max-h-[62dvh] overflow-y-auto rounded-t-3xl bg-cream pb-[max(env(safe-area-inset-bottom),16px)] shadow-[0_-20px_50px_-30px_rgba(30,26,18,0.6)] ring-1 ring-ink/10"
        >
          <span aria-hidden className="mx-auto mt-2 block h-1 w-9 rounded-full bg-ink/15" />
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
          />
        </div>
      ) : null}

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
      <ShiftSheet
        open={sheet?.kind === 'shift'}
        onClose={() => setSheet(null)}
        eventId={eventId}
        moments={merged}
        fromId={sheet?.kind === 'shift' ? sheet.fromId : null}
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
    </DayActionsContext.Provider>
  );
}

function LensOption({
  label,
  hint,
  on,
  onPick,
}: {
  label: string;
  hint: string;
  on: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={on}
      onClick={onPick}
      className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2.5 text-left text-[13px] font-medium text-ink hover:bg-ink/[0.06]"
    >
      <span>
        {label} <small className="text-[11px] text-ink/55">· {hint}</small>
      </span>
      <i
        aria-hidden
        className={`h-2 w-2 rounded-full ${on ? 'bg-ink' : 'ring-1 ring-inset ring-ink/40'}`}
      />
    </button>
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
  onRequests,
}: {
  count: number;
  visible: number;
  staged: number;
  topLevel: DayMoment[];
  requests: number;
  role: DayRole;
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
        <b className="font-normal text-ink">{count}</b> moment{count === 1 ? '' : 's'} ·{' '}
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
      {role !== 'view' && requests > 0 ? (
        <p>
          <b className="font-normal text-ink">{requests}</b> supplier request{requests === 1 ? '' : 's'}
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
                  <span className="whitespace-nowrap font-mono text-[11px] text-ink/55">{t.count} moments</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-[13.5px] text-ink/65">Nothing on the rail yet — tap a time to add the first moment.</p>
      )}
    </div>
  );
}
