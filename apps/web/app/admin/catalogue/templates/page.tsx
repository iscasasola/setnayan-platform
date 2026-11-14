import { requireAdmin } from '@/lib/admin/require-admin';
import { TemplatesView } from '../_components/hub-views';

export const metadata = { title: 'Templates · Admin' };

/**
 * /admin/catalogue/templates — Catalogue › Templates (approved drawing `catalogue.html`, screen `templates`).
 *
 * The things couples' pages are built from. Each row rises to the SHIPPED page (T4) — nothing is moved or edited
 * here, and every old address still answers and lights this view (`lib/admin/admin-tabs.ts`, view `templates`).
 * The drawing's "Cards & themes" row is marked NEW there (no admin page exists for it yet) and is not drawn.
 */
export default async function CatalogueTemplates() {
  await requireAdmin();
  return <TemplatesView />;
}
