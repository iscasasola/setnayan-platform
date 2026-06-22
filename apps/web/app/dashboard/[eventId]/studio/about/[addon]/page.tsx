import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventSkuActive } from '@/lib/entitlements';
import {
  AddOnDetailView,
  addOnAboutTitle,
} from '../../_components/addon-detail-view';

// Catalog-driven App Store-style detail page for every couple-side in-app
// service (the fan-out of the 2026-05-17 Panood pilot — owner 2026-06-19
// "Studio should look like the App Store so we can see info on each feature").
//
// Lives under the LITERAL `about` segment (studio/about/[addon]) — NOT
// studio/[addon]/about — so it is never shadowed by a feature's own literal
// folder (studio/papic/, studio/save-the-date/, …). One dynamic route serves
// every feature's About page. Render is shared via _components/addon-detail-view.tsx.

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ eventId: string; addon: string }> };

export async function generateMetadata({ params }: Props) {
  const { addon } = await params;
  return { title: addOnAboutTitle(addon) };
}

export default async function AddOnDetailPage({ params }: Props) {
  const { eventId, addon } = await params;

  // 2026-06-22 · A couple who already PAID for Patiktok shouldn't land on the
  // marketing/about interstitial — deep-link them straight to the working booth
  // (the operator dashboard). Scoped to Patiktok only; every other feature keeps
  // its About page. Bundle-aware admin-approved gate (eventSkuActive covers a
  // direct PATIKTOK_COMPILER order AND the MEDIA_PACK bundle; refund/cancel
  // releases it). Admin client because orders RLS is purchaser-scoped — a co-
  // host who didn't place the order is still an owner. Graceful-degrade on a
  // missing/legacy orders table (42P01 / 42703 → not active) falls through to
  // the About page rather than crashing.
  if (
    addon === 'patiktok' &&
    (await eventSkuActive(createAdminClient(), eventId, 'PATIKTOK_COMPILER'))
  ) {
    redirect(`/dashboard/${eventId}/studio/patiktok/booth`);
  }

  return <AddOnDetailView eventId={eventId} addon={addon} />;
}
