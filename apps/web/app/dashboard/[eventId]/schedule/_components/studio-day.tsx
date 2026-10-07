'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { formatClock, formatDateHeading, spanOf, toDatetimeLocal, wallDateKey, wallMinutes } from '@/lib/schedule-rail';
import { fromDatetimeLocalValue } from '@/lib/schedule-datetime-local';
import { SCHEDULE_AUDIENCE_OPTIONS, readScheduleAudience, scheduleAudienceForWrite, type ScheduleAudience } from '@/lib/schedule-audience';
import { STUDIO_FOOT, STUDIO_FOOT_BUTTON } from '@/lib/studio-skin';
import type { DayMoment } from './day-types';
import { PickMenu, toFormData, useDayActions } from './day-ui';

/**
 * 🗓 STUDIO › SCHEDULE — THE DAY AS A TIMELINE (owner 2026-10-07, verbatim *"1. okay"*
 * on the Studio redraw answers, DECISION_LOG "STUDIO REDRAW ANSWERS"; prototype
 * `maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html` `EDITORS.schedule`).
 *
 *   the day (its date, ⓘ: set in Suppliers) · one row per moment —
 *   time pill · moment · place · For ▾ · ⋯ — · + Add a moment
 *
 * Drawn by `ScheduleDay` in place of the rail, only in the new Maker's Studio
 * (`makerStagesStudioEnabled`). 🔑 NO NEW WRITE: every field posts through the
 * rail's own `updateScheduleBlock` (the SAME quiet actions, `quietDayActions`) and
 * the rail's own override / refusal handling (`onPatch`); For ▾ is 4c's stored
 * `audience`. ⋯ opens the shipped `MomentInspector` (length, notes, show to
 * guests, suppliers, remove) — nothing the rail could do is lost.
 *
 * 🧱 BANDS, NOT BOXES (owner 2026-10-07: *"bands? full width"*): the day and every
 * moment sit on full-width white bands with hairlines — the prototype's rows,
 * heights and words, never its rounded cards.
 */

/** A moment's row on the timeline — its time, words and audience. */
export type StudioDayProps = {
  eventId: string;
  dateKey: string | null;
  /** The day's top-level moments, as the rail holds them (overrides applied). */
  moments: readonly DayMoment[];
  canEdit: boolean;
  /** Draw a guess now, write it, and on a refusal put it back and say so (the rail's `write`). */
  onPatch: (id: string, patch: Partial<DayMoment>, send: () => Promise<unknown>) => void;
  onAdd: () => void;
  onMore: (id: string) => void;
  /** A refusal, said under the day. */
  notice: string | null;
};

/** "For · Everyone" / "Only for · Entourage" — the prototype's button words. */
export function studioForWords(audience: ScheduleAudience): string {
  const label = SCHEDULE_AUDIENCE_OPTIONS.find((o) => o.key === audience)?.label ?? 'Everyone';
  return audience === 'everyone' ? `For · ${label}` : `Only for · ${label}`;
}

/** "HH:MM" for a time input, from minutes after midnight. */
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

