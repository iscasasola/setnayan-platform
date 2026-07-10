import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Store,
  MapPin,
  Star,
  CalendarCheck2,
  Navigation,
  Wallet,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hydrateVendorCards } from '@/lib/vendor-cards';
import { listHostEvents } from '@/lib/vendor-couple-invite';
import { getVendorAvailableDays, formatDayKey } from '@/lib/vendor-availability';
import { tierCaps, asVendorTier } from '@/lib/vendor-tier-caps';
import { haversineKm } from '@/lib/distance';
import { fetchBudgetSnapshot } from '@/lib/budget';
import { getTaxonomy } from '@/lib/taxonomy-db';
import { categoryForTile } from '@/lib/shortlist-taxonomy';
import type { WeddingTile } from '@/lib/taxonomy';
import { formatPhp } from '@/lib/vendors';
import { computeVendorFit, type FitCheck } from '@/lib/vendor-fit-qr';
import { SubmitButton } from '@/app/_components/submit-button';
import { addVendorFromFit } from './actions';

type Props = {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ event?: string; err?: string }>;
};

type MarketRow = {
  vendor_profile_id: string;
  business_name: string | null;
  business_slug: string | null;
  logo_url: string | null;
  location_city: string | null;
  hq_latitude: number | null;
  hq_longitude: number | null;
  avg_rating_overall: number | string | null;
  review_count: number | null;
  services: string[] | null;
};

