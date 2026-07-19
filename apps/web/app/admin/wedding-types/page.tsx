import { redirect } from 'next/navigation';

/**
 * /admin/wedding-types RETIRED 2026-07-03 → folded into the Taxonomy Studio's
 * Vocabularies rail (Taxonomy Studio PR 6). The per-religion launch gate
 * (status active/coming-soon/disabled + readiness threshold + counts) now lives
 * in /admin/taxonomy under Vocabularies → Faiths. This redirect keeps old
 * bookmarks + the two-admin deep-links working; nav entries were removed.
 */
export const metadata = { title: 'Wedding types · Admin' };

export default function WeddingTypesRedirect() {
  redirect('/admin/taxonomy?view=vocab-faith');
}
