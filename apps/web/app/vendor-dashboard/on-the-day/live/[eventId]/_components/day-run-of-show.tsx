'use client';

import { RunOfShowHeader, type RunOfShowDraw } from '@/app/_components/run-of-show-header';
import type { RunOfShowBlock } from '@/lib/run-of-show';
import { PartCard, PartSec, setTwo } from '@/app/vendor-dashboard/_components/set-two/parts';

/**
 * YOUR TOOLS · NOW · UP NEXT — the event day's run of show in the November look (supplier pages set two, page 8,
 * 21 Nov 2026: "Your tools ● Live · watching", then the Now / Up next card).
 *
 * The SAME header the couple's schedule and the client workspace mount (`RunOfShowHeader`) — the same run-state and the
 * same realtime channel — handed a `draw` so only the drawing is ours (this console never advances the timeline). Its
 * words are the header's own ("Not started yet." · "Between moments." · "Nothing scheduled after this." · the wrap
 * line); "Live · watching" / "Syncing" is the channel's state, as the strip says it.
 *
 * Mounted only when the couple's program WAS read (`programUnread` is decided by the page first) — an unread program
 * is the page's warn note, never this card over an empty list.
 */
export function DayRunOfShow({ eventId, blocks }: { eventId: string; blocks: RunOfShowBlock[] }) {
  return <RunOfShowHeader eventId={eventId} initial={blocks} draw={(run) => <Drawn run={run} />} />;
}

function Drawn({ run }: { run: RunOfShowDraw }) {
  const live = run.ahead ? null : (
    <span
      className={`${setTwo.live} ${run.live ? '' : setTwo.liveOff}`}
      title={run.live ? 'Updating in real time' : 'Reconnecting…'}
      data-run-of-show-live=""
    >
      <i aria-hidden className={run.live ? 'sn-live-dot' : undefined} />
      {run.live ? 'Live · watching' : 'Syncing'}
    </span>
  );
  return (
    <>
      <PartSec end={live}>Your tools</PartSec>
      {run.empty ? null : (
        <PartCard>
          <section aria-label="Run of show" data-day-run-of-show="">
            {run.allDone ? (
              <p className={setTwo.cardLine}>The day-of timeline has wrapped — every moment is done.</p>
            ) : (
              <div className={setTwo.now2}>
                <div>
                  <small>{run.notStarted && run.startsOnWords ? 'Starts' : 'Now'}</small>
                  {run.current ? (
                    <>
                      <b>{run.current.label}</b>
                      <span>
                        {run.time(run.current.start_at)}
                        {run.current.location ? ` · ${run.current.location}` : ''}
                        {run.drift ? ` · ${run.drift}` : ''}
                      </span>
                    </>
                  ) : (
                    <span>{run.notStarted ? (run.startsOnWords ?? 'Not started yet.') : 'Between moments.'}</span>
                  )}
                </div>
                <div>
                  <small data-run-of-show-next={run.ahead ? 'first' : 'next'}>{run.ahead ? 'First moment' : 'Up next'}</small>
                  {run.next ? (
                    <>
                      <b>{run.next.label}</b>
                      <span>
                        {run.time(run.next.start_at)}
                        {run.next.location ? ` · ${run.next.location}` : ''}
                      </span>
                    </>
                  ) : (
                    <span>Nothing scheduled after this.</span>
                  )}
                </div>
              </div>
            )}
          </section>
        </PartCard>
      )}
    </>
  );
}
