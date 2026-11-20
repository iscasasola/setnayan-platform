import { notFound, permanentRedirect } from 'next/navigation';

import { RETIRED_FEATURE_SLUGS } from '@/lib/retired-products';

import { featurePage } from '@/lib/feature-pages';
import { featureMetadata } from '@/lib/feature-pages/seo';
import { FeaturePageView } from '@/app/features/_feature-page';

/**
 * /tl/features/<slug> — the Tagalog twin of /features/<slug>. Same view, same
 * registry, `locale="tl"`; reciprocal hreflang comes from `featureMetadata`.
 * See the English route for why this is one dynamic route with no directive
 * and no loading boundary.
 */

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const f = featurePage(slug);
  return f ? featureMetadata(f, 'tl') : {};
}

export default async function FeatureDetailPageTagalog({ params }: Props) {
  const { slug } = await params;
  const f = featurePage(slug);
  // 🪦 A retired product's old page lands on the hub, never a 404 (owner 2026-11-20).
  if (RETIRED_FEATURE_SLUGS.has(slug)) permanentRedirect('/tl/features');
  if (!f) notFound();
  return <FeaturePageView feature={f} locale="tl" />;
}
