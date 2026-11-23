'use client';

/**
 * 🍎 THE PLAN DOOR IN THE iPHONE APP — Shop ⚙ › Plan and billing, where the store shell used to say only "You're on
 * Free." (owner-locked 22 Nov 2026, spec SUPPLIER_SUBSCRIPTIONS §3: "the plan doors that `data-web-only` hides today show
 * Apple buy buttons in the app. Never show or link the web price there").
 *
 * Plus · Pro · Ultra as the plan rows the Plan page draws (`DatesRow`, one hairline list), each with StoreKit's OWN price
 * (`displayPrice`) and one verb: Subscribe · Upgrade · Switch. The verb is the move (`supplierPlanMove`, item E): up lands
 * now, a lower plan when the paid month ends — Apple enforces both inside the "Supplier plans" group, and the note under
 * the rows says so. No figure of ours, no web word, no link out. A price StoreKit did not return leaves its button off.
 *
 * Drawn only where Apple can sell (`getIapGate().iap`), for a shop admin. The purchase's `appAccountToken` is issued by
 * the server for the session's own shop and paired with it (one subscription = one shop); the phone never names the
 * shop. One channel at a time: a shop the web bills reads when its plan
 * ends and gets no button. Unverified: the shared 🔒 (Get verified), the same as the Plan page.
 */
import { useState } from 'react';
import Link from 'next/link';
import { routes } from '@/lib/routes';
import { CreditCard, Gem, Sparkles } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { LockButton } from '@/app/_components/lock/locked-feature';
import { useToast } from '@/app/_components/toast/toast-provider';
import { DatesRow } from '../../customers/_components/dates-row';
import { useAppStorePrices } from '@/lib/iap/use-app-store-prices';
import { buySupplierPlanWithApple } from '@/lib/iap/supplier-plan-store';
import { IAP_COPY } from '@/lib/iap/iap-outcome';
import {
  SUPPLIER_PLAN_PRODUCTS,
  SUPPLIER_PLAN_PRODUCT_IDS,
  supplierPlanMove,
  supplierPlanProductById,
  type SupplierPlanProduct,
} from '@/lib/iap/supplier-plans';

export type ApplePlanDoorState =
  | { status: 'unread' }
  | {
      status: 'ok';
      channel: 'app_store' | 'web' | null;
      apple: {
        productId: string;
        status: 'active' | 'billing_retry' | 'expired' | 'refunded' | 'revoked';
        /** "22 Dec 2026" — formatted by the server. */
        endsOn: string | null;
        autoRenew: boolean | null;
        autoRenewProductId: string | null;
      } | null;
    };

const lead = (Icon: typeof Gem) => <Icon aria-hidden className="h-[18px] w-[18px] flex-none text-[color:var(--m-slate-2)]" strokeWidth={1.75} />;

