import { Flag, EyeOff, UserX, ArrowUpRight, Check, X } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { relativeTime } from '@/lib/activity';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { resolveReport } from './actions';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'User reports · Admin' };
export const dynamic = 'force-dynamic';

/**
 * /admin/user-reports — Setnayan moderator queue for the UGC report path
 * (Apple guideline 1.2 / Google Play UGC). Reports filed against Papic guest
 * gallery photos route here (and to the couple's own surface). Previously
 * reports had no admin destination — this closes that gap.
 *
 * Auth is enforced at the layout level (app/admin/layout.tsx → notFound() for
 * non-admins), same as every other /admin surface.
 */

type ReportRow = {
  report_id: string;
  public_id: string;
  reporter_user_id: string | null;
  reporter_guest_id: string | null;
  event_id: string;
  target_type: 'photo' | 'comment' | 'user' | 'ai_output';
  target_id: string;
  reason: string;
  details: string | null;
  status: 'open' | 'actioned' | 'dismissed';
  action_taken: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type StatusFilter = 'all' | 'open' | 'actioned' | 'dismissed';

const STATUS_LABEL: Record<ReportRow['status'], string> = {
  open: 'Open',
  actioned: 'Actioned',
  dismissed: 'Dismissed',
};
const STATUS_TONE: Record<ReportRow['status'], string> = {
  open: 'bg-warn-100 text-warn-900',
  actioned: 'bg-success-100 text-success-800',
  dismissed: 'bg-ink/10 text-ink/60',
};

const REASON_LABEL: Record<string, string> = {
  nudity_sexual: 'Nudity / sexual',
  violence: 'Violence',
  hate_harassment: 'Hate / harassment',
  spam: 'Spam',
  not_my_event: 'Not from this event',
  other: 'Other',
};

// How the target reads in the queue. 'ai_output' = a Setnayan AI generation
// (bespoke monogram studio — Google Play GenAI policy reporting path); its
// target_id is a bespoke_monogram_generations.generation_id, no photo
// thumbnail to resolve.
const TARGET_PHRASE: Record<ReportRow['target_type'], string> = {
  photo: 'a photo',
  comment: 'a comment',
  user: 'a user',
  ai_output: 'an AI-generated result',
};
const TARGET_SHORT: Record<ReportRow['target_type'], string> = {
  photo: 'photo',
  comment: 'comment',
  user: 'user',
  ai_output: 'AI output',
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'actioned', label: 'Actioned' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All' },
];

function normalizeStatus(raw: string): StatusFilter {
  return (['all', 'open', 'actioned', 'dismissed'] as const).includes(raw as StatusFilter)
    ? (raw as StatusFilter)
    : 'open';
}

export default async function AdminUserReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const search = await searchParams;
  const status = normalizeStatus(search.status ?? 'open');

  const admin = createAdminClient();

  let listQuery = admin
    .from('user_reports')
    .select(
      'report_id, public_id, reporter_user_id, reporter_guest_id, event_id, target_type, target_id, reason, details, status, action_taken, reviewed_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (status !== 'all') listQuery = listQuery.eq('status', status);
  const { data: listData, error: listError } = await listQuery;
  if (listError) logQueryError('AdminUserReportsPage (user_reports)', listError);
  const rows = (listData ?? []) as ReportRow[];

  // Resolve context: event names, reporter names, and a thumbnail for each
  // photo target. One parallel batch keyed on the visible page.
  const eventIds = Array.from(new Set(rows.map((r) => r.event_id)));
  const reporterIds = Array.from(
    new Set(rows.map((r) => r.reporter_user_id).filter((v): v is string => Boolean(v))),
  );
  const photoTargetIds = Array.from(
    new Set(rows.filter((r) => r.target_type === 'photo').map((r) => r.target_id)),
  );

  const [{ data: eventData }, { data: reporterData }, { data: captureData }] =
    await Promise.all([
      eventIds.length
        ? admin.from('events').select('event_id, display_name').in('event_id', eventIds)
        : Promise.resolve({ data: [] as { event_id: string; display_name: string | null }[] }),
      reporterIds.length
        ? admin.from('users').select('user_id, display_name, email').in('user_id', reporterIds)
        : Promise.resolve({ data: [] as { user_id: string; display_name: string | null; email: string | null }[] }),
      photoTargetIds.length
        ? admin
            .from('papic_guest_captures')
            .select('capture_id, r2_object_key, hidden_at')
            .in('capture_id', photoTargetIds)
        : Promise.resolve({ data: [] as { capture_id: string; r2_object_key: string | null; hidden_at: string | null }[] }),
    ]);

  const eventName = new Map<string, string>();
  for (const e of eventData ?? [])
    eventName.set(e.event_id, ((e.display_name as string | null) ?? '').trim() || 'Untitled event');

  const reporterName = new Map<string, string>();
  for (const u of reporterData ?? [])
    reporterName.set(
      u.user_id,
      ((u.display_name as string | null) ?? '').trim() ||
        ((u.email as string | null) ?? '').trim() ||
        'Unknown',
    );

  const captureMeta = new Map<string, { ref: string | null; hidden: boolean }>();
  for (const c of captureData ?? [])
    captureMeta.set(c.capture_id, {
      ref: (c.r2_object_key as string | null) ?? null,
      hidden: Boolean(c.hidden_at),
    });

  const thumbEntries = await Promise.all(
    (captureData ?? []).map(async (c) => {
      const ref = c.r2_object_key as string | null;
      return [c.capture_id as string, ref ? await displayUrlForStoredAsset(ref) : null] as const;
    }),
  );
  const thumbUrl = new Map<string, string | null>();
  for (const [id, url] of thumbEntries) thumbUrl.set(id, url);

  const openCount = rows.filter((r) => r.status === 'open').length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <Flag className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          <h1 className="text-2xl font-semibold tracking-tight">User reports</h1>
        </div>
        <p className="text-sm text-ink/65">
          Reports filed against guest gallery content (Papic) and Setnayan AI
          output (Play GenAI policy). Hide the photo, block the uploader for
          that event, escalate for owner/legal review, or dismiss. The latest
          200 matching the filter, newest first.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <a
            key={f.value}
            href={`/admin/user-reports?status=${f.value}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              status === f.value
                ? 'bg-ink text-cream'
                : 'border border-ink/15 text-ink/70 hover:bg-ink/[0.04]'
            }`}
          >
            {f.label}
            {f.value === 'open' && openCount > 0 ? ` · ${openCount}` : ''}
          </a>
        ))}
      </div>

      {listError && (
        <FormFlash tone="error">
          Reports couldn&apos;t load right now. We&apos;ve logged the issue —
          refresh in a moment.
        </FormFlash>
      )}

      {rows.length === 0 ? (
        <p className="rounded-md border border-ink/10 bg-cream px-4 py-3 text-sm text-ink/65">
          No reports in this view.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const meta = r.target_type === 'photo' ? captureMeta.get(r.target_id) : undefined;
            const url = r.target_type === 'photo' ? thumbUrl.get(r.target_id) ?? null : null;
            const reporter = r.reporter_user_id
              ? reporterName.get(r.reporter_user_id) ?? 'User'
              : r.reporter_guest_id
                ? 'A guest'
                : 'Anonymous';
            return (
              <li
                key={r.report_id}
                className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-surface p-4 shadow-sm sm:flex-row"
              >
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-ink/[0.04]">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt="Reported content"
                      className={`h-full w-full object-cover ${meta?.hidden ? 'opacity-40 grayscale' : ''}`}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-center text-[10px] text-ink/40">
                      {TARGET_SHORT[r.target_type] ?? r.target_type}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[r.status]}`}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                    <span className="rounded-full bg-terracotta/10 px-2 py-0.5 text-[11px] font-medium text-terracotta-700">
                      {REASON_LABEL[r.reason] ?? r.reason}
                    </span>
                    {meta?.hidden && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-ink/10 px-2 py-0.5 text-[11px] text-ink/60">
                        <EyeOff aria-hidden className="h-3 w-3" strokeWidth={2} /> Hidden
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-ink/45">{r.public_id}</span>
                  </div>
                  <p className="text-sm text-ink/80">
                    {reporter} reported {TARGET_PHRASE[r.target_type] ?? `a ${r.target_type}`} in{' '}
                    <span className="font-medium">{eventName.get(r.event_id) ?? 'an event'}</span>
                    {' · '}
                    <span className="text-ink/50">{relativeTime(r.created_at)}</span>
                  </p>
                  {r.target_type === 'ai_output' && (
                    <p className="font-mono text-[10px] text-ink/45">
                      generation {r.target_id}
                    </p>
                  )}
                  {r.details && (
                    <p className="rounded-md border border-ink/10 bg-cream px-3 py-2 text-sm text-ink/70">
                      “{r.details}”
                    </p>
                  )}
                  {r.status !== 'open' && r.action_taken && (
                    <p className="text-xs text-ink/55">
                      {r.action_taken}
                      {r.reviewed_at ? ` · ${relativeTime(r.reviewed_at)}` : ''}
                    </p>
                  )}

                  {r.status === 'open' && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {r.target_type === 'photo' && (
                        <form action={resolveReport}>
                          <input type="hidden" name="report_id" value={r.report_id} />
                          <input type="hidden" name="action" value="hide" />
                          <SubmitButton
                            className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/80 hover:bg-ink/[0.04]"
                            pendingLabel="Hiding…"
                          >
                            <EyeOff aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Hide content
                          </SubmitButton>
                        </form>
                      )}
                      {/* Block resolves a GUEST uploader — only meaningful for
                          photo/user targets. An ai_output target is a Setnayan
                          AI generation; there is no uploader to block. */}
                      {(r.target_type === 'photo' || r.target_type === 'user') && (
                        <form action={resolveReport}>
                          <input type="hidden" name="report_id" value={r.report_id} />
                          <input type="hidden" name="action" value="block" />
                          <SubmitButton
                            className="inline-flex items-center gap-1.5 rounded-md border border-terracotta/30 bg-terracotta/5 px-3 py-1.5 text-xs font-medium text-terracotta-700 hover:bg-terracotta/10"
                            pendingLabel="Blocking…"
                          >
                            <UserX aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Block uploader
                          </SubmitButton>
                        </form>
                      )}
                      <form action={resolveReport}>
                        <input type="hidden" name="report_id" value={r.report_id} />
                        <input type="hidden" name="action" value="escalate" />
                        <SubmitButton
                          className="inline-flex items-center gap-1.5 rounded-md border border-warn-300 bg-warn-50 px-3 py-1.5 text-xs font-medium text-warn-900 hover:bg-warn-100"
                          pendingLabel="Escalating…"
                        >
                          <ArrowUpRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Escalate
                        </SubmitButton>
                      </form>
                      <form action={resolveReport}>
                        <input type="hidden" name="report_id" value={r.report_id} />
                        <input type="hidden" name="action" value="dismiss" />
                        <SubmitButton
                          className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/60 hover:bg-ink/[0.04]"
                          pendingLabel="Dismissing…"
                        >
                          <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Dismiss
                        </SubmitButton>
                      </form>
                    </div>
                  )}
                  {r.status !== 'open' && (
                    <p className="inline-flex items-center gap-1.5 pt-1 text-xs font-medium text-success-700">
                      <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Resolved
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
        Source · iteration 0023 · table <code>user_reports</code> (migration
        20261106000000) · Apple 1.2 / Google Play UGC
      </p>
    </div>
  );
}
