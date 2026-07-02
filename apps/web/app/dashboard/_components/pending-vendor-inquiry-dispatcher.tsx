'use client';

/**
 * PendingVendorInquiryDispatcher — replays the compose-first inquiry a visitor
 * composed on a vendor profile before they had an account/event (see
 * lib/pending-vendor-inquiry + v/[slug]/_components/anon-inquiry-composer).
 *
 * Mounted once in the couple dashboard layout. On first mount, if a stashed
 * inquiry exists AND the viewer is a secured (non-anonymous) couple, it fires
 * the normal startServiceInquiry action for that specific vendor, clears the
 * stash, and opens the thread. Anything other than success (not_secured /
 * no_event / error) LEAVES the stash so a later dashboard load retries — e.g. an
 * anonymous couple who lands here first secures their account, then it fires.
 *
 * Best-effort + idempotent: startServiceInquiry dedupes on the chat_threads
 * UNIQUE(event_id, vendor_profile_id) constraint, so a re-run can't double-send.
 * Returns null — no UI.
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { startServiceInquiry } from '@/app/v/[slug]/inquiry-actions';
import {
  readPendingVendorInquiry,
  clearPendingVendorInquiry,
} from '@/lib/pending-vendor-inquiry';

export function PendingVendorInquiryDispatcher({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (!enabled || ran.current) return;
    const pending = readPendingVendorInquiry();
    if (!pending) return;
    ran.current = true;

    let cancelled = false;
    void (async () => {
      try {
        const result = await startServiceInquiry({
          vendorProfileId: pending.vendorProfileId,
          initialServiceId: pending.serviceId,
          initialCategoryKey: pending.categoryKey ?? null,
          alsoServiceIds: [],
          requirements: {
            payload: {},
            specialRequest: pending.message || null,
            autoSend: false,
          },
        });
        if (cancelled) return;
        if (result.status === 'ok') {
          clearPendingVendorInquiry();
          router.push(`/dashboard/${result.eventId}/messages/${result.threadId}`);
        } else if (result.status === 'error') {
          // Terminal (stale/invalid stash) — won't succeed on retry, so drop it.
          clearPendingVendorInquiry();
        }
        // no_event (onboarding not finished) → keep the stash; a later load,
        // once an event exists, retries and sends it.
      } catch {
        // Non-fatal — the couple can always inquire again from the profile.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, router]);

  return null;
}
