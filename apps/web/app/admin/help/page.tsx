import { Mail } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SubmitButton } from '@/app/_components/submit-button';
import { setHelpMessageStatus } from './actions';

export const metadata = { title: 'Help inbox · Admin' };

type HelpMessageRow = {
  message_id: string;
  public_id: string;
  user_id: string | null;
  sender_email: string;
  sender_name: string | null;
  topic: string | null;
  subject: string;
  body: string;
  status: 'new' | 'in_progress' | 'closed';
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
};

const STATUS_TONE: Record<HelpMessageRow['status'], string> = {
  new: 'bg-rose-100 text-rose-800',
  in_progress: 'bg-amber-100 text-amber-900',
  closed: 'bg-emerald-100 text-emerald-800',
};

const STATUS_LABEL: Record<HelpMessageRow['status'], string> = {
  new: 'New',
  in_progress: 'In progress',
  closed: 'Closed',
};

type Props = { searchParams: Promise<{ status?: string }> };

export default async function AdminHelpPage({ searchParams }: Props) {
  const search = await searchParams;
  const filter = (search.status ?? 'open') as 'open' | 'all' | 'new' | 'in_progress' | 'closed';

  const admin = createAdminClient();
  let query = admin
    .from('help_messages')
    .select(
      'message_id,public_id,user_id,sender_email,sender_name,topic,subject,body,status,admin_notes,resolved_at,created_at',
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (filter === 'open') query = query.in('status', ['new', 'in_progress']);
  else if (filter === 'new' || filter === 'in_progress' || filter === 'closed')
    query = query.eq('status', filter);

  const { data, error } = await query;
  if (error) {
    logQueryError('AdminHelpPage (help_messages)', error);
  }
  const items = (data ?? []) as HelpMessageRow[];

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Help inbox</h1>
        <p className="text-sm text-ink/60">
          Messages submitted via <code className="text-xs">/help</code>. Anyone (anon or
          signed-in) can submit; replies go via email (manual until Resend wires).
        </p>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2">
        <FilterChip active={filter} target="open" label="Open" />
        <FilterChip active={filter} target="new" label="New" />
        <FilterChip active={filter} target="in_progress" label="In progress" />
        <FilterChip active={filter} target="closed" label="Closed" />
        <FilterChip active={filter} target="all" label="All" />
      </nav>

      {error ? (
        <p className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700">
          Help inbox couldn&apos;t load right now. We&apos;ve logged the issue — refresh in a moment or check Sentry for the full detail.
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center text-sm text-ink/55">
          <Mail aria-hidden className="mx-auto mb-2 h-6 w-6 text-ink/30" strokeWidth={1.5} />
          Nothing in this view.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((m) => (
            <li
              key={m.message_id}
              id={`message-${m.message_id}`}
              className="scroll-mt-24 space-y-3 rounded-xl border border-ink/10 bg-cream p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
                    {m.public_id} · {m.topic ?? 'no-topic'} · {m.created_at.slice(0, 10)}
                  </p>
                  <p className="text-sm font-semibold text-ink">{m.subject}</p>
                  <p className="text-xs text-ink/60">
                    From{' '}
                    <a
                      href={`mailto:${m.sender_email}?subject=Re:%20${encodeURIComponent(m.subject)}`}
                      className="text-terracotta hover:underline"
                    >
                      {m.sender_email}
                    </a>
                    {m.sender_name ? ` (${m.sender_name})` : ''}
                    {m.user_id ? ' · signed-in user' : ' · anonymous'}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                    STATUS_TONE[m.status]
                  }`}
                >
                  {STATUS_LABEL[m.status]}
                </span>
              </div>

              <p className="whitespace-pre-wrap rounded-md bg-ink/[0.03] p-3 text-sm text-ink/75">
                {m.body}
              </p>

              {m.admin_notes ? (
                <p className="rounded-md bg-amber-50/60 p-3 text-xs text-amber-900">
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em]">
                    Admin notes
                  </span>
                  <br />
                  {m.admin_notes}
                </p>
              ) : null}

              <form
                action={setHelpMessageStatus}
                className="flex flex-col gap-2 border-t border-ink/10 pt-3 sm:flex-row sm:items-end"
              >
                <input type="hidden" name="message_id" value={m.message_id} />
                <label className="flex-1 space-y-1">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    Status
                  </span>
                  <select
                    name="status"
                    defaultValue={m.status}
                    className="input-field h-9 py-0 text-sm"
                  >
                    <option value="new">New</option>
                    <option value="in_progress">In progress</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
                <label className="flex-1 space-y-1">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    Admin notes
                  </span>
                  <input
                    name="admin_notes"
                    defaultValue={m.admin_notes ?? ''}
                    placeholder="e.g. replied via email at 14:32"
                    className="input-field h-9 py-0 text-sm"
                  />
                </label>
                <SubmitButton
                  className="inline-flex h-11 items-center justify-center rounded-md bg-mulberry px-3 text-xs font-medium text-cream hover:bg-mulberry-600 disabled:opacity-70"
                  pendingLabel="Updating…"
                >
                  Update
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  active,
  target,
  label,
}: {
  active: string;
  target: string;
  label: string;
}) {
  const isActive = active === target;
  return (
    <a
      href={`/admin/help?status=${target}`}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        isActive
          ? 'bg-terracotta text-cream'
          : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
      }`}
    >
      {label}
    </a>
  );
}
