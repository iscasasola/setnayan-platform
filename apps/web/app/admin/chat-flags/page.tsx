import { ShieldAlert, Check, X } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { relativeTime } from '@/lib/activity';
import { requireAdmin } from '@/lib/admin/require-admin';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { SubmitButton } from '@/app/_components/submit-button';
import { resolveChatFlag } from './actions';

export const metadata = { title: 'Chat contact flags · Admin' };
export const dynamic = 'force-dynamic';

/**
 * /admin/chat-flags — moderator ABUSE-SIGNAL queue for couple↔vendor chat
 * messages that carried off-platform contact info (phone / email / social URL /
 * @handle / app-name / euphemism / solicitation). The send path
 * (lib/chat-send.ts) masks the payload in the delivered message and records
 * METADATA ONLY here — the category of what was shared, by whom, how often —
 * NEVER the message text. This is deliberate: the owner-locked admin-account-
 * access model (2026-06-22) forbids Setnayan staff from reading couple↔vendor
 * chat bodies (published trust promise · lint-admin-chat-guard). So this surface
 * lets a moderator spot a repeat off-platform-pusher without reading anyone's
 * conversation. Behaviour is gated behind CHAT_CONTACT_FILTER_ENABLED; the queue
 * only fills once the owner flips the flag on. Auth is enforced at the layout
 * level (admin only).
 */

