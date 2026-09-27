'use client';

/**
 * The ONE inspector for a moment on the Event Day rail (Schedule rebuild,
 * slice 1 · prototype `.insp`). What used to be repeated on every card — Edit
 * time, Assign responsible party, Show to guests, delete — now appears once,
 * for the moment you tapped.
 *
 * Every field SAVES AS YOU MAKE IT, through the existing actions in
 * `../actions.ts`: text on blur, choices on change. The line at the bottom says
 * what happened — "Saving…", "Saved", or that it did not save — because a field
 * that quietly reverts is indistinguishable from one that saved.
 *
 * View-only people see the same inspector with nothing to press: every input
 * is read-only, the steppers and actions are gone.
 */

import { useState, useTransition } from 'react';
import { ArrowUpDown, Send, Trash2, X } from 'lucide-react';
import { SCHEDULE_BLOCK_TYPES, scheduleBlockLabelFor } from '@/lib/schedule';
import { fromDatetimeLocalValue } from '@/lib/schedule-datetime-local';
import {
  MIN_MOMENT_MINUTES,
  SNAP_MINUTES,
  formatClock,
  formatClockRange,
  formatDuration,
  spanOf,
  toDatetimeLocal,
  wallDateKey,
} from '@/lib/schedule-rail';
import type { DayMoment, DayRequest, DaySupplier } from './day-types';
import { Eyebrow, PickMenu, Stepper, Switch, Tip, toFormData, useDayActions } from './day-ui';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function MomentInspector({
  eventId,
  eventType,
  moment: m,
  parts,
  suppliers,
  rosEnabled,
  canEdit,
  canStage,
  request,
  onClose,
  onShift,
  onOpenRequests,
  onDeleted,
  onOverride,
  onRevert,
}: {
  eventId: string;
  eventType: string | null;
  moment: DayMoment;
  parts: DayMoment[];
  suppliers: DaySupplier[];
  rosEnabled: boolean;
  canEdit: boolean;
  canStage: boolean;
  /** An open supplier request against this moment, if any. */
  request: DayRequest | null;
  onClose: () => void;
  onShift: () => void;
  onOpenRequests: () => void;
  onDeleted: () => void;
  onOverride: (id: string, patch: Partial<DayMoment>) => void;
  onRevert: (ids: string[]) => void;
}) {
  const {
    createScheduleBlock,
    deleteScheduleBlock,
    setBlockPrepVisibility,
    setBlockResponsibleParty,
    toggleBlockVisibility,
    updateScheduleBlock,
  } = useDayActions();
  const [save, setSave] = useState<SaveState>('idle');
  const [, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [party, setParty] = useState(m.responsible_party ?? '');
  const [partLabel, setPartLabel] = useState('');
  const dateKey = wallDateKey(m.start_at);
  const span = spanOf(m.start_at, m.end_at);
  const [partTime, setPartTime] = useState(toDatetimeLocal(dateKey, span.startMin).slice(11));

  function run(ids: string[], action: () => Promise<unknown>, after?: () => void) {
    setSave('saving');
    startTransition(async () => {
      try {
        await action();
        setSave('saved');
        after?.();
      } catch {
        onRevert(ids);
        setSave('error');
      }
    });
  }

  function saveField(field: 'label' | 'location' | 'notes', value: string) {
    const current = field === 'label' ? m.label : field === 'location' ? m.location ?? '' : m.notes ?? '';
    if (value.trim() === current.trim()) return;
    if (field === 'label' && value.trim().length === 0) return;
    onOverride(m.block_id, { [field]: field === 'label' ? value.trim() : value.trim() || null });
    run([m.block_id], () =>
      updateScheduleBlock(toFormData({ event_id: eventId, block_id: m.block_id, [field]: value })),
    );
  }

  function setTimes(nextStart: number, nextEnd: number | null) {
    const patch: Partial<DayMoment> = {
      start_at: fromDatetimeLocalValue(toDatetimeLocal(dateKey, nextStart)) ?? m.start_at,
    };
    const values: Record<string, string> = {
      event_id: eventId,
      block_id: m.block_id,
      start_at: toDatetimeLocal(dateKey, nextStart),
    };
    if (nextEnd !== null) {
      patch.end_at = fromDatetimeLocalValue(toDatetimeLocal(dateKey, nextEnd));
      values.end_at = toDatetimeLocal(dateKey, nextEnd);
    }
    onOverride(m.block_id, patch);
    run([m.block_id], () => updateScheduleBlock(toFormData(values)));
  }

  function stepStart(delta: number) {
    const next = span.startMin + delta;
    if (span.hasEnd && next > span.endMin - MIN_MOMENT_MINUTES) return;
    setTimes(next, null);
  }
  function stepEnd(delta: number) {
    const next = span.endMin + delta;
    if (next < span.startMin + MIN_MOMENT_MINUTES) return;
    setTimes(span.startMin, next);
  }

  function setPublic(next: boolean) {
    onOverride(m.block_id, { is_public: next });
    run([m.block_id], () =>
      toggleBlockVisibility(
        toFormData({ event_id: eventId, block_id: m.block_id, desired: next ? 'true' : 'false' }),
      ),
    );
  }

  function saveResponsible(nextParty: string, nextIds: string[]) {
    onOverride(m.block_id, { responsible_party: nextParty.trim() || null, responsible_vendor_ids: nextIds });
    run([m.block_id], () =>
      setBlockResponsibleParty(
        toFormData({
          event_id: eventId,
          block_id: m.block_id,
          responsible_party: nextParty,
          responsible_vendor_ids: nextIds,
        }),
      ),
    );
  }

  function addPart() {
    const label = partLabel.trim();
    if (!label) return;
    run([], () =>
      createScheduleBlock(
        toFormData({
          event_id: eventId,
          label,
          block_type: m.block_type,
          start_at: `${dateKey}T${partTime}`,
          parent_block_id: m.block_id,
          is_public: m.is_public ? 'on' : null,
        }),
      ),
      () => setPartLabel(''),
    );
  }

  const phaseLabel = scheduleBlockLabelFor(m.block_type, eventType);
  const readOnly = !canEdit;

  return (
    <div className="px-5 pb-7 pt-3 lg:rounded-2xl lg:bg-white/80 lg:shadow-[-30px_0_60px_-40px_rgba(30,26,18,0.35)] lg:backdrop-blur">
      <div className="flex min-h-11 items-center gap-2">
        <span className="flex-1">
          <Eyebrow>{readOnly ? 'Moment · view only' : 'Moment'}</Eyebrow>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="sn-dot-btn grid h-10 w-10 place-items-center rounded-md text-ink/55 hover:bg-ink/[0.06] hover:text-ink"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>

      <input
        type="text"
        aria-label="What happens"
        defaultValue={m.label}
        readOnly={readOnly}
        maxLength={120}
        onBlur={(e) => saveField('label', e.target.value)}
        className="w-full border-0 border-b border-ink/15 bg-transparent px-0 pb-1.5 pt-0.5 font-display text-[21px] leading-tight text-ink outline-none focus:border-ink read-only:border-transparent lg:text-2xl"
      />

      <div className="mt-4">
        <Eyebrow>Phase</Eyebrow>
        {readOnly ? (
          <p className="py-1.5 text-[15px] text-ink">{phaseLabel}</p>
        ) : (
          <div className="mt-1">
            <PickMenu
              label="Phase"
              value={m.block_type}
              dataAttr="data-moment-phase"
              options={SCHEDULE_BLOCK_TYPES.map((t) => ({ key: t, label: scheduleBlockLabelFor(t, eventType) }))}
              onPick={(key) => {
                const next = key as DayMoment['block_type'];
                if (next === m.block_type) return;
                onOverride(m.block_id, { block_type: next });
                run([m.block_id], () =>
                  updateScheduleBlock(toFormData({ event_id: eventId, block_id: m.block_id, block_type: next })),
                );
              }}
            />
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <Eyebrow>Starts</Eyebrow>
          <p className="whitespace-nowrap text-[19px] font-semibold tabular-nums text-ink lg:text-xl">
            {formatClock(span.startMin)}
          </p>
          {canEdit ? <Stepper onMinus={() => stepStart(-SNAP_MINUTES)} onPlus={() => stepStart(SNAP_MINUTES)} /> : null}
        </div>
        <div>
          <Eyebrow>Ends</Eyebrow>
          {span.hasEnd ? (
            <>
              <p className="whitespace-nowrap text-[19px] font-semibold tabular-nums text-ink lg:text-xl">
                {formatClock(span.endMin)}
              </p>
              {canEdit ? <Stepper onMinus={() => stepEnd(-SNAP_MINUTES)} onPlus={() => stepEnd(SNAP_MINUTES)} /> : null}
            </>
          ) : canEdit ? (
            <button
              type="button"
              onClick={() => setTimes(span.startMin, span.startMin + 30)}
              className="mt-1 h-10 rounded-full px-3 text-[13px] font-semibold text-ink/75 ring-1 ring-inset ring-ink/15"
            >
              ＋ Add an end
            </button>
          ) : (
            <p className="text-[15px] text-ink/60">No end time</p>
          )}
        </div>
      </div>
      <p className="mt-2.5 flex items-center gap-2.5 text-[12.5px] text-ink/60">
        {span.hasEnd ? (
          <>
            Runs <b className="font-semibold text-ink/80">{formatDuration(span.endMin - span.startMin)}</b>
          </>
        ) : (
          'Open-ended'
        )}
        {canEdit ? (
          <Tip>
            Or drag the moment on the rail: the body moves it, the top and bottom edges resize it.
            Everything snaps to 5 minutes.
          </Tip>
        ) : null}
      </p>

      {request && canEdit ? (
        <p className="mt-3.5 rounded-xl bg-mulberry-50 px-3.5 py-3 text-[12.5px] text-mulberry-700">
          {request.by} asked for a change to this moment ·{' '}
          <button type="button" onClick={onOpenRequests} className="font-bold underline">
            review
          </button>
        </p>
      ) : null}

      {m.staged ? (
        <p className="mt-3.5 rounded-xl bg-terracotta/15 px-3.5 py-3 text-[12.5px] text-terracotta-800">
          Staged by you, the coordinator — the couple, guests and suppliers cannot see it yet. Release it
          when it is ready.
        </p>
      ) : (
        <div className="mt-1.5">
          <Switch
            on={m.is_public}
            onChange={setPublic}
            disabled={readOnly}
            label="Visible to guests"
            hint={m.is_public ? 'Shows on the Event Hub · "happening now" on the day' : 'Hidden — only your team sees it'}
          />
        </div>
      )}

      {rosEnabled ? (
        <div className="mt-4">
          <div className="flex items-center gap-1.5">
            <Eyebrow>Responsible</Eyebrow>
            <Tip>
              Free text for family or crew. Tag a booked supplier and this moment lands on their desk and
              in their view.
            </Tip>
          </div>
          <input
            type="text"
            value={party}
            readOnly={readOnly}
            maxLength={120}
            placeholder={readOnly ? '' : 'e.g. Ninong Roberto · HMUA team'}
            onChange={(e) => setParty(e.target.value)}
            onBlur={() => {
              if (party.trim() !== (m.responsible_party ?? '').trim()) {
                saveResponsible(party, m.responsible_vendor_ids);
              }
            }}
            className="w-full border-0 border-b border-ink/15 bg-transparent px-0 py-1.5 text-[15px] text-ink outline-none focus:border-ink read-only:border-transparent"
          />
          {suppliers.length > 0 ? (
            <div className="mt-2">
              {/* The suppliers already on this moment, each with its ✕; the ones
                  not yet tagged wait in ONE dropdown — never a row of toggles. */}
              {m.responsible_vendor_ids.length > 0 ? (
                <ul className="mb-1.5 flex flex-wrap gap-1.5">
                  {suppliers
                    .filter((s) => m.responsible_vendor_ids.includes(s.vendor_id))
                    .map((s) => (
                      <li
                        key={s.vendor_id}
                        className="inline-flex min-h-9 items-center gap-1 rounded-full bg-ink pl-3 pr-1.5 text-xs text-cream"
                      >
                        {s.vendor_name}
                        {readOnly ? (
                          <span className="w-1.5" />
                        ) : (
                          <button
                            type="button"
                            aria-label={`Untag ${s.vendor_name}`}
                            onClick={() =>
                              saveResponsible(
                                party,
                                m.responsible_vendor_ids.filter((id) => id !== s.vendor_id),
                              )
                            }
                            className="sn-dot-btn grid h-7 w-7 place-items-center rounded-full hover:bg-white/15"
                          >
                            <X aria-hidden className="h-3 w-3" />
                          </button>
                        )}
                      </li>
                    ))}
                </ul>
              ) : null}
              {!readOnly && suppliers.some((s) => !m.responsible_vendor_ids.includes(s.vendor_id)) ? (
                <PickMenu
                  label="Tag a supplier"
                  value={null}
                  dataAttr="data-moment-tag-supplier"
                  options={suppliers
                    .filter((s) => !m.responsible_vendor_ids.includes(s.vendor_id))
                    .map((s) => ({ key: s.vendor_id, label: s.vendor_name }))}
                  onPick={(id) => saveResponsible(party, [...m.responsible_vendor_ids, id])}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {parts.length > 0 || canEdit ? (
        <div className="mt-4">
          <div className="flex items-center gap-1.5">
            <Eyebrow>Parts</Eyebrow>
            <Tip>Parts sit inside this moment and move with it. They show under the moment for guests and in the emcee script.</Tip>
          </div>
          <ul className="mt-1">
            {parts.map((p) => {
              const ps = spanOf(p.start_at, p.end_at);
              return (
                <li key={p.block_id} className="flex items-center justify-between gap-2 border-b border-ink/[0.06] py-2 text-[13.5px]">
                  <span className="min-w-0 truncate">{p.label}</span>
                  <span className="flex items-center gap-1">
                    <span className="font-mono text-xs text-ink/55">
                      {p.end_at ? formatClockRange(ps.startMin, ps.endMin) : formatClock(ps.startMin)}
                    </span>
                    {canEdit ? (
                      <button
                        type="button"
                        aria-label={`Remove the part ${p.label}`}
                        onClick={() =>
                          run([], () =>
                            deleteScheduleBlock(toFormData({ event_id: eventId, block_id: p.block_id })),
                          )
                        }
                        className="sn-dot-btn grid h-8 w-8 place-items-center rounded-md text-ink/40 hover:bg-ink/[0.06] hover:text-danger-700"
                      >
                        <X aria-hidden className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
          {canEdit ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={partLabel}
                maxLength={120}
                onChange={(e) => setPartLabel(e.target.value)}
                placeholder="＋ Add a part, e.g. Vows & rings"
                aria-label="New part"
                className="min-w-0 flex-1 border-0 border-b border-ink/15 bg-transparent px-0 py-1.5 text-[13.5px] text-ink outline-none focus:border-ink"
              />
              <input
                type="time"
                step={300}
                value={partTime}
                onChange={(e) => setPartTime(e.target.value)}
                aria-label="When the part starts"
                className="w-[6.5rem] border-0 border-b border-ink/15 bg-transparent px-0 py-1.5 font-mono text-xs text-ink outline-none focus:border-ink"
              />
              <button
                type="button"
                onClick={addPart}
                disabled={!partLabel.trim()}
                className="h-9 rounded-full px-3 text-xs font-semibold text-terracotta-700 ring-1 ring-inset ring-terracotta/40 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <label className="mt-4 block">
        <Eyebrow>Where</Eyebrow>
        <input
          type="text"
          defaultValue={m.location ?? ''}
          readOnly={readOnly}
          maxLength={200}
          placeholder={readOnly ? '' : 'e.g. San Agustin Church, Intramuros'}
          onBlur={(e) => saveField('location', e.target.value)}
          className="w-full border-0 border-b border-ink/15 bg-transparent px-0 py-1.5 text-[15px] text-ink outline-none focus:border-ink read-only:border-transparent"
        />
      </label>

      <label className="mt-4 block">
        <Eyebrow>Notes</Eyebrow>
        <textarea
          rows={2}
          defaultValue={m.notes ?? ''}
          readOnly={readOnly}
          placeholder={readOnly ? '' : 'What only the team needs to know'}
          onBlur={(e) => saveField('notes', e.target.value)}
          className="w-full resize-none border-0 border-b border-ink/15 bg-transparent px-0 py-1.5 text-[13.5px] leading-normal text-ink outline-none focus:border-ink read-only:border-transparent"
        />
      </label>

      {canEdit ? (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {m.staged && canStage ? (
            <button
              type="button"
              onClick={() =>
                run([m.block_id], () =>
                  setBlockPrepVisibility(
                    toFormData({ event_id: eventId, block_id: m.block_id, visibility: 'couple_visible' }),
                  ),
                )
              }
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-terracotta-300 px-4 text-[13px] font-semibold text-ink"
            >
              <Send aria-hidden className="h-3.5 w-3.5" /> Release to couple
            </button>
          ) : null}
          {m.parent_block_id === null ? (
            <button
              type="button"
              onClick={onShift}
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-ink/80 ring-1 ring-inset ring-ink/15 hover:bg-ink/[0.06]"
            >
              <ArrowUpDown aria-hidden className="h-3.5 w-3.5" /> Shift everything after
            </button>
          ) : null}
          {confirmDelete ? (
            <span className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="h-10 rounded-full px-3 text-[13px] font-semibold text-ink/70"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={() =>
                  run(
                    [m.block_id],
                    () => deleteScheduleBlock(toFormData({ event_id: eventId, block_id: m.block_id })),
                    onDeleted,
                  )
                }
                className="h-10 rounded-full bg-danger-700 px-3.5 text-[13px] font-semibold text-white"
              >
                {parts.length > 0 ? `Delete it and its ${parts.length} part${parts.length === 1 ? '' : 's'}` : 'Delete it'}
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold text-danger-700 hover:bg-danger-700/10"
            >
              <Trash2 aria-hidden className="h-3.5 w-3.5" /> Delete
            </button>
          )}
        </div>
      ) : null}

      {canEdit ? (
        <p role="status" className="mt-3 text-xs text-ink/55">
          {save === 'saving' ? (
            'Saving…'
          ) : save === 'error' ? (
            <span className="font-medium text-danger-700">That change did not save. Try again.</span>
          ) : save === 'saved' ? (
            <>
              <b className="font-semibold text-success-700">Saved</b> · every change saves as you make it
            </>
          ) : (
            'Every change saves as you make it'
          )}
        </p>
      ) : null}
    </div>
  );
}
