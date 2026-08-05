import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatCentavosPhp } from '@/lib/payouts';

/**
 * QUEUE PEEK — the actual items behind a work-list row, so an admin can see and
 * settle them without leaving the list.
 *
 * Owner, 2026-08-03: *"a faster way to respond to quick actions needed instead
 * of them making jump to a new page."*
 *
 * 🔑 THREE KINDS OF QUEUE, AND THE DISTINCTION IS THE DESIGN. Recorded in
 * DECISION_LOG 2026-08-04; do not flatten it into "every row gets a button":
 *
 *   FACT          — one click is honest. Did the money arrive; is this ID real.
 *   JUDGEMENT     — NO button at all, only the case file. Disputes, fraud,
 *                   user reports. A fast button here invites a wrong call at
 *                   speed on exactly the queues where being wrong costs most.
 *   NEEDS DETAILS — a small form, never a single button. Payouts is the worked
 *                   example: recording a hand-made transfer needs the method
 *                   AND the reference, and a one-click version would either
 *                   invent them or save a record nobody can reconcile.
 *
 * A queue with no entry here still renders its row exactly as before and simply
 * does not expand — adding a peek is opt-in, so a new queue can never acquire a
 * half-built action surface by default.
 *
 * ⚠ SEEING IS NOT ACTING, AND THE GAP IS DELIBERATE. verify / approvals /
 * reviews are FACT queues and will earn one-click buttons — but each needs its
 * real server action traced first, and inventing three at once is how a wrong
 * one ships. They peek now (which removes the hunt) and act later. Payments is
 * the only one wired end to end, because its non-redirecting core already
 * existed.
 *
 * PEEK_LIMIT is small on purpose: this is a glance before acting, not a second
 * copy of the queue page. "N more · see all" always routes to the real surface.
 */

export const PEEK_LIMIT = 3;

export type PeekAction = {
  /** Server-action id the feed maps to a real action. */
  kind: 'approve-payment' | 'approve-verification' | 'agree-request';
  label: string;
  /** The row id the action needs. */
  id: string;
};

export type PeekItem = {
  id: string;
  title: string;
  detail: string;
  /** Present only for FACT queues. Absent ⇒ the row offers the case file only. */
  action?: PeekAction;
  /** Where "Open" goes — always available, even when an action is. */
  href: string;
};

export type QueuePeek = {
  items: PeekItem[];
  /** Total open, so the drawer can say "N more". */
  total: number;
  /** Set when the queue is deliberately case-file-only. Rendered as the reason. */
  judgementNote?: string;
};

/**
 * Queues that are a JUDGEMENT, with the sentence shown in place of buttons.
 * Being explicit beats being silent: a reader should learn WHY there is no
 * button here, not assume the feature is unfinished.
 */
export const JUDGEMENT_QUEUES: Record<string, string> = {
  disputes:
    'No one-click answer here on purpose — a dispute is a judgement, not a fact, so it opens the full case file.',
  fraud:
    'Fraud needs the whole pattern, not a single row. Opens the case file.',
  'user-reports':
    'Someone reported content about a real person. Read it before deciding.',
  'integrity-watch':
    'Review-fraud and ghost listings need the surrounding evidence.',
  'concierge-abuse': 'Abuse flags need their history before a verdict.',
  'account-deletions':
    'An erasure request is a legal duty with a clock. Opens the case file.',
  'force-majeure': 'An event-impacting flag affects other people’s bookings too.',
};

/**
 * Fetch the top few items for one queue. Returns null when the queue has no
 * peek (which is most of them, for now) so the caller renders the plain row.
 *
 * Never throws: a peek is a convenience layered on a list that must keep
 * rendering. A failed read degrades to "no peek", exactly as a failed count
 * degrades to no badge.
 */
