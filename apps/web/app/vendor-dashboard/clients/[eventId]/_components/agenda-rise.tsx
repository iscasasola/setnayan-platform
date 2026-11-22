'use client';

/**
 * 📅 THE SCHEDULE, RISEN FROM THE CHAT (Unichat part F, owner 2026-11-20; drawing `unichat_live_v3_2026-11-20.html`
 * `riseBody('next')`, specs e10c544b). The strip's Next box raises ONE dated list from today to the event day over the
 * chat (the one `RiseScreen`, as the Deal box raises Every version) — not the per-chapter Schedule page:
 *
 *   Done · N (folded) → This week · … → Next week · … → later weeks → Event day · 18 Dec · <venue>
 *   (the venue's window bar, its hours in bold, "Set by <venue> · confirmed by the hosts") → Your part of the day.
 *
 * Every row is a date the page already read (`clientAgenda`, lib/client-agenda.ts). A tap on one of YOUR moments opens
 * the shipped moment sheet right here (`MyMomentSheet` — the same send, the same backstage verdict), never a link out.
 * A schedule that could not be read says so; it is never drawn as an empty day.
 */
import { useState } from 'react';
import { ChevronDown, Clock } from 'lucide-react';
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import { VenueWindowBar } from '@/app/_components/venue-window-bar';
import { agendaLine, type Agenda, type AgendaKind, type AgendaRow } from '@/lib/client-agenda';
import { OUTSIDE_WORDS, backstageVerdict, venueWindowOf, venueWindowWords, windowSetByWords } from '@/lib/venue-window';
import type { SupplierChapter, SupplierDay, SupplierMoment } from '@/lib/supplier-schedule';
import { MyMomentSheet, momentSend } from './supplier-schedule';

/** The drawing's `.k-*` ramps, from the chat's kind tokens (light + dark). */
const KIND: Record<AgendaKind, { tile: string; pill: string; set: string }> = {
  meeting: { tile: 'bg-kind-meeting-bg text-kind-meeting', pill: 'bg-kind-meeting-bg text-kind-meeting', set: 'bg-kind-meeting text-[rgb(var(--sn-frame-bg))]' },
  payment: { tile: 'bg-kind-payment-bg text-kind-payment', pill: 'bg-kind-payment-bg text-kind-payment', set: 'bg-kind-payment text-[rgb(var(--sn-frame-bg))]' },
  quote: { tile: 'bg-kind-quote-bg text-kind-quote', pill: 'bg-kind-quote-bg text-kind-quote', set: 'bg-kind-quote text-[rgb(var(--sn-frame-bg))]' },
};

export type AgendaRiseProps = {
  eventId: string;
  agenda: Agenda;
  eventDate: string | null;
  /** "18 Dec" — the event day's head. */
  eventDayWords: string | null;
  /** A read the list is made from was refused ("Meetings couldn't load just now — some days may be missing."). */
  unreadLine: string | null;
  /** The supplier's part of the day; null = it could not be read (said). */
  day: SupplierDay | null;
  autoAgree: boolean;
  tasksRead: boolean;
  lab?: boolean;
};

