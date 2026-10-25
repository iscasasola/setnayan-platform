'use client';

import { Check, Lock } from 'lucide-react';
import {
  PAPIC_STYLES,
  asPapicStyle,
  type PapicStyle,
} from '@/lib/papic-photo-styles';
import { papicLookSampleSrc } from '@/lib/papic-look-samples';
import { setPapicStyle } from './actions';

/**
 * Papic event-look picker (couple-side setup).
 *
 * The couple picks ONE look here; it becomes the event-wide template baked into
 * every camera's photos (paid seats, free sampler, guest disposables). The
 * shooters never see a picker — this is the single place the look is chosen.
 *
 * 📷 EACH TILE IS OUR SAMPLE PHOTOGRAPH, DEVELOPED THROUGH THAT LOOK — not a gradient
 * (owner 2026-10-25: *"the filters should have a sample photo. which should be our
 * photo. we already have a photo already used for this before"*). The photo is the
 * frame the owner supplied for this on 2026-09-23; each tile is pre-rendered with the
 * camera's own pixel pipeline (`pnpm render:papic-looks`, `lib/papic-look-samples.ts`),
 * so a couple sees what the camera will really produce, not a CSS approximation.
 * The name sits OUTSIDE the picture, so Mono never greys its own label.
 *
 * Self-contained beyond the server action + the (client-safe) style engine, so
 * nothing server-only can leak into the client bundle.
 */

export default function StylePicker({
  eventId,
  current,
  returnTo = null,
  variant = 'cards',
}: {
  eventId: string;
  current: string;
  /** 🏠 'home' when drawn in Home's Papic card — the save lands back on Home (`return_to`). */
  returnTo?: 'home' | null;
  /**
   * 'strip' — the approved one-page controller's Filter A (`prototypes/papic_controller_one_page_2026-10-23.html`,
   * "a look is chosen by eye: five thumbnails … fit across 375 in one thumb-width row, all visible, one tap saves"):
   * the same five forms and the same action, drawn as one row of swatches with the name under each; the blurb rides
   * the button's accessible name. 'cards' — the 2×3 cards, as before.
   */
  variant?: 'cards' | 'strip';
}) {
  const active: PapicStyle = asPapicStyle(current);
  if (variant === 'strip') {
    return (
      <div className="grid grid-cols-5 gap-2" data-papic-filter-strip="">
        {PAPIC_STYLES.map((s) => {
          const isActive = s.id === active;
          const label = s.label === 'Orig' ? 'Original' : s.label;
          const ring = isActive ? 'border-mulberry ring-2 ring-mulberry/30' : 'border-ink/10';
          const swatch = `relative block aspect-square w-full overflow-hidden rounded-lg border ${ring}`; // no-card-ok: the face of the look's own submit button
          return (
            <form key={s.id} action={setPapicStyle} className="min-w-0">
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="style" value={s.id} />
              {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
              <button type="submit" aria-pressed={isActive} aria-label={`Set event look to ${s.label} — ${s.blurb}`} className="block w-full min-w-0 text-center">
                <span className={swatch}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a committed 240 px still (public/papic/looks), versioned by `v` */}
                  <img src={papicLookSampleSrc(s.id)} alt={label} width={240} height={240} loading="lazy" decoding="async" data-papic-look-sample={s.id} className="absolute inset-0 h-full w-full object-cover" />
                  {isActive ? (
                    <span className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-mulberry text-cream">
                      <Check aria-hidden className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                  ) : null}
                </span>
                <span className={`mt-1 block truncate text-[12px] ${isActive ? 'font-semibold text-mulberry' : 'text-ink/65'}`}>{label}</span>
              </button>
            </form>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {PAPIC_STYLES.map((s) => {
        const isActive = s.id === active;
        return (
          <form key={s.id} action={setPapicStyle}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="style" value={s.id} />
            {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
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
              {/* The look, on our sample photograph — the camera's own render */}
              {/* eslint-disable-next-line @next/next/no-img-element -- a committed 240 px still (public/papic/looks), versioned by `v` */}
              <img
                src={papicLookSampleSrc(s.id)}
                alt={s.label === 'Orig' ? 'Original' : s.label}
                width={240}
                height={240}
                loading="lazy"
                decoding="async"
                data-papic-look-sample={s.id}
                className="block h-20 w-full object-cover"
              />
              {isActive ? (
                <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-mulberry text-cream">
                  <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              ) : null}
              <div className="p-2.5">
                <div className="text-sm font-medium text-ink">{s.label}</div>
                <div className="text-xs leading-snug text-ink/55">{s.blurb}</div>
              </div>
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
