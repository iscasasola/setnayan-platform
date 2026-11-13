'use client';

/**
 * THE DATE SHEET AND THE PLACE SHEET — on the Suppliers page itself (PR5; corpus `SUPPLIERS_HANDOFF_2026-10-07_fable.md`
 * § PR5; approved prototype `prototypes/suppliers_date_place_help_tour_2026-10-10.html`; owner rulings 2026-10-10
 * answers 7–10; the 2026-10-12 look rules and the 2026-10-13 audit of that prototype).
 *
 * The date · place line's two values open these in place — no trip to Event Details, no second editor:
 *
 *   DATE   the ladder (Year → Month → Day → Time) · "I have a date | Help me choose" (two values → pills) · the day as
 *          a Form row with a date (kind 6) · a day a booked supplier cannot do is refused at the pick and named with
 *          the one way to ask them (the shipped clash note, J51) · an open date change shows, with Withdraw (answer 10)
 *          · Help me choose: one month's Saturdays, only those EVERY PRICED pick can take (answer 8), the picked one in
 *          terracotta, "Use <day>".
 *   PLACE  the ladder (City or area → Reception → Ceremony; no Region rung — none is shipped) · City or area (the
 *          shipped `CityPick`) · a booked venue reads as the supplier's details, or "Enter your own" (two values →
 *          pills) · a place typed by hand = its name and its pin (kind 25, `AddressPinField`) FOR GUESTS — it is not
 *          added to the couple's suppliers (answer 9) · "Find in <venue>" opens Find on that row.
 *
 * 🗓 THE DATE SAVES TO THE EVENT AT ONCE (owner 2026-11-05, verbatim *"it shouldn't rely on the hub."* — DECISION_LOG
 * 2026-11-05 "THE DATE SAVES TO THE EVENT", amending answer 7 for the date only): a pick goes through the event's one
 * date door (`updateEventDate`) — the floor, the clash refusal at the pick and the booked suppliers' clearance — and is
 * live for Home, Find, Build and the published Event Hub with no Apply. A date change is the shipped request (intent
 * `date_change`).
 * 💾 THE PLACE STILL WAITS FOR APPLY (answer 7): its writes go through the one draft door (`hubDraftAction` intent
 * `save`) — the same columns and checks the Maker's Details uses. The sheet opens with ONE read (`openFactSheet`) and
 * draws nothing before it; when it closes after a write, the page is drawn again ONCE so Find, Build and the line re-run.
 *
 * Lab: `FactSheetStandInCtx` answers the read and the writes from fixtures (`/dev/suppliers-lab?sheet=…`).
 */
