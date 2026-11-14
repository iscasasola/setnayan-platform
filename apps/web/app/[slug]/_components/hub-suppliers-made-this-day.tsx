import { ShopLink } from '@/app/_components/shop-link';
import { ChevronRight, Heart } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { favoriteAction } from '@/app/_actions/favorite-actions';
import type { EventVendorCredit } from '@/lib/event-vendor-credits';
import { GUEST_FAVORITES_SUB, NOT_CHECKED_IN_LINE, favoriteKey, heartClass } from '@/lib/favorites';

/**
 * "Suppliers who made this day" — the Event Hub's block after the day (prototype `favorites-proto` §F). Drawn by
 * `site-body.tsx` only when the event is not solemn, the day is behind us, and the event has booked shops; this
 * component draws the block itself, so `/dev/favorites-lab` can lay out the very same markup on fixtures.
 *
 * ♡ FAVORITES AFTER AN EVENT (owner 2026-11-06). The pitch and the ♡ are for a guest the app can place at the event —
 * a door check-in on their own guest row — or for a visitor with no account yet (the shipped "Account needed"). Anyone
 * else sees the names only, and one line says why. `favorites` is read in page.tsx; the press re-checks on the server.
 */
export function HubSuppliersMadeThisDay({
  credits,
  favorites,
  accountNeeded,
  flash,
  eventId,
  slug,
}: {
  credits: EventVendorCredit[];
  favorites: { door: 'open' | 'closed' | 'unread'; kept: string[] } | null;
  accountNeeded: boolean;
  flash: string | null;
  eventId: string;
  slug: string;
}) {
  return (
    <section
      aria-label="Suppliers who made this day"
      className="rounded-2xl border border-ink/10 bg-cream p-4" // no-card-ok: the shipped block, moved out of site-body.tsx (its baseline line went with it); spacing per prototype §F
      data-hub-favorites={favorites?.door ?? (accountNeeded ? 'account' : 'none')}
    >
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
        Suppliers who made this day
      </p>
      {accountNeeded || favorites?.door === 'open' ? (
        <>
          <h2 className="mb-0.5 mt-1 text-[18px] font-semibold">Loved a supplier? Keep them.</h2>
          <p className="text-[13px] text-ink/70">{GUEST_FAVORITES_SUB}</p>
        </>
      ) : null}
      {flash ? (
        <p className="mt-3 rounded-lg border border-ink/10 bg-cream px-3 py-2 text-sm text-ink/80"> {/* no-card-ok: the shipped save notice, moved out of site-body.tsx (its baseline line went with it) */}
          {flash}
        </p>
      ) : null}
      <ul className="mt-2.5 grid gap-2">
        {credits.map((v) => {
          const kept =
            favorites?.kept.includes(favoriteKey(v.vendorProfileId, v.serviceId)) ||
            favorites?.kept.includes(favoriteKey(v.vendorProfileId, null));
          const line = v.serviceLabel ?? v.categoryLabel;
          return (
            <li
              key={favoriteKey(v.vendorProfileId, v.serviceId)}
              className="flex items-center gap-3 rounded-xl border border-ink/10 bg-cream px-3 py-2.5" // no-card-ok: the shipped supplier row, moved out of site-body.tsx (its baseline line went with it); it holds the shop link and the ♡
            >
              {v.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-sm font-bold text-terracotta-700">
                  {v.displayName.trim().charAt(0).toUpperCase() || 'V'}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-ink">
                  {v.businessSlug ? (
                    <ShopLink href={`/v/${v.businessSlug}`} className="hover:text-terracotta">
                      {v.displayName}
                    </ShopLink>
                  ) : (
                    v.displayName
                  )}
                </p>
                {line ? <p className="truncate text-[13px] text-ink/65">{line}</p> : null}
              </div>
              {accountNeeded ? (
                <span className="shrink-0 text-xs text-ink/70">Account needed</span>
              ) : favorites?.door === 'open' ? (
                kept ? (
                  <span className={heartClass(true)} data-hub-favorite="kept">
                    <Heart aria-hidden className="h-[15px] w-[15px]" strokeWidth={1.75} fill="currentColor" />
                    Favorite
                  </span>
                ) : (
                  <form
                    // op 'guest' always ends in a redirect back to this page (`?save=`), so as a form
                    // action it returns nothing — the cast states that, it adds no behaviour.
                    action={
                      favoriteAction.bind(null, {
                        op: 'guest',
                        eventId,
                        slug,
                        shopId: v.vendorProfileId,
                        serviceId: v.serviceId,
                      }) as unknown as (formData: FormData) => Promise<void>
                    }
                    className="shrink-0"
                  >
                    <SubmitButton className={heartClass(false)} pendingLabel="Saving…">
                      <Heart aria-hidden className="h-[15px] w-[15px]" strokeWidth={1.75} />
                      Favorite
                    </SubmitButton>
                  </form>
                )
              ) : v.businessSlug ? (
                <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/50" strokeWidth={2} />
              ) : null}
            </li>
          );
        })}
      </ul>
      {favorites?.door === 'closed' ? (
        <p className="mt-2 text-[13px] text-ink/70" data-hub-favorites-line="">
          {NOT_CHECKED_IN_LINE}
        </p>
      ) : favorites?.door === 'unread' ? (
        <p className="mt-2 text-[13px] text-ink/70" data-hub-favorites-line="">
          We couldn&rsquo;t check your check-in just now. Refresh in a moment to keep favorites.
        </p>
      ) : null}
    </section>
  );
}
