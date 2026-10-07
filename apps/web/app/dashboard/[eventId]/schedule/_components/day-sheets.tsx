'use client';

import { Plus, X } from 'lucide-react';

/**
 * The Event Day rail's three sheets (Schedule rebuild, slice 1 · prototype
 * `.ov.add`, `.ov.shift`, `.ov.req`): Add a moment, Running late, Requests.
 * Each is the shared `Sheet` — a bottom sheet on a phone, a right drawer from
 * 1024px — and each writes through an EXISTING action in `../actions.ts`.
 */

import { useEffect, useMemo, useState, useTransition } from 'react';
import { SCHEDULE_BLOCK_TYPES, scheduleBlockLabelFor, type ScheduleBlockType } from '@/lib/schedule';
import { computeRetimePatches, MAX_RETIME_MINUTES } from '@/lib/schedule-ros';
import {
  formatClock,
  formatClockRange,
  formatDateHeading,
  formatDuration,
  spanOf,
  toDatetimeLocal,
  wallDateKey,
  wallMinutes,
} from '@/lib/schedule-rail';
import { Sheet } from '@/app/_components/sheet';
import { SubmitButton } from '@/app/_components/submit-button';
import type { DayMoment, DayRequest } from './day-types';
import { Eyebrow, PHASE_TINT, PickMenu, Stepper, Switch, Tip, toFormData, useDayActions, type PickOption } from './day-ui';

const COULD_NOT_SAVE = 'That did not save. Check your connection and try again.';

function SheetHead({ id, title, tip }: { id: string; title: React.ReactNode; tip?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pr-14">
      <h2 id={id} className="font-display text-[22px] leading-tight text-ink">
        {title}
      </h2>
      {tip ? <Tip align="end">{tip}</Tip> : null}
    </div>
  );
}

// ─────────────────────────────── Add a moment ───────────────────────────────

/** "Runs for" presets — the prototype's row, now the options of ONE dropdown. */
const LENGTHS: Array<[number, string]> = [
  [15, '15 min'],
  [30, '30 min'],
  [45, '45 min'],
  [60, '1 h'],
  [90, '1 h 30 min'],
  [120, '2 h'],
];

const FIRST_SLOT = 5 * 60; // 5:00 AM
const LAST_SLOT = 23 * 60 + 45; // 11:45 PM

/**
 * Every quarter hour from 5 AM to 11:45 PM — plus the value currently held when
 * the −/+ stepper has moved it off that grid, so the button never reads blank.
 */
export function startOptions(current: number): PickOption[] {
  const mins: number[] = [];
  for (let m = FIRST_SLOT; m <= LAST_SLOT; m += 15) mins.push(m);
  if (!mins.includes(current)) mins.push(current);
  mins.sort((a, b) => a - b);
  return mins.map((m) => ({ key: String(m), label: formatClock(m) }));
}

export function lengthOptions(current: number): PickOption[] {
  const rows: Array<[number, string]> = LENGTHS.some(([n]) => n === current)
    ? LENGTHS
    : [...LENGTHS, [current, formatDuration(current)] as [number, string]].sort((a, b) => a[0] - b[0]);
  return rows.map(([n, text]) => ({ key: String(n), label: text }));
}

