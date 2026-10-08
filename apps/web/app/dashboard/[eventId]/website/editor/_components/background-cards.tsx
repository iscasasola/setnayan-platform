'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Loader2, Play, Upload } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { STUDIO_ROW } from '@/lib/studio-skin';
import { loopCardDrawsVideo } from '@/lib/background-source';
import {
  BACKGROUND_PICK_FAILED,
  BACKGROUND_PICK_LINE,
  BACKGROUND_PICK_QUIET_MS,
  backgroundCardLooks,
  type BackgroundPick,
  type BackgroundPickStep,
} from '@/lib/background-pick';

/**
 * 🖼 STUDIO › LOOK › BACKGROUND — THE PICTURE CARDS AND THEIR ROWS (owner 2026-10-08,
 * the Look restudy; prototype `background_restudy_2026-10-08_fable.html` `.cards`
 * / `.cd` / `.r`). Presentation only: what a tap DOES is the main background
 * panel's (`main-background-panel.tsx` — the same saves the dropdown rows made).
 *
 * 🔑 NEVER A BROKEN IMAGE. A card's picture is drawn over a CSS fallback in the
 * choice's own colours — a pattern in the page's ink, a loop's two sampled
 * colours, a scene's still over paper — so a picture that never arrives shows
 * a coloured card, never the browser's broken glyph (owner, studio round 3).
 */

/** One row: its name (and what it is, behind ⓘ) on the left, its ONE control on the right. */
export function BgRow({ label, info, data, children }: { label: string; info?: ReactNode; data: string; children: ReactNode }) {
  return (
    <div data-bg-row={data} className={`${STUDIO_ROW} justify-between`}>
      <span className="flex shrink-0 items-center text-[14px] text-ink">
        {info ? (
          <InfoTip label={label} align="start">
            {info}
          </InfoTip>
        ) : (
          label
        )}
      </span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-2">{children}</span>
    </div>
  );
}

/**
 * ⚡ The pick on its way (`lib/background-pick.ts`) and the strip's ear for a tap — handed to every card of the strip,
 * so a card is ringed and marked FROM THE TAP without each one being told (owner 2026-10-08: *"when i press … we
 * want to know something is pressed"*).
 */
const BgStrip = createContext<{ pick: BackgroundPick | null; onTap?: (data: string) => void }>({ pick: null });

/** The sideways strip of cards for the source on screen. */
export function BgCards({
  label,
  source,
  pick = null,
  onTap,
  children,
}: {
  label: string;
  source: string;
  /** The pick on its way: its card wears the ring and the progress mark until the canvas shows it. */
  pick?: BackgroundPick | null;
  /** Told WHICH card was tapped (`data-bg-card`), before that card's own `onPick` runs. */
  onTap?: (data: string) => void;
  children: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      data-bg-cards={source}
      className="-mx-4 flex snap-x snap-mandatory scroll-px-4 items-start gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <BgStrip.Provider value={{ pick, ...(onTap ? { onTap } : {}) }}>{children}</BgStrip.Provider>
    </div>
  );
}

/**
 * ⚡ THE ONE LINE THAT SAYS WHAT A PICK IS WAITING FOR — the owner's words, in order: "Loading files…" while the
 * still and loop are fetched, "Applying to your Hub…" while the draft write is in flight; gone when the canvas shows
 * it. Polite (`aria-live`), in the flow of the panel — never a toast, never a layer over the cards.
 *   · NOT FLASHED: a step shorter than `quietMs` (~300 ms) is never said;
 *   · A FAILURE IS SAID AT ONCE, in place, with Try again — and never looks like a wait or a success.
 * The live region is always there (empty at rest), so its words are announced the moment they arrive.
 */
