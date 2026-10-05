'use client';

import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, MoreHorizontal, Sparkles, X } from 'lucide-react';
import { formatCount } from '@/lib/format-number';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import type { PickOption } from '../../website/editor/_components/pick-menu-types';
import { OneOpenScope, useOneOpen } from '@/lib/one-open';

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
      {toast ? (
        <div role="status" data-seat-plan-toast="" className="flex items-center gap-2 rounded-xl bg-ink px-3 py-2 text-[13px] text-cream">
          <Sparkles aria-hidden className="h-4 w-4 shrink-0 text-terracotta-200" />
          <span className="min-w-0 flex-1">{toast.text}</span>
          {toast.onUndo ? (
            <button type="button" onClick={toast.onUndo} data-seat-plan-undo="" className="sn-press shrink-0 font-semibold text-terracotta-200 underline-offset-2 hover:underline">
              Undo
            </button>
          ) : null}
          <button type="button" onClick={toast.onDismiss} aria-label="Dismiss" className="shrink-0 rounded p-0.5 text-cream/70 hover:text-cream">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAutoArrange}
          disabled={autoDisabled || autoBusy}
          data-seat-plan-auto=""
          className="sn-press inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-cream disabled:cursor-not-allowed disabled:opacity-50"
        >
          {autoBusy ? 'Arranging…' : 'Auto arrange'}
        </button>
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
        <button
          type="button"
          onClick={onMove}
          disabled={busy || value === null}
          data-seat-plan-move-go=""
          className="sn-press inline-flex h-12 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-cream disabled:opacity-50"
        >
          Move
        </button>
      </div>
    </div>,
    document.body,
  );
}
