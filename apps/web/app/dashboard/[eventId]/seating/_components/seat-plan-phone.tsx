'use client';

import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Armchair, ArrowRight, Check, ChevronDown, ChevronRight, Link2, MoreHorizontal, RotateCw, Sparkles, Trash2, Ungroup } from 'lucide-react';
import { formatCount } from '@/lib/format-number';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import type { PickOption } from '../../website/editor/_components/pick-menu-types';
import { OneOpenScope, useOneOpen } from '@/lib/one-open';
import { ActionButton } from '@/components/action-button';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { ChosenRow, FormRows, TypedRow } from '@/app/_components/form-row';

/**
 * 📱 THE SEAT PLAN ON A PHONE — its chrome (owner 2026-10-01, DECISION_LOG
 * "SEAT PLAN + WALKING ORDER DESIGN — APPROVED"; frames 1–4 of
 * prototypes/seat_plan_and_walking_order_2026-10-01_fable.html).
 *
 * PRESENTATIONAL ONLY. The seating editor (`seating-editor.tsx`) keeps every
 * piece of state and every save; it hands these pieces words it COUNTED
 * (`seatPlanHeadline`, the Unseated count, the Auto arrange line) and the
 * handlers it already has. This file lives in the editor's own lazy chunk
 * (`seating-lazy.tsx` → `maker-seating`), so it adds nothing to the shared
 * bundle or to the Maker's first load.
 *
 *   PhoneSeatPlanHead — "Seat plan · N tables", one status line, the Auto
 *     arrange line (+ Undo), Auto arrange + Rules ▾, Unseated: N › and 2D ▾,
 *     with ⋯ holding Add a table/element · Share & print.
 *   PhoneSeatPlanFoot — under the plan: the room in one line, and "Same layout
 *     in 3D ↗" (one layout, two views).
 *   MoveGuestSheet — tap a guest → "Move Ana to…" with ONE Table ▾ (only
 *     tables with room, or + New table) → Move. No drag on a phone.
 */

/**
 * 🔔 The Auto arrange line (and its Undo) — the template's toast (`PeekToast`: peeks from the top, one Undo action, leaves by itself and tells the editor, which then
 * forgets the line). Its Dismiss ✕ is the toast's own leaving.
 */
function SeatToast({ toast }: { toast: { text: string; onUndo: (() => void) | null; onDismiss: () => void } }) {
  return (
    <PeekToast key={toast.text} data="seat-plan" onGone={toast.onDismiss} action={toast.onUndo ? { label: 'Undo', onPress: toast.onUndo } : undefined}>
      {toast.text}
    </PeekToast>
  );
}

/** Auto arrange — the screen's forward step: THE ONE ActionButton (a waiting button while it arranges), with the editor's own handler. */
function AutoArrange({ onAutoArrange, disabled, busy }: { onAutoArrange: () => void; disabled: boolean; busy: boolean }) {
  return (
    <span data-seat-plan-auto="" className="flex min-w-0 flex-1">
      <ActionButton tone="brand" main waiting={busy} disabled={disabled && !busy} icon={Sparkles} label={busy ? 'Arranging…' : 'Auto arrange'} onClick={onAutoArrange} className="w-full" />
    </span>
  );
}

