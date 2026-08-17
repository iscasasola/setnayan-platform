import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Heart } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  VENDOR_CATEGORIES,
  displayServiceLabel,
  type VendorCategory,
} from '@/lib/vendors';
import { resolveClaimContextForService } from '@/lib/vendor-invite-actions';
import { ServiceWizard } from '../../_components/service-wizard';
import { CanvasMaker } from '../../_components/canvas-maker';
import {
  fetchVendorCoverages,
  getCoverageTaxonomy,
  resolveCoverageLabels,
} from '@/lib/vendor-coverages';
import { canvasMakerEnabled } from '@/lib/canvas-maker-flag';
import { getEventTypeVocab } from '@/lib/event-types-db';
import { FAITH_REGISTRY } from '@/lib/faith-registry';

export const metadata = { title: 'Add a service' };

const CATEGORY_SET = new Set<string>(VENDOR_CATEGORIES);

/**
 * /vendor-dashboard/services/new/[category] — the guided "create a service"
 * flow (vendor Services builder redesign, owner 2026-06-20). Replaces the
 * inline ?add=<category> form. The category is chosen on the Services page
 * (left-rail picker) and is fixed for this flow; the wizard ends in ONE atomic
 * save (commitVendorService → save_vendor_service RPC).
 */
export default async function NewServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ claim?: string }>;
}) {
  const { category } = await params;
  const { claim } = await searchParams;
  if (!CATEGORY_SET.has(category)) notFound();
  const cat = category as VendorCategory;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // PR-C — claim context. When the vendor arrived here from a couple's claim
  // QR (?claim=<token>), resolve the claim so we can (a) show the "set up your
  // service for {couple}" banner and (b) thread the token through the wizard
  // so commitVendorService registers the new service to the couple's plan.
  // Only honor the banner/registration when the claim genuinely resolves to
  // THIS user + THIS profile and isn't already registered — a stale/foreign
  // token degrades to a plain "add a service" flow (never crashes).
  const claimToken =
    typeof claim === 'string' && claim.length > 0 ? claim : null;
  const claimContext = claimToken
    ? await resolveClaimContextForService(claimToken)
    : null;
  const showClaimBanner =
    !!claimContext &&
    !claimContext.alreadyRegistered &&
    claimContext.claimedByUserId === user.id &&
    claimContext.claimedVendorProfileId === profile.vendor_profile_id &&
    // Category-match guard — the banner + threaded claim_token only apply when
    // THIS [category] route matches the category the couple invited the vendor
    // for. A vendor who hand-navigates to /services/new/<other-category>?claim=
    // <token> gets a plain "add a service" flow (no banner, no registration),
    // mirroring the same guard the cross-actor write enforces server-side.
    claimContext.serviceCategory === category;

  // The vendor's OTHER offered categories → the "comes with" link options.
  const { data: ownRows } = await supabase
    .from('vendor_services')
    .select('category')
    .eq('vendor_profile_id', profile.vendor_profile_id);
  const otherCategories = Array.from(
    new Set(
      ((ownRows ?? []) as { category: string }[])
        .map((r) => r.category)
        .filter((c) => c !== cat),
    ),
  ).map((c) => ({ value: c, label: displayServiceLabel(c as VendorCategory) }));

  // The vendor's coverages → the "assign this card to a coverage" picker.
  const [vendorCoverages, coverageLabels] = await Promise.all([
    fetchVendorCoverages(supabase, profile.vendor_profile_id).catch(() => []),
    resolveCoverageLabels().catch(() => null),
  ]);
  const coverageOptions = vendorCoverages.map((c) => ({
    id: c.id,
    label: coverageLabels
      ? coverageLabels.pathLabel(c.canonical_service)
      : c.canonical_service,
  }));

  // ── Zero-step canvas maker (NEXT_PUBLIC_CANVAS_MAKER_ENABLED, ships dark) ──
  // Flag OFF ⇒ nothing below runs and <ServiceWizard> renders exactly as it does
  // today, down to the queries this page makes. The audience vocab is only
  // fetched for the canvas, which is the only surface that shows it.
  const canvas = canvasMakerEnabled();
  const eventTypeOptions = canvas
    ? (await getEventTypeVocab().catch(() => [])).map((e) => ({
        key: e.key,
        label: e.label,
      }))
    : [];
  const faithOptions = canvas
    ? FAITH_REGISTRY.map((f) => ({ key: f.faithCol, label: f.label }))
    : [];
  // coverage id → its CURRENT event_types / faiths, so the audience chips open
  // showing what the vendor already serves rather than an empty slate.
  const coverageAudience: Record<number, { eventTypes: string[]; faiths: string[] }> = {};
  // coverage id → the leaf's allowed event types from the live taxonomy, so the
  // audience chips render only what the server will keep on save. Fail-soft: a
  // failed tree read leaves every id unmapped → null → full vocab (pre-fix
  // behaviour), never a false restriction.
  const coverageAllowed: Record<number, string[] | null> = {};
  if (canvas) {
    const tree = await getCoverageTaxonomy().catch(() => []);
    const allowedByLeaf = new Map<string, string[] | null>();
    for (const p of tree)
      for (const b of p.branches)
        for (const l of b.leaves) allowedByLeaf.set(l.canonicalService, l.allowedEventTypes);
    for (const c of vendorCoverages) {
      coverageAudience[c.id] = {
        eventTypes: c.event_types ?? [],
        faiths: c.faiths ?? [],
      };
      coverageAllowed[c.id] = allowedByLeaf.get(c.canonical_service) ?? null;
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href="/vendor-dashboard/services"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Services
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Add a service</h1>
      <p className="mb-6 mt-1 text-sm text-ink/60">
        {canvas
          ? 'This is your card — the one couples will see. Tap any part of it to edit. Everything saves together.'
          : 'A few quick answers — three to publish, the rest optional. Everything saves together at the end.'}
      </p>
      {showClaimBanner && claimContext ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-terracotta/25 bg-terracotta/5 px-4 py-3">
          <Heart
            aria-hidden
            className="mt-0.5 h-5 w-5 shrink-0 text-terracotta"
            strokeWidth={1.75}
          />
          <p className="text-sm text-ink/80">
            Set up your service for{' '}
            <span className="font-semibold text-ink">
              {claimContext.coupleDisplayName}
            </span>{' '}
            — they added you to their{' '}
            <span className="font-semibold text-ink">{displayServiceLabel(cat)}</span>{' '}
            plan. Saving links it straight to their wedding.
          </p>
        </div>
      ) : null}
      {canvas ? (
        <CanvasMaker
          categoryValue={cat}
          categoryLabel={displayServiceLabel(cat)}
          otherCategories={otherCategories}
          coverages={coverageOptions}
          vendorProfileId={profile.vendor_profile_id}
          claimToken={showClaimBanner ? claimToken : null}
          eventTypeOptions={eventTypeOptions}
          faithOptions={faithOptions}
          coverageAudience={coverageAudience}
          coverageAllowed={coverageAllowed}
        />
      ) : (
        <ServiceWizard
          categoryValue={cat}
          categoryLabel={displayServiceLabel(cat)}
          otherCategories={otherCategories}
          coverages={coverageOptions}
          vendorProfileId={profile.vendor_profile_id}
          claimToken={showClaimBanner ? claimToken : null}
        />
      )}
    </div>
  );
}
