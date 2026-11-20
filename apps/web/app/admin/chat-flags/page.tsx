import { InfoTip } from '@/app/_components/info-tip';
import { LinkPickMenu } from '@/app/_components/link-pick-menu';
import { TemplateEmpty, TemplateSection } from '@/app/_components/template-rows';
import { actionButtonClass } from '@/components/action-button-class';
import { Check, X } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { relativeTime } from '@/lib/activity';
import { requireAdmin } from '@/lib/admin/require-admin';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { SubmitButton } from '@/app/_components/submit-button';
import { resolveChatFlag } from './actions';
import { formatCount } from '@/lib/format-number';

export const metadata = { title: 'Chat contact flags · Admin' };
export const dynamic = 'force-dynamic';

/**
 * /admin/chat-flags — moderator ABUSE-SIGNAL queue for couple↔vendor chat
 * messages that carried off-platform contact info (phone / email / social URL /
 * @handle / app-name / euphemism / solicitation). The send path
 * (lib/chat-send.ts) BLOCKS the message (it never sends) and records METADATA
 * ONLY here — the category of what was shared, by whom, how often — NEVER the
 * message text. This is deliberate: the owner-locked admin-account-access model
 * (2026-06-22) forbids Setnayan staff from reading couple↔vendor chat bodies
 * (published trust promise · lint-admin-chat-guard). So this surface lets a
 * moderator spot a repeat off-platform-pusher without reading anyone's
 * conversation. Behaviour is gated behind NEXT_PUBLIC_CHAT_CONTACT_FILTER_ENABLED;
 * the queue only fills once the owner flips the flag on. Auth is enforced at the
 * layout level (admin only).
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
      ((v.business_name as string | null) ?? '').trim() || 'a supplier',
    );

  const openCount = rows.filter((r) => r.status === 'open').length;

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-8 pt-2 sm:px-6">
      {/* The page starts at its content.
          ⚖ The sentence survives, and this is the clearest case in the whole
          console: it says Setnayan staff do NOT read chats, that this queue
          carries only the signal, and that the blocked message never reached
          anybody. Somebody reviewing a flag without those three facts would
          reasonably think they were about to read a private conversation. */}
      <PageMasthead title="Chat contact flags" />
      {/* 📐 ADMIN CLEAN PORT (owner "ok", 19 Nov 2026 — reposition only): the status chips are ONE dropdown (the
          Repost watch shape), the per-row "never reached the other person" note sits behind its ⓘ. Same read, same
          two actions. */}
      <div className="mb-2">
        <div>
          <InfoTip label="What this page does" align="start" labelClassName="text-[13px] font-semibold text-ink/70">
            Couple↔supplier chat messages <strong>blocked</strong> for sharing
          off-platform contact info (phone, email, social/messaging links,
          @handles, app names, or &ldquo;add me on&hellip;&rdquo; solicitations).
          The message never reached the other person. This queue shows only the{' '}
          <em>signal</em> — what kind of contact info, by whom, how often — never
          the message text (Setnayan staff don&apos;t read chats). Use it to spot a
          repeat off-platform-pusher; review or dismiss false positives. Latest 200
          matching the filter, newest first.
          </InfoTip>
        </div>
      </div>

      <TemplateSection
        label="Chat flags"
        data="chat-flags"
        right={
          <LinkPickMenu
            label="Status"
            value={status}
            dataAttr="data-chat-flag-status"
            options={STATUS_FILTERS.map((f) => ({
              key: f.value,
              label: `${f.label}${f.value === 'open' && openCount > 0 ? ` · ${formatCount(openCount)}` : ''}`,
              href: `/admin/chat-flags?status=${f.value}`,
            }))}
          />
        }
      >

      {listError && (
        <FormFlash tone="error">
          Flags couldn&apos;t load right now. We&apos;ve logged the issue —
          refresh in a moment.
        </FormFlash>
      )}

      {listError ? null : rows.length === 0 ? (
        <TemplateEmpty data="chat-flags">No flags in this view.</TemplateEmpty>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const who = r.sender_role === 'vendor' ? 'A supplier' : 'A couple';
            const ev = r.event_id ? eventName.get(r.event_id) : null;
            const vn = r.vendor_profile_id ? vendorName.get(r.vendor_profile_id) : null;
            return (
              <li
                key={r.flag_id}
                className="flex flex-col gap-3 bg-surface py-4 border-t border-ink/10"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${STATUS_TONE[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                  {(r.categories ?? []).map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-terracotta/10 px-2 py-0.5 text-[12px] font-medium text-terracotta-700"
                    >
                      {CATEGORY_LABEL[c] ?? c}
                    </span>
                  ))}
                  <span className="text-[12px] text-ink/45 tabular-nums">{r.public_id}</span>
                </div>

                <div className="text-sm text-ink/80">
                  <span className="font-medium">{who}</span> was blocked from sharing{' '}
                  {(r.hit_count ?? 0) > 1 ? `${formatCount(r.hit_count)} pieces of ` : ''}off-platform
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
                </div>

                <div className="text-xs text-ink/60">
                  <InfoTip label="The message was blocked — it never reached the other person." align="start" labelClassName="text-[13px] text-[color:var(--m-slate-2)]">
                    The message was blocked — it never reached the other person.
                    Its text is not shown here (Setnayan staff don&apos;t read chats);
                    only the rule categories above are recorded.
                  </InfoTip>
                </div>

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
                        className={actionButtonClass('ok')}
                        pendingLabel="Marking…"
                      >
                        <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Mark reviewed
                      </SubmitButton>
                    </form>
                    <form action={resolveChatFlag}>
                      <input type="hidden" name="flag_id" value={r.flag_id} />
                      <input type="hidden" name="action" value="dismiss" />
                      <SubmitButton
                        className={actionButtonClass('neutral')}
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
      </TemplateSection>
    </div>
  );
}
