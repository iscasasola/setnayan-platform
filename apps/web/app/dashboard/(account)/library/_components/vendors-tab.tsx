import Link from 'next/link';
import { Compass } from 'lucide-react';
import { fetchSavedVendors, SAVED_VENDORS_UNREADABLE } from '../_data/saved-vendors';
import { fetchAttendedSavedVendors } from '../_data/attended-vendors';
import { SavedVendorCardItem } from './saved-vendor-card';
import { FavoriteRows } from './favorite-rows';
import { FAVORITES_EMPTY, FAVORITES_GROUP, SHORTLIST_GROUP } from '@/lib/favorites';

/**
 * Library · Saved Vendors tab. Two groups (prototype `favorites-proto` §G):
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
      <div className="rounded-2xl border border-dashed border-ink/15 p-10 text-center">
        <p className="text-sm text-ink/60">
          We couldn&rsquo;t load your saved suppliers right now. Refresh in a moment.
        </p>
      </div>
    );
  }

  if (own.length === 0 && attended.length === 0 && !favoritesUnreadable) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/15 p-10 text-center">
        <p className="text-sm text-ink/60">No saved suppliers yet.</p>
        <Link
          href="/?browse=1"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-terracotta-700 px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-terracotta-800"
        >
          <Compass aria-hidden className="h-4 w-4" strokeWidth={2} />
          Explore the marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {ownUnreadable ? (
        <p className="text-sm text-ink/60">
          We couldn&rsquo;t load the suppliers saved in your own plans right now.
        </p>
      ) : null}
      {own.length > 0 ? (
        <section className="space-y-2">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/50">{SHORTLIST_GROUP}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {own.map((v) => (
              <SavedVendorCardItem key={v.vendorProfileId} vendor={v} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-2" data-library-favorites-group="">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/50">{FAVORITES_GROUP}</h3>
        {favoritesUnreadable ? (
          <p className="text-[13px] text-ink/70">We couldn&rsquo;t load your favorites right now. Refresh in a moment.</p>
        ) : attended.length > 0 ? (
          <FavoriteRows rows={attended} />
        ) : (
          <p className="text-[13px] text-ink/70">{FAVORITES_EMPTY}</p>
        )}
      </section>
    </div>
  );
}
