'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarPlus, Clock, MessageSquarePlus, Plus, Trash2 } from 'lucide-react';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { ChosenRow, FormRows, TypedRow } from '@/app/_components/form-row';
import { TimeRow } from '@/app/_components/form-row-time';
import { InfoTip } from '@/app/_components/info-tip';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { useThumbRoom } from '@/lib/thumb-room';
import { chapterWhen, clockWords, wallTime, type ChapterSection } from '@/lib/schedule-chapters';
import {
  MOMENT_MINUTES_DEFAULT,
  crewFromText,
  waitingWords,
  whereItGoesWords,
  type SupplierChapter,
  type SupplierDay,
  type SupplierMoment,
  type SupplierRequestRow,
} from '@/lib/supplier-schedule';
import { suggestScheduleChange, type SupplierScheduleAnswer } from '../actions';

/**
 * 🤝 THE SUPPLIER'S SCHEDULE VIEW — their part of the day (owner 2026-11-01, DECISION_LOG "SUPPLIERS GIVE THEIR PART FROM
 * THEIR SCHEDULE VIEW"; corpus SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md §3, §3c; approved prototype
 * `prototypes/schedule_chapters_2026-11-01/` — its `supBody`, `supMomSheet`, `timesSheet`, `proposeSheet`).
 *
 * Owner, verbatim: *"so this is where suppliers can add their schedule and blow by blow as well? that is their part to
 * give to the event."*
 *
 * The 3 Oct forms that sat under every moment on the Customer card (Change or remove · Suggest a change · Suggest a new
 * timeline entry · Your requests) MOVED here — one view, three tools in the thumb row:
 *   · + My moment — chapter · what · time · minutes · section · who on our side · notes, into the chapters they are
 *     linked to only. Tapping one of THEIR moments opens the same sheet to ask for an edit, or to delete it.
 *   · My times — arrive and done per linked chapter.
 *   · Suggest — somebody else's moment, in words only.
 * Everybody else's moments stay greyed and read-only. Every ask waits for the host or coordinator ("Waiting for the
 * host" · Take back) unless the host chose Auto-agree (ruled 1 Nov: Off by default) — the database holds the own-items
 * and linked-chapter rules (migration 20271300619930), so this screen says what is true, it is not the rule.
 * `Seen` on a change, and a final-week `Confirm my times`.
 *
 * `lab` draws the same view with doors that write nothing (`/dev/supplier-lab?s=schedule`).
 */

type Fields = Record<string, string | string[]>;
type Send = (fields: Fields) => Promise<SupplierScheduleAnswer>;

function realSend(eventId: string): Send {
  return (fields) => {
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('quiet', '1');
    for (const [k, v] of Object.entries(fields)) {
      if (Array.isArray(v)) for (const one of v) fd.append(k, one);
      else fd.set(k, v);
    }
    return suggestScheduleChange(fd).then(
      (r) => r ?? { ok: false as const, error: 'That didn’t send — try again.' },
      () => ({ ok: false as const, error: 'That didn’t send — try again.' }),
    );
  };
}

const labSend: Send = () => new Promise((r) => setTimeout(() => r({ ok: true, outcome: 'waits' }), 250));

type Marks = { seenAt: string | null; confirmedAt: string | null } | null;

