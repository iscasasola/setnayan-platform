import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, Clock } from 'lucide-react';
import { formatPhp } from '@/lib/php';
import { InlineCheckoutDrawer, type InlineCheckoutDrawerProps } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';
import { PaidMark } from '@/app/_components/paid-mark';
import { paidMarkLabel } from '@/lib/paid-mark';
import {
  FULL_PRO_SKU,
  HUB_PARTS,
  HUB_PARTS_ORDER_KEY,
  HUB_PRO_GATES,
  hubPart,
  hubPartsLabel,
  isHubPartId,
  type HubOwnershipView,
  type HubPartId,
} from '@/lib/hub-parts';

/**
 * 💎 THE PARTS PAGE'S BODY (owner 2026-10-22, prototype `pro_part_by_part_2026-10-22.html` frame 4) — everything it
 * draws, from what the page read: what the event holds (active · owned), each part's catalogue price, Full Pro's, and
 * the Apply sheet's `?buy=` pick. No reads here, so the page and its lab (`/dev/pro-parts-lab`) draw the same thing.
 * Every figure is handed in; nothing is typed.
 */
export type ProPartsBodyProps = {
  eventId: string;
  title: string;
  back: { href: string; label: string };
  fromMaker: boolean;
  hubHref: string;
  active: HubOwnershipView | null;
  owned: HubOwnershipView | null;
  partPricePhp: Partial<Record<HubPartId, number>>;
  fullPhp: number | null;
  buy: string | undefined;
  settings: InlineCheckoutDrawerProps['settings'];
  vatRatePct: number;
};

