'use client';

/**
 * story-clock.tsx — the dial, and the motion of the spine.
 *
 * Ported from `prototypes/story.html` (`01_The_Story.md` §1 · §7 · §11).
 * ONE client component, because the prototype is one script and the three
 * behaviours are one behaviour: the needle, the "now" readout and the entry
 * that is being read are the same fact asked three ways. Splitting them is how
 * two of them end up disagreeing.
 *
 * 🔑 EVERYTHING IT DRAWS IS ALREADY DECIDED. The bars arrive as heights, and a
 * withheld bar arrives with `height: null` — this component cannot compute a
 * count and has no path to one. `drawnBins()` on the server is the only source
 * of a bar's height (`the-guests-layer-is-theirs-until-you-publish.ts`), so a
 * bug in here cannot surface a number a reader may not have.
 *
 * The five rules below are review findings, not preferences. Each is marked.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { DIAL_WIDTH, formatClock, nearestBarAt, percentOf } from '@/lib/story-spine';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { clearReaderPosition, publishReaderPosition } from '@/lib/story-reader-position';

/** One bar, fully resolved on the server. */
export type DialBar = {
  /** Axis position of the bar's left edge, in `DIAL_WIDTH` units. */
  x: number;
  /** Axis width. */
  w: number;
  /**
   * Bar height in axis units, 0…46. NULL = a baseline tick and nothing more —
   * either the minute has not happened yet, or its captures are not this
   * reader's to count. **Never 0-as-null**: a real zero is "nobody was
   * shooting", which is a true thing to draw.
   */
  h: number | null;
  /** What the sheet says this bar is. */
  label: string;
  /** How many captures, when this reader may have the number. */
  captures: number | null;
  /** Where the celebration was at this minute, when we know. */
  place: string | null;
  /** A minute that has not happened yet. Drawn dashed, for everyone. */
  future: boolean;
  /**
   * Nothing was ever counted here — the road (whose weeks this page has
   * deliberately not aggregated), or a showcase fixture with no captures.
   *
   * ⚠ IT IS NOT THE SAME AS A WITHHELD COUNT, and the sheet must not say it is.
   * "Filling in for the people who were there" is a promise that a number
   * exists behind a gate; on the road there is no number to be behind one, and
   * saying so would be a small lie repeated on every bar of six months.
   */
  unmeasured: boolean;
  /** The written entry this bar belongs to or sits nearest, if any. */
  nearId: string | null;
  nearLabel: string | null;
};

export type DialLabel = { x: number; text: string; kind: 'segment' | 'tick' | 'mark' };

export type StoryClockProps = {
  bars: DialBar[];
  labels: DialLabel[];
  /** Vertical rules between the road, each day, and after. */
  dividers: Array<{ x: number; dashed: boolean }>;
  /** What the readout says before the reader has reached any entry. */
  openingStamp: string;
  openingSuffix: string;
  openingLabel: string;
  /** Said in the sheet when the guests' layer is withheld from this reader. */
  withheldNote: string | null;
};

const BASELINE_Y = 50;
const DIAL_HEIGHT = 58;

/** The label rows above and below the axis, now that the type is at the floor. */
const LABEL_ROW_PX = 16;

