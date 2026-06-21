import {
  AddOnDetailView,
  addOnAboutTitle,
} from '../../_components/addon-detail-view';

// EXPLICIT About page for Save-the-Date.
//
// WHY THIS FILE EXISTS: Save-the-Date owns a literal route folder
// (studio/save-the-date/ — the builder + loading.tsx). In Next.js a literal
// segment shadows the dynamic sibling /studio/[addon]/about, so
// /studio/save-the-date/about did NOT reach the catalog-driven About renderer —
// it fell through to the builder, and via client-side navigation that collision
// threw the branded error boundary. (Every Studio tile links here through
// appStoreDetailHref(key) → /studio/<key>/about.)
//
// An explicit literal route is collision-proof: it always wins, so this page
// reliably renders the same App Store detail as every other feature, with the
// add-on fixed to 'save-the-date'. The render is shared via
// _components/addon-detail-view.tsx (no duplication).

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ eventId: string }> };

export function generateMetadata() {
  return { title: addOnAboutTitle('save-the-date') };
}

export default async function SaveTheDateAboutPage({ params }: Props) {
  const { eventId } = await params;
  return <AddOnDetailView eventId={eventId} addon="save-the-date" />;
}
