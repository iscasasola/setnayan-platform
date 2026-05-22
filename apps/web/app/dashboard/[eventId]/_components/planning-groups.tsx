import { CheckCircle2, Clock, AlertCircle, AlertTriangle } from 'lucide-react';
import { NavLinksRow } from '@/app/_components/nav-links';
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
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import { WEDDING_FOLDER_SLUG } from '@/lib/taxonomy';
import { deleteVendor } from '../vendors/actions';
import { PlanCardCTAs } from './plan-card-ctas';
import { PlanCardCompare } from './plan-card-compare';

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
            <li key={group.id}>
              <GroupCard
                eventId={eventId}
                eventDate={eventDate}
                group={group}
                picks={picks}
                ceremonyType={resolvedCeremony}
                venueLatitude={venueLatitude}
                venueLongitude={venueLongitude}
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
}: {
  eventId: string;
  eventDate: string | null;
  group: PlanGroup;
  picks: ReadonlyArray<PlanCardPick>;
  ceremonyType: CeremonyType | null;
  venueLatitude: number | null;
  venueLongitude: number | null;
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

  return (
    <article
      className={`flex h-full flex-col gap-3 rounded-xl border p-4 sm:p-5 ${
        hasLocked
          ? 'border-emerald-300/50 bg-emerald-50/40'
          : status.tone === 'overdue'
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
        ) : status.tone === 'fine' && hasLocked ? (
          <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
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
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${
                      p.status === 'locked'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-ink/5 text-ink/55'
                    }`}
                  >
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
        <NavLinksRow
          latitude={venueLatitude}
          longitude={venueLongitude}
          label="Directions"
          compact
        />
      ) : null}

      <PlanCardCTAs
        eventId={eventId}
        defaultCategory={group.categories[0]!}
        searchHref={searchHref}
        groupLabel={group.label}
      />
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

// Re-export PlanGroupId so downstream code can reference the union type if
// it ever needs to (analytics, deep links, etc.). Today no one imports it
// outside this file but keeping it in the public surface keeps the module
// shape consistent with PLAN_GROUPS being part of the lib API.
export type { PlanGroupId };
