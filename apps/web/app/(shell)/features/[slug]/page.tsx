import { notFound } from 'next/navigation';

import { featurePage } from '@/lib/feature-pages';
import { featureMetadata } from '@/lib/feature-pages/seo';
import { FeaturePageView } from '@/app/features/_feature-page';

/**
 * /features/<slug> — one page per feature (DECISION_LOG 2026-10-01). A thin
 * route: the words live in `lib/feature-pages`, the page in
 * `app/features/_feature-page.tsx`, the tags in `lib/feature-pages/seo.ts`.
 * The Tagalog twin is `app/(shell)/tl/features/[slug]/page.tsx`.
 *
 * ONE dynamic route for every feature (the route budget, #6006) — never a
 * folder per feature. Inside `(shell)` so the page wears the shared front-door
 * chrome; it declares no route directive (the group layout owns `dynamic`).
 * It calls `notFound()`, so it must NOT gain a `loading.tsx`: a boundary would
 * stream a 200 for a slug that does not exist (`the-press-commits-now.test.ts`).
 */

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const f = featurePage(slug);
  return f ? featureMetadata(f, 'en') : {};
}

export default async function FeatureDetailPage({ params }: Props) {
  const { slug } = await params;
  const f = featurePage(slug);
  if (!f) notFound();
  return <FeaturePageView feature={f} locale="en" />;
}
