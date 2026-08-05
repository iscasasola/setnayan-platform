import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatCentavosPhp } from '@/lib/payouts';
import { getQueueSource } from '@/lib/admin/queue-counts';

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

/**
 * A NEEDS-DETAILS queue: a small form, never a single button.
 *
 * 🔑 THE CODE DECIDES WHICH QUEUES LAND HERE, NOT TASTE. Reviews earns a form
 * because `overridePublishReview` throws *"Override reason is required"*;
 * payouts earns one because `markPayoutPaidAction` needs the method AND the
 * reference of a transfer made by hand, and a money record without its
 * reference cannot be matched to a bank statement later. A one-click version of
 * either would have to invent the missing half.
 *
 * The field list lives here, beside the query that produced the row, so the
 * form and the arguments its action requires are described once.
 */
export type PeekForm = {
  kind: 'publish-review' | 'record-payout';
  /** The row id the action needs. */
  id: string;
  submitLabel: string;
  fields: Array<
    | { name: string; type: 'text'; placeholder: string; required: boolean }
    | { name: string; type: 'select'; options: string[]; required: boolean }
  >;
};

export type PeekItem = {
  id: string;
  title: string;
  detail: string;
  /**
   * Why this particular row has no control, when the queue normally has one.
   * Rendered where the button would be. 🔑 Silence reads as an unfinished
   * feature; a sentence teaches the rule — the same reason a judgement queue
   * explains itself instead of showing nothing.
   */
  note?: string;
  /** Present only for FACT queues. Absent ⇒ the row offers the case file only. */
  action?: PeekAction;
  /** Present when the decision needs details the admin must supply. */
  form?: PeekForm;
  /** Where "Open" goes — always available, even when an action is. */
  href: string;
};

