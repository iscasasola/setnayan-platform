import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  SERVICE_GROUPS,
  displayServiceLabel,
  groupDisplayOptions,
  isCanonicalService,
  type VendorCategory,
} from '@/lib/vendors';
import { labelForVendorCategory } from '@/lib/vendor-category-taxonomy';
import { getTaxonomy } from '@/lib/taxonomy-db';
import { CanvasMaker, type CategoryGroup } from '../_components/canvas-maker';
import {
  fetchVendorCoverages,
  getCoverageTaxonomy,
  resolveCoverageLabels,
} from '@/lib/vendor-coverages';
import { canvasMakerEnabled } from '@/lib/canvas-maker-flag';
import { getEventTypeVocab } from '@/lib/event-types-db';
import { FAITH_REGISTRY } from '@/lib/faith-registry';
import { SERVICE_PICKER_HREF } from '@/lib/service-picker-anchor';
import { tierCaps, asVendorTier } from '@/lib/vendor-tier-caps';
import {
  coverageParents,
  parentsOfKind,
  standingForCategory,
} from '@/lib/vendor-category-parents';
import { buildLeafIndex, cardKindLabel, humanizeKind } from '@/lib/service-card-kind';
import type { TradeMatch } from '@/lib/kind-search-trades';

export const metadata = { title: 'Add a service' };

/**
 * /vendor-dashboard/services/new — "+ Create service card" LANDS ON THE CARD.
 *
 * 🔴 WHY THIS ROUTE EXISTS (owner 2026-08-28): *"i just bounces to a page for a
 * link to service card. we want it to directly go to a page to create a service
 * card."* Every create link in the shop used to open My Shop with a drawer of
 * category links — a page ABOUT making a card. One press now opens the maker,
 * and the kind of service is asked for ON the card, which is the owner-locked
 * shape of that screen (2026-07-27, "THE MAKER IS ZERO STEPS — THE CARD IS THE
 * FORM").
 *
 * ⚠ THIS IS A SECOND DOOR, NOT A SECOND MAKER. It renders the SAME
 * `<CanvasMaker>` and posts the SAME `commitVendorService` with the same field
 * names; the only difference is that the category arrives from a region on the
 * card instead of from the URL. `/services/new/[category]` is untouched and
 * still serves the claim flow (`?claim=`), "start from one of your cards"
 * (`?from=`) and every existing deep link.
 *
 * 🔑 CANVAS-OFF FALLS BACK RATHER THAN HALF-WORKS. The 6-step `<ServiceWizard>`
 * takes its category from the route and has nowhere to ask for one, so with
 * `NEXT_PUBLIC_CANVAS_MAKER_ENABLED` off this hands the vendor to My Shop's
 * picker — today's behaviour exactly. A screen that renders a maker which
 * cannot be saved would be worse than the bounce this replaces.
 */
