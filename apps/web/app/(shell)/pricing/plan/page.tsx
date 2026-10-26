import { BRAND_OG_IMAGES, BRAND_TWITTER_IMAGES } from '@/lib/brand-og';
import { readOurPrices } from '../_pricing-reads';
import { PlanQuiz } from './_plan-quiz';
import type { PlanPrices } from './_plan-steps';

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
  };
  return (
    <main className="bg-cream text-ink">
      <PlanQuiz prices={plan} />
    </main>
  );
}
