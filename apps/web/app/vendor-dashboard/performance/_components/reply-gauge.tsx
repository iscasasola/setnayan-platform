'use client';

import { formatCount } from '@/lib/format-number';
import { FAST_REPLY_THRESHOLD_MIN, REPLY_TIME_MIN_SAMPLE, formatReplyMinutes } from '@/lib/vendor-reply-time';
import { GAUGE_MAX_MIN } from '@/lib/analytics-growing';
import { EASE_GROW, EASE_OUT, HeldCount, useTween } from './growth-motion';

/**
 * §2 "Are they asking, and do I answer?" — the reply-speed gauge (Shop › Analytics, owner-approved 6 Nov 2026): a 0 →
 * 8 h half-arc whose 4 h mark is where the public claim comes off (`ReplyClaimCard`'s rule, `FAST_REPLY_THRESHOLD_MIN`).
 * The arc sweeps (stroke-dashoffset) and the needle turns, both 900 ms on the grow curve; the value counts. Empty = a
 * dashed arc, the needle at rest, "—". `HabitDots`: the three answered conversations that make a habit, popping in.
 */
const CX = 84;
const CY = 88;
const R = 66;
const ARC = `M${CX - R},${CY} A${R},${R} 0 0 1 ${CX + R},${CY}`;
const ARC_LEN = Math.PI * R;

function Sweep({ frac }: { frac: number }) {
  const v = useTween('ag:gauge:arc', frac * 100, { dur: 900, ease: EASE_GROW });
  return <path className="ag-gval" d={ARC} strokeDasharray={ARC_LEN} style={{ strokeDashoffset: ARC_LEN * (1 - v / 100) }} />;
}
function Needle({ frac }: { frac: number }) {
  const deg = useTween('ag:gauge:ndl', frac * 180, { dur: 900, ease: EASE_GROW });
  return <line className="ag-ndl" x1={CX} y1={CY} x2={CX - R + 14} y2={CY} style={{ transform: `rotate(${deg}deg)` }} />;
}
function Dot({ i }: { i: number }) {
  const v = useTween(`ag:dot:${i}`, 1, { dur: 450, ease: EASE_OUT, delay: 300 + i * 120 });
  return <span className="ag-dot ag-on" style={{ opacity: v, transform: `scale(${0.6 + 0.4 * v})` }} />;
}

export function ReplyGauge({ minutes, answered, unread }: { minutes: number | null; answered: number; unread?: boolean }) {
  const ghost = minutes === null;
  const frac = ghost ? 0 : Math.min(minutes / GAUGE_MAX_MIN, 1);
  const on = Math.min(answered, REPLY_TIME_MIN_SAMPLE);
  return (
    <>
      <div className="ag-gauge" data-reply-gauge={ghost ? 'empty' : 'shown'}>
        <svg viewBox="0 0 168 100" aria-hidden>
          <path className={ghost ? 'ag-gtrk ag-ghost' : 'ag-gtrk'} d={ARC} />
          {ghost ? null : <Sweep frac={frac} />}
          <line x1={CX} y1={CY - R - 10} x2={CX} y2={CY - R + 8} stroke="rgb(var(--color-ok))" strokeWidth={1.5} />
          <text className="ag-tk ag-mark" x={CX} y={CY - R - 14} textAnchor="middle">
            {formatReplyMinutes(FAST_REPLY_THRESHOLD_MIN)} · shown up to here
          </text>
          <text className="ag-tk" x={CX - R} y={CY + 14} textAnchor="middle">
            0h
          </text>
          <text className="ag-tk" x={CX + R} y={CY + 14} textAnchor="middle">
            {formatReplyMinutes(GAUGE_MAX_MIN)}
          </text>
          {ghost ? <line className="ag-ndl ag-ghost" x1={CX} y1={CY} x2={CX - R + 14} y2={CY} /> : <Needle frac={frac} />}
          <circle className={ghost ? 'ag-hub ag-ghost' : 'ag-hub'} cx={CX} cy={CY} r={4} />
        </svg>
        <div className="ag-gt">
          {ghost ? (
            <>
              <div className="ag-gv ag-ghost">—</div>
              <div className="ag-gl">{unread ? 'Couldn’t load your reply time just now' : `Your reply time shows here after ${REPLY_TIME_MIN_SAMPLE} answered conversations`}</div>
            </>
          ) : (
            <>
              <HeldCount value={minutes} id="ag:gauge:val" className="ag-gv" format={(n) => formatReplyMinutes(n)} />
              <div className="ag-gl">Couples see “Usually responds in {formatReplyMinutes(minutes)}”</div>
            </>
          )}
        </div>
      </div>
      {unread ? null : <HabitDots on={on} />}
    </>
  );
}

export function HabitDots({ on }: { on: number }) {
  return (
    <div className="ag-dots">
      {Array.from({ length: REPLY_TIME_MIN_SAMPLE }, (_, i) => (i < on ? <Dot key={i} i={i} /> : <span key={i} className="ag-dot" />))}
      <span>
        {formatCount(on)} of {formatCount(REPLY_TIME_MIN_SAMPLE)} answered · {formatCount(REPLY_TIME_MIN_SAMPLE)} make a habit
      </span>
    </div>
  );
}
