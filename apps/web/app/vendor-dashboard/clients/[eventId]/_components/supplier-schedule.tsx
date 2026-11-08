'use client';

import { useId, useMemo, useState } from 'react';
import { ArrowLeft, CalendarPlus, Check, Clock, Eye, Lock, LockOpen, MapPin, MessageSquarePlus, Plus, Trash2, Undo2, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { SupplierThumbRow } from '@/app/vendor-dashboard/_components/supplier-thumb-row';
import { Sheet } from '@/app/_components/sheet';
import { ChosenRow, FormRows, TypedRow } from '@/app/_components/form-row';
import { TimeRow } from '@/app/_components/form-row-time';
import { InfoTip } from '@/app/_components/info-tip';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { BACKSTAGE_WORDS, chapterWhen, clockWords, egressMinutesFrom, endIsoFrom, ingressMinutesFrom, shiftWall, wallDay, wallIso, wallTime, type ChapterSection } from '@/lib/schedule-chapters';
import { contactLine } from '@/lib/task-contact';
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
import { askerWords, type ScheduleAsk } from '@/lib/schedule-ask';
import { markDay } from '@/lib/supplier-schedule-marks';
import { SUPPLIER_WHERE_WORDS, whereAskVerdict, type SupplierOwnWhere, type WhereOption } from '@/lib/supplier-where';
import type { CrewClash } from '@/lib/crew-elsewhere';
import { formatCount } from '@/lib/format-number';

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
 * 📍 `Where` (owner 2026-11-04, *"They can pick and we can also pick for them"*): the chapters they serve — one
 * dropdown of the event's chapters, sent as ONE request the host OKs (Auto-agree applies it), Take back while it
 * waits (migration 20271308641275). The host can still set it directly, unless their times are locked.
 * 🔒 `Lock my times` (audit D7, owner: *"change lock (means the supplier cannot accept changes anymore)"*): while
 * locked, the database refuses the host's changes to their moments and crew (20271303409352); their own asks still go.
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

type Marks = { seenAt: string | null; confirmedAt: string | null; lockedAt?: string | null } | null;

export function SupplierSchedule({
  eventId,
  day,
  autoAgree,
  marks,
  changed,
  finalWeek,
  tasksRead,
  answered,
  asked = [],
  where = [],
  elsewhere = {},
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
  /** 🗓 What a host or the coordinator asked of THEM, still open (D2); null = could not be read (said). */
  asked?: ScheduleAsk[] | null;
  /** 📍 Their own Where, one row per booked booking (never a coordinator); null = could not be read (said). */
  where?: SupplierOwnWhere[] | null;
  /** 🚗 Their crews on their OTHER events today, keyed by the moment here (slice 5); null = could not be checked (said). */
  elsewhere?: Record<string, CrewClash[]> | null;
  lab?: boolean;
}) {
  const send = useMemo(() => (lab ? labSend : realSend(eventId)), [lab, eventId]);
  const linked = useMemo(() => (day ? day.chapters.filter((c) => c.linked) : []), [day]);
  const [view, setView] = useState<'mine' | 'all'>(linked.length > 0 ? 'mine' : 'all');
  const [sheet, setSheet] = useState<
    | { kind: 'moment'; chapter: SupplierChapter; moment: SupplierMoment | null }
    | { kind: 'times' }
    | { kind: 'suggest' }
    | { kind: 'hours'; chapter: SupplierChapter }
    | null
  >(null);
  const [said, setSaid] = useState<{ tone: 'ok' | 'bad'; words: string } | null>(null);
  const [marking, setMarking] = useState<'seen' | 'confirm' | 'lock' | 'unlock' | null>(null);
  const [seenNow, setSeenNow] = useState(false);
  const [confirmedNow, setConfirmedNow] = useState(false);
  // 🔒 The lock as THIS screen last set it (undefined = as the page read it) — a save never resets the screen.
  const [lockedNow, setLockedNow] = useState<string | null | undefined>(undefined);
  const [takingBack, setTakingBack] = useState<string | null>(null);
  const [answeredNow, setAnsweredNow] = useState<string[]>([]);

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
    c.moments.filter((m) => !m.mine).map((m) => ({ key: m.block_id, label: `${c.label} · ${m.label}${m.start_at ? ` · ${m.clock}` : ''}` })),
  );
  const confirmed = confirmedNow || Boolean(marks?.confirmedAt);
  const lockedAt = lockedNow === undefined ? (marks?.lockedAt ?? null) : lockedNow;

  const mark = async (what: 'seen' | 'confirm' | 'lock' | 'unlock') => {
    setMarking(what);
    const r = await send({ request: what });
    setMarking(null);
    if (r.ok) {
      if (what === 'seen') setSeenNow(true);
      else if (what === 'lock') {
        setLockedNow(new Date().toISOString());
        setSaid({ tone: 'ok', words: 'Locked. The hosts must ask you before changing your part.' });
      } else if (what === 'unlock') {
        setLockedNow(null);
        setSaid({ tone: 'ok', words: 'Unlocked. The hosts can change your part again.' });
      } else {
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
      {/* 🗓 v113 ORDER (B1 step 8, controller 2026-11-08): what needs you now · how changes go · Where · your hours
          (the chapters) · Lock my times · Asked of you. A move, not a rewrite — every block is the shipped one. */}
      {/* Seen · Confirm my times — the two things that ask the supplier to act, first. */}
      {marks === null ? (
        <p className="text-xs text-ink/55">Whether you’ve seen the latest changes couldn’t be checked.</p>
      ) : changed && !seenNow ? (
        <div data-schedule-changed="" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warn-50 px-3 py-2 text-sm text-warn-900">
          <span>The schedule changed since you last looked.</span>
          <ActionButton tone="neutral" icon={Eye} label={marking === 'seen' ? 'Saving…' : 'Seen'} disabled={marking !== null} onClick={() => void mark('seen')} data-testid="schedule-seen" />
        </div>
      ) : null}
      {finalWeek && marks !== null && !confirmed ? (
        <div data-confirm-times="" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-terracotta/10 px-3 py-2 text-sm">
          <span>One week to go. Check your times, then confirm them.</span>
          <ActionButton tone="brand" main icon={Check} label={marking === 'confirm' ? 'Confirming…' : 'Confirm my times'} disabled={marking !== null} onClick={() => void mark('confirm')} data-testid="confirm-times" />
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

      {/* 📍 WHERE — the chapters they serve: one dropdown, sent as a request; the details sit in the ⓘ. */}
      {where === null ? (
        <p role="alert" data-supplier-where="unread" className="text-sm font-semibold text-danger-700">
          Your chapters couldn’t be read just now. Nothing is lost — pull to refresh.
        </p>
      ) : where.length > 0 && day.chapters.length > 0 ? (
        <section data-supplier-where="" aria-label="Where you go">
          <FormRows width="wide">
            {where.map((w) => (
              <SupplierWhereRow key={w.vendorId} w={w} send={send} autoAgree={autoAgree} locked={Boolean(lockedAt)} onSaid={setSaid} />
            ))}
          </FormRows>
        </section>
      ) : null}

      {/* 🚗 ONE CREW, TWO EVENTS (slice 5): said once here, and on each moment it touches. Only the supplier sees it. */}
      {elsewhere === null ? (
        <p data-crew-elsewhere="unread" className="text-sm text-warn-900">
          Your other events today couldn’t be checked for crew clashes.
        </p>
      ) : clashCount(elsewhere) > 0 ? (
        <p role="status" data-crew-elsewhere={clashCount(elsewhere)} className="text-sm font-semibold text-warn-900">
          {clashCount(elsewhere) === 1
            ? 'A crew of yours is also needed at another event today. See the moment marked below.'
            : `Your crews are also needed at other events today on ${formatCount(clashCount(elsewhere))} moments. See the moments marked below.`}
        </p>
      ) : null}

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
                  {chapterWhen({ start_at: c.start_at ?? '', end_at: c.end_at, time_tba: c.time_tba })} · {c.where}
                </span>
              </div>
              {/* 🏛 VENUE HOURS (2026-11-04): the venue booked to a chapter sets its hours; once approved, they are held. */}
              {c.setsHours ? (
                <div data-venue-hours={c.block_id} className="mt-1 flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 pb-2">
                  <span className="min-w-0 text-[13px] text-ink/70">
                    {c.hoursWaiting
                      ? `Your hours are waiting for the host · ${venueHoursLine(c.hoursWaiting.proposed_start_at, c.hoursWaiting.proposed_end_at, c.hoursWaiting.proposed_ingress_minutes ?? null, c.hoursWaiting.proposed_egress_minutes ?? null)}`
                      : c.holdsHours
                        ? `🔒 Your hours · ${venueHoursLine(c.start_at, c.end_at, c.ingress_minutes_before, c.egress_minutes_after)}`
                        : 'You’re the venue: set this chapter’s hours.'}
                  </span>
                  {c.hoursWaiting ? null : (
                    <ActionButton
                      tone="neutral"
                      icon={Clock}
                      label={c.holdsHours ? 'Change hours' : 'Set hours'}
                      data-testid="venue-hours-open"
                      onClick={() => setSheet({ kind: 'hours', chapter: c })}
                    />
                  )}
                </div>
              ) : null}
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
                        <MomentLine m={m} tasksRead={tasksRead} clashes={elsewhere?.[m.block_id] ?? []} />
                      </button>
                    ) : (
                      <div data-their-moment={m.block_id} aria-disabled="true" className="flex min-h-11 items-start gap-3 px-3 py-2 opacity-55">
                        <MomentLine m={m} tasksRead={tasksRead} clashes={elsewhere?.[m.block_id] ?? []} />
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

      {/* 🔒 CHANGE LOCK — one line under your times (v113): what is true now, the one verb, the rest in the ⓘ. */}
      {marks !== null ? (
        <div data-times-lock={lockedAt ? 'locked' : 'open'} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <InfoTip
            label={lockedAt ? `Your times are locked${markDay(lockedAt) ? ` · ${markDay(lockedAt)}` : ''}` : 'Your times are open to changes'}
            labelClassName={lockedAt ? 'font-semibold text-ink' : 'text-ink/70'}
          >
            {lockedAt
              ? 'The hosts and the coordinator can’t change your moments or your crew while this is on. They send you a request instead. Your own requests still go to them. Unlock any time.'
              : 'Lock your times when your part is final. After that, the hosts and the coordinator can’t change your moments or your crew — they send you a request instead. You can unlock any time.'}
          </InfoTip>
          {lockedAt ? (
            <ActionButton tone="neutral" icon={LockOpen} label={marking === 'unlock' ? 'Unlocking…' : 'Unlock'} disabled={marking !== null} onClick={() => void mark('unlock')} data-testid="unlock-times" />
          ) : (
            <ActionButton tone="neutral" icon={Lock} label={marking === 'lock' ? 'Locking…' : 'Lock my times'} disabled={marking !== null} onClick={() => void mark('lock')} data-testid="lock-times" />
          )}
        </div>
      ) : null}

      {/* 🗓 Asked of you (D2) — a host's or the coordinator's ask, answered in place (v113: after your times and the lock). */}
      {asked === null ? (
        <p role="alert" data-asked-of-you="unread" className="text-sm font-semibold text-danger-700">
          What the hosts asked of you couldn’t be read just now. Nothing is lost — pull to refresh.
        </p>
      ) : asked.filter((a) => !answeredNow.includes(a.suggestion_id)).length > 0 ? (
        <section data-asked-of-you="" aria-label="Asked of you">
          <InfoTip label="Asked of you" labelAs="h3" labelClassName="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55" align="start">
            The hosts or their coordinator ask you to change your times. Accept moves the moment on their schedule at
            once; Decline tells them, with your reason.
          </InfoTip>
          <ul className="mt-1 divide-y divide-ink/10">
            {asked
              .filter((a) => !answeredNow.includes(a.suggestion_id))
              .map((a) => (
                <AskedRow
                  key={a.suggestion_id}
                  a={a}
                  label={labelOf(day, a.block_id)}
                  send={send}
                  whereNames={a.kind === 'where' ? (a.proposed_block_ids ?? []).map((id) => labelOf(day, id) ?? 'a chapter that is gone').join(', ') : null}
                  whereNow={linked.map((c) => c.label).join(', ') || 'no chapter yet'}
                  onAnswered={(r, yes) => {
                    if (r.ok) setAnsweredNow((l) => [...l, a.suggestion_id]);
                    after(
                      r,
                      yes
                        ? a.kind === 'where'
                          ? 'Accepted. You’re on those chapters.'
                          : 'Accepted. Their schedule has your new time.'
                        : 'Declined. They’ve been told.',
                    );
                  }}
                />
              ))}
          </ul>
        </section>
      ) : null}

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
                <span className={r.status === 'accepted' || r.status === 'answered_by_host' ? 'font-semibold text-success-900' : 'text-ink/55'}>
                  {r.status === 'accepted'
                    ? r.auto_agreed
                      ? 'In (Auto-agree)'
                      : 'Approved'
                    : r.status === 'withdrawn'
                      ? 'Taken back'
                      : r.status === 'answered_by_host'
                        ? 'Answered by the host'
                        : 'Not approved'}
                </span>
                <span className="text-ink/70">{waitingWords(r, labelOf(day, r.block_id))}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ScheduleThumbRow
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
      {sheet?.kind === 'hours' ? (
        <VenueHoursSheet
          chapter={sheet.chapter}
          autoAgree={autoAgree}
          send={send}
          onClose={() => setSheet(null)}
          onSent={(r) => after(r, 'Sent. Once the host approves, the hours are yours to change.') && setSheet(null)}
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

function clashCount(elsewhere: Record<string, CrewClash[]>): number {
  return Object.values(elsewhere).filter((l) => l.length > 0).length;
}

function MomentLine({ m, tasksRead, clashes }: { m: SupplierMoment; tasksRead: boolean; clashes: readonly CrewClash[] }) {
  return (
    <>
      <span className="w-16 flex-none pt-0.5 text-[13px] tabular-nums text-ink/70">{m.clock}</span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="font-medium">{m.label}</span>
        {m.mine ? <span className="ml-1.5 text-xs font-semibold text-terracotta-700">yours</span> : null}
        {m.optional ? <span className="ml-1.5 text-xs text-ink/55">if kept</span> : null}
        {/* 🎭 Setup and pack-up are backstage (2026-11-04): the supplier sees them; guests never do. */}
        {m.section !== 'Event' ? (
          <span data-backstage-moment="" className="block text-[11px] uppercase tracking-[0.06em] text-gold-deep">
            {m.section} · {BACKSTAGE_WORDS}
          </span>
        ) : null}
        {m.mine && m.crew.length > 0 ? <span className="block text-xs text-ink/60">{m.crew.join(', ')}</span> : null}
        {m.mine && !tasksRead ? <span className="block text-xs text-ink/50">Your crew on it couldn’t be read.</span> : null}
        {clashes.map((c) => (
          <span key={`${c.crew}|${c.eventName}|${c.theirStartIso}`} data-crew-clash={c.kind} className="block text-xs font-medium text-warn-900">
            {c.words}
          </span>
        ))}
        {/* 📇 A contact on this moment (the bridal-car driver) — only on a moment they are on (4 additions (3)). */}
        {m.contacts.map((c) => (
          <span key={`${c.name}|${c.phone}`} data-moment-contact="" className="block text-xs text-ink/70">
            Contact: {contactLine(c)}
          </span>
        ))}
        {m.waiting ? <span className="block text-xs text-warn-900">{waitingWords(m.waiting, m.label)} · Waiting for the host</span> : null}
      </span>
    </>
  );
}

/** One ask of this supplier: who asked, the moment, the new time, their note — Accept, or Decline with a reason. */
function AskedRow({
  a,
  label,
  whereNames = null,
  whereNow = '',
  send,
  onAnswered,
}: {
  a: ScheduleAsk;
  label: string | null;
  /** 📍 A host's Where ask: the chapters they ask you to serve. */
  whereNames?: string | null;
  /** The chapters they are on now — an accepted ask REPLACES them. */
  whereNow?: string;
  send: Send;
  onAnswered: (r: SupplierScheduleAnswer, yes: boolean) => void;
}) {
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const answer = async (yes: boolean) => {
    setBusy(yes ? 'accept' : 'decline');
    const r = await send({ request: 'answer', suggestion_id: a.suggestion_id, decision: yes ? 'accept' : 'decline', reason: yes ? '' : reason.trim() });
    setBusy(null);
    onAnswered(r, yes);
  };
  return (
    <li data-asked={a.suggestion_id} className="flex flex-col gap-2 py-3">
      {whereNames !== null ? (
        <p className="text-sm" data-asked-where="">
          <span className="font-medium">{askerWords(a)}</span> asks you to work <span className="font-semibold">{whereNames}</span>.
          <span className="block text-xs text-ink/60">Now: {whereNow}. Accept makes it exactly these chapters.</span>
        </p>
      ) : (
      <p className="text-sm">
        <span className="font-medium">{askerWords(a)}</span> asks you to move “{label ?? 'a moment'}”
        {a.proposed_start_at ? (
          <>
            {' '}
            to <span className="font-semibold tabular-nums">{clockWords(a.proposed_start_at)}</span>
            {a.proposed_end_at ? <span className="text-ink/60"> – {clockWords(a.proposed_end_at)}</span> : null}
          </>
        ) : null}
        .
      </p>
      )}
      {/* A Where ask's own note shows; the automatic "Asks you to work …" would only repeat the line above. */}
      {a.note && (whereNames === null || !a.note.startsWith('Asks you to work ')) ? <p className="text-xs text-ink/65">“{a.note}”</p> : null}
      {declining ? (
        <>
          <FormRows width="wide">
            <TypedRow
              name="Why not"
              about={{ words: 'Optional. They read it beside your answer.' }}
              value={reason}
              empty="We have another event until 3 PM"
              long
              boxed
              maxLength={500}
              onKeep={(t) => {
                setReason(t);
                return { ok: true as const };
              }}
              data="asked-reason"
            />
          </FormRows>
          <div className="flex flex-wrap justify-end gap-2">
            <ActionButton tone="neutral" quiet icon={ArrowLeft} label="Back" onClick={() => setDeclining(false)} disabled={busy !== null} />
            <ActionButton tone="danger" icon={X} label={busy === 'decline' ? 'Sending…' : 'Send decline'} disabled={busy !== null} onClick={() => void answer(false)} data-testid="asked-decline-send" />
          </div>
        </>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          <ActionButton tone="neutral" icon={X} label="Decline" disabled={busy !== null} onClick={() => setDeclining(true)} data-testid="asked-decline" />
          <ActionButton tone="brand" main icon={Check} label={busy === 'accept' ? 'Accepting…' : 'Accept'} disabled={busy !== null} onClick={() => void answer(true)} data-testid="asked-accept" />
        </div>
      )}
    </li>
  );
}

/** The chapter names a pick reads as — "Preparation, Reception" (each option's own name, before " · venue"). */
function pickNames(options: readonly WhereOption[], ids: readonly string[]): string {
  return options
    .filter((o) => ids.includes(o.key))
    .map((o) => o.label.split(' · ')[0])
    .join(', ');
}

/**
 * 📍 ONE WHERE ROW — the shared Form Row with the shared dropdown and its ticks (`ChosenRow` + `picked`, as the host's
 * own Where row draws it). A tick only changes the draft; Send writes ONE request (`supplier_ask_where`) — so the host
 * is told once, not per tick. While it waits: what they asked, and Take back. The screen never resets.
 */
function SupplierWhereRow({
  w,
  send,
  autoAgree,
  locked,
  onSaid,
}: {
  w: SupplierOwnWhere;
  send: Send;
  autoAgree: boolean;
  locked: boolean;
  onSaid: (s: { tone: 'ok' | 'bad'; words: string } | null) => void;
}) {
  const [picked, setPicked] = useState<string[]>(w.picked);
  const [waiting, setWaiting] = useState(w.waiting);
  const [draft, setDraft] = useState<string[]>(w.draft);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState<'send' | 'back' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const keys = w.options.map((o) => o.key);
  const verdict = whereAskVerdict({ picked: draft, current: picked, chapterIds: keys });
  const sameAsWaiting = waiting !== null && draft.length === waiting.ids.length && draft.every((id) => waiting.ids.includes(id));

  const tick = (key: string) => {
    const next = new Set(draft);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setDraft(keys.filter((k) => next.has(k)));
    setTouched(true);
    setProblem(null);
  };

  const sendIt = async () => {
    if (!verdict.ok) return setProblem(verdict.words);
    setBusy('send');
    const r = await send({ request: 'where', vendor_id: w.vendorId, chapter_id: verdict.ids });
    setBusy(null);
    if (!r.ok) return setProblem(r.error);
    setTouched(false);
    if (r.outcome === 'applied') {
      setPicked(verdict.ids);
      setWaiting(null);
      onSaid({ tone: 'ok', words: SUPPLIER_WHERE_WORDS.saved });
    } else {
      setWaiting({ suggestionId: r.suggestionId ?? waiting?.suggestionId ?? '', ids: verdict.ids, names: pickNames(w.options, verdict.ids) });
      onSaid({ tone: 'ok', words: SUPPLIER_WHERE_WORDS.sent });
    }
  };

  const takeBack = async () => {
    if (!waiting?.suggestionId) return;
    setBusy('back');
    const r = await send({ request: 'take_back', suggestion_id: waiting.suggestionId });
    setBusy(null);
    if (!r.ok) return setProblem(r.error);
    setWaiting(null);
    setDraft(picked);
    setTouched(false);
    onSaid({ tone: 'ok', words: 'Taken back. Your chapters stay as they were.' });
  };

  const name = w.label ? `${SUPPLIER_WHERE_WORDS.name} · ${w.label}` : SUPPLIER_WHERE_WORDS.name;
  const buttonText = pickNames(w.options, draft) || SUPPLIER_WHERE_WORDS.none;
  const showSend = verdict.ok && !sameAsWaiting;
  return (
    <div data-supplier-where-row={w.vendorId} data-where-picked={picked.join(' ')}>
      <ChosenRow
        name={name}
        about={{ words: locked ? `${SUPPLIER_WHERE_WORDS.info} ${SUPPLIER_WHERE_WORDS.lockedInfo}` : SUPPLIER_WHERE_WORDS.info }}
        label={name}
        value={null}
        options={w.options}
        picked={draft}
        onPick={tick}
        buttonText={buttonText}
        data="supplier-where"
        problem={problem ?? undefined}
        note={
          waiting && sameAsWaiting
            ? SUPPLIER_WHERE_WORDS.waiting(waiting.names)
            : w.fromTrade && !touched && picked.length === 0
              ? SUPPLIER_WHERE_WORDS.fromTrade
              : undefined
        }
      />
      {(waiting && sameAsWaiting) || showSend ? (
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          {waiting && sameAsWaiting ? (
            <ActionButton
              tone="neutral"
              icon={Undo2}
              label={busy === 'back' ? 'Taking back…' : 'Take back'}
              disabled={busy !== null}
              onClick={() => void takeBack()}
              data-testid="supplier-where-take-back"
            />
          ) : null}
          {showSend ? (
            <ActionButton
              tone="brand"
              main
              icon={MapPin}
              label={busy === 'send' ? 'Sending…' : autoAgree ? 'Save' : 'Send'}
              disabled={busy !== null}
              onClick={() => void sendIt()}
              data-testid="supplier-where-send"
            />
          ) : null}
        </div>
      ) : null}
    </div>
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
      <ActionButton tone="neutral" icon={Undo2} label={busy ? 'Taking back…' : 'Take back'} disabled={busy} onClick={onTakeBack} data-testid="take-back" />
    </li>
  );
}

/** The view's thumb row — Suggest · My times · + My moment, on the suppliers' ONE thumb row (prototype `thumb()`). */
function ScheduleThumbRow({
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
  if (!canAdd && !canSuggest) return null;
  return (
    <SupplierThumbRow name="supplier-schedule" label="Your part of the schedule">
      {canSuggest ? <ActionButton tone="neutral" icon={MessageSquarePlus} label="Suggest" onClick={onSuggest} data-testid="supplier-suggest" /> : null}
      {canAdd ? <ActionButton tone="neutral" icon={Clock} label="My times" onClick={onTimes} data-testid="supplier-times" /> : null}
      {canAdd ? <ActionButton tone="brand" main icon={Plus} label="My moment" onClick={onAdd} data-testid="supplier-add" /> : null}
    </SupplierThumbRow>
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
  // A new moment in a Time-TBA chapter starts blank — its stored 00:00 is only the day, never a 12:00 AM to prefill.
  // ⏭ A moment "right after the one above" has no clock of its own — its stored start is its anchor's, never prefilled.
  const baseTime = moment ? (moment.rightAfter ? '' : wallTime(moment.start_at)) : !chapter.time_tba ? wallTime(chapter.start_at) : '';
  const [time, setTime] = useState(baseTime || '');
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
    const timeChanged = moment.rightAfter
      ? time !== ''
      : time !== wallTime(moment.start_at) || minutes !== String(moment.minutes ?? MOMENT_MINUTES_DEFAULT);
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
              <ActionButton tone="neutral" icon={ArrowLeft} label="Keep it" onClick={() => setStage('details')} />
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
                empty="Add"
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

/* ── 🏛 Venue hours — Starts · Ends · Setup from · Pack-up until (migration 20271307658341) ─────────────────── */

/** "5:00 PM – 10:00 PM · setup from 1:00 PM · out by 11:30 PM" */
export function venueHoursLine(start: string | null, end: string | null, ingress: number | null, egress: number | null): string {
  if (!start) return 'Time TBA';
  const parts = [`${clockWords(start)}${end ? ` – ${clockWords(end)}` : ' onward'}`];
  if (ingress !== null) parts.push(`setup from ${clockWords(shiftWall(start, -ingress))}`);
  if (egress !== null) parts.push(`out by ${clockWords(shiftWall(start, egress))}`);
  return parts.join(' · ');
}

function VenueHoursSheet({
  chapter: c,
  autoAgree,
  send,
  onClose,
  onSent,
}: {
  chapter: SupplierChapter;
  autoAgree: boolean;
  send: Send;
  onClose: () => void;
  onSent: (r: SupplierScheduleAnswer) => void;
}) {
  const headingId = useId();
  const day = wallDay(c.start_at);
  const startIso0 = c.start_at && !c.time_tba ? c.start_at : null;
  const [starts, setStarts] = useState(startIso0 ? wallTime(startIso0) : '');
  const [ends, setEnds] = useState(c.end_at ? wallTime(c.end_at) : '');
  const [setup, setSetup] = useState(startIso0 && c.ingress_minutes_before !== null ? wallTime(shiftWall(startIso0, -c.ingress_minutes_before)) : '');
  const [packUp, setPackUp] = useState(startIso0 && c.egress_minutes_after !== null ? wallTime(shiftWall(startIso0, c.egress_minutes_after)) : '');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <Sheet open onClose={onClose} labelledById={headingId} title={`${c.label} · hours`}>
      <div data-venue-hours-sheet={c.block_id} className="flex flex-col gap-3 px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2">
        <h3 id={headingId} className="sr-only">
          {c.label} hours
        </h3>
        <p className="text-[13px] text-ink/60">
          You are the venue, so you set this chapter’s hours and its setup and pack-up. {whereItGoesWords(autoAgree)}
        </p>
        <FormRows width="short">
          <TimeRow name="Starts" value={starts} onKeep={(t) => (setStarts(t), { ok: true })} data="venue-hours-starts" />
          <TimeRow name="Ends" value={ends} clearable onKeep={(t) => (setEnds(t), { ok: true })} data="venue-hours-ends" />
          <TimeRow name="Setup from" value={setup} clearable onKeep={(t) => (setSetup(t), { ok: true })} data="venue-hours-setup" />
          <TimeRow name="Pack-up until" value={packUp} clearable onKeep={(t) => (setPackUp(t), { ok: true })} data="venue-hours-packup" />
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
            icon={Clock}
            label={busy ? 'Sending…' : autoAgree ? 'Save' : 'Send'}
            disabled={busy}
            data-testid="venue-hours-send"
            onClick={async () => {
              const startIso = wallIso(day, starts);
              if (!startIso) return setProblem('Give the chapter a start time.');
              const fields: Fields = {
                request: 'hours',
                chapter_id: c.block_id,
                chapter_label: c.label,
                start_at: startIso,
                end_at: endIsoFrom(startIso, ends) ?? '',
                ingress_minutes: String(ingressMinutesFrom(startIso, setup) ?? ''),
                egress_minutes: String(egressMinutesFrom(startIso, packUp) ?? ''),
              };
              setBusy(true);
              setProblem(null);
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
