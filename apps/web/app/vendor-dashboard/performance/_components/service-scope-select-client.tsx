'use client';

import { useRouter } from 'next/navigation';
import { buildPerformanceHref, type MomentumParam } from './perf-links';

/**
 * Native <select> variant of the service-scope control, used when the vendor
 * has 5+ active services (pills would wrap too far). Client-only because a
 * <select> needs an onChange handler; it router.push()es the canonical
 * My Performance href, preserving the active momentum window.
 *
 * Value '' = All services (default → the URL drops ?service). Any other value
 * is a vendor_service_id already validated as owned + active by the server.
 */
export function ServiceScopeSelectClient({
  activeServiceId,
  momentum,
  options,
}: {
  /** Currently selected service id, or null for All services. */
  activeServiceId: string | null;
  /** Active momentum window to preserve across the navigation. */
  momentum: MomentumParam;
  /** { value: serviceId, label } — the '' All-services option is prepended here. */
  options: { value: string; label: string }[];
}) {
  const router = useRouter();

  return (
    <select
      aria-label="Filter performance by service"
      value={activeServiceId ?? ''}
      onChange={(e) => {
        const value = e.target.value;
        router.push(
          buildPerformanceHref({ service: value || null, momentum }),
          { scroll: false },
        );
      }}
      className="min-h-[44px] rounded-lg border bg-white px-3 py-2 text-sm font-medium"
      style={{ borderColor: 'var(--m-line)', color: 'var(--m-ink)' }}
    >
      {options.map((o) => (
        <option key={o.value || '__all__'} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
