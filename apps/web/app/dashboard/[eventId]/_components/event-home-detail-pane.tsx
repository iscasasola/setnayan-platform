import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Lock,
  Sparkles,
  ListFilter,
} from 'lucide-react';
import {
  PLAN_GROUPS,
  PLAN_GROUP_TIER_LABEL,
  bucketVendorsByGroup,
  isCeremonyType,
  resolvePlanGroupHint,
  targetDateStatus,
  type CeremonyType,
  type CrossCategoryRecommendation,
  type EventVendorRowInput,
  type PlanCardPick,
  type PlanGroup,
  type PlanGroupId,
} from '@/lib/wedding-plan-groups';
import { formatPhp } from '@/lib/vendors';
import { WEDDING_FOLDER_SLUG } from '@/lib/taxonomy';
import { RecommendedVendorRow } from './recommended-vendor-row';

/**
 * Desktop-only master-detail "right pane" for event-home.
 *
 * Lock 2026-05-22 (CLAUDE.md owner directive · Finder-column UX):
 * left column = the mobile-shape event-home page, right column = expanded
 * view of whichever planning card the host tapped. On mobile this pane
 * never renders — the page wrapper sets `hidden lg:block` on the container.
 *
 * Server component. Reads `selectedCardId` (from `?card=` searchParam in
 * the parent page) and renders:
 *   - empty state when `selectedCardId` is null or doesn't match a real
 *     PLAN_GROUPS entry (typo, stale link, etc.)
 *   - "card-expanded" view per the user-picked Option C: larger header,
 *     full religion-adaptive hint, ALL picks (not just first 3),
 *     prominent CTAs, recommended-vendor strip inline.
 *
 * V1 deliberately renders a LEAN expanded card — share-of-features with
 * GroupCard is intentionally limited so we don't duplicate the 350-line
 * GroupCard's full surface (paperwork sub-link, manual-vendor dropdown,
 * compare drawer, etc.). The expanded view shows the data + the two
 * highest-value navigation paths (Open marketplace + Compare picks); the
 * full surface stays on the left-col card itself which is still clickable
 * for its own CTAs.
 */
type Props = {
  eventId: string;
  eventDate: string | null;
  selectedCardId: PlanGroupId | null;
  vendors: ReadonlyArray<EventVendorRowInput>;
  ceremonyType?: string | null;
  venueSetting?: string | null;
  crossCategoryRecommendations?:
    | ReadonlyMap<PlanGroupId, ReadonlyArray<CrossCategoryRecommendation>>
    | null;
};

