import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatCentavosPhp } from '@/lib/payouts';
import { getQueueSource } from '@/lib/admin/queue-counts';
import { readPaymentLights, type PaymentLightsRead } from '@/lib/admin/green-payments.server';
import { withReceiptVerdicts } from '@/lib/admin/payment-verdicts.server';
import { picture, readPeople, readShops, type ShopLite } from '@/lib/admin/request-card.server';
import { previewUrl } from '@/lib/admin/supplier-work.server';
import { r2KeysInSlot } from '@/lib/verification-checks-server';
import { DOC_SLOTS, type DocUpload } from '@/lib/vendor-verification';
import { approvalActionLabel } from '@/lib/admin-approvals';
import { SELF_REVIEW_SIGNAL_TONE, type SelfReviewSignal } from '@/lib/self-review-gate';
import {
  PAYOUT_METHOD_LABEL,
  channelWords,
  chatFlagWhat,
  correctionAsk,
  correctionDecline,
  initialsOf,
  methodWords,
  readableValue,
  tierWords,
  type RequestCard,
} from '@/lib/admin/request-card';

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
  kind:
    | 'publish-review'
    | 'record-payout'
    | 'settle-help'
    | 'settle-chat-flag'
    | 'settle-correction'
    | 'settle-subscription'
    | 'settle-payment-option';
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
  /** Payments only: the desk's clean-match light (green = in "Approve all N green"). */
  light?: 'green' | 'amber';
  /** Payments only: the receipt read's own sentence, or plain words for its absence. */
  verdict?: string;
  /** Payments only, amber rows: the one line saying why it was held. */
  held?: string;
  /**
   * ➕ THE REQUEST CARD (owner approved 2026-11-14) — who wants what, the real thing, who asked + when, and the
   * decision. Every peek queue sets it; the drawer draws the card, never the raw row above.
   */
  card?: RequestCard;
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
  /* Added 2026-08-28. Approving one DESTROYS an event and voids paid
     services with no automatic refund — the most irreversible thing in this
     console. It is a judgement about somebody's money, never a fact to tick. */
  'event-deletions':
    'Removing an event destroys its photos and ends what was paid for. Opens the case file.',
  'force-majeure': 'An event-impacting flag affects other people’s bookings too.',
  /* Added 2026-08-26. Force-complete unlocks a couple's public review; uphold
     non-delivery freezes it. Both notify the couple and both move a rating —
     that is a ruling on whether a supplier did the job, not a fact to tick. */
  completions:
    'Deciding whether a supplier delivered moves a public review either way. Opens the file.',
  /* Added 2026-11-13 with their counts (admin slice 4). */
  'repost-watch':
    'A repost is a judgement: open both pictures side by side before you decide.',
  'editorial-review':
    'A flagged editorial needs reading in full — the couple waits until you clear it. Opens the review.',
};

/**
 * Queues with no button for a reason that is NOT judgement — the work is real,
 * it simply does not happen here.
 *
 * 🔑 WHY THIS EXISTS. Three queues had neither a control nor a sentence, so an
 * expanded row showed nothing at all and the reader learned nothing. The house
 * rule above applies just as hard to them: *being explicit beats being silent;
 * a reader should learn WHY there is no button here, not assume the feature is
 * unfinished.* Judgement was never the only honest reason to withhold one.
 */
