'use client';

import { useContext, useState } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { TICKER_PILL_CLASS, TickerPill, TimeTicker } from '@/app/_components/ticker';
import { TimelineDash, TimelineEmpty, TimelineRow } from '@/app/_components/timeline-row';
import { daysBetween, formatDateHeading, spanOf, toDatetimeLocal, wallDateKey } from '@/lib/schedule-rail';
import { fromDatetimeLocalValue } from '@/lib/schedule-datetime-local';
import { readScheduleAudience } from '@/lib/schedule-audience';
import { STUDIO_FOOT_BUTTON } from '@/lib/studio-skin';
import { WIDEST_CLOCK_WORDS, byStart, clockWords, moveStart, nextMomentSpan, overlapLine, overlapsAbove, pickEnd, spanLine, type TimeSpan } from '@/lib/timeline';
import { PickSheetContext } from '../../website/editor/_components/pick-menu-place';
import type { DayMoment } from './day-types';
import { toFormData, useDayActions } from './day-ui';

/**
 * 🗓 STUDIO › SCHEDULE — THE DAY AS TIMELINE ROWS (owner 2026-10-08, `INTERACTION_RULES.md` § 9 "Timeline row +
 * the time ticker"; approved gallery `prototypes/control_templates_2026-10-08.html` § 13). Owner, verbatim:
 * *"i though of a good way to create the schedule maker. tap the time start and time end and name of that
 * schedule"* · *"the popup exceeded the screen when it went up on schedule row. center the time. how about a
 * ticker instead so it does not eat too much space"*.
 *
 *   the day (its date, ⓘ: set in Suppliers) · one row per moment —
 *   START pill – END pill · name · ⋯ — · + Add a moment
 *
 * The row is the app's ONE `TimelineRow` and the times roll on its ONE ticker (`app/_components/`); this file only
 * says what a roll MEANS here:
 *   · moving the START moves the END with it (the length is kept);
 *   · the END's line says the length ("5:00 PM – 6:00 PM · 1 h"); an end at or before the start is THE NEXT DAY,
 *     and says so;
 *   · rows sort by start; an overlap is ONE amber line under the later row, never blocked;
 *   · "+ Add a moment" starts where the last one ended, one hour long, with its name ready to type — and a new row
 *     left unnamed is dropped, never saved.
 *
 * 🔑 NO NEW WRITE, AND ONE REQUEST A PICK. A time is rolled on screen and written ONCE, when its ticker closes,
 * through the rail's own `updateScheduleBlock` (the SAME quiet actions, `quietDayActions`) and the rail's own
 * override / refusal handling (`onPatch`) — no render of the Maker, no `router.refresh()`. An END TIME IS STORED
 * (`event_schedule_blocks.end_at`), so the end pill reads and writes that column; nothing new is kept.
 *
 * ⋯ HOLDS THE REST. The row is the owner's three things — start, end, name. The moment's PLACE and who it is FOR
 * (For ▾, 4c's stored `audience`) are behind ⋯ with everything else: the shipped `MomentInspector` already draws
 * Where and For ▾ beside phase, visible to guests, suppliers, parts, notes, shift and remove — the same fields,
 * the same writes — so nothing the row could do is lost. (The row still carries who it is for as
 * `data-studio-moment-for`.)
 *
 * 🧱 BANDS, NOT BOXES (owner 2026-10-07: *"bands? full width"*): the day and every moment sit on full-width bands
 * with hairlines, never rounded cards.
 */

export type StudioDayProps = {
  eventId: string;
  dateKey: string | null;
  /** The day's top-level moments, as the rail holds them (overrides applied). */
  moments: readonly DayMoment[];
  canEdit: boolean;
  /** Draw a guess now, write it, and on a refusal put it back and say so (the rail's `write`). */
  onPatch: (id: string, patch: Partial<DayMoment>, send: () => Promise<unknown>) => void;
  /** The shipped add sheet — where the day has no date yet, or a coordinator may stage a moment. */
  onAdd: () => void;
  /** Add this named moment in place (ONE write, no render). Null: only the shipped sheet can add here. */
  onCreate?: ((moment: { label: string; startMin: number; endMin: number }) => void) | null;
  /** Moments whose add has not landed yet — shown, not yet editable. */
  pendingIds?: ReadonlySet<string>;
  onMore: (id: string) => void;
  /** A refusal, said under the day. */
  notice: string | null;
};

/** The new row, before it has a name — it lives only on this screen. */
const NEW_ROW = '__new';

