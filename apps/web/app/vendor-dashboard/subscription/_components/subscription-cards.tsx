'use client';

/**
 * SubscriptionCards — client-rendered Pro / Enterprise plan cards.
 *
 * Extracted from the server-rendered subscription page to enable
 * Capacitor detection (isNativeApp()) for mobile SRP pricing display.
 *
 * COMBINED PURCHASE (2026-07-01 · owner "1 purchase for both")
 *   An optional token-pack ADD-ON selector lets the vendor fold tokens into the
 *   SAME plan order — one payment, one SUB- reference, one admin approval
 *   activates the tier AND credits the tokens. The selection posts as a hidden
 *   `addon_token_pack_sku` on whichever plan form the vendor submits; the DB RPC
 *   re-reads the add-on price + count (never trusts the client). Standalone
 *   top-ups still live in the Token packs card below.
 *
 * MOBILE CHANNEL PRICING (SRP)
 *   Pro:        ₱9,000/28d  · ₱90,000/yr   (1.5× web)
 *   Enterprise: ₱15,000/28d · ₱150,000/yr  (1.5× web)
 *
 * The "Buy on web for less" banner guides vendors to the web checkout where
 * canonical DB prices apply. The server action (startSubscriptionPurchase)
 * always uses the sku_code so the DB RPC reads the authoritative price —
 * the SRP display is informational only.
 *
 * If the admin reprices a tier in vendor_billing_catalog, the web price
 * changes and the mobile SRP scales proportionally (MOBILE_SRP_MULTIPLIER).
 */

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { WebNudgeBanner } from '@/app/vendor-dashboard/_components/web-nudge-banner';
import { isNativeApp } from '@/lib/capacitor';
import type { TokenPack } from '@/app/vendor-dashboard/tokens/_components/buy-tokens-cta';
import { startSubscriptionPurchase } from '../actions';

const MOBILE_SRP_MULTIPLIER = 1.5;

const NUMBER = new Intl.NumberFormat('en-PH');

