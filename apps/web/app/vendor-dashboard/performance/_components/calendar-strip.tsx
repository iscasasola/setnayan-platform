'use client';

import { STRIP_DAYS } from '@/lib/analytics-growing';

/**
 * §4 "What’s ahead" — the next 13 weeks from today, a column per week (Shop › Analytics, owner-approved 6 Nov 2026).
 * Filled = a day with a live booking (deeper = more than one); ring = a date couples asked for that the shop was not
 * free on. Each marked cell pops in (450 ms, 110 ms apart). Unwindowed — a window change replays nothing here.
 */
function Cell({ cls, k }: { cls: string; k: number | null }) {
  // A marked cell pops in, 110 ms apart (CSS `ag-pop`, dropped under reduced motion) — no JS tween.
  return <span className={k === null ? cls : `${cls} ag-pop`} style={k === null ? undefined : { animationDelay: `${k * 110}ms` }} />;
}

export function CalendarStrip({
  months,
  booked,
  waiting,
  unread = false,
}: {
  /** Not read — "Couldn’t load", never the new shop's "Your first booked date…". */
  unread?: boolean;
  months: readonly string[];
  booked: readonly { at: number; many: boolean }[];
  waiting: readonly number[];
}) {
  const on = new Map(booked.map((b) => [b.at, b.many]));
  const wait = new Set(waiting);
  let k = 0;
  const cells = Array.from({ length: STRIP_DAYS }, (_, i) => {
    const isOn = on.has(i);
    const isWait = wait.has(i);
    const cls = ['ag-cc', i === 0 ? 'ag-today' : '', isOn ? (on.get(i) ? 'ag-on ag-on2' : 'ag-on') : '', isWait ? 'ag-wait' : ''].filter(Boolean).join(' ');
    return <Cell key={i} cls={cls} k={isOn || isWait ? k++ : null} />;
  });
  const empty = booked.length === 0 && waiting.length === 0;
  return (
    <div data-calendar-strip="">
      <div className="ag-cal-m">
        {months.map((m, i) => (
          <span key={i}>{m}</span>
        ))}
      </div>
      <div className="ag-cal" aria-hidden>
        {cells}
      </div>
      <div className="ag-cal-k">
        <span>
          <i className="ag-t" />
          today
        </span>
        <span>
          <i />
          booked day
        </span>
        <span>
          <i className="ag-w" />
          couples asked, you weren’t free
        </span>
      </div>
      {unread ? (
        <p className="ag-ghost-t" style={{ marginTop: 8 }}>
          Couldn’t load your calendar just now.
        </p>
      ) : empty ? (
        <p className="ag-ghost-t" style={{ marginTop: 8 }}>
          Your first booked date lights up here — and so does the first date a couple wanted that you weren’t free on.
        </p>
      ) : null}
    </div>
  );
}