/** What a ticker has rolled to and not written yet. `end`: an end time has been chosen (a moment may have none). */
export type Rolled = { span: TimeSpan; end: boolean };

/**
 * THE ONE WRITE A CLOSED TICKER OWES — or null when nothing moved (then nothing is sent). Pure, so the rule is
 * tested: a moved start takes the end with it (the length is kept); an end past midnight lands on the next date;
 * a moment with NO end time keeps none unless an end was chosen.
 */
export function rolledTimesWrite(input: {
  dateKey: string;
  stored: { startMin: number; endMin: number; hasEnd: boolean };
  rolled: Rolled | null;
}): { values: { start_at?: string; end_at?: string }; patch: Pick<Partial<DayMoment>, 'start_at' | 'end_at'> } | null {
  const { dateKey, stored, rolled: r } = input;
  if (!r) return null;
  const startMoved = r.span.startMin !== stored.startMin;
  const endMoved = r.end && (!stored.hasEnd || r.span.endMin !== stored.endMin);
  if (!startMoved && !endMoved) return null;
  const values: { start_at?: string; end_at?: string } = {};
  const patch: Pick<Partial<DayMoment>, 'start_at' | 'end_at'> = {};
  if (startMoved) {
    values.start_at = toDatetimeLocal(dateKey, r.span.startMin);
    patch.start_at = fromDatetimeLocalValue(values.start_at) ?? undefined;
  }
  /* The end goes with a moved start — unless the moment has no end time at all. */
  if (stored.hasEnd || r.end) {
    values.end_at = toDatetimeLocal(dateKey, r.span.endMin);
    patch.end_at = fromDatetimeLocalValue(values.end_at);
  }
  return { values, patch };
}

/** Where "+ Add a moment" starts: where the last one ended ON THE DAY BEING ADDED TO, one hour long. */
export function freshMomentSpan(moments: readonly DayMoment[], dateKey: string | null): TimeSpan {
  return nextMomentSpan(moments.filter((m) => wallDateKey(m.start_at) === dateKey).map((m) => spanOf(m.start_at, m.end_at)));
}

/** What the new row becomes when its name is kept: a moment to add — or NOTHING when it was left unnamed. */
export function freshMomentToAdd(span: TimeSpan | null, text: string | null): { label: string; startMin: number; endMin: number } | null {
  const label = (text ?? '').trim();
  return span && label ? { label, startMin: span.startMin, endMin: span.endMin } : null;
}

