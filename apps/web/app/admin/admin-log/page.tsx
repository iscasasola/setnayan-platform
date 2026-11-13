import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { ADMIN_AREA_LIST, adminAreaLabel, auditRowArea, isAdminArea } from '@/lib/admin/areas';
import { logQueryError } from '@/lib/supabase/error-detect';
import { PageMasthead } from '@/app/_components/page-masthead';
import { InfoTip } from '@/app/_components/info-tip';
import { ErrorState } from '@/app/_components/states/error-state';

export const metadata = { title: 'Admin log · Admin' };

/**
 * ADMIN LOG — every act in the console, by person, area and day.
 * Ported from the approved drawing (Setnayan-specs prototypes/admin_pub/admin.html
 * `page('admin-log', …)`), with the 2026-11-13 Area ▾ filter and "by <name> ·
 * time" on every acted row. Read-only: rows are never edited (the table is
 * append-only in the database).
 *
 * Rows written before 2026-11-13 carry no area; their area is read from the
 * action name (lib/admin/areas.ts → areaForAuditAction) and marked as such.
 */

/** How many recent rows one view reads. Filters apply inside this window, and the page says so. */
const WINDOW = 500;

type LogRow = {
  action: string;
  area: string | null;
  target_table: string | null;
  target_id: string | null;
  reason: string | null;
  actor_user_id: string | null;
  created_at: string;
};

const DAY_OPTIONS = [
  { key: 'any', label: 'Any day', days: null },
  { key: 'today', label: 'Today', days: 1 },
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
] as const;

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function actionWords(action: string): string {
  return action.replace(/^approval_/, 'request ').replace(/[_:]+/g, ' ').trim();
}

export default async function AdminLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');
  const person = one('person');
  const area = isAdminArea(one('area')) ? one('area') : '';
  const action = one('action').trim().slice(0, 80);
  const day = DAY_OPTIONS.find((d) => d.key === one('day')) ?? DAY_OPTIONS[0];

  const admin = createAdminClient();
  let q = admin
    .from('admin_audit_log')
    .select('action, area, target_table, target_id, reason, actor_user_id, created_at')
    .order('created_at', { ascending: false })
    .limit(WINDOW);
  if (person === 'system') q = q.is('actor_user_id', null);
  else if (person) q = q.eq('actor_user_id', person);
  if (action) q = q.ilike('action', `%${action.replace(/[%_]/g, '')}%`);
  if (day.days) q = q.gte('created_at', new Date(Date.now() - day.days * 86_400_000).toISOString());

  const [logRes, peopleRes] = await Promise.all([
    q,
    admin
      .from('users')
      .select('user_id, email, display_name')
      .or('account_type.eq.admin,is_internal.eq.true,is_team_member.eq.true'),
  ]);
  if (logRes.error) logQueryError('AdminLogPage.log', logRes.error, {}, 'graceful_degrade');
  if (peopleRes.error) logQueryError('AdminLogPage.people', peopleRes.error, {}, 'graceful_degrade');

  const rows = logRes.error ? null : ((logRes.data ?? []) as LogRow[]);
  const names = new Map<string, string>();
  for (const u of (peopleRes.data ?? []) as Array<{ user_id: string; email: string | null; display_name: string | null }>) {
    names.set(u.user_id, u.display_name || u.email || u.user_id);
  }
  // Actors who are no longer admins still need a name on their old rows.
  const missing = [...new Set((rows ?? []).map((r) => r.actor_user_id).filter((id): id is string => !!id && !names.has(id)))];
  if (missing.length > 0) {
    const { data: more, error } = await admin.from('users').select('user_id, email, display_name').in('user_id', missing);
    if (error) logQueryError('AdminLogPage.actors', error, {}, 'graceful_degrade');
    for (const u of (more ?? []) as Array<{ user_id: string; email: string | null; display_name: string | null }>) {
      names.set(u.user_id, u.display_name || u.email || u.user_id);
    }
  }
  const nameOf = (id: string | null) => (id ? names.get(id) ?? 'A former admin' : 'System');

  const shown = (rows ?? []).filter((r) => !area || auditRowArea(r) === area);

  const select = 'rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm';
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMasthead title="Admin log" />

      <form method="get" className="mb-6 grid gap-3 rounded-2xl border border-ink/10 bg-cream p-4 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
          Person
          <select name="person" defaultValue={person} className={select}>
            <option value="">Everyone</option>
            {[...names.entries()].map(([id, n]) => (
              <option key={id} value={id}>
                {n}
              </option>
            ))}
            <option value="system">System</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
          Area
          <select name="area" defaultValue={area} className={select}>
            <option value="">Every area</option>
            {ADMIN_AREA_LIST.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
          Action
          <input name="action" defaultValue={action} placeholder="All actions" className={select} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
          Day
          <select name="day" defaultValue={day.key} className={select}>
            {DAY_OPTIONS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-4">
          <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            Show
          </button>
        </div>
      </form>

      {rows === null ? (
        <ErrorState
          title="Couldn’t load the Admin log"
          broke={logRes.error?.message ? `The read was refused: ${logRes.error.message}` : 'The read did not complete.'}
          survived="Not the same as no actions — nothing was ruled out."
          todo="Reload. If it repeats, the query is being rejected rather than returning nothing."
        />
      ) : shown.length === 0 ? (
        <div className="sn-row p-8 text-center text-sm text-ink/70">
          {rows.length === 0 && !person && !action && !day.days && !area
            ? 'No admin actions logged yet.'
            : 'Nothing matches these filters.'}
        </div>
      ) : (
        <>
          <p className="mb-3 flex items-center gap-2 text-xs text-ink/55">
            <span>
              {shown.length} {shown.length === 1 ? 'action' : 'actions'}
              {rows.length === WINDOW ? ` · from the latest ${WINDOW}` : ''}
            </span>
            <InfoTip label="" ariaLabel="About the Admin log" align="start">
              Every confirm in the console writes one row with the person and the reason. Rows are never edited. Rows
              from before 13 Nov 2026 did not record an area; theirs is read from the action’s name and marked “from the
              action”.
            </InfoTip>
          </p>
          <ul className="space-y-2">
            {shown.map((r, i) => {
              const a = auditRowArea(r);
              const derived = !r.area && a;
              return (
                <li key={`${r.created_at}-${i}`} className="sn-row p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{actionWords(r.action)}</span>
                    <span className="rounded-md bg-ink/5 px-2 py-0.5 text-[11px] font-semibold text-ink/70">
                      {a ? adminAreaLabel(a) : 'No area'}
                      {derived ? ' · from the action' : ''}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink/60">
                    by <strong className="text-ink/80">{nameOf(r.actor_user_id)}</strong> · {when(r.created_at)}
                    {r.target_table ? ` · ${r.target_table}` : ''}
                  </p>
                  {r.reason ? <p className="mt-1 text-sm text-ink/75">“{r.reason}”</p> : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
