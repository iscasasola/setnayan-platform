import { AlertTriangle, CheckCircle2, Clapperboard, Clock3, Loader2, XCircle } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { findPatiktokTemplate } from '@/lib/patiktok';
import { PageMasthead } from '@/app/_components/page-masthead';
import { ConsoleTable, type ConsoleColumn } from '@/app/admin/_components/console-table';

/**
 * PatiktokSurface — the Patiktok render-job monitor body, inside the tabbed
 * /admin/studio studio (Studio Studio slice 2).
 *
 * Iteration 0017 PR4 — read-only ops view over the client-side render queue:
 * recent jobs across all events, their status, which render path ran, output
 * size, delivery state, and any failure reason — so the team can spot reels
 * that didn't render (e.g. a device without WebCodecs, or R2 CORS not yet set).
 *
 * ── WHAT CHANGED 2026-08-17, and it is not looks ────────────────────────────
 * 🚨 THIS SURFACE NEVER DESTRUCTURED `error` AT ALL. The read was
 * `const { data: jobsRaw } = await admin.from('patiktok_render_jobs')…`, then
 * `(jobsRaw ?? [])`. Supabase RESOLVES with `{ error }` instead of throwing, so
 * a refused query — phantom column, stale enum value, unapplied migration,
 * missing grant — arrived as `data: null`, became `[]`, and this page printed
 * "No Patiktok render jobs yet." to the one person whose whole job on this
 * screen is to notice reels that failed. It also printed "latest 0" in the lede
 * and a five-chip strip of honest-looking zeroes over the same nothing.
 *
 * ⚠ That makes this surface the SECOND liar in this lane, not the first — the
 * lane brief counted one (referrals). Referrals at least CAPTURED the error and
 * discarded it; this one never asked for it. Discarding an error and never
 * requesting it produce the identical screen, so a scan for `error` finds only
 * the first kind. **Not destructuring is not the absence of a defect.**
 *
 * ⛔ AND THE CAP WAS SILENT. `.limit(60)` with nothing on screen saying so, on a
 * queue where "this is all of it" is the answer an ops reader takes away. The 60
 * is now one exported constant used by the query AND by `cap` — two hand-typed
 * copies of a number is not a guard.
 *
 * StatusPill is KEPT LOCAL ON PURPOSE. A render job's states (queued ·
 * rendering · completed · failed · cancelled) are a render queue's vocabulary,
 * not a shared one — the discount-code pill three files away renders
 * active/expired/disabled off different values with different meanings. Two
 * pills that happen to be round is not duplication, and a shared pill taking a
 * `variant` for every caller is the 22-local-Stat problem wearing a hat.
 */

/**
 * The read's `.limit(...)`. ONE constant, used by the query and by `cap`, so a
 * full page discloses itself instead of reading as the whole queue.
 */
const RECENT_JOB_CAP = 60;

type JobRow = {
  job_id: string;
  event_id: string;
  template_slug: string;
  duration_sec: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  render_mode: string | null;
  output_bytes: number | null;
  failure_reason: string | null;
  enqueued_at: string;
  completed_at: string | null;
  delivered_at: string | null;
};

const STATUSES = ['queued', 'processing', 'completed', 'failed', 'cancelled'] as const;