export function AddMomentSheet({
  open,
  onClose,
  eventId,
  eventType,
  dateKey,
  startMin,
  canStage,
  nextMoment,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  eventType: string | null;
  /** The rail's date; null when the event has no date yet — then it is asked. */
  dateKey: string | null;
  startMin: number;
  canStage: boolean;
  /** The first moment after the chosen time — for "fits the gap before …". */
  nextMoment: DayMoment | null;
}) {
  const { createScheduleBlock } = useDayActions();
  const [label, setLabel] = useState('');
  const [type, setType] = useState<ScheduleBlockType>('custom');
  const [start, setStart] = useState(startMin);
  const [runs, setRuns] = useState(60);
  const [isPublic, setIsPublic] = useState(true);
  const [staged, setStaged] = useState(false);
  const [where, setWhere] = useState('');
  const [date, setDate] = useState(dateKey ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Each opening starts from where the couple tapped.
  useEffect(() => {
    if (!open) return;
    setLabel('');
    setType('custom');
    setStart(startMin);
    setRuns(60);
    setIsPublic(true);
    setStaged(false);
    setWhere('');
    setDate(dateKey ?? '');
    setError(null);
  }, [open, startMin, dateKey]);

  const fits =
    nextMoment && start + runs <= wallMinutes(nextMoment.start_at)
      ? `Fits the gap before ${nextMoment.label}`
      : nextMoment
        ? `Runs into ${nextMoment.label} — that is fine, they will sit side by side`
        : null;

  function submit() {
    if (!label.trim()) {
      setError('Say what happens — a moment needs a name.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Pick the date this happens on.');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createScheduleBlock(
          toFormData({
            event_id: eventId,
            label: label.trim(),
            block_type: type,
            start_at: toDatetimeLocal(date, start),
            end_at: toDatetimeLocal(date, start + runs),
            location: where,
            is_public: isPublic && !staged ? 'on' : null,
            prep: staged ? 'on' : null,
          }),
        );
        onClose();
      } catch {
        setError(COULD_NOT_SAVE);
      }
    });
  }

  return (
    <Sheet open={open} onClose={onClose} labelledById="add-moment-title" wide rise>
      <div className="space-y-4 px-5 pb-4 pt-5">
        <SheetHead
          id="add-moment-title"
          title={
            <>
              Add at <span className="text-[19px] tabular-nums">{formatClock(start)}</span>
            </>
          }
          tip="You tapped a time, so it is filled in. Change it below, or drag the moment on the rail afterwards."
        />
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={120}
          placeholder="What happens"
          aria-label="What happens"
          className="w-full border-0 border-b border-ink/15 bg-transparent px-0 pb-1.5 font-display text-[21px] text-ink outline-none focus:border-ink"
        />

        <div>
          <Eyebrow>Phase</Eyebrow>
          <div className="mt-1.5 flex items-center gap-2">
            <i aria-hidden className="h-2 w-2 flex-none rounded-full" style={{ background: PHASE_TINT[type] }} />
            <PickMenu
              label="Phase"
              value={type}
              dataAttr="data-add-phase"
              options={SCHEDULE_BLOCK_TYPES.map((t) => ({ key: t, label: scheduleBlockLabelFor(t, eventType) }))}
              onPick={(key) => setType(key as ScheduleBlockType)}
            />
          </div>
        </div>

        {!dateKey ? (
          <label className="block">
            <Eyebrow>Date</Eyebrow>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block w-full border-0 border-b border-ink/15 bg-transparent px-0 py-1.5 text-[15px] text-ink outline-none focus:border-ink"
            />
          </label>
        ) : (
          <p className="text-xs text-ink/55">{formatDateHeading(dateKey)}</p>
        )}

        {/* Starts and Runs for: each ONE dropdown for the choice, and the −/+
            stepper (five minutes a press) for anything between two options. */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            {/* One header height for both columns, so Starts and Runs for sit on one baseline (owner 2026-10-07). */}
            <div className="flex min-h-7 items-center gap-1.5">
              <Eyebrow>Starts</Eyebrow>
              <Tip>Pick a time — or drag the moment on the rail afterwards. Everything snaps to 5 minutes.</Tip>
            </div>
            <div className="mt-1.5">
              <PickMenu
                label="Starts"
                value={String(start)}
                dataAttr="data-add-starts"
                options={startOptions(start)}
                onPick={(key) => setStart(Number(key))}
              />
            </div>
            <Stepper
              onMinus={() => setStart((s) => Math.max(0, s - 5))}
              onPlus={() => setStart((s) => s + 5)}
            />
          </div>
          <div>
            <div className="flex min-h-7 items-center">
              <Eyebrow>Runs for</Eyebrow>
            </div>
            <div className="mt-1.5">
              <PickMenu
                label="Runs for"
                value={String(runs)}
                dataAttr="data-add-runs"
                options={lengthOptions(runs)}
                onPick={(key) => setRuns(Number(key))}
              />
            </div>
            <Stepper
              onMinus={() => setRuns((r) => Math.max(5, r - 5))}
              onPlus={() => setRuns((r) => r + 5)}
              minusLabel="5 minutes shorter"
              plusLabel="5 minutes longer"
            />
          </div>
        </div>
        <p className="text-[12.5px] text-ink/55">
          Ends <span className="tabular-nums">{formatClock(start + runs)}</span>
          {fits ? ` · ${fits}` : ''}
        </p>

        <div>
          <Switch
            on={isPublic && !staged}
            onChange={setIsPublic}
            disabled={staged}
            label="Visible to guests"
            hint="Shows on the Event Hub"
          />
          {canStage ? (
            <Switch
              on={staged}
              onChange={setStaged}
              label="Start staged"
              hint="Hidden from the couple until you release it"
            />
          ) : null}
        </div>

        <label className="block">
          <Eyebrow>Where</Eyebrow>
          <input
            type="text"
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            maxLength={200}
            placeholder="e.g. Church steps"
            className="mt-1 block w-full border-0 border-b border-ink/15 bg-transparent px-0 py-1.5 text-[15px] text-ink outline-none focus:border-ink"
          />
        </label>

        {error ? (
          <p role="alert" className="text-sm font-medium text-danger-700">
            {error}
          </p>
        ) : null}
      </div>
      <div className="sn-glass-row sticky bottom-0 flex justify-end gap-2 px-5 py-3">
        {/* BUTTON-RULE — icon + word, toned (✕ Cancel · ＋ Add moment), until the shared ActionButton lands. */}
        <button type="button" onClick={onClose} className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-ink/75 ring-1 ring-inset ring-ink/15">
          <X aria-hidden className="h-4 w-4" strokeWidth={2.2} />
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-cream disabled:opacity-60"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2.2} />
          {pending ? 'Adding…' : 'Add moment'}
        </button>
      </div>
    </Sheet>
  );
}

