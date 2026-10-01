/**
 * Find a supplier (owner-approved 2026-10-01 — DECISION_LOG "SUPPLIER INBOX +
 * FIND-A-SUPPLIER DESIGN — APPROVED, WITH BOTH RECOMMENDATIONS";
 * `prototypes/supplier_inbox_and_find_2026-10-01_fable.html` frames 4–7).
 *
 * This route used to be "Bring more categories on-stage": every WEDDING plan
 * group the couple had not picked, whatever the event type, each Add picking a
 * supplier and sending it an inquiry. It is now the ONE Find a supplier door the
 * Suppliers page opens:
 *
 *   one search · "Popular for <type>" (a wake: "What families usually need") ·
 *   the host's groups (Venue & food · Look & style · Photos & video · Music &
 *   program · Paperwork) · "Booked ✓" on a category already booked ·
 *   a category (`?c=<tile>`) → its suppliers with ONE Filter ▾ + Save to bench /
 *   Ask for a quote.
 *
 * 🔑 WHICH categories show is NOT decided on this page. It is the bench's own
 * scope (`buildShortlistFolders` with no vendor rows — `applicable_event_types`
 * from Admin › Event type › Scope categories, `marketplace_hidden`, faith), so
 * Find a supplier and the bench can never disagree about what a birthday books.
 * `lib/supplier-find.ts` only regroups it. Server component: nothing here ships
 * to the shared bundle; the Filter ▾ and Save are one small client file.
 */

import { Suspense } from 'react';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Search, Star } from 'lucide-react';

import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { resolveProfileByEvent } from '@/lib/event-type-profile';
import { getTaxonomy } from '@/lib/taxonomy-db';
import { buildCoupleFaithSet } from '@/lib/taxonomy-filters';
import {
  buildShortlistFolders,
  LOCKED_VENDOR_STATUSES,
  tileForCategory,
} from '@/lib/shortlist-taxonomy';
import { TAXONOMY_MAP } from '@/lib/taxonomy';
import type { VendorCategory } from '@/lib/vendors';
import {
  fetchVendorCountsByService,
  rollUpCountsToTile,
} from '@/lib/vendor-counts';
import { benchSearchScopeForTile } from '@/lib/bench-category-search';
import { formatPhpRounded } from '@/lib/php';
import { formatCount } from '@/lib/format-number';
import { PageMasthead } from '@/app/_components/page-masthead';
import {
  applyFindFilter,
  buildFindList,
  parseFindFilter,
  popularHeading,
  supplierCountLabel,
  type FindCategory,
} from '@/lib/supplier-find';
import { searchCategoryVendors } from '../_actions/category-search';
import { ContactShortlistVendorButton } from '../_components/contact-shortlist-vendor-button';
import { FindFilterMenu, SaveToBenchButton } from './_components/find-supplier-controls';

export const metadata = { title: 'Find a supplier' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ q?: string; c?: string; f?: string }>;
};

/** tile → the words of every service under it, so the one search finds
 *  "tent" inside Chairs & tents. Built once per process from the code map. */
const SERVICES_BY_TILE: ReadonlyMap<string, readonly string[]> = (() => {
  const out = new Map<string, string[]>();
  for (const [service, entry] of Object.entries(TAXONOMY_MAP)) {
    if (!entry.tile) continue;
    const words = service.replace(/_/g, ' ');
    const arr = out.get(entry.tile);
    if (arr) arr.push(words);
    else out.set(entry.tile, [words]);
  }
  return out;
})();