/** A tap-to-open popover (Rules ▾ and ⋯) — solid surface, closes on a tap outside. */
function Pop({
  button,
  label,
  children,
  align = 'left',
  data,
}: {
  button: ReactNode;
  label: string;
  children: ReactNode;
  align?: 'left' | 'right';
  data: string;
}) {
  const [open, setOpen] = useState(false);
  const oneOpenId = useOneOpen(open, setOpen); // one open at a time — lib/one-open.ts; what opens inside is its child
  return (
    <OneOpenScope id={oneOpenId}>
      <div className="relative shrink-0">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={label}
          onClick={() => setOpen((v) => !v)}
          {...{ [data]: '' }}
          className="sn-press inline-flex h-11 items-center gap-1 rounded-full border border-ink/15 bg-cream px-3.5 text-[13px] font-medium text-ink"
        >
          {button}
        </button>
        {open ? (
          <>
            <button type="button" aria-hidden tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
            <div
              role="menu"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('[data-close]')) setOpen(false);
              }}
              className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} z-50 mt-1 w-[min(20rem,calc(100vw-2rem))] max-h-[65dvh] overflow-y-auto overscroll-contain rounded-xl bg-cream p-2 shadow-lg`}
            >
              {children}
            </div>
          </>
        ) : null}
      </div>
    </OneOpenScope>
  );
}

export function PhoneSeatPlanHead({
  countLabel,
  status,
  unseated,
  onUnseated,
  onAutoArrange,
  autoDisabled,
  autoBusy,
  rules,
  more,
  view,
  onView,
  show3D,
  toast,
  trailing,
}: {
  /** "10 tables" — counted units, already worded (`seatPlanHeadline`). */
  countLabel: string;
  /** "Standard room · 102 seated · guests see it on the day." */
  status: string;
  /** The Unseated section's own count — the chip opens that list. */
  unseated: number;
  onUnseated: () => void;
  onAutoArrange: () => void;
  autoDisabled: boolean;
  autoBusy: boolean;
  /** Behind Rules ▾ — one dropdown per role, the couple's own role words. */
  rules: ReactNode;
  /** Behind ⋯ — Add a table/element · Share & print (and the room's settings). */
  more: ReactNode;
  view: '2d' | '3d' | 'list';
  onView: (v: '2d' | '3d' | 'list') => void;
  show3D: boolean;
  /** The Auto arrange line — the server's counts — with Undo while it can be undone. */
  toast: { text: string; onUndo: (() => void) | null; onDismiss: () => void } | null;
  /** The save chip, the view-only pill, the notices badge — as the bar had them. */
  trailing?: ReactNode;
}) {
  const views: PickOption[] = [
    { key: '2d', label: '2D' },
    ...(show3D ? [{ key: '3d', label: '3D' }] : []),
    { key: 'list', label: 'List' },
  ];
  return (
    <div data-seat-plan-phone-head="" className="flex shrink-0 flex-col gap-2 border-b border-ink/10 bg-cream px-4 pb-3 pt-2">
      {/* 🪜 In the Maker's guided flow the step ▾ already names it: no title, no
          count, no status line — the tool's head is its controls only (owner
          2026-10-05: "crowded above the sheet"). */}
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 truncate font-display text-[26px] leading-tight text-ink group-data-[details-mode=guided]/ws:hidden">Seat plan</h2>
        <span data-seat-plan-count="" className="shrink-0 rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[11px] tabular-nums text-ink/60 group-data-[details-mode=guided]/ws:hidden">
          {countLabel}
        </span>
        <span className="flex-1" />
        {trailing}
        <Pop
          label="More seat-plan tools"
          align="right"
          data="data-seat-plan-more"
          button={<MoreHorizontal aria-hidden className="h-5 w-5" strokeWidth={1.75} />}
        >
          {more}
        </Pop>
      </div>
      <p data-seat-plan-status="" className="text-[12.5px] leading-snug text-ink/60 group-data-[details-mode=guided]/ws:hidden">
        {status}
      </p>
      {toast ? <SeatToast toast={toast} /> : null}
      <div className="flex items-center gap-2">
        <AutoArrange onAutoArrange={onAutoArrange} disabled={autoDisabled} busy={autoBusy} />
        <Pop
          label="Who sits together"
          align="right"
          data="data-seat-plan-rules"
          button={
            <>
              Rules <ChevronDown aria-hidden className="h-3.5 w-3.5 text-ink/45" />
            </>
          }
        >
          {rules}
        </Pop>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onUnseated}
          data-seat-plan-unseated=""
          className={`sn-press inline-flex h-9 items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold ${
            unseated > 0 ? 'bg-terracotta/15 text-terracotta-800' : 'bg-success-50 text-success-700'
          }`}
        >
          Unseated: {formatCount(unseated)}
          <ChevronRight aria-hidden className="h-3.5 w-3.5" />
        </button>
        <span className="flex-1" />
        <PickMenu label="View" value={view} options={views} onPick={(k) => onView(k as '2d' | '3d' | 'list')} dataAttr="data-seat-plan-view" compact className="border border-ink/15" />
      </div>
    </div>
  );
}

export function PhoneSeatPlanFoot({ room, onOpen3D }: { room: string; onOpen3D: (() => void) | null }) {
  return (
    <div data-seat-plan-phone-foot="" className="flex shrink-0 flex-col gap-2 border-t border-ink/10 bg-cream px-4 py-2">
      <p className="flex items-center justify-between gap-2 text-[11px] text-ink/55 group-data-[details-mode=guided]/ws:hidden">
        <span className="min-w-0 truncate">{room}</span>
        <span className="shrink-0">pinch to zoom · tap a table</span>
      </p>
      {onOpen3D ? (
        <button
          type="button"
          onClick={onOpen3D}
          data-seat-plan-3d-door=""
          className="sn-press flex min-h-12 items-center gap-3 rounded-xl border border-ink/10 bg-ink/[0.02] px-3 py-2 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-mulberry-700">Same layout in 3D ↗</span>
            <span className="block text-[11.5px] text-ink/60">One plan, two views. Move a table here and it moves there.</span>
          </span>
        </button>
      ) : null}
    </div>
  );
}

export function MoveGuestSheet({
  firstName,
  fullName,
  initial,
  sub,
  options,
  value,
  onPick,
  partyNote,
  onMove,
  onClose,
  busy,
}: {
  firstName: string;
  fullName: string;
  initial: string;
  /** "Bride's Crew · now at Table 7" — their role and where they sit, from data. */
  sub: string;
  /** Only tables with room (+ the one they sit at), then "+ New table". */
  options: readonly PickOption[];
  value: string | null;
  onPick: (key: string) => void;
  /** "Her +1, Mr. Carlo Dela Cruz, moves with her." — null when nobody moves with them. */
  partyNote: string | null;
  onMove: () => void;
  onClose: () => void;
  busy: boolean;
}) {
  // Portalled to <body>: the Maker's panes may transform, and a fixed sheet
  // inside a transformed parent would be clipped to it.
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div data-seat-plan-move="" className="fixed inset-0 z-[80] flex flex-col justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/35" />
      <div role="dialog" aria-label={`Move ${firstName} to…`} className="relative flex flex-col gap-3 rounded-t-2xl bg-cream px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-xl">
        <span aria-hidden className="mx-auto h-1 w-10 rounded-full bg-ink/15" />
        <h3 className="font-display text-xl text-ink">Move {firstName} to…</h3>
        <div className="flex items-center gap-3 border-b border-ink/10 pb-3">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracotta/15 font-display text-terracotta-800">
            {initial}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] text-ink">{fullName}</span>
            <span className="block truncate text-[12px] text-ink/55">{sub}</span>
          </span>
        </div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/50">Table</p>
        <PickMenu label="Table" value={value} options={options} onPick={onPick} dataAttr="data-seat-plan-move-table" className="w-full border border-ink/20" />
        <p className="text-[12px] text-ink/60">
          {partyNote ? `${partyNote} ` : ''}Only tables with room are listed.
        </p>
        <span data-seat-plan-move-go="" className="flex">
          <ActionButton tone="brand" main waiting={busy} disabled={value === null && !busy} icon={ArrowRight} label="Move" onClick={onMove} className="w-full" />
        </span>
      </div>
    </div>,
    document.body,
  );
}

/*
 * 🧭 STUDIO › SEAT PLAN — THE MAP GETS THE SPACE (owner 2026-10-08, studio round 3, verbatim:
 * *"seatplan has correct page but wrong balance. there is no space to see the whole seatplan"*).
 * Drawn only in the new Maker's Studio on a phone; the shipped head and foot above stay for
 * everyone else. The SAME handlers and counts the editor hands the shipped head — nothing new is
 * saved, nothing is counted twice:
 *
 *   StudioSeatPlanHead  — ONE compact row: "Seat plan · N tables" · the save chip · ⋯
 *   StudioSeatPlanTools — the thumb zone, over the foot of the map: Auto arrange · Rules ▾ · View ▾
 *                         (2D · 3D · List — the view dropdown covers "Same layout in 3D ↗")
 *   PeopleSheet         — the people list as a pull-up sheet over the map, its peek
 *                         "32 guests · 0 unseated"; a tap (or a drag up) raises it, ⌄ lowers it.
 */
export function StudioSeatPlanHead({
  countLabel,
  more,
  trailing,
}: {
  countLabel: string;
  more: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div data-seat-plan-studio-head="" className="flex h-11 shrink-0 items-center gap-2 border-b border-ink/10 bg-cream px-3">
      <h2 className="min-w-0 truncate text-[15px] font-semibold text-ink">
        Seat plan <span className="font-normal text-ink/55">· </span>
        <span data-seat-plan-count="" className="font-normal tabular-nums text-ink/60">
          {countLabel}
        </span>
      </h2>
      <span className="flex-1" />
      {trailing}
      <Pop
        label="More seat-plan tools"
        align="right"
        data="data-seat-plan-more"
        button={<MoreHorizontal aria-hidden className="h-5 w-5" strokeWidth={1.75} />}
      >
        {more}
      </Pop>
    </div>
  );
}

export function StudioSeatPlanTools({
  onAutoArrange,
  autoDisabled,
  autoBusy,
  rules,
  view,
  onView,
  show3D,
  toast,
}: {
  onAutoArrange: () => void;
  autoDisabled: boolean;
  autoBusy: boolean;
  rules: ReactNode;
  view: '2d' | '3d' | 'list';
  onView: (v: '2d' | '3d' | 'list') => void;
  show3D: boolean;
  toast: { text: string; onUndo: (() => void) | null; onDismiss: () => void } | null;
}) {
  const views: PickOption[] = [
    { key: '2d', label: '2D' },
    ...(show3D ? [{ key: '3d', label: '3D' }] : []),
    { key: 'list', label: 'List' },
  ];
  return (
    <div data-seat-plan-studio-tools="" className="flex flex-col gap-2">
      {toast ? <SeatToast toast={toast} /> : null}
      {/* 🪟 The floating row is glass (`sn-glass-row`, BUTTON_RULE Rule 7) — no fill, no shadow of its own. */}
      <div className="sn-glass-row flex items-center gap-2 rounded-full p-1">
        {/* BUTTON-RULE — Auto arrange is the forward step (terracotta). */}
        <AutoArrange onAutoArrange={onAutoArrange} disabled={autoDisabled} busy={autoBusy} />
        <Pop
          label="Who sits together"
          align="right"
          data="data-seat-plan-rules"
          button={
            <>
              Rules <ChevronDown aria-hidden className="h-3.5 w-3.5 text-ink/45" />
            </>
          }
        >
          {rules}
        </Pop>
        <PickMenu label="View" value={view} options={views} onPick={(k) => onView(k as '2d' | '3d' | 'list')} dataAttr="data-seat-plan-view" compact className="h-11 border border-ink/15 bg-cream" />
      </div>
    </div>
  );
}

export function PeopleSheet({
  guests,
  unseated,
  open,
  onOpen,
  onClose,
  tools,
  children,
}: {
  /** Everyone on the list the plan seats — `guests.length`, counted by the editor. */
  guests: number;
  /** The Unseated section's own count (the shipped head's chip). */
  unseated: number;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** The thumb-zone tools, riding just above the peek. */
  tools: ReactNode;
  /** The people list — the editor's own `guestsNode`, never a copy. */
  children: ReactNode;
}) {
  const peek = `${formatCount(guests)} ${guests === 1 ? 'guest' : 'guests'} · ${formatCount(unseated)} unseated`;
  /* A drag up on the peek raises the sheet, a drag down on its grip lowers it (no library — two numbers). */
  const [startY, setStartY] = useState<number | null>(null);
  const swipe = (endY: number) => {
    if (startY === null) return;
    const dy = endY - startY;
    setStartY(null);
    if (!open && dy < -24) onOpen();
    if (open && dy > 24) onClose();
  };
  return (
    <div
      data-seat-plan-people={open ? 'open' : 'peek'}
      className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col justify-end"
      style={{ top: open ? 0 : undefined }}
    >
      {open ? null : <div className="pointer-events-auto px-3 pb-2">{tools}</div>}
      <div
        className={`pointer-events-auto flex min-h-0 flex-col rounded-t-2xl border-t border-ink/10 bg-cream ${open ? 'h-[72%] shadow-[0_-12px_30px_-18px_rgba(26,26,26,0.35)]' : ''}`}
      >
        <button
          type="button"
          aria-expanded={open}
          data-seat-plan-people-peek=""
          onClick={open ? onClose : onOpen}
          onPointerDown={(e) => setStartY(e.clientY)}
          onPointerUp={(e) => swipe(e.clientY)}
          className="flex min-h-12 w-full shrink-0 flex-col items-center justify-center gap-1 px-4 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-1.5 text-[13.5px] font-semibold text-ink"
        >
          <span aria-hidden className="h-1 w-10 rounded-full bg-ink/20" />
          <span className="flex w-full items-center justify-between gap-2">
            <span data-seat-plan-people-count="">{peek}</span>
            <ChevronDown aria-hidden className={`h-4 w-4 text-ink/50 transition-transform ${open ? '' : 'rotate-180'}`} />
          </span>
        </button>
        {/* Mounted always (the list keeps its search and scroll); shown only when raised. */}
        <div hidden={!open} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * 📱 THE TABLE'S SHEET ON A PHONE (owner 2026-10-01, the approved frame 3) — moved here from `seating-editor.tsx` whole, so it can be driven and held: the table's name, Type ▾, then the
 * shipped verbs. PRESENTATIONAL: the editor keeps every piece of state and every save; it hands this the handlers it already had, UNTOUCHED (`onRename` is `renameTable`, `onPickType`
 * `changeStyle`, `onRotate` `rotateTable(st, 90)`, `onLink` the link toggle, `onDelete` `requestRemoveTable`, …). The seats stepper, the "Seat N removed · Undo" strip and "Seat people" are
 * the editor's own nodes, handed in.
 */
export function PhoneTableDock({
  tableId,
  tableLabel,
  typeValue,
  typeOptions,
  typeWord,
  onRename,
  onPickType,
  seatsStepper,
  undoStrip,
  canEdit,
  onRotate,
  onEditChairs,
  linked,
  onUnlink,
  linkPressed,
  onLink,
  seatPeople,
  onDone,
  onDelete,
}: {
  tableId: string;
  tableLabel: string;
  typeValue: string;
  typeOptions: readonly PickOption[];
  typeWord: string;
  onRename: (label: string) => void;
  onPickType: (key: string) => void;
  seatsStepper: ReactNode;
  undoStrip: ReactNode;
  canEdit: boolean;
  onRotate: () => void;
  onEditChairs: () => void;
  linked: boolean;
  onUnlink: () => void;
  linkPressed: boolean;
  onLink: () => void;
  seatPeople: ReactNode;
  onDone: () => void;
  onDelete: () => void;
}) {
  /* 🧩 THE TEMPLATES (owner 2026-10-09, the table's sheet): the name is the Form row's typed answer (kept — `renameTable` — when it is left, as the box saved on blur), the
     shape is the dropdown row; Rotate · Edit chairs… · Link… · Unlink · Done · Delete are the ONE ActionButton, one row, Done the filled step; the delete's confirm is the
     centred box (the editor's, `GuestPopup kind="confirm"`). The seats stepper (− 10/10 +) is left as it was: the app has no counter template to move it onto. */
  return (
    <div data-seat-plan-phone-dock={tableId} className="flex w-full flex-col gap-2.5">
      <FormRows data="seat-table">
        <TypedRow
          key={tableId}
          data="seat-table-name"
          attrs={{ 'data-seat-table-name': '' }}
          name="Table name"
          value={tableLabel}
          maxLength={64}
          required
          onKeep={(label) => {
            onRename(label);
            return { ok: true as const };
          }}
        />
        <ChosenRow name="Shape" label="Table type" value={typeValue} options={typeOptions} onPick={onPickType} buttonText={typeWord} dataAttr="data-seat-plan-type" />
      </FormRows>
      <div className="flex flex-wrap items-center gap-2">
        {seatsStepper}
        {undoStrip}
        <ActionButton tone="neutral" icon={RotateCw} label="Rotate" disabled={!canEdit} onClick={onRotate} />
        <ActionButton tone="neutral" icon={Armchair} label="Edit chairs…" disabled={!canEdit} onClick={onEditChairs} />
        {linked ? (
          <ActionButton tone="neutral" icon={Ungroup} label="Unlink" disabled={!canEdit} onClick={onUnlink} />
        ) : (
          <span data-seat-plan-link="" className="inline-flex">
            <ActionButton tone={linkPressed ? 'brand' : 'neutral'} icon={Link2} label="Link…" aria-pressed={linkPressed} disabled={!canEdit} onClick={onLink} />
          </span>
        )}
        {seatPeople}
        {/* The row's one filled step, in the accent (the template's) — see `a-sheet-button-always-shows-its-word.test.ts`. */}
        <span className="ml-auto inline-flex">
          <ActionButton tone="brand" main icon={Check} label="Done" onClick={onDone} />
        </span>
      </div>
      <span className="self-start">
        <ActionButton tone="danger" quiet icon={Trash2} label="Delete this table" disabled={!canEdit} onClick={onDelete} />
      </span>
    </div>
  );
}
