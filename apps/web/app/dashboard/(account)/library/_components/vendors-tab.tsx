import { Compass } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { EmptyState } from '@/app/_components/states/empty-state';
import { fetchSavedVendors, SAVED_VENDORS_UNREADABLE } from '../_data/saved-vendors';
import { fetchAttendedSavedVendors } from '../_data/attended-vendors';
import { SavedVendorCardItem } from './saved-vendor-card';
import { FavoriteRows } from './favorite-rows';
import { FAVORITES_EMPTY, FAVORITES_GROUP, SHORTLIST_GROUP } from '@/lib/favorites';

/**
 * Library · Saved suppliers tab. Two groups (prototype `favorites-proto` §G):
 *   1. SHORTLISTED FOR YOUR EVENTS — vendors SAVED into the user's OWN event
 *      plans (`event_vendors`, deduped cross-event), rendered as the rich card.
 *   2. FAVORITES (`guest_saved_vendors`, owner 2026-11-06 "Favorites after an
 *      event") — services the person experienced at an event they hosted or
 *      attended, each saying where it came from. Tap opens the shop at that
 *      service; swipe left removes, with Undo.
 *
 * `userId` is unused — both reads are RLS-scoped to the authenticated session.
 */
export async function VendorsTab({ userId }: { userId: string }) {
  void userId;
  const [ownRead, favoritesRead] = await Promise.all([
    fetchSavedVendors(),
    fetchAttendedSavedVendors(),
  ]);
  // A refused read is not "none saved": say we could not look, never the
  // empty state below (S41, reads-are-honest).
  const ownUnreadable = ownRead === SAVED_VENDORS_UNREADABLE;
  const own = ownUnreadable ? [] : ownRead;
  // …and a refused favorites read is said in its own group — never "No favorites yet".
  const favoritesUnreadable = favoritesRead === null;
  const attended = favoritesRead ?? [];

  if (ownUnreadable && attended.length === 0) {
    return (
      <p role="status" className="text-sm text-[rgb(var(--color-warn))]">
        We couldn&rsquo;t load your saved suppliers right now — not the same as none. Refresh in a moment.
      </p>
    );
  }

  if (own.length === 0 && attended.length === 0 && !favoritesUnreadable) {
    return (
      <EmptyState
        Icon={Compass}
        title="No saved suppliers yet."
        blurb="Save a supplier from the marketplace and it lands here."
        readPermitted
        action={<ActionButton tone="brand" main icon={<Compass aria-hidden />} label="Explore the marketplace" href="/?browse=1" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      {ownUnreadable ? (
        <p role="status" className="text-sm text-[rgb(var(--color-warn))]">
          We couldn&rsquo;t load the suppliers saved in your own plans right now — not the same as none.
        </p>
      ) : null}
      {own.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">{SHORTLIST_GROUP}</h3>
          <ul className="divide-y divide-ink/10">
            {own.map((v) => (
              <SavedVendorCardItem key={v.vendorProfileId} vendor={v} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2" data-library-favorites-group="">
        <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">{FAVORITES_GROUP}</h3>
        {favoritesUnreadable ? (
          <p role="status" className="text-sm text-[rgb(var(--color-warn))]">We couldn&rsquo;t load your favorites right now — not the same as none. Refresh in a moment.</p>
        ) : attended.length > 0 ? (
          <FavoriteRows rows={attended} />
        ) : (
          <p className="text-sm text-ink/70">{FAVORITES_EMPTY}</p>
        )}
      </section>
    </div>
  );
}