export function StoryClock({
  bars,
  labels,
  dividers,
  openingStamp,
  openingSuffix,
  openingLabel,
  withheldNote,
}: StoryClockProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const needleRef = useRef<SVGLineElement | null>(null);
  const [cursor, setCursor] = useState<number>(() => bars.findIndex((b) => b.h != null && b.h > 0));
  const [openBar, setOpenBar] = useState<DialBar | null>(null);
  const [now, setNow] = useState({
    stamp: openingStamp,
    suffix: openingSuffix,
    label: openingLabel,
  });
  const [activeX, setActiveX] = useState<number | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const sheetId = useId();

  /*
    🔑 THE SHIPPED HOOK, NOT A SECOND COPY OF ITS JOB. `useModalA11y` already
    remembers what had focus, moves focus into the dialog, TRAPS Tab so it
    cannot wander out behind the scrim, closes on Escape, and hands focus back
    on close — plus a modal stack so a dialog opened over this one peels off
    first. The first cut of this component hand-rolled the focus-return and the
    Escape key and had no trap at all, which is the exact dead-end the hook was
    written to end; `modal-a11y-adoption.test.ts` caught it.

    ⚠ `lockScroll: false` ON PURPOSE. Every other sheet in the app is a
    decision the reader must finish; this one is a footnote on a page they are
    reading. Freezing a 16,000px story to show one minute's line takes the page
    away to say something small, and the sheet is dismissed by a tap on the
    scrim anyway.
  */
  useModalA11y({
    open: openBar !== null,
    onClose: () => setOpenBar(null),
    containerRef: sheetRef,
    lockScroll: false,
  });

  // ── the reader's position ────────────────────────────────────────────────
  //
  // The needle follows whichever entry the reader has reached. The entries are
  // server-rendered; they carry their own axis position on `data-story-x`, so
  // this never has to know how the spine was laid out.
  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>('[data-story-entry][data-story-x]'),
    );
    if (nodes.length === 0) return;
    let frame = 0;

    const read = () => {
      frame = 0;
      const line = window.innerHeight * 0.38;
      let current: HTMLElement | null = null;
      let f = 0;
      for (const el of nodes) {
        const r = el.getBoundingClientRect();
        if (r.top <= line) {
          current = el;
          f = Math.min(1, Math.max(0, (line - r.top) / Math.max(1, r.height + 140)));
        }
      }
      if (!current) {
        setActiveX(null);
        setNow({ stamp: openingStamp, suffix: openingSuffix, label: openingLabel });
        publishReaderPosition({ entry: null, next: null, progress: 0 });
        return;
      }
      const x = Number(current.dataset.storyX ?? '0');
      const idx = nodes.indexOf(current);
      const next = nodes[idx + 1];
      const nx = next ? Number(next.dataset.storyX ?? String(x)) : DIAL_WIDTH;
      setActiveX(x + (nx - x) * f);
      setNow({
        stamp: current.dataset.storyStamp ?? openingStamp,
        suffix: current.dataset.storySuffix ?? '',
        label: current.dataset.storyLabel ?? openingLabel,
      });
      /*
        🔑 THE SAME FACT, PUBLISHED ONCE. The light on the page and the room in
        the lens need exactly what the needle needs: which entry the reader has
        reached and how far through it they are. Neither can live inside this
        component — one paints the story's wrapper, the other is a sticky aside
        beside the entries — and a second rAF loop reading these same rects
        would give two answers to one question, plus a second layout per frame
        on a page this long. See `lib/story-reader-position.ts`.
      */
      publishReaderPosition({ entry: current, next: next ?? null, progress: f });
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(read);
    };

    /*
      🔴 A BACKGROUNDED TAB LEAVES THE NEEDLE DEAD, AND IT STAYS DEAD.
      `requestAnimationFrame` does not fire while the tab is hidden, so a scroll
      that happens (or is queued) there books a frame that never arrives — and
      because `frame` is only cleared INSIDE `read`, the coalescing guard then
      refuses every later scroll as "one already pending". A reader who switches
      apps mid-story comes back to a needle frozen where they left it and a
      readout naming a minute they scrolled past. Measured, not theorised: this
      was found with the browser pane hidden, where rAF is paused outright.
    */
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      read();
    };

    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('visibilitychange', onVisible);
      // A client-side navigation away and back would otherwise replay the
      // PREVIOUS story's entry to a fresh lens and a fresh light.
      clearReaderPosition();
    };
  }, [openingStamp, openingSuffix, openingLabel]);

  // THE NEEDLE MOVES BY TRANSFORM (review finding). Rewriting `x1`/`x2` on every
  // scroll frame invalidates SVG geometry and forces a synchronous layout; a
  // transform is composited and leaves the DOM alone.
  useEffect(() => {
    const el = needleRef.current;
    if (!el) return;
    if (activeX == null) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    el.style.transform = `translateX(${activeX.toFixed(1)}px)`;
  }, [activeX]);

  // ── entries rise, and a minute's stamp counts up to its time ─────────────
  //
  // THE PAGE IS LEGIBLE AT REST (review finding). Entries do not fade in — they
  // sat at `opacity:.65` until an observer fired, which is dim in a screenshot,
  // dim to a crawler and dim with JS off. Only a small rise, only when the
  // script is running, and not at all when motion is unwelcome.
  useEffect(() => {
    // The offset the entries rise FROM is applied only once this has run — see
    // the `.sn-story[data-story-js]` block in globals.css. With JavaScript off
    // there is no transform at all and the page is simply the page.
    const root = document.querySelector<HTMLElement>('.sn-story');
    if (root) root.dataset.storyJs = 'true';

    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-story-entry]'));
    if (nodes.length === 0) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm) {
      for (const el of nodes) el.dataset.storyIn = 'true';
      return;
    }
    const seen = new WeakSet<HTMLElement>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.dataset.storyIn = 'true';
          const target = Number(el.dataset.storyMinute ?? 'NaN');
          const node = el.querySelector<HTMLElement>('[data-story-countup]');
          if (seen.has(el) || !node || !Number.isFinite(target)) continue;
          seen.add(el);
          const from = target - 38;
          const t0 = performance.now();
          const step = (t: number) => {
            const p = Math.min(1, (t - t0) / 900);
            const ease = 1 - Math.pow(1 - p, 3);
            // The count-up NEVER SHOWS A WRONG TIME: it lands exactly, and the
            // last frame is the truth, not an eased approximation of it.
            node.textContent =
              p >= 1
                ? formatClock(target).t
                : formatClock(Math.round(from + (target - from) * ease)).t;
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    for (const el of nodes) io.observe(el);
    return () => io.disconnect();
  }, []);

  // ── every bar opens ──────────────────────────────────────────────────────
  const open = useCallback((bar: DialBar) => setOpenBar(bar), []);
  const close = useCallback(() => setOpenBar(null), []);

  /**
   * THE WHOLE STRIP IS ONE HIT AREA AND THE NEAREST BIN WINS (review finding).
   * A five-minute bar on a phone is about 1.3 device pixels wide. Asking a
   * thumb to hit it is asking it to fail, and the bars that matter most — the
   * quiet minutes between the written moments — are the thinnest of all.
   */
  const nearestTo = useCallback(
    (clientX: number): DialBar | null => {
      const svg = svgRef.current;
      if (!svg || bars.length === 0) return null;
      const r = svg.getBoundingClientRect();
      if (r.width <= 0) return null;
      const x = ((clientX - r.left) / r.width) * DIAL_WIDTH;
      const i = nearestBarAt(
        bars.map((b) => b.x + b.w / 2),
        x,
      );
      return i < 0 ? null : (bars[i] ?? null);
    },
    [bars],
  );

  const onKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = Math.max(
        0,
        Math.min(bars.length - 1, (cursor < 0 ? 0 : cursor) + (e.key === 'ArrowRight' ? 1 : -1)),
      );
      setCursor(next);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const b = bars[cursor < 0 ? 0 : cursor];
      if (b) open(b);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setCursor(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setCursor(bars.length - 1);
    }
  };

  const cursorBar = cursor >= 0 ? bars[cursor] : undefined;

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-ink/10 bg-cream/95 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 py-2 sm:px-6">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex min-w-0 items-baseline gap-2.5">
              <b className="whitespace-nowrap font-condensed text-2xl font-extrabold leading-none tabular-nums tracking-tight sm:text-3xl">
                {now.stamp}
                {now.suffix ? (
                  <small className="ml-1 text-xs font-bold tracking-wider text-ink/60">
                    {now.suffix}
                  </small>
                ) : null}
              </b>
              <span className="truncate text-[13px] text-ink/75">{now.label}</span>
            </div>
          </div>

          <div
            className="relative mt-1.5 pb-4 pt-4"
            style={{ minHeight: DIAL_HEIGHT + LABEL_ROW_PX * 2 }}
          >
            {/*
              The bars live in a stretched 1000-unit space. Nothing that has to
              stay legible may live in there with them — see the label layer.
            */}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${DIAL_WIDTH} ${DIAL_HEIGHT}`}
              preserveAspectRatio="none"
              tabIndex={0}
              role="application"
              aria-label={
                cursorBar
                  ? `${cursorBar.label} — press Enter to open this moment. Left and right arrows move through the story.`
                  : 'The story as captures over time. Left and right arrows move through it; Enter opens a moment.'
              }
              className="block h-[58px] w-full touch-manipulation overflow-visible focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-700"
              onClick={(e) => {
                const b = nearestTo(e.clientX);
                if (b) open(b);
              }}
              onKeyDown={onKeyDown}
            >
              {bars.map((b, i) => {
                const isCursor = i === cursor;
                const h = b.h ?? 0;
                if (b.h == null) {
                  // A baseline tick — no height at all, not a height of zero, so
                  // nothing downstream can scale it back up into a number.
                  return (
                    <rect
                      key={i}
                      x={b.x.toFixed(2)}
                      y={BASELINE_Y - 1}
                      width={Math.max(0.6, b.w).toFixed(2)}
                      height={1}
                      className={
                        isCursor ? 'fill-terracotta-700' : b.future ? 'fill-ink/15' : 'fill-ink/25'
                      }
                    />
                  );
                }
                return (
                  <rect
                    key={i}
                    x={b.x.toFixed(2)}
                    y={(BASELINE_Y - h).toFixed(2)}
                    width={Math.max(0.6, b.w).toFixed(2)}
                    height={Math.max(0.6, h).toFixed(2)}
                    rx={0.8}
                    className={isCursor ? 'fill-terracotta-700' : 'fill-ink/40'}
                  />
                );
              })}
              {dividers.map((d, i) => (
                <line
                  key={`d${i}`}
                  x1={d.x}
                  x2={d.x}
                  y1={0}
                  y2={52}
                  className="stroke-ink/70"
                  strokeWidth={1}
                  strokeDasharray={d.dashed ? '2 3' : undefined}
                />
              ))}
              <line
                ref={needleRef}
                x1={0}
                x2={0}
                y1={0}
                y2={52}
                className="stroke-terracotta-700"
                strokeWidth={2}
                style={{ display: 'none' }}
              />
              {/* One full-width hit area. See `nearestTo`. */}
              <rect x={0} y={0} width={DIAL_WIDTH} height={DIAL_HEIGHT} fill="transparent" />
            </svg>

            {/*
              LABELS ARE HTML, POSITIONED IN PERCENT (review finding). SVG <text>
              inside `preserveAspectRatio="none"` is scaled by the same non-
              uniform transform as the bars — on a 390px phone that squashed
              every label to about 35% of its width. They sit over the same
              axis, in the same units, and are simply not inside it.
            */}
            {/*
              ⚠ 12px IS THE FLOOR, NOT A PREFERENCE. The prototype sets these at
              9–10px, which is fine on a 1000px-wide desktop dial and illegible
              on the page an actual guest opens — the 2026-06-20 "Lola Remedios"
              audit found small load-bearing text was THE dominant guest-facing
              failure, and `lint-guest-legibility` caught this port doing it
              again. Raised, and the axis adapted to the larger type instead.

              🔑 THE ROAD'S DATE MARKS ARE HIDDEN ON A PHONE, AND NOTHING IS
              LOST BY IT. The road band is 30% of the axis — about 103px at
              375px wide — and five date stamps at a legible size cannot share
              it without overlapping into mush. They come back from `sm:` up.
              Every one of those dates is still REACHABLE below that width: the
              strip is one hit area, and the sheet a tap opens names the entry
              and links to it. A label you cannot read is not information.
            */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-1 -bottom-1">
              {labels.map((l, i) => (
                <span
                  key={i}
                  className={
                    l.kind === 'segment'
                      ? 'absolute bottom-0 whitespace-nowrap font-mono text-xs font-bold uppercase tracking-[0.12em] text-ink/60'
                      : l.kind === 'mark'
                        ? 'absolute top-0 hidden -translate-x-1/2 whitespace-nowrap font-condensed text-xs font-bold tracking-wide text-ink/60 sm:block'
                        : 'absolute top-0 -translate-x-1/2 whitespace-nowrap font-mono text-xs tracking-wide text-ink/60'
                  }
                  style={{ left: percentOf(l.x) }}
                >
                  {l.text}
                </span>
              ))}
            </div>
          </div>

          <p className="mt-0.5 text-center text-xs text-ink/60">
            Tap anywhere on the line to open that moment
          </p>
        </div>
      </div>

      {openBar ? (
        <>
          <div
            aria-hidden
            onClick={close}
            className="fixed inset-0 z-40 bg-ink/45 backdrop-blur-[2px]"
          />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${sheetId}-t`}
            tabIndex={-1}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-ink/15 bg-cream px-5 pb-8 pt-4 shadow-[0_-24px_60px_-30px_rgba(30,34,41,0.55)] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[26rem] sm:rounded-2xl sm:border"
          >
            <div className="flex items-start justify-between gap-4">
              <b
                id={`${sheetId}-t`}
                className="font-condensed text-2xl font-extrabold leading-none tabular-nums"
              >
                {openBar.label}
              </b>
              <button
                type="button"
                onClick={close}
                className="-mr-2 -mt-2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-3 font-mono text-sm uppercase tracking-[0.14em] text-ink/70 hover:text-ink"
              >
                Close
              </button>
            </div>

            <p className="mt-2 text-sm leading-snug text-ink/75">
              {openBar.captures == null
                ? openBar.unmeasured
                  ? 'Nothing was counted at this point in the story — it is here so you can reach the moment beside it.'
                  : (withheldNote ??
                    'What was shot at this minute is filling in for the people who were there. It publishes here with the edition.')
                : openBar.captures === 0
                  ? 'A quiet minute. They happen.'
                  : `${openBar.captures} capture${openBar.captures === 1 ? '' : 's'} were taken at this minute.`}
            </p>

            {openBar.place ? (
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-ink/60">
                {openBar.place}
              </p>
            ) : null}

            {openBar.nearId && openBar.nearLabel ? (
              <a
                href={`#${openBar.nearId}`}
                onClick={close}
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-terracotta-700 underline-offset-4 hover:underline"
              >
                {openBar.nearLabel} →
              </a>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}
