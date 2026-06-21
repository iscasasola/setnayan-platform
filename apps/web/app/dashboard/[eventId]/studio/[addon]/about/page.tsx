import {
  AddOnDetailView,
  addOnAboutTitle,
} from '../../_components/addon-detail-view';

// Catalog-driven App Store-style detail page for every couple-side in-app
// service (the fan-out of the 2026-05-17 Panood pilot — owner 2026-06-19
// "Studio should look like the App Store so we can see info on each feature").
//
// The render lives in _components/addon-detail-view.tsx so features that own a
// LITERAL route folder (which shadows this dynamic route) can mount an explicit
// /studio/<key>/about page reusing the exact same view — see
// studio/save-the-date/about/page.tsx.

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ eventId: string; addon: string }> };

export async function generateMetadata({ params }: Props) {
  const { addon } = await params;
  return { title: addOnAboutTitle(addon) };
}

export default async function AddOnDetailPage({ params }: Props) {
  const { eventId, addon } = await params;
  return <AddOnDetailView eventId={eventId} addon={addon} />;
}
