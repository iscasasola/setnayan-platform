'use client';

/**
 * ✅ PLANNING STAGE'S TO DO PIECES (owner 2026-11-01, DECISION_LOG "CHECKLIST MERGES INTO PLANNING STAGE"):
 *
 *   · `PlanningTick`        — the done tick on a task (the old Checklist's) or a hand-added row. Saves in place; a
 *                             refused save goes back and says so (never a tick that did not happen).
 *   · `TaskDateButton`      — a task's date, pressed to move it. Starts at the plan's date (event date − offset);
 *                             "Back to the plan's date" undoes a move. Capped at the event day for a before-the-day
 *                             task (plan §3).
 *   · `PlanningFilterFrame` — Everything · To do, ONE dropdown (any set of choices is a dropdown). Switches in place,
 *                             no refetch; the address keeps `filter=todo` so the old /checklist link lands here.
 *
 * The agenda itself stays a server component (`preparation-agenda.tsx`); these are its leaves.
 */

import { useEffect, useId, useState, useTransition, type ReactNode } from 'react';
import { CheckCircle2, Circle, Loader2, RotateCcw, Save, X } from 'lucide-react';
import { planningRowAction } from '../../checklist-actions';
import { ScheduleSheet, SheetField, SheetFoot } from './schedule-sheet';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { formatCount } from '@/lib/format-number';

// ── Tick ────────────────────────────────────────────────────────────────

