/**
 * /dev/swipe-rows-lab/proposals — the REAL Templates list (`proposals/_components/template-list.tsx`) on fixture
 * templates, for the swipe-to-delete screenshots (owner 2026-11-03). Dev only — 404s in production (first statement);
 * the swipe's Delete would call the shipped action, which refuses with no session.
 */
import { notFound } from 'next/navigation';
import { TemplateList, type TemplateListRow } from '@/app/vendor-dashboard/proposals/_components/template-list';

const TEMPLATES: TemplateListRow[] = [
  { template_id: 'lab-t1', template_name: 'Full event catering', body: 'Hi {{couple_names}}, here is our quote for {{event_date}} at {{venue}}…' },
  { template_id: 'lab-t2', template_name: 'Cocktail hour only', body: 'Passed canapés and a two-hour bar for {{guest_count}} guests.' },
  { template_id: 'lab-t3', template_name: 'Blank', body: '' },
];

export default function SwipeRowsProposalsLab() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div className="mx-auto min-h-screen w-full max-w-xl bg-cream px-4 pb-32 pt-6 text-ink">
      <div className="sn-tile p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Templates</h2>
        <p className="mt-1 text-xs text-ink/50">Write once with merge tokens; reuse on every client.</p>
        <TemplateList templates={TEMPLATES} />
      </div>
    </div>
  );
}
