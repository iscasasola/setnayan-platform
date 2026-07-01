import type { ReactNode } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { TIER_LABEL, type VendorTier } from '@/lib/vendor-tier-caps';

/**
 * Upsell panel shown in place of a tier-gated dashboard surface (hybrid gating,
 * owner 2026-07-01). A gated vendor lands here instead of being silently
 * bounced — the feature is named, its value restated, and the upgrade CTA
 * points at the self-serve subscription flow. Only rendered when the master
 * flag is on AND the vendor's tier lacks the cap (see lib/vendor-feature-gate).
 */
export function VendorTierGate({
  feature,
  requiredTier,
  blurb,
  icon,
}: {
  feature: string;
  requiredTier: VendorTier;
  blurb: string;
  icon?: ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-ink/10 bg-ink/[0.02] px-6 py-14 text-center">
        <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
          {icon ?? <Lock aria-hidden className="h-5 w-5" strokeWidth={1.75} />}
          <span className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink text-cream">
            <Lock aria-hidden className="h-3 w-3" strokeWidth={2} />
          </span>
        </span>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          {TIER_LABEL[requiredTier]} feature
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {feature} unlocks with {TIER_LABEL[requiredTier]}
        </h1>
        <p className="max-w-sm text-sm text-ink/60">{blurb}</p>
        <Link
          href="/vendor-dashboard/subscription"
          className="mt-1 inline-flex items-center rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream transition hover:bg-ink/90"
        >
          Upgrade to {TIER_LABEL[requiredTier]}
        </Link>
        <p className="text-xs text-ink/40">
          Everything you have today stays free — this only adds {feature.toLowerCase()}.
        </p>
      </div>
    </section>
  );
}