export function BgPickLine({
  step,
  error,
  onRetry,
  quietMs = BACKGROUND_PICK_QUIET_MS,
}: {
  step: BackgroundPickStep | 'failed' | null;
  /** The words of a failure (`step === 'failed'`). */
  error: string | null;
  onRetry: (() => void) | null;
  quietMs?: number;
}) {
  /** The step being waited on — null at rest and on a failure. */
  const now: BackgroundPickStep | null = step === 'loading' || step === 'applying' ? step : null;
  /* What is SAID: a step only once IT has lasted longer than a blink — so a pick that lands at once says nothing, and
     a second tap never flashes "Loading files…" for the few milliseconds its still takes. One one-shot timeout; it
     asks nothing. While a new step waits out its blink, the words already up stay (never a blank between two steps). */
  const [said, setSaid] = useState<BackgroundPickStep | null>(quietMs <= 0 ? now : null);
  useEffect(() => {
    if (!now) return setSaid(null);
    if (quietMs <= 0) return setSaid(now);
    const t = window.setTimeout(() => setSaid(now), quietMs);
    return () => window.clearTimeout(t);
  }, [now, quietMs]);
  if (step === 'failed') {
    return (
      <p role="alert" data-bg-pick-line="failed" className="flex min-h-[18px] flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-terracotta-700">
        <span>{error || BACKGROUND_PICK_FAILED}</span>
        {onRetry ? (
          <button type="button" data-bg-pick-retry="" onClick={onRetry} className="sn-press shrink-0 font-semibold underline underline-offset-2">
            Try again
          </button>
        ) : null}
      </p>
    );
  }
  const words = now ? said : null;
  return (
    <p role="status" aria-live="polite" data-bg-pick-line={words ?? ''} className="flex min-h-[18px] items-center gap-1.5 text-[12px] text-ink/70">
      {words ? <Loader2 aria-hidden className="h-3 w-3 shrink-0 animate-spin motion-reduce:animate-none" strokeWidth={2.25} /> : null}
      {words ? BACKGROUND_PICK_LINE[words] : null}
    </p>
  );
}

/**
 * One picture card: the picture (its fallback `swatch` under whatever `children`
 * lay over it) and the name under it; the one on the page is ringed. A ◆ rides
 * the name of a Pro choice (never a padlock — tried free, named at Apply).
 *
 * 📱 PHONE-SHAPED (owner 2026-10-08: *"we are on mobile view, so show in mobile
 * view, not like a header that is short and wide or at least square or 4:3 or
 * 3:4"*). The picture wears the Maker's ONE picture-card frame, `.sn-phone-card`
 * (`globals.css`): 3 : 4 portrait, a fixed width (`--phone-card-w`), never
 * growing into a wide panel — the STRIP scrolls. Nothing here sizes the picture:
 * no width, height, aspect or flex class may sit beside the frame's.
 * The card is exactly as wide as its picture (`w-min`), so a long name is cut
 * with … and its ◆ stays.
 *
 * ⚡ RINGED FROM THE TAP (`backgroundCardLooks`): the strip's pick on its way decides the ring and the small progress
 * mark — before the save answers. Never disabled meanwhile: a second tap must be able to win.
 */
