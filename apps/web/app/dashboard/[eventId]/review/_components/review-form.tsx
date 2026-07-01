'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { submitFeatureReview } from '../actions';

/**
 * Couple review star-form (admin account-access model PR 3). Reached from the
 * admin-requested "we'd love your review" prompt. Submits via the server action
 * which inserts under the couple's own RLS.
 */
export function ReviewForm({ eventId, featureKey }: { eventId: string; featureKey: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  return (
    <form action={submitFeatureReview} className="space-y-4">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="feature_key" value={featureKey} />
      <input type="hidden" name="rating" value={rating} />

      <div className="flex justify-center gap-1.5" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            type="button"
            key={s}
            aria-label={`${s} star${s > 1 ? 's' : ''}`}
            aria-pressed={rating === s}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => setHover(s)}
            onBlur={() => setHover(0)}
            onClick={() => setRating(s)}
            className="rounded-md p-1 transition-transform hover:scale-110"
          >
            <Star
              aria-hidden
              className={`h-9 w-9 ${(hover || rating) >= s ? 'fill-gold text-gold' : 'text-ink/25'}`}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>

      <textarea
        name="body"
        rows={4}
        maxLength={4000}
        placeholder="What's it been like for your planning? (optional)"
        className="w-full rounded-xl border border-ink/15 bg-paper p-3 text-sm text-ink placeholder:text-ink/40 focus:border-ink/30 focus:outline-none"
      />

      <button
        type="submit"
        disabled={rating === 0}
        className="inline-flex w-full items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Share my review
      </button>
    </form>
  );
}
