'use client';

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
  spanOf,
  toDatetimeLocal,
  wallDateKey,
  wallMinutes,
} from '@/lib/schedule-rail';
import { Sheet } from '@/app/_components/sheet';
import { SubmitButton } from '@/app/_components/submit-button';
import type { DayMoment, DayRequest } from './day-types';
import { Eyebrow, PHASE_TINT, Switch, Tip, toFormData, useDayActions } from './day-ui';

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

const LENGTHS: Array<[number, string]> = [
  [15, '15m'],
  [30, '30m'],
  [45, '45m'],
  [60, '1h'],
  [90, '1½h'],
  [120, '2h'],
];

const HOURS = Array.from({ length: 19 }, (_, i) => i + 5); // 5 AM … 11 PM

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
  const [length, setLength] = useState(60);
  const [custom, setCustom] = useState('');
  const [picker, setPicker] = useState<'none' | 'time' | 'length'>('none');
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
    setLength(60);
    setCustom('');
    setPicker('none');
    setIsPublic(true);
    setStaged(false);
    setWhere('');
    setDate(dateKey ?? '');
    setError(null);
  }, [open, startMin, dateKey]);

  const customMinutes = Number.parseInt(custom, 10);
  const runs = custom && Number.isFinite(customMinutes) && customMinutes > 0 ? customMinutes : length;
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
              Add at <span className="font-mono text-[19px]">{formatClock(start)}</span>
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
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SCHEDULE_BLOCK_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setType(t)}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[12.5px] ${
                  type === t ? 'bg-ink text-cream' : 'text-ink/80 ring-1 ring-inset ring-ink/15 hover:bg-ink/[0.06]'
                }`}
              >
                <i aria-hidden className="h-2 w-2 rounded-full" style={{ background: PHASE_TINT[t] }} />
                {scheduleBlockLabelFor(t, eventType)}
              </button>
            ))}
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PickerField
            label="Starts"
            value={formatClock(start)}
            open={picker === 'time'}
            onToggle={() => setPicker(picker === 'time' ? 'none' : 'time')}
          >
            <Eyebrow>Hour</Eyebrow>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {HOURS.map((h) => (
                <Chip key={h} on={Math.floor(start / 60) === h} onClick={() => setStart(h * 60 + (start % 60))}>
                  {h % 12 === 0 ? 12 : h % 12} {h >= 12 ? 'PM' : 'AM'}
                </Chip>
              ))}
            </div>
            <div className="mt-3">
              <Eyebrow>Minutes</Eyebrow>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[0, 15, 30, 45].map((mm) => (
                <Chip key={mm} on={start % 60 === mm} onClick={() => setStart(Math.floor(start / 60) * 60 + mm)}>
                  :{String(mm).padStart(2, '0')}
                </Chip>
              ))}
              <Chip on={false} onClick={() => setStart(start - 5)}>
                −5
              </Chip>
              <Chip on={false} onClick={() => setStart(start + 5)}>
                +5
              </Chip>
            </div>
          </PickerField>
          <PickerField
            label="Runs for"
            value={custom ? `${runs} min` : (LENGTHS.find(([n]) => n === length)?.[1] ?? `${length} min`)}
            open={picker === 'length'}
            onToggle={() => setPicker(picker === 'length' ? 'none' : 'length')}
          >
            <div className="flex flex-wrap gap-1.5">
              {LENGTHS.map(([n, text]) => (
                <Chip
                  key={n}
                  on={!custom && length === n}
                  onClick={() => {
                    setCustom('');
                    setLength(n);
                  }}
                >
                  {text}
                </Chip>
              ))}
            </div>
            <input
              type="number"
              inputMode="numeric"
              min={5}
              step={5}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="or minutes, e.g. 80"
              aria-label="Custom length in minutes"
              className="mt-2 w-full border-0 border-b border-ink/15 bg-transparent px-0 py-1.5 text-sm text-ink outline-none focus:border-ink"
            />
          </PickerField>
        </div>
        {fits ? <p className="text-[12.5px] text-ink/55">{fits}</p> : null}

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
      <div className="sticky bottom-0 flex justify-end gap-2 bg-cream px-5 py-3 shadow-[0_-1px_0_rgba(27,26,23,0.06)]">
        <button type="button" onClick={onClose} className="h-10 rounded-full px-4 text-[13px] font-semibold text-ink/75 ring-1 ring-inset ring-ink/15">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="h-10 rounded-full bg-ink px-4 text-[13px] font-semibold text-cream disabled:opacity-60"
        >
          {pending ? 'Adding…' : 'Add moment'}
        </button>
      </div>
    </Sheet>
  );
}

function PickerField({
  label,
  value,
  open,
  onToggle,
  children,
}: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-12 w-full items-center justify-between gap-2 border-b border-ink/15 py-1.5 text-left"
      >
        <span>
          <Eyebrow>{label}</Eyebrow>
          <span className="block text-lg font-semibold tabular-nums text-ink">{value}</span>
        </span>
        <span aria-hidden className={`text-ink/45 transition-transform ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>
      {open ? <div className="pt-3">{children}</div> : null}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-10 rounded-full px-3 text-[12.5px] font-semibold ${
        on ? 'bg-ink text-cream' : 'text-ink/75 ring-1 ring-inset ring-ink/15 hover:bg-ink/[0.06]'
      }`}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────── Running late ───────────────────────────────

const AMOUNTS = [-15, 15, 30, 45];

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
        <label className="block">
          <Eyebrow>From</Eyebrow>
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block w-full border-0 border-b border-ink/15 bg-transparent px-0 py-1.5 text-[15px] text-ink outline-none focus:border-ink"
          >
            {top.map((m) => (
              <option key={m.block_id} value={m.block_id}>
                {label(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <Eyebrow>Through</Eyebrow>
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block w-full border-0 border-b border-ink/15 bg-transparent px-0 py-1.5 text-[15px] text-ink outline-none focus:border-ink"
          >
            <option value="">End of day</option>
            {top.map((m) => (
              <option key={m.block_id} value={m.block_id}>
                {label(m)}
              </option>
            ))}
          </select>
        </label>
        <p className="pt-2 text-4xl font-semibold tabular-nums tracking-tight text-ink">
          {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
          <small className="ml-1.5 text-sm font-normal text-ink/55">min</small>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={delta === a}
              onClick={() => setDelta(a)}
              className={`h-10 rounded-full px-3.5 text-[13px] font-semibold ${
                delta === a ? 'bg-ink text-cream' : 'text-ink/65 ring-1 ring-inset ring-ink/15'
              }`}
            >
              {a > 0 ? `+${a}` : `−${Math.abs(a)}`}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDelta((d) => (d - 5 === 0 ? -5 : d - 5))}
            className="h-10 rounded-full px-3 text-[13px] font-semibold text-ink/65 ring-1 ring-inset ring-ink/15"
            aria-label="5 minutes less"
          >
            −5
          </button>
          <button
            type="button"
            onClick={() => setDelta((d) => (d + 5 === 0 ? 5 : d + 5))}
            className="h-10 rounded-full px-3 text-[13px] font-semibold text-ink/65 ring-1 ring-inset ring-ink/15"
            aria-label="5 minutes more"
          >
            +5
          </button>
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
                    {r.by} · {r.kind === 'adjust' ? 'change to a moment' : 'new moment'}
                  </Eyebrow>
                  <h3 className="mt-1 font-display text-[21px] leading-tight text-ink">
                    {r.kind === 'adjust' ? (current?.label ?? 'A moment') : (r.proposed_label ?? 'A new moment')}
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
                        {r.proposed_start_at || r.proposed_end_at
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
