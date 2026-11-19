import { InfoTip } from '@/app/_components/info-tip';
import { PageMasthead } from '@/app/_components/page-masthead';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ScanFlag } from '@/lib/editorial-scan';

import { requireAdmin } from '@/lib/admin/require-admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { ReadFailed } from '../_components/read-failed';
import { formatCalendarDate } from '@/lib/events';
import { TemplateEmpty, TemplateRow, TemplateRows, TemplateSection } from '@/app/_components/template-rows';
export const metadata = { title: 'Editorial review · Admin' };

export default async function EditorialReviewPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: rows, error: rowsError } = await admin
    .from('event_editorial')
    .select(`
      editorial_id, scan_status, scan_flags, scan_completed_at,
      unlocked_for_couple_at, published_at,
      events ( display_name, event_date )
    `)
    .in('scan_status', ['flagged', 'admin_cleared', 'clean', 'skipped', 'pending', 'scanning'])
    .order('scan_completed_at', { ascending: false })
    .limit(100);

  if (rowsError) logQueryError('EditorialReviewPage (event_editorial)', rowsError);
  const flagged = (rows ?? []).filter(r => r.scan_status === 'flagged');
  const cleared = (rows ?? []).filter(r =>
    r.scan_status === 'admin_cleared' || r.scan_status === 'clean' || r.scan_status === 'skipped',
  );
  const pending = (rows ?? []).filter(r =>
    r.scan_status === 'pending' || r.scan_status === 'scanning',
  );

  // 📐 ADMIN CLEAN PORT (owner "ok", 19 Nov 2026 — reposition only): each status is a template section with its
  // count at the right, each editorial ONE hairline row that opens the record. Same read, same three groups.
  const groups = [
    { key: 'review', label: 'Needs review', rows: flagged },
    { key: 'pending', label: 'Queued / scanning', rows: pending },
    { key: 'cleared', label: 'Cleared', rows: cleared },
  ];
  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-8 pt-2 sm:px-6">
      {/* The page starts at its content.
          ⚖ The sentence survives: it says the draft is held back from the
          couple until somebody here unlocks it. Without that, an operator does
          not know that leaving this queue alone leaves a couple waiting. */}
      <PageMasthead title="Editorial review" />
      <div className="mb-1">
        <InfoTip label="How the review works" align="start" labelClassName="text-[13px] font-semibold text-ink/70">
          Editorials are scanned for vulgarity (OpenAI Moderation) before the
        couple sees their draft. Resolve red flags here, then unlock.
        </InfoTip>
      </div>

      {groups.map((g) =>
        g.rows.length > 0 ? (
          <TemplateSection key={g.key} label={g.label} right={String(g.rows.length)} data={g.key}>
            <TemplateRows label={g.label}>
              {g.rows.map(row => (
                <EditorialRow key={row.editorial_id} row={row} />
              ))}
            </TemplateRows>
          </TemplateSection>
        ) : null,
      )}

      {rowsError ? (
        <ReadFailed what="the editorial queue — a red flag could be waiting in it" />
      ) : null}

      {!rowsError && (rows ?? []).length === 0 && (
        <TemplateEmpty data="editorials">
          No editorials yet. They appear here once a wedding&apos;s content collection window closes.
        </TemplateEmpty>
      )}
    </div>
  );
}

type EventRef = { display_name: string | null; event_date: string | null };
type RowData = {
  editorial_id: string;
  scan_status: string;
  scan_flags: unknown;
  scan_completed_at: string | null;
  unlocked_for_couple_at: string | null;
  published_at: string | null;
  // Supabase may return the FK join as array or object depending on type gen
  events: EventRef | EventRef[] | null;
};

function EditorialRow({ row }: { row: RowData }) {
  const flags = (row.scan_flags ?? []) as ScanFlag[];
  const red = flags.filter(f => f.severity === 'red');
  const yellow = flags.filter(f => f.severity === 'yellow');
  const redPending = red.filter(f => f.status === 'pending');
  const ev = Array.isArray(row.events) ? row.events[0] : row.events;

  const statusMap: Record<string, { label: string; class: string }> = {
    flagged: { label: 'Needs review', class: 'text-[color:var(--sn-danger)]' },
    scanning: { label: 'Scanning…', class: 'text-yellow-600' },
    pending: { label: 'Awaiting scan', class: 'text-[--m-ink-tertiary]' },
    clean: { label: 'Clean', class: 'text-green-600' },
    admin_cleared: { label: 'Cleared', class: 'text-green-600' },
    skipped: { label: 'Skipped', class: 'text-[--m-ink-tertiary]' },
  };
  const s = statusMap[row.scan_status] ?? { label: row.scan_status, class: '' };

  const scanned = row.scan_completed_at
    ? new Date(row.scan_completed_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila',
        month: 'short', day: 'numeric',
      })
    : 'not yet';
  return (
    <TemplateRow
      data={row.editorial_id}
      href={`/admin/editorial-review/${row.editorial_id}`}
      edge={redPending.length > 0 ? 'late' : undefined}
      title={ev?.display_name ?? 'Unnamed couple'}
      line={
        <>
          {ev?.event_date
            ? formatCalendarDate(ev.event_date, {
                month: 'short', day: 'numeric', year: 'numeric',
              })
            : 'No date'}{' '}
          · Scanned {scanned}
          {red.length > 0 ? ` · ${red.length} red` : ''}
          {yellow.length > 0 ? ` · ${yellow.length} grammar` : ''}
        </>
      }
      right={<span className={`text-xs font-medium ${s.class}`}>{s.label}</span>}
    />
  );
}
