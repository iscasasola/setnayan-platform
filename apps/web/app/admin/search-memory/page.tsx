import { PageMasthead } from '@/app/_components/page-masthead';
import { requireAdmin } from '@/lib/admin/require-admin';
import { loadSearchMemory } from '@/lib/admin-search-memory';
import { buildDestinations } from '../_components/admin-destinations';
import { SearchMemoryTable } from './search-memory-table';

/**
 * Admin · Search memory — what the assistant has learned, and the only place
 * to correct or delete it.
 *
 * `admin_search_phrases` is the table the search box's AI step writes to when
 * the free word-matching finds nothing (`lib/admin-map/ask-the-admin.ts`) —
 * every repeat of a phrasing then costs ₱0. Nothing anywhere let a person SEE
 * that table, correct a wrong resolution, or remove one — so a wrong answer,
 * once learned, stayed wrong forever, silently. This is that surface.
 */

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Search memory · Admin' };

export default async function AdminSearchMemoryPage() {
  await requireAdmin();

  const { rows, error } = await loadSearchMemory();
  // Pages only — a row-inside-a-page anchor is not a sane "teach it this
  // instead" target, same boundary the AI step itself is held to.
  const destinations = buildDestinations()
    .filter((d) => d.source !== 'row')
    .map((d) => ({ label: d.label, href: d.href }));

  return (
    <div className="px-5 py-8 sm:px-8 max-w-5xl">
      <PageMasthead title="Search memory" />
      <div className="mb-6">
        <p className="text-[14px] leading-relaxed text-ink/70 mt-2 max-w-2xl">
          Every phrasing the search box has answered with the assistant, instead of the
          free word matching. A repeat of any phrase below costs nothing — it is a table
          lookup, not a model call. If one points somewhere wrong, correct it below and it
          is fixed for every admin, every time, from now on.
        </p>
      </div>

      <SearchMemoryTable rows={rows} readError={error} destinations={destinations} />
    </div>
  );
}
