import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventSkuActive } from '@/lib/entitlements';
import { ADD_ONS, addOnHref } from '@/lib/add-ons-catalog';
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

  // Owner deep-link (paid-features-auto-show, Tier 3 2026-06-25): a couple who
  // already OWNS this paid service shouldn't land on the marketing/About
  // interstitial — send them straight to the working tool. Applies to EVERY paid
  // service. Bundle-aware + admin-approved gate (eventSkuActive covers a direct
  // order AND the granting GUIDED_PACK / MEDIA_PACK bundle; refund/cancel
  // releases it). Admin client because orders RLS is purchaser-scoped — a co-host
  // who didn't place the order is still an owner. Graceful-degrade on a
  // missing/legacy orders table (eventSkuActive → not active) falls through to
  // the About page, never crashes.
  const entry = ADD_ONS.find((a) => a.key === addon);
  if (
    entry?.serviceKey &&
    (await eventSkuActive(createAdminClient(), eventId, entry.serviceKey))
  ) {
    redirect(addOnHref(addon, eventId));
  }

  return <AddOnDetailView eventId={eventId} addon={addon} />;
}
