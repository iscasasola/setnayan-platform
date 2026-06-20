import Link from 'next/link';
import { getSampleEvent, getSampleEventId } from '../_lib/sample-event';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchWizardVendorRecommendations,
  type WizardVendorRec,
} from '@/lib/wizard-recommendations';
import { computeCompatScore, explainCompatScore } from '@/lib/compat-score';
import { isSetnayanAiActive } from '@/lib/setnayan-ai';
import { TourShortlist, type TourCategory, type TourVendor } from './_components/tour-shortlist';
import { TourChatThread } from '../_components/tour-chat-thread';

/**
 * /tour/vendors — Stop 2 of the public Maria & Jose tour: "The AI did the hard part."
 *
 * SERVER component (RSC). It resolves the pinned sample event id through the ONE
 * trust boundary (getSampleEventId), never from params/searchParams, and reads
 * everything through the service-role admin client (SELECTs only). It imports NO
 * server actions — the ESLint `no-restricted-imports` guard on app/tour/** enforces
 * that — and never writes.
 *
 * What it shows:
 *   1. The ranked vendor shortlist, grouped by category, via
 *      fetchWizardVendorRecommendations. We pin it to the sample event with a
 *      SYNTHETIC `planning_mode: 'guided'` so `isSetnayanAiActive` reads TRUE and the
 *      %-match pills are computed. We pass `excludeVendorIds: []` so the is_demo
 *      sample vendors stay IN (the real dashboard path excludes them).
 *   2. A scripted vendor chat (client-only, no server).
 *
 * Per-vendor %-match is computed HERE (server-side, via computeCompatScore) and
 * handed to the client as a plain number, so the client toggle only re-sorts /
 * strips the already-loaded list in local state.
 *
 * The resolved `eventId` (from the trust boundary) is passed to the fetcher as
 * `matchEventId` — the ONLY id the matcher ever sees, and a verified read-only
 * path (preference + song reads are pure SELECTs and are no-ops on the sample
 * event, which has no song picks / no preferences). This keeps the resolved
 * boundary id load-bearing rather than a dead binding.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'The vendors · A real wedding on Setnayan',
  description:
    'See how Setnayan AI shortlists a wedding team that fits — ranked by distance, reviews, and verification. No sign-up, nothing saved.',
  alternates: { canonical: '/tour/vendors' },
};

/** Friendly category groups for the tour. Each maps to the canonical_services the
 *  matcher scopes on (same value space as VENDOR_PICK_TASK_CANONICAL_SERVICES). */
const TOUR_CATEGORIES: Array<{
  id: string;
  label: string;
  blurb: string;
  canonicalServices: string[];
}> = [
  {
    id: 'venue',
    label: 'Reception venue',
    blurb: 'Where the celebration happens — ranked closest-fit first.',
    canonicalServices: ['venue'],
  },
  {
    id: 'photo',
    label: 'Photo & video',
    blurb: 'The team that captures the day, start to finish.',
    canonicalServices: ['photographer', 'videographer'],
  },
  {
    id: 'catering',
    label: 'Catering',
    blurb: 'Feeding every guest, from cocktail hour to the last dance.',
    canonicalServices: ['catering'],
  },
  {
    id: 'beauty',
    label: 'Hair & makeup',
    blurb: 'The glam team for the couple and the entourage.',
    canonicalServices: ['makeup_artist', 'hair_stylist'],
  },
  {
    id: 'music',
    label: 'Music & entertainment',
    blurb: 'Bands, DJs, and emcees to set the mood.',
    canonicalServices: ['band_dj', 'host_emcee', 'string_quartet'],
  },
  {
    id: 'styling',
    label: 'Styling & florals',
    blurb: 'Décor, flowers, and the look that ties it all together.',
    canonicalServices: ['reception_decor', 'florist'],
  },
];

const PER_CATEGORY_LIMIT = 8;

/** A representative package price for the tile, derived display-safe. The matcher
 *  doesn't return a price, so we surface "Price on inquiry" unless a future field
 *  appears — keeps the tour honest (no fabricated money). */
function toTourVendor(rec: WizardVendorRec, baseRank: number, aiActive: boolean): TourVendor {
  const verified = rec.verification_state === 'verified';
  const rating =
    typeof rec.avg_rating_overall === 'number' && rec.avg_rating_overall > 0
      ? rec.avg_rating_overall
      : null;
  const reviewCount =
    typeof rec.review_count === 'number' && rec.review_count > 0 ? rec.review_count : null;

  // Per-candidate compatibility % (Architecture §2 · GATE+SCORE), computed exactly
  // like the dashboard card: distance is unknown on the tour (we don't pass venue
  // coords), so the scorer's admit-unknown baseline drives it via reviews +
  // verification. Only surfaced when AI is active.
  const compatInputs = {
    distanceKm: null,
    avgRating: rating,
    reviewCount,
    verified,
  };
  const match = aiActive ? computeCompatScore(compatInputs) : null;
  const why = match ? explainCompatScore(compatInputs) : [];

  return {
    key: rec.business_slug || rec.vendor_profile_id,
    name: rec.business_name,
    city: rec.location_city ?? null,
    photoUrl: rec.primary_photo_url ?? rec.logo_url ?? null,
    rating,
    reviewCount,
    pricePhp: null,
    isVerified: verified,
    isSetnayan: false,
    matchScore: match?.score ?? null,
    matchTier: match?.tier ?? null,
    matchWhy: why,
    baseRank,
  };
}

