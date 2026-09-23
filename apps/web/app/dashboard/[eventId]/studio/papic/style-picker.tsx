'use client';

import { Check, Lock } from 'lucide-react';
import {
  PAPIC_STYLES,
  cssPreviewFilter,
  asPapicStyle,
  type PapicStyle,
} from '@/lib/papic-photo-styles';
import { setPapicStyle } from './actions';

/**
 * Papic event-look picker (couple-side setup).
 *
 * The couple picks ONE look here; it becomes the event-wide template baked into
 * every camera's photos (paid seats, free sampler, guest disposables). The
 * shooters never see a picker — this is the single place the look is chosen.
 *
 * Each card carries a CSS-`filter:` swatch over a real photograph so the couple
 * can compare the looks at a glance (the exact pixel pipeline runs on-device at
 * capture; this is a faithful preview of DIRECTION, not of the final render).
 *
 * Self-contained beyond the server action + the (client-safe) style engine, so
 * nothing server-only can leak into the client bundle.
 */

/**
 * THE SWATCH IS A REAL PHOTOGRAPH, NOT A GRADIENT.
 *
 * ⚖ Owner, 2026-09-23: *"papic look should have an actual photo for sample
 * with a lot of colors"* — and he supplied this frame himself.
 *
 * A gradient reacted to each filter, but it could not show what a couple
 * actually buys: `Mono` on a gradient is just a grey ramp, and `Retro`'s matte
 * shadows have nothing to sit in. The frame was chosen for the things the five
 * looks move MOST — two skin tones, a deep red and a green at high saturation,
 * warm practical lamps, and real shadow. Every look reads differently on it.
 *
 * ⚠ 880×254 WebP, 43 KB, cropped to the `h-20` band so `cover` never crops a
 * face out. It is a UI asset and belongs in the bundle — NOT couple media, and
 * nothing here goes near R2.
 */
const SWATCH_IMG = '/papic/look-sample.webp';

export default function StylePicker({
  eventId,
  current,
}: {
  eventId: string;
  current: string;
}) {
  const active: PapicStyle = asPapicStyle(current);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {PAPIC_STYLES.map((s) => {
        const isActive = s.id === active;
        return (
          <form key={s.id} action={setPapicStyle}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="style" value={s.id} />
            <button
              type="submit"
              aria-pressed={isActive}
              aria-label={`Set event look to ${s.label} — ${s.blurb}`}
              className={`group relative w-full overflow-hidden rounded-xl border text-left transition ${
                isActive
                  ? 'border-mulberry ring-2 ring-mulberry/30'
                  : 'border-ink/10 hover:border-ink/25'
              }`}
            >
              {/* Live look preview — the photograph IS the card (owner
                  2026-09-23: *"just leave the Orig, Retro, Mono, Cine, Lomo and
                  fill up the whole rectangle with the photo"*). */}
              <div className="relative h-28 w-full">
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${SWATCH_IMG})`,
                    filter: cssPreviewFilter(s.id),
                  }}
                />
                {/* ⚠ THE NAME SITS OUTSIDE THE FILTERED LAYER, DELIBERATELY. A
                    label nested inside it would be filtered too — `Mono` is
                    `grayscale(1)`, so the one card that most needs a legible
                    name would be the one whose name lost its colour, and
                    `Lomo`'s `saturate(1.5)` would shift it the other way. The
                    scrim is what makes it readable over a photograph; it is
                    not decoration. */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 via-ink/40 to-transparent px-3 pb-2 pt-7">
                  <span className="text-sm font-semibold text-cream">{s.label}</span>
                </div>
              </div>
              {isActive ? (
                <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-mulberry text-cream">
                  <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              ) : null}
            </button>
          </form>
        );
      })}
      <p className="col-span-full mt-1 flex items-center gap-1.5 text-xs text-ink/50">
        <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        This look is applied to every Papic camera at your event — your crew and
        guests can&rsquo;t change it.
      </p>
    </div>
  );
}
