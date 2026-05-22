import Image from 'next/image';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  BookmarkCheck,
  FileText,
  MessageCircle,
  ScrollText,
} from 'lucide-react';
import {
  PLAN_GROUPS,
  bucketVendorsByGroup,
  isCeremonyType,
  resolvePlanGroupHint,
  targetDateStatus,
  type CeremonyType,
  type EventVendorRowInput,
  type PlanCardPick,
  type PlanGroup,
  type PlanGroupId,
} from '@/lib/wedding-plan-groups';
import { VENDOR_CATEGORY_LABEL } from '@/lib/vendors';
import { WEDDING_FOLDER_SLUG } from '@/lib/taxonomy';
import type { PaperworkSummary } from '@/lib/paperwork';
import { deleteVendor } from '../vendors/actions';
import { DirectionsButtons } from './directions-buttons';
import { PlanCardCTAs } from './plan-card-ctas';
import { OfficiantParishCTAs } from './officiant-parish-ctas';
import { PlanCardCompare } from './plan-card-compare';
import { SwitchVendorConfirm } from './switch-vendor-confirm';

function formatPHP(value: number | null): string | null {
  if (value === null) return null;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function rawStatusLabel(raw: string | null): string {
  if (!raw) return 'Considering';
  return raw
    .split('_')
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

type Props = {
  eventId: string;
  eventDate: string | null;
  /** Reception venue coordinates (events.venue_latitude/longitude).
   *  When set, the venue groups (ceremony_venue, reception_venue) get
   *  Google Maps / Waze / Apple Maps nav-links on the card. */
  venueLatitude: number | null;
  venueLongitude: number | null;
  /**
   * Host's picked `events.ceremony_type`. Drives the religion-adaptive
   * card hint copy (catholic / civil / inc / christian / muslim /
   * cultural / mixed). `null` for events that haven't picked yet —
   * those see the generic default hints. Also feeds the per-pick
   * compatibility-mismatch check (PR B 2026-05-22) — picks tagged with
   * a different ceremony_type than the host's current pick surface an
   * inline chip + Remove action.
   *
   * Owner directive 2026-05-22: ADAPT-COPY > HIDE-CARD. Every card stays
   * visible across all ceremony types; only hint copy changes. See the
   * full decision matrix in the same-day CLAUDE.md decision-log row.
   */
  ceremonyType?: string | null;
  /**
   * Host's picked `events.venue_setting` (PR B 2026-05-22). Feeds the
   * per-pick compatibility-mismatch check — vendors whose
   * compatible_venue_settings[] doesn't cover the host's current
   * setting (e.g. an indoor-only band on a garden wedding) surface an
   * inline chip + Remove action. `null` to skip the venue-setting
   * branch of the check.
   */
  venueSetting?: string | null;
  vendors: ReadonlyArray<EventVendorRowInput>;
  /**
   * Optional paperwork progress summary for the Ceremony venue card's
   * sub-link. When set, the card renders a small "📋 Paperwork — X of Y
   * in progress" deep-link to /paperwork. When undefined or zero-total
   * (host hasn't seeded yet), the link still renders but with empty-state
   * copy. Per CLAUDE.md 2026-05-22 owner directive — paperwork pipeline
   * UI lives at /paperwork with the surface-link surgical on the
   * existing Ceremony PlanningGroup card.
   */
  paperworkSummary?: PaperworkSummary | null;
};

const MAX_VENDOR_PREVIEW = 3;

export function PlanningGroups({
  eventId,
  eventDate,
  venueLatitude,
  venueLongitude,
  ceremonyType,
  venueSetting,
  vendors,
  paperworkSummary,
}: Props) {
  // PR B 2026-05-22 — pass ceremony_type + venue_setting to the bucketer
  // so each pick gets a compatibility_issue field computed against the
  // host's current event settings. Null/null effectively disables the
  // check (early-planning events).
  const bucketed = bucketVendorsByGroup(
    vendors,
    ceremonyType ?? null,
    venueSetting ?? null,
  );

  // Resolve ceremony type once at the top so every card reads from the
  // same source. `null` for early-planning events (no pick yet) yields
  // the static `PlanGroup.hint` defaults via resolvePlanGroupHint.
  const resolvedCeremony: CeremonyType | null = isCeremonyType(ceremonyType)
    ? ceremonyType
    : null;

  // Officiant venue-linking — owner directive 2026-05-22:
  //   "officiant will be listed by the locked ceremony venue then add a
  //    button to search outside of the official ceremony venue to show
  //    other officiants or they can add manually."
  //
  // Resolve the host's LOCKED ceremony-venue pick (status at-or-past
  // 'contracted' per CONFIRMED_VENDOR_STATUSES). Filipino weddings
  // typically pull their officiant from the parish where the ceremony
  // happens — surfacing the venue name on the Officiant card lets the
  // host call the parish secretary directly. When no ceremony venue is
  // locked yet, the Officiant card shows a polite "lock venue first"
  // hint with three escape paths (jump to ceremony · search anyway ·
  // add manually). See OfficiantParishCTAs for the actual surface.
  const ceremonyVenuePicks = bucketed.get('ceremony_venue') ?? [];
  const lockedCeremonyVenue =
    ceremonyVenuePicks.find((p) => p.status === 'locked') ?? null;
  const ceremonyVenueName = lockedCeremonyVenue
    ? (lockedCeremonyVenue.marketplace_business_name ?? lockedCeremonyVenue.vendor_name)
    : null;

  // Counter rewrite — owner directive 2026-05-22 (Task #54).
  //
  // OLD math counted pick-ROWS ("3 picked" meant the host had 3 considering
  // vendors across all 12 cards), which was confusing because it didn't
  // track progress toward locking in 12 categories.
  //
  // NEW math is card-state-aware:
  //   - lockedCards = count of plan groups with ≥1 locked vendor
  //   - leftToLock  = 12 − lockedCards
  //   - consideredPicks = pick-rows that aren't locked (informational only,
  //     kept on a secondary line so the host can still see "you have N
  //     options on the table")
  //
  // The header now reads progress, not inventory.
  let lockedCards = 0;
  let consideredPicks = 0;
  for (const picks of bucketed.values()) {
    let groupHasLocked = false;
    for (const p of picks) {
      if (p.status === 'locked') groupHasLocked = true;
      else consideredPicks += 1;
    }
    if (groupHasLocked) lockedCards += 1;
  }
  const totalGroups = PLAN_GROUPS.length;
  const leftToLock = Math.max(0, totalGroups - lockedCards);

  return (
    <section aria-labelledby="planning-groups-heading" className="space-y-4">
      <header className="space-y-1.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Your wedding plan
        </p>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2
            id="planning-groups-heading"
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            {totalGroups} things to lock in.
          </h2>
          <div className="space-y-0.5 text-right">
            <p className="text-sm text-ink/70">
              {lockedCards === 0 ? (
                <>
                  <strong className="text-ink">
                    {leftToLock} left to lock in
                  </strong>
                </>
              ) : (
                <>
                  <strong className="text-ink">{lockedCards} locked</strong>{' '}
                  · {leftToLock} left
                </>
              )}
            </p>
            {consideredPicks > 0 ? (
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                {consideredPicks === 1
                  ? '1 option on the table'
                  : `${consideredPicks} options on the table`}
              </p>
            ) : (
              <p className="text-xs text-ink/55">
                Browse vendors below — picks land here automatically.
              </p>
            )}
          </div>
        </div>
      </header>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PLAN_GROUPS.map((group) => {
          const picks = bucketed.get(group.id) ?? [];
          return (
            <li
              key={group.id}
              // Anchor target for OfficiantParishCTAs State B's "Lock
              // ceremony venue first" deep-link. Scrolls the host to
              // the Ceremony venue card so they can finalize their
              // venue pick. Owner directive 2026-05-22: "#ceremony-
              // venue anchor scrolls the page up to the Ceremony
              // venue card." Implemented as an id-anchor on the LI
              // wrapper so smooth-scroll lands at the card boundary.
              id={
                group.id === 'ceremony_venue'
                  ? 'ceremony-venue-card'
                  : undefined
              }
              className={
                group.id === 'ceremony_venue' ? 'scroll-mt-20' : undefined
              }
            >
              <GroupCard
                eventId={eventId}
                eventDate={eventDate}
                group={group}
                picks={picks}
                ceremonyType={resolvedCeremony}
                venueLatitude={venueLatitude}
                venueLongitude={venueLongitude}
                ceremonyVenueName={ceremonyVenueName}
                paperworkSummary={
                  group.id === 'ceremony_venue'
                    ? (paperworkSummary ?? null)
                    : null
                }
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function GroupCard({
  eventId,
  eventDate,
  group,
  picks,
  ceremonyType,
  venueLatitude,
  venueLongitude,
  ceremonyVenueName,
  paperworkSummary,
}: {
  eventId: string;
  eventDate: string | null;
  group: PlanGroup;
  picks: ReadonlyArray<PlanCardPick>;
  ceremonyType: CeremonyType | null;
  venueLatitude: number | null;
  venueLongitude: number | null;
  /**
   * Display name of the host's LOCKED ceremony venue (status at-or-past
   * 'contracted'). Used ONLY by the Officiant card to surface the
   * "your officiant typically comes from {venue}" hint. `null` when no
   * venue is locked yet — the Officiant card flips to State B (the
   * "lock ceremony venue first" hint with escape paths).
   */
  ceremonyVenueName: string | null;
  paperworkSummary: PaperworkSummary | null;
}) {
  // Resolve religion-adaptive hint copy. Returns the static default
  // (group.hint) when ceremonyType is null OR the card has no faith-
  // specific override registered for the picked ceremony type.
  const hintCopy = resolvePlanGroupHint(group, ceremonyType);
  // Surface nav deep-links on the two venue groups when the event's
  // reception venue is geocoded — both Ceremony venue + Reception venue
  // point at the same anchor today (single events.venue_lat/lng column).
  const isVenueGroup =
    group.id === 'ceremony_venue' || group.id === 'reception_venue';
  const showNavLinks =
    isVenueGroup && venueLatitude !== null && venueLongitude !== null;
  const hasLocked = picks.some((p) => p.status === 'locked');
  const status = targetDateStatus(eventDate, group.monthsBefore, hasLocked);

  const lockedCount = picks.filter((p) => p.status === 'locked').length;
  const pickedOnlyCount = picks.length - lockedCount;

  // Search opens the marketplace's CURATED CATALOG view scoped to the
  // matching folder section. `?folder=<slug>` tells /vendors to render
  // ONLY that one folder (hides the other 11 + the page-level
  // PairedVenuePanel). The `#<slug>` anchor preserves smooth-scroll
  // into the section header so the FolderTabs strip lands where the
  // couple expects. Task #47 — closes the reported bug where clicking
  // Reception Search showed Ceremony churches because the universal
  // 12-folder catalog rendered Ceremony directly above Reception.
  // Add fires the inline custom-vendor form so couples can attach a
  // DIY / not-on-list vendor without leaving the planner.
  const folderSlug = WEDDING_FOLDER_SLUG[group.catalogFolder];
  const searchHref = `/vendors?folder=${folderSlug}#${folderSlug}`;

  // Finalized-vendor-photo-card (2026-05-22 — owner directive PR D).
  //
  // When ANY pick in this group is locked (status at-or-past
  // 'contracted' per CONFIRMED_VENDOR_STATUSES), the card flips to the
  // LockedCard variant. We pick the FIRST locked vendor to feature
  // (the host has typically already committed when reaching this
  // state; for multi-canonical groups with two locked picks — Attire &
  // Rings with both gown + suit confirmed, etc. — the first lock wins
  // the hero slot and the others stack below as compact rows).
  //
  // The LockedCard removes the Add / Search / Compare buttons. Edit
  // affordances go away. The only forward path is Switch vendor, which
  // requires explicit confirmation per the owner directive ("high-
  // stakes action"). View contract + Open thread are the two safe
  // secondary actions that don't change state.
  //
  // ADAPT-COPY > HIDE-CARD principle from PR #314 still holds: the
  // card stays visible, only the body shape changes.
  if (hasLocked) {
    const lockedPicks = picks.filter((p) => p.status === 'locked');
    const featured = lockedPicks[0]!;
    const otherLocked = lockedPicks.slice(1);
    const considering = picks.filter((p) => p.status !== 'locked');
    return (
      <LockedCard
        eventId={eventId}
        group={group}
        featured={featured}
        otherLocked={otherLocked}
        consideringCount={considering.length}
        showNavLinks={showNavLinks}
        venueLatitude={venueLatitude}
        venueLongitude={venueLongitude}
        paperworkSummary={paperworkSummary}
        hintCopy={hintCopy}
        statusLabel={status.label}
      />
    );
  }

  return (
    <article
      className={`flex h-full flex-col gap-3 rounded-xl border p-4 sm:p-5 ${
        status.tone === 'overdue'
          ? 'border-rose-300/50 bg-rose-50/40'
          : status.tone === 'soon'
            ? 'border-amber-300/50 bg-amber-50/40'
            : 'border-ink/10 bg-cream'
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-ink sm:text-lg">
            {group.label}
          </h3>
          <p className="text-xs text-ink/55">{hintCopy}</p>
        </div>
        <StatusPill
          tone={status.tone}
          hasLocked={hasLocked}
          lockedCount={lockedCount}
          pickedOnlyCount={pickedOnlyCount}
        />
      </header>

      <p
        className={`flex items-center gap-1.5 text-xs ${
          status.tone === 'overdue'
            ? 'text-rose-800'
            : status.tone === 'soon'
              ? 'text-amber-900'
              : status.tone === 'none'
                ? 'text-ink/50'
                : 'text-ink/65'
        }`}
      >
        {status.tone === 'overdue' ? (
          <AlertCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        ) : status.tone === 'soon' ? (
          <Clock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        ) : (
          <Clock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        )}
        <span>{status.label}</span>
      </p>

      {picks.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {picks.slice(0, MAX_VENDOR_PREVIEW).map((p) => {
            // Multi-canonical groups (Attire & Rings, Music & Entertainment,
            // etc.) include the canonical label on the sub-line so the
            // couple can tell at a glance which slot each pick fills.
            // Single-canonical groups skip it (the card header already
            // says "Catering" / "Cake" / etc.).
            const isMultiCanonical = group.categories.length > 1;
            const formattedCost = formatPHP(p.total_cost_php);
            const subLineParts: string[] = [];
            if (isMultiCanonical) {
              subLineParts.push(
                VENDOR_CATEGORY_LABEL[p.category] ?? p.category,
              );
            }
            if (formattedCost !== null) subLineParts.push(formattedCost);
            return (
              <li key={p.vendor_id} className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink/80">
                      {p.vendor_name}
                    </p>
                    {subLineParts.length > 0 ? (
                      <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
                        {subLineParts.join(' · ')}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">
                    {rawStatusLabel(p.raw_status)}
                  </span>
                </div>
                {p.compatibility_issue ? (
                  <CompatibilityChip
                    eventId={eventId}
                    vendorId={p.vendor_id}
                    label={p.compatibility_issue.label}
                  />
                ) : null}
              </li>
            );
          })}
          {picks.length > MAX_VENDOR_PREVIEW ? (
            <li className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
              +{picks.length - MAX_VENDOR_PREVIEW} more
            </li>
          ) : null}
        </ul>
      ) : null}

      {showNavLinks ? (
        <DirectionsButtons
          latitude={venueLatitude}
          longitude={venueLongitude}
          label="Directions"
        />
      ) : null}

      {paperworkSummary ? (
        <PaperworkSubLink
          eventId={eventId}
          summary={paperworkSummary}
        />
      ) : null}

      {/* Officiant venue-linking — owner directive 2026-05-22.
       *
       * Officiant card replaces the standard Search/Add row with parish-
       * aware affordances. State A (ceremony venue locked) surfaces the
       * "your officiant typically comes from {parish}" banner + a "from
       * parish" Add affordance + an "outside this parish" Search link.
       * State B (no ceremony venue locked yet) shows a polite "lock
       * venue first" hint + three escape paths (jump to ceremony · search
       * anyway · add manually). Per ADAPT-COPY > HIDE-CARD principle the
       * card stays visible across both states; only the body changes.
       */}
      {group.id === 'officiant' ? (
        <OfficiantParishCTAs
          eventId={eventId}
          defaultCategory={group.categories[0]!}
          searchHref={searchHref}
          ceremonyVenueName={ceremonyVenueName}
        />
      ) : (
        <PlanCardCTAs
          eventId={eventId}
          defaultCategory={group.categories[0]!}
          searchHref={searchHref}
          groupLabel={group.label}
        />
      )}
      {picks.length >= 2 ? (
        <div className="-mt-1">
          <PlanCardCompare
            eventId={eventId}
            groupId={group.id}
            groupLabel={group.label}
            groupCategories={group.categories}
            picks={picks}
          />
        </div>
      ) : null}
    </article>
  );
}

/**
 * Locked-state variant of the planning card — finalized-vendor-photo-
 * card (2026-05-22, owner directive PR D).
 *
 * Renders when at least one vendor in the category is past 'contracted'.
 * Hides the standard Add / Search / Compare affordances because the
 * host has committed. Surfaces:
 *   - Featured locked vendor (logo or initials + canonical name + city
 *     + total_cost_php hint)
 *   - Other locked picks in the same multi-canonical group, compact
 *     row form (e.g. Attire & Rings group with gown + suit + rings
 *     all locked)
 *   - Still-considering count subtitle (informational, no jump-to-
 *     compare button — switching is the only state-change path)
 *   - View contract (links into /dashboard/{eventId}/contracts)
 *   - Open thread (links into /dashboard/{eventId}/messages)
 *   - Switch vendor (opens SwitchVendorConfirm modal)
 *
 * View contract + Open thread are event-scoped landing pages. We don't
 * deep-link to a specific vendor's contract or thread because that
 * routing layer isn't built yet — the host filters down to the right
 * vendor inside the surface, which is one extra click but doesn't
 * orphan a route per [[feedback_setnayan_orphan_prevention]].
 *
 * DirectionsButtons + PaperworkSubLink stay visible — both are read-
 * only sub-features that don't conflict with the locked state. A
 * locked Ceremony venue card still benefits from Directions (Google
 * Maps · Waze · Apple Maps brand-icon buttons) + Paperwork progress.
 */
function LockedCard({
  eventId,
  group,
  featured,
  otherLocked,
  consideringCount,
  showNavLinks,
  venueLatitude,
  venueLongitude,
  paperworkSummary,
  hintCopy,
  statusLabel,
}: {
  eventId: string;
  group: PlanGroup;
  featured: PlanCardPick;
  otherLocked: ReadonlyArray<PlanCardPick>;
  consideringCount: number;
  showNavLinks: boolean;
  venueLatitude: number | null;
  venueLongitude: number | null;
  paperworkSummary: PaperworkSummary | null;
  hintCopy: string;
  statusLabel: string;
}) {
  const displayName =
    featured.marketplace_business_name ?? featured.vendor_name;
  // 3-tier avatar resolution (2026-05-22 refinement on PR #341):
  //   1. service primary photo · vendor_services row the host booked
  //   2. vendor logo · vendor_profiles.logo_url (PR #341 baseline)
  //   3. initials placeholder · handled inside LockedVendorAvatar
  const servicePhotoUrl = featured.service_primary_photo_url ?? null;
  const vendorLogoUrl = featured.marketplace_logo_url ?? null;
  const city = featured.marketplace_city ?? null;
  const formattedCost = formatPHP(featured.total_cost_php);
  const isMultiCanonical = group.categories.length > 1;
  const featuredCategoryLabel = isMultiCanonical
    ? (VENDOR_CATEGORY_LABEL[featured.category] ?? featured.category)
    : null;

  return (
    <article className="flex h-full flex-col gap-3 rounded-xl border border-emerald-300/50 bg-emerald-50/40 p-4 sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-ink sm:text-lg">
            {group.label}
          </h3>
          <p className="text-xs text-ink/55">{hintCopy}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-emerald-800">
          <BookmarkCheck aria-hidden className="h-3 w-3" strokeWidth={2} />
          Locked
        </span>
      </header>

      <p className="flex items-center gap-1.5 text-xs text-emerald-800">
        <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        <span>{statusLabel}</span>
      </p>

      {/* Featured locked vendor — photo card */}
      <div className="flex items-start gap-3 rounded-lg bg-cream/80 p-3">
        <LockedVendorAvatar
          servicePhotoUrl={servicePhotoUrl}
          vendorLogoUrl={vendorLogoUrl}
          name={displayName}
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          {featuredCategoryLabel ? (
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
              {featuredCategoryLabel}
            </p>
          ) : null}
          <p className="truncate text-sm font-semibold text-ink">
            {displayName}
          </p>
          {(city || formattedCost) ? (
            <p className="truncate text-xs text-ink/60">
              {[city, formattedCost].filter((s) => s !== null && s !== '').join(' · ')}
            </p>
          ) : null}
        </div>
      </div>

      {/* Multi-canonical groups: stack any other locked picks compactly */}
      {otherLocked.length > 0 ? (
        <ul className="space-y-1.5 text-sm">
          {otherLocked.map((p) => {
            const otherName = p.marketplace_business_name ?? p.vendor_name;
            const otherCategoryLabel =
              VENDOR_CATEGORY_LABEL[p.category] ?? p.category;
            return (
              <li
                key={p.vendor_id}
                className="flex items-center gap-2 rounded-md bg-cream/60 px-2.5 py-1.5"
              >
                <BookmarkCheck
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0 text-emerald-700"
                  strokeWidth={2}
                />
                <span className="min-w-0 flex-1 truncate text-xs text-ink/80">
                  <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink/45">
                    {otherCategoryLabel}
                  </span>
                  {' · '}
                  {otherName}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {consideringCount > 0 ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
          {consideringCount === 1
            ? '1 other option still on the table'
            : `${consideringCount} other options still on the table`}
        </p>
      ) : null}

      {showNavLinks ? (
        <DirectionsButtons
          latitude={venueLatitude}
          longitude={venueLongitude}
          label="Directions"
        />
      ) : null}

      {paperworkSummary ? (
        <PaperworkSubLink
          eventId={eventId}
          summary={paperworkSummary}
        />
      ) : null}

      {/* Safe secondary actions — neither changes vendor state */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/dashboard/${eventId}/contracts`}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 py-2 text-xs font-medium text-ink/80 transition-colors hover:border-terracotta/40 hover:text-terracotta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          <FileText aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          View contract
        </Link>
        <Link
          href={`/dashboard/${eventId}/messages`}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 py-2 text-xs font-medium text-ink/80 transition-colors hover:border-terracotta/40 hover:text-terracotta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          <MessageCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Open thread
        </Link>
      </div>

      {/* High-stakes Switch vendor — destructive, confirm modal */}
      <div className="-mt-1 text-right">
        <SwitchVendorConfirm
          eventId={eventId}
          vendorId={featured.vendor_id}
          vendorName={displayName}
          groupLabel={group.label}
        />
      </div>
    </article>
  );
}

/**
 * LockedVendorAvatar — 56×56 vendor photo on the LockedCard hero slot.
 * Sized larger than FinalizedChipStrip's 36×36 because the planning
 * card has more vertical room. Both surfaces share the same 3-tier
 * resolution ladder, but each ships its own component because the
 * size + corner radius differ (rounded-full chip vs rounded-lg card).
 *
 * 3-tier avatar fallback (2026-05-22 refinement on PR #341):
 *   PRIORITY 1: servicePhotoUrl — booked vendor_services row's
 *               primary photo. Resolved via r2PublicUrl in page.tsx
 *               so consumers receive a ready-to-render URL.
 *   PRIORITY 2: vendorLogoUrl — vendor_profiles.logo_url. PR #341
 *               baseline. Falls through when service photo absent.
 *   PRIORITY 3: initials-on-terracotta — when both are null/invalid.
 *               Same off-platform / custom-row fallback path that
 *               PR #341 shipped.
 */
function LockedVendorAvatar({
  servicePhotoUrl,
  vendorLogoUrl,
  name,
}: {
  servicePhotoUrl: string | null;
  vendorLogoUrl: string | null;
  name: string;
}) {
  const initials =
    name
      .split(/\s+/)
      .map((p) => p.charAt(0).toUpperCase())
      .filter((c) => c.length > 0)
      .slice(0, 2)
      .join('') || '?';
  const isOptimizable = (url: string | null): url is string =>
    !!url &&
    (url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('/'));
  // Walk the ladder. A malformed service photo URL still falls through
  // to the logo instead of rendering broken markup.
  const chosen = isOptimizable(servicePhotoUrl)
    ? servicePhotoUrl
    : isOptimizable(vendorLogoUrl)
      ? vendorLogoUrl
      : null;
  if (chosen) {
    return (
      <span className="inline-flex h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-ink/10 bg-cream">
        <Image
          src={chosen}
          alt=""
          width={56}
          height={56}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-terracotta/15 font-mono text-base font-semibold text-terracotta-700"
    >
      {initials}
    </span>
  );
}

function StatusPill({
  tone,
  hasLocked,
  lockedCount,
  pickedOnlyCount,
}: {
  tone: 'none' | 'overdue' | 'soon' | 'fine';
  hasLocked: boolean;
  lockedCount: number;
  pickedOnlyCount: number;
}) {
  if (hasLocked) {
    return (
      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-emerald-800">
        {lockedCount === 1 ? '1 locked' : `${lockedCount} locked`}
      </span>
    );
  }
  if (pickedOnlyCount > 0) {
    return (
      <span className="shrink-0 rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/65">
        {pickedOnlyCount === 1 ? '1 picked' : `${pickedOnlyCount} picked`}
      </span>
    );
  }
  if (tone === 'overdue') {
    return (
      <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-rose-800">
        Overdue
      </span>
    );
  }
  if (tone === 'soon') {
    return (
      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-amber-900">
        Due soon
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/50">
      Open
    </span>
  );
}

/**
 * Inline compatibility-mismatch chip — PR B 2026-05-22 (Task #53).
 *
 * Renders when a picked vendor's compatible_ceremony_types[] OR
 * compatible_venue_settings[] doesn't cover the host's current
 * events.ceremony_type / events.venue_setting. Two actions: a calm
 * "Remove" form-button (server action: existing deleteVendor) and a
 * passive read of the mismatch reason.
 *
 * Owner directive: "Don't auto-delete — the host gets agency."
 * Implementation matches: the host explicitly clicks Remove; the
 * server action `deleteVendor` runs under the host's own session +
 * RLS gates further. The `formAction` attribute on the button binds
 * the action to that single button click (no full-form submit needed).
 *
 * Brand voice rule: amber not red. This is informational, not an error.
 * The vendor was a valid pick when the host saved them; the *event*
 * changed underneath them, so the chip reads as a heads-up not a
 * scolding.
 */
function CompatibilityChip({
  eventId,
  vendorId,
  label,
}: {
  eventId: string;
  vendorId: string;
  label: string;
}) {
  return (
    <form
      action={deleteVendor}
      className="flex flex-wrap items-start gap-2 rounded-md border border-amber-300/50 bg-amber-50/60 px-2.5 py-1.5"
    >
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="vendor_id" value={vendorId} />
      <AlertTriangle
        aria-hidden
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700"
        strokeWidth={2}
      />
      <p className="min-w-0 flex-1 text-[11px] leading-snug text-amber-900">
        {label}
      </p>
      <button
        type="submit"
        className="shrink-0 rounded-md border border-amber-400/60 bg-cream px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-amber-900 transition-colors hover:bg-amber-100"
      >
        Remove
      </button>
    </form>
  );
}

/**
 * Compact paperwork-progress sub-link rendered ONLY on the Ceremony venue
 * card. Deep-links to `/dashboard/{eventId}/paperwork`. Three states:
 *   • Zero rows yet — neutral "Track your paperwork" CTA
 *   • Some progress — "X of Y received" with tone keyed to overdue count
 *   • Marriage license expiring — amber tint
 *
 * Per CLAUDE.md 2026-05-22 owner directive: surgical sub-link on existing
 * Ceremony card, doesn't disturb the rest of the card's layout. Polite
 * brand voice — no engineering jargon, no exclamation marks.
 */
function PaperworkSubLink({
  eventId,
  summary,
}: {
  eventId: string;
  summary: PaperworkSummary;
}) {
  const hasRows = summary.total > 0;
  const isOverdue = summary.overdueCount > 0;
  const showLicenseWarn = summary.hasMarriageLicenseExpiring;

  const toneClass = isOverdue
    ? 'border-rose-300/50 bg-rose-50/60 text-rose-900 hover:bg-rose-100/60'
    : showLicenseWarn
      ? 'border-amber-300/50 bg-amber-50/60 text-amber-900 hover:bg-amber-100/60'
      : hasRows
        ? 'border-ink/15 bg-cream text-ink/80 hover:border-terracotta/40 hover:text-terracotta'
        : 'border-dashed border-ink/20 bg-cream text-ink/70 hover:border-terracotta/40 hover:text-terracotta';

  const labelCopy = hasRows
    ? isOverdue
      ? `Paperwork — ${summary.overdueCount} overdue · ${summary.received}/${summary.total} received`
      : showLicenseWarn
        ? `Paperwork — marriage license expiring soon · ${summary.received}/${summary.total} received`
        : `Paperwork — ${summary.received}/${summary.total} received`
    : 'Track your paperwork — PSA, CENOMAR, marriage license';

  return (
    <Link
      href={`/dashboard/${eventId}/paperwork`}
      className={`-mt-1 inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${toneClass}`}
    >
      <ScrollText
        className="h-3.5 w-3.5 shrink-0"
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="truncate">{labelCopy}</span>
    </Link>
  );
}

// Re-export PlanGroupId so downstream code can reference the union type if
// it ever needs to (analytics, deep links, etc.). Today no one imports it
// outside this file but keeping it in the public surface keeps the module
// shape consistent with PLAN_GROUPS being part of the lib API.
export type { PlanGroupId };
