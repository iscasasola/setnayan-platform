/**
 * /dev/favorites-lab — FAVORITES AFTER AN EVENT (owner 2026-11-06) on fixtures, for the side-by-side with the
 * prototype (`favorites-proto` §A · §D · §F · §G). Dev only — 404s in production (first statement). No sign-in, no
 * database: every press calls the shipped action, which refuses with no session; nothing is written.
 *
 *   ?part=hub&door=open    §F — the Hub's "Suppliers who made this day", checked in at the door (Casa Luna kept)
 *   ?part=hub&door=closed  §F — …not checked in: names only + the one line
 *   ?part=review           §D — the review page's "Add <shop> to your favorites" card (both heart states)
 *   ?part=library          §G — Library › Suppliers › Favorites: the rows, swipe left to remove (Undo)
 *   ?part=save             §A — Explore's Save with two upcoming events: "Save to…" (press it for the list)
 *
 * The Booked rows' ♡ (§E) is the Suppliers lab: `/dev/suppliers-lab?mode=booked&favorites=1`.
 */
import { notFound } from 'next/navigation';
import { HubSuppliersMadeThisDay } from '@/app/[slug]/_components/hub-suppliers-made-this-day';
import { FavoriteAddCard } from '@/app/_components/favorite-heart';
import { FavoriteRows } from '@/app/dashboard/(account)/library/_components/favorite-rows';
import { SaveVendorButton } from '@/app/(shell)/explore/_components/save-vendor-button';
import type { FavoriteListRow } from '@/app/dashboard/(account)/library/_data/attended-vendors';
import type { EventVendorCredit } from '@/lib/event-vendor-credits';
import {
  FAVORITES_GROUP,
  SHORTLIST_GROUP,
  favoriteKey,
  favoriteSourceDetail,
  favoriteSourceLine,
} from '@/lib/favorites';

const EVENT = 'S89E-LABFAVORITE';

const CREDITS: EventVendorCredit[] = [
  { vendorProfileId: 'p-bloom', displayName: 'Bloom & Co.', businessSlug: 'bloom-and-co', logoUrl: null, categoryLabel: 'Florist', serviceId: null, serviceLabel: null },
  { vendorProfileId: 'p-casa', displayName: 'Casa Luna Catering', businessSlug: 'casa-luna', logoUrl: null, categoryLabel: 'Caterer', serviceId: null, serviceLabel: null },
];

const HOST = { role: 'host' as const, hostsName: 'Ana & Miguel', eventWord: 'wedding', eventDate: '2026-12-12', moreEvents: 0 };
const GUEST = { role: 'guest' as const, hostsName: 'Maria & Jose', eventWord: 'wedding', eventDate: '2026-03-01', moreEvents: 0 };
const LOLA = { role: 'host' as const, hostsName: 'Lola’s 80th', eventWord: 'birthday', eventDate: '2026-03-14', moreEvents: 0 };

const ROWS: FavoriteListRow[] = [
  { shopId: 'p-bloom', serviceId: null, name: 'Bloom & Co.', logoUrl: null, line: 'Florist', from: favoriteSourceLine(HOST), detail: favoriteSourceDetail(HOST), href: '/v/bloom-and-co' },
  { shopId: 'p-casa', serviceId: null, name: 'Casa Luna Catering', logoUrl: null, line: 'Caterer', from: favoriteSourceLine(GUEST), detail: favoriteSourceDetail(GUEST), href: '/v/casa-luna' },
  { shopId: 'p-lumen', serviceId: null, name: 'Lumen Lights', logoUrl: null, line: 'Lights & sound', from: favoriteSourceLine(LOLA), detail: favoriteSourceDetail(LOLA), href: '/v/lumen-lights' },
];

export default async function FavoritesLabPage({
  searchParams,
}: {
  searchParams: Promise<{ part?: string; door?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { part = 'hub', door = 'open' } = await searchParams;

  let body: React.ReactNode = null;
  if (part === 'hub') {
    body = (
      <HubSuppliersMadeThisDay
        credits={CREDITS}
        favorites={{ door: door === 'closed' ? 'closed' : 'open', kept: [favoriteKey('p-casa', null)] }}
        accountNeeded={false}
        flash={null}
        eventId={EVENT}
        slug="ana-and-miguel"
      />
    );
  } else if (part === 'review') {
    body = (
      <div className="grid gap-3">
        <FavoriteAddCard from="From your wedding · 12 Dec 2026" eventId={EVENT} shopId="p-bloom" serviceId={null} name="Bloom & Co." initiallyOn={false} />
        <FavoriteAddCard from="From your wedding · 12 Dec 2026" eventId={EVENT} shopId="p-casa" serviceId={null} name="Casa Luna Catering" initiallyOn />
      </div>
    );
  } else if (part === 'library') {
    body = (
      <div className="space-y-4">
        {/* The two group headings, as `vendors-tab.tsx` draws them (the shortlist cards under the first are shipped and
            unchanged — they need the database, so the lab shows the heading only). */}
        <section className="space-y-2">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/50">{SHORTLIST_GROUP}</h3>
        </section>
        <section className="space-y-2" data-library-favorites-group="">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/50">{FAVORITES_GROUP}</h3>
          <FavoriteRows rows={ROWS} />
        </section>
      </div>
    );
  } else if (part === 'save') {
    body = (
      <div>
        <p className="text-xl font-bold text-ink">Bloom &amp; Co.</p>
        <p className="mb-3 text-sm text-ink/70">Florist · Makati</p>
        <SaveVendorButton
          vendorProfileId="p-bloom"
          initiallySaved={false}
          variant="profile"
          events={[
            { eventId: 'e-wedding', title: 'Ana & Miguel’s wedding', kindWord: 'wedding', dateISO: '2026-12-12' },
            { eventId: 'e-lola', title: 'Lola’s 80th', kindWord: 'birthday', dateISO: null },
          ]}
        />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-cream px-4 py-6 text-ink" data-favorites-lab={part}>
      <div className="mx-auto max-w-md">{body}</div>
    </main>
  );
}