export function EventHomeDetailPane({
  eventId,
  eventDate,
  selectedCardId,
  vendors,
  ceremonyType,
  venueSetting,
  crossCategoryRecommendations,
}: Props) {
  const selectedGroup = selectedCardId
    ? (PLAN_GROUPS.find((g) => g.id === selectedCardId) ?? null)
    : null;

  if (!selectedGroup) {
    return <EmptyState />;
  }

  // Same bucketing as PlanningGroups — pure function, double-compute is
  // cheap (~22 groups × ~20 vendors), keeps the two surfaces reading
  // from one source of truth without lifting state into the parent.
  const bucketed = bucketVendorsByGroup(
    vendors,
    ceremonyType ?? null,
    venueSetting ?? null,
  );
  const picks = bucketed.get(selectedGroup.id) ?? [];
  const resolvedCeremony: CeremonyType | null = isCeremonyType(ceremonyType)
    ? ceremonyType
    : null;
  const hintCopy = resolvePlanGroupHint(selectedGroup, resolvedCeremony);
  const hasLocked = picks.some((p) => p.status === 'locked');
  const status = targetDateStatus(
    eventDate,
    selectedGroup.monthsBefore,
    hasLocked,
  );
  const lockedPicks = picks.filter((p) => p.status === 'locked');
  const consideredPicks = picks.filter((p) => p.status !== 'locked');
  const recommendations = crossCategoryRecommendations?.get(selectedGroup.id) ?? [];
  const folderSlug = WEDDING_FOLDER_SLUG[selectedGroup.catalogFolder];
  const searchHref = selectedGroup.subcategoryHint
    ? `/vendors?folder=${folderSlug}&category=${encodeURIComponent(selectedGroup.subcategoryHint)}`
    : `/vendors?folder=${folderSlug}#${folderSlug}`;
  const comparePicks = picks.filter((p) => p.status !== 'locked');
  const canCompare = comparePicks.length >= 2;

  return (
    <article className="flex flex-col gap-5">
      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-terracotta">
          {PLAN_GROUP_TIER_LABEL[selectedGroup.tier]}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {selectedGroup.label}
        </h2>
        <p className="text-sm leading-relaxed text-ink/70">{hintCopy}</p>
      </header>

      <DetailStatus status={status} hasLocked={hasLocked} />

      <div className="flex flex-wrap gap-2">
        <Link
          href={searchHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-terracotta hover:text-terracotta"
        >
          <ListFilter aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Browse vendors
          <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        </Link>
        {canCompare ? (
          <Link
            href={`/dashboard/${eventId}/vendors?compare=${selectedGroup.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-terracotta hover:text-terracotta"
          >
            Compare {comparePicks.length}
            <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Link>
        ) : null}
      </div>

      {picks.length === 0 ? (
        <NoPicksHint group={selectedGroup} searchHref={searchHref} />
      ) : (
        <PickList lockedPicks={lockedPicks} consideredPicks={consideredPicks} />
      )}

      {recommendations.length > 0 && !hasLocked ? (
        <RecommendedStrip recommendations={recommendations} eventId={eventId} />
      ) : null}
    </article>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink/15 bg-cream/40 p-8 text-center">
      <Sparkles
        aria-hidden
        className="h-6 w-6 text-terracotta/70"
        strokeWidth={1.5}
      />
      <h2 className="text-base font-semibold tracking-tight text-ink">
        Tap a card to dig in
      </h2>
      <p className="max-w-xs text-sm leading-relaxed text-ink/60">
        Pick a planning card on the left. Its full picture — picks, status,
        next steps — opens up here so you can move through the day one
        decision at a time.
      </p>
    </div>
  );
}

function DetailStatus({
  status,
  hasLocked,
}: {
  status: ReturnType<typeof targetDateStatus>;
  hasLocked: boolean;
}) {
  const Icon =
    status.tone === 'overdue'
      ? Clock
      : status.tone === 'soon'
        ? Clock
        : status.tone === 'fine' && hasLocked
          ? CheckCircle2
          : Clock;
  const toneClass =
    status.tone === 'overdue'
      ? 'border-rose-300/60 bg-rose-50/60 text-rose-800'
      : status.tone === 'soon'
        ? 'border-amber-300/60 bg-amber-50/60 text-amber-900'
        : hasLocked
          ? 'border-emerald-300/60 bg-emerald-50/60 text-emerald-800'
          : 'border-ink/15 bg-cream text-ink/70';
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${toneClass}`}
    >
      <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      <span>{status.label}</span>
    </div>
  );
}

function NoPicksHint({
  group,
  searchHref,
}: {
  group: PlanGroup;
  searchHref: string;
}) {
  return (
    <div className="rounded-xl border border-ink/10 bg-cream/60 p-4 text-sm text-ink/65">
      <p className="mb-2">
        No picks yet for {group.label.toLowerCase()}.
      </p>
      <Link
        href={searchHref}
        className="inline-flex items-center gap-1.5 font-medium text-terracotta hover:underline"
      >
        Start with the marketplace
        <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
      </Link>
    </div>
  );
}

function PickList({
  lockedPicks,
  consideredPicks,
}: {
  lockedPicks: PlanCardPick[];
  consideredPicks: PlanCardPick[];
}) {
  return (
    <div className="space-y-4">
      {lockedPicks.length > 0 ? (
        <PickGroup
          heading="Locked in"
          icon={<Lock aria-hidden className="h-3 w-3" strokeWidth={2} />}
          picks={lockedPicks}
          tone="locked"
        />
      ) : null}
      {consideredPicks.length > 0 ? (
        <PickGroup
          heading={
            consideredPicks.length === 1
              ? '1 option on the table'
              : `${consideredPicks.length} options on the table`
          }
          picks={consideredPicks}
          tone="considering"
        />
      ) : null}
    </div>
  );
}

function PickGroup({
  heading,
  icon,
  picks,
  tone,
}: {
  heading: string;
  icon?: React.ReactNode;
  picks: PlanCardPick[];
  tone: 'locked' | 'considering';
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
        {icon}
        {heading}
      </h3>
      <ul className="space-y-2">
        {picks.map((p) => (
          <li key={p.vendor_id}>
            <PickRow pick={p} tone={tone} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PickRow({ pick, tone }: { pick: PlanCardPick; tone: 'locked' | 'considering' }) {
  const displayName = pick.marketplace_business_name ?? pick.vendor_name;
  const formattedCost = formatPhp(pick.total_cost_php);
  const isLocked = tone === 'locked';
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-sm ${
        isLocked
          ? 'border-emerald-300/50 bg-emerald-50/30'
          : 'border-ink/10 bg-cream'
      }`}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate font-medium text-ink">{displayName}</p>
        {pick.marketplace_city ? (
          <p className="truncate text-xs text-ink/55">{pick.marketplace_city}</p>
        ) : null}
      </div>
      {formattedCost ? (
        <p className="shrink-0 text-xs font-medium text-ink/70">{formattedCost}</p>
      ) : null}
    </div>
  );
}

function RecommendedStrip({
  recommendations,
  eventId,
}: {
  recommendations: ReadonlyArray<CrossCategoryRecommendation>;
  eventId: string;
}) {
  return (
    <section className="space-y-2 border-t border-ink/10 pt-4">
      <h3 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
        <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
        Recommended
      </h3>
      <p className="text-xs text-ink/55">
        Vendors you already picked who also cover this category.
      </p>
      <ul className="space-y-1.5">
        {recommendations.slice(0, 5).map((rec) => (
          <li key={`${rec.vendor_id}:${rec.target_category}`}>
            <RecommendedVendorRow
              eventId={eventId}
              marketplaceVendorId={rec.vendor_id}
              serviceId={rec.service_id}
              targetCategory={rec.target_category}
              vendorName={rec.vendor_name}
              vendorLogoUrl={rec.vendor_logo_url}
              sourceGroupLabel={rec.source_group_label}
              sourceStatus={rec.source_status}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
