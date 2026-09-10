'use client';

/**
 * SubscriptionCards — client-rendered Pro / Enterprise plan cards.
 *
 * 🔑 ONE PRICE, AND NO POINTER TO A CHEAPER ONE (2026-09-06). This component
 * used to do two things that App Review rejects an app for. It showed native
 * users a "mobile SRP" marked up 1.5×, and above the cards it rendered a
 * banner — visible ONLY inside the app — reading "Buy on our website for less"
 * and linking out to setnayan.com. That is guideline 3.1.1 external steering,
 * and it also contradicted DECISION_LOG 2026-06-11, which locked vendor
 * subscription billing as web-only.
 *
 * The deleted banner's own docblock justified itself with a "post-2024 Apple
 * ruling" permitting external purchase links. That ruling covers the UNITED
 * STATES storefront only; the 2026-06-30 rejection letter spells out the rest
 * — "for storefronts where there are not alternative options … the app must
 * use in-app purchase." Setnayan ships to the Philippine storefront, so the
 * premise never applied to us.
 *
 * The route itself is now refused in the store shell (lib/store-shell.ts), so
 * these cards do not render there at all. The markup and the banner are gone
 * anyway rather than merely hidden: a component whose only purpose is to steer
 * app users to a web checkout should not exist to be re-mounted somewhere the
 * gate does not cover.
 *
 * The optional token-pack ADD-ON selector was REMOVED 2026-08-07 with the rest
 * of the token currency (owner 2026-07-21: "token can retire, there should be
 * nothing that needs token anymore"). Every pack is inactive in the catalog, so
 * the selector already rendered empty — but an empty selector is one catalog
 * row away from offering a currency that buys nothing.
 *
 * The price shown is the admin-set price from `vendor_billing_catalog`, the
 * same one `startSubscriptionPurchase` charges through the DB RPC. There is no
 * second, channel-dependent price any more.
 */

import Link from 'next/link';
import { Check, Lock } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { startSubscriptionPurchase } from '../actions';

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
  capLines: string[];
  isCurrent: boolean;
  isPaid: boolean;
  /**
   * Set when this plan's term is SHORTER than the time the shop already holds,
   * to the sentence explaining it (owner 2026-08-27: *"they cannot purchase a
   * smaller timeline"*). The card then shows that sentence where its button
   * would be.
   *
   * ⚠ NOT THE RULE — `create_vendor_subscription` refuses the purchase in the
   * database. This only stops a shop meeting the refusal after choosing. A
   * disabled button is a courtesy; the server is the gate.
   */
  tooShortReason?: string | null;
}

export function SubscriptionCards({
  cards,
  cycle,
  verified,
}: {
  cards: SubscriptionCardData[];
  cycle: 'monthly' | 'annual';
  /**
   * `vendor_profiles.verification_state === 'verified'`. Mirrors the DB's own
   * NOT_VERIFIED gate in `create_vendor_subscription` — this prop only decides
   * what the card SHOWS; the refusal itself stays in the database, so a stale or
   * spoofed `true` still cannot buy a plan.
   */
  verified: boolean;
}) {
  return (
    <>
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
          'Your own shop page',
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
          const displayPrice = card.price;
          // Small-unit framing (owner-directed): show the SAME admin-set price
          // broken down per day/week so the headline reads lighter. Pure
          // derivation of displayPrice — not a separate price. 28-day block ÷ 28
          // (÷4 wk); annual ÷ 365 (÷52 wk).
          const perDay = Math.round(displayPrice / (cycle === 'monthly' ? 28 : 365));
          const perWeek = Math.round(displayPrice / (cycle === 'monthly' ? 4 : 52));
          const baseLabel = card.isPaid
            ? card.isCurrent
              ? 'Renew this plan'
              : `Switch to ${TIER_NAME[card.tier]}`
            : `Upgrade to ${TIER_NAME[card.tier]}`;
          return (
            <section
              key={card.sku}
              className="sn-tile flex flex-col p-6"
              style={
                card.tier === 'pro'
                  ? { borderColor: 'var(--m-orange)' }
                  : undefined
              }
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="sn-eye">{TIER_NAME[card.tier]}</p>
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
                  Save 20% vs paying monthly
                </p>
              )}
              {/* The "Includes N free tokens each period" line was removed
                  2026-08-07. Owner lock 2026-07-21: "token can retire, there
                  should be nothing that needs token anymore." A plan card is
                  where a vendor decides what to pay for, so it is the worst
                  place of all to still promise a currency that buys nothing. */}

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

              {/* ── SAY THE RULE BEFORE THE CLICK, NOT AFTER ─────────────────
                  `create_vendor_subscription` raises NOT_VERIFIED for a shop
                  that isn't approved, and the action turns that into "Verify
                  your shop before subscribing". The rule is right and enforced
                  in the database — but until 2026-08-09 this card still showed a
                  live Upgrade button to an unverified vendor, so the only way to
                  learn the rule was to pick a plan and be refused. A gate the
                  screen doesn't mention is indistinguishable from a bug. */}
              {/* The same rule, one step further: a plan shorter than the time
                  the shop already holds cannot be bought at all (owner
                  2026-08-27). The database refuses it; this says so BEFORE the
                  click, so nobody picks a plan only to be turned away. */}
              {verified && card.tooShortReason ? (
                <p
                  className="mt-5 rounded-md border px-3 py-2.5 text-sm text-ink/70"
                  style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
                >
                  {card.tooShortReason}
                </p>
              ) : verified ? (
                <form action={startSubscriptionPurchase} className="mt-5">
                  <input type="hidden" name="sku_code" value={card.sku} />
                  <SubmitButton
                    className="button-primary w-full"
                    pendingLabel="Starting…"
                  >
                    {baseLabel}
                  </SubmitButton>
                </form>
              ) : (
                <div className="mt-5 space-y-2">
                  <Link
                    href="/vendor-dashboard/shop#get-verified"
                    className="button-primary flex w-full items-center justify-center gap-1.5"
                  >
                    <Lock className="h-4 w-4" strokeWidth={2} aria-hidden />
                    Get verified first
                  </Link>
                  <p className="text-center text-xs text-ink/55">
                    Plans open up once Setnayan approves your shop.
                  </p>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