function fmtMb(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '—';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function StatusPill({ status }: { status: JobRow['status'] }) {
  const map: Record<JobRow['status'], { Icon: typeof Clock3; cls: string; label: string }> = {
    queued: { Icon: Clock3, cls: 'bg-ink/5 text-ink/70', label: 'Queued' },
    processing: { Icon: Loader2, cls: 'bg-warn-100 text-warn-900', label: 'Rendering' },
    completed: { Icon: CheckCircle2, cls: 'bg-success-100 text-success-900', label: 'Completed' },
    failed: { Icon: XCircle, cls: 'bg-danger-100 text-danger-900', label: 'Failed' },
    cancelled: { Icon: XCircle, cls: 'bg-ink/5 text-ink/55', label: 'Cancelled' },
  };
  const { Icon, cls, label } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${cls}`}
    >
      <Icon
        aria-hidden
        className={`h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`}
        strokeWidth={1.75}
      />
      {label}
    </span>
  );
}

export async function PatiktokSurface() {
  const admin = createAdminClient();

  const { data: jobsRaw, error } = await admin
    .from('patiktok_render_jobs')
    .select(
      'job_id, event_id, template_slug, duration_sec, status, render_mode, output_bytes, failure_reason, enqueued_at, completed_at, delivered_at',
    )
    .order('enqueued_at', { ascending: false })
    .limit(RECENT_JOB_CAP);
  if (error) logQueryError('AdminPatiktokSurface', error);

  // NULL SURVIVES TO THE RENDER. `jobs` is the honest value — not measured stays
  // not measured — and `listed` is the flattened copy only the lookups below use.
  const jobs = jobsRaw as JobRow[] | null;
  const listed = jobs ?? [];

  const eventIds = Array.from(new Set(listed.map((j) => j.event_id)));
  const { data: eventRows } = eventIds.length
    ? await admin.from('events').select('event_id, display_name').in('event_id', eventIds)
    : { data: [] as Array<{ event_id: string; display_name: string | null }> };
  const eventName = new Map<string, string>();
  for (const e of eventRows ?? []) {
    eventName.set(
      e.event_id as string,
      ((e.display_name as string | null) ?? '').trim() || 'Untitled wedding',
    );
  }

  const counts = listed.reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1;
    return acc;
  }, {});

  const columns: ConsoleColumn<JobRow>[] = [
    {
      header: 'Event',
      cell: (j) => (
        <span className="font-medium text-ink">{eventName.get(j.event_id) ?? '—'}</span>
      ),
    },
    { header: 'Status', cell: (j) => <StatusPill status={j.status} /> },
    {
      header: 'Why it failed',
      hideBelow: 'md',
      cell: (j) =>
        j.status === 'failed' && j.failure_reason ? (
          <span className="inline-flex items-start gap-1 text-[11px] text-danger-700">
            <AlertTriangle aria-hidden className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={1.75} />
            {j.failure_reason}
          </span>
        ) : (
          <span className="text-ink/45">—</span>
        ),
    },
    {
      header: 'Template',
      hideBelow: 'lg',
      cell: (j) => (
        <span className="text-ink/70">
          {findPatiktokTemplate(j.template_slug)?.name ?? j.template_slug}
        </span>
      ),
    },
    { header: 'Dur', hideBelow: 'lg', mono: true, cell: (j) => `${j.duration_sec}s` },
    {
      header: 'Mode',
      hideBelow: 'lg',
      mono: true,
      cell: (j) => (j.render_mode ? j.render_mode.replace('client_', '') : '—'),
    },
    { header: 'Size', hideBelow: 'lg', mono: true, cell: (j) => fmtMb(j.output_bytes) },
    {
      header: 'Email',
      hideBelow: 'lg',
      mono: true,
      cell: (j) => (j.delivered_at ? '✓ sent' : '—'),
    },
    {
      header: 'Queued',
      hideBelow: 'md',
      mono: true,
      cell: (j) =>
        new Date(j.enqueued_at).toLocaleString('en-PH', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
    },
  ];

  return (
    <section className="space-y-6">
      <PageMasthead
        titleNode={
          <span>
            <Clapperboard aria-hidden className="h-6 w-6" strokeWidth={1.75} />
            Patiktok renders
          </span>
        }
      />

      {/* Status chips. An UNMEASURED queue shows an em-dash, never 0 — a chip
          reading "failed · 0" over a refused read is the same lie as the empty
          table, in a smaller box. */}
      <div className="flex flex-wrap gap-2 text-xs">
        {STATUSES.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white/70 px-3 py-1 font-mono uppercase tracking-[0.15em] text-ink/70"
          >
            {s} · {jobs ? (counts[s] ?? 0) : '—'}
          </span>
        ))}
      </div>

      <ConsoleTable
        rows={jobs}
        columns={columns}
        rowKey={(j) => j.job_id}
        label="Patiktok render jobs"
        readPermitted
        readError={error}
        reads="the Patiktok render queue"
        cap={RECENT_JOB_CAP}
        minWidth="52rem"
        empty={{
          Icon: Clapperboard,
          title: 'No render jobs yet',
          blurb:
            'A job lands here the moment a guest or a couple renders a Patiktok reel — the encode runs in their own browser and reports back. Nothing to fix while this is empty; an empty queue means nobody has rendered one, not that renders are failing.',
        }}
      />
    </section>
  );
}