export type QueuePeek = {
  items: PeekItem[];
  /**
   * The read FAILED — this is not an empty queue.
   *
   * 🪤 THE BUG THIS NAMES: peekQueue swallows errors and returned the same
   * shape as a genuine zero, so the drawer said "Nothing waiting here" with a
   * green tick. That is a POSITIVE CLAIM, not a blank — an admin is told the
   * queue is clear when the truth is we could not look. Same shape as the
   * house rule that an RLS denial and an empty read are the same value: if you
   * cannot prove you saw the rows, do not report that there are none.
   */
  unreadable?: boolean;
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
/**
 * The queues a work-list row is allowed to EXPAND.
 *
 * 🪤 WHY THIS EXISTS: the feed cannot ask "does this row have a peek?" before
 * fetching one, and only the OPEN row is ever fetched. Without a list, the feed
 * handed every row an expand link — and five queues with no peek became DEAD
 * TAPS: the URL changed, nothing rendered, the page redrew identically, and on
 * a phone it jumped back to the top. Those rows used to open their queue page.
 *
 * 🔑 A CONTROL THAT CANNOT SUCCEED MUST NOT BE OFFERED.
 *
 * ⚠ THIS IS A LIST THAT COULD DRIFT FROM THE BRANCHES BELOW, which is exactly
 * the "two hand-typed things are not a guard" failure. So it is NOT trusted on
 * its own: queue-peek-coverage.test.ts READS THIS FILE'S SOURCE, extracts every
 * `key === '…'` the function actually branches on, and fails if the two differ.
 * The guard compares the list against the CODE, not against another list.
 */
const PEEK_QUEUES = ['payments', 'verify', 'approvals', 'reviews', 'payouts'] as const;

export const EXPANDABLE_QUEUES: ReadonlySet<string> = new Set<string>([
  ...PEEK_QUEUES,
  ...Object.keys(JUDGEMENT_QUEUES),
]);

export async function peekQueue(
  key: string,
  /**
   * The admin LOOKING at the list. Needed because some rows must not offer a
   * control to this particular person: the four-eyes rule forbids agreeing to
   * your own request, and the approvals PAGE already says so kindly. Without
   * this the drawer showed a live "I agree" on your own request that threw an
   * unexplained error every time it was pressed.
   */
  viewerUserId?: string,
): Promise<QueuePeek | null> {
  const note = JUDGEMENT_QUEUES[key];

  // Build the query from the SAME table + filter the badge counted with. Never
  // re-type a predicate here: see getQueueSource() for the payouts mismatch
  // this prevents.
  // Returns an untyped PostgREST builder (the shared filter is duck-typed), so
  // every consumer below narrows its own row with an explicit cast — the same
  // discipline the file already used.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const open = (cols: string): any => {
    const src = getQueueSource(key);
    if (!src) return null;
    const q = createAdminClient()
      .from(src.table)
      .select(cols, { count: 'exact' });
    return src.filter(q, { nowIso: new Date().toISOString() });
  };

  try {
    if (key === 'payments') {
      const q = open('payment_id, amount_php, channel, reference_number, created_at');
      if (!q) return null;
      const { data, count } = await q
        .order('created_at', { ascending: true })
        .limit(PEEK_LIMIT);

      const items: PeekItem[] = (data ?? []).map((r: unknown) => {
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
      const q = open('application_id, application_type, docs_complete, submitted_at');
      if (!q) return null;
      const { data, count } = await q
        .order('submitted_at', { ascending: true })
        .limit(PEEK_LIMIT);
      return {
        total: count ?? 0,
        items: (data ?? []).map((r: unknown) => {
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
      const q = open('approval_id, action_type, rationale, expires_at, initiated_by');
      if (!q) return null;
      const { data, count } = await q
        .order('expires_at', { ascending: true })
        .limit(PEEK_LIMIT);
      return {
        total: count ?? 0,
        items: (data ?? []).map((r: unknown) => {
          const row = r as {
            approval_id: string;
            action_type: string | null;
            rationale: string | null;
            initiated_by: string | null;
          };
          // 🔑 FOUR EYES: you may not agree to your own request. The DATABASE
          // already refuses (decided_by <> initiated_by) and the approvals PAGE
          // says so kindly — it swaps the button for a line. The drawer did not
          // know who was looking, so it showed a live "I agree" on your own
          // request that threw an unexplained error every single press. Nothing
          // unsafe could slip through; it was simply a control that could never
          // succeed, which on a one- or two-person admin team is most of them.
          const mine = viewerUserId != null && row.initiated_by === viewerUserId;
          return {
            id: row.approval_id,
            title: (row.action_type ?? 'Approval').replace(/_/g, ' '),
            // A second admin is being asked to agree to something; their
            // colleague's REASON is the whole content of the decision.
            detail: row.rationale?.slice(0, 90) ?? 'No reason given',
            // "I agree", never "Approve" — this is the SECOND signature on a
            // colleague's decision, not the decision itself.
            action: mine
              ? undefined
              : { kind: 'agree-request', label: 'I agree', id: row.approval_id },
            note: mine ? 'You started this — a different admin has to agree.' : undefined,
            href: '/admin/approvals',
          };
        }),
      };
    }

    if (key === 'reviews') {
      const q = open('appeal_id, matched_signal, appeal_reason, submitted_at');
      if (!q) return null;
      const { data, count } = await q
        .order('submitted_at', { ascending: true })
        .limit(PEEK_LIMIT);
      return {
        total: count ?? 0,
        items: (data ?? []).map((r: unknown) => {
          const row = r as {
            appeal_id: string;
            matched_signal: string | null;
            appeal_reason: string | null;
          };
          const refused =
            row.matched_signal === 'owner_self' || row.matched_signal === 'team_member';
          return {
            id: row.appeal_id,
            title: (row.matched_signal ?? 'Review appeal').replace(/_/g, ' '),
            detail: row.appeal_reason?.slice(0, 90) ?? 'No reason given',
            // 🔑 TWO SEPARATE REFUSALS, AND ONLY ONE OF THEM IS A FORM.
            // (1) owner_self / team_member — a shop owner or their own staff
            //     reviewing their own shop. The database trigger refuses these
            //     even with bypass, so publishing is IMPOSSIBLE, not merely
            //     gated. The reviews page shows a red panel explaining it and
            //     offers Reject or Escalate instead; the drawer copied the rows
            //     but not the rule, so it offered a Publish that always errored.
            // (2) everything else — publishable, but overridePublishReview
            //     REFUSES without a reason.
            // Publishing over a couple's review is on the record, and the
            // record needs the why.
            form: refused
              ? undefined
              : {
              kind: 'publish-review',
              id: row.appeal_id,
              submitLabel: 'Publish',
              fields: [
                {
                  name: 'reason',
                  type: 'text',
                  placeholder: 'Why publish this? (required, on the record)',
                  required: true,
                },
              ],
            },
            note: refused
              ? 'This one can never be published — a shop reviewing itself. Open it to reject or escalate.'
              : undefined,
            href: '/admin/reviews',
          };
        }),
      };
    }

    if (key === 'payouts') {
      const q = open('payout_id, amount_centavos, stage, trigger_date');
      if (!q) return null;
      const { data, count } = await q
        // Real columns, read out of the migration: `stage` (not payout_stage),
        // `amount_centavos` (not net_centavos), `trigger_date` (not
        // scheduled_at), and pending is `released_at IS NULL` — the table has
        // no `status`. Four guesses, four wrong; the column guard caught them.
        .order('trigger_date', { ascending: true })
        .limit(PEEK_LIMIT);
      return {
        total: count ?? 0,
        items: (data ?? []).map((r: unknown) => {
          const row = r as {
            payout_id: string;
            amount_centavos: number | null;
            stage: string | null;
          };
          return {
            id: row.payout_id,
            title: formatCentavosPhp(row.amount_centavos ?? 0),
            detail: (row.stage ?? 'payout').replace(/_/g, ' '),
            // NOT a button. markPayoutPaidAction RECORDS a transfer the admin
            // already made by hand; without the method and the reference the
            // record cannot be matched to a bank statement later.
            form: {
              kind: 'record-payout',
              id: row.payout_id,
              submitLabel: 'Record as paid',
              fields: [
                { name: 'payment_method', type: 'select', options: ['gcash', 'bdo_transfer', 'maya', 'check'], required: true },
                { name: 'payout_reference', type: 'text', placeholder: 'Reference number', required: true },
              ],
            },
            href: '/admin/payouts',
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
    // Report the FAILURE, never a clear queue. A judgement queue still shows
    // its sentence — that text is a rule, not a reading of the data.
    return note
      ? { items: [], total: 0, judgementNote: note }
      : { items: [], total: 0, unreadable: true };
  }
}