export function PlanningTick({
  eventId,
  kind,
  id,
  done,
  title,
}: {
  eventId: string;
  /** `task` — an `event_checklist_items` row · `manual` — an `event_preparation_items` row. */
  kind: 'task' | 'manual';
  id: string;
  done: boolean;
  title: string;
}) {
  const [on, setOn] = useState(done);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // A fresh server answer (another tab, an auto-tick) wins.
  useEffect(() => setOn(done), [done]);

  function press() {
    const next = !on;
    setOn(next);
    setError(null);
    const fd = new FormData();
    fd.set('op', kind === 'task' ? 'tick-task' : 'tick-step');
    fd.set('event_id', eventId);
    fd.set('item_id', id);
    fd.set('desired', next ? 'done' : 'pending');
    start(async () => {
      const r = await planningRowAction(fd).catch(() => ({ ok: false as const, error: 'This did not save. Try again.' }));
      if (!r.ok) {
        // A refused save goes back and says so — never a tick that did not happen.
        setOn(!next);
        setError(r.error);
      }
    });
  }

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={press}
        disabled={pending}
        aria-pressed={on}
        aria-label={on ? `Mark "${title}" not done` : `Mark "${title}" done`}
        data-planning-tick={kind}
        className={`inline-flex h-11 w-9 items-center justify-center rounded-full transition ${
          on ? 'text-success-600' : 'text-ink/35 hover:text-success-600'
        }`}
      >
        {pending ? (
          <Loader2 aria-hidden className="h-5 w-5 animate-spin" strokeWidth={1.75} />
        ) : on ? (
          <CheckCircle2 aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        ) : (
          <Circle aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        )}
      </button>
      {error ? (
        <span role="alert" className="absolute left-0 top-full z-[2] w-48 rounded-md bg-danger-50 px-2 py-1 text-[11px] text-danger-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}

// ── Date ────────────────────────────────────────────────────────────────

function prettyDay(iso: string | null): string {
  if (!iso) return 'No date yet';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function TaskDateButton({
  eventId,
  itemId,
  title,
  dateIso,
  planDateIso,
  dateSet,
  eventDateIso,
  afterDay,
  children,
}: {
  eventId: string;
  itemId: string;
  title: string;
  dateIso: string | null;
  planDateIso: string | null;
  dateSet: boolean;
  /** The locked event day — the cap for a before-the-day task. */
  eventDateIso: string | null;
  afterDay: boolean;
  /** The row's own date column, drawn by the server. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(dateIso ?? '');
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const headId = useId();
  useEffect(() => setValue(dateIso ?? ''), [dateIso]);

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
    setNote(null);
  }

  function save(next: string) {
    setError(null);
    setNote(null);
    const fd = new FormData();
    fd.set('op', 'move-task');
    fd.set('event_id', eventId);
    fd.set('item_id', itemId);
    fd.set('date', next);
    start(async () => {
      const r = await planningRowAction(fd).catch(() => ({ ok: false as const, error: 'This date did not save. Try again.' }));
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setValue(r.dateIso ?? planDateIso ?? '');
      if (r.note) setNote(r.note);
      else setOpen(false);
    });
  }

  const max = !afterDay && eventDateIso ? eventDateIso : undefined;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Move "${title}" — ${prettyDay(dateIso)}`}
        data-task-date=""
        className="flex w-12 shrink-0 flex-col items-center rounded-lg py-1 transition hover:bg-ink/[0.05] sm:w-14"
      >
        {children}
      </button>
      <ScheduleSheet
        open={open}
        onClose={close}
        id={headId}
        title="Task date"
        aside={title}
        data="task-date"
        foot={
          <SheetFoot>
            <ActionButton tone="neutral" icon={X} label={note ? 'Done' : 'Cancel'} onClick={close} disabled={pending} />
            {note ? null : (
              <ActionButton
                tone="brand"
                main
                icon={Save}
                label={pending ? 'Saving…' : 'Save'}
                onClick={() => save(value)}
                disabled={pending || value === '' || value === (dateIso ?? '')}
                waiting={pending}
              />
            )}
          </SheetFoot>
        }
      >
        <div className="space-y-3.5">
          <SheetField
            label="When?"
            aside={<span className="font-normal text-ink/45">&nbsp;· {dateSet ? 'you moved this task' : 'the plan’s date'}</span>}
          >
            <input
              type="date"
              value={value}
              max={max}
              onChange={(e) => setValue(e.target.value)}
              disabled={pending}
              data-task-date-input=""
            />
          </SheetField>
          {dateSet && planDateIso ? (
            <button
              type="button"
              onClick={() => save('')}
              disabled={pending}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-terracotta transition hover:bg-terracotta/10"
            >
              <RotateCcw aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Back to the plan’s date · {prettyDay(planDateIso)}
            </button>
          ) : null}
          {note ? (
            <p role="status" className="text-xs text-ink/70">
              Saved for {prettyDay(value)}. {note}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-xs text-danger-700">
              {error}
            </p>
          ) : null}
        </div>
      </ScheduleSheet>
    </>
  );
}

// ── Filter ──────────────────────────────────────────────────────────────

export type PlanningFilter = 'all' | 'todo';

export function PlanningFilterFrame({
  initial,
  allCount,
  todoCount,
  todoOpen,
  children,
}: {
  initial: PlanningFilter;
  allCount: number;
  /** Rows of the To do filter, and how many are still open. */
  todoCount: number;
  todoOpen: number;
  children: ReactNode;
}) {
  const [filter, setFilter] = useState<PlanningFilter>(initial);

  function pick(key: string) {
    const next: PlanningFilter = key === 'todo' ? 'todo' : 'all';
    setFilter(next);
    // Keep the address honest without a refetch: a reload (or a shared link) opens the same filter.
    try {
      const url = new URL(window.location.href);
      if (next === 'todo') url.searchParams.set('filter', 'todo');
      else url.searchParams.delete('filter');
      window.history.replaceState(window.history.state, '', url.toString());
    } catch {
      /* the address is a convenience; the filter already switched */
    }
  }

  return (
    <div className="group/plan space-y-7" data-plan-filter={filter}>
      <div className="flex items-center gap-2">
        <PickMenu
          label="Show"
          value={filter}
          compact
          dataAttr="data-planning-filter"
          options={[
            { key: 'all', label: `Everything · ${formatCount(allCount)}` },
            { key: 'todo', label: `To do · ${formatCount(todoOpen)} of ${formatCount(todoCount)} open` },
          ]}
          onPick={pick}
        />
      </div>
      {children}
    </div>
  );
}
