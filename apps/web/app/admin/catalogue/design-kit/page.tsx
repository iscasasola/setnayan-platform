import { requireAdmin } from '@/lib/admin/require-admin';
import { DesignKitView } from '../_components/hub-views';

export const metadata = { title: 'Design kit · Admin' };

/**
 * /admin/catalogue/design-kit — Catalogue › Design kit (approved drawing `catalogue.html`, screen `design-kit`).
 *
 * The app's look. Colours is the shipped page (`/admin/colours`, which still answers and lights this view). The
 * drawing's Fonts · Icons · Backgrounds · Palettes · Card motifs rows are marked NEW there — rulings with no shipped
 * function yet — so they are not drawn: a row that opens nothing would be a fake door.
 */
export default async function CatalogueDesignKit() {
  await requireAdmin();
  return <DesignKitView />;
}
