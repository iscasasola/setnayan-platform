import { Check, Clock } from 'lucide-react';
import { formatPhp } from '@/lib/php';
import { formatCount } from '@/lib/format-number';
import { PLUS_MORE, plusPeek, ULTRA_PEEK, ultraMore } from '@/app/_components/frontdoor/front-door-landing-data';

/**
 * 💰 THE IN-APP PLAN OFFER (Controller F-W2-29, 2026-11-13): inside the app a couple is offered the SAME plans /pricing
 * and the front door offer — Free · Event Plus · Event Pro — each price and its included Papic credits READ from the
 * catalogue (`lib/event-plans.ts`, the front door's own helpers). Event Pro is the page's "Everything" card; `PlanOffer`
 * draws Free and Event Plus above it and `UltraOffer` draws Event Ultra (#7601) below it. Nothing typed: an unread row names no price and no count.
 *
 * Event Plus counts toward Event Pro — `eventHubOwnership` already adds a paid Plus to `paidPhp`, so the Pro card asks
 * only the difference.
 */
export type PlanOfferFacts = {
  /** EVENT_PLUS `retail_price_php` — null when not on sale or unread (then the Plus card is not drawn). */
  plusPhp: number | null;
  /** EVENT_PLUS `included_papic_credits` — null when unread or none. */
  plusCredits: number | null;
  /** COUPLE_WEBSITE_PRO `included_papic_credits` — null when unread or none. */
  proCredits: number | null;
  /** The live free-credit sentence (`papicFreeCreditPromise`) — null when the free grant is off or unread. */
  freePapic: string | null;
  /** What this event holds of Event Plus: approved · paid and under review · neither. */
  plus: 'yours' | 'review' | 'buy';
  /** 💎 EVENT_ULTRA `retail_price_php` — null when not on sale or unread (then the Ultra card is not drawn). */
  ultraPhp: number | null;
  /** EVENT_ULTRA `included_papic_credits` — null when unread or none. */
  ultraCredits: number | null;
  /** What this event holds of Event Ultra. */
  ultra: 'yours' | 'review' | 'buy';
  /** The event has paid toward Plus or Pro — then Ultra costs only the difference (the drawer quotes it). */
  paidTowardAPlan: boolean;
};

export function proCreditsLine(n: number | null): string | null {
  return n !== null && n > 0 ? `${formatCount(n)} Papic credits included.` : null;
}

export function PlanOffer({
  facts,
  proHeld,
  plusDrawer,
  focus = null,
}: {
  facts: PlanOfferFacts;
  /** RW-13: the plan a public door opened the page for — the Plus card is ringed when it is Plus. */
  focus?: string | null;
  /** The event already holds (or has paid for) Event Pro — Pro includes everything in Plus, so Plus is not offered. */
  proHeld: boolean;
  /** The buy button for Event Plus at its catalogue price (the page's own checkout drawer). */
  plusDrawer: (php: number) => React.ReactNode;
}) {
  const ultraHeld = facts.ultra !== 'buy';
  const onFree = !proHeld && !ultraHeld && facts.plus === 'buy';
  const showPlus = !proHeld && !ultraHeld && (facts.plus !== 'buy' || facts.plusPhp !== null);
  const peek = plusPeek({ plusCredits: facts.plusCredits, proCredits: facts.proCredits, freePapic: facts.freePapic });
  return (
    <section aria-label="Plans for this event" className="space-y-3" data-event-plans="">
      <div className="flex items-start justify-between gap-3 rounded-3xl bg-ink/[0.04] p-5" data-event-plan="free">
        <span className="min-w-0">
          <span className="block text-lg font-semibold text-ink">Free</span>
          <span className="block text-sm leading-snug text-ink/65">
            Guest list, seat plan, budget, schedule and your Event Hub
            {facts.freePapic ? ` · Papic cameras on every guest’s phone — ${facts.freePapic}` : ''}.
          </span>
        </span>
        {onFree ? <span className="shrink-0 text-sm font-semibold text-terracotta-700">Your plan</span> : null}
      </div>

      {showPlus ? (
        <div
          id="plan-plus"
          className={`rounded-3xl bg-ink/[0.04] p-5 ${focus === 'plus' ? 'ring-2 ring-terracotta/50' : ''}`}
          data-event-plan="plus"
          data-event-plan-state={facts.plus}
        >
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-lg font-semibold text-ink">Event Plus</span>
            {facts.plus === 'buy' && facts.plusPhp !== null ? (
              <span className="font-mono text-lg font-bold text-ink">{formatPhp(facts.plusPhp)}</span>
            ) : null}
          </p>
          <ul className="mt-1 space-y-1 text-sm leading-snug text-ink/65">
            {[...peek, ...PLUS_MORE].map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="mt-3">
            {facts.plus === 'yours' ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-success-800">
                <Check aria-hidden className="h-4 w-4" strokeWidth={2.4} /> Yours
              </p>
            ) : facts.plus === 'review' ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-mulberry">
                <Clock aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Payment under review
              </p>
            ) : facts.plusPhp !== null ? (
              plusDrawer(facts.plusPhp)
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * 💎 EVENT ULTRA (#7601, owner 2026-11-13) — the third plan, after Event Pro. Its lines are the front door's
 * (`ULTRA_PEEK`, `ultraMore`), its price and credits the `EVENT_ULTRA` row. An event that already paid toward Plus or Pro
 * pays only the difference: the checkout drawer asks the server for that figure (`readUltraUpgradeCharge`, the reader the
 * charge uses), so this card shows the row's price and says the difference applies — it never computes one itself.
 */
export function UltraOffer({
  facts,
  ultraDrawer,
  focus = false,
}: {
  facts: PlanOfferFacts;
  ultraDrawer: (php: number) => React.ReactNode;
  /** RW-13: a public door opened the page for Ultra — the card is ringed. */
  focus?: boolean;
}) {
  if (facts.ultra === 'buy' && facts.ultraPhp === null) return null;
  const lines = [
    'Everything in Event Pro',
    ...ULTRA_PEEK,
    ...ultraMore({ plusCredits: facts.plusCredits, proCredits: facts.proCredits, ultraCredits: facts.ultraCredits, freePapic: facts.freePapic }),
  ];
  return (
    <div
      id="plan-ultra"
      className={`rounded-3xl bg-ink/[0.04] p-5 ${focus ? 'ring-2 ring-terracotta/50' : ''}`}
      data-event-plan="ultra"
      data-event-plan-state={facts.ultra}
    >
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-lg font-semibold text-ink">Event Ultra</span>
        {facts.ultra === 'buy' && facts.ultraPhp !== null ? (
          <span className="font-mono text-lg font-bold text-ink">{formatPhp(facts.ultraPhp)}</span>
        ) : null}
      </p>
      <ul className="mt-1 space-y-1 text-sm leading-snug text-ink/65">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {facts.ultra === 'buy' && facts.paidTowardAPlan ? (
        <p className="mt-2 text-sm font-medium text-ink/75" data-ultra-pays-the-difference="">
          You&rsquo;ve paid toward a plan — upgrading asks only the difference.
        </p>
      ) : null}
      <div className="mt-3">
        {facts.ultra === 'yours' ? (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-success-800">
            <Check aria-hidden className="h-4 w-4" strokeWidth={2.4} /> Yours
          </p>
        ) : facts.ultra === 'review' ? (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-mulberry">
            <Clock aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Payment under review
          </p>
        ) : facts.ultraPhp !== null ? (
          ultraDrawer(facts.ultraPhp)
        ) : null}
      </div>
    </div>
  );
}
