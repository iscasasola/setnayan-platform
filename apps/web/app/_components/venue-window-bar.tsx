import { clockWords } from '@/lib/schedule-chapters';
import { axisEndWords, axisPercent, insideWindow, venueWindowWords, windowAxis, windowBands, type VenueWindow } from '@/lib/venue-window';

/**
 * 🏛 THE VENUE WINDOW BAR — when the venue allows ingress · event · egress, as one strip of the day (Unichat part F,
 * owner 2026-11-20; drawing `UNICHAT-LIVE-2026-11-19.html` `.vbar`): hatched setup, solid event, hatched pack-up, a
 * thin tick per moment of the viewer's own (amber when it sits outside the hours), and one live tick for the time being
 * typed in a sheet. Decorative by itself — the same facts are always said in words right under it
 * (`venueWindowWords`), so the bar is one `role="img"` with those words as its name.
 *
 * No hooks, no state: drawn by server and client parents alike. Colours are the app's own tokens
 * (`--sn-cat-schedule`, the warn ramp, `--sn-hair`), so it follows light, dark and a recoloured app.
 */
export function VenueWindowBar({
  window: w,
  ticks = [],
  live = null,
  mini = false,
  ends = true,
}: {
  window: VenueWindow;
  /** The viewer's own moments on this chapter: a start, and an end when it has one. */
  ticks?: readonly { start: string; end?: string | null }[];
  /** The time being typed right now (a sheet) — one wider tick that glides as it changes. */
  live?: string | null;
  mini?: boolean;
  /** The two clock words under the bar's ends. */
  ends?: boolean;
}) {
  const axis = windowAxis(w, [...ticks.map((t) => t.start), live]);
  const bands = windowBands(w, axis);
  const hatch =
    'repeating-linear-gradient(135deg, rgb(var(--sn-cat-schedule) / 0.14) 0 4px, rgb(var(--sn-cat-schedule) / 0.42) 4px 6px)';
  return (
    <div data-venue-window-bar="">
      <div
        role="img"
        aria-label={`Venue hours: ${venueWindowWords(w)}`}
        className={`relative overflow-hidden rounded-full bg-[rgb(var(--sn-frame-bg))] ${mini ? 'h-3' : 'h-5'}`}
        style={{ boxShadow: 'inset 0 0 0 1px var(--sn-hair)' }}
      >
        {bands.map((b) => (
          <i
            key={b.kind}
            data-window-band={b.kind}
            className="absolute inset-y-0"
            style={{
              left: `${b.left}%`,
              width: `${b.width}%`,
              background: b.kind === 'event' ? 'rgb(var(--sn-cat-schedule))' : hatch,
            }}
          />
        ))}
        {ticks.map((t, i) => {
          const out = !insideWindow(w, t.start, t.end ?? null);
          return (
            <i
              key={`${t.start}|${i}`}
              data-window-tick={out ? 'outside' : 'inside'}
              className={`absolute w-0.5 -translate-x-1/2 rounded-sm ${mini ? 'inset-y-0.5' : 'inset-y-[3px]'} ${out ? 'bg-warn-500' : 'bg-[rgb(var(--sn-frame-bg))] ring-1 ring-ink/55'}`}
              style={{ left: `${axisPercent(axis, t.start)}%` }}
            />
          );
        })}
        {live ? (
          <i
            data-window-live=""
            className="absolute inset-y-0 w-1.5 -translate-x-1/2 rounded-sm bg-sn-accent ring-1 ring-[rgb(var(--sn-frame-bg))] motion-reduce:!transition-none"
            style={{ left: `${axisPercent(axis, live)}%`, transition: 'left var(--sn-m-move) var(--sn-m-settle)' }}
          />
        ) : null}
      </div>
      {ends ? (
        <div aria-hidden className="mt-1 flex justify-between text-sn-sm tabular-nums text-ink/70">
          <span>{axisEndWords(axis.lo)}</span>
          {live ? <span>{clockWords(live)}</span> : null}
          <span>{axisEndWords(axis.hi)}</span>
        </div>
      ) : null}
    </div>
  );
}
