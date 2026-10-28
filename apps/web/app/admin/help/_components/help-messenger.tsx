/**
 * HelpMessenger — the Help inbox drawn as the same Messenger-style chat shops use ("Message Setnayan"): the people on
 * the left, the open conversation on the right, a reply box at the bottom (admin supplier slice, owner 2026-10-28;
 * prototype `prototypes/admin_supplier_slice_2026-10-28/` msgs.png).
 *
 * ⚠ ONE CHAT LOOK, NOT A SECOND CHAT. The conversation is drawn with C1's shared `ChatBox` + `ChatThreadHead`
 * (merged 2026-10-28, #7004) on the shipped Help inbox's data and its ONE action (`setHelpMessageStatus`): their message is their bubble, our reply
 * (`admin_notes`) is ours. A help ticket holds ONE reply — sending again replaces it (said under the box). When C1
 * lands, this list should open its thread instead.
 *
 * Server Component; the open conversation is `?m=` and the filter `?status=` — plain links.
 */
import Link from 'next/link';
import { Check, ChevronLeft, Mail, Send } from 'lucide-react';
import { ChatBox } from '@/app/_components/chat/chat-box';
import { ChatThreadHead } from '@/app/_components/chat/chat-thread-head';
import { ActionButton } from '@/components/action-button';
import { ageShort } from '@/lib/admin/queue-counts';

export type HelpThread = {
  message_id: string;
  public_id: string;
  user_id: string | null;
  sender_name: string | null;
  sender_email: string;
  /** The shop's name when the sender owns one. */
  shop_name: string | null;
  topic: string | null;
  subject: string;
  body: string;
  status: 'new' | 'in_progress' | 'closed';
  admin_notes: string | null;
  created_at: string;
  updated_at: string | null;
  tier_label: string | null;
};

const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'open', label: 'Open' },
  { key: 'new', label: 'New' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
];

function who(t: HelpThread): string {
  return t.shop_name?.trim() || t.sender_name?.trim() || t.sender_email;
}

