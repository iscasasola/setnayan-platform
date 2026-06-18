import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import type { ScanFlag } from '@/lib/editorial-scan';
import { resolveFlag, unlockForCouple, triggerRescan } from './actions';

export const metadata = { title: 'Editorial review · Admin' };

export default async function EditorialReviewDetailPage({
  params,
}: {
  params: Promise<{ editorialId: string }>;
}) {
  const { editorialId } = await params;
  const admin = createAdminClient();

  const { data: row } = await admin
    .from('event_editorial')
    .select(`
      editorial_id, scan_status, scan_flags, scan_completed_at,
      unlocked_for_couple_at, published_at,
      events ( event_id, display_name, event_date )
    `)
    .eq('editorial_id', editorialId)
    .maybeSingle();

  if (!row) notFound();

  const flags = (row.scan_flags ?? []) as ScanFlag[];
  const rawEvent = row.events;
  const event = (Array.isArray(rawEvent) ? rawEvent[0] : rawEvent) as {
    event_id: string;
    display_name: string | null;
    event_date: string | null;
  } | null | undefined;
  const redPending = flags.filter(f => f.severity === 'red' && f.status === 'pending');
  const canUnlock = redPending.length === 0 && row.scan_status !== 'admin_cleared';

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-[--m-ink-tertiary] mb-1">
            Editorial review
          </p>
          <h1 className="text-xl font-semibold">
            {event?.display_name ?? 'Unnamed couple'}
          </h1>
          {event?.event_date && (
            <p className="text-sm text-[--m-ink-secondary] mt-0.5">
              {new Date(event.event_date).toLocaleDateString('en-PH', {
                month: 'long', day: 'numeric', year: 'numeric',
              })}
            </p>
          )}
        </div>
        <StatusBadge status={row.scan_status} />
      </div>

      {/* Unlock action */}
      {row.scan_status === 'admin_cleared' ? (
        <div className="rounded-lg border border-[--m-ink-border] bg-[--m-surface-raised] px-4 py-3 text-sm text-[--m-ink-secondary]">
          Unlocked for couple on{' '}
          {row.unlocked_for_couple_at
            ? new Date(row.unlocked_for_couple_at).toLocaleString('en-PH')
            : '—'}
        </div>
      ) : canUnlock ? (
        <form
          action={async () => {
            'use server';
            await unlockForCouple(editorialId);
          }}
        >
          <SubmitButton className="w-full bg-[--m-mulberry] text-white rounded-lg py-2.5 text-sm font-medium">
            Unlock for couple — all red flags resolved
          </SubmitButton>
        </form>
      ) : (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {redPending.length} red flag{redPending.length > 1 ? 's' : ''} must be resolved before unlocking.
        </div>
      )}

      {/* Re-scan */}
      {(row.scan_status === 'flagged' || row.scan_status === 'clean' || row.scan_status === 'skipped' || row.scan_status === 'admin_cleared') && (
        <form
          action={async () => {
            'use server';
            await triggerRescan(editorialId);
          }}
        >
          <SubmitButton className="w-full rounded-lg border border-[--m-ink-border] bg-white py-2 text-sm text-[--m-ink-secondary] hover:bg-[--m-surface-raised]">
            Re-scan editorial
          </SubmitButton>
        </form>
      )}

      {/* Flags list */}
      {flags.length === 0 ? (
        <div className="rounded-lg border border-[--m-ink-border] px-4 py-8 text-center text-sm text-[--m-ink-tertiary]">
          No flags — editorial was clean.
        </div>
      ) : (
        <div className="space-y-4">
          {flags.map(flag => (
            <FlagCard key={flag.id} flag={flag} editorialId={editorialId} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; class: string }> = {
    flagged: { label: 'Needs review', class: 'bg-red-100 text-red-700' },
    scanning: { label: 'Scanning…', class: 'bg-yellow-100 text-yellow-700' },
    pending: { label: 'Pending scan', class: 'bg-gray-100 text-gray-600' },
    clean: { label: 'Clean', class: 'bg-green-100 text-green-700' },
    admin_cleared: { label: 'Cleared', class: 'bg-green-100 text-green-700' },
    skipped: { label: 'Scan skipped', class: 'bg-gray-100 text-gray-500' },
  };
  const s = map[status] ?? { label: status, class: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${s.class}`}>
      {s.label}
    </span>
  );
}

function FlagCard({ flag, editorialId }: { flag: ScanFlag; editorialId: string }) {
  const resolved = flag.status !== 'pending';

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${
      resolved
        ? 'border-[--m-ink-border] opacity-60'
        : flag.severity === 'red'
          ? 'border-red-300 bg-red-50/40'
          : 'border-yellow-300 bg-yellow-50/40'
    }`}>
      {/* Flag header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
          flag.severity === 'red' ? 'bg-red-600 text-white' : 'bg-yellow-500 text-white'
        }`}>
          {flag.severity === 'red' ? '● Vulgar' : '● Grammar'}
        </span>
        <span className="text-xs text-[--m-ink-tertiary] font-mono">{flag.label}</span>
        {resolved && (
          <span className="ml-auto text-xs text-[--m-ink-tertiary] capitalize">
            {flag.status}
            {flag.admin_edit ? ' · edited' : ''}
          </span>
        )}
      </div>

      {/* Original text */}
      <div className="rounded bg-white border border-[--m-ink-border] px-3 py-2">
        <p className="text-xs text-[--m-ink-tertiary] mb-1 uppercase tracking-wider">Original</p>
        <p className="text-sm leading-relaxed">{flag.original}</p>
      </div>

      {/* Note from scan */}
      {flag.note && (
        <p className="text-xs text-[--m-ink-secondary] bg-white/60 px-3 py-1.5 rounded border border-[--m-ink-border]">
          {flag.note}
        </p>
      )}

      {/* Admin edit result */}
      {flag.admin_edit && (
        <div className="rounded bg-green-50 border border-green-200 px-3 py-2">
          <p className="text-xs text-green-700 mb-1 uppercase tracking-wider">Admin rewrite</p>
          <p className="text-sm leading-relaxed text-green-900">{flag.admin_edit}</p>
        </div>
      )}

      {/* Actions */}
      {!resolved && (
        <div className="flex flex-col gap-2">
          <form
            action={async () => {
              'use server';
              await resolveFlag(editorialId, flag.id, 'dismiss');
            }}
            className="flex gap-2"
          >
            <SubmitButton className="flex-1 rounded-lg border border-[--m-ink-border] bg-white py-2 text-sm text-[--m-ink-secondary] hover:bg-[--m-surface-raised]">
              Mark OK — no change
            </SubmitButton>
          </form>
          <EditForm editorialId={editorialId} flagId={flag.id} />
        </div>
      )}
    </div>
  );
}

function EditForm({ editorialId, flagId }: { editorialId: string; flagId: string }) {
  return (
    <form
      action={async (formData: FormData) => {
        'use server';
        const text = formData.get('admin_edit') as string;
        if (!text?.trim()) return;
        await resolveFlag(editorialId, flagId, 'edit', text.trim());
      }}
      className="flex flex-col gap-2"
    >
      <textarea
        name="admin_edit"
        rows={3}
        placeholder="Write the corrected version here, then submit…"
        className="w-full rounded-lg border border-[--m-ink-border] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[--m-mulberry]"
      />
      <SubmitButton className="rounded-lg bg-[--m-ink] text-[--m-paper] py-2 text-sm font-medium">
        Save rewrite
      </SubmitButton>
    </form>
  );
}
