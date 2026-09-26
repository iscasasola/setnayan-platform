import type { ReactNode } from 'react';
import Link from 'next/link';
import { Globe } from 'lucide-react';
import { PaidMark } from '@/app/_components/paid-mark';
import { paidMarkLabel, paidMarkState } from '@/lib/paid-mark';
import { TIER_LABEL, type VendorTier } from '@/lib/vendor-tier-caps';
import { isStoreShellRequest } from '@/lib/request-platform';

/*
 * 🔒 THE APP STORE / PLAY STORE SHELL IS NOT TOLD TO UPGRADE. A vendor plan is
 * a paid subscription, sold on the web only (DECISION_LOG 2026-06-11), and the
 * store shell is refused /vendor-dashboard/subscription outright — so an
 * "Upgrade" button there was a dead end at /web-only AND a call to action for a
 * purchase the app cannot make (guideline 3.1.1; lib/store-shell.ts). In the
 * store shell the gate says plainly that the feature is not in the app, and the
 * inline teaser does not render at all. Web, PWA and desktop are unchanged.
 */

/**
 * Upsell panel shown in place of a tier-gated dashboard surface (hybrid gating,
 * owner 2026-07-01). A gated vendor lands here instead of being silently
 * bounced — the feature is named, its value restated, and the upgrade CTA
 * points at the self-serve subscription flow. Only rendered when the master
 * flag is on AND the vendor's tier lacks the cap (see lib/vendor-feature-gate).
 */
export async function VendorTierGate({
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
  const storeShell = await isStoreShellRequest();
  // 🔒 The padlock is a purchase hint — absent in the store shell (paidMarkState
  // answers null there), where the gate only says the feature is web-only.
  const mark = paidMarkState({ owns: false, storeShell });
  const label = paidMarkLabel('locked', TIER_LABEL[requiredTier]);
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-ink/10 bg-ink/[0.02] px-6 py-14 text-center">
        <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
          {icon ?? (mark ? (
            <PaidMark state={mark} label={label} size="lg" tone="current" />
          ) : (
            <Globe aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          ))}
          {icon && mark ? (
            <span className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink text-cream">
              <PaidMark state={mark} label={label} size="xs" tone="current" />
            </span>
          ) : null}
        </span>
        {storeShell ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              {feature} is not part of the app
            </h1>
            <p className="max-w-sm text-sm text-ink/60">{blurb}</p>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </section>
  );
}

/**
 * INLINE tier teaser — a compact locked card shown IN PLACE of a single section
 * on a mixed-tier page (e.g. My Performance, where Solo sees some cards and a
 * teaser for the Pro / Enterprise ones). Unlike VendorTierGate it doesn't take
 * over the whole page; it slots into the section flow so the vendor sees exactly
 * what the next tier adds, in context. Only rendered when the master flag is on
 * AND the vendor's tier lacks the cap (see lib/vendor-feature-gate).
 */
export async function VendorTierTeaser({
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
  if (await isStoreShellRequest()) return null;
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-ink/15 bg-ink/[0.02] px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="relative mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          {icon ?? (
            <PaidMark state="locked" label={paidMarkLabel('locked', TIER_LABEL[requiredTier])} size="md" tone="current" />
          )}
        </span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
            {TIER_LABEL[requiredTier]}
          </p>
          <h3 className="text-sm font-semibold text-ink">{feature}</h3>
          <p className="mt-0.5 max-w-md text-xs text-ink/55">{blurb}</p>
        </div>
      </div>
      <Link
        href="/vendor-dashboard/subscription"
        className="inline-flex shrink-0 items-center rounded-full border border-ink/15 px-4 py-2 text-xs font-medium text-ink transition hover:bg-ink hover:text-cream"
      >
        Unlock with {TIER_LABEL[requiredTier]}
      </Link>
    </div>
  );
}