export function ProPartsBody({ eventId, title, back, fromMaker, hubHref, active, owned, partPricePhp, fullPhp, buy, settings, vatRatePct }: ProPartsBodyProps) {
  const HERO = { label: title };
  const has = (o: HubOwnershipView | null, id: HubPartId) => Boolean(o && (o.full || o.parts.includes(id)));
  /* Everything you pay for parts counts toward everything — the rest, never below zero (the cap). */
  const paidPhp = owned?.paidPhp ?? 0;
  const restPhp = fullPhp === null ? null : Math.max(0, fullPhp - paidPhp);
  const partPrice = (id: HubPartId): number | null => partPricePhp[id] ?? null;
  const stateOf = (id: HubPartId): 'yours' | 'review' | 'buy' =>
    has(active, id) ? 'yours' : has(owned, id) ? 'review' : 'buy';
  /** Never charge above the rest — a part that would cost more than everything is offered at the rest (and unlocks it). */
  const chargeOf = (php: number) => (restPhp === null ? php : Math.min(php, restPhp));

  /* `?buy=` — the Apply sheet's pick, carried here: "style,motion" or "full". Unknown or owned parts are dropped. */
  const buyFull = buy === 'full';
  const buyParts = buyFull
    ? []
    : (buy ?? '')
        .split(',')
        .map((x) => x.trim())
        .filter(isHubPartId)
        .filter((id, i, all) => all.indexOf(id) === i && stateOf(id) === 'buy');
  const buyPricePhp = buyParts.reduce<number | null>((sum, id) => {
    const php = partPrice(id);
    return sum === null || php === null ? null : sum + php;
  }, 0);

  const drawer = (input: { serviceKey: string; name: string; php: number; label: string; hubParts?: readonly HubPartId[] }) => (
    <InlineCheckoutDrawer
      serviceKey={input.serviceKey}
      displayName={input.name}
      originalPriceCentavos={String(Math.round(input.php * 100))}
      vatRatePct={vatRatePct}
      eventId={eventId}
      settings={settings}
      triggerLabel={input.label}
      {...(input.hubParts ? { hubParts: input.hubParts.join(',') } : {})}
    />
  );

  const big = HUB_PARTS.filter((p) => p.size === 'big');
  const small = HUB_PARTS.filter((p) => p.size === 'small');
  const bandPrice = (parts: typeof HUB_PARTS) => {
    const figures = [...new Set(parts.map((p) => partPrice(p.id)).filter((n): n is number => n !== null))];
    return figures.length === 1 ? `${formatPhp(figures[0]!)} each` : null;
  };

  return (
    <section className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 sm:px-6" data-pro-parts-page="">
      <Link href={back.href} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink/60 hover:text-ink">
        <ArrowLeft aria-hidden className="h-4 w-4" /> {back.label}
      </Link>

      <header className="space-y-2">
        <h1 className="font-serif text-4xl text-ink">{HERO.label}</h1>
        <p className="text-[15px] leading-snug text-ink/65">
          {paidPhp > 0 && !active?.full
            ? `You've paid ${formatPhp(paidPhp)} toward everything.`
            : 'Buy the parts you use, or everything at once. Each unlock is for this event and everyone on it.'}
        </p>
      </header>

      {/* ── EVERYTHING — one tap, on top. ── */}
      {active?.full ? (
        <div className="rounded-3xl bg-ink/[0.04] p-5" data-pro-everything="yours">
          <p className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-success-800">
            <PaidMark state="unlocked" label={paidMarkLabel('unlocked', 'Event Hub Pro')} size="lg" tone="current" /> Unlocked
          </p>
          <p className="text-sm text-ink/70">
            Everything is on across your Event Hub — all {HUB_PARTS.length} parts — and the &ldquo;Powered by Setnayan&rdquo; footer is off.
          </p>
          <Link
            href={fromMaker ? back.href : hubHref}
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-mulberry px-4 text-sm font-semibold text-cream hover:bg-mulberry-600"
          >
            {fromMaker ? back.label : 'Open your Event Hub'}
            <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      ) : owned?.full ? (
        <div className="rounded-3xl bg-mulberry/5 p-5" data-pro-everything="review">
          <p className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-mulberry">
            <Clock aria-hidden className="h-5 w-5" strokeWidth={1.75} /> Payment under review
          </p>
          <p className="text-sm text-ink/70">
            We&rsquo;ve received your Event Hub Pro order. Our team reconciles within one business day — every part unlocks
            automatically once it is approved.
          </p>
          <Link href={`/dashboard/${eventId}/orders`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-mulberry underline underline-offset-2">
            Track your order
          </Link>
        </div>
      ) : restPhp !== null ? (
        <div className={`rounded-3xl bg-ink/[0.04] p-5 ${buyFull ? 'ring-2 ring-terracotta/50' : ''}`} data-pro-everything="buy">
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-lg font-semibold text-ink">Everything</span>
            <span className="font-mono text-lg font-bold text-ink">{paidPhp > 0 ? `${formatPhp(restPhp)} more` : formatPhp(restPhp)}</span>
          </p>
          <p className="mt-1 text-sm leading-snug text-ink/65">
            {paidPhp > 0
              ? `The other parts, and the "Powered by Setnayan" footer comes off. ${formatPhp(fullPhp ?? 0)} in all — you've paid ${formatPhp(paidPhp)} of it.`
              : `All ${HUB_PARTS.length} parts, and the "Powered by Setnayan" footer comes off your Hub, invite, prints and story.`}
          </p>
          <div className="mt-3">
            {drawer({
              serviceKey: FULL_PRO_SKU,
              name: 'Event Hub Pro · everything',
              php: restPhp,
              // The drawer's own trigger shows the figure beside the words — the label is words only.
              label: paidPhp > 0 ? 'Unlock the rest' : 'Unlock everything',
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink/65">Pricing loads from your catalog &mdash; please refresh in a moment.</p>
      )}

      {/* ── THE APPLY SHEET'S PICK (`?buy=`) — one order, one payment. ── */}
      {!active?.full && !owned?.full && buyParts.length > 0 && buyPricePhp !== null ? (
        <div className="rounded-3xl bg-ink/[0.04] p-5 ring-2 ring-terracotta/50" data-pro-buy-pick={buyParts.join(',')}>
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-lg font-semibold text-ink">{hubPartsLabel(buyParts)}</span>
            <span className="font-mono text-lg font-bold text-ink">{formatPhp(chargeOf(buyPricePhp))}</span>
          </p>
          <p className="mt-1 text-sm text-ink/65">The {buyParts.length === 1 ? 'part' : 'parts'} your draft uses. What you pay counts toward everything.</p>
          <div className="mt-3">
            {drawer({
              serviceKey: buyParts.length === 1 ? hubPart(buyParts[0]!).sku : HUB_PARTS_ORDER_KEY,
              name: `Event Hub Pro · ${hubPartsLabel(buyParts)}`,
              php: chargeOf(buyPricePhp),
              label: `Unlock ${hubPartsLabel(buyParts)}`,
              ...(buyParts.length > 1 ? { hubParts: buyParts } : {}),
            })}
          </div>
        </div>
      ) : null}

      {/* ── THE ELEVEN PARTS, big then small. ── */}
      {[
        { title: 'Big parts', parts: big },
        { title: 'Small parts', parts: small },
      ].map((band) => (
        <section key={band.title} aria-label={band.title} data-pro-parts-band={band.title}>
          <p className="flex items-baseline justify-between border-b border-ink/15 pb-2 pt-2">
            <span className="text-sm font-semibold text-ink">{band.title}</span>
            {bandPrice(band.parts) ? <span className="font-mono text-[13px] text-ink/55">{bandPrice(band.parts)}</span> : null}
          </p>
          <ul>
            {band.parts.map((p) => {
              const state = stateOf(p.id);
              const php = partPrice(p.id);
              const gates = HUB_PRO_GATES.filter((g) => g.home === p.id);
              return (
                <li key={p.id} className="border-b border-ink/10" data-pro-part={p.id} data-pro-part-state={state}>
                  <details className="group">
                    <summary className="flex min-h-11 cursor-pointer list-none items-start gap-3 py-3 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-ink">{p.name}</span>
                        <span className="block text-sm leading-snug text-ink/60">{p.blurb}</span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1.5 pt-0.5">
                        {state === 'yours' ? (
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-terracotta-700">
                            <Check aria-hidden className="h-4 w-4" strokeWidth={2.4} /> Yours
                          </span>
                        ) : state === 'review' ? (
                          <span className="text-sm font-semibold text-mulberry">Under review</span>
                        ) : php !== null ? (
                          <span className="inline-flex items-center gap-1.5 font-mono text-sm text-ink">
                            <PaidMark state="try" bare label="Event Hub Pro" size="xs" /> {formatPhp(php)}
                          </span>
                        ) : null}
                        <ChevronRight aria-hidden className="h-4 w-4 text-ink/40 transition-transform group-open:rotate-90" strokeWidth={2} />
                      </span>
                    </summary>
                    <div className="pb-4 pl-1">
                      {gates.length > 0 ? (
                        <ul className="space-y-1 text-sm text-ink/70" data-pro-part-gates="">
                          {gates.map((g) => (
                            <li key={g.id} className="flex gap-2">
                              <span aria-hidden className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-ink/30" />
                              <span>{g.gate}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {state === 'buy' && php !== null && !owned?.full ? (
                        <div className="mt-3">
                          {drawer({
                            serviceKey: p.sku,
                            name: `Event Hub Pro · ${p.name}`,
                            php: chargeOf(php),
                            label: `Unlock ${p.name}`,
                          })}
                          {chargeOf(php) < php ? (
                            <p className="mt-2 text-[13px] text-ink/60">This reaches everything — every part, and the footer comes off.</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="pt-2 text-center text-sm leading-snug text-ink/60">
        Everything you pay here counts toward everything.{fullPhp !== null ? ` At ${formatPhp(fullPhp)}, it all unlocks.` : ''} Every
        guest&rsquo;s ticket and the all-guests QR sheet are free for everyone.
      </p>
    </section>
  );
}
