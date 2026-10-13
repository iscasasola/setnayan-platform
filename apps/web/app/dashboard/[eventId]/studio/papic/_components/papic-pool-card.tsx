import { Users } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchEventPoolStatus } from '@/lib/papic-event-pool';
import { papicBucketPhrase } from '@/lib/papic-tier-copy';
import { loadPoolRungs } from '@/lib/papic-pool-rungs';
import { PapicBuyForm } from './papic-buy-form';

/**
 * Papic POOL — add credits to the event's SHARED pool.
 *
 * ── WHY THIS EXISTS (2026-07-31) ─────────────────────────────────────────────
 * Papic Pool was ADVERTISED in two live places and buyable in none.
 *
 *   • The onboarding services card prints the whole ladder — "+3,000 ₱1,000 /
 *     +6,000 ₱2,000 / +10,000 ₱3,000" — and closes with "Top up any time from
 *     your Papic studio."
 *   • The Suite card says "add more any time" under a CTA reading "Open the
 *     pool ›".
 *
 * Both link here, to /studio/papic — which sold a dedicated One camera and
 * (until the same day) two retired per-camera rungs, and had no pool ladder at
 * all. The three `PAPIC_GUEST*` rows have been `is_active = true` at owner-set
 * prices since the 2026-07-29 two-type lock, and `grantPapicPassPoints` in
 * lib/sku-activation.ts has been wired to convert a paid one into a
 * `papic_event_point_grants` row the whole time. The ONLY missing link was a
 * doorway that mints the order. This is that doorway.
 *
 * The sibling `HostPoolMeterCard` is deliberately NOT that doorway: its header
 * says it "carries NO purchase copy or doorway", it is read-only, and it is
 * flag-dark behind NEXT_PUBLIC_PAPIC_POOL_BAR. So it could not have closed this
 * even when switched on. This card is the buy path; that one is the meter.
 *
 * ── THE SHAPE ────────────────────────────────────
 * Same contract, deliberately: rungs READ from `papic_pass_tiers` (admin-
 * editable, `is_active` filtered in the fetch), price READ from
 * `platform_retail_catalog_v2`, phrase from lib/papic-tier-copy. A rung whose
 * catalog row is missing, zero or inactive DISAPPEARS rather than rendering at
 * an invented price, and if none survive the card renders nothing instead of an
 * empty form. No literal peso figure or shot count appears in this file.
 *
 * ── POOL vs ONE, and why the copy leans on it ────────────────────────────────
 * These shots are SHARED: every guest who scans the event QR spends from the
 * same purse. That is the entire difference from a One camera's dedicated
 * balance, and a card that only quoted a number would sell the two as the same
 * product at different prices — which is exactly the confusion the 2026-07-30
 * naming lock ("only Papic Pool and Papic One") was written to end.
 */
const ERROR_COPY: Record<string, string> = {
  unknown_rung: 'That option is no longer available. Pick one of the sizes below.',
  unavailable: 'That option is not on sale right now. Try another size.',
  order_failed: "We couldn't start that order, so nothing was charged. Please try again.",
};

export async function PapicPoolCard({
  eventId,
  error,
}: {
  eventId: string;
  error?: string | null;
}) {
  const admin = createAdminClient();

  const [rungs, pool] = await Promise.all([
    // The ladder — rungs from papic_pass_tiers, prices from the catalog, sorted
    // by price (lib/papic-pool-rungs.ts, shared with Home's in-place Buy more).
    loadPoolRungs(admin),
    // Display only. Same reader the capture path meters against, so the balance
    // shown here and the fence that stops a shutter cannot disagree.
    fetchEventPoolStatus(admin, eventId).catch(() => null),
  ]);
  if (rungs.length === 0) return null;

  const remaining = pool?.applies === true ? pool.remainingPoints : null;

  return (
    <section className="space-y-4 rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
      <div className="space-y-1.5">
        <p className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
          <Users aria-hidden className="h-5 w-5 text-mulberry" strokeWidth={1.75} />
          Add credits to your event
        </p>
        {/* ⚠ THIS SENTENCE WAS A PROMISE WITH NOTHING BEHIND IT. It read "Every
            guest who scans your QR shoots from it" — which reads as ONE QR the
            couple prints and anyone scans. No such QR exists. Every Papic QR in
            the product is a per-SEAT claim link: single use, and the first
            scanner takes it. The genuine many-camera path is the guest list —
            each guest's own invite QR becomes their camera (syncGuestCameras) —
            so an event with no guest list has three single-use links and
            nothing else, which is exactly what the owner hit on 2026-08-01.
            The one-QR-for-everyone poster is a real build, deliberately queued
            behind an abuse decision (an open QR + a shared pool means one
            scanner can drain it). Until it ships, this says what is true. */}
        <p className="text-sm text-ink/70">
          One shared pot for the whole event. Every camera draws from it — each
          guest&rsquo;s own invite QR, plus the claim links you hand out — on any
          phone, with nothing to install. Add credits any time; they never expire
          before your day.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-700">
          {ERROR_COPY[error] ??
            'Something went wrong, and nothing was charged. Please try again.'}
        </p>
      )}

      {/* 📸 THE STOPPED LINE (owner 2026-10-13, "Add all"): at zero every
          guest camera has stopped, and that is said ABOVE the size picker —
          not left to a "0 credits left" a couple must interpret. */}
      {remaining === 0 ? (
        <p
          data-papic-stopped=""
          className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm font-medium text-red-700"
        >
          Your guests&rsquo; cameras have stopped — add credits to restart them.
        </p>
      ) : remaining != null && (
        <p className="text-sm text-ink/70">
          {remaining.toLocaleString('en-PH')} credits left in the pool —{' '}
          {papicBucketPhrase(remaining)}.
        </p>
      )}

      <PapicBuyForm eventId={eventId} rungs={rungs} />

      <p className="text-xs text-ink/50">
        Apply-then-pay — payment instructions next. Credits land in the pool once
        your payment is confirmed.
      </p>
    </section>
  );
}
