import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Heart } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { VENDOR_CATEGORIES, type VendorCategory } from '@/lib/vendors';
import { resolveClaimContextForService } from '@/lib/vendor-invite-actions';
import { buildCanvasInitialFromCoupleCard } from '@/lib/vendor-card-from-couple';
import { createAdminClient } from '@/lib/supabase/admin';
import { ServiceWizard } from '../../_components/service-wizard';
import { CanvasMaker } from '../../_components/canvas-maker';
import { getCoverageTaxonomy } from '@/lib/vendor-coverages';
import { loadKindDetails, loadMakerContext } from '@/lib/service-card-maker.server';
import { RefinementsEditor } from '../../_components/refinements-editor';
import { canvasMakerEnabled } from '@/lib/canvas-maker-flag';
import { cardKindLabeller } from '@/lib/card-kind-labeller';
import { buildLeafIndex, isCoverageLeafKind } from '@/lib/service-card-kind';
import { WEDDING_TILE_ORDER } from '@/lib/taxonomy';
import { buildCanvasInitialFromCard } from '@/lib/vendor-card-copy';

export const metadata = { title: 'Add a service' };

const CATEGORY_SET = new Set<string>(VENDOR_CATEGORIES);

/**
 * The THIRD legal vocabulary for a card kind: a wedding TILE id.
 *
 * ── MEASURED IN PRODUCTION, 2026-09-08 ────────────────────────────────────
 * A shop's two cards held `live_band` and `host_mc`. `/services/new/live_band`
 * rendered; `/services/new/host_mc` returned "This page doesn't exist on
 * Setnayan" — so the "start a new card from this one" button worked on one card
 * and 404'd on the other, for no reason the vendor could see.
 *
 * Neither is a `VENDOR_CATEGORIES` member. Measured:
 *
 *   live_band  VENDOR_CATEGORY false  WEDDING_TILE true   → passed on the LEAF arm
 *   host_mc    VENDOR_CATEGORY false  WEDDING_TILE true   → matched neither → 404
 *   dj, choir  VENDOR_CATEGORY false  WEDDING_TILE true   → passed on the LEAF arm
 *
 * The three that worked did so only because they also happen to be coverage
 * leaves on that shop's live tree. `host_mc` is not, so the route refused a kind
 * the product had already saved on a real card.
 *
 * 🔑 THE ROUTE'S OWN COMMENT PREDICTED THIS AND NAMED THE WRONG SECOND ARM:
 * *"a leaf card would simply have no copy button that works."* True, and it is
 * not only leaf cards — `lib/card-kind-labeller.ts` says it outright: *"cards in
 * production hold `live_band` / `host_mc`, which are tile ids"*. The vocabulary
 * a card is SAVED with has to be a vocabulary this door ACCEPTS, and tile ids
 * were saved for a year before this door learned them.
 *
 * ⚠ Membership only — this does not make a tile id a `VendorCategory`. It says
 * the door may open for a kind the product itself stores.
 */
const WEDDING_TILE_SET = new Set<string>(WEDDING_TILE_ORDER);

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
  searchParams: Promise<{ claim?: string; from?: string; error?: string }>;
}) {
  const { category } = await params;
  const { claim, from, error } = await searchParams;
  // ⚖ TWO VOCABULARIES ARE LEGAL HERE (owner 2026-08-28, *"yes their own
  // words"*): a legacy kind, or one of the shop's own COVERAGE LEAVES. Without
  // the second arm this route 404s on a card the new door legitimately created —
  // and it is reached by "start from one of your cards" (`?from=`), so a leaf
  // card would simply have no copy button that works.
  //
  // 🔑 Checked against the LIVE TREE, exactly as the save's gate is, so the two
  // cannot disagree about what a valid kind is.
  const kindLabel = await cardKindLabeller();
  const leafKinds = buildLeafIndex(await getCoverageTaxonomy().catch(() => []));
  if (
    !CATEGORY_SET.has(category) &&
    !isCoverageLeafKind(category, leafKinds) &&
    !WEDDING_TILE_SET.has(category)
  ) {
    notFound();
  }
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
  // ONE loader for every door into the maker (lib/service-card-maker.server.ts). The kind is fixed by the address,
  // so the kind list is not read.
  const ctx = await loadMakerContext(supabase, profile.vendor_profile_id, {
    fixedCategory: category,
    withKindList: false,
  });
  const otherCategories = ctx.otherCategories;
  const coverageOptions = ctx.coverages;

  const canvas = canvasMakerEnabled();

  const fromCard =
    canvas && typeof from === 'string' && from.length > 0
      ? await buildCanvasInitialFromCard(supabase, profile.vendor_profile_id, from, category)
      : null;
  const initial =
    fromCard ??
    (canvas && showClaimBanner && claimContext
      ? await buildCanvasInitialFromCoupleCard(
          createAdminClient(),
          claimContext.eventVendorId,
          category,
        )
      : null);
  const details = canvas ? await loadKindDetails(supabase, profile.vendor_profile_id, category) : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href="/vendor-dashboard/services"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Services
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">
        {initial ? 'Start from one of your cards' : 'Add a service'}
      </h1>
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
            <span className="font-semibold text-ink">{kindLabel(cat)}</span>{' '}
            plan. Saving links it straight to their wedding.
          </p>
        </div>
      ) : null}
      {canvas ? (
        <CanvasMaker
          categoryValue={cat}
          categoryLabel={kindLabel(cat)}
          otherCategories={otherCategories}
          coverages={coverageOptions}
          vendorProfileId={profile.vendor_profile_id}
          claimToken={showClaimBanner ? claimToken : null}
          eventTypeOptions={ctx.eventTypeOptions}
          faithOptions={ctx.faithOptions}
          coverageAudience={ctx.coverageAudience}
          coverageAllowed={ctx.coverageAllowed}
          shopName={profile.business_name ?? ''}
          supplierType={ctx.supplierType}
          folderOfKind={ctx.folderOfKind}
          coverageAsk={ctx.coverageAsk}
          schedules={ctx.schedules}
          scheduleOfKind={ctx.scheduleOfKind}
          slotsPerDay={ctx.slotsPerDay}
          branches={ctx.branches}
          detailsKind={details ? category : null}
          detailsSlot={
            details ? (
              <RefinementsEditor canonicalService={category} refinements={details.refinements} initial={details.values} leafLabel={kindLabel(cat)} bare />
            ) : null
          }
          errorLine={typeof error === 'string' && error.length > 0 ? error : null}
          returnTo={`/vendor-dashboard/services/new/${category}`}
          initial={initial}
        />
      ) : (
        <ServiceWizard
          categoryValue={cat}
          categoryLabel={kindLabel(cat)}
          otherCategories={otherCategories}
          coverages={coverageOptions}
          vendorProfileId={profile.vendor_profile_id}
          claimToken={showClaimBanner ? claimToken : null}
        />
      )}
    </div>
  );
}