type FlagRow = {
  flag_id: string;
  public_id: string;
  message_id: string;
  thread_id: string;
  event_id: string | null;
  vendor_profile_id: string | null;
  sender_user_id: string | null;
  sender_role: string;
  categories: string[] | null;
  hit_count: number | null;
  status: 'open' | 'reviewed' | 'dismissed';
  action_taken: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type StatusFilter = 'all' | 'open' | 'reviewed' | 'dismissed';

const STATUS_LABEL: Record<FlagRow['status'], string> = {
  open: 'Open',
  reviewed: 'Reviewed',
  dismissed: 'Dismissed',
};
const STATUS_TONE: Record<FlagRow['status'], string> = {
  open: 'bg-warn-100 text-warn-900',
  reviewed: 'bg-success-100 text-success-800',
  dismissed: 'bg-ink/10 text-ink/60',
};

const CATEGORY_LABEL: Record<string, string> = {
  phone: 'Phone number',
  email: 'Email',
  url: 'Social/messaging link',
  handle: '@handle',
  social_app: 'App name',
  euphemism: 'Euphemism',
  solicit: 'Solicitation',
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All' },
];

function normalizeStatus(raw: string): StatusFilter {
  return (['all', 'open', 'reviewed', 'dismissed'] as const).includes(raw as StatusFilter)
    ? (raw as StatusFilter)
    : 'open';
}

export default async function AdminChatFlagsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const search = await searchParams;
  const status = normalizeStatus(search.status ?? 'open');

  const admin = createAdminClient();

  let listQuery = admin
    .from('chat_message_flags')
    .select(
      'flag_id, public_id, message_id, thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, categories, hit_count, status, action_taken, reviewed_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (status !== 'all') listQuery = listQuery.eq('status', status);
  const { data: listData, error: listError } = await listQuery;
  if (listError) logQueryError('AdminChatFlagsPage (chat_message_flags)', listError);
  const rows = (listData ?? []) as FlagRow[];

  // Resolve context: event + vendor names for the visible page in one batch.
  const eventIds = Array.from(
    new Set(rows.map((r) => r.event_id).filter((v): v is string => Boolean(v))),
  );
  const vendorIds = Array.from(
    new Set(rows.map((r) => r.vendor_profile_id).filter((v): v is string => Boolean(v))),
  );

  const [{ data: eventData }, { data: vendorData }] = await Promise.all([
    eventIds.length
      ? admin.from('events').select('event_id, display_name').in('event_id', eventIds)
      : Promise.resolve({ data: [] as { event_id: string; display_name: string | null }[] }),
    vendorIds.length
      ? admin
          .from('vendor_profiles')
          .select('vendor_profile_id, business_name')
          .in('vendor_profile_id', vendorIds)
      : Promise.resolve({
          data: [] as { vendor_profile_id: string; business_name: string | null }[],
        }),
  ]);

  const eventName = new Map<string, string>();
  for (const e of eventData ?? [])
    eventName.set(e.event_id, ((e.display_name as string | null) ?? '').trim() || 'Untitled event');
  const vendorName = new Map<string, string>();
  for (const v of vendorData ?? [])
    vendorName.set(
      v.vendor_profile_id,
      ((v.business_name as string | null) ?? '').trim() || 'a vendor',
    );

  const openCount = rows.filter((r) => r.status === 'open').length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          <h1 className="text-2xl font-semibold tracking-tight">Chat contact flags</h1>
        </div>
        <p className="text-sm text-ink/65">
          Couple↔vendor chat messages caught sharing off-platform contact info
          (phone, email, social/messaging links, @handles, app names, or
          &ldquo;add me on&hellip;&rdquo; solicitations). The payload was already
          masked in the delivered message. This queue shows only the <em>signal</em>
          — what kind of contact info, by whom, how often — never the message text
          (Setnayan staff don&apos;t read chats). Use it to spot a repeat
          off-platform-pusher; review or dismiss false positives. Latest 200
          matching the filter, newest first.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <a
            key={f.value}
            href={`/admin/chat-flags?status=${f.value}`}
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
          Flags couldn&apos;t load right now. We&apos;ve logged the issue —
          refresh in a moment.
        </FormFlash>
      )}

      {rows.length === 0 ? (
        <p className="rounded-md border border-white/60 bg-white/70 px-4 py-3 text-sm text-ink/65">
          No flags in this view.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const who = r.sender_role === 'vendor' ? 'A vendor' : 'A couple';
            const ev = r.event_id ? eventName.get(r.event_id) : null;
            const vn = r.vendor_profile_id ? vendorName.get(r.vendor_profile_id) : null;
            return (
              <li
                key={r.flag_id}
                className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-surface p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                  {(r.categories ?? []).map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-terracotta/10 px-2 py-0.5 text-[11px] font-medium text-terracotta-700"
                    >
                      {CATEGORY_LABEL[c] ?? c}
                    </span>
                  ))}
                  <span className="font-mono text-[10px] text-ink/45">{r.public_id}</span>
                </div>

                <p className="text-sm text-ink/80">
                  <span className="font-medium">{who}</span> shared{' '}
                  {(r.hit_count ?? 0) > 1 ? `${r.hit_count} pieces of ` : ''}off-platform
                  contact info
                  {vn ? (
                    <>
                      {' in the thread with '}
                      <span className="font-medium">{vn}</span>
                    </>
                  ) : null}
                  {ev ? (
                    <>
                      {' · '}
                      <span className="text-ink/60">{ev}</span>
                    </>
                  ) : null}
                  {' · '}
                  <span className="text-ink/50">{relativeTime(r.created_at)}</span>
                </p>

                <p className="rounded-md border border-white/60 bg-white/70 px-3 py-2 text-xs text-ink/60">
                  Message text is not shown — Setnayan staff don&apos;t read chats.
                  The couple/vendor received the message with the contact details
                  masked.
                </p>

                {r.status !== 'open' && r.action_taken && (
                  <p className="text-xs text-ink/55">
                    {r.action_taken}
                    {r.reviewed_at ? ` · ${relativeTime(r.reviewed_at)}` : ''}
                  </p>
                )}

                {r.status === 'open' && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <form action={resolveChatFlag}>
                      <input type="hidden" name="flag_id" value={r.flag_id} />
                      <input type="hidden" name="action" value="reviewed" />
                      <SubmitButton
                        className="inline-flex items-center gap-1.5 rounded-md border border-white/60 bg-white/70 px-3 py-1.5 text-xs font-medium text-ink/80 hover:bg-ink/[0.04]"
                        pendingLabel="Marking…"
                      >
                        <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Mark reviewed
                      </SubmitButton>
                    </form>
                    <form action={resolveChatFlag}>
                      <input type="hidden" name="flag_id" value={r.flag_id} />
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
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
        Source · iteration 0019 · table <code>chat_message_flags</code> (migration
        20270920573307) · gated by <code>CHAT_CONTACT_FILTER_ENABLED</code>
      </p>
    </div>
  );
}
