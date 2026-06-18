import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ScanFlag } from '@/lib/editorial-scan';

export const metadata = { title: 'Editorial review · Admin' };

export default async function EditorialReviewPage() {
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from('event_editorial')
    .select(`
      editorial_id, scan_status, scan_flags, scan_completed_at,
      unlocked_for_couple_at, published_at,
      events ( display_name, event_date )
    `)
    .in('scan_status', ['flagged', 'admin_cleared', 'clean', 'skipped', 'pending', 'scanning'])
    .order('scan_completed_at', { ascending: false })
    .limit(100);

  const flagged = (rows ?? []).filter(r => r.scan_status === 'flagged');
  const cleared = (rows ?? []).filter(r =>
    r.scan_status === 'admin_cleared' || r.scan_status === 'clean' || r.scan_status === 'skipped',
  );
  const pending = (rows ?? []).filter(r =>
    r.scan_status === 'pending' || r.scan_status === 'scanning',
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Editorial review</h1>
        <p className="text-sm text-[--m-ink-secondary] mt-1">
          Editorials are scanned for vulgarity (OpenAI Moderation) and grammar (LanguageTool)
          before the couple sees their draft. Resolve red flags here, then unlock.
        </p>
      </div>

      {flagged.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[--m-ink-tertiary] mb-3">
            Needs review ({flagged.length})
          </h2>
          <div className="divide-y divide-[--m-ink-border] rounded-lg border border-[--m-ink-border] overflow-hidden">
            {flagged.map(row => (
              <EditorialRow key={row.editorial_id} row={row} />
            ))}
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[--m-ink-tertiary] mb-3">
            Queued / scanning ({pending.length})
          </h2>
          <div className="divide-y divide-[--m-ink-border] rounded-lg border border-[--m-ink-border] overflow-hidden">
            {pending.map(row => (
              <EditorialRow key={row.editorial_id} row={row} />
            ))}
          </div>
        </section>
      )}

      {cleared.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[--m-ink-tertiary] mb-3">
            Cleared ({cleared.length})
          </h2>
          <div className="divide-y divide-[--m-ink-border] rounded-lg border border-[--m-ink-border] overflow-hidden">
            {cleared.map(row => (
              <EditorialRow key={row.editorial_id} row={row} />
            ))}
          </div>
        </section>
      )}

      {(rows ?? []).length === 0 && (
        <div className="rounded-lg border border-[--m-ink-border] px-4 py-12 text-center text-sm text-[--m-ink-tertiary]">
          No editorials yet. They appear here once a wedding&apos;s content collection window closes.
        </div>
      )}
    </div>
  );
}

type RowData = {
  editorial_id: string;
  scan_status: string;
  scan_flags: unknown;
  scan_completed_at: string | null;
  unlocked_for_couple_at: string | null;
  published_at: string | null;
  events: { display_name: string | null; event_date: string | null } | null;
};

function EditorialRow({ row }: { row: RowData }) {
  const flags = (row.scan_flags ?? []) as ScanFlag[];
  const red = flags.filter(f => f.severity === 'red');
  const yellow = flags.filter(f => f.severity === 'yellow');
  const redPending = red.filter(f => f.status === 'pending');

  const statusMap: Record<string, { label: string; class: string }> = {
    flagged: { label: 'Needs review', class: 'text-red-600' },
    scanning: { label: 'Scanning…', class: 'text-yellow-600' },
    pending: { label: 'Awaiting scan', class: 'text-[--m-ink-tertiary]' },
    clean: { label: 'Clean', class: 'text-green-600' },
    admin_cleared: { label: 'Cleared', class: 'text-green-600' },
    skipped: { label: 'Skipped', class: 'text-[--m-ink-tertiary]' },
  };
  const s = statusMap[row.scan_status] ?? { label: row.scan_status, class: '' };

  return (
    <Link
      href={`/admin/editorial-review/${row.editorial_id}`}
      className="flex items-center gap-4 px-4 py-3 bg-white hover:bg-[--m-surface-raised] transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {row.events?.display_name ?? 'Unnamed couple'}
        </p>
        <p className="text-xs text-[--m-ink-tertiary] mt-0.5">
          {row.events?.event_date
            ? new Date(row.events.event_date).toLocaleDateString('en-PH', {
                month: 'short', day: 'numeric', year: 'numeric',
              })
            : 'No date'}{' '}
          · Scanned{' '}
          {row.scan_completed_at
            ? new Date(row.scan_completed_at).toLocaleDateString('en-PH', {
                month: 'short', day: 'numeric',
              })
            : 'not yet'}
        </p>
      </div>

      {/* Flag counts */}
      <div className="flex items-center gap-2 shrink-0">
        {red.length > 0 && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            redPending.length > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500 line-through'
          }`}>
            {red.length} red
          </span>
        )}
        {yellow.length > 0 && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
            {yellow.length} grammar
          </span>
        )}
        <span className={`text-xs font-medium ${s.class}`}>{s.label}</span>
        <span className="text-[--m-ink-tertiary]">→</span>
      </div>
    </Link>
  );
}
