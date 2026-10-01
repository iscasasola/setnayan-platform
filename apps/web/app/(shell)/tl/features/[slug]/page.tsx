import { notFound } from 'next/navigation';

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
  if (!f) notFound();
  return <FeaturePageView feature={f} locale="tl" />;
}