export default async function FindSupplierPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  // Membership gate — events RLS restricts the read to members.
  const { data: ev, error: evError } = await supabase
    .from('events')
    .select('event_id, event_type, ceremony_type, secondary_ceremony_type')
    .eq('event_id', eventId)
    .maybeSingle();
  // A refused read is not "no such event": it must not render a wedding's list
  // for a birthday (the type defaults to wedding below) — fail to the boundary.
  if (evError) {
    logQueryError('FindSupplierPage.event', evError, { event_id: eventId }, 'will_throw');
    throw new Error("Couldn't load this event");
  }
  if (!ev) notFound();
  const eventType = (ev.event_type as string | null) ?? 'wedding';

  const [profile, taxonomy] = await Promise.all([
    resolveProfileByEvent(eventId),
    getTaxonomy(),
  ]);
  const solemn = profile.terminology.register === 'solemn';

  // The bench's own scope — the ONLY place the category list comes from.
  const folders = buildShortlistFolders({
    vendorRows: [],
    eventType,
    faithSet: buildCoupleFaithSet({
      eventType,
      ceremonyType: (ev.ceremony_type as string | null) ?? null,
      secondaryCeremonyType: (ev.secondary_ceremony_type as string | null) ?? null,
    }),
    taxonomy,
    eventId,
  });

  // Booked = a committed supplier in that category. ⚠ A refused read is NOT
  // "nothing booked": `booked` stays null, no row says "Booked ✓", and the
  // page says once that it could not check.
  const { data: bookedRows, error: bookedError } = await supabase
    .from('event_vendors')
    .select('category')
    .eq('event_id', eventId)
    .is('archived_at', null)
    .in('status', [...LOCKED_VENDOR_STATUSES]);
  if (bookedError) {
    logQueryError('FindSupplierPage.booked', bookedError, { event_id: eventId }, 'graceful_degrade');
  }
  const bookedMeasured = !bookedError && bookedRows !== null;
  const booked: Set<string> | null = bookedMeasured ? new Set<string>() : null;
  for (const r of (bookedRows ?? []) as Array<{ category: string | null }>) {
    const tile = r.category ? tileForCategory(r.category as VendorCategory) : null;
    if (tile) booked?.add(tile);
  }

  // Supplier counts — a soft signal; unknown (null) when the read fails.
  let counts: Map<string, number> | null = null;
  try {
    const perTile = rollUpCountsToTile(await fetchVendorCountsByService(createAdminClient()));
    counts = new Map([...perTile].map(([t, c]) => [t as string, c.total]));
  } catch {
    counts = null;
  }

  const q = (sp.q ?? '').trim().slice(0, 80);
  const list = buildFindList({
    folders,
    eventType,
    solemn,
    booked,
    counts,
    query: sp.c ? '' : q,
    servicesByTile: SERVICES_BY_TILE,
  });
  const byTile = new Map<string, FindCategory>();
  for (const g of list.groups) for (const c of g.categories) byTile.set(c.tile, c);

  const base = `/dashboard/${eventId}/vendors/categories`;
  const backToSuppliers = (
    <Link
      href={`/dashboard/${eventId}/vendors`}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink/55 transition hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Suppliers
    </Link>
  );

  // ── A category → its suppliers (frame 7) ──────────────────────────────────
  const openTile = sp.c ? byTile.get(sp.c) : undefined;
  if (sp.c && !openTile) {
    // Out of this event's scope (or not a category at all): back to the list.
    redirect(base);
  }
  if (openTile) {
    const picked = parseFindFilter(sp.f);
    const res = await searchCategoryVendors({
      eventId,
      ...benchSearchScopeForTile(openTile.tile),
      query: q || undefined,
    });
    const rows = applyFindFilter(res.results, picked);
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-5">
        <PageMasthead title={openTile.label} />
        <Link
          href={base}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink/55 transition hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Find a supplier
        </Link>
        <header className="mb-4 mt-3">
          <p className="text-[12px] font-medium uppercase tracking-wide text-ink/50">
            {openTile.booked ? 'Booked ✓' : 'Find a supplier'}
          </p>
          <h2 className="mt-1 font-serif text-3xl text-ink">{openTile.label}</h2>
        </header>

        <form method="get" action={base} className="flex items-center gap-2" role="search">
          <input type="hidden" name="c" value={openTile.tile} />
          {sp.f ? <input type="hidden" name="f" value={sp.f} /> : null}
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-ink/15 bg-paper px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-ink/45" aria-hidden />
            <input
              name="q"
              defaultValue={q}
              placeholder={`Search in ${openTile.label}`}
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink/40"
            />
          </label>
          <Suspense fallback={null}>
            <FindFilterMenu />
          </Suspense>
        </form>

        <p className="mt-3 text-[13px] text-ink/55">
          {rows.length === 1 ? '1 supplier' : `${formatCount(rows.length)} suppliers`}
          {res.hasReceptionCoords ? ' · nearest first' : ''}
        </p>

        {rows.length === 0 ? (
          <p className="mt-6 text-[15px] text-ink/65">
            {picked.length > 0
              ? 'No supplier matches this filter. Try fewer.'
              : 'No supplier lists this yet. Check back soon.'}
          </p>
        ) : (
          <ul className="mt-2">
            {rows.map((r) => {
              const isBooked = r.relationshipDepth === 3;
              const initials = r.name
                .split(/\s+/)
                .map((w) => w[0] ?? '')
                .join('')
                .slice(0, 2)
                .toUpperCase();
              return (
                <li key={r.vendorProfileId} className="border-t border-ink/10 py-3">
                  <div className="flex items-start gap-3">
                    {r.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.logoUrl}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink/5 text-[13px] font-semibold text-ink/70"
                      >
                        {initials}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-ink">{r.name}</p>
                      <p className="text-[13px] text-ink/60">
                        {[r.city, r.startsAtPhp != null ? `from ${formatPhpRounded(r.startsAtPhp)}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {r.rating != null ? (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] text-ink/60">
                          <Star className="h-3 w-3" aria-hidden />
                          {r.rating.toFixed(1)}
                          {r.reviewCount ? ` · ${formatCount(r.reviewCount)}` : ''}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 pl-14">
                    {isBooked ? (
                      <>
                        <span className="text-[12.5px] font-semibold text-ink/60">Booked</span>
                        <Link
                          href={`/dashboard/${eventId}/messages`}
                          className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-mulberry"
                        >
                          Open chat
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      </>
                    ) : (
                      <>
                        <SaveToBenchButton
                          eventId={eventId}
                          vendorProfileId={r.vendorProfileId}
                          tile={openTile.tile}
                          initiallySaved={r.alreadyAdded}
                        />
                        <ContactShortlistVendorButton
                          eventId={eventId}
                          vendorProfileId={r.vendorProfileId}
                          label="Ask for a quote"
                          wrapperClassName=""
                          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-mulberry/30 bg-mulberry/5 px-3 py-2 text-[12.5px] font-semibold text-mulberry transition-colors hover:bg-mulberry/10 disabled:opacity-60"
                        />
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  // ── The category list (frames 4–6) ────────────────────────────────────────
  const row = (c: FindCategory) => {
    const sub = c.booked ? 'Booked ✓' : supplierCountLabel(c.supplierCount);
    return (
      <li key={c.tile} className="border-t border-ink/10">
        <Link
          href={`${base}?c=${encodeURIComponent(c.tile)}`}
          className="flex items-center gap-3 py-3"
          data-find-tile={c.tile}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium text-ink">{c.label}</span>
            {sub ? <span className="block text-[12.5px] text-ink/55">{sub}</span> : null}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink/35" aria-hidden />
        </Link>
      </li>
    );
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-5">
      <PageMasthead title="Find a supplier" />
      {backToSuppliers}
      <header className="mb-4 mt-3">
        <h2 className="font-serif text-3xl text-ink">Find a supplier</h2>
        <p className="mt-1 text-[15px] text-ink/65">Only what your event needs.</p>
      </header>

      {!profile.marketplaceEnabled ? (
        <p className="text-[15px] text-ink/65">
          Suppliers aren&rsquo;t listed for this kind of event yet.
        </p>
      ) : (
        <>
          <form method="get" action={base} role="search">
            <label className="flex items-center gap-2 rounded-md border border-ink/15 bg-paper px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-ink/45" aria-hidden />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search suppliers or a service"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink/40"
              />
            </label>
          </form>

          {!bookedMeasured ? (
            <p role="alert" className="mt-3 text-[13px] text-ink/60">
              We couldn&rsquo;t check what you&rsquo;ve booked — reload in a moment.
            </p>
          ) : null}

          {list.total === 0 ? (
            <p className="mt-6 text-[15px] text-ink/65">
              {q ? `Nothing matches “${q}”.` : 'No categories for this event yet.'}
            </p>
          ) : null}

          {list.popular.length > 0 ? (
            <section className="mt-6" aria-label={popularHeading(eventType, solemn)}>
              <h3 className="text-[12px] font-medium uppercase tracking-wide text-ink/50">
                {popularHeading(eventType, solemn)}
              </h3>
              <ul className="mt-1">{list.popular.map(row)}</ul>
            </section>
          ) : null}

          {list.groups.map((g) => (
            <section key={g.id} className="mt-6" aria-label={g.label} data-find-group={g.id}>
              <h3 className="flex items-baseline justify-between text-[12px] font-medium uppercase tracking-wide text-ink/50">
                <span>{g.label}</span>
                {g.bookedCount ? (
                  <span className="normal-case tracking-normal">{formatCount(g.bookedCount)} booked</span>
                ) : null}
              </h3>
              <ul className="mt-1">{g.categories.map(row)}</ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