export const SETTLED_ELSEWHERE: Record<string, string> = {
  'booking-fees':
    'A fee is confirmed on Payments, where the supplier’s receipt is — this list only shows who has not paid yet.',
  'vendor-partnerships':
    'These wait on the other supplier, not on us. The only thing we can do is veto one, and that opens the file.',
  /* Added 2026-11-13 with their counts (admin slice 4). */
  'pax-changes':
    'A record of guest-count cost changes — nothing to decide; open it to read the trail.',
  'supplier-refunds':
    'Refunds a supplier recorded giving their client — no money moves through Setnayan, so there is nothing to decide here.',
  'social-queue':
    'Retries and take-downs are done on the Social queue, where the post and its platforms are.',
  pakanta: 'A song is written, then uploaded on its Music Maker row, where the brief is.',
  'service-requests':
    'Each request is decided on its own page — add the service, or point to one we have.',
  problems: 'Each problem opens with its trace on Problems, where it can be closed.',
  'email-bounces': 'Who did not get which email is on Email delivery, with the reason.',
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
/* ⚠ KEEP THIS ARRAY A PLAIN LIST OF STRING LITERALS. queue-peek-coverage.test.ts
   reads it by regex — the same text-scanning approach the house nav lints use —
   so a comment INSIDE the brackets is parsed as a queue name and the guard fails
   with the comment as its "missing branch". Annotate above, never within.

   'help' + 'chat-flags' joined 2026-08-26: both settle WITHOUT a page jump,
   because neither action redirects, so neither needs the swallow-the-redirect
   wrapper that reviews and payouts require. */
const PEEK_QUEUES = [
  'payments',
  'verify',
  'approvals',
  'reviews',
  'payouts',
  'help',
  'chat-flags',
  'corrections',
  'subscriptions',
  'payment-options',
] as const;

export const EXPANDABLE_QUEUES: ReadonlySet<string> = new Set<string>([
  ...PEEK_QUEUES,
  ...Object.keys(JUDGEMENT_QUEUES),
  ...Object.keys(SETTLED_ELSEWHERE),
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
  /** Reads the caller already made this request, so opening a row is not a second read. */
  pre?: { paymentLights?: PaymentLightsRead },
): Promise<QueuePeek | null> {
  // Both reasons a queue may withhold a control: it is a judgement, or the
  // work happens somewhere else. Either way the row SAYS so.
  const note = JUDGEMENT_QUEUES[key] ?? SETTLED_ELSEWHERE[key];

  // Build the query from the SAME table + filter the badge counted with. Never
  // re-type a predicate here: see getQueueSource() for the payouts mismatch
  // this prevents.
  // Returns an untyped PostgREST builder (the shared filter is duck-typed), so
  // every consumer below narrows its own row with an explicit cast — the same
  // discipline the file already used.
  // `any` matches how queue-counts.ts types its own filter builders — the
  // PostgREST chain is duck-typed and each branch narrows its rows explicitly.
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
      /* ➕ GREEN / AMBER (admin slice 4, 2026-11-13). The rows are sorted by the
         SAME rule the desk's clean-match badge uses (lib/admin/green-payments.ts),
         and each carries the receipt read's own sentence and, when held, why.
         The Work page reads this once for the row's "Approve all N green" and
         hands it in, so opening the row costs no second read. */
      let lights = pre?.paymentLights;
      if (!lights) {
        const admin = createAdminClient();
        const read = await readPaymentLights(admin);
        lights = read.ok ? { ...read, rows: await withReceiptVerdicts(admin, read.rows) } : read;
      }
      if (!lights.ok) return { items: [], total: 0, unreadable: true };
      // Green first (they clear fastest), then the queue's own oldest-first order.
      const ordered = [...lights.rows].sort(
        (a, b) => Number(b.light.light === 'green') - Number(a.light.light === 'green'),
      );
      const items: PeekItem[] = ordered.slice(0, PEEK_LIMIT).map((row) => {
        // 🚨 NO PROOF ⇒ NO ONE-CLICK. Owner, 2026-08-05: *"vendor must send
        // their booking fee payment before we activate it. admin will verify it
        // manually if paid via QR."* A booking-fee row is opened as pending the
        // moment the vendor confirms the deposit — before any money moves — with
        // no reference and no screenshot: a payment EXPECTED, not one that
        // ARRIVED. 🔑 A FACT QUEUE IS ONLY A FACT QUEUE WHEN THE FACT IS ON THE
        // ROW — so that row gets the page and its "why held" instead.
        const hasProof = row.hasProof;
        return {
          id: row.paymentId,
          title: formatCentavosPhp(Math.round((row.amountPhp ?? 0) * 100)),
          detail: [row.channel ?? 'payment', row.referenceNumber ? `ref ${row.referenceNumber}` : null, row.who]
            .filter(Boolean)
            .join(' · '),
          light: row.light.light,
          verdict: row.verdict,
          // A proofless row already says why in its note — not twice.
          held: row.light.light === 'amber' && hasProof ? row.light.why : undefined,
          action: hasProof
            ? { kind: 'approve-payment', label: 'Confirm payment', id: row.paymentId }
            : undefined,
          note: hasProof
            ? undefined
            : 'No reference or screenshot yet — nothing to check the money against. Open it to see the order.',
          href: '/admin/payments',
          card: paymentCard(row, hasProof),
        };
      });

      return { items, total: lights.total };
    }

    if (key === 'verify') {
      const q = open('application_id, application_type, docs_complete, submitted_at, vendor_profile_id, doc_uploads');
      if (!q) return null;
      const { data, count, error } = await q
        .order('submitted_at', { ascending: true })
        .limit(PEEK_LIMIT);
      // 🪤 SUPABASE DOES NOT THROW. It answers politely with { error }, so the
      // try/catch below could never fire and `unreadable` was unreachable —
      // a renamed column or a permission change still produced a green tick
      // and \"Nothing waiting here\" over work that was genuinely sitting there.
      if (error) return { items: [], total: 0, unreadable: true };
      const vRows = (data ?? []) as Array<{ vendor_profile_id: string | null }>;
      const vShops = await readShops(vRows.map((r) => r.vendor_profile_id));
      const vPeople = await readPeople([...vShops.values()].map((v) => v.ownerId));
      const vCards = await Promise.all(
        (data ?? []).map((r: unknown) => verifyCard(r as VerifyRow, vShops, vPeople)),
      );
      return {
        total: count ?? 0,
        items: (data ?? []).map((r: unknown, i: number) => {
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
            card: vCards[i],
          };
        }),
      };
    }

    if (key === 'approvals') {
      const q = open('approval_id, action_type, rationale, expires_at, initiated_by, created_at');
      if (!q) return null;
      const { data, count, error } = await q
        .order('expires_at', { ascending: true })
        .limit(PEEK_LIMIT);
      // 🪤 SUPABASE DOES NOT THROW. It answers politely with { error }, so the
      // try/catch below could never fire and `unreadable` was unreachable —
      // a renamed column or a permission change still produced a green tick
      // and \"Nothing waiting here\" over work that was genuinely sitting there.
      if (error) return { items: [], total: 0, unreadable: true };
      const aPeople = await readPeople(
        ((data ?? []) as Array<{ initiated_by: string | null }>).map((r) => r.initiated_by),
      );
      return {
        total: count ?? 0,
        items: (data ?? []).map((r: unknown) => {
          const row = r as {
            approval_id: string;
            action_type: string | null;
            rationale: string | null;
            initiated_by: string | null;
            created_at: string | null;
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
            card: approvalCard(row, mine, aPeople),
          };
        }),
      };
    }

    if (key === 'reviews') {
      const q = open('appeal_id, matched_signal, appeal_reason, submitted_at, vendor_profile_id, reviewer_user_id, review_payload');
      if (!q) return null;
      const { data, count, error } = await q
        .order('submitted_at', { ascending: true })
        .limit(PEEK_LIMIT);
      // 🪤 SUPABASE DOES NOT THROW. It answers politely with { error }, so the
      // try/catch below could never fire and `unreadable` was unreachable —
      // a renamed column or a permission change still produced a green tick
      // and \"Nothing waiting here\" over work that was genuinely sitting there.
      if (error) return { items: [], total: 0, unreadable: true };
      const rRows = (data ?? []) as Array<{ vendor_profile_id: string | null; reviewer_user_id: string | null }>;
      const rShops = await readShops(rRows.map((r) => r.vendor_profile_id));
      const rPeople = await readPeople(rRows.map((r) => r.reviewer_user_id));
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
            card: reviewCard(r as ReviewRow, refused, rShops, rPeople),
          };
        }),
      };
    }

    if (key === 'corrections') {
      /* A verified shop asking us to fix a detail it cannot edit itself.
         ➕ ADMIN REQUEST CARDS (owner approved 2026-11-14): this row used to read "Change logo_url" over two r2://
         paths, with an `apply` select and a reason select already showing a NAME reason for every field. Now the card
         says who wants what, shows the old and new logo as pictures (or the old and new text), and decides with
         Approve / Decline — the decline asks for a reason from the list that fits THIS field, nothing picked. */
      const q = open('id, field_key, current_value, requested_value, note, created_at, vendor_profile_id');
      if (!q) return null;
      const { data, count, error } = await q
        .order('created_at', { ascending: true })
        .limit(PEEK_LIMIT);
      if (error) return { items: [], total: 0, unreadable: true };

      const rows = (data ?? []) as CorrectionRow[];
      const shops = await readShops(rows.map((r) => r.vendor_profile_id));
      const people = await readPeople([...shops.values()].map((v) => v.ownerId));
      const items: PeekItem[] = await Promise.all(
        rows.map(async (row) => {
          const card = await correctionCard(row, shops, people);
          return { id: row.id, title: card.title, detail: card.chip, href: '/admin/corrections', card };
        }),
      );
      return { items, total: count ?? items.length };
    }

    if (key === 'subscriptions') {
      /* ⚠ THE ROW SHOWS THE REFERENCE AND THE AMOUNT, and that is the whole
         point: approving activates a paid plan, so the same rule the payments
         queue lives by applies — you cannot confirm money you cannot see. A
         row with no reference gets NO form and says why. */
      const q = open('purchase_id, tier, billing_cycle, amount_php, reference_code, created_at, vendor_id');
      if (!q) return null;
      const { data, count, error } = await q
        .order('created_at', { ascending: true })
        .limit(PEEK_LIMIT);
      if (error) return { items: [], total: 0, unreadable: true };
      const sShops = await readShops(((data ?? []) as Array<{ vendor_id: string | null }>).map((r) => r.vendor_id));
      const sPeople = await readPeople([...sShops.values()].map((v) => v.ownerId));

      const items: PeekItem[] = (data ?? []).map((r: unknown) => {
        const row = r as {
          purchase_id: string;
          tier: string | null;
          billing_cycle: string | null;
          amount_php: number | null;
          reference_code: string | null;
        };
        const hasProof = row.reference_code != null && row.reference_code.trim() !== '';
        return {
          id: row.purchase_id,
          title: formatCentavosPhp(Math.round((row.amount_php ?? 0) * 100)),
          detail: [row.tier, row.billing_cycle, row.reference_code ? `ref ${row.reference_code}` : null]
            .filter(Boolean)
            .join(' · '),
          form: hasProof
            ? {
                kind: 'settle-subscription',
                id: row.purchase_id,
                submitLabel: 'Save',
                fields: [
                  { name: 'decision', type: 'select', options: ['approve', 'reject'], required: true },
                  { name: 'reason', type: 'text', placeholder: 'Reason (needed to reject)', required: false },
                ],
              }
            : undefined,
          note: hasProof
            ? undefined
            : 'No payment reference yet — nothing to check this against. Open it to see the plan.',
          href: '/admin/subscriptions',
          card: subscriptionCard(r as SubscriptionRow, hasProof, sShops, sPeople),
        };
      });
      return { items, total: count ?? items.length };
    }

    if (key === 'payment-options') {
      /* Where a supplier wants to be paid. A FORM, and deliberately a NARROW
         one: approve or hold. **Remove is not offered here** — it is
         irreversible and belongs on the page with its confirmation, not on a
         list built for speed. */
      const q = open('payment_method_id, method_type, label, account_name, created_at, vendor_profile_id, provider, qr_r2_key');
      if (!q) return null;
      const { data, count, error } = await q
        .order('created_at', { ascending: true })
        .limit(PEEK_LIMIT);
      if (error) return { items: [], total: 0, unreadable: true };
      const pRows = (data ?? []) as PaymentOptionRow[];
      const pShops = await readShops(pRows.map((r) => r.vendor_profile_id));
      const pPeople = await readPeople([...pShops.values()].map((v) => v.ownerId));
      const pCards = await Promise.all(pRows.map((r) => paymentOptionCard(r, pShops, pPeople)));

      const items: PeekItem[] = (data ?? []).map((r: unknown, i: number) => {
        const row = r as {
          payment_method_id: string;
          method_type: string | null;
          label: string | null;
          account_name: string | null;
        };
        return {
          id: row.payment_method_id,
          title: row.label?.trim() || row.method_type || 'A payout destination',
          detail: row.account_name ?? '',
          form: {
            kind: 'settle-payment-option',
            id: row.payment_method_id,
            submitLabel: 'Save',
            fields: [
              { name: 'decision', type: 'select', options: ['approve', 'hold'], required: true },
            ],
          },
          href: '/admin/payment-options',
          card: pCards[i],
        };
      });
      return { items, total: count ?? items.length };
    }

    if (key === 'help') {
      /* A FORM, because `setHelpMessageStatus` refuses to run without a status
         and will not take one it does not recognise ("Invalid status"). The
         reply box is optional and posts as `admin_notes`; the action only
         notifies the person when that content actually CHANGED, so leaving it
         blank flips the status silently and does not spam them. */
      const q = open('message_id, subject, sender_name, sender_email, topic, created_at, body, origin_vendor_profile_id');
      if (!q) return null;
      const { data, count, error } = await q
        .order('created_at', { ascending: true })
        .limit(PEEK_LIMIT);
      // Supabase resolves with { error } — a rejected read must not read as "clear".
      if (error) return { items: [], total: 0, unreadable: true };
      const hShops = await readShops(
        ((data ?? []) as Array<{ origin_vendor_profile_id: string | null }>).map((r) => r.origin_vendor_profile_id),
      );

      const items: PeekItem[] = (data ?? []).map((r: unknown) => {
        const row = r as {
          message_id: string;
          subject: string | null;
          sender_name: string | null;
          sender_email: string | null;
          topic: string | null;
        };
        return {
          id: row.message_id,
          title: row.subject?.trim() || 'No subject',
          detail: [row.sender_name ?? row.sender_email, row.topic].filter(Boolean).join(' · '),
          form: {
            kind: 'settle-help',
            id: row.message_id,
            submitLabel: 'Save',
            fields: [
              // The stored values, in the order a person works through them.
              { name: 'status', type: 'select', options: ['in_progress', 'closed'], required: true },
              { name: 'admin_notes', type: 'text', placeholder: 'Reply (optional)', required: false },
            ],
          },
          href: '/admin/help',
          card: helpCard(r as HelpRow, hShops),
        };
      });
      return { items, total: count ?? items.length };
    }

    if (key === 'chat-flags') {
      /* A FORM, because `resolveChatFlag` refuses without one ("Pick an
         action"). ⚠ THE MESSAGE ITSELF IS DELIBERATELY NOT SHOWN. The page's
         own kept sentence — "This queue shows only the …" — exists so a
         reviewer does not think they are about to read somebody's private
         conversation, and a drawer that leaked the body would break that
         promise in the one place nobody would look for it. */
      const q = open('flag_id, categories, hit_count, sender_role, created_at, vendor_profile_id');
      if (!q) return null;
      const { data, count, error } = await q
        .order('created_at', { ascending: true })
        .limit(PEEK_LIMIT);
      if (error) return { items: [], total: 0, unreadable: true };
      const cShops = await readShops(
        ((data ?? []) as Array<{ vendor_profile_id: string | null }>).map((r) => r.vendor_profile_id),
      );

      const items: PeekItem[] = (data ?? []).map((r: unknown) => {
        const row = r as {
          flag_id: string;
          categories: string[] | null;
          hit_count: number | null;
          sender_role: string | null;
        };
        const what = (row.categories ?? []).join(', ') || 'a contact detail';
        return {
          id: row.flag_id,
          title: `A ${row.sender_role ?? 'message'} shared ${what}`,
          detail: `${row.hit_count ?? 1} match${(row.hit_count ?? 1) === 1 ? '' : 'es'}`,
          form: {
            kind: 'settle-chat-flag',
            id: row.flag_id,
            submitLabel: 'Save',
            fields: [
              { name: 'action', type: 'select', options: ['reviewed', 'dismiss'], required: true },
            ],
          },
          href: '/admin/chat-flags',
          card: chatFlagCard(r as ChatFlagRow, cShops),
        };
      });
      return { items, total: count ?? items.length };
    }

    if (key === 'payouts') {
      const q = open('payout_id, amount_centavos, stage, trigger_date, vendor_profile_id');
      if (!q) return null;
      const { data, count, error } = await q
        // Real columns, read out of the migration: `stage` (not payout_stage),
        // `amount_centavos` (not net_centavos), `trigger_date` (not
        // scheduled_at), and pending is `released_at IS NULL` — the table has
        // no `status`. Four guesses, four wrong; the column guard caught them.
        .order('trigger_date', { ascending: true })
        .limit(PEEK_LIMIT);
      // 🪤 SUPABASE DOES NOT THROW. It answers politely with { error }, so the
      // try/catch below could never fire and `unreadable` was unreachable —
      // a renamed column or a permission change still produced a green tick
      // and \"Nothing waiting here\" over work that was genuinely sitting there.
      if (error) return { items: [], total: 0, unreadable: true };
      const oShops = await readShops(
        ((data ?? []) as Array<{ vendor_profile_id: string | null }>).map((r) => r.vendor_profile_id),
      );
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
            card: payoutCard(r as PayoutRow, oShops),
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

/* ───────────────────────────── THE REQUEST CARDS ─────────────────────────────
   One builder per queue (owner approved 2026-11-14). Each answers the same four questions — who wants what, what
   exactly, who asked and when, and what the admin can press — from the row the badge counted, plus the shop and the
   person behind it. A read of a shop or a person that fails leaves the card in plain words ("A supplier"), never a code. */

const shopHref = (shop: ShopLite | undefined): string | null => (shop?.slug ? `/${shop.slug}` : null);
const owner = (shop: ShopLite | undefined, people: Map<string, string>): string | null => {
  const n = shop?.ownerId ? people.get(shop.ownerId) : undefined;
  return n ? `${n} · owner` : shop ? `${shop.name} · owner` : null;
};

type CorrectionRow = {
  id: string;
  field_key: string | null;
  current_value: string | null;
  requested_value: string | null;
  note: string | null;
  created_at: string | null;
  vendor_profile_id: string | null;
};

async function correctionCard(
  row: CorrectionRow,
  shops: Map<string, ShopLite>,
  people: Map<string, string>,
): Promise<RequestCard> {
  const shop = row.vendor_profile_id ? shops.get(row.vendor_profile_id) : undefined;
  const name = shop?.name ?? 'A supplier';
  const isLogo = row.field_key === 'logo_url';
  const [before, after] = isLogo
    ? await Promise.all([picture(row.current_value), picture(row.requested_value)])
    : [null, null];
  return {
    title: `${name} ${correctionAsk(row.field_key)}`,
    chip: 'Profile correction',
    initials: initialsOf(name),
    at: row.created_at,
    who: owner(shop, people),
    quote: row.note?.trim() || null,
    show: [
      isLogo
        ? { kind: 'images', before, after, beforeAlt: `${name}’s logo now`, afterAlt: `The logo ${name} asked for` }
        : {
            kind: 'text',
            before: readableValue(row.field_key, row.current_value),
            after: readableValue(row.field_key, row.requested_value),
          },
    ],
    shopHref: shopHref(shop),
    recordHref: '/admin/corrections',
    act: {
      kind: 'correction',
      id: row.id,
      buttons: [
        { label: 'Approve', tone: 'ok', main: true, post: { decision: 'apply' } },
        {
          label: 'Decline',
          tone: 'danger',
          post: { decision: 'decline' },
          reasons: correctionDecline(row.field_key, name),
        },
      ],
    },
  };
}

function paymentCard(
  row: { who: string; amountPhp: number; channel: string | null; referenceNumber: string | null; createdAt: string; paymentId: string; verdict?: string; light: { light: 'green' | 'amber'; why?: string } },
  hasProof: boolean,
): RequestCard {
  const amount = formatCentavosPhp(Math.round((row.amountPhp ?? 0) * 100));
  const facts: Array<{ label: string; value: string; tone?: 'ok' | 'warn' }> = [
    { label: 'Amount', value: amount },
    { label: 'Sent by', value: channelWords(row.channel) },
  ];
  if (row.referenceNumber) facts.push({ label: 'Reference', value: row.referenceNumber });
  if (row.verdict) facts.push({ label: 'Their receipt', value: row.verdict, tone: row.light.light === 'green' ? 'ok' : 'warn' });
  if (row.light.light === 'amber' && hasProof && row.light.why) facts.push({ label: 'Why held', value: row.light.why, tone: 'warn' });
  return {
    title: `${row.who} sent a payment of ${amount}`,
    chip: 'Payment',
    initials: initialsOf(row.who),
    at: row.createdAt,
    who: row.who,
    quote: null,
    show: [{ kind: 'facts', rows: facts }],
    shopHref: null,
    recordHref: '/admin/payments',
    act: hasProof
      ? {
          kind: 'payment',
          id: row.paymentId,
          buttons: [
            { label: 'Confirm payment', tone: 'ok', main: true, post: {} },
            {
              label: 'Ask for a clearer photo',
              tone: 'warn',
              post: { intent: 'resubmit' },
              reasons: { title: 'What should they fix?', reader: 'They will read this and send it again.', list: 'proof' },
            },
          ],
        }
      : undefined,
    footNote: hasProof
      ? undefined
      : 'No reference or screenshot yet — nothing to check the money against. Open the record to see the order.',
  };
}

type VerifyRow = {
  application_id: string;
  docs_complete: boolean | null;
  submitted_at: string | null;
  vendor_profile_id: string | null;
  doc_uploads: Record<string, DocUpload> | null;
};

async function verifyCard(
  row: VerifyRow,
  shops: Map<string, ShopLite>,
  people: Map<string, string>,
): Promise<RequestCard> {
  const shop = row.vendor_profile_id ? shops.get(row.vendor_profile_id) : undefined;
  const name = shop?.name ?? 'A supplier';
  const uploads = row.doc_uploads ?? {};
  const papers = await Promise.all(
    DOC_SLOTS.filter((sl) => sl.kind === 'upload').map(async (sl) => {
      const first = r2KeysInSlot(uploads[sl.key] ?? null)[0] ?? null;
      return {
        label: sl.label,
        present: first !== null,
        previewUrl: first && row.vendor_profile_id ? await previewUrl(first, row.vendor_profile_id).catch(() => null) : null,
      };
    }),
  );
  return {
    title: `${name} sent papers to be verified`,
    chip: 'Verification',
    initials: initialsOf(name),
    at: row.submitted_at,
    who: owner(shop, people),
    quote: null,
    show: [{ kind: 'papers', papers }],
    shopHref: shopHref(shop),
    recordHref: '/admin/verify',
    act: row.docs_complete
      ? {
          kind: 'verify',
          id: row.application_id,
          buttons: [
            { label: 'Verify shop', tone: 'ok', main: true, post: { decision: 'approve' } },
            {
              label: 'Needs a fix',
              tone: 'warn',
              post: { decision: 'needs_fix' },
              reasons: { title: 'What needs a fix?', reader: `${name} will read this on its setup.`, list: 'docs' },
            },
          ],
        }
      : undefined,
    footNote: row.docs_complete ? undefined : 'Still waiting on papers — nothing to check yet. Open the record to see what is in.',
  };
}

function approvalCard(
  row: { approval_id: string; action_type: string | null; rationale: string | null; initiated_by: string | null; created_at: string | null },
  mine: boolean,
  people: Map<string, string>,
): RequestCard {
  const by = row.initiated_by ? people.get(row.initiated_by) ?? 'A colleague' : 'A colleague';
  const what = approvalActionLabel(row.action_type ?? '');
  const readable = /_/.test(what) ? 'a change that needs two admins' : what.charAt(0).toLowerCase() + what.slice(1);
  return {
    title: `${by} wants to ${readable}`,
    chip: 'Two-admin approval',
    initials: initialsOf(by),
    at: row.created_at,
    who: `${by} · admin`,
    quote: row.rationale?.trim() || null,
    show: [],
    shopHref: null,
    recordHref: '/admin/approvals',
    act: mine
      ? undefined
      : {
          kind: 'approval',
          id: row.approval_id,
          buttons: [
            { label: 'I agree', tone: 'ok', main: true, post: {} },
            {
              label: 'I don’t',
              tone: 'danger',
              post: { intent: 'reject' },
              reasons: { title: 'Why not?', reader: `${by} will read this.`, list: 'approval' },
            },
          ],
        },
    footNote: mine ? 'You started this — a different admin has to agree.' : undefined,
  };
}

type ReviewRow = {
  appeal_id: string;
  matched_signal: string | null;
  appeal_reason: string | null;
  submitted_at: string | null;
  vendor_profile_id: string | null;
  reviewer_user_id: string | null;
  review_payload: Record<string, unknown> | null;
};

/** Why a review was held, in words the admin can act on. */
const HELD_BECAUSE: Readonly<Record<string, string>> = {
  owner_self: 'written by the shop’s own owner',
  team_member: 'written by someone on the shop’s team',
  payment_match: 'paid with the same payment method the shop’s owner uses',
  device_match: 'sent from the same phone or computer the shop’s owner uses',
  household_match: 'sent from the same address as the shop’s owner',
};

function reviewCard(
  row: ReviewRow,
  refused: boolean,
  shops: Map<string, ShopLite>,
  people: Map<string, string>,
): RequestCard {
  const shop = row.vendor_profile_id ? shops.get(row.vendor_profile_id) : undefined;
  const name = shop?.name ?? 'a supplier';
  const by = row.reviewer_user_id ? people.get(row.reviewer_user_id) ?? 'The reviewer' : 'The reviewer';
  const p = row.review_payload ?? {};
  const stars = typeof p['rating_overall'] === 'number' ? (p['rating_overall'] as number) : null;
  const body = typeof p['body'] === 'string' ? (p['body'] as string) : null;
  const because = row.matched_signal ? HELD_BECAUSE[row.matched_signal] : undefined;
  const hard = row.matched_signal ? SELF_REVIEW_SIGNAL_TONE[row.matched_signal as SelfReviewSignal] === 'hard' : false;
  return {
    title: `A review of ${name} was held back`,
    chip: 'Review appeal',
    initials: initialsOf(shop?.name ?? by),
    at: row.submitted_at,
    who: `${by} · wrote the review`,
    quote: row.appeal_reason?.trim() || null,
    show: [{ kind: 'review', stars, body, why: because ? `It looks ${because}.` : 'Held by the self-review check.' }],
    shopHref: shopHref(shop),
    recordHref: '/admin/reviews',
    act:
      refused || hard
        ? undefined
        : {
            kind: 'review',
            id: row.appeal_id,
            buttons: [
              {
                label: 'Publish',
                tone: 'ok',
                main: true,
                post: {},
                reasons: { title: 'Why publish it?', reader: 'This goes on the record.', list: 'publish' },
              },
              {
                label: 'Keep it held',
                tone: 'neutral',
                post: { intent: 'keep' },
                reasons: { title: 'Why keep it held?', reader: 'This goes on the record.', list: 'held' },
              },
            ],
          },
    footNote:
      refused || hard ? 'This one can never be published — a shop reviewing itself. Open the record to reject or escalate.' : undefined,
  };
}

type SubscriptionRow = {
  purchase_id: string;
  tier: string | null;
  billing_cycle: string | null;
  amount_php: number | null;
  reference_code: string | null;
  created_at: string | null;
  vendor_id: string | null;
};

function subscriptionCard(
  row: SubscriptionRow,
  hasProof: boolean,
  shops: Map<string, ShopLite>,
  people: Map<string, string>,
): RequestCard {
  const shop = row.vendor_id ? shops.get(row.vendor_id) : undefined;
  const name = shop?.name ?? 'A supplier';
  const plan = tierWords(row.tier, row.billing_cycle);
  const facts = [
    { label: 'Plan', value: plan },
    { label: 'Amount', value: formatCentavosPhp(Math.round((row.amount_php ?? 0) * 100)) },
  ];
  if (row.reference_code) facts.push({ label: 'Reference', value: row.reference_code });
  return {
    title: `${name} wants ${plan.replace(/ for .*$/, '')}`,
    chip: 'Plan upgrade',
    initials: initialsOf(name),
    at: row.created_at,
    who: owner(shop, people),
    quote: null,
    show: [{ kind: 'facts', rows: facts }],
    shopHref: shopHref(shop),
    recordHref: '/admin/subscriptions',
    act: hasProof
      ? {
          kind: 'subscription',
          id: row.purchase_id,
          buttons: [
            { label: 'Confirm', tone: 'ok', main: true, post: { decision: 'approve' } },
            {
              label: 'Decline',
              tone: 'danger',
              post: { decision: 'reject' },
              reasons: { title: 'Why can’t it be confirmed?', reader: `${name} will read this.`, list: 'plan' },
            },
          ],
        }
      : undefined,
    footNote: hasProof ? undefined : 'No payment reference yet — nothing to check this against. Open the record to see the plan.',
  };
}

type PaymentOptionRow = {
  payment_method_id: string;
  method_type: string | null;
  label: string | null;
  account_name: string | null;
  created_at: string | null;
  vendor_profile_id: string | null;
  provider: string | null;
  qr_r2_key: string | null;
};

async function paymentOptionCard(
  row: PaymentOptionRow,
  shops: Map<string, ShopLite>,
  people: Map<string, string>,
): Promise<RequestCard> {
  const shop = row.vendor_profile_id ? shops.get(row.vendor_profile_id) : undefined;
  const name = shop?.name ?? 'A supplier';
  const kind = methodWords(row.provider ?? row.method_type);
  const qr = await picture(row.qr_r2_key);
  const facts = [{ label: 'Account name', value: row.account_name?.trim() || 'Not given' }];
  if (row.label?.trim()) facts.push({ label: 'They call it', value: row.label.trim() });
  return {
    title: `${name} added a new ${kind} to be paid on`,
    chip: 'Payment option',
    initials: initialsOf(name),
    at: row.created_at,
    who: owner(shop, people),
    quote: null,
    show: [
      { kind: 'facts', rows: facts },
      ...(qr ? [{ kind: 'images' as const, before: null, after: qr, beforeAlt: '', afterAlt: `${name}’s payment QR` }] : []),
    ],
    shopHref: shopHref(shop),
    recordHref: '/admin/payment-options',
    act: {
      kind: 'payment-option',
      id: row.payment_method_id,
      buttons: [
        { label: 'Approve', tone: 'ok', main: true, post: { decision: 'approve' } },
        { label: 'Hold', tone: 'warn', post: { decision: 'hold' } },
      ],
    },
  };
}

type HelpRow = {
  message_id: string;
  subject: string | null;
  sender_name: string | null;
  sender_email: string | null;
  created_at: string | null;
  body: string | null;
  origin_vendor_profile_id: string | null;
};

function helpCard(row: HelpRow, shops: Map<string, ShopLite>): RequestCard {
  const shop = row.origin_vendor_profile_id ? shops.get(row.origin_vendor_profile_id) : undefined;
  const sender = shop?.name ?? row.sender_name?.trim() ?? row.sender_email ?? 'Someone';
  const subject = row.subject?.trim();
  return {
    title: subject ? `${sender} asked: ${subject}` : `${sender} sent a message`,
    chip: 'Help',
    initials: initialsOf(sender),
    at: row.created_at,
    who: [row.sender_name?.trim() || null, row.sender_email].filter(Boolean).join(' · ') || null,
    quote: row.body?.trim() ? row.body.trim().slice(0, 600) : null,
    show: [],
    shopHref: shopHref(shop),
    recordHref: '/admin/help',
    act: {
      kind: 'help',
      id: row.message_id,
      fields: [
        { kind: 'text', name: 'admin_notes', label: 'Your reply', placeholder: 'Write a reply (they see it in the app)', required: false, multiline: true },
      ],
      buttons: [
        { label: 'Send and keep open', tone: 'ok', main: true, post: { status: 'in_progress' } },
        { label: 'Close', tone: 'neutral', post: { status: 'closed' } },
      ],
    },
  };
}

type ChatFlagRow = {
  flag_id: string;
  categories: string[] | null;
  hit_count: number | null;
  sender_role: string | null;
  created_at: string | null;
  vendor_profile_id: string | null;
};

function chatFlagCard(row: ChatFlagRow, shops: Map<string, ShopLite>): RequestCard {
  const shop = row.vendor_profile_id ? shops.get(row.vendor_profile_id) : undefined;
  const who = row.sender_role === 'vendor' || row.sender_role === 'supplier' ? shop?.name ?? 'A supplier' : 'A couple';
  const n = row.hit_count ?? 1;
  return {
    title: `${who} shared ${chatFlagWhat(row.categories)} in chat`,
    chip: 'Chat flag',
    initials: initialsOf(who),
    at: row.created_at,
    who: shop ? `In a chat with ${shop.name}` : null,
    quote: null,
    // ⚠ The message itself is deliberately not shown (the page's kept promise — see the peek above).
    show: [{ kind: 'facts', rows: [{ label: 'Matches', value: `${n} ${n === 1 ? 'match' : 'matches'} — the message itself stays private` }] }],
    shopHref: shopHref(shop),
    recordHref: '/admin/chat-flags',
    act: {
      kind: 'chat-flag',
      id: row.flag_id,
      buttons: [
        { label: 'Looked at it', tone: 'ok', main: true, post: { action: 'reviewed' } },
        { label: 'Dismiss', tone: 'neutral', post: { action: 'dismiss' } },
      ],
    },
  };
}

type PayoutRow = {
  payout_id: string;
  amount_centavos: number | null;
  stage: string | null;
  trigger_date: string | null;
  vendor_profile_id: string | null;
};

function payoutCard(row: PayoutRow, shops: Map<string, ShopLite>): RequestCard {
  const shop = row.vendor_profile_id ? shops.get(row.vendor_profile_id) : undefined;
  const name = shop?.name ?? 'a supplier';
  const amount = formatCentavosPhp(row.amount_centavos ?? 0);
  return {
    title: `We owe ${name} ${amount} for an older order`,
    chip: 'Payout',
    initials: initialsOf(name),
    at: row.trigger_date,
    who: null,
    quote: null,
    show: [{ kind: 'facts', rows: [{ label: 'Amount', value: amount }, { label: 'Stage', value: row.stage === 'final' ? 'Final payment' : row.stage === 'deposit' ? 'Deposit' : 'Payment' }] }],
    shopHref: shopHref(shop),
    recordHref: '/admin/payouts',
    act: {
      kind: 'payout',
      id: row.payout_id,
      fields: [
        {
          kind: 'pick',
          name: 'payment_method',
          label: 'How it was paid',
          placeholder: 'How it was paid…',
          options: Object.entries(PAYOUT_METHOD_LABEL).map(([key, label]) => ({ key, label })),
        },
        { kind: 'text', name: 'payout_reference', label: 'Reference', placeholder: 'Reference number', required: true },
      ],
      buttons: [{ label: 'Record as paid', tone: 'ok', main: true, post: {} }],
    },
  };
}
