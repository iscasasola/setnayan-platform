'use client';

/**
 * favorite-heart.tsx — THE HOST'S ♡ (owner 2026-11-06, "Favorites after an event"; prototype §D the review page, §E
 * the Booked row). One pill, two words sets:
 *   · `words="favorite"` (the Booked row)   — "Favorite", filled when kept;
 *   · `words="add"`      (the review page)  — "Add to favorites" → "In your favorites".
 *
 * The press answers at once and takes itself back, in words, when the server refuses (`favoriteAction` re-checks:
 * a host of this event, the day behind us, the service booked on it). Pressing a kept heart removes the favorite.
 * Drawn only where the server already decided the person may favorite — this is never the gate.
 */
import { useState, useTransition } from 'react';
import { Heart } from 'lucide-react';
import { favoriteAction } from '@/app/_actions/favorite-actions';
import { heartClass } from '@/lib/favorites';

export function FavoriteHeart({
  eventId,
  shopId,
  serviceId,
  name,
  initiallyOn,
  words = 'favorite',
}: {
  eventId: string;
  shopId: string;
  serviceId: string | null;
  /** Who, for the button's name — "Add Bloom & Co. to your favorites". */
  name: string;
  initiallyOn: boolean;
  words?: 'favorite' | 'add';
}) {
  const [on, setOn] = useState(initiallyOn);
  const [said, setSaid] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const press = () => {
    const next = !on;
    setOn(next);
    setSaid(null);
    start(async () => {
      try {
        const res = next
          ? await favoriteAction({ op: 'host', eventId, shopId, serviceId })
          : await favoriteAction({ op: 'remove', shopId, serviceId });
        if (!res.ok) {
          setOn(!next);
          setSaid(res.error);
        }
      } catch {
        setOn(!next);
        setSaid('That did not save. Nothing changed.');
      }
    });
  };

  const label = words === 'add' ? (on ? 'In your favorites' : 'Add to favorites') : 'Favorite';
  return (
    <span className="inline-flex flex-col items-start gap-1" data-favorite-heart={on ? 'on' : 'off'}>
      <button
        type="button"
        className={heartClass(on)}
        aria-pressed={on}
        aria-label={on ? `${name} is in your favorites` : `Add ${name} to your favorites`}
        disabled={busy}
        onClick={press}
      >
        <Heart aria-hidden className="h-[15px] w-[15px]" strokeWidth={1.75} fill={on ? 'currentColor' : 'none'} />
        {label}
      </button>
      {said ? (
        <span role="status" className="text-[12px] text-[rgb(var(--color-danger))]">
          {said}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The review page's "Add <shop> to your favorites" block (prototype §D) — one card, the heart inside. Drawn by
 * `vendors/[vendorId]/review/page.tsx` only when `offerHostFavorites` offers this booking; `/dev/favorites-lab` lays out
 * the same component on fixtures.
 */
export function FavoriteAddCard({
  from,
  ...heart
}: {
  /** "From your wedding · 12 Dec 2026". */
  from: string;
  eventId: string;
  shopId: string;
  serviceId: string | null;
  name: string;
  initiallyOn: boolean;
}) {
  return (
    // House rule (lint:no-card, owner 2026-10-11 "frames only on what you press"): a box that is not pressed takes a
    // fill and a shadow, not a border — so the prototype's bordered card is a raised block; the heart is the frame.
    <div className="rounded-2xl bg-raised p-4 shadow-sm" data-review-favorite="">
      <p className="font-bold text-ink">Add {heart.name} to your favorites</p>
      <p className="mb-2.5 mt-0.5 text-[13px] text-ink/70">{from}</p>
      <FavoriteHeart {...heart} words="add" />
    </div>
  );
}
