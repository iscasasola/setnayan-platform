'use client';

/**
 * SubscriptionCards — client-rendered Pro / Enterprise plan cards.
 *
 * Extracted from the server-rendered subscription page to enable
 * Capacitor detection (isNativeApp()) for mobile SRP pricing display.
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
import { startSubscriptionPurchase } from '../actions';

const MOBILE_SRP_MULTIPLIER = 1.5;

const NUMBER = new Intl.NumberFormat('en-PH');

export interface SubscriptionCardData {
  tier: 'pro' | 'enterprise';
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
}: {
  cards: SubscriptionCardData[];
  cycle: 'monthly' | 'annual';
}) {
  const [native, setNative] = useState(false);

  useEffect(() => {
    setNative(isNativeApp());
  }, []);

  return (
    <>
      {native && (
        <WebNudgeBanner
          savingsCopy="up to 33% off"
          webPricesCopy="Pro ₱6,000/28d · Enterprise ₱10,000/28d on web"
          webUrl="https://setnayan.com/vendor-dashboard/subscription"
        />
      )}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {cards.map((card) => {
          const webPrice = card.price;
          const displayPrice = native ? mobileSrp(webPrice) : webPrice;
          return (
            <section
              key={card.sku}
              className="m-card flex flex-col p-6"
              style={
                card.tier === 'enterprise'
                  ? { borderColor: 'var(--m-orange)' }
                  : undefined
              }
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="m-label-mono">
                  {card.tier === 'pro' ? 'Pro' : 'Enterprise'}
                </p>
                {card.isCurrent && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-800">
                    Current
                  </span>
                )}
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
              {native && (
                <p className="mt-0.5 text-xs text-ink/50">
                  Web price: ₱{NUMBER.format(webPrice)}/
                  {cycle === 'monthly' ? '28d' : 'yr'}
                </p>
              )}
              <p className="mt-1 text-xs text-ink/55">
                Includes {NUMBER.format(card.bundleTokens)} free tokens{' '}
                {cycle === 'monthly' ? 'each period' : 'on activation'}.
              </p>

              <ul className="mt-4 space-y-2">
                {card.capLines.map((line) => (
                  <li
                    key={line}
                    className="flex items-start gap-2 text-sm text-ink/75"
                  >
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                      strokeWidth={2.25}
                      aria-hidden
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <form action={startSubscriptionPurchase} className="mt-5">
                <input type="hidden" name="sku_code" value={card.sku} />
                <SubmitButton
                  className="button-primary w-full"
                  pendingLabel="Starting…"
                >
                  {card.isPaid
                    ? card.isCurrent
                      ? 'Renew this plan'
                      : `Switch to ${card.tier === 'pro' ? 'Pro' : 'Enterprise'}`
                    : `Upgrade to ${card.tier === 'pro' ? 'Pro' : 'Enterprise'}`}
                </SubmitButton>
              </form>
            </section>
          );
        })}
      </div>
    </>
  );
}
