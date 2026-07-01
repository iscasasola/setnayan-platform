import Link from 'next/link';
import { displayServiceLabel } from '@/lib/vendors';
import type { VendorServiceRow } from '@/lib/vendor-services';
import { buildPerformanceHref, type MomentumParam } from './perf-links';
import { ServiceScopeSelectClient } from './service-scope-select-client';

/**
 * Service-scope selector for My Performance — "All services" + one control per
 * ACTIVE service. Lets a multi-service vendor read the bookings-derived cards
 * (Momentum, ROI, booked count) segmented to a single service; the shop-level
 * cards wear an "across all services" note when a service is picked.
 *
 * FORM factor (owner: 44px targets, no horizontal scroll thrash):
 *   • ≤4 active services → accessible pill tablist (role=tablist/tab +
 *     aria-selected), server-rendered <Link>s (no client JS).
 *   • ≥5 active services → a native <select> (client wrapper) so the control
 *     stays compact instead of wrapping into many rows.
 *
 * The page only renders this when there are 2+ active services (showSelector);
 * a single/zero-service vendor never sees it. Every option/link preserves the
 * active momentum window via buildPerformanceHref.
 *
 * LABELS: title (fallback: the category's display label). Same-label services
 * are disambiguated with a trailing "(2)", "(3)" … so two "Photo Booth"
 * listings stay distinguishable.
 */

/** One resolved, collision-safe option. */
type ScopeOption = { id: string; label: string };

/**
 * Build display labels for the active services, disambiguating duplicates.
 * A service's base label is its title (trimmed), else the category's display
 * label. When two services share a base label they get a "(n)" suffix in the
 * services' existing order so each remains uniquely identifiable.
 */
function buildScopeOptions(services: VendorServiceRow[]): ScopeOption[] {
  const baseLabel = (s: VendorServiceRow): string =>
    s.title?.trim() || displayServiceLabel(s.category);

  // Count how many services share each base label (case-insensitive).
  const counts = new Map<string, number>();
  for (const s of services) {
    const key = baseLabel(s).toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  return services.map((s) => {
    const base = baseLabel(s);
    const key = base.toLowerCase();
    if ((counts.get(key) ?? 0) > 1) {
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      return { id: s.vendor_service_id, label: `${base} (${n})` };
    }
    return { id: s.vendor_service_id, label: base };
  });
}

/** The label of the currently-selected service (for scope-labelled cards). */
export function scopeLabelFor(
  services: VendorServiceRow[],
  serviceId: string | null,
): string | null {
  if (!serviceId) return null;
  const opts = buildScopeOptions(services);
  return opts.find((o) => o.id === serviceId)?.label ?? null;
}

export function ServiceScopeSelector({
  activeServices,
  activeServiceId,
  momentum,
}: {
  /** The vendor's ACTIVE service rows (is_active). Caller guarantees 2+. */
  activeServices: VendorServiceRow[];
  /** Currently-selected service id, or null for All services. */
  activeServiceId: string | null;
  /** Active momentum window — preserved across every option. */
  momentum: MomentumParam;
}) {
  const options = buildScopeOptions(activeServices);
  const usePills = activeServices.length <= 4;

  if (!usePills) {
    // Native select for 5+ services. Prepend the All-services option.
    const selectOptions = [
      { value: '', label: 'All services' },
      ...options.map((o) => ({ value: o.id, label: o.label })),
    ];
    return (
      <div className="pt-1">
        <ServiceScopeSelectClient
          activeServiceId={activeServiceId}
          momentum={momentum}
          options={selectOptions}
        />
      </div>
    );
  }

  // Pill tablist for ≤4 services.
  return (
    <div
      role="tablist"
      aria-label="Filter performance by service"
      className="flex flex-wrap gap-2 pt-1"
    >
      <ScopePill
        label="All services"
        href={buildPerformanceHref({ service: null, momentum })}
        active={activeServiceId === null}
      />
      {options.map((o) => (
        <ScopePill
          key={o.id}
          label={o.label}
          href={buildPerformanceHref({ service: o.id, momentum })}
          active={activeServiceId === o.id}
        />
      ))}
    </div>
  );
}

function ScopePill({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      role="tab"
      aria-selected={active}
      className="inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-medium transition-colors"
      style={
        active
          ? { background: 'var(--m-ink)', color: 'var(--m-paper)', borderColor: 'var(--m-ink)' }
          : { background: 'var(--m-paper)', color: 'var(--m-slate)', borderColor: 'var(--m-line)' }
      }
    >
      {label}
    </Link>
  );
}