// ─────────────────────────────── Running late ───────────────────────────────

/** How late a day usually runs — the options of ONE dropdown, then −/+ for the rest. */
const AMOUNTS = [-30, -15, -5, 5, 10, 15, 20, 30, 45, 60];

const signed = (n: number) => (n > 0 ? `+${n} min` : `−${Math.abs(n)} min`);

function amountOptions(current: number): PickOption[] {
  const all = AMOUNTS.includes(current) ? AMOUNTS : [...AMOUNTS, current].sort((a, b) => a - b);
  return all.map((n) => ({ key: String(n), label: signed(n) }));
}

export function ShiftSheet({
  open,
  onClose,
  eventId,
  moments,
  fromId,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  moments: DayMoment[];
  fromId: string | null;
}) {
  const { bulkRetimeScheduleBlocks } = useDayActions();
  const top = useMemo(
    () =>
      moments
        .filter((m) => m.parent_block_id === null && !m.staged)
        .sort((a, b) => (a.start_at < b.start_at ? -1 : a.start_at > b.start_at ? 1 : 0)),
    [moments],
  );
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [delta, setDelta] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setFrom(fromId ?? top[0]?.block_id ?? '');
    setTo('');
    setDelta(30);
    setError(null);
  }, [open, fromId, top]);

  const patches = useMemo(() => {
    if (!from) return [];
    try {
      return computeRetimePatches(
        moments.map((m) => ({ ...m, sort_order: 0 })),
        from,
        delta,
        to || null,
      );
    } catch {
      return [];
    }
  }, [moments, from, to, delta]);
  const moving = new Set(patches.map((p) => p.block_id));
  const movingTop = top.filter((m) => moving.has(m.block_id));
  const lastEnd = Math.max(
    ...top.map((m) => {
      const p = patches.find((x) => x.block_id === m.block_id);
      const s = spanOf(p?.start_at ?? m.start_at, p ? p.end_at : m.end_at);
      return s.endMin;
    }),
  );

  function submit() {
    if (!from || Math.abs(delta) > MAX_RETIME_MINUTES) return;
    setError(null);
    startTransition(async () => {
      try {
        await bulkRetimeScheduleBlocks(
          toFormData({ event_id: eventId, from_block_id: from, to_block_id: to, delta_minutes: String(delta) }),
        );
        onClose();
      } catch {
        setError(COULD_NOT_SAVE);
      }
    });
  }

  const label = (m: DayMoment) => `${m.label} · ${formatClock(wallMinutes(m.start_at))}`;

  return (
    <Sheet open={open} onClose={onClose} labelledById="shift-title" wide rise>
      <div className="space-y-4 px-5 pb-4 pt-5">
        <SheetHead
          id="shift-title"
          title="Running late"
          tip="Moves the chosen moment and everything after it by the same amount. Parts travel with their moment; how long each runs is kept."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Eyebrow>From</Eyebrow>
            <div className="mt-1.5">
              <PickMenu
                label="From"
                value={from}
                dataAttr="data-shift-from"
                options={top.map((m) => ({ key: m.block_id, label: label(m) }))}
                onPick={setFrom}
              />
            </div>
          </div>
          <div>
            <Eyebrow>Through</Eyebrow>
            <div className="mt-1.5">
              <PickMenu
                label="Through"
                value={to || 'end'}
                dataAttr="data-shift-through"
                options={[{ key: 'end', label: 'End of day' }, ...top.map((m) => ({ key: m.block_id, label: label(m) }))]}
                onPick={(key) => setTo(key === 'end' ? '' : key)}
              />
            </div>
          </div>
        </div>
        <div>
          <Eyebrow>By</Eyebrow>
          <p className="pt-1 text-4xl font-semibold tabular-nums tracking-tight text-ink">
            {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
            <small className="ml-1.5 text-sm font-normal text-ink/55">min</small>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <PickMenu
              label="By"
              value={String(delta)}
              dataAttr="data-shift-by"
              options={amountOptions(delta)}
              onPick={(key) => setDelta(Number(key))}
            />
            <Stepper
              onMinus={() => setDelta((d) => (d - 5 === 0 ? -5 : d - 5))}
              onPlus={() => setDelta((d) => (d + 5 === 0 ? 5 : d + 5))}
              minusLabel="5 minutes less"
              plusLabel="5 minutes more"
            />
          </div>
        </div>
        <p className="text-[13px] text-ink/65">
          {movingTop.length} moment{movingTop.length === 1 ? '' : 's'} move
          {top.length > 0 && Number.isFinite(lastEnd) ? (
            <>
              {' '}· the day now ends <span className="font-mono">{formatClock(lastEnd)}</span>
            </>
          ) : null}
        </p>
        <ul>
          {top.map((m) => {
            const p = patches.find((x) => x.block_id === m.block_id);
            return (
              <li
                key={m.block_id}
                className={`flex justify-between gap-3 border-b border-ink/[0.06] py-2 text-[13px] ${p ? '' : 'opacity-40'}`}
              >
                <span className="min-w-0 truncate">{m.label}</span>
                <span className="whitespace-nowrap font-mono text-xs text-ink/60">
                  {formatClock(wallMinutes(m.start_at))}
                  {p ? ` → ${formatClock(wallMinutes(p.start_at))}` : ' · stays'}
                </span>
              </li>
            );
          })}
        </ul>
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger-700">
            {error}
          </p>
        ) : null}
      </div>
      <div className="sticky bottom-0 flex justify-end gap-2 bg-cream px-5 py-3 shadow-[0_-1px_0_rgba(27,26,23,0.06)]">
        <button type="button" onClick={onClose} className="h-10 rounded-full px-4 text-[13px] font-semibold text-ink/75 ring-1 ring-inset ring-ink/15">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending || patches.length === 0}
          className="h-10 rounded-full bg-ink px-4 text-[13px] font-semibold text-cream disabled:opacity-60"
        >
          {pending ? 'Shifting…' : 'Shift the day'}
        </button>
      </div>
    </Sheet>
  );
}

