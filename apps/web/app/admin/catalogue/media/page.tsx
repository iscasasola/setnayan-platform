import { requireAdmin } from '@/lib/admin/require-admin';
import { MediaView } from '../_components/hub-views';

export const metadata = { title: 'Media · Admin' };

/**
 * /admin/catalogue/media — Catalogue › Media (approved drawing `catalogue.html`, screen `media`).
 *
 * The files and lists couples pick from. Each row rises to the SHIPPED page (T4); every old address still answers
 * and lights this view (`lib/admin/admin-tabs.ts`, view `media`). The drawing's "Mood-board renders" row is GONE
 * (retired 2026-10-26) and is not drawn.
 */
export default async function CatalogueMedia() {
  await requireAdmin();
  return <MediaView />;
}
