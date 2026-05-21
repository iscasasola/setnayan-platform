import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { NavLinksRow } from '@/app/_components/nav-links';
import {
  PLAN_GROUPS,
  bucketVendorsByGroup,
  targetDateStatus,
  type PlanCardPick,
  type PlanGroup,
  type PlanGroupId,
} from '@/lib/wedding-plan-groups';
import type { VendorCategory } from '@/lib/vendors';
import { PlanCardCTAs } from './plan-card-ctas';
import { PlanCardCompare } from './plan-card-compare';

type Props = {
  eventId: string;
  eventDate: string | null;
  /** Reception venue coordinates (events.venue_latitude/longitude).
   *  When set, the venue groups (ceremony_venue, reception_venue) get
   *  Google Maps / Waze / Apple Maps nav-links on the card. */
  venueLatitude: number | null;
  venueLongitude: number | null;
  vendors: ReadonlyArray<{
    vendor_id: string;
    vendor_name: string;
    category: VendorCategory;
    status: string | null;
    total_cost_php?: number | string | null;
    deposit_paid_php?: number | string | null;
    notes?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
  }>;
};

const MAX_VENDOR_PREVIEW = 3;

export function PlanningGroups({
  eventId,
  eventDate,
  venueLatitude,
  venueLongitude,
  vendors,
}: Props) {
  const bucketed = bucketVendorsByGroup(vendors);

  let totalLocked = 0;
  let totalPicked = 0;
  for (const picks of bucketed.values()) {
    for (const p of picks) {
      if (p.status === 'locked') totalLocked += 1;
      else totalPicked += 1;
    }
  }

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
            12 things to lock in.
          </h2>
          <p className="text-sm text-ink/60">
            {totalLocked > 0 || totalPicked > 0 ? (
              <>
                <strong className="text-ink">{totalLocked} locked</strong> ·{' '}
                {totalPicked} picked
              </>
            ) : (
              'Browse vendors in each group below — picks land here automatically.'
            )}
          </p>
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
  venueLatitude,
  venueLongitude,
}: {
  eventId: string;
  eventDate: string | null;
  group: PlanGroup;
  picks: ReadonlyArray<PlanCardPick>;
  venueLatitude: number | null;
  venueLongitude: number | null;
}) {
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

  // Search drops into the marketplace filtered to the FIRST category in
  // the group (the most representative one). Add fires the inline custom-
  // vendor form so couples can attach a DIY / not-on-list vendor without
  // leaving the planner.
  const searchHref = `/vendors?category=${encodeURIComponent(group.categories[0]!)}`;

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
          <p className="text-xs text-ink/55">{group.hint}</p>
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
        <ul className="space-y-1 text-sm">
          {picks.slice(0, MAX_VENDOR_PREVIEW).map((p) => (
            <li
              key={p.vendor_id}
              className="flex items-center justify-between gap-2 text-ink/80"
            >
              <span className="truncate">{p.vendor_name}</span>
              {p.status === 'locked' ? (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-emerald-800">
                  Locked
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">
                  Picked
                </span>
              )}
            </li>
          ))}
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

// Re-export PlanGroupId so downstream code can reference the union type if
// it ever needs to (analytics, deep links, etc.). Today no one imports it
// outside this file but keeping it in the public surface keeps the module
// shape consistent with PLAN_GROUPS being part of the lib API.
export type { PlanGroupId };
