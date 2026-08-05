import Link from 'next/link';
import { Check, ChevronRight, ShieldAlert } from 'lucide-react';
import type { QueuePeek } from '@/lib/admin/queue-peek';
import {
  approvePaymentFromWorkList,
  approveVerificationFromWorkList,
  agreeToRequestFromWorkList,
} from '@/app/admin/work/actions';

/** Which server action + hidden field each kind posts. One table so a new fact
 *  queue is a row here, not another branch in the markup. */
const ACTIONS = {
  'approve-payment': { fn: approvePaymentFromWorkList, field: 'payment_id' },
  'approve-verification': { fn: approveVerificationFromWorkList, field: 'application_id' },
  'agree-request': { fn: agreeToRequestFromWorkList, field: 'approval_id' },
} as const;

/**
 * QueueDrawer — the items behind one work-list row, settled in place.
 *
 * Owner, 2026-08-03: *"a faster way to respond to quick actions needed instead
 * of them making jump to a new page."*
 *
 * Server Component on purpose. Expansion is URL-driven (`?open=<queue>` on the
 * work list), the same convention `?lane=` set, so the feed stays server-
 * rendered, the drawer works with JS off, and an opened queue is bookmarkable.
 * Each action is a plain `<form>` posting a server action — no client state, and
 * the row simply re-renders without the settled item.
 *
 * 🔑 A JUDGEMENT QUEUE SHOWS ITS REASON WHERE THE BUTTONS WOULD BE. Silence
 * would read as an unfinished feature; the sentence teaches the rule instead —
 * a fast button on a dispute invites a wrong call at speed on exactly the
 * queues where being wrong costs most.
 */
export function QueueDrawer({
  peek,
  href,
  label,
  backTo,
}: {
  peek: QueuePeek;
  /** The queue's own page — always offered, even when an action exists. */
  href: string;
  label: string;
  /** The exact list URL to return to on a refusal — keeps lane + open state. */
  backTo: string;
}) {
  if (peek.judgementNote) {
    return (
      <div className="border-t border-[color:var(--sn-line-soft,#F1ECE3)] px-4 py-3">
        <p className="flex items-start gap-2 text-xs text-[color:var(--sn-ink-500)]">
          <ShieldAlert aria-hidden className="mt-px h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>{peek.judgementNote}</span>
        </p>
        <Link
          href={href}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2"
          style={{ color: 'var(--sn-ink-900)' }}
        >
          Open {label}
          <ChevronRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  if (peek.items.length === 0) {
    return (
      <div className="border-t border-[color:var(--sn-line-soft,#F1ECE3)] px-4 py-3">
        <p className="flex items-center gap-2 text-xs text-[color:var(--sn-ink-500)]">
          <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
          Nothing waiting here.
        </p>
      </div>
    );
  }

  const more = peek.total - peek.items.length;

  return (
    <div className="border-t border-[color:var(--sn-line-soft,#F1ECE3)] px-4 py-1">
      {peek.items.map((it) => (
        <div
          key={it.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[color:var(--sn-line-soft,#F1ECE3)] py-3 last:border-b-0"
        >
          <span className="min-w-[9rem] flex-1">
            <span className="block text-sm font-semibold">{it.title}</span>
            <span className="block text-xs text-[color:var(--sn-ink-500)]">{it.detail}</span>
          </span>

          <span className="flex shrink-0 flex-wrap items-center gap-2">
            {it.action ? (
              (() => {
                const a = ACTIONS[it.action.kind];
                return (
                  <form action={a.fn}>
                    <input type="hidden" name={a.field} value={it.action.id} />
                    <input type="hidden" name="back" value={backTo} />
                    <button
                      type="submit"
                      className="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                      style={{ background: 'var(--sn-cta, #C24E25)', color: '#FDFBF7' }}
                    >
                      {it.action.label}
                    </button>
                  </form>
                );
              })()
            ) : null}
            <Link
              href={it.href}
              className="rounded-md px-2 py-1.5 text-xs font-semibold"
              style={{ color: 'var(--sn-ink-500)' }}
            >
              Open
            </Link>
          </span>
        </div>
      ))}

      {more > 0 ? (
        <p className="py-2.5 text-xs text-[color:var(--sn-ink-500)]">
          {more} more in this queue ·{' '}
          <Link href={href} className="underline underline-offset-2">
            see all {peek.total}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
