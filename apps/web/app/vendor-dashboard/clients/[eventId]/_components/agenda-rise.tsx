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
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import { VenueWindowBar } from '@/app/_components/venue-window-bar';
import { AgendaRows, DAY_COLUMN, DayHead, DayTimeline } from '@/app/_components/day-rise-parts';
import { agendaLine, type Agenda } from '@/lib/client-agenda';
import { OUTSIDE_WORDS, backstageVerdict, venueWindowOf, venueWindowWords, windowSetByWords } from '@/lib/venue-window';
import type { SupplierChapter, SupplierDay, SupplierMoment } from '@/lib/supplier-schedule';
import { MyMomentSheet, momentSend } from './supplier-schedule';

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
    <RiseScreen title="Schedule" line={agendaLine(agenda, eventDate)} onClose={onClose} data="agenda" back="Back to chat">
      <div className={DAY_COLUMN} data-agenda="">
        <AgendaRows agenda={agenda} unreadLine={unreadLine} />

        <section aria-label="Event day" data-agenda-day="">
          <DayHead>{['Event day', eventDayWords, head?.where && head.where !== 'Venue TBA' ? head.where : null].filter(Boolean).join(' · ')}</DayHead>
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
            <DayHead>Your part of the day</DayHead>
            {mine.length === 0 ? (
              <p className="text-sm text-ink/70">No moments of yours on the day yet.</p>
            ) : (
              <DayTimeline
                items={mine.map(({ c, m }) => {
                  const out = Boolean(m.start_at) && !m.rightAfter && backstageVerdict(c, m.start_at, m.end_at) === 'outside';
                  return {
                    key: m.block_id,
                    clock: m.clock,
                    label: m.label,
                    sub: out ? OUTSIDE_WORDS : c.label,
                    warn: out,
                    pickLabel: `Ask to move this: ${m.label}`,
                    onPick: () => setSheet({ chapter: c, moment: m }),
                    data: { 'data-agenda-moment': m.block_id },
                  };
                })}
              />
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