function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function HelpMessenger({
  threads,
  filter,
  openId,
  failed,
  nowMs,
  action,
}: {
  threads: readonly HelpThread[];
  filter: string;
  openId: string | null;
  failed: boolean;
  nowMs: number;
  action: (formData: FormData) => Promise<void>;
}) {
  const open = threads.find((t) => t.message_id === openId) ?? null;
  const link = (params: { status?: string; m?: string }) => {
    const p = new URLSearchParams();
    const st = params.status ?? filter;
    if (st && st !== 'open') p.set('status', st);
    if (params.m) p.set('m', params.m);
    const q = p.toString();
    return q ? `/admin/help?${q}` : '/admin/help';
  };
  return (
    <div data-help-messenger="">
      <p className="mb-3 text-sm text-ink/70">Shops’ “Message Setnayan” and the Help page — the same chat as the app.</p>
      <nav aria-label="Filter messages" className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={link({ status: f.key })}
            aria-current={filter === f.key ? 'page' : undefined}
            className={`sn-press inline-flex min-h-10 items-center rounded-full border px-3.5 text-[13px] font-semibold ${
              filter === f.key ? 'border-ink bg-ink text-cream' : 'border-ink/15 bg-white text-ink dark:bg-raised'
            }`}
            data-help-filter={f.key}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {failed ? (
        <p role="alert" className="mb-3 rounded-card bg-[var(--sn-warning-soft)] p-3 text-sm text-ink">
          Couldn’t load the messages — refresh in a moment. This is not an empty inbox.
        </p>
      ) : null}
      <div className="grid overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-raised md:h-[560px] md:grid-cols-[300px_1fr]">
        <ul className={`${open ? 'hidden md:block' : ''} overflow-y-auto border-ink/10 md:border-r`} aria-label="Conversations" data-help-list="">
          {threads.length === 0 && !failed ? (
            <li className="p-8 text-center text-sm text-ink/70">
              <Mail aria-hidden className="mx-auto mb-2 h-6 w-6 text-ink/40" strokeWidth={1.5} />
              Nothing in this view.
            </li>
          ) : null}
          {threads.map((t) => {
            const name = who(t);
            const on = t.message_id === open?.message_id;
            return (
              <li key={t.message_id}>
                <Link
                  href={link({ m: t.message_id })}
                  aria-current={on ? 'true' : undefined}
                  className={`flex min-h-16 items-center gap-2.5 px-3 py-2.5 ${on ? 'bg-ink/[0.06]' : 'hover:bg-ink/[0.03]'}`}
                  data-help-row={t.message_id}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink/[0.1] text-xs font-semibold text-ink/75" aria-hidden>
                    {initials(name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[14px] text-ink ${t.status === 'new' ? 'font-bold' : 'font-medium'}`}>{name}</span>
                    <span className="block truncate text-xs text-ink/70">{t.admin_notes ? `You: ${t.admin_notes}` : t.body || t.subject}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-ink/70">{ageShort(t.updated_at ?? t.created_at, nowMs) ?? ''}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <section className={`${open ? 'flex' : 'hidden md:flex'} min-h-[420px] flex-col`} aria-label="Conversation" data-help-thread={open?.message_id ?? ''}>
          {open ? (
            <ChatBox
              header={
                <ChatThreadHead
                  back={
                    <Link
                      href={link({})}
                      aria-label="Back to the list"
                      className="sn-press grid h-11 w-11 shrink-0 place-items-center rounded-full text-sn-accent md:hidden"
                      data-help-back=""
                    >
                      <ChevronLeft aria-hidden className="h-6 w-6" />
                    </Link>
                  }
                  name={<span className="truncate">{who(open)}</span>}
                  initials={initials(who(open))}
                  line={[open.tier_label, open.topic, open.user_id ? 'signed in' : 'no account', open.status === 'closed' ? 'closed' : null]
                    .filter((x): x is string => Boolean(x))
                    .map((x) => (
                      <span key={x}>{x}</span>
                    ))}
                  actions={
                    open.status !== 'closed' ? (
                      <form action={action} data-help-close="">
                        <input type="hidden" name="message_id" value={open.message_id} />
                        <input type="hidden" name="status" value="closed" />
                        {/* The action writes `admin_notes` from the form — the reply already sent rides along so Close never erases it. */}
                        <input type="hidden" name="admin_notes" value={open.admin_notes ?? ''} />
                        <ActionButton type="submit" tone="neutral" quiet icon={<Check />} label="Close" />
                      </form>
                    ) : null
                  }
                />
              }
              composer={
                <form action={action} className="flex items-center gap-2" data-help-composer="">
                  <input type="hidden" name="message_id" value={open.message_id} />
                  <input type="hidden" name="status" value="in_progress" />
                  <label className="sr-only" htmlFor={`reply-${open.message_id}`}>
                    Reply to {who(open)}
                  </label>
                  <input
                    id={`reply-${open.message_id}`}
                    name="admin_notes"
                    required
                    maxLength={2000}
                    placeholder={open.admin_notes ? 'Reply… (replaces your last reply)' : 'Reply…'}
                    className="h-11 min-w-0 flex-1 rounded-full bg-ink/[0.05] px-4 text-[14px] text-ink placeholder:text-ink/60"
                  />
                  <ActionButton type="submit" tone="info" main icon={<Send />} label="Send" />
                </form>
              }
            >
              <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto py-3" data-chat-flow="">
                <p className="max-w-[78%] self-start whitespace-pre-wrap rounded-2xl bg-ink/[0.06] px-3 py-2 text-[14px] text-ink">
                  {open.subject && open.subject !== open.body ? <strong className="block">{open.subject}</strong> : null}
                  {open.body}
                </p>
                {open.admin_notes ? (
                  <>
                    <p className="max-w-[78%] self-end whitespace-pre-wrap rounded-2xl bg-sn-accent px-3 py-2 text-[14px] text-sn-on-accent">{open.admin_notes}</p>
                    <span className="self-end text-[11px] text-ink/70">{open.user_id ? 'Sent in the app' : 'Sent'}</span>
                  </>
                ) : null}
              </div>
            </ChatBox>
          ) : (
            <p className="m-auto p-8 text-center text-sm text-ink/70">Pick a conversation on the left.</p>
          )}
        </section>
      </div>
    </div>
  );
}