export default async function TourVendorsPage() {
  const ev = await getSampleEvent();
  // The ONLY way the event is resolved — the cached trust boundary, never a
  // client-supplied id. Passed to the matcher below as `matchEventId`.
  const eventId = await getSampleEventId();
  const admin = createAdminClient();

  // Synthetic 'guided' event so the governing gate reads TRUE and the %-match pills
  // are computed (the real path reads events.planning_mode; the tour forces guided).
  const aiActive = isSetnayanAiActive({ planning_mode: 'guided', setnayan_ai_active: true });

  // Fetch every category's ranked shortlist in parallel. KEEP the is_demo sample
  // vendors in (excludeVendorIds: []). Scope only to the wedding event type — the
  // sample event carries no ceremony/venue/region, so those dimensions admit-all.
  // `matchEventId` pins the (read-only) preference/song re-rank to the sample
  // event — a no-op here since it has no song picks or preferences.
  const results = await Promise.all(
    TOUR_CATEGORIES.map((cat) =>
      fetchWizardVendorRecommendations(admin, {
        canonicalServices: cat.canonicalServices,
        ceremonyType: null,
        venueSetting: null,
        eventType: ev.event_type ?? 'wedding',
        matchEventId: eventId,
        excludeVendorIds: [],
        limit: PER_CATEGORY_LIMIT,
      }),
    ),
  );

  const categories: TourCategory[] = TOUR_CATEGORIES.map((cat, i) => ({
    id: cat.id,
    label: cat.label,
    blurb: cat.blurb,
    vendors: results[i]!.map((rec, idx) => toTourVendor(rec, idx, aiActive)),
  }));

  const vendorCount = categories.reduce((n, c) => n + c.vendors.length, 0);

  // Chat counterparty label — a real (demo) vendor business_name, pinned to is_demo
  // so we never surface a real vendor's identity. Display-safe field only.
  const { data: counterparty } = await admin
    .from('vendor_profiles')
    .select('business_name')
    .eq('is_demo', true)
    .in('public_visibility', ['verified', 'coming_soon'])
    .not('business_name', 'is', null)
    .order('business_name', { ascending: true })
    .limit(1)
    .maybeSingle();
  const vendorLabel =
    (counterparty as { business_name?: string | null } | null)?.business_name ??
    'Liwanag Studios';

  const bride = ev.bride_name ?? 'Maria';
  const groom = ev.groom_name ?? 'Jose';

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-20 pt-12 sm:pt-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#8C6932]">
          Tour · Stop 02
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-tight tracking-tight text-[#1E2229] sm:text-5xl">
          The AI did the hard part
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-[#5F5E5A] sm:text-lg">
          {bride} & {groom} didn&rsquo;t scroll through hundreds of suppliers. Setnayan AI
          shortlisted a team that fits the wedding — ranked by distance, reviews, and
          verification. Flip the switch to see how it sorts.
        </p>
      </header>

      <section className="mt-12">
        <TourShortlist categories={categories} vendorCount={vendorCount} />
      </section>

      {/* Scripted chat — what reaching out to a shortlisted vendor feels like */}
      <section className="mx-auto mt-16 max-w-2xl">
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#8C6932]">
            Then you say hello
          </p>
          <h2 className="mt-2 font-serif text-3xl text-[#1E2229]">
            One tap, and you&rsquo;re talking
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-base text-[#5F5E5A]">
            Message any vendor right inside Setnayan. Here&rsquo;s a sample conversation with{' '}
            <span className="font-medium text-[#1E2229]">{vendorLabel}</span> — try it. Nothing
            you type is saved.
          </p>
        </div>
        <div className="mt-6 rounded-2xl border border-[#C5A059]/40 bg-[#FBF8F1] p-4 sm:p-6">
          <TourChatThread counterpartyLabel={vendorLabel} />
        </div>
      </section>

      <nav className="mx-auto mt-16 flex max-w-2xl items-center justify-between gap-4">
        <Link
          href="/maria-and-jose"
          className="inline-flex min-h-[44px] items-center text-sm font-medium text-[#5C2542] transition-opacity hover:opacity-80"
        >
          &larr; The invitation
        </Link>
        <Link
          href="/tour"
          className="inline-flex min-h-[44px] items-center font-mono text-xs uppercase tracking-wider text-[#9A8F86] transition-opacity hover:opacity-80"
        >
          All stops
        </Link>
      </nav>

      <section className="mx-auto mt-12 max-w-2xl rounded-3xl border border-[#C5A059]/40 bg-[#FBF6EA] px-6 py-10 text-center">
        <h2 className="font-serif text-2xl text-[#1E2229] sm:text-3xl">Find your team next.</h2>
        <p className="mx-auto mt-3 max-w-lg text-base text-[#5F5E5A]">
          Start your own wedding on Setnayan and let the AI shortlist for you — free, in minutes.
          Set na &rsquo;yan.
        </p>
        <Link
          href="/onboarding/wedding?from=tour"
          className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#5C2542] px-7 py-3 text-sm font-semibold text-[#FBFBFA] transition-opacity hover:opacity-90"
        >
          Start planning &middot; free
        </Link>
      </section>
    </main>
  );
}