import { eventDateMinFor } from '@/lib/event-date-floor';
import { createPortal } from 'react-dom';
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';
import { CalendarDays, Check, RotateCcw, Search, Star, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { PillSelector } from '@/app/_components/pill-selector';
import { FormRows, TypedRow } from '@/app/_components/form-row';
import { DateRow } from '@/app/_components/form-row-date';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import type { DateClash } from '@/lib/date-fits-booked';
import { dateChangeAnswerLine, dateChangeWhen } from '@/lib/date-change';
import { formatCount } from '@/lib/format-number';
import type { HubDraftActionResult } from '@/lib/hub-draft';
import {
  updateEventDate,
  updateEventMatchCriteria,
  type EventDateOptionsResult,
  type EventDateSaveResult,
} from '../../actions';
import { DateCalendar, type DateCalendarValue } from '@/app/onboarding/_shared/date-calendar';
import { addDaysIso, asksHowManyDays, daysBetweenIso, MAX_EVENT_DAYS } from '@/lib/event-date-options';
import { MERGE_BASE_FIELD } from '@/lib/merge-base-field';
import { noDayWords } from '@/lib/help-me-choose';
import type { MatrixDate } from '@/lib/schedule-matrix';
import {
  dateLadder,
  dayWords,
  placeLadder,
  savedDateNote,
  type DateSheetData,
  type FactSheetData,
  type FactSheetKey,
  type LadderRung,
  type PlaceSheetData,
  type PlaceSlot,
} from '@/lib/suppliers-fact-sheets';
import { hubDraftAction } from '../../website/hub-draft-actions';
import { openFactSheet } from '../_actions/fact-sheet';
import { DateClashNote } from '../../launch/_components/details-date-clash';
import { CategoryLine, comboSummary, coverageHeadline, rankWithPin } from '../../find-date/_components/find-your-date';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { AddressPinField } from '../../_components/address-pin-field';
import { ManualVenuePin, ShopPinNote, type ManualVenuePinSave } from '../../_components/venue-pin-part';
import { saveManualVenuePin } from '../[vendorId]/workspace/actions';
import { shopPinLine, venuePinDoor } from '@/lib/venue-pin-door';
import { CityPick } from '../../launch/_components/details-city-pick';
import { lockedPlaceWhy, placeLockedByReception } from '@/lib/your-place';

/* ── THE DOORS (the real ones; the lab stands in) ─────────────────────────────────────────────────────────────── */

export type FactSheetStandIns = {
  open: (which: FactSheetKey, month: string | null) => Promise<FactSheetData>;
  /** 🗓 The date, straight to the event — its one live door (`updateEventDate`; owner 2026-11-05). `extra.end` posts the
   *  main span's last day (null = "Same day"; owner 2026-11-13); `extra.clearOptions` — a day replaces the options. */
  date: (date: string, precision: 'day' | 'month', extra?: { end?: string | null; clearOptions?: boolean }) => Promise<EventDateSaveResult>;
  /** 📅 A few dates — the options and the day count (`updateEventDate` with `date_options=1`, owner 2026-11-13). Absent in a lab = saved. */
  options?: (o: Required<Pick<DateCalendarValue, 'dateMode' | 'dateCandidates' | 'windowStart' | 'windowEnd'>> & { days: number }) => Promise<EventDateOptionsResult>;
  /** 📍 A non-wedding's City or area = `events.region`, through `updateEventMatchCriteria` (owner 2026-11-13). Absent in a lab = saved. */
  region?: (next: string, was: string | null) => Promise<{ ok: true } | { ok: false; message: string }>;
  /** A place patch through the one draft door (`hubDraftAction` intent `save`). */
  draft: (patch: Record<string, unknown>) => Promise<HubDraftActionResult>;
  /** The date-change request (J51): withdraw it. */
  withdraw: () => Promise<HubDraftActionResult>;
  /** 📍 A manual venue's address + pin, on the supplier's own card (owner 2026-10-22). Absent in a lab = it answers saved. */
  manualPin?: ManualVenuePinSave;
};
export const FactSheetStandInCtx = createContext<FactSheetStandIns | null>(null);

function useDoors(eventId: string, priced: readonly string[]): FactSheetStandIns {
  const lab = useContext(FactSheetStandInCtx);
  /* A saved date draws the page again while the sheet is open (`updateEventDate` revalidates), and that render hands
     a NEW `priced` array with the same ids. Keyed on the ids, the doors — and the sheet's read — stay as they are, so a
     save never resets the screen (the month Help me choose shows stays shown). */
  const pricedKey = priced.join(',');
  return useMemo(
    () =>
      lab ?? {
        open: (which, month) => openFactSheet(eventId, { which, month, priced: pricedKey ? pricedKey.split(',') : [] }),
        date: (date, precision, extra) => {
          const fd = new FormData();
          fd.set('event_id', eventId);
          fd.set('event_date', date);
          fd.set('precision', precision);
          if (extra && 'end' in extra) fd.set('event_end_date', extra.end ?? '');
          if (extra?.clearOptions) fd.set('clear_options', '1');
          return updateEventDate(fd);
        },
        options: (o) => {
          const fd = new FormData();
          fd.set('event_id', eventId);
          fd.set('date_options', '1');
          fd.set('date_mode', o.dateMode);
          for (const c of o.dateCandidates) fd.append('date_candidate', c);
          if (o.windowStart) fd.set('date_window_start', o.windowStart);
          if (o.windowEnd) fd.set('date_window_end', o.windowEnd);
          fd.set('event_days', String(o.days));
          return updateEventDate(fd).then((r): EventDateOptionsResult => (r.ok ? { ok: true, message: r.note ?? 'Saved.' } : { ok: false, error: r.error }));
        },
        region: (next, was) => {
          /* ONE value — the Region in ⚙ Event settings. Posted "based" (what it started from), so ONLY the region is
             written: the feel, the budget and the names another screen holds are left exactly as they are. */
          const fd = new FormData();
          fd.set('event_id', eventId);
          fd.set('region', next);
          fd.set(MERGE_BASE_FIELD, JSON.stringify({ region: JSON.stringify([was ?? '']) }));
          return updateEventMatchCriteria(fd);
        },
        draft: (patch) => {
          const fd = new FormData();
          fd.set('intent', 'save');
          fd.set('patch', JSON.stringify(patch));
          return hubDraftAction(eventId, fd);
        },
        withdraw: () => {
          const fd = new FormData();
          fd.set('intent', 'date_change');
          fd.set('action', 'withdraw');
          return hubDraftAction(eventId, fd);
        },
        manualPin: saveManualVenuePin,
      },
    [lab, eventId, pricedKey],
  );
}

const FAILED = 'That did not save. Nothing changed — please try again.';

/** A save's answer — a Form row reads `ok` / `error`; the sheet also learns whether a booked supplier refused the day. */
type SaveAnswer = { ok: true } | { ok: false; error: string; clashed?: boolean };

/* ── THE SHEET ─────────────────────────────────────────────────────────────────────────────────────────────────── */

type Loaded = { kind: 'loading' } | { kind: 'failed'; error: string } | { kind: 'ready'; data: FactSheetData & { ok: true } };

export function FactSheet({
  eventId,
  which,
  helpFirst,
  priced,
  onWrote,
  onClose,
}: {
  eventId: string;
  which: FactSheetKey;
  helpFirst: boolean;
  priced: readonly string[];
  /** A write landed. `redrawn` — the server already drew the page again (a date); else the page owes one redraw. */
  onWrote: (redrawn?: boolean) => void;
  onClose: () => void;
}) {
  const doors = useDoors(eventId, priced);
  const headingId = useId();
  const [state, setState] = useState<Loaded>({ kind: 'loading' });
  const [toast, setToast] = useState<{ key: number; text: string; tone: 'ok' | 'bad' } | null>(null);
  const load = useCallback(
    (month: string | null = null) => {
      setState((s) => (s.kind === 'ready' ? s : { kind: 'loading' }));
      doors
        .open(which, month)
        .then((r) => setState(r.ok ? { kind: 'ready', data: r } : { kind: 'failed', error: r.error }))
        .catch(() => setState({ kind: 'failed', error: 'This could not be opened just now. Nothing was changed — try again.' }));
    },
    [doors, which],
  );
  useEffect(() => load(), [load]);
  const say = (text: string, t: 'ok' | 'bad' = 'ok') => setToast({ key: Date.now(), text, tone: t });

  /* Drawn into <body>: the dashboard's page wrapper (`.sn-page-enter` transform) captures `position: fixed`, and
     Find's thumb row and the dock (both on <body>) would otherwise sit OVER the sheet (walked 2026-10-13). */
  return createPortal(
    <Sheet open onClose={onClose} labelledById={headingId} rise wide>
      <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-8 pt-5" data-fact-sheet={which}>
        {toast ? (
          <PeekToast key={toast.key} tone={toast.tone} data="fact-sheet" onGone={() => setToast(null)}>
            {toast.text}
          </PeekToast>
        ) : null}
        <header>
          <h2 id={headingId} className="font-serif text-[22px] leading-tight text-ink">
            {which === 'date' ? 'Your date' : 'Your place'}
          </h2>
          <p className="text-[13px] text-ink/60">It gets sharper as you book.</p>
        </header>
        {state.kind === 'loading' ? (
          <div aria-busy="true" data-fact-sheet-loading="" className="flex flex-col gap-2">
            <p className="text-[13px] text-ink/60">{which === 'date' ? 'Checking your suppliers’ calendars…' : 'Opening your place…'}</p>
            <span className="skeleton block h-10 rounded-md" />
            <span className="skeleton block h-10 rounded-md" />
          </div>
        ) : state.kind === 'failed' ? (
          <p role="alert" className="flex flex-wrap items-center gap-2 text-[14px] text-ink/75" data-fact-sheet-failed="">
            {state.error}
            <ActionButton tone="neutral" quiet icon={RotateCcw} label="Try again" onClick={() => load()} />
          </p>
        ) : state.data.which === 'date' ? (
          <DateBody
            onCancel={onClose}
            eventId={eventId}
            data={state.data.date}
            helpFirst={helpFirst}
            doors={doors}
            onMonth={(m) => load(m)}
            onWrote={(text) => {
              onWrote(true);
              if (text) say(text);
            }}
            onFail={(text) => say(text, 'bad')}
            onReload={() => load()}
          />
        ) : (
          <PlaceBody
            eventId={eventId}
            data={state.data.place}
            doors={doors}
            onWrote={onWrote}
            onFail={(text) => say(text, 'bad')}
            onFind={onClose}
          />
        )}
      </div>
    </Sheet>,
    document.body,
  );
}

/** The ladder: divider rows, a dot lit when the rung is known — read-only, never a box. */
function Ladder({ rungs }: { rungs: readonly LadderRung[] }) {
  return (
    <ol className="flex flex-col" data-fact-ladder="">
      {rungs.map((r) => (
        <li key={r.key} data-rung={r.key} data-on={r.on ? '1' : '0'} className="flex min-h-11 items-center gap-3 border-t border-ink/10 py-2 first:border-t-0">
          <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.on ? 'bg-sn-accent' : 'border border-ink/30'}`} />
          <span className="min-w-0 flex-1 text-[14px]">
            <span className="text-ink/60">{r.label} · </span>
            <span className={r.on ? 'text-ink' : 'text-ink/55'}>{r.value}</span>
            {r.note ? <span className="text-ink/55"> · {r.note}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

const SECTION_HEAD = 'font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/55';

/* ── DATE ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

function DateBody({
  onCancel,
  eventId,
  data,
  helpFirst,
  doors,
  onMonth,
  onWrote,
  onFail,
  onReload,
}: {
  onCancel: () => void;
  eventId: string;
  data: DateSheetData;
  helpFirst: boolean;
  doors: FactSheetStandIns;
  onMonth: (month: string) => void;
  onWrote: (toast: string | null) => void;
  onFail: (text: string) => void;
  onReload: () => void;
}) {
  const booked = data.bookedNames.length;
  /* 📅 "A few dates" is offered while nobody is booked — once a booking holds the day it is gone (owner 2026-11-13). */
  const fewOffered = booked === 0;
  const maxDays = Math.min(MAX_EVENT_DAYS, Math.max(1, data.maxDays ?? 1));
  const opts = data.options ?? { mode: 'specific' as const, candidates: [], windowStart: null, windowEnd: null };
  const hasOptions = !data.date && (opts.candidates.length > 0 || !!(opts.windowStart && opts.windowEnd));
  const [mode, setMode] = useState<'have' | 'few' | 'help'>(helpFirst ? 'help' : fewOffered && hasOptions ? 'few' : 'have');
  /* The date as it now stands on the event — shown at once after a save (the ladder, the row). */
  const [shown, setShown] = useState({ date: data.date, precision: data.precision, end: data.endDate ?? null });
  const [clash, setClash] = useState<{ reason: string; list: readonly DateClash[]; pick: { date: string; precision: string } } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [rowKey, setRowKey] = useState(0);

  /* 📅 How long the span runs when a new first day is picked: the span as it stands, else the day count the options
     carried ("your date becomes exact — N days from it"). Never past the type's cap. */
  const spanLength = () => {
    if (shown.precision === 'day' && shown.date && shown.end) return daysBetweenIso(shown.date, shown.end) + 1;
    return Math.min(maxDays, Math.max(1, data.days ?? 1));
  };

  /** A day (or a month) → the EVENT, at once. A day a booked supplier cannot do comes back refused, with who. A DAY
   *  also posts the span's last day (where the type may run longer than one) and replaces the options. */
  const save = async (date: string, precision: 'day' | 'month', endIn?: string | null): Promise<SaveAnswer> => {
    setClash(null);
    setNote(null);
    const spans = precision === 'day' && asksHowManyDays(maxDays);
    const end = !spans ? null : endIn !== undefined ? endIn : spanLength() > 1 ? addDaysIso(date, spanLength() - 1) : null;
    try {
      const r = await doors.date(date, precision, precision === 'day' ? { ...(spans ? { end } : {}), clearOptions: true } : undefined);
      if (r.ok) {
        setShown({ date, precision, end: spans ? (end && end !== date ? end : null) : shown.end });
        setNote(r.note ?? savedDateNote(booked));
        onWrote(precision === 'day' ? `Your date is ${dayWords(date)}` : `Your date is ${dateChangeWhen(date, 'month')} for now`);
        return { ok: true };
      }
      if (r.clash?.length) {
        setClash({ reason: r.error, list: r.clash, pick: { date, precision } });
        /* The refusal is said ONCE — by the clash note, which names who and how to ask. The row goes back to the day
           that stands (a fresh row, never a second "did not save" line under it). */
        setRowKey((k) => k + 1);
        return { ok: false, error: r.error, clashed: true };
      }
      return { ok: false, error: r.error };
    } catch {
      return { ok: false, error: FAILED };
    }
  };
  const ladder = dateLadder({ ...data, date: shown.date, precision: shown.precision, endDate: shown.end, options: hasOptions && !shown.date ? opts : undefined });
  const lastDayShown = asksHowManyDays(maxDays);

  return (
    <>
      <Ladder rungs={ladder} />
      {booked > 0 && shown.precision === 'day' && shown.date ? (
        <p className="text-[12.5px] text-ink/60" data-date-few-gone="">
          {data.bookedNames[0]} is booked for {shown.end ? `${dayWords(shown.date)} – ${dayWords(shown.end)}` : dayWords(shown.date)}, so that is your
          date — the dates you were considering are done with. A change asks them first.
        </p>
      ) : null}
      {data.change ? <PendingChange data={data} doors={doors} onWrote={onWrote} onFail={onFail} onReload={onReload} /> : null}
      <PillSelector
        label="Your date"
        value={mode}
        data="date-mode"
        options={[
          { key: 'have', label: 'I have a date' },
          ...(fewOffered ? [{ key: 'few' as const, label: 'A few dates' }] : []),
          { key: 'help', label: 'Help me choose' },
        ]}
        onPick={(k) => setMode(k)}
      />
      {mode === 'have' ? (
        <>
          <FormRows width="wide" data="fact-date">
            <DateRow
              key={rowKey}
              name={shown.precision === 'day' ? 'Change the day' : 'The day'}
              value={shown.precision === 'day' ? shown.date : null}
              empty="Pick the day"
              min={eventDateMinFor(todayKey(), data.dateExempt === true)}
              onKeep={(day) => save(day, 'day')}
              pillAttrs={{ 'data-fact-date-row': '' }}
            />
            {/* 📅 THE LAST DAY (owner 2026-11-13): shown from the start, "Same day" until picked; a 1-day type has none.
                A day past the type's cap is refused with `eventSpanRefusal`'s one line (said under the row). */}
            {lastDayShown ? (
              <DateRow
                key={`end-${rowKey}`}
                name="Last day"
                about={{ title: 'Last day', words: `If it runs more than a day — up to ${maxDays} days. Leave it as “Same day” for a one-day event.` }}
                value={shown.end}
                empty="Same day"
                min={shown.precision === 'day' && shown.date ? shown.date : eventDateMinFor(todayKey(), data.dateExempt === true)}
                max={shown.precision === 'day' && shown.date ? addDaysIso(shown.date, maxDays - 1) : null}
                onKeep={(day) =>
                  shown.precision === 'day' && shown.date
                    ? save(shown.date, 'day', day === shown.date ? null : day)
                    : { ok: false, error: 'Pick the first day before the last day.' }
                }
                pillAttrs={{ 'data-fact-date-last-day': '' }}
              />
            ) : null}
          </FormRows>
          {hasOptions && !shown.date ? (
            <p className="text-[12.5px] text-ink/60" data-date-replaces-options="">
              Picking one day replaces the {opts.candidates.length ? `${opts.candidates.length} ${(data.days ?? 1) > 1 ? 'options' : 'dates'}` : 'window'} you’re
              considering — your date becomes exact{(data.days ?? 1) > 1 ? ` (${data.days} days from it)` : ''}.
            </p>
          ) : null}
        </>
      ) : mode === 'few' ? (
        <FewDates data={data} maxDays={maxDays} doors={doors} onCancel={onCancel} onWrote={onWrote} onFail={onFail} />
      ) : (
        <HelpBody
          data={data}
          pending={pending}
          onUse={(day) => {
            start(async () => {
              const r = await save(day, 'day');
              if (!r.ok && !r.clashed) onFail(r.error ?? FAILED);
            });
          }}
          onMonth={(m) => {
            /* No day yet → the month IS the date for now (saved, as the prototype); a day already set → compare only. */
            if (shown.precision !== 'day') {
              start(async () => {
                const r = await save(`${m}-01`, 'month');
                if (!r.ok && !r.clashed) onFail(r.error ?? FAILED);
              });
            }
            onMonth(m);
          }}
        />
      )}
      {clash ? <DateClashNote eventId={eventId} clash={clash} /> : null}
      {note ? (
        <p className="text-[13px] text-ink/70" data-date-note="" role="status">
          {note}
        </p>
      ) : null}
      {booked > 0 && shown.precision === 'day' && !clash ? (
        <p className="text-[12.5px] text-ink/60" data-date-held="">
          A day {listWords(data.bookedNames)} can’t do is never moved quietly — they are asked first, and your date stays until
          they answer.
        </p>
      ) : null}
    </>
  );
}

/**
 * 📅 A FEW DATES (owner 2026-11-13, prototype `event_dates_edit_2026-11-13`): the shared onboarding calendar
 * (`DateCalendar`, reused as-is — never forked) with "How many days is your event?" above it. Nothing reaches the event
 * until Save; Save writes the options and the day count and leaves the exact date EMPTY (`updateEventDate` with `date_options=1`).
 */
function FewDates({
  data,
  maxDays,
  doors,
  onCancel,
  onWrote,
  onFail,
}: {
  data: DateSheetData;
  maxDays: number;
  doors: FactSheetStandIns;
  onCancel: () => void;
  onWrote: (toast: string | null) => void;
  onFail: (text: string) => void;
}) {
  const o = data.options ?? { mode: 'specific' as const, candidates: [], windowStart: null, windowEnd: null };
  const [w, setW] = useState({
    mode: o.mode,
    candidates: [...o.candidates].sort(),
    windowStart: o.windowStart,
    windowEnd: o.windowEnd,
    days: Math.min(maxDays, Math.max(1, data.days ?? 1)),
  });
  const [saving, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const n = w.days;
  const can = w.mode === 'specific' ? w.candidates.length > 0 : !!(w.windowStart && w.windowEnd);
  const noun = n > 1 ? (w.candidates.length === 1 ? 'option' : 'options') : w.candidates.length === 1 ? 'date' : 'dates';
  const label = saving ? 'Saving…' : w.mode === 'specific' ? (w.candidates.length ? `Save ${w.candidates.length} ${noun}` : `Save ${noun}`) : 'Save range';
  return (
    <section className="flex flex-col gap-2" data-date-few="">
      <p className={SECTION_HEAD}>Dates you’re considering</p>
      <p className="text-[12.5px] text-ink/60">
        Your venue’s booked day becomes your date. Until then, these are options — Find checks suppliers against all of them.
      </p>
      <DateCalendar
        chrome="bare"
        dateExempt={data.dateExempt === true}
        mode={w.mode}
        candidates={w.candidates}
        windowStart={w.windowStart}
        windowEnd={w.windowEnd}
        days={w.days}
        maxDays={maxDays}
        sayFloor
        onChange={(p) => {
          setError(null);
          setW((s) => ({
            mode: p.dateMode ?? s.mode,
            candidates: p.dateCandidates ?? s.candidates,
            windowStart: p.windowStart !== undefined ? p.windowStart : s.windowStart,
            windowEnd: p.windowEnd !== undefined ? p.windowEnd : s.windowEnd,
            days: p.days ?? s.days,
          }));
        }}
      />
      {error ? (
        <p role="alert" className="text-[13px] text-sn-accent" data-date-few-error="">
          {error}
        </p>
      ) : null}
      <div className="sticky bottom-0 grid grid-cols-2 gap-2.5 border-t border-ink/10 bg-paper pb-1 pt-2.5 dark:bg-cream">
        <ActionButton tone="neutral" icon={X} label="Cancel" onClick={onCancel} disabled={saving} />
        <ActionButton
          tone="brand"
          main
          icon={Check}
          label={label}
          disabled={!can || saving}
          data-date-few-save=""
          onClick={() =>
            start(async () => {
              try {
                const r = doors.options
                  ? await doors.options({
                      dateMode: w.mode,
                      dateCandidates: w.mode === 'specific' ? w.candidates : [],
                      windowStart: w.mode === 'window' ? w.windowStart : null,
                      windowEnd: w.mode === 'window' ? w.windowEnd : null,
                      days: w.days,
                    })
                  : ({ ok: true, message: 'Saved' } as const);
                if (r.ok) {
                  onWrote(r.message);
                  onCancel();
                } else setError(r.error);
              } catch {
                onFail(FAILED);
              }
            })
          }
        />
      </div>
    </section>
  );
}

function PendingChange({
  data,
  doors,
  onWrote,
  onFail,
  onReload,
}: {
  data: DateSheetData;
  doors: FactSheetStandIns;
  onWrote: (toast: string | null) => void;
  onFail: (text: string) => void;
  onReload: () => void;
}) {
  const c = data.change!;
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);
  if (gone) return null;
  const now = Date.now();
  const from = c.fromDate ? dateChangeWhen(c.fromDate, c.fromPrecision) : 'your current date';
  return (
    <section data-date-change-asked="" className="flex flex-col gap-1.5 border-t border-ink/10 pt-3">
      <p className="text-[14px] text-ink">
        <span className="font-semibold">Asked.</span> You asked to move to <span className="font-semibold">{dateChangeWhen(c.proposedDate, c.proposedPrecision)}</span>.
      </p>
      <ul className="flex flex-col">
        {c.suppliers.map((s) => (
          <li key={s.vendorProfileId} className="text-[13px] text-ink/70">
            {s.name} — {dateChangeAnswerLine(s, now)}
          </li>
        ))}
      </ul>
      <p className="text-[12.5px] text-ink/60">Your date stays {from} meanwhile, and guests see nothing.</p>
      <div className="flex flex-wrap gap-2">
        <ActionButton
          tone="neutral"
          icon={X}
          label={pending ? 'Withdrawing…' : 'Withdraw'}
          disabled={pending}
          onClick={() =>
            start(async () => {
              try {
                const r = await doors.withdraw();
                if (r.ok) {
                  setGone(true);
                  onWrote(r.message ?? 'Withdrawn. Your date stays as it is.');
                  onReload();
                } else onFail(r.error);
              } catch {
                onFail('That did not go through. Nothing changed — please try again.');
              }
            })
          }
        />
      </div>
    </section>
  );
}

const TOP = 3;

function HelpBody({
  data,
  pending,
  onUse,
  onMonth,
}: {
  data: DateSheetData;
  pending: boolean;
  onUse: (day: string) => void;
  onMonth: (month: string) => void;
}) {
  const [pick, setPick] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const help = data.help;
  const ranked: MatrixDate[] = useMemo(() => (help && help !== 'unread' ? rankWithPin(help.days, pin) : []), [help, pin]);
  const pins = useMemo(() => {
    const seen = new Set<string>();
    const out: { key: string; label: string }[] = [];
    for (const cat of ranked[0]?.categories ?? []) {
      for (const v of cat.vendors) {
        if (v.state === 'unknown' || seen.has(v.key)) continue;
        seen.add(v.key);
        out.push({ key: v.key, label: `${v.name} · ${cat.label}` });
      }
    }
    return out;
  }, [ranked]);

  const month = <MonthCompare onMonth={onMonth} pending={pending} first={!help} value={help && help !== 'unread' ? help.month : ''} />;
  if (!help) {
    return (
      <div className="flex flex-col gap-2" data-help-me-choose="no-month">
        <p className="text-[13.5px] text-ink/70">
          Which month are you considering? Its Saturdays appear here, ranked by how many of your suppliers are free.
        </p>
        {month}
      </div>
    );
  }
  if (help === 'unread') {
    return (
      <p role="alert" className="text-[13.5px] text-ink/75" data-help-me-choose="unread">
        Your suppliers’ calendars could not be read just now. Your date is unchanged — close this and try again.
      </p>
    );
  }
  const shown = all ? ranked : ranked.slice(0, TOP);
  const current = ranked.find((d) => d.dateKey === pick) ?? ranked[0] ?? null;
  return (
    <div className="flex flex-col gap-3" data-help-me-choose="">
      <p className={SECTION_HEAD}>The days you’re considering — ranked by your suppliers</p>
      {help.pricedCount > 0 ? (
        <p className="text-[12.5px] text-ink/60" data-help-priced="">
          Only days all {formatCount(help.pricedCount)} of your priced suppliers can take are offered.
        </p>
      ) : null}
      {ranked.length === 0 ? (
        <p className="text-[13.5px] text-ink/70" data-find-date-none-fit="">
          {noDayWords(help.pricedCount)}
        </p>
      ) : (
        <>
          <ol className="flex flex-col">
            {shown.map((d, i) => {
              const on = d.dateKey === current?.dateKey;
              return (
                <li key={d.dateKey} className="border-t border-ink/10 first:border-t-0">
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPick(d.dateKey)}
                    data-find-date-candidate={d.dateKey}
                    className={`sn-press flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      on ? 'bg-sn-accent/10 ring-2 ring-sn-accent' : ''
                    }`}
                  >
                    <span className={`w-5 shrink-0 font-mono text-[11px] ${on ? 'text-sn-accent' : 'text-ink/45'}`}>{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`text-[17px] font-semibold tracking-tight ${on ? 'text-sn-accent' : 'text-ink'}`}>{d.label}</span>
                        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/45">{d.dow}</span>
                        {d.isBest ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sn-accent/15 px-2 py-0.5 text-[11px] font-medium text-sn-accent">
                            <Star aria-hidden className="h-3 w-3" strokeWidth={2.25} />
                            Best match
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-ink/60">{coverageHeadline(d)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {ranked.length > TOP ? (
            <button type="button" onClick={() => setAll((a) => !a)} className="min-h-11 self-start text-[13px] font-medium text-sn-accent">
              {all ? 'Show the top three' : `Show all ${formatCount(ranked.length)} days`}
            </button>
          ) : null}
          {current ? (
            <div className="flex flex-col gap-1" data-find-date-picked={current.dateKey}>
              <p className={SECTION_HEAD}>Who works together on {current.label}</p>
              <ul className="divide-y divide-ink/[0.06]">
                {current.categories.map((cat) => (
                  <CategoryLine key={cat.category} cat={cat} />
                ))}
              </ul>
              <p className="text-[13px] font-medium text-ink/75">{comboSummary(current)}</p>
              <div className="pt-1">
                <ActionButton
                  tone="brand"
                  main
                  icon={Check}
                  label={pending ? 'Saving…' : `Use ${current.label}`}
                  disabled={pending}
                  onClick={() => onUse(current.dateKey)}
                  data-testid="find-date-use"
                />
              </div>
            </div>
          ) : null}
        </>
      )}
      {pins.length > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[14px] text-ink">Must-have supplier</span>
          <PickMenu
            label="Must-have supplier"
            value={pin ?? 'none'}
            dataAttr="data-find-date-pin"
            options={[{ key: 'none', label: 'Nobody in particular' }, ...pins]}
            onPick={(k) => setPin(k === 'none' ? null : k)}
          />
        </div>
      ) : null}
      <p className="text-[12.5px] text-ink/60">
        {data.bookedNames.length > 0
          ? `Only days every booked supplier can do are offered — ${listWords(data.bookedNames)} ${data.bookedNames.length === 1 ? 'holds' : 'hold'} your date.`
          : 'Nobody is booked yet, so every Saturday your priced suppliers can take is offered — ranked by who is free.'}
      </p>
      {help.offPlatformCount > 0 ? (
        <p className="text-[12.5px] text-ink/55">
          {formatCount(help.offPlatformCount)} of your suppliers {help.offPlatformCount === 1 ? 'is' : 'are'} not on Setnayan — their
          calendar can’t be seen, so confirm with them directly.
        </p>
      ) : null}
      {month}
    </div>
  );
}

function MonthCompare({ onMonth, pending, first, value }: { onMonth: (m: string) => void; pending: boolean; first: boolean; value: string }) {
  const [month, setMonth] = useState(value);
  const min = todayKey().slice(0, 7);
  return (
    <div className="flex flex-col gap-2" data-find-date-month="">
      {first ? null : <p className="text-[13px] text-ink/70">Compare another month</p>}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="month"
          min={min}
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          aria-label="The month you are considering"
          className="min-h-11 rounded-full border border-ink/15 bg-white px-4 text-[16px] text-ink dark:bg-cream"
        />
        <ActionButton
          tone="neutral"
          icon={CalendarDays}
          label="Compare its Saturdays"
          disabled={!/^\d{4}-\d{2}$/.test(month) || pending}
          onClick={() => onMonth(month)}
        />
      </div>
    </div>
  );
}

/* ── PLACE ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

const AUTO_DRAFT_MS = 900;

function PlaceBody({
  eventId,
  data,
  doors,
  onWrote,
  onFail,
  onFind,
}: {
  eventId: string;
  data: PlaceSheetData;
  doors: FactSheetStandIns;
  onWrote: () => void;
  onFail: (text: string) => void;
  onFind: () => void;
}) {
  const [slots, setSlots] = useState<PlaceSlot[]>(data.slots);
  const [city, setCity] = useState(data.city ?? '');
  /* 📍 A non-wedding's City or area IS its Region (owner 2026-11-13): the stored slug, and the place last picked here. */
  const [region, setRegion] = useState<{ value: string | null; label: string | null }>(data.region ?? { value: null, label: null });
  const reception = slots.find((s) => s.slot === 'reception') ?? null;
  const pinNear = reception ? (reception.booked && reception.choice.source !== 'own' ? null : reception.pin) : null;
  /* 🔒 A BOOKED RECEPTION SETS THE PLACE (owner 2026-10-30, final Suppliers design: "once a reception is booked, location
     changed to the receptions location") — its city, read-only, and one line why. The picker is for before booking. */
  const locked = placeLockedByReception({ city: data.city, slots: data.slots });

  const writeEvents = async (events: Record<string, unknown>): Promise<boolean> => {
    try {
      const r = await doors.draft({ events });
      if (r.ok) {
        onWrote();
        return true;
      }
      onFail(r.error || FAILED);
    } catch {
      onFail(FAILED);
    }
    return false;
  };
  const setSlot = (slot: PlaceSlot['slot'], next: Partial<PlaceSlot>) =>
    setSlots((all) => all.map((s) => (s.slot === slot ? { ...s, ...next } : s)));

  return (
    <>
      <Ladder
        rungs={placeLadder({
          city: data.city === null ? null : locked ? locked.where : city,
          region: data.city === null && data.region ? (locked ? { value: locked.where, label: locked.where } : region) : null,
          slots,
        })}
      />
      {locked ? (
        <section className="flex flex-col gap-1.5" data-place-locked="">
          <div className="flex items-center justify-between gap-3">
            <span className={SECTION_HEAD}>Where</span>
            <span className="min-w-0 text-right text-[15px] font-medium text-ink" data-place-locked-where="">
              {locked.where}
            </span>
          </div>
          <p className="text-[12.5px] text-ink/60" data-place-locked-why="">
            {lockedPlaceWhy(locked)}
          </p>
        </section>
      ) : data.city !== null ? (
        <section className="flex flex-col gap-1.5" data-place-city="">
          {/* CityPick names itself ("City or area") — no second heading over it. Nothing typed → the Top 10 in the
              Philippines (owner 2026-10-30); search finds any city; Near me measures from the phone. */}
          <CityPick
            value={city}
            near={pinNear}
            start="top10"
            onPick={(name) => {
              const was = city;
              setCity(name);
              void writeEvents({ std_film_venue_city: name }).then((ok) => {
                if (!ok) setCity(was);
              });
            }}
          />
          <p className="text-[12.5px] text-ink/60" data-place-before-booking="">
            Once you book a reception, your place becomes its city.
          </p>
        </section>
      ) : data.city === null && data.region ? (
        <section className="flex flex-col gap-1.5" data-place-region="">
          {/* ONE value: the event's Region (⚙ Event settings), written through its one writer — never a second column. */}
          <CityPick
            value={region.label ?? ''}
            near={pinNear}
            start="top10"
            onPick={(name, place) => {
              const was = region;
              setRegion({ value: place.rk, label: name });
              void (doors.region ? doors.region(place.rk, was.value) : Promise.resolve({ ok: true } as const))
                .then((r) => {
                  if (r.ok) onWrote();
                  else {
                    setRegion(was);
                    onFail(r.message || FAILED);
                  }
                })
                .catch(() => {
                  setRegion(was);
                  onFail(FAILED);
                });
            }}
          />
          <p className="text-[12.5px] text-ink/60" data-place-region-note="">
            This is your <span className="font-semibold text-ink">Region</span> in ⚙ Event settings — one value, shown in both places.
            Changing it here changes it there.
          </p>
          <p className="text-[12.5px] text-ink/60">Suppliers near this area fit your event. Once you book a venue, your place becomes its city.</p>
        </section>
      ) : null}
      {slots.map((s) => (
        <VenueSlotBody
          key={s.slot}
          eventId={eventId}
          slot={s}
          doors={doors}
          onChoice={(choice) => setSlot(s.slot, { choice })}
          onTyped={(next) => setSlot(s.slot, next)}
          writeEvents={writeEvents}
          onWrote={onWrote}
          onFail={onFail}
          onFind={onFind}
        />
      ))}
      <p className="text-[12.5px] text-ink/60" data-place-note="">
        Saves as you type. Guests see it when you Apply your Event Hub. A place you type yourself is only its name and its pin, for
        your guests — it is not added to your suppliers.
      </p>
    </>
  );
}

function VenueSlotBody({
  eventId,
  slot,
  doors,
  onChoice,
  onTyped,
  writeEvents,
  onWrote,
  onFail,
  onFind,
}: {
  eventId: string;
  slot: PlaceSlot;
  doors: FactSheetStandIns;
  onChoice: (c: PlaceSlot['choice']) => void;
  onTyped: (next: Pick<PlaceSlot, 'typed' | 'address' | 'pin'>) => void;
  writeEvents: (events: Record<string, unknown>) => Promise<boolean>;
  onWrote: () => void;
  onFail: (text: string) => void;
  onFind: () => void;
}) {
  const own = !slot.booked || slot.choice.source === 'own';
  /* 📍 Where this card's pin is set (owner 2026-10-22, `lib/venue-pin-door.ts`) — a shop's is the shop's in every mode. */
  const door = venuePinDoor(slot.booked, own);
  /* The typed card drafts itself a short pause after the last change (the Maker's AutoDraft rule) — opening sends nothing. */
  const watch = JSON.stringify([slot.typed, slot.address, slot.pin]);
  const sent = useRef(watch);
  const latest = useRef(slot);
  latest.current = slot;
  useEffect(() => {
    if (watch === sent.current) return;
    const t = window.setTimeout(() => {
      sent.current = watch;
      const s = latest.current;
      void writeEvents({
        [s.columns.name]: s.typed.trim() || null,
        [s.columns.address]: s.address.trim() || null,
        /* A shop's card sends no pin of the couple's — the guests' map follows the shop's own. */
        ...(door === 'shop'
          ? {}
          : {
              [s.columns.lat]: s.pin?.lat ?? null,
              [s.columns.lng]: s.pin?.lng ?? null,
            }),
      });
    }, AUTO_DRAFT_MS);
    return () => window.clearTimeout(t);
  }, [watch, writeEvents, door]);

  const choose = (source: 'supplier' | 'own') => {
    const was = slot.choice;
    const next = { ...slot.choice, source };
    onChoice(next);
    void doors
      .draft({ widgets: { venue_map: { venue: { [slot.slot]: next } } } })
      .then((r) => {
        if (r.ok) onWrote();
        else {
          onChoice(was);
          onFail(r.error || FAILED);
        }
      })
      .catch(() => {
        onChoice(was);
        onFail(FAILED);
      });
  };

  const findTile = slot.slot === 'ceremony' ? 'ceremony' : 'reception';
  return (
    <section className="flex flex-col gap-2 border-t border-ink/10 pt-3" data-venue-slot={slot.slot}>
      <p className={SECTION_HEAD}>{slot.label}</p>
      {slot.booked ? (
        <PillSelector
          label={`${slot.label} — where its details come from`}
          value={own ? 'own' : 'supplier'}
          data="venue-source"
          options={[
            { key: 'supplier', label: 'Supplier’s details' },
            { key: 'own', label: 'Enter your own' },
          ]}
          onPick={choose}
        />
      ) : null}
      {!own && slot.booked ? (
        <div className="flex flex-col" data-venue-booked="">
          <p className="text-[15px] font-medium text-ink">{slot.booked.name}</p>
          {slot.booked.address ? <p className="text-[13px] text-ink/65">{slot.booked.address}</p> : null}
          <p className="text-[12px] text-ink/55">Booked · follows the booking{slot.booked.pinned && door !== 'shop' ? ' · pinned on the map' : ''}</p>
          {door === 'shop' ? <ShopPinNote shop={slot.booked.name} pinned={slot.booked.pinned} /> : null}
          {door === 'manual' && slot.booked.vendorId ? (
            /* 📍 A supplier added by hand: its pin is set right here, on its own card (owner 2026-10-22). */
            <div className="pt-2">
              <ManualVenuePin
                eventId={eventId}
                vendorId={slot.booked.vendorId}
                slot={slot.slot}
                address={slot.booked.address ?? ''}
                pin={slot.booked.pin ?? null}
                save={doors.manualPin ?? labPinSaved}
              />
            </div>
          ) : null}
          <p className="pt-1 text-[12px] text-ink/55">Changing the venue means cancelling a booking — do that from Booked.</p>
        </div>
      ) : (
        <>
          <FormRows width="wide" data={`venue-name-${slot.slot}`}>
            <TypedRow
              name="Name of the place"
              value={slot.typed}
              maxLength={160}
              empty="Add"
              attrs={{ 'data-venue-name': slot.slot }}
              onKeep={(t) => onTyped({ typed: t, address: slot.address, pin: slot.pin })}
            />
          </FormRows>
          <AddressPinField
            id={`fact-venue-${slot.slot}`}
            initialAddress={slot.address}
            initialPin={slot.pin}
            hideHints
            pinLocked={door === 'shop' && slot.booked ? shopPinLine(slot.booked.name, slot.booked.pinned) : null}
            onChange={(next) => onTyped({ typed: latest.current.typed, address: next.address, pin: next.pin })}
          />
          {!slot.booked ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <ActionButton
                tone="brand"
                icon={Search}
                label={`Find in ${slot.label}`}
                href={`/dashboard/${eventId}/vendors?open=${findTile}`}
                prefetch={false}
                onClick={onFind}
              />
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/** A lab that hands no manual-pin stand-in: the card answers saved, and nothing leaves the browser. */
const labPinSaved: ManualVenuePinSave = async () => ({ ok: true });

/* ── words ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

function listWords(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