export function SupplierSchedule({
  eventId,
  day,
  autoAgree,
  marks,
  changed,
  finalWeek,
  tasksRead,
  answered,
  lab = false,
}: {
  eventId: string;
  /** null = the schedule could not be read — said, never drawn as an empty day. */
  day: SupplierDay | null;
  autoAgree: boolean;
  /** null = whether they have seen the latest could not be read. */
  marks: Marks;
  changed: boolean;
  finalWeek: boolean;
  /** false = the moments' crews could not be read, so "no crew" is not a fact. */
  tasksRead: boolean;
  /** Their latest answered requests (accepted · declined · taken back). */
  answered: SupplierRequestRow[];
  lab?: boolean;
}) {
  const send = useMemo(() => (lab ? labSend : realSend(eventId)), [lab, eventId]);
  const linked = useMemo(() => (day ? day.chapters.filter((c) => c.linked) : []), [day]);
  const [view, setView] = useState<'mine' | 'all'>(linked.length > 0 ? 'mine' : 'all');
  const [sheet, setSheet] = useState<
    | { kind: 'moment'; chapter: SupplierChapter; moment: SupplierMoment | null }
    | { kind: 'times' }
    | { kind: 'suggest' }
    | null
  >(null);
  const [said, setSaid] = useState<{ tone: 'ok' | 'bad'; words: string } | null>(null);
  const [marking, setMarking] = useState<'seen' | 'confirm' | null>(null);
  const [seenNow, setSeenNow] = useState(false);
  const [confirmedNow, setConfirmedNow] = useState(false);
  const [takingBack, setTakingBack] = useState<string | null>(null);

  const after = (r: SupplierScheduleAnswer, okWords: string) => {
    if (r.ok) setSaid({ tone: 'ok', words: r.outcome === 'applied' ? 'Saved. It’s on the schedule.' : okWords });
    else setSaid({ tone: 'bad', words: r.error });
    return r.ok;
  };

  if (!day) {
    return (
      <p role="alert" data-supplier-schedule="unread" className="text-sm font-semibold text-danger-700">
        The schedule couldn’t be read just now. Nothing is lost — pull to refresh.
      </p>
    );
  }

  const shown = view === 'mine' ? linked : day.chapters;
  const others = day.chapters.flatMap((c) =>
    c.moments.filter((m) => !m.mine).map((m) => ({ key: m.block_id, label: `${c.label} · ${m.label}${m.start_at ? ` · ${clockWords(m.start_at)}` : ''}` })),
  );
  const confirmed = confirmedNow || Boolean(marks?.confirmedAt);

  const mark = async (what: 'seen' | 'confirm') => {
    setMarking(what);
    const r = await send({ request: what });
    setMarking(null);
    if (r.ok) {
      if (what === 'seen') setSeenNow(true);
      else {
        setConfirmedNow(true);
        setSeenNow(true);
        setSaid({ tone: 'ok', words: 'Confirmed. The host sees your times are final.' });
      }
    } else setSaid({ tone: 'bad', words: r.error });
  };

  const takeBack = async (id: string) => {
    setTakingBack(id);
    const r = await send({ request: 'take_back', suggestion_id: id });
    setTakingBack(null);
    after(r, 'Taken back.');
  };

  return (
    <div data-supplier-schedule="" className="space-y-4">
      {/* Seen · Confirm my times — the two things that ask the supplier to act, first. */}
      {marks === null ? (
        <p className="text-xs text-ink/55">Whether you’ve seen the latest changes couldn’t be checked.</p>
      ) : changed && !seenNow ? (
        <div data-schedule-changed="" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warn-50 px-3 py-2 text-sm text-warn-900">
          <span>The schedule changed since you last looked.</span>
          <ActionButton tone="neutral" label={marking === 'seen' ? 'Saving…' : 'Seen'} disabled={marking !== null} onClick={() => void mark('seen')} data-testid="schedule-seen" />
        </div>
      ) : null}
      {finalWeek && marks !== null && !confirmed ? (
        <div data-confirm-times="" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-terracotta/10 px-3 py-2 text-sm">
          <span>One week to go. Check your times, then confirm them.</span>
          <ActionButton tone="brand" main label={marking === 'confirm' ? 'Confirming…' : 'Confirm my times'} disabled={marking !== null} onClick={() => void mark('confirm')} data-testid="confirm-times" />
        </div>
      ) : confirmed ? (
        <p data-times-confirmed="" className="text-xs text-success-900">✓ You confirmed your times.</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <PickMenu
          label="Show"
          value={view}
          options={[
            { key: 'mine', label: `My chapters (${linked.length})` },
            { key: 'all', label: 'The whole day' },
          ]}
          onPick={(k) => setView(k === 'all' ? 'all' : 'mine')}
          dataAttr="supplier-schedule-view"
        />
        <InfoTip
          label={autoAgree ? 'Auto-agree is on' : 'Your changes wait for the host'}
          labelClassName="text-xs text-ink/60"
          align="end"
        >
          {whereItGoesWords(autoAgree)} Other people’s moments are theirs: you can suggest a change to one in words.
        </InfoTip>
      </div>

      {said ? (
        <p role={said.tone === 'bad' ? 'alert' : 'status'} className={`text-sm ${said.tone === 'bad' ? 'font-semibold text-danger-700' : 'text-success-900'}`}>
          {said.words}
        </p>
      ) : null}

      {day.chapters.length === 0 ? (
        <p className="text-sm text-ink/60">The hosts haven’t made their chapters yet. Your part shows here once they do.</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-ink/60">
          The host hasn’t linked you to a chapter yet. Once they do, you can add your moments and times there.
        </p>
      ) : (
        <ol className="space-y-5">
          {shown.map((c) => (
            <li key={c.block_id} data-supplier-chapter={c.block_id} className={c.linked ? '' : 'opacity-60'}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h3 className="text-base font-semibold">{c.label}</h3>
                <span className="text-xs text-ink/60">
                  {chapterWhen(c)} · {c.where}
                </span>
              </div>
              <ul className="mt-1 divide-y divide-ink/10">
                {c.moments.length === 0 && c.waitingAdds.length === 0 ? (
                  <li className="py-2 text-xs text-ink/55">No moments yet.</li>
                ) : null}
                {c.moments.map((m) => (
                  <li key={m.block_id}>
                    {m.mine ? (
                      <button
                        type="button"
                        data-my-moment={m.block_id}
                        onClick={() => setSheet({ kind: 'moment', chapter: c, moment: m })}
                        className="sn-press my-1 flex min-h-11 w-full items-start gap-3 rounded-xl border border-ink/15 px-3 py-2 text-left"
                      >
                        <MomentLine m={m} tasksRead={tasksRead} />
                      </button>
                    ) : (
                      <div data-their-moment={m.block_id} aria-disabled="true" className="flex min-h-11 items-start gap-3 px-3 py-2 opacity-55">
                        <MomentLine m={m} tasksRead={tasksRead} />
                      </div>
                    )}
                  </li>
                ))}
                {c.waitingAdds.map((r) => (
                  <WaitingRow key={r.suggestion_id} r={r} label={null} busy={takingBack === r.suggestion_id} onTakeBack={() => void takeBack(r.suggestion_id)} />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {day.otherWaiting.length > 0 ? (
        <section aria-label="Also waiting for the host">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">Also waiting</h3>
          <ul className="mt-1 divide-y divide-ink/10">
            {day.otherWaiting.map((r) => (
              <WaitingRow
                key={r.suggestion_id}
                r={r}
                label={labelOf(day, r.block_id)}
                busy={takingBack === r.suggestion_id}
                onTakeBack={() => void takeBack(r.suggestion_id)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {answered.length > 0 ? (
        <section aria-label="Your answered requests">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">Answered</h3>
          <ul className="mt-1 space-y-1">
            {answered.map((r) => (
              <li key={r.suggestion_id} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <span className={r.status === 'accepted' ? 'font-semibold text-success-900' : 'text-ink/55'}>
                  {r.status === 'accepted' ? 'Approved' : r.status === 'withdrawn' ? 'Taken back' : 'Not approved'}
                </span>
                <span className="text-ink/70">{waitingWords(r, labelOf(day, r.block_id))}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <SupplierThumbRow
        canAdd={linked.length > 0}
        canSuggest={others.length > 0}
        onSuggest={() => setSheet({ kind: 'suggest' })}
        onTimes={() => setSheet({ kind: 'times' })}
        onAdd={() => linked[0] && setSheet({ kind: 'moment', chapter: linked[0], moment: null })}
      />

      {sheet?.kind === 'moment' ? (
        <MyMomentSheet
          chapters={linked}
          chapter={sheet.chapter}
          moment={sheet.moment}
          autoAgree={autoAgree}
          tasksRead={tasksRead}
          send={send}
          onClose={() => setSheet(null)}
          onSent={(r) => after(r, 'Sent. The host or coordinator approves it.') && setSheet(null)}
        />
      ) : null}
      {sheet?.kind === 'times' ? (
        <MyTimesSheet
          chapters={linked}
          autoAgree={autoAgree}
          send={send}
          onClose={() => setSheet(null)}
          onSent={(r) => after(r, 'Sent. The host or coordinator approves your times.') && setSheet(null)}
        />
      ) : null}
      {sheet?.kind === 'suggest' ? (
        <SuggestSheet
          options={others}
          send={send}
          onClose={() => setSheet(null)}
          onSent={(r) => after(r, 'Sent. The host decides.') && setSheet(null)}
        />
      ) : null}
    </div>
  );
}

function labelOf(day: SupplierDay, blockId: string | null): string | null {
  if (!blockId) return null;
  for (const c of day.chapters) {
    if (c.block_id === blockId) return c.label;
    const m = c.moments.find((x) => x.block_id === blockId);
    if (m) return m.label;
  }
  return null;
}

function MomentLine({ m, tasksRead }: { m: SupplierMoment; tasksRead: boolean }) {
  return (
    <>
      <span className="w-16 flex-none pt-0.5 text-[13px] tabular-nums text-ink/70">{m.start_at ? clockWords(m.start_at) : '—'}</span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="font-medium">{m.label}</span>
        {m.mine ? <span className="ml-1.5 text-xs font-semibold text-terracotta-700">yours</span> : null}
        {m.optional ? <span className="ml-1.5 text-xs text-ink/55">if kept</span> : null}
        {m.mine && m.crew.length > 0 ? <span className="block text-xs text-ink/60">{m.crew.join(', ')}</span> : null}
        {m.mine && !tasksRead ? <span className="block text-xs text-ink/50">Your crew on it couldn’t be read.</span> : null}
        {m.waiting ? <span className="block text-xs text-warn-900">{waitingWords(m.waiting, m.label)} · Waiting for the host</span> : null}
      </span>
    </>
  );
}

function WaitingRow({ r, label, busy, onTakeBack }: { r: SupplierRequestRow; label: string | null; busy: boolean; onTakeBack: () => void }) {
  return (
    <li data-waiting={r.suggestion_id} className="flex min-h-11 items-center gap-3 px-3 py-2">
      <span className="w-16 flex-none text-[13px] tabular-nums text-ink/60">{r.proposed_start_at ? clockWords(r.proposed_start_at) : ''}</span>
      <span className="min-w-0 flex-1 text-sm">
        {waitingWords(r, label)}
        <span className="block text-xs text-warn-900">Waiting for the host</span>
      </span>
      <ActionButton tone="neutral" label={busy ? 'Taking back…' : 'Take back'} disabled={busy} onClick={onTakeBack} data-testid="take-back" />
    </li>
  );
}

/** The view's thumb row — Suggest · My times · + My moment, in the thumb zone above the bottom nav (prototype `thumb()`). */
function SupplierThumbRow({
  canAdd,
  canSuggest,
  onSuggest,
  onTimes,
  onAdd,
}: {
  canAdd: boolean;
  canSuggest: boolean;
  onSuggest: () => void;
  onTimes: () => void;
  onAdd: () => void;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  const rowRef = useRef<HTMLDivElement>(null);
  useThumbRoom(rowRef);
  if (!host) return null;
  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--sn-ride-h,var(--sn-bottomdock-h,64px))_+_12px)] z-30 flex justify-end tab:bottom-6 tab:left-auto tab:right-6"
      data-supplier-schedule-thumb=""
      data-safe-x=""
    >
      <div ref={rowRef} className="pointer-events-auto mx-4 flex flex-wrap justify-end gap-2">
        {canSuggest ? (
          <button type="button" onClick={onSuggest} data-supplier-suggest="" className={actionButtonClass('neutral')}>
            <MessageSquarePlus aria-hidden strokeWidth={2} />
            Suggest
          </button>
        ) : null}
        {canAdd ? (
          <>
            <button type="button" onClick={onTimes} data-supplier-times="" className={actionButtonClass('neutral')}>
              <Clock aria-hidden strokeWidth={2} />
              My times
            </button>
            <button type="button" onClick={onAdd} data-supplier-add="" className={actionButtonClass('brand', { main: true })}>
              <Plus aria-hidden strokeWidth={2} />
              My moment
            </button>
          </>
        ) : null}
      </div>
    </div>,
    host,
  );
}

/* ── + My moment / My moment ─────────────────────────────────────────────────────────────────────────────────── */

const SECTIONS: ChapterSection[] = ['Ingress', 'Event', 'Egress'];

function MyMomentSheet({
  chapters,
  chapter: chapter0,
  moment,
  autoAgree,
  tasksRead,
  send,
  onClose,
  onSent,
}: {
  chapters: SupplierChapter[];
  chapter: SupplierChapter;
  moment: SupplierMoment | null;
  autoAgree: boolean;
  tasksRead: boolean;
  send: Send;
  onClose: () => void;
  onSent: (r: SupplierScheduleAnswer) => void;
}) {
  const headingId = useId();
  const [chapterId, setChapterId] = useState(chapter0.block_id);
  const chapter = chapters.find((c) => c.block_id === chapterId) ?? chapter0;
  const [label, setLabel] = useState(moment?.label ?? '');
  const [time, setTime] = useState(wallTime(moment?.start_at ?? chapter.start_at) || '');
  const [minutes, setMinutes] = useState(String(moment?.minutes ?? MOMENT_MINUTES_DEFAULT));
  const [section, setSection] = useState<ChapterSection>(moment?.section ?? 'Event');
  const [crew, setCrew] = useState((moment?.crew ?? []).join(', '));
  const [note, setNote] = useState('');
  const [stage, setStage] = useState<'details' | 'ask-delete' | 'sending'>('details');
  const [problem, setProblem] = useState<string | null>(null);

  const go = async (fields: Fields) => {
    setStage('sending');
    setProblem(null);
    const r = await send(fields);
    if (!r.ok) {
      setStage('details');
      setProblem(r.error);
      return;
    }
    onSent(r);
  };

  const submit = () => {
    if (!label.trim()) return setProblem('Say what happens first.');
    if (!moment) {
      return void go({
        chapter_id: chapter.block_id,
        proposed_label: label.trim(),
        time,
        minutes,
        section,
        crew,
        note: note.trim(),
      });
    }
    const fields: Fields = { block_id: moment.block_id, chapter_of_block: chapter.block_id, note: note.trim() };
    if (label.trim() !== moment.label) fields.proposed_label = label.trim();
    const timeChanged = time !== wallTime(moment.start_at) || minutes !== String(moment.minutes ?? MOMENT_MINUTES_DEFAULT);
    if (timeChanged) Object.assign(fields, { time, minutes, section });
    const crewNow = crewFromText(crew).join(', ');
    if (crewNow && crewNow !== moment.crew.join(', ')) fields.crew = crewNow;
    if (!fields.proposed_label && !timeChanged && fields.crew === undefined && !note.trim()) {
      return setProblem('Change something first, or say what should change in Notes.');
    }
    void go(fields);
  };

  return (
    <Sheet open onClose={onClose} labelledById={headingId} title={moment ? 'My moment' : 'New moment'}>
      <div data-supplier-moment-sheet={moment?.block_id ?? 'new'} className="flex flex-col gap-3 px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2">
        <h3 id={headingId} className="sr-only">
          {moment ? moment.label : `New moment in ${chapter.label}`}
        </h3>
        <p className="text-[13px] text-ink/60">{whereItGoesWords(autoAgree)}</p>
        {stage === 'ask-delete' ? (
          <>
            <p className="text-sm">
              Ask to delete “{moment?.label}”? {autoAgree ? 'It comes off the schedule at once.' : 'The host or coordinator approves it.'}
            </p>
            <div className="flex justify-end gap-2">
              <ActionButton tone="neutral" label="Keep it" onClick={() => setStage('details')} />
              <ActionButton
                tone="danger"
                main
                icon={Trash2}
                label="Continue"
                data-testid="supplier-moment-delete-go"
                onClick={() => moment && void go({ block_id: moment.block_id, request: 'remove', note: note.trim() })}
              />
            </div>
          </>
        ) : (
          <>
            <FormRows width="wide">
              {moment ? (
                <ChosenRow name="Chapter" value={chapter.block_id} options={[{ key: chapter.block_id, label: chapter.label }]} onPick={() => {}} data="supplier-moment-chapter" />
              ) : (
                <ChosenRow
                  name="Chapter"
                  value={chapterId}
                  options={chapters.map((c) => ({ key: c.block_id, label: c.label }))}
                  onPick={(k) => setChapterId(k)}
                  data="supplier-moment-chapter"
                />
              )}
              <TypedRow
                name="What"
                value={label}
                empty="Bride prep coverage"
                maxLength={120}
                required
                onKeep={(t) => {
                  setLabel(t.trim());
                  return { ok: true };
                }}
                data="supplier-moment-what"
              />
              <TimeRow
                name="Time"
                value={time}
                onKeep={(t) => {
                  setTime(t);
                  return { ok: true };
                }}
                data="supplier-moment-time"
              />
              <TypedRow
                name="Minutes"
                value={minutes}
                maxLength={3}
                inputMode="numeric"
                required
                check={(t) => (/^\d{1,3}$/.test(t.trim()) && Number(t) >= 5 && Number(t) <= 720 ? null : 'Between 5 and 720 minutes.')}
                onKeep={(t) => {
                  setMinutes(t.trim());
                  return { ok: true };
                }}
                data="supplier-moment-minutes"
              />
              <ChosenRow
                name="Section"
                value={section}
                options={SECTIONS.map((s) => ({ key: s, label: s }))}
                onPick={(k) => setSection(k as ChapterSection)}
                data="supplier-moment-section"
              />
              <TypedRow
                name="Who on our side"
                about={{ words: 'Your crew on this moment, separated by commas — “Team A, Second shooter”. Blank = your whole team.' }}
                value={crew}
                empty="Everyone"
                maxLength={400}
                onKeep={(t) => {
                  setCrew(crewFromText(t).join(', '));
                  return { ok: true };
                }}
                note={moment && !tasksRead ? 'Your crew on it couldn’t be read — what you type here replaces it.' : undefined}
                data="supplier-moment-crew"
              />
              <TypedRow
                name="Notes"
                value={note}
                empty="Anything the host should know"
                long
                maxLength={1000}
                onKeep={(t) => {
                  setNote(t.trim());
                  return { ok: true };
                }}
                data="supplier-moment-notes"
              />
            </FormRows>
            {problem ? (
              <p role="alert" className="text-[13px] font-semibold text-danger-700">
                {problem}
              </p>
            ) : null}
            <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 bg-cream px-4 pt-2">
              {moment ? (
                <ActionButton tone="danger" icon={Trash2} label="Delete moment" onClick={() => setStage('ask-delete')} data-testid="supplier-moment-delete" />
              ) : null}
              <ActionButton
                tone="brand"
                main
                icon={CalendarPlus}
                label={stage === 'sending' ? 'Sending…' : autoAgree ? 'Save' : 'Send'}
                disabled={stage === 'sending'}
                onClick={submit}
                data-testid="supplier-moment-send"
              />
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

/* ── My times ────────────────────────────────────────────────────────────────────────────────────────────────── */

function MyTimesSheet({
  chapters,
  autoAgree,
  send,
  onClose,
  onSent,
}: {
  chapters: SupplierChapter[];
  autoAgree: boolean;
  send: Send;
  onClose: () => void;
  onSent: (r: SupplierScheduleAnswer) => void;
}) {
  const headingId = useId();
  const [times, setTimes] = useState<Record<string, { arrive: string; done: string }>>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const put = (id: string, k: 'arrive' | 'done', v: string) =>
    setTimes((t) => ({ ...t, [id]: { arrive: t[id]?.arrive ?? '', done: t[id]?.done ?? '', [k]: v } }));

  return (
    <Sheet open onClose={onClose} labelledById={headingId} title="My times">
      <div data-supplier-times-sheet="" className="flex flex-col gap-3 px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2">
        <h3 id={headingId} className="sr-only">
          My times
        </h3>
        <p className="text-[13px] text-ink/60">{whereItGoesWords(autoAgree)}</p>
        {chapters.map((c) => (
          <div key={c.block_id} data-times-chapter={c.block_id}>
            <p className="text-sm font-semibold">
              {c.label} <span className="font-normal text-ink/60">· {c.where}</span>
            </p>
            <FormRows width="short">
              <TimeRow name="Arrive" value={times[c.block_id]?.arrive ?? ''} clearable onKeep={(t) => (put(c.block_id, 'arrive', t), { ok: true })} data="times-arrive" />
              <TimeRow name="Done" value={times[c.block_id]?.done ?? ''} clearable onKeep={(t) => (put(c.block_id, 'done', t), { ok: true })} data="times-done" />
            </FormRows>
          </div>
        ))}
        {problem ? (
          <p role="alert" className="text-[13px] font-semibold text-danger-700">
            {problem}
          </p>
        ) : null}
        <div className="sticky bottom-0 -mx-4 flex justify-end bg-cream px-4 pt-2">
          <ActionButton
            tone="brand"
            main
            icon={Clock}
            label={busy ? 'Sending…' : autoAgree ? 'Save' : 'Send'}
            disabled={busy}
            data-testid="supplier-times-send"
            onClick={async () => {
              const ids = Object.keys(times).filter((id) => times[id]!.arrive || times[id]!.done);
              if (ids.length === 0) return setProblem('Add an arrive or a done time first.');
              setBusy(true);
              setProblem(null);
              const fields: Fields = { request: 'times', chapter_id: ids };
              for (const id of ids) {
                fields[`arrive_${id}`] = times[id]!.arrive;
                fields[`done_${id}`] = times[id]!.done;
              }
              const r = await send(fields);
              setBusy(false);
              if (!r.ok) return setProblem(r.error);
              onSent(r);
            }}
          />
        </div>
      </div>
    </Sheet>
  );
}

/* ── Suggest (someone else's moment, in words) ───────────────────────────────────────────────────────────────── */

function SuggestSheet({
  options,
  send,
  onClose,
  onSent,
}: {
  options: { key: string; label: string }[];
  send: Send;
  onClose: () => void;
  onSent: (r: SupplierScheduleAnswer) => void;
}) {
  const headingId = useId();
  const [blockId, setBlockId] = useState(options[0]?.key ?? '');
  const [words, setWords] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <Sheet open onClose={onClose} labelledById={headingId} title="Suggest a change">
      <div data-supplier-suggest-sheet="" className="flex flex-col gap-3 px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2">
        <h3 id={headingId} className="sr-only">
          Suggest a change
        </h3>
        <p className="text-[13px] text-ink/60">It’s someone else’s moment, so you ask in words. The host decides.</p>
        <FormRows width="wide">
          <ChosenRow name="Moment" value={blockId} options={options} onPick={setBlockId} data="suggest-moment" />
          <TypedRow
            name="What should change"
            value={words}
            empty="Could the first dance wait 5 minutes?"
            long
            required
            maxLength={1000}
            onKeep={(t) => {
              setWords(t.trim());
              return { ok: true };
            }}
            data="suggest-words"
          />
        </FormRows>
        {problem ? (
          <p role="alert" className="text-[13px] font-semibold text-danger-700">
            {problem}
          </p>
        ) : null}
        <div className="sticky bottom-0 -mx-4 flex justify-end bg-cream px-4 pt-2">
          <ActionButton
            tone="brand"
            main
            icon={MessageSquarePlus}
            label={busy ? 'Sending…' : 'Send'}
            disabled={busy}
            data-testid="supplier-suggest-send"
            onClick={async () => {
              if (!blockId || !words.trim()) return setProblem('Pick a moment and say what should change.');
              setBusy(true);
              setProblem(null);
              const r = await send({ block_id: blockId, note: words.trim() });
              setBusy(false);
              if (!r.ok) return setProblem(r.error);
              onSent(r);
            }}
          />
        </div>
      </div>
    </Sheet>
  );
}
