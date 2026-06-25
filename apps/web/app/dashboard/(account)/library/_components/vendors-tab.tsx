import Link from 'next/link';
import { Compass } from 'lucide-react';
import { fetchSavedVendors } from '../_data/saved-vendors';
import { fetchAttendedSavedVendors } from '../_data/attended-vendors';
import { SavedVendorCardItem } from './saved-vendor-card';

/**
 * Library · Saved Vendors tab. Two sources:
 *   1. vendors SAVED into the user's OWN event plans (`event_vendors`, deduped
 *      cross-event) — the canonical "saved" surface, rendered as the rich card.
 *   2. vendors the user bookmarked at events they ATTENDED as a guest
 *      (`guest_saved_vendors`, Invite/Join v2) — the growth loop: a guest who
 *      loved a vendor at a wedding finds them here when planning their own.
 *
 * `userId` is unused — both reads are RLS-scoped to the authenticated session.
 */
export async function VendorsTab({ userId }: { userId: string }) {
  void userId;
  const [own, attended] = await Promise.all([
    fetchSavedVendors(),
    fetchAttendedSavedVendors(),
  ]);

  if (own.length === 0 && attended.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/15 p-10 text-center">
        <p className="text-sm text-ink/60">No saved vendors yet.</p>
        <Link
          href="/explore"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-terracotta px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-terracotta/90"
        >
          <Compass aria-hidden className="h-4 w-4" strokeWidth={2} />
          Explore the marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {own.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {own.map((v) => (
            <SavedVendorCardItem key={v.vendorProfileId} vendor={v} />
          ))}
        </div>
      ) : null}

      {attended.length > 0 ? (
        <section className="space-y-3">
          <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50">
            From weddings you attended
          </h3>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {attended.map((v) => (
              <li
                key={v.vendorProfileId}
                className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white p-3"
              >
                {v.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.logoUrl}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-sm font-semibold text-terracotta">
                    {v.displayName.trim().charAt(0).toUpperCase() || 'V'}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {v.businessSlug ? (
                      <Link href={`/v/${v.businessSlug}`} className="hover:text-terracotta">
                        {v.displayName}
                      </Link>
                    ) : (
                      v.displayName
                    )}
                  </p>
                  {v.categoryLabel ? (
                    <p className="truncate text-sm text-ink/60">{v.categoryLabel}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