export async function peekQueue(key: string): Promise<QueuePeek | null> {
  const note = JUDGEMENT_QUEUES[key];

  try {
    if (key === 'payments') {
      const admin = createAdminClient();
      const { data, count } = await admin
        .from('payments')
        // Column names verified against the migration, not guessed: payments
        // carries amount_PHP (pesos, not centavos), `channel` (not `method`)
        // and `reference_number` (not `reference_code`). All three of those
        // guesses were caught by lib/security/select-column-scan.test.ts — a
        // Supabase select naming a phantom column returns an error, not a
        // crash, so it would have degraded to an empty drawer in silence.
        .select('payment_id, amount_php, channel, reference_number, created_at', {
          count: 'exact',
        })
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(PEEK_LIMIT);

      const items: PeekItem[] = (data ?? []).map((r) => {
        const row = r as {
          payment_id: string;
          amount_php: number | null;
          channel: string | null;
          reference_number: string | null;
        };
        return {
          id: row.payment_id,
          title: formatCentavosPhp(Math.round((row.amount_php ?? 0) * 100)),
          detail: [
            row.channel ?? 'payment',
            row.reference_number ? `ref ${row.reference_number}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
          // A FACT: the money either arrived or it did not. One click is honest.
          action: { kind: 'approve-payment', label: 'Confirm payment', id: row.payment_id },
          href: '/admin/payments',
        };
      });

      return { items, total: count ?? items.length };
    }

    if (key === 'verify') {
      const admin = createAdminClient();
      const { data, count } = await admin
        .from('vendor_verification_applications')
        .select('application_id, application_type, docs_complete, submitted_at', { count: 'exact' })
        .eq('status', 'pending_review')
        .order('submitted_at', { ascending: true })
        .limit(PEEK_LIMIT);
      return {
        total: count ?? 0,
        items: (data ?? []).map((r) => {
          const row = r as {
            application_id: string;
            application_type: string | null;
            docs_complete: boolean | null;
          };
          return {
            id: row.application_id,
            title: row.application_type ?? 'Verification',
            // `docs_complete` is the one fact that decides whether this is even
            // reviewable yet, so it is what the glance should show.
            detail: row.docs_complete ? 'Documents complete' : 'Waiting on documents',
            // Only offer the stamp when the documents are actually in. An
            // application still waiting on uploads is not a fact yet, so it gets
            // the page instead of a button — the same fact/judgement test, one
            // level down inside a single queue.
            action: row.docs_complete
              ? { kind: 'approve-verification', label: 'Verify shop', id: row.application_id }
              : undefined,
            href: '/admin/verify',
          };
        }),
      };
    }

    if (key === 'approvals') {
      const admin = createAdminClient();
      const { data, count } = await admin
        .from('admin_approval_requests')
        .select('approval_id, action_type, rationale, expires_at', { count: 'exact' })
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: true })
        .limit(PEEK_LIMIT);
      return {
        total: count ?? 0,
        items: (data ?? []).map((r) => {
          const row = r as {
            approval_id: string;
            action_type: string | null;
            rationale: string | null;
          };
          return {
            id: row.approval_id,
            title: (row.action_type ?? 'Approval').replace(/_/g, ' '),
            // A second admin is being asked to agree to something; their
            // colleague's REASON is the whole content of the decision.
            detail: row.rationale?.slice(0, 90) ?? 'No reason given',
            // "I agree", never "Approve" — this is the SECOND signature on a
            // colleague's decision, not the decision itself.
            action: { kind: 'agree-request', label: 'I agree', id: row.approval_id },
            href: '/admin/approvals',
          };
        }),
      };
    }

    if (key === 'reviews') {
      const admin = createAdminClient();
      const { data, count } = await admin
        .from('vendor_review_appeals')
        .select('appeal_id, matched_signal, appeal_reason, submitted_at', { count: 'exact' })
        .is('decided_at', null)
        .order('submitted_at', { ascending: true })
        .limit(PEEK_LIMIT);
      return {
        total: count ?? 0,
        items: (data ?? []).map((r) => {
          const row = r as {
            appeal_id: string;
            matched_signal: string | null;
            appeal_reason: string | null;
          };
          return {
            id: row.appeal_id,
            title: (row.matched_signal ?? 'Review appeal').replace(/_/g, ' '),
            detail: row.appeal_reason?.slice(0, 90) ?? 'No reason given',
            href: '/admin/reviews',
          };
        }),
      };
    }

    if (note) {
      // A judgement queue peeks its rows so the admin can see WHAT is waiting,
      // but every row offers only the case file.
      return { items: [], total: 0, judgementNote: note };
    }

    return null;
  } catch {
    return note ? { items: [], total: 0, judgementNote: note } : null;
  }
}
