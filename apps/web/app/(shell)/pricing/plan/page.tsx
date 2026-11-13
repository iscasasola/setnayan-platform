import { BRAND_OG_IMAGES, BRAND_TWITTER_IMAGES } from '@/lib/brand-og';
import { readOurPrices } from '../_pricing-reads';
import { PlanQuiz } from './_plan-quiz';
import type { PlanPrices } from './_plan-steps';
import { formatPeso } from '@/lib/v2-catalog-pure';
import { formatCount } from '@/lib/format-number';
import { PlanBuyCta } from '@/app/_components/marketing/plan-buy-cta';
import { PLAN_NAME, type PlanKey } from '@/lib/plan-buy-doors';

/**
 * /pricing/plan — "What Setnayan does for you", the questionnaire (owner 2026-10-25, verbatim: "Yes, build this pricing
 * page and the questionnaire into the app."). Prototype `prototypes/pricing_ours_only_2026-10-25/quiz.html`. Nested
 * under /pricing so it adds no top-level address; linked from the pricing page's close and its first-visit tour.
 *
 * 🔑 EVERY PESO is read here, on the server, from `platform_retail_catalog_v2` (`../_pricing-reads.ts`) and handed to the
 * client as numbers; a paid question whose price could not be read is not asked. The old-way figures are
 * `lib/old-way-costs.ts` — printing and time, each with its source.
 *
 * Renders inside the shared public shell, like /pricing. `dynamic` is declared once, on `app/(shell)/layout.tsx`.
 */
export const metadata = {
  title: 'What Setnayan does for you',
  description:
    'Answer a few questions about your event and see what Setnayan builds for it — with our prices, paid once for the event and everyone on it.',
  alternates: { canonical: '/pricing/plan' },
  openGraph: {
    images: BRAND_OG_IMAGES,
    title: 'What Setnayan does for you · Setnayan',
    description: 'A few questions, then your event — built with Setnayan, with our prices.',
    url: '/pricing/plan',
    type: 'website',
    siteName: 'Setnayan',
  },
  twitter: {
    images: BRAND_TWITTER_IMAGES,
    card: 'summary_large_image',
    title: 'What Setnayan does for you · Setnayan',
    description: 'A few questions, then your event — built with Setnayan, with our prices.',
  },
};

export default async function PricingPlanPage() {
  const { prices } = await readOurPrices();
  const plan: PlanPrices = {
    pro: prices.pro,
    partsFrom: prices.hubParts.length ? Math.min(...prices.hubParts.map((p) => p.php)) : null,
    papicFrom: prices.papicRungs[0]?.php ?? null,
    liveWatch: prices.liveWatch,
    patiktok: prices.patiktok,
    ai: prices.ai,
    plus: prices.plus,
  };
  /* 💰 RW-13 (owner 2026-11-13, "We want events ultra to be purchasable now"): the three plans, each with the same
     buy door as /pricing (`PlanBuyCta` → the event's plan screen, where its checkout drawer is). Every figure is the
     catalogue's (`readOurPrices`); a plan whose row is unread or off sale is not listed. */
  const planRows = (
    [
      ['plus', prices.plus, prices.planCredits.plus],
      ['pro', prices.pro?.regular ?? null, prices.planCredits.pro],
      ['ultra', prices.ultra, prices.planCredits.ultra],
    ] as Array<[PlanKey, number | null, number | null]>
  ).filter((r): r is [PlanKey, number, number | null] => r[1] != null);
  return (
    <main className="bg-cream text-ink">
      <PlanQuiz prices={plan} />
      {planRows.length > 0 ? (
        <section aria-label="Plans for your event" className="mx-auto w-full max-w-2xl px-4 pb-12 sm:px-6" data-plan-doors="">
          <h2 className="font-pahina text-2xl font-normal">Plans for your event</h2>
          <ul className="m-0 mt-3 list-none p-0">
            {planRows.map(([key, php, credits]) => (
              <li key={key} className="border-t border-ink/10 py-3 first:border-t-0" data-plan-door-row={key}>
                <p className="m-0 flex items-baseline justify-between gap-3">
                  <span className="text-[16.5px] font-semibold">{PLAN_NAME[key]}</span>
                  <span className="whitespace-nowrap font-pahina text-xl text-terracotta-700">₱{formatPeso(php)}</span>
                </p>
                {credits != null ? (
                  <p className="m-0 text-[13.5px] text-ink/65">{`${formatCount(credits)} Papic credits included`}</p>
                ) : null}
                <div className="mt-2">
                  <PlanBuyCta plan={key} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
