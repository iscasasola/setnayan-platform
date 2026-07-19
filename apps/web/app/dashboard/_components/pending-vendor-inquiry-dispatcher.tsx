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
          // System batch-flush of a previously-saved pick — exempt from the
          // Phase-A manual velocity gate (a legit shortlist flush, not spam).
          source: 'system',
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
        }
        // ANY non-ok (no_event before onboarding finishes, not_secured, or an
        // 'error' status — which startServiceInquiry also returns for a TRANSIENT
        // chat_threads upsert blip, not just a terminal bad stash) LEAVES the
        // stash so a later dashboard load retries. The composed message is the
        // only copy (no server-side anon lead), so we never clear on a failure we
        // can't prove is terminal — a genuinely dead stash (e.g. a removed
        // service) is instead reaped by the 48h TTL in readPendingVendorInquiry.
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
