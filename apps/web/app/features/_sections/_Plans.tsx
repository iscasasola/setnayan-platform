import type { MarketingLocale } from '@/lib/marketing-i18n';
import { readFeatureCatalogue } from '../_feature-price';
import { PlansCompare } from '../_plans-view';

/**
 * The Plans compare on /features (v3). ASYNC: it reads the catalogue — the same one cached read the hub's rows and
 * every feature page use (`readFeatureCatalogue`) — and hands the rows to the pure `PlansCompare`. English only,
 * like the story it closes.
 */
export async function FeaturesPlans({ locale }: { locale: MarketingLocale }) {
  if (locale !== 'en') return null;
  const rows = await readFeatureCatalogue();
  return <PlansCompare rows={rows} />;
}