function MomentRow({
  m,
  eventId,
  canEdit,
  onPatch,
  onMore,
}: {
  m: DayMoment;
  eventId: string;
  canEdit: boolean;
  onPatch: StudioDayProps['onPatch'];
  onMore: (id: string) => void;
}) {
  const { updateScheduleBlock } = useDayActions();
  const audience = readScheduleAudience(m.audience ?? null);
  const forRole = audience !== 'everyone';
  const dateKey = wallDateKey(m.start_at);
  const span = spanOf(m.start_at, m.end_at);
  const [label, setLabel] = useState(m.label);
  const [place, setPlace] = useState(m.location ?? '');
  /* A refusal (or a fresh answer) puts the words back — the boxes follow the moment. */
  useEffect(() => setLabel(m.label), [m.label]);
  useEffect(() => setPlace(m.location ?? ''), [m.location]);

  const saveWords = (field: 'label' | 'location', value: string) => {
    const text = value.trim();
    const was = field === 'label' ? m.label : (m.location ?? '');
    if (text === was.trim()) return;
    if (field === 'label' && !text) {
      setLabel(m.label);
      return;
    }
    onPatch(m.block_id, { [field]: field === 'label' ? text : text || null }, () =>
      updateScheduleBlock(toFormData({ event_id: eventId, block_id: m.block_id, [field]: text })),
    );
  };
  const saveTime = (value: string) => {
    const [h, mm] = value.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(mm)) return;
    const start = h! * 60 + mm!;
    if (start === span.startMin) return;
    /* The moment keeps its length: its end moves with its start. */
    const end = span.hasEnd ? start + (span.endMin - span.startMin) : null;
    const values: Record<string, string> = { event_id: eventId, block_id: m.block_id, start_at: toDatetimeLocal(dateKey, start) };
    const patch: Partial<DayMoment> = { start_at: fromDatetimeLocalValue(toDatetimeLocal(dateKey, start)) ?? m.start_at };
    if (end !== null) {
      values.end_at = toDatetimeLocal(dateKey, end);
      patch.end_at = fromDatetimeLocalValue(values.end_at);
    }
    onPatch(m.block_id, patch, () => updateScheduleBlock(toFormData(values)));
  };
  const field = 'w-full min-w-0 bg-transparent outline-none placeholder:text-ink/40 disabled:opacity-100';
  return (
    <li
      data-studio-moment={m.block_id}
      data-studio-moment-for={audience}
      className="relative flex items-start gap-2.5 border-t border-ink/10 bg-cream py-2.5 pl-4 pr-1"
    >
      {/* The timeline's line, running behind the pills from row to row. */}
      <span aria-hidden className="absolute bottom-0 left-[54px] top-0 w-0.5 bg-ink/10" />
      <label
        data-studio-moment-time=""
        className={`relative z-[1] flex h-9 w-[78px] shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold text-white ${
          forRole ? 'bg-gild' : 'bg-ink'
        }`}
      >
        <span aria-hidden>{formatClock(span.startMin)}</span>
        {/* The native time picker (a phone's wheel), laid over the pill — the pill is its face. */}
        <input
          type="time"
          step={300}
          value={hhmm(span.startMin)}
          disabled={!canEdit}
          aria-label={`${m.label} — time`}
          onChange={(e) => saveTime(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
        />
      </label>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <input
          value={label}
          disabled={!canEdit}
          maxLength={120}
          aria-label="The moment"
          onChange={(e) => setLabel(e.target.value)}
          onBlur={(e) => saveWords('label', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className={`${field} min-h-7 text-[15px] font-semibold text-ink`}
        />
        <input
          value={place}
          disabled={!canEdit}
          maxLength={200}
          placeholder="Place (optional)"
          aria-label={`${m.label} — place`}
          onChange={(e) => setPlace(e.target.value)}
          onBlur={(e) => saveWords('location', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className={`${field} min-h-6 text-[13px] text-ink/70`}
        />
        <div className="pt-1">
          {canEdit ? (
            <PickMenu
              label="For"
              value={audience}
              buttonText={studioForWords(audience)}
              options={SCHEDULE_AUDIENCE_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
              dataAttr="data-studio-moment-for-pick"
              compact
              className={`!min-h-7 !h-7 !rounded-full !px-3 !text-[12px] ring-0 [&>svg]:text-gild ${
                forRole ? '!bg-gild/15' : '!bg-ink/5'
              }`}
              onPick={(key) => {
                const stored = scheduleAudienceForWrite(key);
                if (stored === undefined || key === audience) return;
                onPatch(m.block_id, { audience: stored }, () =>
                  updateScheduleBlock(toFormData({ event_id: eventId, block_id: m.block_id, audience: key })),
                );
              }}
            />
          ) : (
            <span className="text-[12px] text-ink/60">{studioForWords(audience)}</span>
          )}
        </div>
      </div>
      {canEdit ? (
        // BUTTON-RULE
        <button
          type="button"
          data-studio-moment-more={m.block_id}
          aria-label={`More for ${m.label} — length, notes, guests, remove`}
          onClick={() => onMore(m.block_id)}
          className="sn-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/45 hover:bg-ink/5"
        >
          <MoreHorizontal aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </button>
      ) : null}
    </li>
  );
}

export function StudioDay({ eventId, dateKey, moments, canEdit, onPatch, onAdd, onMore, notice }: StudioDayProps) {
  const list = useRef<HTMLOListElement>(null);
  const ordered = [...moments].sort(
    (a, b) => wallDateKey(a.start_at).localeCompare(wallDateKey(b.start_at)) || wallMinutes(a.start_at) - wallMinutes(b.start_at),
  );
  /* "Saturday 12 December 2026" — the rail's own heading, with its year (the prototype's day line). */
  const heading = dateKey ? `${formatDateHeading(dateKey)} ${dateKey.slice(0, 4)}` : 'No date yet';
  return (
    <div data-studio-day="" className="-mx-4 flex min-h-full flex-col">
      <section data-studio-day-head="" className="border-b border-ink/10 bg-cream px-4 py-3">
        <InfoTip label={heading} labelClassName="font-serif text-[19px] text-ink" align="center">
          Set when you lock your venue in Suppliers. A new date moves the whole day.
        </InfoTip>
      </section>
      {notice ? (
        <p role="alert" className="px-4 pt-2 text-[13px] text-terracotta-700">
          {notice}
        </p>
      ) : null}
      {ordered.length ? (
        <ol ref={list} aria-label="The day, in order" className="mt-3 flex flex-col border-b border-ink/10">
          {ordered.map((m) => (
            <MomentRow key={m.block_id} m={m} eventId={eventId} canEdit={canEdit} onPatch={onPatch} onMore={onMore} />
          ))}
        </ol>
      ) : (
        <p className="px-4 pt-6 text-center text-[14px] text-ink/60">No moments yet.</p>
      )}
      {/* The editor's own bottom (prototype `.ebot`): pinned to the foot of a phone's screen, room kept above it. */}
      {canEdit ? <div aria-hidden className="h-20 shrink-0 lg:hidden" /> : null}
      {canEdit ? (
        <div className={`z-30 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:pb-[max(.5rem,env(safe-area-inset-bottom))] lg:sticky lg:bottom-0 lg:mt-4 ${STUDIO_FOOT}`}>
          {/* BUTTON-RULE */}
          <button type="button" data-studio-add-moment="" onClick={onAdd} className={STUDIO_FOOT_BUTTON}>
            <Plus aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.2} />
            Add a moment
          </button>
        </div>
      ) : null}
    </div>
  );
}
