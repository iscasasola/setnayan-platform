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