export default async function VendorFitPage({ params, searchParams }: Props) {
  const { ref } = await params;
  const { event: selectedEventId, err } = await searchParams;

  const admin = createAdminClient();
  const cols =
    'vendor_profile_id, business_name, business_slug, logo_url, location_city, hq_latitude, hq_longitude, avg_rating_overall, review_count, services';

  // Resolve the public ref → a market vendor: business slug first, else public_id.
  let market: MarketRow | null = null;
  {
    const bySlug = await admin
      .from('vendor_market_stats')
      .select(cols)
      .eq('business_slug', ref)
      .maybeSingle();
    market = (bySlug.data as MarketRow | null) ?? null;
    if (!market) {
      const { data: prof } = await admin
        .from('vendor_profiles')
        .select('vendor_profile_id')
        .eq('public_id', ref)
        .maybeSingle();
      if (prof?.vendor_profile_id) {
        const byId = await admin
          .from('vendor_market_stats')
          .select(cols)
          .eq('vendor_profile_id', prof.vendor_profile_id)
          .maybeSingle();
        market = (byId.data as MarketRow | null) ?? null;
      }
    }
  }
  if (!market) notFound();

  const vendorId = market.vendor_profile_id;

  // Display identity (hybrid-anonymity aware), tier, and "starts at" price.
  const [cardMap, profRes, svcRes] = await Promise.all([
    hydrateVendorCards([vendorId]),
    admin.from('vendor_profiles').select('tier_state').eq('vendor_profile_id', vendorId).maybeSingle(),
    admin.from('vendor_services').select('starting_price_php, is_active').eq('vendor_profile_id', vendorId),
  ]);
  const card = cardMap.get(vendorId);
  const displayName = card?.displayName ?? market.business_name ?? 'This vendor';
  const logoUrl = card?.logoUrl ?? market.logo_url ?? null;
  const tierState = (profRes.data as { tier_state: string | null } | null)?.tier_state ?? null;
  const startingPricePhp =
    ((svcRes.data as { starting_price_php: number | null; is_active: boolean | null }[] | null) ?? [])
      .filter((s) => s.is_active !== false && typeof s.starting_price_php === 'number' && s.starting_price_php > 0)
      .map((s) => s.starting_price_php as number)
      .sort((a, b) => a - b)[0] ?? null;
  const rating = market.avg_rating_overall != null ? Number(market.avg_rating_overall) : null;

  // Resolve the vendor's primary VendorCategory (canonical → tile → category) for
  // the shortlist add.
  const tax = await getTaxonomy();
  let category = 'misc';
  for (const c of market.services ?? []) {
    const tile = tax.map[c]?.tile as WeddingTile | undefined;
    if (tile) {
      category = categoryForTile(tile);
      break;
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nextPath = `/vendor/fit/${encodeURIComponent(ref)}`;

  // ── Fit verdict for the selected event (only when signed in + it's the couple's) ──
  const hostEvents = user ? await listHostEvents(supabase, user.id) : [];
  const activeEvent =
    selectedEventId && hostEvents.find((e) => e.event_id === selectedEventId)
      ? hostEvents.find((e) => e.event_id === selectedEventId)!
      : null;

  let verdictChecks: FitCheck[] | null = null;
  let verdictFits = false;
  if (activeEvent) {
    const { data: ev } = await admin
      .from('events')
      .select('event_date, venue_latitude, venue_longitude')
      .eq('event_id', activeEvent.event_id)
      .maybeSingle();
    const eventDate = (ev?.event_date as string | null) ?? null;

    let vendorAvailableOnDate: boolean | null = null;
    if (eventDate) {
      const d = new Date(`${eventDate}T00:00:00`);
      vendorAvailableOnDate = await getVendorAvailableDays(admin, vendorId, d, d)
        .then((days) => days.has(formatDayKey(d)))
        .catch(() => true);
    }

    const evLat = (ev?.venue_latitude as number | null) ?? null;
    const evLng = (ev?.venue_longitude as number | null) ?? null;
    const distanceKm =
      evLat != null && evLng != null && market.hq_latitude != null && market.hq_longitude != null
        ? Math.round(haversineKm(evLat, evLng, market.hq_latitude, market.hq_longitude) * 10) / 10
        : null;
    const radius = tierCaps(asVendorTier(tierState)).serviceRadiusKm;
    const serviceRadiusKm = Number.isFinite(radius) && radius > 0 ? radius : null;

    let remainingBudgetPhp: number | null = null;
    try {
      remainingBudgetPhp = (await fetchBudgetSnapshot(supabase, activeEvent.event_id)).totals.remaining;
    } catch {
      remainingBudgetPhp = null;
    }

    const verdict = computeVendorFit({
      eventDate,
      vendorAvailableOnDate,
      distanceKm,
      serviceRadiusKm,
      startingPricePhp,
      remainingBudgetPhp,
    });
    verdictChecks = verdict.checks;
    verdictFits = verdict.fits;
  }

  const checkIcon = (key: FitCheck['key']) =>
    key === 'date' ? CalendarCheck2 : key === 'reach' ? Navigation : Wallet;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
      {/* Vendor identity */}
      <div className="rounded-3xl border border-ink/10 bg-cream p-6 text-center">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={displayName}
            width={88}
            height={88}
            className="mx-auto h-20 w-20 rounded-2xl object-cover"
          />
        ) : (
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-ink/5">
            <Store className="h-8 w-8 text-ink/40" strokeWidth={1.5} />
          </div>
        )}
        <p className="mt-4 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/45">
          <Sparkles className="h-3 w-3" strokeWidth={2} /> Fit check
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{displayName}</h1>
        <div className="mt-1 flex items-center justify-center gap-3 text-sm text-ink/60">
          {market.location_city ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} /> {market.location_city}
            </span>
          ) : null}
          {rating != null && rating > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-warn-400 text-warn-500" strokeWidth={1.75} />
              {rating.toFixed(1)}
              {market.review_count ? ` (${market.review_count})` : ''}
            </span>
          ) : null}
        </div>
        {startingPricePhp != null ? (
          <p className="mt-2 font-mono text-xs text-ink/70">Starts at {formatPhp(startingPricePhp)}</p>
        ) : null}
      </div>

      {err ? (
        <p role="alert" className="mt-4 rounded-xl border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700">
          Couldn’t add them to that event. Please try again.
        </p>
      ) : null}

      {/* Action zone */}
      <div className="mt-6">
        {!user ? (
          <div className="rounded-2xl border border-ink/10 bg-white/60 p-5 text-center">
            <p className="text-sm text-ink/70">
              Sign in to check whether {displayName} fits your event’s date, venue, and budget — and add them to your shortlist.
            </p>
            <Link
              href={`/signup?as=couple&next=${encodeURIComponent(nextPath)}`}
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink/90"
            >
              Sign up free & check the fit
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(nextPath)}`}
              className="mt-3 inline-block text-sm text-ink/60 underline hover:text-terracotta"
            >
              I already have an account
            </Link>
          </div>
        ) : hostEvents.length === 0 ? (
          <div className="rounded-2xl border border-ink/10 bg-white/60 p-5 text-center">
            <p className="text-sm text-ink/70">Create your event first, then we’ll check the fit.</p>
            <Link
              href={`/dashboard/create-event?next=${encodeURIComponent(nextPath)}`}
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink/90"
            >
              Set up your event
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-ink/10 bg-white/60 p-5">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">
              Check against your event
            </p>
            <div className="flex flex-wrap gap-2">
              {hostEvents.map((e) => {
                const on = activeEvent?.event_id === e.event_id;
                return (
                  <Link
                    key={e.event_id}
                    href={`${nextPath}?event=${encodeURIComponent(e.event_id)}`}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      on ? 'border-transparent bg-ink text-cream' : 'border-ink/15 text-ink/70 hover:bg-ink/5'
                    }`}
                  >
                    {e.display_name ?? 'Your event'}
                  </Link>
                );
              })}
            </div>

            {verdictChecks ? (
              <div className="mt-5">
                <div
                  className={`rounded-xl px-4 py-3 text-sm font-medium ${
                    verdictFits
                      ? 'bg-success-50 text-success-800'
                      : 'bg-warn-100 text-warn-900'
                  }`}
                >
                  {verdictFits
                    ? `${displayName} fits ${activeEvent?.display_name ?? 'your event'}.`
                    : `Worth a look — check the flags below for ${activeEvent?.display_name ?? 'your event'}.`}
                </div>
                <ul className="mt-3 space-y-2">
                  {verdictChecks.map((c) => {
                    const Icon = checkIcon(c.key);
                    const tone =
                      c.ok === true ? 'text-success-700' : c.ok === false ? 'text-warn-800' : 'text-ink/45';
                    return (
                      <li key={c.key} className="flex items-center gap-2 text-sm">
                        <Icon className={`h-4 w-4 ${tone}`} strokeWidth={1.75} />
                        <span className="flex-1 text-ink/75">{c.label}</span>
                        {c.ok === true ? (
                          <Check className="h-4 w-4 text-success-600" strokeWidth={2.25} />
                        ) : c.ok === false ? (
                          <X className="h-4 w-4 text-warn-600" strokeWidth={2.25} />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                <form action={addVendorFromFit} className="mt-5">
                  <input type="hidden" name="event_id" value={activeEvent!.event_id} />
                  <input type="hidden" name="marketplace_vendor_id" value={vendorId} />
                  <input type="hidden" name="category" value={category} />
                  <input type="hidden" name="ref" value={ref} />
                  <SubmitButton className="w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink/90">
                    Add to my shortlist
                  </SubmitButton>
                </form>
                <p className="mt-3 text-center text-[11px] text-ink/45">
                  Flags are a heads-up, not a block — you can always add and decide later.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-ink/55">Pick an event above to see the fit.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
