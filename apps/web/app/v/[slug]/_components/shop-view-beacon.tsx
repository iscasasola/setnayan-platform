'use client';

import { useEffect, useRef } from 'react';
import { recordVendorProfileView } from '@/lib/record-vendor-view';

/**
 * ⚡ ONE VIEW PER OPEN OF A CACHED SHOP PAGE (speed, 2026-11-10 · lib/shop-view.ts).
 *
 * The live render counts its view with `after()` — once per render, which was once per open. The cached copy
 * (`app/v/[slug]/cached/page.tsx`) is rendered once and opened many times, so the open counts itself here, through
 * the SAME action and the same row (`recordVendorProfileView` → `vendor_profile_views`, the funnel's VIEWS stage).
 * The campaign tags the server would have read are read off the address (`SHOP_BEACON_PARAMS`); `src` never reaches a
 * cached copy (it is a live param), so the source is the live render's own default. Draws nothing.
 */
export function ShopViewBeacon({ vendorProfileId }: { vendorProfileId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    let utm: string | null = null;
    try {
      const q = new URLSearchParams(window.location.search);
      const source = q.get('utm_source');
      const medium = q.get('utm_medium');
      const campaign = q.get('utm_campaign');
      utm =
        q.get('utm') ??
        (source || medium || campaign
          ? [
              source ? `utm_source=${source}` : null,
              medium ? `utm_medium=${medium}` : null,
              campaign ? `utm_campaign=${campaign}` : null,
            ]
              .filter(Boolean)
              .join('&')
          : null);
    } catch {
      /* no address to read — an un-tagged view */
    }
    void recordVendorProfileView({ vendorProfileId, source: 'profile_direct', utm, eventId: null }).catch(() => {});
  }, [vendorProfileId]);
  return null;
}