function MomentRow({
  m,
  eventId,
  canEdit,
  editing,
  onEdit,
  onEndEdit,
  onPatch,
  onMore,
  clash,
}: {
  m: DayMoment;
  eventId: string;
  canEdit: boolean;
  /** Is this row's name open? One row at a time — the day's state. */
  editing: boolean;
  onEdit: () => void;
  onEndEdit: () => void;
  onPatch: StudioDayProps['onPatch'];
  onMore: (id: string) => void;
  /** "Starts before Ceremony ends (4:00 PM)." — or null. */
  clash: string | null;
}) {
  const { updateScheduleBlock } = useDayActions();
  /* ▁ On a phone the ticker rises in the Maker's one sheet (handed down by the shell). */
  const sheet = useContext(PickSheetContext);
  const audience = readScheduleAudience(m.audience ?? null);
  const dateKey = wallDateKey(m.start_at);
  const stored = spanOf(m.start_at, m.end_at);
  const [rolled, setRolled] = useState<Rolled | null>(null);
  const shown: TimeSpan = rolled?.span ?? { startMin: stored.startMin, endMin: stored.endMin };
  const hasEnd = stored.hasEnd || rolled?.end === true;

  /** ONE write for whatever the ticker rolled to — sent when it closes, and only if something moved. */
  const writeRolled = () => {
    const owed = rolledTimesWrite({ dateKey, stored, rolled });
    setRolled(null);
    if (!owed) return;
    onPatch(m.block_id, owed.patch, () => updateScheduleBlock(toFormData({ event_id: eventId, block_id: m.block_id, ...owed.values })));
  };
  const saveName = (value: string) => {
    const text = value.trim();
    /* A moment is never left without a name: an emptied name stays as it was. */
    if (!text || text === m.label.trim()) return;
    onPatch(m.block_id, { label: text }, () => updateScheduleBlock(toFormData({ event_id: eventId, block_id: m.block_id, label: text })));
  };
  const line = hasEnd ? spanLine(shown) : `${clockWords(shown.startMin)} · no end time yet`;
  const named = m.label ? ` · ${m.label}` : '';
  return (
    <TimelineRow
      data="moment"
      attrs={{ 'data-studio-moment': m.block_id, 'data-studio-moment-for': audience }}
      name={m.label}
      placeholder="Name this moment"
      nameLabel="Name of this moment"
      maxLength={120}
      canEdit={canEdit}
      editing={editing}
      onEdit={onEdit}
      onKeep={(text) => {
        onEndEdit();
        saveName(text);
      }}
      onLeave={onEndEdit}
      note={clash}
      when={
        <>
          <TickerPill
            data="start"
            text={clockWords(shown.startMin)}
            ariaLabel={`Starts ${clockWords(shown.startMin)}`}
            title={`Starts${named}`}
            disabled={!canEdit}
            sheet={sheet}
            onClosed={writeRolled}
            /* Every time in the list is one width, so the names start on one line. */
            widest={MOMENT_TIME_WIDEST}
            className="min-w-[72px]"
          >
            {(close) => (
              <TimeTicker
                minutes={shown.startMin}
                line={line}
                onDone={close}
                /* The start moved: the end moves with it. */
                onChange={(min) => setRolled({ span: moveStart(shown, min), end: rolled?.end === true })}
              />
            )}
          </TickerPill>
          <TimelineDash />
          <TickerPill
            data="end"
            text={hasEnd ? clockWords(shown.endMin) : 'End'}
            ariaLabel={hasEnd ? `Ends ${clockWords(shown.endMin)}` : 'Set when it ends'}
            title={`Ends${named}`}
            disabled={!canEdit}
            sheet={sheet}
            onClosed={writeRolled}
            widest={MOMENT_TIME_WIDEST}
            className={`min-w-[72px] ${hasEnd ? '' : '!text-ink/55'}`}
          >
            {(close) => (
              <TimeTicker
                minutes={shown.endMin % (24 * 60)}
                line={spanLine(shown)}
                /* Done on a moment with no end yet KEEPS the end the ticker shows. */
                onDone={() => {
                  setRolled({ span: shown, end: true });
                  close();
                }}
                /* An end at or before the start is the next day. */
                onChange={(min) => setRolled({ span: pickEnd(shown, min), end: true })}
              />
            )}
          </TickerPill>
        </>
      }
      trailing={
        canEdit ? (
          // BUTTON-RULE
          <button
            type="button"
            data-studio-moment-more={m.block_id}
            aria-label={`More for ${m.label} — place, who it is for, notes, guests, remove`}
            onClick={() => onMore(m.block_id)}
            /* ⋯ is a mark that says "you can tap this" — the accent, like the pencil and the arrow (owner 2026-10-08). */
            className="sn-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sn-accent hover:bg-ink/5"
          >
            <MoreHorizontal aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </button>
        ) : null
      }
    />
  );
}

/** Everything a moment's time pill can read at its widest: a two-digit hour, morning or afternoon — and "End", before one is set. */
export const MOMENT_TIME_WIDEST: readonly string[] = [...WIDEST_CLOCK_WORDS, 'End'];

/** The new moment before it is named: its times shown, its name open — on this screen only. */
function NewMomentRow({ span, onKeep, onLeave }: { span: TimeSpan; onKeep: (text: string) => void; onLeave: () => void }) {
  const pill = `${TICKER_PILL_CLASS} min-w-[72px]`;
  return (
    <TimelineRow
      data="new"
      attrs={{ 'data-studio-moment-new': '' }}
      name=""
      placeholder="Name this moment"
      nameLabel="Name of this moment"
      maxLength={120}
      editing
      onKeep={onKeep}
      onLeave={onLeave}
      when={
        <>
          <span className={pill}>{clockWords(span.startMin)}</span>
          <TimelineDash />
          <span className={pill}>{clockWords(span.endMin)}</span>
        </>
      }
    />
  );
}