export function AgendaRise({ eventId, agenda, eventDate, eventDayWords, unreadLine, day, autoAgree, tasksRead, lab = false, onClose }: AgendaRiseProps & { onClose: () => void }) {
  const [sheet, setSheet] = useState<{ chapter: SupplierChapter; moment: SupplierMoment } | null>(null);
  const [said, setSaid] = useState<{ ok: boolean; words: string } | null>(null);
  const linked = day ? day.chapters.filter((c) => c.linked) : [];
  // The chapter whose window heads the day: the first one they are on that has hours, else the first with hours.
  const head = linked.find((c) => venueWindowOf(c)) ?? day?.chapters.find((c) => venueWindowOf(c)) ?? null;
  const w = head ? venueWindowOf(head) : null;
  const mine = linked.flatMap((c) => c.moments.filter((m) => m.mine).map((m) => ({ c, m })));
  const ticks = head ? head.moments.filter((m) => m.mine && !m.rightAfter && m.start_at).map((m) => ({ start: m.start_at as string, end: m.end_at })) : [];

  return (
    <RiseScreen title="Schedule" line={agendaLine(agenda, eventDate)} onClose={onClose} data="agenda">
      <div className="grid gap-5 px-4 pb-6 pt-2" data-agenda="">
        {unreadLine ? (
          <p role="alert" className="text-sm font-semibold text-danger-700" data-agenda-unread="">
            {unreadLine}
          </p>
        ) : null}
        {agenda.done.length > 0 ? (
          <details className="group" data-agenda-done="">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-bold text-ink/70 [&::-webkit-details-marker]:hidden">
              Done · {agenda.done.length}
              <ChevronDown aria-hidden className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
            </summary>
            <div className="opacity-75">{agenda.done.map((r) => <Row key={r.key} r={r} />)}</div>
          </details>
        ) : null}

        {agenda.groups.map((g) => (
          <section key={g.key} aria-label={g.heading} data-agenda-group="">
            <h4 className="mb-1 text-xs font-bold uppercase tracking-[0.08em] text-ink/60">{g.heading}</h4>
            {g.rows.map((r) => <Row key={r.key} r={r} />)}
          </section>
        ))}
        {agenda.nothingAhead && !unreadLine ? <p className="text-sm text-ink/70">Nothing dated before the day.</p> : null}

        <section aria-label="Event day" data-agenda-day="">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-ink/60">
            {['Event day', eventDayWords, head?.where && head.where !== 'Venue TBA' ? head.where : null].filter(Boolean).join(' · ')}
          </h4>
          {day === null ? (
            <p role="alert" className="text-sm text-danger-700">Couldn’t load the day just now. Reload to try again.</p>
          ) : w && head ? (
            <div className="grid gap-1" data-venue-window={head.block_id}>
              <VenueWindowBar window={w} ticks={ticks} />
              <p className="text-[13px] text-ink/70">
                <b className="font-semibold text-ink">{venueWindowWords(w)}</b>
                <br />
                <span data-window-set-by="">{windowSetByWords(head.hoursHeldBy)}</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-ink/70">The hosts haven’t set the day’s hours yet.</p>
          )}
        </section>

        {day ? (
          <section aria-label="Your part of the day" data-agenda-mine="">
            <h4 className="mb-1 text-xs font-bold uppercase tracking-[0.08em] text-ink/60">Your part of the day</h4>
            {mine.length === 0 ? (
              <p className="text-sm text-ink/70">No moments of yours on the day yet.</p>
            ) : (
              <ul className="divide-y divide-[color:var(--m-line)]">
                {mine.map(({ c, m }) => {
                  const out = Boolean(m.start_at) && !m.rightAfter && backstageVerdict(c, m.start_at, m.end_at) === 'outside';
                  return (
                    <li key={m.block_id}>
                      <button
                        type="button"
                        className="sn-press flex min-h-[52px] w-full items-center gap-3 py-2 text-left"
                        aria-label={`Ask to move this: ${m.label}`}
                        data-agenda-moment={m.block_id}
                        onClick={() => setSheet({ chapter: c, moment: m })}
                      >
                        <span className="w-16 flex-none text-[13px] tabular-nums text-ink/70">{m.clock}</span>
                        <span className="min-w-0 flex-1">
                          <b className="block truncate text-sm font-semibold text-ink">{m.label}</b>
                          <small className={`block text-xs ${out ? 'font-semibold text-warn-700' : 'text-ink/60'}`}>{out ? OUTSIDE_WORDS : c.label}</small>
                        </span>
                        <Clock aria-hidden className="h-4 w-4 flex-none text-kind-meeting" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 text-[13px] text-ink/70">Set by the hosts on the event Schedule. Tap a moment to ask to move it.</p>
            {said ? (
              <p role="status" className={`mt-2 text-sm font-semibold ${said.ok ? 'text-success-700' : 'text-danger-700'}`}>
                {said.words}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
      {sheet ? (
        <MyMomentSheet
          chapters={linked}
          chapter={sheet.chapter}
          moment={sheet.moment}
          autoAgree={autoAgree}
          tasksRead={tasksRead}
          send={momentSend(eventId, lab)}
          onClose={() => setSheet(null)}
          onSent={(r) => {
            setSaid(r.ok ? { ok: true, words: r.outcome === 'applied' ? 'Saved. It’s on the schedule.' : 'Sent. The host or coordinator approves it.' } : { ok: false, words: r.error });
            if (r.ok) setSheet(null);
          }}
        />
      ) : null}
    </RiseScreen>
  );
}

/** One dated row: the drawing's date tile · what · its status pill, in the row's kind colour. */
function Row({ r }: { r: AgendaRow }) {
  const k = KIND[r.kind];
  const pill = r.status === 'Set' ? k.set : r.status === 'Done' ? 'bg-ink/5 text-ink/70' : k.pill;
  return (
    <div className="flex min-h-[52px] items-center gap-3 py-1" data-agenda-row={r.kind}>
      <span aria-hidden className={`grid h-10 w-10 flex-none place-items-center rounded-lg text-center leading-none ${k.tile}`}>
        <small className="text-[11px] font-semibold uppercase">{r.mon}</small>
        <b className="text-base font-bold">{r.d}</b>
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
        <span className="sr-only">{`${r.mon} ${r.d}: `}</span>
        {r.title}
      </span>
      <span className={`flex-none rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${pill}`}>{r.status}</span>
    </div>
  );
}
