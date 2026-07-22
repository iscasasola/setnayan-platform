'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Lock, Store } from 'lucide-react';
import { useToast } from '@/app/_components/toast/toast-provider';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  activateVendor3dBooth,
  type Vendor3dBoothActionState,
} from '../booth-addon-actions';

/**
 * 3D Booth add-on card — the sellable surface on the subscription hub
 * (owner-locked 2026-07-22). Free first 28-day cycle, then ₱1,500 / 28 days, on
 * Pro / Enterprise / Custom + verified shops only. When active, the vendor's
 * booth renders BRANDED (logo + poster) inside their couples' published 3D
 * Plans; without it a Pro/Enterprise vendor keeps the generic booth.
 *
 * Honest states (mirror the Vendor AI add-on card):
 *   • not eligible (below Pro OR unverified) → a muted upsell, no CTA.
 *   • eligible + trial available → "Turn on 3D Booth — free first cycle".
 *   • eligible + active → live chip + "active through …" + a Renew button.
 *   • eligible + trial used, not active → "Reactivate — ₱1,500 / 28 days".
 *
 * The buy CTA opens an apply-then-pay order (BDO/GCash) that a Setnayan admin
 * confirms; the FREE first cycle activates instantly.
 */

const IDLE: Vendor3dBoothActionState = { status: 'idle' };
const peso = (n: number) => '₱' + n.toLocaleString('en-PH');

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export type BoothAddonCardProps = {
  /** Pro+ (Pro / Enterprise / Custom) AND verified — the only shops that can buy. */
  eligible: boolean;
  /** True while the shop is on a Pro+ tier but NOT yet verified. */
  paidButUnverified: boolean;
  /** booth_addon_trial_used_at IS NULL — the free first cycle is still available. */
  trialAvailable: boolean;
  /** isVendor3dBoothActive(booth_addon_expires_at). */
  active: boolean;
  /** booth_addon_expires_at, when set. */
  expiresAt: string | null;
  /** Standing renewal price (₱1,500) from the admin-managed catalog. */
  pricePhp: number;
};

export function BoothAddonCard(props: BoothAddonCardProps) {
  const { eligible, paidButUnverified, trialAvailable, active, expiresAt, pricePhp } = props;

  const toast = useToast();
  const router = useRouter();
  const [state, formAction] = useActionState(activateVendor3dBooth, IDLE);
  const handled = useRef<Vendor3dBoothActionState | null>(null);

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state.status === 'error') toast.error(state.message);
    if (state.status === 'activated') {
      toast.success(state.message);
      router.refresh();
    }
  }, [state, toast, router]);

  return (
    <section className="sn-tile mt-8 p-6">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
        >
          <Store className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-ink">3D Booth — your branded virtual booth</h2>
            {active ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 text-xs font-medium text-success-800">
                <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                Active
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-prose text-sm text-ink/65">
            Put your logo and artwork on a virtual booth that shows up inside your
            couples&rsquo; published 3D seating plans — so their guests walk past
            your brand while they explore the venue. Without it your booth stays
            generic.
          </p>
          <p className="mt-2 text-sm font-medium text-ink">
            {trialAvailable ? (
              <>Free first 28-day cycle, then {peso(pricePhp)} / 28 days.</>
            ) : (
              <>{peso(pricePhp)} / 28 days.</>
            )}
          </p>
          {active && expiresAt ? (
            <p className="mt-0.5 text-xs text-ink/55">Active through {fmtDate(expiresAt)}.</p>
          ) : null}
        </div>
      </div>

      {/* ── Eligibility-gated CTA ─────────────────────────────────────────── */}
      {!eligible ? (
        <div
          className="mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs text-ink/60"
          style={{ borderColor: 'var(--m-line)' }}
        >
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          {paidButUnverified ? (
            <span>Get your shop verified to unlock 3D Booth — it&rsquo;s a verified-only add-on.</span>
          ) : (
            <span>3D Booth is available on the Pro, Enterprise, and Custom plans. Upgrade above to add it.</span>
          )}
        </div>
      ) : (
        <form action={formAction} className="mt-4">
          {/* The paid path needs a pay channel; the free first cycle ignores it. */}
          {!trialAvailable ? (
            <fieldset className="mb-3">
              <legend className="text-xs font-medium text-ink">Pay with</legend>
              <div className="mt-1.5 flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-1.5 text-sm text-ink/80">
                  <input type="radio" name="channel" value="bdo" defaultChecked />
                  BDO
                </label>
                <label className="inline-flex items-center gap-1.5 text-sm text-ink/80">
                  <input type="radio" name="channel" value="gcash" />
                  GCash
                </label>
              </div>
            </fieldset>
          ) : null}

          <SubmitButton
            className="inline-flex items-center gap-1.5 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta/90"
            pendingLabel={trialAvailable ? 'Turning on…' : 'Starting…'}
          >
            {trialAvailable
              ? 'Turn on 3D Booth — free first cycle'
              : active
                ? `Renew — ${peso(pricePhp)} / 28 days`
                : `Reactivate — ${peso(pricePhp)} / 28 days`}
          </SubmitButton>

          {/* Apply-then-pay instructions after a paid order was started. */}
          {state.status === 'ordered' ? (
            <div className="mt-4 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-900">
              <p className="font-mono text-lg font-bold">{peso(state.amountPhp)}</p>
              <p className="mt-1">
                Pay to our BDO or GCash account and put{' '}
                <span className="font-mono font-semibold">{state.referenceCode}</span> in the
                transfer note. 3D Booth switches on once our team confirms your
                payment (within 24 hours).
              </p>
            </div>
          ) : null}
        </form>
      )}
    </section>
  );
}
