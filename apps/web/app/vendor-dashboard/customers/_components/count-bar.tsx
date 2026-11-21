import { countBarFillPct, type CountBar } from '@/lib/day-count-bar';

/**
 * 📊 THE DAY BAR (the widget approved 18 Nov; Availability plan step 4, drawing
 * `prototypes/availability_steps_3_4_2026-11-19.html` § Step 4) — one group's count on the Clients day:
 *
 *   name ("Orders in progress" · "Tiffany chairs") over a state dot + "3 of 5 in progress" · "2 free" on the right
 *   the strip: up to ten, one piece per order; above ten, a bar. Dark = taken, light = free.
 *
 * The dot is green when all are free, yellow when some are left, black when full — and the dot is never the only
 * sign: the words always say it. A refused read says so in the bar's place, never "0 out". Server-drawn, no motion.
 */
const DOT: Record<'ok' | 'some' | 'full', string> = {
  ok: 'rgb(var(--color-ok))',
  some: 'rgb(var(--color-warn))',
  full: 'rgb(var(--color-ink))',
};
const FREE_TONE: Record<'ok' | 'some' | 'full', string> = {
  ok: 'rgb(var(--color-ok))',
  some: 'rgb(var(--color-warn))',
  full: 'rgb(var(--color-danger))',
};

export function CountBarView({ bar }: { bar: CountBar }) {
  if (bar.unread) {
    return (
      <div className="py-1.5" data-count-bar={bar.kind} data-count-bar-unread="">
        <b className="block text-[15px] font-medium text-ink">{bar.name}</b>
        <small className="text-[13px] text-ink/60">Couldn’t read how many are out · Try again</small>
      </div>
    );
  }
  return (
    <div className="py-1.5" data-count-bar={bar.kind} data-count-bar-dot={bar.dot}>
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[15px] font-medium text-ink">{bar.name}</b>
          <small className="text-[13px] text-ink/60">
            <span aria-hidden className="mr-[5px] inline-block h-2 w-2 rounded-full align-middle" style={{ background: DOT[bar.dot] }} />
            {/* The computer's shorter words (drawing: "3 of 5" beside "Orders in progress"). */}
            <span className="tab:hidden">{bar.words}</span>
            <span className="hidden tab:inline">{bar.short}</span>
          </small>
        </span>
        <span className="flex-none text-[14px] font-semibold" style={{ color: FREE_TONE[bar.dot] }}>
          {bar.free === 0 ? 'Full' : `${bar.free.toLocaleString('en-US')} free`}
        </span>
      </div>
      {bar.strip === 'pieces' ? (
        <div aria-hidden className="mt-2 flex gap-1" data-count-bar-strip="pieces">
          {Array.from({ length: bar.total }, (_, i) => (
            <i
              key={i}
              className={`h-2 flex-1 rounded-sm ${i < bar.taken ? 'bg-ink' : 'bg-ink/5 outline outline-1 -outline-offset-1 outline-ink/15'}`}
            />
          ))}
        </div>
      ) : (
        <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/5 outline outline-1 -outline-offset-1 outline-ink/15" data-count-bar-strip="fill">
          <i className="block h-full bg-ink" style={{ width: `${countBarFillPct(bar)}%` }} />
        </div>
      )}
    </div>
  );
}