export function BgCard({
  name,
  on,
  onPick,
  data,
  swatch,
  swatchSize,
  pro = false,
  disabled = false,
  moving = false,
  dim = false,
  note,
  children,
}: {
  /** 🎨 A choice that cannot be taken as things stand (Plain, while there are two colours): drawn faint, still tappable — the tap says why. */
  dim?: boolean;
  /** A few quiet words after the name ("one colour"). */
  note?: string;
  name: string;
  on: boolean;
  onPick: () => void;
  /** `data-bg-card="<data>"`. */
  data: string;
  /** The CSS fallback — a colour, a gradient, a pattern. Drawn under the picture, always. */
  swatch: string;
  swatchSize?: string;
  pro?: boolean;
  disabled?: boolean;
  /** A small ▶ in the corner — the choice moves (a video, a clip). */
  moving?: boolean;
  children?: ReactNode;
}) {
  const strip = useContext(BgStrip);
  const looks = backgroundCardLooks(data, on, strip.pick);
  return (
    <button
      type="button"
      aria-pressed={looks.on}
      {...(looks.busy ? { 'aria-busy': true } : {})}
      disabled={disabled}
      data-bg-card={data}
      {...(dim ? { 'data-bg-card-dim': '' } : {})}
      onClick={() => {
        if (looks.on) return;
        strip.onTap?.(data);
        onPick();
      }}
      className={`sn-press flex w-min flex-none snap-start flex-col gap-1.5 text-left disabled:opacity-50 data-[bg-card-dim]:[&>[data-bg-card-picture]]:opacity-45 ${looks.on ? 'text-mulberry' : 'text-ink/70'}`}
    >
      <span
        data-bg-card-picture=""
        /* NO FRAME (owner 2026-10-08: "no framing") — the picture fills the card edge to edge; the PICKED card wears a
           3-px ring in the selector's terracotta, hugging the picture ("Selected Card needs to be highlighted with same
           terracota"), and its name turns terracotta too. */
        className={`sn-phone-card ${looks.on ? 'ring-[3px] ring-mulberry' : ''}`.trim()}
        style={{ background: swatch, ...(swatchSize ? { backgroundSize: swatchSize } : {}) }}
      >
        {children}
        {looks.busy ? (
          <span data-bg-card-busy="" aria-hidden className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/85 text-ink">
            <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" strokeWidth={2.25} />
          </span>
        ) : null}
        {moving ? (
          <span aria-hidden className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/85 text-ink">
            <Play className="h-3 w-3" fill="currentColor" strokeWidth={0} />
          </span>
        ) : null}
      </span>
      {/* `w-0 min-w-full`: the name never widens the card — the picture's fixed width is the card's. */}
      <span data-bg-card-name="" className={`flex min-h-[18px] w-0 min-w-full items-center justify-center gap-1 text-center text-[12px] ${looks.on ? 'font-semibold' : 'font-medium'}`}>
        <span className="truncate">{name}</span>
        {note ? <small className="shrink-0 text-[11px] font-normal text-ink/50">· {note}</small> : null}
        {pro ? (
          <span aria-label="Event Hub Pro" className="shrink-0 text-[10px] text-ink/45">
            ◆
          </span>
        ) : null}
      </span>
    </button>
  );
}

/** The Upload card's picture — an arrow over paper stripes (the prototype's `.up`). */
export function UploadPicture() {
  return (
    <span aria-hidden className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[12px] font-bold text-terracotta-700">
      <Upload className="h-[22px] w-[22px]" strokeWidth={2.2} />
      Upload
    </span>
  );
}

/** Does this guest's (here: the couple's) device ask for less motion? Read after mount — the server draws the still. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const read = () => setReduced(mq.matches);
    read();
    mq.addEventListener('change', read);
    return () => mq.removeEventListener('change', read);
  }, []);
  return reduced;
}

/**
 * 🎞 A THEME VIDEO, PLAYING IN ITS CARD (restudy § 6 row 2): the loop itself,
 * muted, over its poster, over the loop's own two sampled colours.
 *
 *   · `preload="metadata"` — a card that is never scrolled to costs a few
 *     kilobytes, not a film;
 *   · it PLAYS ONLY WHILE ON SCREEN (`IntersectionObserver`, most of the card
 *     in view) and pauses the moment it leaves — at most the three or four
 *     cards a phone shows are ever decoding;
 *   · under "reduce motion" there is NO `<video>` at all: the poster is the card;
 *   · a loop that cannot load or play removes itself — the poster (or, failing
 *     that, the colours) stays. Never a broken glyph, never a black box.
 *
 * `children` is the poster layer (the panel's `StillOverSwatch`).
 */
export function LoopPicture({ src, children }: { src: string | null; children?: ReactNode }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [moving, setMoving] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const shown = loopCardDrawsVideo({ src, reducedMotion: reduced, failed });
  useEffect(() => {
    const video = ref.current;
    if (!shown || !video || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            /* A refused play (Low Power Mode, a data saver) leaves the poster — it is not an error to say. */
            void video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(video);
    return () => {
      io.disconnect();
      video.pause();
    };
  }, [shown, src]);
  return (
    <>
      {children}
      {shown && src ? (
        <video
          ref={ref}
          data-bg-loop-video=""
          src={src}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
          tabIndex={-1}
          disablePictureInPicture
          onPlaying={() => setMoving(true)}
          onPause={() => setMoving(false)}
          onError={() => setFailed(true)}
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${moving ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : null}
    </>
  );
}
