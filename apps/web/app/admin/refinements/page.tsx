import { redirect } from 'next/navigation';

/**
 * /admin/refinements — RETIRED (Taxonomy Studio program, PR 3). Refinements are
 * now edited inside the Taxonomy Studio inspector's Refinements tab, anchored to
 * their tile. The route is kept as a permanent server-side redirect so old
 * bookmarks / links still land somewhere useful.
 */
export const dynamic = 'force-dynamic';

export default function AdminRefinementsPage() {
  redirect('/admin/taxonomy');
}