export function ApplePlanDoor({
  currentTier,
  verified,
  papersProgress,
  planEndsOn,
  state,
}: {
  currentTier: string | null;
  verified: boolean;
  papersProgress: string;
  /** "8 Dec 2026" — when the shop's current (web-billed) plan ends; null when none. */
  planEndsOn: string | null;
  state: ApplePlanDoorState;
}) {
  const toast = useToast();
  const prices = useAppStorePrices(SUPPLIER_PLAN_PRODUCT_IDS, state.status === 'ok' && state.channel !== 'web');
  const [buying, setBuying] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (state.status === 'unread') {
    return (
      <p className="text-[13.5px] text-ink/60" role="alert" data-apple-plan-door="unread">
        We couldn&rsquo;t read your plan. Refresh in a moment to try again.
      </p>
    );
  }
  if (state.channel === 'web') {
    return (
      <p className="text-[13.5px] text-ink/60" data-apple-plan-door="other-channel">
        Your plan is already paid{planEndsOn ? ` until ${planEndsOn}` : ''}. You can choose a plan here once it ends.
      </p>
    );
  }

  const apple = state.apple && (state.apple.status === 'active' || state.apple.status === 'billing_retry') ? state.apple : null;
  const own = apple ? supplierPlanProductById(apple.productId) : null;
  const next = apple?.autoRenewProductId && apple.autoRenewProductId !== apple.productId ? supplierPlanProductById(apple.autoRenewProductId) : null;
  // A plan Apple already bills is the shop's plan, whatever the row says; otherwise the shop's tier decides the move.
  const fromTier = own?.tier ?? currentTier;

  const buy = (p: SupplierPlanProduct) => {
    if (buying) return;
    setBuying(p.productId);
    setMessage(null);
    void buySupplierPlanWithApple({ productId: p.productId }).then((screen) => {
      setBuying(null);
      if (screen.kind === 'on') toast.success(`${p.name} is on for your shop`);
      else if (screen.kind === 'pending') setMessage(screen.askToBuy ? IAP_COPY.askToBuy : `Apple confirmed ${p.name}. We’re switching it on for your shop now — it usually takes a moment.`);
      else if (screen.kind === 'cancelled') setMessage(IAP_COPY.cancelled);
      else if (screen.kind === 'failed') setMessage(`The App Store couldn’t complete this purchase. Nothing was charged, and your plan didn’t change. ${IAP_COPY.failedNext}`);
      else setMessage(screen.message);
    });
  };

  return (
    <div data-apple-plan-door="">
      {apple?.status === 'billing_retry' ? (
        <p className="pb-2 text-[13.5px] text-ink/70" role="alert" data-apple-plan-retry="">
          Apple couldn&rsquo;t renew {own?.name ?? 'your plan'}. Update your payment method in Settings › Apple ID and it renews by itself.
        </p>
      ) : null}
      {SUPPLIER_PLAN_PRODUCTS.map((p) => {
        const isOwn = own?.productId === p.productId;
        const price = prices.products.get(p.productId)?.displayPrice ?? null;
        const move = supplierPlanMove(fromTier, p.tier);
        const line = isOwn
          ? next
            ? `Changes to ${next.name}${apple?.endsOn ? ` on ${apple.endsOn}` : ''}`
            : apple?.autoRenew === false
              ? `Ends${apple.endsOn ? ` ${apple.endsOn}` : ''} · won’t renew`
              : `Renews${apple?.endsOn ? ` ${apple.endsOn}` : ''} · every month`
          : price
            ? `${price} a month`
            : prices.state === 'loading'
              ? 'Reading the price…'
              : 'No price yet';
        const verb = move.direction === 'up' ? 'Upgrade' : move.direction === 'down' ? 'Switch' : 'Subscribe';
        const end = isOwn ? null : !verified ? (
          <LockButton lock="plans" need={{ kind: 'verify', progress: papersProgress }} label={`${verb} to ${p.name}`} storeShell />
        ) : (
          <ActionButton
            tone="brand"
            icon={move.direction === 'up' ? Sparkles : CreditCard}
            label={verb}
            name={`${verb} to ${p.name}`}
            disabled={!price || buying !== null}
            onClick={() => buy(p)}
            data-apple-plan-buy={p.productId}
          />
        );
        return (
          <DatesRow
            key={p.productId}
            data={`apple-plan-${p.name.toLowerCase()}`}
            lead={lead(Gem)}
            title={isOwn ? `${p.name} · your plan` : p.name}
            line={line}
            badge={isOwn ? { tone: 'ok', word: 'Active' } : null}
            end={end}
          />
        );
      })}
      {prices.state === 'silent' ? (
        <p className="pt-2 text-[13.5px] text-ink/70" role="status" data-apple-plan-silent="">
          {IAP_COPY.storeSilent}
        </p>
      ) : null}
      {message ? (
        <p className="pt-2 text-[13.5px] text-ink/70" role="status" data-apple-plan-message="">
          {message}
        </p>
      ) : null}
      <div className="pt-2 text-[13px] text-[color:var(--m-slate-2)]" data-apple-plan-terms="">
        <p>{IAP_COPY.billedByApple} One month at a time, renewing until you cancel.</p>
        <p>A higher plan starts now; a lower one when the month you paid for ends.</p>
        <p>Cancel any time in Settings › Apple ID › Subscriptions.</p>
      </div>
      {/* Guideline 3.1.2: a subscription's buy screen links its Terms of Use and Privacy Policy. */}
      <p className="pt-1 text-[13px] text-[color:var(--m-slate-2)]" data-apple-plan-legal="">
        <Link href={routes.terms()} className="underline underline-offset-2">
          Terms of Use
        </Link>
        {' · '}
        <Link href={routes.privacy()} className="underline underline-offset-2">
          Privacy Policy
        </Link>
      </p>
    </div>
  );
}