// ───────────────────────────────── Requests ─────────────────────────────────

function whenOf(start: string | null, end: string | null, sameDateAs: string | null): string {
  if (!start) return 'no time given';
  const s = spanOf(start, end);
  const range = end ? formatClockRange(s.startMin, s.endMin) : formatClock(s.startMin);
  const key = wallDateKey(start);
  return key === sameDateAs ? range : `${formatDateHeading(key)} · ${range}`;
}

export function RequestsSheet({
  open,
  onClose,
  eventId,
  requests,
  moments,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  requests: DayRequest[];
  moments: DayMoment[];
}) {
  const { resolveScheduleSuggestion } = useDayActions();
  const byId = new Map(moments.map((m) => [m.block_id, m]));
  return (
    <Sheet open={open} onClose={onClose} labelledById="requests-title" wide rise>
      <div className="px-5 pb-6 pt-5">
        <SheetHead
          id="requests-title"
          title={
            <>
              Requests <span className="font-mono text-lg text-ink/45">{requests.length}</span>
            </>
          }
          tip="Booked suppliers propose; you or your approved coordinator decide. Approve applies it to the schedule; Decline tells them. They never edit the schedule themselves."
        />
        {requests.length === 0 ? (
          <p className="py-5 text-[13.5px] text-ink/55">
            Nothing waiting. Suppliers’ requests land here and as dashed moments on the schedule.
          </p>
        ) : (
          <ul>
            {requests.map((r) => {
              const current = r.block_id ? byId.get(r.block_id) ?? null : null;
              const refDate = current ? wallDateKey(current.start_at) : null;
              return (
                <li key={r.suggestion_id} className="border-b border-ink/[0.06] pb-5 pt-4">
                  <Eyebrow>
                    {r.by} ·{' '}
                    {r.kind === 'remove' ? 'remove a moment' : r.kind === 'adjust' ? 'change to a moment' : 'new moment'}
                  </Eyebrow>
                  <h3 className="mt-1 font-display text-[21px] leading-tight text-ink">
                    {r.kind === 'new'
                      ? (r.proposed_label ?? 'A new moment')
                      : (current?.label ?? r.proposed_label ?? 'A moment')}
                  </h3>
                  <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                    <div>
                      <Eyebrow>Now</Eyebrow>
                      <p className="mt-0.5 text-base font-semibold text-ink/80">
                        {current ? whenOf(current.start_at, current.end_at, refDate) : <span className="text-ink/50">free slot</span>}
                      </p>
                    </div>
                    <span aria-hidden className="pb-0.5 text-lg text-ink/40">
                      →
                    </span>
                    <div>
                      <Eyebrow>Asked</Eyebrow>
                      <p className="mt-0.5 text-base font-semibold text-mulberry-700">
                        {r.kind === 'remove'
                          ? 'remove it'
                          : r.proposed_start_at || r.proposed_end_at
                          ? whenOf(r.proposed_start_at ?? current?.start_at ?? null, r.proposed_end_at, refDate)
                          : r.proposed_label && current
                            ? `rename to “${r.proposed_label}”`
                            : 'same time'}
                      </p>
                    </div>
                  </div>
                  {r.proposed_location ? <p className="mt-2 text-[12.5px] text-ink/60">{r.proposed_location}</p> : null}
                  <p className="mt-3 text-[13.5px] italic text-ink/65">“{r.note}”</p>
                  <div className="mt-3.5 flex justify-end gap-2">
                    <form action={resolveScheduleSuggestion}>
                      <input type="hidden" name="event_id" value={eventId} />
                      <input type="hidden" name="suggestion_id" value={r.suggestion_id} />
                      <input type="hidden" name="decision" value="decline" />
                      <SubmitButton
                        pendingLabel="Declining…"
                        className="h-10 rounded-full px-4 text-[13px] font-semibold text-ink/75 ring-1 ring-inset ring-ink/15"
                      >
                        Decline
                      </SubmitButton>
                    </form>
                    <form action={resolveScheduleSuggestion}>
                      <input type="hidden" name="event_id" value={eventId} />
                      <input type="hidden" name="suggestion_id" value={r.suggestion_id} />
                      <input type="hidden" name="decision" value="accept" />
                      <SubmitButton
                        pendingLabel="Approving…"
                        className="h-10 rounded-full bg-ink px-4 text-[13px] font-semibold text-cream"
                      >
                        Approve
                      </SubmitButton>
                    </form>
                  </div>
                  <p className="mt-2 text-right text-[11.5px] text-ink/50">
                    {r.kind === 'new'
                      ? 'Approving adds it hidden from guests — flip the eye when they should see it.'
                      : r.kind === 'remove'
                        ? 'Approving takes the moment off the schedule.'
                        : 'Approving changes the moment on the schedule.'}{' '}
                    {r.by} is told either way.
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