export default async function NewServiceCardPage() {
  if (!canvasMakerEnabled()) redirect(SERVICE_PICKER_HREF);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // The kinds of service, in My Shop's own groups with the live admin-taxonomy
  // DISPLAY labels — one list drawn in two places, never two hand-typed ones.
  // A failed taxonomy read degrades to the built-in labels (never to an empty
  // chooser, which would be a maker nobody can finish).
  let tax: Awaited<ReturnType<typeof getTaxonomy>> | null = null;
  try {
    tax = await getTaxonomy();
  } catch {
    tax = null;
  }
  const labelFor = (cat: VendorCategory): string =>
    tax ? labelForVendorCategory(cat, tax) : displayServiceLabel(cat);
  // Everything this shop already offers — the "comes with" options, and half of
  // what decides which kinds it may add. The maker drops whichever kind the
  // vendor picks, so a card is never offered as bundling itself.
  const { data: ownRows } = await supabase
    .from('vendor_services')
    .select('category')
    .eq('vendor_profile_id', profile.vendor_profile_id);
  const ownCategories = ((ownRows ?? []) as { category: string }[]).map((r) => r.category);
  const cardsByCategory: Record<string, number> = {};
  for (const c of ownCategories) cardsByCategory[c] = (cardsByCategory[c] ?? 0) + 1;

  // ── WHICH KINDS THIS SHOP MAY ACTUALLY LIST (owner 2026-08-28) ────────────
  // *"so many categories? should the choices be only for the service we
  // actually cover and not all?"* — asked with the SAME functions the save
  // enforces (`lib/vendor-category-parents.ts`), so the answer cannot drift
  // from the refusal. Before this, a kind the plan could not hold was picked,
  // the whole card was authored, and Publish redirected the work away with an
  // upgrade sentence.
  const { data: tierRow } = await supabase
    .from('vendor_profiles')
    .select('tier_state, is_founder')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  const tierRowTyped = tierRow as
    | { tier_state?: string | null; is_founder?: boolean | null }
    | null;
  const baseCaps = tierCaps(asVendorTier(tierRowTyped?.tier_state));
  // Founder override, identical to the save's (owner 2026-06-09).
  const caps =
    tierRowTyped?.is_founder === true
      ? { ...baseCaps, parentCategories: Infinity, servicesPerLeaf: Infinity }
      : baseCaps;
  // The live leaves — a card's kind may be one of the shop's OWN coverage words
  // (owner 2026-08-28), so families are resolved leaf-first and legacy second.
  const leaves = buildLeafIndex(await getCoverageTaxonomy().catch(() => []));
  const existingParents = new Set<string>([
    ...ownCategories.flatMap((c) => parentsOfKind(c, leaves)),
    ...(await coverageParents(supabase, profile.vendor_profile_id)),
  ]);


  const [vendorCoverages, coverageLabels] = await Promise.all([
    fetchVendorCoverages(supabase, profile.vendor_profile_id).catch(() => []),
    resolveCoverageLabels().catch(() => null),
  ]);

  const standingOf = (key: string) =>
    standingForCategory(key, {
      existingParents,
      cardsByCategory,
      parentCategories: caps.parentCategories,
      servicesPerLeaf: caps.servicesPerLeaf,
      leaves,
    });

  // ── THE SHOP'S OWN WORDS COME FIRST (owner 2026-08-28: *"yes their own
  //    words"*) ────────────────────────────────────────────────────────────
  // A supplier used to say what they sell twice, in two lists that do not
  // agree: coverage says *Pabati* and the kinds list has no such word, so the
  // maker bridged BY FAMILY and asked a Pabati shop to file under *Photobooth*.
  // Their own coverage words are now real choices whose stored value is the
  // leaf itself. Nothing was removed — the 52 legacy kinds are still one tap
  // below, so a shop that grows into something it does not yet cover is never
  // stuck.
  const coverageKindOptions = vendorCoverages.map((c) => {
    const st = standingOf(c.canonical_service);
    return {
      value: c.canonical_service,
      // ⚠ NEVER THE BARE KEY, EVEN WHEN THE TAXONOMY READ FAILS. `leafLabel`
      // already humanises a leaf it cannot find, but `coverageLabels` is null
      // when the whole read threw — and this file's entire point is that a
      // supplier is shown a word, not a database key.
      label: coverageLabels
        ? coverageLabels.leafLabel(c.canonical_service)
        : humanizeKind(c.canonical_service),
      // A covered leaf leads the sheet unless the plan genuinely refuses it —
      // 'covered' and 'open' render identically, so this only decides WHICH
      // band it sits in, never whether it is pressable.
      standing: st.standing === 'locked' ? ('locked' as const) : ('covered' as const),
      why: st.standing === 'locked' ? st.why : undefined,
    };
  });
  const leadWithOwnWords = coverageKindOptions.some((o) => o.standing === 'covered');

  // The "comes with" options — a card the vendor already has. Named through the
  // shared resolver so a card filed under the shop's own word reads as *Pabati*
  // here too, and a card filed under a key we no longer know is humanised
  // rather than printed raw.
  const otherCategories = Array.from(new Set(ownCategories)).map((c) => ({
    value: c,
    label: cardKindLabel(c, leaves, isCanonicalService(c) ? displayServiceLabel(c) : null),
  }));

  const legacyGroups: CategoryGroup[] = SERVICE_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    options: groupDisplayOptions(group.members, labelFor).map((opt) => {
      const st = standingOf(opt.primaryKey);
      return {
        value: opt.primaryKey,
        label: opt.label,
        // ⚠ RE-BANDED, NEVER REMOVED. When the shop's own words are leading, a
        // legacy pill for the same family (*Photobooth* beside their *Pabati*)
        // would sit in that band as a second, vaguer way to file one card. It
        // moves down to "Something else I do" instead — still offered, still
        // pressable, just not competing with the supplier's own word for it.
        standing:
          leadWithOwnWords && st.standing === 'covered' ? ('open' as const) : st.standing,
        why: st.standing === 'locked' ? st.why : undefined,
      };
    }),
  })).filter((g) => g.options.length > 0);

  const categoryOptions: CategoryGroup[] = [
    ...(coverageKindOptions.length > 0
      ? [{ key: 'your-coverage', label: 'What you cover', options: coverageKindOptions }]
      : []),
    ...legacyGroups,
  ];
  const coverageOptions = vendorCoverages.map((c) => ({
    id: c.id,
    label: coverageLabels
      ? coverageLabels.pathLabel(c.canonical_service)
      : c.canonical_service,
  }));

  // ── THE SHOP'S OWN WORDS FOR WHAT IT COVERS ──────────────────────────────
  // The kinds list and the coverage tree are two vocabularies: SetnaProd's leaf
  // is *Pabati* and no "Pabati" pill exists. The chooser bridges by FAMILY, so
  // the band that leads is labelled with the shop's own leaf names — otherwise
  // a supplier is asked to recognise their trade under a word they never chose.
  const coverageNames = vendorCoverages
    .map((c) =>
      coverageLabels ? coverageLabels.leafLabel(c.canonical_service) : c.canonical_service,
    )
    .filter((n): n is string => typeof n === 'string' && n.length > 0);

  const eventTypeOptions = (await getEventTypeVocab().catch(() => [])).map((e) => ({
    key: e.key,
    label: e.label,
  }));
  const faithOptions = FAITH_REGISTRY.map((f) => ({ key: f.faithCol, label: f.label }));

  // coverage id → what it already serves, and what its leaf is allowed to
  // serve. Identical to the [category] route's canvas branch; a failed tree
  // read leaves an id unmapped → null → full vocab, never a false restriction.
  const coverageAudience: Record<number, { eventTypes: string[]; faiths: string[] }> = {};
  const coverageAllowed: Record<number, string[] | null> = {};
  const tree = await getCoverageTaxonomy().catch(() => []);
  const allowedByLeaf = new Map<string, string[] | null>();
  for (const p of tree)
    for (const b of p.branches)
      for (const l of b.leaves) allowedByLeaf.set(l.canonicalService, l.allowedEventTypes);
  for (const c of vendorCoverages) {
    coverageAudience[c.id] = { eventTypes: c.event_types ?? [], faiths: c.faiths ?? [] };
    coverageAllowed[c.id] = allowedByLeaf.get(c.canonical_service) ?? null;
  }

  // ── EVERY LIVE TRADE, FOR THE SEARCH BAND (C1 2026-08-28) ─────────────────
  // Today the kind sheet's search only matches the ~46 legacy pills; the 262
  // real trades in this same tree are not searchable there at all. This is
  // every VISIBLE leaf — the identical visibility rule `getCoverageTaxonomy`
  // already applies (retired / marketplace-hidden nodes are already absent
  // from `tree`) — each carrying the branch it sits under and the SAME
  // standing the save enforces (`standingOf`, above), so a capped supplier
  // can never pick a trade here and be refused only at Publish.
  const tradeOptions: TradeMatch[] = tree.flatMap((p) =>
    p.branches.flatMap((b) =>
      b.leaves.map((l) => {
        const st = standingOf(l.canonicalService);
        return {
          key: l.canonicalService,
          label: l.label,
          branch: b.label,
          standing: st.standing,
          why: st.standing === 'locked' ? st.why : undefined,
        };
      }),
    ),
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href="/vendor-dashboard/shop"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        My Shop
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">New service card</h1>
      <p className="mb-6 mt-1 text-sm text-ink/60">
        This is your card — the one couples will see. Tap any part of it to edit.
        Start with what kind of service it is. Everything saves together.
      </p>
      <CanvasMaker
        categoryValue=""
        categoryLabel=""
        categoryOptions={categoryOptions}
        tradeOptions={tradeOptions}
        firstCardEver={ownCategories.length === 0}
        coverageNames={coverageNames}
        shopName={profile.business_name ?? ''}
        otherCategories={otherCategories}
        coverages={coverageOptions}
        vendorProfileId={profile.vendor_profile_id}
        claimToken={null}
        eventTypeOptions={eventTypeOptions}
        faithOptions={faithOptions}
        coverageAudience={coverageAudience}
        coverageAllowed={coverageAllowed}
        initial={null}
      />
    </div>
  );
}
