/**
 * My Performance URL builder — keeps the two independent view params
 * (`service` scope + `momentum` window) in sync across every link on the page.
 *
 * WHY this exists: the Momentum toggle and the service-scope selector are BOTH
 * URL params on the same page. A naive `?momentum=year` link erases `?service`
 * (and vice-versa), silently dropping the user's other selection. Every link
 * that changes one param must preserve the other — so both route through here.
 *
 * DEFAULT OMISSION (clean URLs + one canonical shape per state):
 *   • momentum: 'month' is the default the page resolves to, so it's omitted —
 *     ?momentum only appears for 'day' / 'year'.
 *   • service: null/undefined = All services (the default) → omitted; a real
 *     service id appears as ?service=<id>.
 * With both at default the result is '' (a bare link back to the page).
 */

export type MomentumParam = 'day' | 'month' | 'year';

/**
 * Build the querystring for a My Performance link, preserving BOTH params and
 * omitting each at its default. Returns '' when both are default (bare link).
 */
export function buildPerformanceHref(params: {
  /** Selected service id, or null/undefined for All services (default). */
  service?: string | null;
  /** Momentum window; 'month' is the default and is omitted. */
  momentum?: MomentumParam | null;
}): string {
  const sp = new URLSearchParams();
  // Order: service first, then momentum — stable, canonical URL per state.
  if (params.service) sp.set('service', params.service);
  if (params.momentum && params.momentum !== 'month') {
    sp.set('momentum', params.momentum);
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}
