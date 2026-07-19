// ============================================================================
// TrustedCircleBadge — Person-spine · Phase 2 · COUNSEL-GATED · FLAG-OFF
//
// A reusable async SERVER component that renders a small "trusted by your
// circle" panel for one (host-event, marketplace-vendor) pair. It reads the
// private trusted-circle signal via getTrustedCircleVendorSignal, which:
//
//   • returns null WITHOUT touching the DB while the Phase-2 flag is OFF
//     (NEXT_PUBLIC_PEOPLE_CONNECTIONS !== '1' — the production default), and
//   • returns null for any caller who isn't the host of the event, or when
//     there's no explicit circle trust.
//
// So in production (flag off) this component renders NOTHING — the mount is
// inert, zero visible change. Every numeric field on the signal is already
// min-N-gated + degree-scoped server-side, so it's safe to render as-is.
//
// vendorProfileId MUST be a vendor_profiles primary id (the marketplace
// vendor), never an event_vendors id. See lib/trusted-circle-recs.ts.
// ============================================================================

import { HeartHandshake } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getTrustedCircleVendorSignal } from '@/lib/trusted-circle-recs';

type Props = {
  /** The host's event. */
  eventId: string;
  /** A vendor_profiles primary id (marketplace vendor), NOT an event_vendors id. */
  vendorProfileId: string;
};

/**
 * Summarize the named 1st-degree vouchers into a human phrase, e.g.
 * "Vouched for by Maria S." / "Vouched for by Maria S. and Ana R." /
 * "Vouched for by Maria S. and 2 others". Falls back to "Someone" for a
 * consented voucher with no display name.
 */
function vouchPhrase(vouchedBy: { displayName: string | null }[]): string {
  const names = vouchedBy.map((v) => v.displayName?.trim() || 'Someone');
  if (names.length === 1) return `Vouched for by ${names[0]}`;
  if (names.length === 2) return `Vouched for by ${names[0]} and ${names[1]}`;
  const others = names.length - 1;
  return `Vouched for by ${names[0]} and ${others} others`;
}

export async function TrustedCircleBadge({ eventId, vendorProfileId }: Props) {
  const supabase = await createClient();
  const signal = await getTrustedCircleVendorSignal(
    supabase,
    eventId,
    vendorProfileId,
  );

  // Invisible in production (flag off ⇒ null) and whenever there's no circle
  // trust to show. This is the single guard that keeps the mount inert.
  if (!signal || !signal.hasCircleTrust) return null;

  const {
    vouchedBy,
    connected1stCount,
    connected2ndCount,
    trustedReviewAvg,
    trustedReviewCount,
    nearRegionMatch,
    nearCoversEventType,
  } = signal;

  // Primary line: name explicit vouchers when we have them, otherwise the
  // min-N-gated aggregate of connected people who explicitly trusted them.
  const connectedTotal = connected1stCount + connected2ndCount;
  const primary =
    vouchedBy.length > 0
      ? vouchPhrase(vouchedBy)
      : `${connectedTotal} ${connectedTotal === 1 ? 'person' : 'people'} in your circle trusted this vendor`;

  // Muted context line — rating + near-match hints, only when present.
  const contextBits: string[] = [];
  if (trustedReviewAvg !== null && trustedReviewCount > 0) {
    contextBits.push(
      `${trustedReviewAvg.toFixed(1)}★ from ${trustedReviewCount} ${
        trustedReviewCount === 1 ? 'review' : 'reviews'
      }`,
    );
  }
  if (nearRegionMatch) contextBits.push('near your event');
  if (nearCoversEventType) contextBits.push('covers your event type');
  const context = contextBits.join(' · ');

  return (
    <div className="flex items-start gap-3 rounded-xl border border-ink/10 bg-cream px-4 py-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink/10 bg-white/60 text-ink/70">
        <HeartHandshake aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 space-y-0.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
          Trusted by your circle
        </p>
        <p className="text-sm font-medium text-ink">{primary}</p>
        {context ? <p className="text-xs text-ink/60">{context}</p> : null}
      </div>
    </div>
  );
}