export function StudioDay({ eventId, dateKey, moments, canEdit, onPatch, onAdd, onCreate = null, pendingIds, onMore, notice }: StudioDayProps) {
  /* ONE row's name is open at a time — a moment's id, the new row, or none. */
  const [editing, setEditing] = useState<string | null>(null);
  const [fresh, setFresh] = useState<TimeSpan | null>(null);
  /* The day's order: by start (a rehearsal the night before is its own date, ahead of the day). Minutes are counted
     from the FIRST date's midnight so "starts before the one above ends" is asked across the whole list. */
  const firstKey = moments.map((m) => wallDateKey(m.start_at)).filter(Boolean).sort()[0] ?? '';
  const absolute = (m: DayMoment): TimeSpan => {
    const s = spanOf(m.start_at, m.end_at);
    const off = (daysBetween(firstKey, wallDateKey(m.start_at)) ?? 0) * 24 * 60;
    return { startMin: off + s.startMin, endMin: off + s.endMin };
  };
  const ordered = byStart(moments, (m) => absolute(m).startMin);
  const clashes = overlapsAbove(ordered, absolute);
  /* "Saturday 12 December 2026" — the rail's own heading, with its year (the prototype's day line). */
  const heading = dateKey ? `${formatDateHeading(dateKey)} ${dateKey.slice(0, 4)}` : 'No date yet';

  const add = () => {
    /* No date yet, or a coordinator who may stage: the shipped sheet (it asks the date; it can stage). */
    if (!onCreate) return onAdd();
    setFresh(freshMomentSpan(moments, dateKey));
    setEditing(NEW_ROW);
  };
  const endFresh = (text: string | null) => {
    const span = fresh;
    setFresh(null);
    setEditing((cur) => (cur === NEW_ROW ? null : cur));
    /* Left unnamed: dropped — nothing was ever sent. */
    const toAdd = freshMomentToAdd(span, text);
    if (toAdd && onCreate) onCreate(toAdd);
  };

  return (
    <div data-studio-day="" className="-mx-4 flex min-h-full flex-col">
      <section data-studio-day-head="" className="border-b border-ink/10 bg-cream px-4 py-3">
        <InfoTip label={heading} labelClassName="font-serif text-[19px] text-ink" align="center">
          Set when you book your venue in Suppliers. A new date moves the whole day.
        </InfoTip>
      </section>
      {notice ? (
        <p role="alert" className="px-4 pt-2 text-[13px] text-terracotta-700">
          {notice}
        </p>
      ) : null}
      {ordered.length || fresh ? (
        <ol aria-label="The day, in order" className="mt-3 flex flex-col border-b border-t border-ink/10">
          {ordered.map((m, i) => {
            const clash = clashes.get(i);
            const landed = !pendingIds?.has(m.block_id);
            return (
              <MomentRow
                key={m.block_id}
                m={m}
                eventId={eventId}
                canEdit={canEdit && landed}
                editing={editing === m.block_id}
                onEdit={() => setEditing(m.block_id)}
                onEndEdit={() => setEditing((cur) => (cur === m.block_id ? null : cur))}
                onPatch={onPatch}
                onMore={onMore}
                clash={clash ? overlapLine(clash.above.label, spanOf(clash.above.start_at, clash.above.end_at).endMin) : null}
              />
            );
          })}
          {fresh ? <NewMomentRow span={fresh} onKeep={(text) => endFresh(text)} onLeave={() => endFresh(null)} /> : null}
        </ol>
      ) : (
        /* EMPTY (gallery § 16): what to do first, and the button to do it — the page's own main action. A viewer
           gets the words alone. Never drawn for a day that could not be READ: the page says that itself. */
        <TimelineEmpty
          title="No moments yet"
          action={canEdit ? <><Plus aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.2} />Add a moment</> : undefined}
          onAction={canEdit ? add : undefined}
          actionClassName={STUDIO_FOOT_BUTTON}
          actionAttrs={{ 'data-studio-add-moment': '' }}
        >
          {canEdit ? 'Add the first thing that happens on the day. You can add the rest later.' : 'Nothing has been added to the day yet.'}
        </TimelineEmpty>
      )}
      {/* The editor's own bottom (prototype `.ebot`): pinned to the foot of a phone's screen, room kept above it. */}
      {/* With no moments the first action is in the middle of the page — ONE Add button, not two. */}
      {canEdit && (ordered.length || fresh) ? <div aria-hidden className="h-20 shrink-0 lg:hidden" /> : null}
      {canEdit && (ordered.length || fresh) ? (
        <div className={`z-30 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:pb-[max(.5rem,env(safe-area-inset-bottom))] lg:sticky lg:bottom-0 lg:mt-4 sn-glass-row shrink-0 px-2.5 py-2`}>
          {/* BUTTON-RULE */}
          <button type="button" data-studio-add-moment="" onClick={add} className={STUDIO_FOOT_BUTTON}>
            <Plus aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.2} />
            Add a moment
          </button>
        </div>
      ) : null}
    </div>
  );
}
