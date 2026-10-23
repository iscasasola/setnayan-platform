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
 * Each card carries a CSS-`filter:` swatch over a representative portrait-ish
 * gradient so the couple can compare the looks at a glance (the exact pixel
 * pipeline runs on-device at capture; this is a faithful preview of direction).
 *
 * Self-contained beyond the server action + the (client-safe) style engine, so
 * nothing server-only can leak into the client bundle.
 */

/** A warm skin-tone → sky gradient that reacts believably to each look. */
const SWATCH_BG =
  'linear-gradient(135deg, #f4c9a8 0%, #e0976b 38%, #8a5a7a 70%, #2b3a55 100%)';

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
          const ring = isActive ? 'border-mulberry ring-2 ring-mulberry/30' : 'border-ink/10';
          const swatch = `relative block aspect-square w-full overflow-hidden rounded-lg border ${ring}`; // no-card-ok: the face of the look's own submit button
          return (
            <form key={s.id} action={setPapicStyle} className="min-w-0">
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="style" value={s.id} />
              {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
              <button type="submit" aria-pressed={isActive} aria-label={`Set event look to ${s.label} — ${s.blurb}`} className="block w-full min-w-0 text-center">
                <span className={swatch}>
                  <span aria-hidden className="absolute inset-0" style={{ background: SWATCH_BG, filter: cssPreviewFilter(s.id) }} />
                  {isActive ? (
                    <span className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-mulberry text-cream">
                      <Check aria-hidden className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                  ) : null}
                </span>
                <span className={`mt-1 block truncate text-[12px] ${isActive ? 'font-semibold text-mulberry' : 'text-ink/65'}`}>{s.label}</span>
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
              {/* Live look preview */}
              <div
                className="h-20 w-full"
                style={{ background: SWATCH_BG, filter: cssPreviewFilter(s.id) }}
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
