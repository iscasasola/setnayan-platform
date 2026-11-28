/*
 * Instant loading shell for /dashboard/billing — the receipts list (L6 · S4, walk 27 Nov 2026: a supplier's first load
 * read only "Loading…" while the generic dashboard shell drew panels this page never draws). 👻 Ghost: the page's own
 * shape at once, in its own column — one row per receipt; the masthead draws no visible title, so neither does this.
 */
import { ListPageSkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <ListPageSkeleton rows={6} toolbar={false} />
    </div>
  );
}