// Button-label tier names — keyed on the actual card tier so the CTA never
// mislabels (was a pro/Enterprise ternary that named a Solo card "Enterprise").
const TIER_NAME: Record<SubscriptionCardData['tier'], string> = {
  solo: 'Solo',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export interface SubscriptionCardData {
  tier: 'solo' | 'pro' | 'enterprise';
  sku: string;
  pitch: string;
  price: number;          // DB / web price in PHP
  cycle: 'monthly' | 'annual';
  bundleTokens: number;
  capLines: string[];
  isCurrent: boolean;
  isPaid: boolean;
}

function mobileSrp(webPrice: number): number {
  // Round to nearest ₱500 for clean display on subscription amounts.
  return Math.round((webPrice * MOBILE_SRP_MULTIPLIER) / 500) * 500;
}

export function SubscriptionCards({
  cards,
  cycle,
  packs = [],
}: {
  cards: SubscriptionCardData[];
  cycle: 'monthly' | 'annual';
  /** Token packs available to fold into a plan order as an optional add-on. */
  packs?: TokenPack[];
}) {
  const [native, setNative] = useState(false);
  // '' = no add-on. The selection applies to whichever plan card is submitted.
  const [addonSku, setAddonSku] = useState('');

  useEffect(() => {
    setNative(isNativeApp());
  }, []);

  const addonPack = packs.find((p) => p.sku_code === addonSku) ?? null;
  // Keep the add-on's displayed price on the same basis as the plan headline
  // (native shows SRP). Display-only — the DB re-prices from the catalog.
  const addonDisplayPrice = addonPack
    ? native
      ? Math.round(addonPack.price_php * MOBILE_SRP_MULTIPLIER)
      : addonPack.price_php
    : 0;

  return (
    <>
      {native && (
        <WebNudgeBanner
          savingsCopy="up to 33% off"
          webPricesCopy="Solo ₱999/28d · Pro ₱2,499/28d · Enterprise ₱7,499/28d on web"
          webUrl="https://setnayan.com/vendor-dashboard/subscription"
        />
      )}

      {packs.length > 0 && (
        <div
          className="mb-4 rounded-xl border p-4"
          style={{ background: 'var(--m-paper)', borderColor: 'var(--m-line)' }}
        >
          <label className="block space-y-1">
            <span className="block text-[11px] font-medium text-ink/70">
              Bundle tokens with your plan — optional
            </span>
            <select
              value={addonSku}
              onChange={(e) => setAddonSku(e.target.value)}
              className="input-field cursor-pointer text-sm"
            >
              <option value="">No tokens — plan only</option>
              {packs.map((p) => (
                <option key={p.sku_code} value={p.sku_code}>
                  {NUMBER.format(p.token_count)} tokens · ₱
                  {NUMBER.format(
                    native
                      ? Math.round(p.price_php * MOBILE_SRP_MULTIPLIER)
                      : p.price_php,
                  )}
                </option>
              ))}
            </select>
            <span className="block text-[11px] text-ink/50">
              Bought together with your plan — one payment, one reference code.
              Purchased tokens never expire.
            </span>
          </label>
        </div>
      )}

      {/* Shared benefits — true for every paid plan, so shown once here instead
          of repeated on all three cards (keeps each card to its differentiators). */}
      <div
        className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border px-4 py-3 text-xs text-ink/70"
        style={{ background: 'var(--m-paper)', borderColor: 'var(--m-line)' }}
      >
        <span className="font-medium text-ink/80">Every plan includes</span>
        {[
          'Real business name shown day one',
          'Unlimited in-app inquiries',
          'Listed in marketplace search',
          'Your own event website',
        ].map((line) => (
          <span key={line} className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 shrink-0 text-success-600" strokeWidth={2.25} aria-hidden />
            {line}
          </span>
        ))}
      </div>

      <div
        className={
          'grid gap-4 sm:gap-5 ' +
          (cards.length >= 3 ? 'md:grid-cols-3' : 'sm:grid-cols-2')
        }
      >
        {cards.map((card) => {
          const webPrice = card.price;
          const displayPrice = native ? mobileSrp(webPrice) : webPrice;
          // Small-unit framing (owner-directed): show the SAME admin-set price
          // broken down per day/week so the headline reads lighter. Pure
          // derivation of displayPrice — not a separate price. 28-day block ÷ 28
          // (÷4 wk); annual ÷ 365 (÷52 wk).
          const perDay = Math.round(displayPrice / (cycle === 'monthly' ? 28 : 365));
          const perWeek = Math.round(displayPrice / (cycle === 'monthly' ? 4 : 52));
          const orderTotal = displayPrice + addonDisplayPrice;
          const baseLabel = card.isPaid
            ? card.isCurrent
              ? 'Renew this plan'
              : `Switch to ${TIER_NAME[card.tier]}`
            : `Upgrade to ${TIER_NAME[card.tier]}`;
          return (
            <section
              key={card.sku}
              className="m-card flex flex-col p-6"
              style={
                card.tier === 'pro'
                  ? { borderColor: 'var(--m-orange)' }
                  : undefined
              }
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="m-label-mono">{TIER_NAME[card.tier]}</p>
                {card.isCurrent ? (
                  <span className="rounded-full bg-success-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-success-800">
                    Current
                  </span>
                ) : card.tier === 'pro' ? (
                  <span
                    className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-paper"
                    style={{ background: 'var(--m-orange)' }}
                  >
                    Recommended
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-ink/65">{card.pitch}</p>

              <p className="mt-4">
                <span className="text-3xl font-semibold text-ink">
                  ₱{NUMBER.format(displayPrice)}
                </span>
                <span className="text-sm text-ink/55">
                  {' '}
                  / {cycle === 'monthly' ? '28 days' : 'year'}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-ink/55">
                ≈ ₱{NUMBER.format(perDay)}/day · ₱{NUMBER.format(perWeek)}/week
              </p>
              {cycle === 'annual' && (
                <p className="mt-1 inline-flex w-fit items-center rounded-full bg-success-100 px-2 py-0.5 text-[11px] font-medium text-success-800">
                  Save 12 weeks vs paying monthly
                </p>
              )}
              {native && (
                <p className="mt-0.5 text-xs text-ink/50">
                  Web price: ₱{NUMBER.format(webPrice)}/
                  {cycle === 'monthly' ? '28d' : 'yr'}
                </p>
              )}
              {card.bundleTokens > 0 ? (
                <p className="mt-1 text-xs text-ink/55">
                  Includes {NUMBER.format(card.bundleTokens)} free tokens{' '}
                  {cycle === 'monthly' ? 'each period' : 'on activation'}.
                </p>
              ) : null}

              <ul className="mt-4 space-y-2">
                {card.capLines.map((line) => (
                  <li
                    key={line}
                    className="flex items-start gap-2 text-sm text-ink/75"
                  >
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-success-600"
                      strokeWidth={2.25}
                      aria-hidden
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              {addonPack && (
                <div
                  className="mt-4 flex items-center justify-between gap-2 rounded-md border-l-2 px-3 py-2 text-xs"
                  style={{
                    borderColor: 'var(--m-orange)',
                    background: 'rgba(201, 107, 58, 0.04)',
                    color: 'var(--m-ink)',
                  }}
                >
                  <span>
                    ＋ {NUMBER.format(addonPack.token_count)} tokens
                  </span>
                  <span className="font-medium">
                    You pay ₱{NUMBER.format(orderTotal)}
                  </span>
                </div>
              )}

              <form action={startSubscriptionPurchase} className="mt-5">
                <input type="hidden" name="sku_code" value={card.sku} />
                <input
                  type="hidden"
                  name="addon_token_pack_sku"
                  value={addonSku}
                />
                <SubmitButton
                  className="button-primary w-full"
                  pendingLabel="Starting…"
                >
                  {addonPack ? `${baseLabel} · pay ₱${NUMBER.format(orderTotal)}` : baseLabel}
                </SubmitButton>
              </form>
            </section>
          );
        })}
      </div>
    </>
  );
}
