'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Play, Upload } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { STUDIO_ROW } from '@/lib/studio-skin';
import { loopCardDrawsVideo } from '@/lib/background-source';

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

/** The sideways strip of cards for the source on screen. */
export function BgCards({ label, source, children }: { label: string; source: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      data-bg-cards={source}
      className="-mx-4 flex snap-x snap-mandatory scroll-px-4 items-start gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {children}
    </div>
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
  children,
}: {
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
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      data-bg-card={data}
      onClick={() => !on && onPick()}
      className={`sn-press flex w-min flex-none snap-start flex-col gap-1.5 text-left disabled:opacity-50 ${on ? 'text-ink' : 'text-ink/70'}`}
    >
      <span
        data-bg-card-picture=""
        className={`sn-phone-card ${on ? 'ring-2 ring-terracotta-700' : 'ring-1 ring-ink/10'}`}
        style={{ background: swatch, ...(swatchSize ? { backgroundSize: swatchSize } : {}) }}
      >
        {children}
        {moving ? (
          <span aria-hidden className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/85 text-ink">
            <Play className="h-3 w-3" fill="currentColor" strokeWidth={0} />
          </span>
        ) : null}
      </span>
      {/* `w-0 min-w-full`: the name never widens the card — the picture's fixed width is the card's. */}
      <span data-bg-card-name="" className={`flex min-h-[18px] w-0 min-w-full items-center justify-center gap-1 text-center text-[12px] ${on ? 'font-semibold' : 'font-medium'}`}>
        <span className="truncate">{name}</span>
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
