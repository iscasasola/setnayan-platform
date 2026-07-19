import { headers } from 'next/headers';

/**
 * Where a Services-editing server action should send the vendor back.
 *
 * The Services editor lives inside the "Your services" collapsible on
 * `/vendor-dashboard/shop` (owner 2026-07-02: "My Services" fully folded into My
 * Shop). It's rendered by the shared `VendorServicesManager`. A server action
 * can't see which surface it was submitted from except via the request Referer,
 * so we read it and return the vendor to the same surface.
 *
 * Allowlisted to known vendor paths → never an open redirect. The default is My
 * Shop: the standalone `/vendor-dashboard/services` route now redirects there,
 * so every services edit (including the guided-wizard save, whose Referer is the
 * wizard route) funnels through My Shop.
 */
export async function servicesReturnBase(): Promise<string> {
  try {
    const ref = (await headers()).get('referer');
    if (ref) {
      const { pathname } = new URL(ref);
      if (
        pathname === '/vendor-dashboard/shop' ||
        pathname.startsWith('/vendor-dashboard/shop/')
      ) {
        return '/vendor-dashboard/shop';
      }
    }
  } catch {
    /* fall through to the default */
  }
  return '/vendor-dashboard/shop';
}
