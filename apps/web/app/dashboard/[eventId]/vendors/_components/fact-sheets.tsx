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
 * 💾 EVERYTHING WAITS FOR APPLY (answer 7): each write goes through the one draft door (`hubDraftAction` intent
 * `save`) — the same columns and checks the Maker's Details uses — and the sheet says so. A date change is the
 * shipped request (intent `date_change`). The sheet opens with ONE read (`openFactSheet`) and draws nothing before
 * it; when it closes after a write, the page is drawn again ONCE so Find, Build and the line re-run on the new date.
 *
 * Lab: `FactSheetStandInCtx` answers the read and the writes from fixtures (`/dev/suppliers-lab?sheet=…`).
 */
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
import { CityPick } from '../../launch/_components/details-city-pick';

/* ── THE DOORS (the real ones; the lab stands in) ─────────────────────────────────────────────────────────────── */

export type FactSheetStandIns = {
  open: (which: FactSheetKey, month: string | null) => Promise<FactSheetData>;
  /** A draft patch through the one draft door (`hubDraftAction` intent `save`). */
  draft: (patch: Record<string, unknown>) => Promise<HubDraftActionResult>;
  /** The date-change request (J51): withdraw it. */
  withdraw: () => Promise<HubDraftActionResult>;
};
export const FactSheetStandInCtx = createContext<FactSheetStandIns | null>(null);

function useDoors(eventId: string, priced: readonly string[]): FactSheetStandIns {
  const lab = useContext(FactSheetStandInCtx);
  return useMemo(
    () =>
      lab ?? {
        open: (which, month) => openFactSheet(eventId, { which, month, priced: [...priced] }),
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
      },
    [lab, eventId, priced],
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
  onWrote: () => void;
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

  return (
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
            eventId={eventId}
            data={state.data.date}
            helpFirst={helpFirst}
            doors={doors}
            onMonth={(m) => load(m)}
            onWrote={(text) => {
              onWrote();
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
    </Sheet>
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
  eventId,
  data,
  helpFirst,
  doors,
  onMonth,
  onWrote,
  onFail,
  onReload,
}: {
  eventId: string;
  data: DateSheetData;
  helpFirst: boolean;
  doors: FactSheetStandIns;
  onMonth: (month: string) => void;
  onWrote: (toast: string | null) => void;
  onFail: (text: string) => void;
  onReload: () => void;
}) {
  const [mode, setMode] = useState<'have' | 'help'>(helpFirst ? 'help' : 'have');
  /* The date as it now stands in the draft — shown at once after a save (the ladder, the row). */
  const [shown, setShown] = useState({ date: data.date, precision: data.precision });
  const [clash, setClash] = useState<{ reason: string; list: readonly DateClash[]; pick: { date: string; precision: string } } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const booked = data.bookedNames.length;

  /** A day (or a month) → the DRAFT. A day a booked supplier cannot do comes back refused, with who. */
  const save = async (date: string, precision: 'day' | 'month'): Promise<SaveAnswer> => {
    setClash(null);
    setNote(null);
    try {
      const r = await doors.draft({ events: { event_date: date, event_date_precision: precision } });
      if (r.ok) {
        setShown({ date, precision });
        setNote(savedDateNote(booked));
        onWrote(precision === 'day' ? `Your date is ${dayWords(date)}` : `Your date is ${dateChangeWhen(date, 'month')} for now`);
        return { ok: true };
      }
      if (r.clash?.length) {
        setClash({ reason: r.error, list: r.clash, pick: { date, precision } });
        return { ok: false, error: r.error, clashed: true };
      }
      return { ok: false, error: r.error };
    } catch {
      return { ok: false, error: FAILED };
    }
  };
  const ladder = dateLadder({ ...data, date: shown.date, precision: shown.precision });

  return (
    <>
      <Ladder rungs={ladder} />
      {data.change ? <PendingChange data={data} doors={doors} onWrote={onWrote} onFail={onFail} onReload={onReload} /> : null}
      <PillSelector
        label="Your date"
        value={mode}
        data="date-mode"
        options={[
          { key: 'have', label: 'I have a date' },
          { key: 'help', label: 'Help me choose' },
        ]}
        onPick={(k) => setMode(k)}
      />
      {mode === 'have' ? (
        <FormRows width="wide" data="fact-date">
          <DateRow
            name={shown.precision === 'day' ? 'Change the day' : 'The day'}
            value={shown.precision === 'day' ? shown.date : null}
            empty="Pick the day"
            min={todayKey()}
            onKeep={(day) => save(day, 'day')}
            pillAttrs={{ 'data-fact-date-row': '' }}
          />
        </FormRows>
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
            /* No day yet → the month IS the date for now (drafted, as the prototype); a day already set → compare only. */
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
  const reception = slots.find((s) => s.slot === 'reception') ?? null;
  const pinNear = reception ? (reception.booked && reception.choice.source !== 'own' ? null : reception.pin) : null;

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
      <Ladder rungs={placeLadder({ city: data.city === null ? null : city, slots })} />
      {data.city !== null ? (
        <section className="flex flex-col gap-1.5" data-place-city="">
          <p className={SECTION_HEAD}>City or area</p>
          <CityPick
            value={city}
            near={pinNear}
            onPick={(name) => {
              const was = city;
              setCity(name);
              void writeEvents({ std_film_venue_city: name }).then((ok) => {
                if (!ok) setCity(was);
              });
            }}
          />
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
        [s.columns.lat]: s.pin?.lat ?? null,
        [s.columns.lng]: s.pin?.lng ?? null,
      });
    }, AUTO_DRAFT_MS);
    return () => window.clearTimeout(t);
  }, [watch, writeEvents]);

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
          <p className="text-[12px] text-ink/55">Booked · follows the booking{slot.booked.pinned ? ' · pinned on the map' : ''}</p>
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

/* ── words ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

function listWords(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
