'use client';

/**
 * 👷 CREW FOR THE DAY — who the supplier brings, what each one does, and when they arrive (Unichat part H2, 20 Nov
 * 2026; drawing `UNICHAT-LIVE-2026-11-19.html`: "Lumina's crew is set · 3 · arrive 12:00 PM").
 *
 * RULE 0: the crew is NOT a new list. It is the supplier's crews as they already stand on the event's schedule —
 * `event_schedule_tasks` (crew · what · call time), written through the shipped "+ My moment → Who on our side" and
 * the hosts' own Schedule. This card only reads them, live, so it is always the schedule's current answer. The line
 * it rides ("Crew named for the day") is posted once per chat, the first time a crew is named.
 *
 * The supplier's side is one quiet line: their crew is theirs to change on the Schedule, not here.
 */
import { useCallback, useEffect, useState } from 'react';
import { clockWords } from '@/lib/schedule-chapters';
import { countNoun } from '@/lib/format-number';
import type { DayCrewMember } from '@/lib/deal-end';
import { loadDayCrew } from './deal-end-calls';
import { CouldNotLoad, KindCard, KindTag, Loading, type Read } from './card-bits';

type Got = { members: DayCrewMember[]; firstArrival: string | null };

export function CrewDayCard({
  threadId,
  viewer,
  supplierName,
  seed,
}: {
  threadId: string;
  viewer: 'vendor' | 'couple';
  supplierName: string;
  /** Labs only: the crew as read, so no request is made. */
  seed?: Got;
}) {
  const [read, setRead] = useState<Read<Got>>(seed ? { at: 'ok', data: seed } : { at: 'loading' });
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    void loadDayCrew(threadId).then((r) => setRead(r.ok ? { at: 'ok', data: { members: r.members, firstArrival: r.firstArrival } } : { at: 'failed' }));
  }, [threadId]);
  useEffect(() => {
    if (!seed && viewer === 'couple') load();
  }, [load, seed, viewer]);

  if (viewer === 'vendor') {
    return (
      <p className="text-center text-[13px] text-ink/60" data-crew-day-line="supplier">
        Your crew is on their Schedule · the hosts see who comes and when
      </p>
    );
  }
  const got = read.at === 'ok' ? read.data : null;
  const first = got?.firstArrival ? clockWords(got.firstArrival) : '';
  return (
    <KindCard
      kind="meeting"
      topic="schedule"
      kicker={got && got.members.length > 0 ? `${countNoun(got.members.length, 'person', 'people')}${first ? ` · first arrives ${first}` : ''}` : 'Who comes on the day'}
      title={`${supplierName}’s crew for the day`}
      turn="wait"
    >
      {read.at === 'loading' ? (
        <Loading />
      ) : read.at === 'failed' ? (
        <CouldNotLoad what="the crew" onRetry={load} />
      ) : got!.members.length === 0 ? (
        <p className="text-[14px] text-ink/70" data-crew-day-card="none">
          No crew is named on the Schedule right now.
        </p>
      ) : (
        <ul className="grid gap-2" data-crew-day-card="ok">
          {got!.members.map((m) => (
            <li key={m.name} className="flex items-start justify-between gap-3">
              <span className="grid min-w-0">
                <b className="truncate text-[15px] font-semibold text-ink">{m.name}</b>
                {m.roles.length > 0 ? <span className="line-clamp-2 text-[13px] text-ink/70">{m.roles.join(' · ')}</span> : null}
              </span>
              {/* The meeting kind's signature: the time, in the kind's own ink. */}
              <span className="flex-none">
                <KindTag kind="meeting">{m.arriveAt && clockWords(m.arriveAt) ? `Arrives ${clockWords(m.arriveAt)}` : 'Time not set'}</KindTag>
              </span>
            </li>
          ))}
        </ul>
      )}
    </KindCard>
  );
}
