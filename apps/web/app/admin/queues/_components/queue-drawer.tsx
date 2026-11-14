import Link from 'next/link';
import { Check, ChevronRight, ShieldAlert } from 'lucide-react';
import { JUDGEMENT_QUEUES, type QueuePeek } from '@/lib/admin/queue-peek';
import { ActionButton } from '@/components/action-button';
import { RequestCardView } from './request-card-view';
import { formatCount } from '@/lib/format-number';

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
  late,
}: {
  peek: QueuePeek;
  /** The queue's own page — always offered, even when an action exists. */
  href: string;
  label: string;
  /** The exact list URL to return to on a refusal — keeps lane + open state. */
  backTo: string;
  /** The queue is past its promised time — every card in it carries the red edge. */
  late?: boolean;
}) {
  if (peek.judgementNote) {
    /* ➕ The card's two no-button footers (admin request cards, owner 2026-11-14): a JUDGEMENT opens the case (the
       2026-08-05 lock — no one-click answer about a person or their money); work DONE ELSEWHERE opens where it is. */
    const judgement = Object.values(JUDGEMENT_QUEUES).includes(peek.judgementNote);
    return (
      <div className="border-t border-[color:var(--sn-line)] px-4 py-3">
        <article className="sn-tile p-4" data-request-card={judgement ? 'open-the-case' : 'done-elsewhere'}>
          <p className="flex items-start gap-2 text-sm text-[color:var(--sn-ink-500)]">
            <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>{peek.judgementNote}</span>
          </p>
          <div className="mt-3">
            <ActionButton
              tone="neutral"
              icon={<ChevronRight />}
              label={judgement ? 'Open the case' : `Open ${label}`}
              name={judgement ? `Open the case — ${label}` : `Open ${label}`}
              href={href}
            />
          </div>
        </article>
      </div>
    );
  }

  // 🪤 "We could not look" is NOT "there is nothing here." Saying the latter
  // with a green tick is a confident lie the moment a read fails.
  if (peek.unreadable) {
    return (
      <div className="border-t border-[color:var(--sn-line)] px-4 py-3">
        <p className="flex items-start gap-2 text-xs" style={{ color: 'var(--sn-warning-deep)' }}>
          <ShieldAlert aria-hidden className="mt-px h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>
            Could not load these right now — this is not the same as the queue being
            clear.{' '}
            <Link href={href} className="underline underline-offset-2">
              Open {label}
            </Link>
          </span>
        </p>
      </div>
    );
  }

  if (peek.items.length === 0) {
    return (
      <div className="border-t border-[color:var(--sn-line)] px-4 py-3">
        <p className="flex items-center gap-2 text-xs text-[color:var(--sn-ink-500)]">
          <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
          Nothing waiting here.
        </p>
      </div>
    );
  }

  const more = peek.total - peek.items.length;

  const nowMs = Date.now();
  return (
    <div className="border-t border-[color:var(--sn-line)] px-4 py-1">
      {peek.items.map((it) =>
        it.card ? (
          <div key={it.id} className="py-2">
            <RequestCardView card={it.card} back={backTo} late={late} nowMs={nowMs} />
          </div>
        ) : (
          /* Every peek item carries its request card (owner approved 14 Nov 2026). An item without one is drawn as a
             plain line to its page — never as the old raw row with a select. */
          <p key={it.id} className="py-3 text-sm">
            <Link href={it.href} className="font-semibold underline underline-offset-2" style={{ color: 'var(--sn-ink-900)' }}>
              {it.title}
            </Link>
          </p>
        ),
      )}

      {more > 0 ? (
        <p className="py-2.5 text-xs text-[color:var(--sn-ink-500)]">
          {more} more in this queue ·{' '}
          <Link href={href} className="underline underline-offset-2">
            see all {formatCount(peek.total)}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
