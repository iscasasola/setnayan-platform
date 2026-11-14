import type { ReactNode } from 'react';
import { ArrowUpRight, Globe } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
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
    // Design template (rules 1 · 2 · 3 · 13): no card and no big title — the page's name is in the pinned row. One
    // strong line, the reason in dark grey, ONE main button.
    <section className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6" data-tier-gate="">
      <div className="flex flex-col items-center gap-4 px-2 py-8 text-center">
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
            <p className="text-lg font-semibold tracking-tight text-ink">{feature} is not part of the app</p>
            <p className="max-w-sm text-sm text-ink/70">{blurb}</p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold tracking-tight text-ink">
              {feature} unlocks with {TIER_LABEL[requiredTier]}
            </p>
            <p className="max-w-sm text-sm text-ink/70">{blurb}</p>
            <ActionButton
              tone="brand"
              main
              icon={<ArrowUpRight aria-hidden strokeWidth={1.9} />}
              label={`Upgrade to ${TIER_LABEL[requiredTier]}`}
              href="/vendor-dashboard/subscription"
              className="mt-1 !h-11"
            />
            <p className="text-sm text-ink/70">
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
    // Design template (rules 2 · 3 · 5): a plain row on a hairline — the plan as a soft chip, the name bold, one grey
    // line, and an outlined button (the page's one main button is elsewhere).
    <div
      data-tier-teaser=""
      className="flex min-h-14 flex-col items-start gap-3 border-b border-ink/10 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <span className="relative mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          {icon ?? (
            <PaidMark state="locked" label={paidMarkLabel('locked', TIER_LABEL[requiredTier])} size="md" tone="current" />
          )}
        </span>
        <div>
          <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
            {feature}
            <Badge tone="quiet">{TIER_LABEL[requiredTier]}</Badge>
          </h3>
          <p className="mt-0.5 max-w-md text-sm text-ink/70">{blurb}</p>
        </div>
      </div>
      <ActionButton
        tone="brand"
        icon={<ArrowUpRight aria-hidden strokeWidth={1.9} />}
        label={`Unlock with ${TIER_LABEL[requiredTier]}`}
        href="/vendor-dashboard/subscription"
        className="shrink-0 !h-11"
      />
    </div>
  );
}
