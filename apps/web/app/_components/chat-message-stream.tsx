'use client';

// Live message stream for an iteration-0019 chat thread.
//
// Responsibilities (replaces the previously server-rendered <ol> of messages):
//   1. Render the initial server-fetched batch immediately (SSR, no flash).
//   2. Subscribe to Postgres CHANGES events on `chat_messages` filtered by
//      thread_id so new INSERTs (and future UPDATEs for edits / read
//      receipts) flow in within ~500ms.
//   3. Maintain a presence channel so the OTHER party sees "X is typing…"
//      while the local user is composing. We debounce at 700ms idle and
//      auto-clear after 3s of inactivity to avoid spamming the channel.
//   4. Auto-scroll to the bottom when a new message arrives, but only if
//      the user is already near the bottom — never yank them out of the
//      scrollback while they're reading old messages.
//   5. Clean up channels on unmount AND when the threadId / userId changes
//      so we never leak subscriptions when the user navigates between
//      threads.
//
// The Supabase JS client auto-reconnects on network drops; on every
// resubscribe we refetch the latest messages so any inserts that happened
// while we were offline catch up without a page reload.

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import {
  fetchMessages,
  formatChatTimestamp,
  type ChatMessageRow,
  type ChatSenderRole,
} from '@/lib/chat';
import { formatCentavos, PROPOSAL_STATUS_LABEL } from '@/lib/vendor-proposals';
import { quoteCardState } from '@/lib/quote-card-state';
import type { CoupleLockTarget } from '@/lib/lock-door';
import { isLockHandshakeEnabled } from '@/lib/lock-handshake-flag';
import { AccordionLockButton } from '@/app/dashboard/[eventId]/vendors/_components/accordion-lock';
import { LockAnswerForms } from './lock-answer-forms';
import type { FeeDisclosure } from '@/lib/booking-fee-disclosure';
import { DepositReservation } from '@/app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/deposit-reservation';
import { moneyStepLine, type MoneyStep } from '@/lib/accepted-quote-terms';
import { trackFailure } from '@/lib/telemetry/track-error';
import { chatNegotiationEnabled } from '@/lib/chat-negotiation-flag';
import { detectNegotiation } from '@/lib/chat-negotiation-detect';
import { ChatAppointmentCard, type ChatAppointmentData } from './chat-appointment-card';
import { ChatOfferedServiceCard } from './chat-offered-service-card';
import { ScheduleSuggestChip } from './schedule-suggest-chip';
import {
  ChatAmendmentCard,
  type ChatAmendmentData,
  type AmendmentItemView,
} from './chat-amendment-card';
import type { ThreadLockHandshake } from '@/lib/lock-freeze-copy';
import { AmendmentSuggestChip } from './amendment-suggest-chip';
import type { DealEntry } from '@/lib/deal-entry';
import type { AppointmentKind } from '@/lib/appointments';
import {
  ThreadViewSwitch,
  DecisionsPanel,
  FilesPanel,
  type SupplierReplyActions,
} from './chat-thread-views';
import { withThreadView, type ThreadView } from '@/lib/thread-view';
import { ProofImage } from '@/app/_components/proof-image';
import {
  buildThreadDecisions,
  decisionsNeedingYou,
  type GuestCountFact,
  type PaymentFact,
} from '@/lib/thread-decisions';
import { buildSharedFiles } from '@/lib/chat-shared-files';
import type { SupplierStanding } from '@/lib/supplier-standing';
import type { PayoutReadiness } from '@/lib/deposit-pay-step';
import { PayoutMethodNudge } from '@/app/vendor-dashboard/_components/payout-method-nudge';
import { renderPerkUnlock } from '@/lib/perk-unlock-message';

/** Display data for the in-thread proposal card, fetched by proposal_id. */
type ProposalLineItem = {
  label: string | null;
  detail: string | null;
  amount_centavos: number | null;
};

type ProposalCardData = {
  publicId: string;
  title: string;
  totalCentavos: number;
  status: string;
  /**
   * The inclusions, so the quote reads in the conversation without a round
   * trip. They used to live only in the pinned card above the list — the one
   * whose height crushed the conversation to 32px on a phone.
   */
  lineItems: ProposalLineItem[];
  /**
   * `vendor_proposals.resolved_at` — WHEN the current status was reached.
   * Decisions needs it to say "Accepted · 1 Sep" rather than dating a verdict
   * by the message that announced the quote six weeks earlier.
   */
  resolvedAt: string | null;
};

type Props = {
  threadId: string;
  /**
   * `dealEntryFor(...)` for this thread, from the page. The "🧾 Send a deal"
   * chip opens the amendment builder, and a Deal amends a quote — so before
   * one exists the chip is not offered on either side (owner, 2026-09-19: it
   * rendered under the couple's own opening inquiry).
   */
  dealEntry: DealEntry;
  initialMessages: ChatMessageRow[];
  currentUserId: string;
  /**
   * Role of the LOCAL viewer. Used to right-align their own bubbles and to
   * label presence events ("Maria is typing…" vs. just "Vendor is typing…").
   * On the couple side this is 'couple', on the vendor side 'vendor'.
   */
  viewerRole: 'couple' | 'vendor';
  /**
   * Display label for the OTHER party. On the couple side that's the
   * vendor's business_name; on the vendor side that's the event's
   * display_name (per identity-masking — never the couple's personal name).
   */
  counterpartyLabel: string;
  /**
   * The event's date (yyyy-mm-dd) or null — bounds the meeting-request date
   * picker (today → day before the event). Negotiation Phase 1.
   */
  eventDate?: string | null;
  /**
   * WHERE THIS SUPPLIER STANDS — derived ONCE on the server by
   * `buildSupplierStanding` (S6) and handed here to be drawn. ⛔ Never rebuilt
   * in this component: the bench card renders the same sentence from the same
   * derivation, and that is the only thing that makes showing it twice safe.
   */
  standing?: SupplierStanding | null;
  /**
   * The two Decisions sources that are NOT messages. Both are page sections
   * rendered around this stream, so they can only arrive as props.
   *
   * ⚠ `payments` must be EVERY payment on the thread, not just the unconfirmed
   * ones. `fetchPendingVendorPayments` filters `vendor_confirmed_at IS NULL`;
   * feeding Decisions from it would drop the settled money from the record of
   * what was settled.
   */
  decisionPayments?: readonly PaymentFact[];
  decisionGuestCounts?: readonly GuestCountFact[];
  /**
   * PR-H · IS THE BOOKING BEHIND THIS THREAD BOOKED, OR MERELY ASKED?
   * Resolved on the SERVER by `fetchThreadLockHandshake` — it cannot be fetched
   * here, because a supplier cannot read `event_vendors` through their own
   * session (every policy on that table is couple- or moderator-scoped). Read
   * only by the locked-amendment line.
   *
   * ⚠ ABSENT MEANS UNKNOWN, NEVER "LOCKED". A mount site that forgets this prop
   * degrades to "Price agreed and frozen at this amount." — true everywhere —
   * rather than claiming a booking that may not exist.
   */
  lockHandshake?: ThreadLockHandshake | null;
  /**
   * Which third is showing on first paint — the page reads `?view=` on the
   * server and passes it here, so a Decisions link never flashes the chat.
   */
  initialView?: ThreadView;
  /**
   * The supplier's own reply actions (payment · guest count). Passed ONLY by
   * the supplier's page; the couple never receives those replies.
   */
  supplierReplyActions?: SupplierReplyActions;
  /**
   * Where "Counter-offer" goes on a quote card. A URL rather than a callback —
   * the thread pages are server components and cannot pass functions across the
   * boundary. Omit it and the button does not render, which is what a surface
   * with no negotiation composer wants.
   */
  counterHref?: string;
  /**
   * S5 · Where "Update this quote" goes on the LIVE quote card — the supplier's
   * page passes `?compose=quote`, which opens the Build-a-quote panel seeded
   * from the quote being replaced. Same shape as `counterHref`, same reason
   * (a server component cannot pass a callback). The couple's page omits it;
   * `quoteCardState` also never offers it to a couple.
   */
  reviseHref?: string;
  /**
   * S5 · The couple's live ACCEPTED quote LOCKS IN PLACE (owner, live,
   * 2026-09-19: "the lock attempt was from the chat. it should also work
   * there."). This is the pick the bench's own `AccordionLockButton` needs —
   * the card mounts THAT component, whose `finalizeVendor` gate chain (date,
   * impact, reservation terms, downpayment, slots, conflict) is the ONE way a
   * couple books. The thread does not grow a lock action of its own. Resolved
   * on the server from `event_vendors` (couple RLS). Omit it and the card shows
   * the accepted note without a button.
   */
  lockTarget?: CoupleLockTarget | null;
  /**
   * Inside the chat box (One Chat Box, 2026-09-18) the frame draws the border,
   * so the three scrollers drop their own card chrome — a box in a box is the
   * old wall one row shorter. The other mounts (client brief, workspace) keep
   * the card look. Layout classes are untouched either way: the floor and the
   * scroll region are the property `a-quote-card-does-not-crush-the-
   * conversation.test.ts` counts, and they must read the same in both modes.
   */
  flush?: boolean;
  /**
   * THE NEXT MONEY STEP on a BOOKED accepted quote (owner, live, 2026-09-20: "i
   * do not see the confirmation here and the payment action?"). `moneyStep`
   * (lib/accepted-quote-terms.ts) decides it; both pages read it through
   * `readBookedMoney`. Absent = the card says nothing about money, as before.
   */
  bookedStep?: MoneyStep | null;
  /**
   * Couple only: the props of the Payments tab's own "Amount to pay" card
   * (`DepositReservation`), which the quote card MOUNTS — the same
   * `recordDeposit` (first payment, minimum enforced) and `logScheduledPayment`
   * (later installments). Never re-implemented here.
   */
  couplePay?: React.ComponentProps<typeof DepositReservation> | null;
  /**
   * Supplier only: the unconfirmed first-payment ledger row. Its "Confirm"
   * posts `supplierReplyActions.confirmPayment` — `confirmVendorPayment`, the
   * same door the payment card uses, which acknowledges the deposit through
   * `confirm_vendor_payment` and runs the acknowledge effects.
   */
  supplierFirstPaymentRowId?: string | null;
  /**
   * THE RECEIPT THE COUPLE SENT, on the one card where the supplier says the
   * money reached them (owner, live, 2026-09-20).
   *
   * "Confirm it reached you" was a button with NOTHING to look at: the proof
   * lived on the client page, one navigation away, so the honest answer to
   * "did it arrive?" required leaving the screen that asks. A short-lived
   * presigned link resolved by the page (`depositProofDisplayUrl`) — never the
   * stored `r2://` ref, never a public URL. Null = no receipt on file, and the
   * card says nothing rather than showing a broken picture.
   */
  paymentProofUrl?: string | null;
  /**
   * The SUPPLIER's side only: can a couple see anywhere to pay this shop?
   * On the live ACCEPTED quote card the supplier gets the same one-tap door
   * the Overview's booking card carries (2026-09-19) — the couple's next step
   * is to book and pay a deposit. A plain string (serialisable); the couple's
   * page omits it, and `unreadable` renders nothing.
   */
  payoutReadiness?: PayoutReadiness;
  /**
   * What agreeing to THIS booking will cost the supplier. Supplier surfaces
   * only — the couple's page never passes it, and must never see it.
   */
  feeForecast?: FeeDisclosure | null;
};

function statusLabelOf(status: string): string {
  return PROPOSAL_STATUS_LABEL[status as keyof typeof PROPOSAL_STATUS_LABEL] ?? status;
}

const TYPING_DEBOUNCE_MS = 700;
const TYPING_IDLE_MS = 3000;

export function ChatMessageStream({
  dealEntry,
  threadId,
  initialMessages,
  currentUserId,
  viewerRole,
  counterpartyLabel,
  eventDate = null,
  standing = null,
  decisionPayments = [],
  decisionGuestCounts = [],
  lockHandshake = null,
  initialView = 'all',
  supplierReplyActions,
  counterHref,
  reviseHref,
  lockTarget = null,
  flush = false,
  bookedStep = null,
  couplePay = null,
  supplierFirstPaymentRowId = null,
  paymentProofUrl = null,
  payoutReadiness = 'unreadable',
  feeForecast = null,
}: Props) {
  // Single Supabase client instance per mount — createClient is cheap but
  // the channel objects we attach to it must outlive each render.
  const supabase = useMemo(() => createClient(), []);

  const [messages, setMessages] = useState<ChatMessageRow[]>(initialMessages);
  const [counterpartyTyping, setCounterpartyTyping] = useState(false);

  // Proposal cards: a message with proposal_id renders as a card. We fetch the
  // proposal's display data (RLS-scoped: couple reads sent proposals on their
  // events, vendor reads their own) once per id, for both SSR + realtime rows.
  // A quote or appointment card that never arrives is indistinguishable from
  // one that was never sent, in a thread where the other person may be waiting
  // on exactly that card. This says the difference.
  const [cardsDegraded, setCardsDegraded] = useState(false);
  const [proposalCards, setProposalCards] = useState<Record<string, ProposalCardData>>({});
  useEffect(() => {
    // S5 · EVERY quote id, refetched whenever the message set changes — not
    // "each id once". A new quote landing over realtime SUPERSEDES the one
    // before it, and the old card must repaint from "Review & accept" to
    // history in the same moment; fetched-once, it kept offering accept on a
    // quote the database would already refuse. Same shape the appointment and
    // amendment cards use. One query per change, RLS-scoped.
    const ids = [...new Set(messages.map((m) => m.proposal_id).filter((x): x is string => !!x))];
    if (ids.length === 0) return;
    let cancelled = false;
    void (async () => {
      // A refused read here does not show an error — the QUOTE CARD simply
      // never appears in the thread, and both the couple and the supplier are
      // in that conversation waiting on it. The cost lands on whoever was
      // waiting, and neither of them can tell anything went wrong.
      const { data, error } = await supabase
        .from('vendor_proposals')
        .select('proposal_id, public_id, title, total_centavos, status, resolved_at, line_items')
        .in('proposal_id', ids);
      if (cancelled) return;
      if (error || !data) {
        if (error) console.error('[chat] proposal card read refused', error);
        setCardsDegraded(true);
        return;
      }
      setProposalCards((prev) => {
        const next = { ...prev };
        for (const p of data as {
          proposal_id: string;
          resolved_at: string | null;
          public_id: string;
          title: string;
          total_centavos: number;
          status: string;
          line_items: ProposalLineItem[] | null;
        }[]) {
          next[p.proposal_id] = {
            resolvedAt: p.resolved_at,
            publicId: p.public_id,
            title: p.title,
            totalCentavos: p.total_centavos,
            status: p.status,
            lineItems: p.line_items ?? [],
          };
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, supabase]);

  // Appointment cards (negotiation auto-reader Phase 1): a message with
  // appointment_id renders as a schedule request card. Fetch the appointment's
  // live display data (RLS-scoped) once per id, refetched whenever the message
  // set changes so a status flip (accept / decline / propose-new) repaints.
  const negotiationOn = chatNegotiationEnabled();
  const [appointmentCards, setAppointmentCards] = useState<Record<string, ChatAppointmentData>>({});
  /**
   * The time each meeting moved FROM, kept beside the card data rather than
   * inside it: the appointment CARD does not draw it (a card in the stream
   * shows the live time), only the Decisions entry does.
   */
  const [apptPreviousAt, setApptPreviousAt] = useState<Record<string, string | null>>({});
  useEffect(() => {
    if (!negotiationOn) return;
    const ids = [
      ...new Set(messages.map((m) => m.appointment_id).filter((x): x is string => !!x)),
    ];
    if (ids.length === 0) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('event_appointments')
        .select(
          'appointment_id, kind, type, custom_label, scheduled_at, status, initiated_by, previous_scheduled_at',
        )
        .in('appointment_id', ids);
      if (cancelled) return;
      if (error || !data) {
        if (error) console.error('[chat] appointment card read refused', error);
        setCardsDegraded(true);
        return;
      }
      const prev: Record<string, string | null> = {};
      setAppointmentCards(() => {
        const next: Record<string, ChatAppointmentData> = {};
        for (const a of data as Array<{
          appointment_id: string;
          kind: AppointmentKind;
          type: string;
          custom_label: string | null;
          scheduled_at: string | null;
          status: ChatAppointmentData['status'];
          initiated_by: ChatAppointmentData['initiated_by'];
          previous_scheduled_at: string | null;
        }>) {
          prev[a.appointment_id] = a.previous_scheduled_at;
          next[a.appointment_id] = {
            appointment_id: a.appointment_id,
            kind: a.kind,
            label: a.custom_label?.trim() || 'Meeting',
            scheduled_at: a.scheduled_at,
            status: a.status,
            initiated_by: a.initiated_by,
          };
        }
        return next;
      });
      setApptPreviousAt(prev);
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, supabase, negotiationOn]);


  // Amendment cards (negotiation Phase 3): a message with amendment_id renders a
  // bundled proposal amendment. Fetch the amendment rows + their items + the base
  // proposal totals (RLS-scoped), refetched on any message-set change so a
  // status flip / delivered stamp repaints.
  const [amendmentCards, setAmendmentCards] = useState<
    Record<string, { data: ChatAmendmentData; items: AmendmentItemView[] }>
  >({});
  useEffect(() => {
    if (!negotiationOn) return;
    const ids = [...new Set(messages.map((m) => m.amendment_id).filter((x): x is string => !!x))];
    if (ids.length === 0) return;
    let cancelled = false;
    void (async () => {
      const [{ data: amRows }, { data: itemRows }] = await Promise.all([
        supabase
          .from('proposal_amendments')
          .select('amendment_id, status, raised_by, note, base_proposal_id, locked_at')
          .in('amendment_id', ids),
        supabase
          .from('proposal_amendment_items')
          .select('item_id, amendment_id, item_kind, label, amount_php, delivered_at, sort_order')
          .in('amendment_id', ids)
          .order('sort_order', { ascending: true }),
      ]);
      if (cancelled || !amRows) return;
      const ams = amRows as Array<{
        amendment_id: string;
        status: ChatAmendmentData['status'];
        raised_by: ChatAmendmentData['raised_by'];
        note: string | null;
        base_proposal_id: string | null;
        locked_at: string | null;
      }>;
      // Base proposal totals for the "current → new total" line.
      const propIds = Array.from(
        new Set(ams.map((a) => a.base_proposal_id).filter((v): v is string => Boolean(v))),
      );
      const totalByProp = new Map<string, number>();
      if (propIds.length > 0) {
        // The amendment TOTAL is money. A refused read leaves it absent rather
        // than wrong, but absent money in a negotiation reads as "no figure
        // agreed", so the reason is captured instead of swallowed.
        const { data: props, error: propsError } = await supabase
          .from('vendor_proposals')
          .select('proposal_id, total_centavos')
          .in('proposal_id', propIds);
        if (propsError) console.error('[chat] amendment totals read refused', propsError);
        for (const p of (props ?? []) as Array<{ proposal_id: string; total_centavos: number }>)
          totalByProp.set(p.proposal_id, p.total_centavos);
      }
      const itemsByAm = new Map<string, AmendmentItemView[]>();
      for (const it of (itemRows ?? []) as Array<{
        item_id: string;
        amendment_id: string;
        item_kind: AmendmentItemView['kind'];
        label: string;
        amount_php: number | string | null;
        delivered_at: string | null;
      }>) {
        const arr = itemsByAm.get(it.amendment_id) ?? [];
        arr.push({
          item_id: it.item_id,
          kind: it.item_kind,
          label: it.label,
          amount_php: it.amount_php == null ? null : Number(it.amount_php),
          delivered_at: it.delivered_at,
        });
        itemsByAm.set(it.amendment_id, arr);
      }
      if (cancelled) return;
      setAmendmentCards(() => {
        const next: Record<string, { data: ChatAmendmentData; items: AmendmentItemView[] }> = {};
        for (const a of ams) {
          next[a.amendment_id] = {
            data: {
              amendment_id: a.amendment_id,
              status: a.status,
              raised_by: a.raised_by,
              note: a.note,
              baseTotalCentavos: a.base_proposal_id
                ? totalByProp.get(a.base_proposal_id) ?? null
                : null,
              lockedAt: a.locked_at,
            },
            items: itemsByAm.get(a.amendment_id) ?? [],
          };
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, supabase, negotiationOn]);

  // ---------------------------------------------------------------------------
  // All · Decisions · Files
  // ---------------------------------------------------------------------------
  const [view, setViewState] = useState<ThreadView>(initialView);

  /**
   * Switching views rewrites the URL IN PLACE — `replaceState`, not a
   * navigation. No server round trip, no history entry per tap (Back should
   * leave the conversation, not step back through All · Decisions · All), and
   * a reload or a shared link reopens the same third.
   */
  const setView = useCallback((next: ThreadView) => {
    setViewState(next);
    try {
      const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.history.replaceState(window.history.state, '', withThreadView(here, next));
    } catch {
      // A blocked history API costs the URL, never the view itself.
    }
  }, []);

  /**
   * THE MERGE — three sources, one timeline.
   *
   * Four of the six card markers ride on messages and are resolved above; the
   * payments and the guest-count change are page sections and arrive as props.
   * The ordering, the wording and every "now" line are decided by
   * `buildThreadDecisions` — this hook only gathers the facts.
   *
   * ⚠ `Date.now()` is read here, on the client, on purpose. "Waiting 4 days"
   * is relative to the reader's present; baking a server timestamp into it
   * would leave a tab open overnight saying yesterday's number.
   */
  const decisions = useMemo(() => {
    const ms = (iso: string | null | undefined) => {
      const t = iso ? Date.parse(iso) : NaN;
      return Number.isFinite(t) ? t : null;
    };

    const quotes = messages
      .filter((m) => m.proposal_id)
      .map((m) => {
        const card = proposalCards[m.proposal_id as string];
        if (!card) return null;
        return {
          proposalId: m.proposal_id as string,
          publicId: card.publicId,
          announcedAtMs: ms(m.created_at) ?? 0,
          title: card.title,
          // Centavo-exact. `buildThreadDecisions` prints this through
          // `formatPhp`, which keeps centavos only if they survive TO it — so a
          // quote totalling ₱187,500.50 titled its own decision card
          // "₱187,501": the figure the couple is being asked to accept, 50
          // centavos off, in the chat thread where they accept it.
          totalPhp: Math.round(card.totalCentavos) / 100,
          status: card.status,
          decidedAtMs: ms(card.resolvedAt),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    const meetings = messages
      .filter((m) => m.appointment_id)
      .map((m) => {
        const card = appointmentCards[m.appointment_id as string];
        if (!card) return null;
        return {
          appointmentId: m.appointment_id as string,
          announcedAtMs: ms(m.created_at) ?? 0,
          title: card.label,
          scheduledAtMs: ms(card.scheduled_at),
          previousScheduledAtMs: ms(apptPreviousAt[m.appointment_id as string]),
          status: card.status as string,
          initiatedBy: card.initiated_by,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    const adjustments = messages
      .filter((m) => m.amendment_id)
      .map((m) => {
        const card = amendmentCards[m.amendment_id as string];
        if (!card) return null;
        const delta = card.items.reduce((sum, it) => sum + (it.amount_php ?? 0), 0);
        return {
          amendmentId: m.amendment_id as string,
          announcedAtMs: ms(m.created_at) ?? 0,
          title: card.data.note?.trim() || 'Adjustment',
          deltaPhp: card.items.length > 0 ? delta : null,
          status: card.data.status as string,
          decidedAtMs: ms(card.data.lockedAt),
          raisedBy: card.data.raised_by,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    return buildThreadDecisions({
      viewer: viewerRole,
      nowMs: Date.now(),
      quotes,
      meetings,
      adjustments,
      payments: decisionPayments,
      guestCounts: decisionGuestCounts,
    });
  }, [
    messages,
    proposalCards,
    appointmentCards,
    apptPreviousAt,
    amendmentCards,
    viewerRole,
    decisionPayments,
    decisionGuestCounts,
  ]);

  const needsYouCount = useMemo(() => decisionsNeedingYou(decisions), [decisions]);

  /**
   * THE FILES THIRD, from `buildSharedFiles` (PR #5362) — the same builder the
   * supplier's customer card uses, fed only this conversation's attachments.
   *
   * 🔒 The link comes from `chatAttachmentHref` inside that module and nowhere
   * else. This component never touches `attachment_url` to build a URL.
   */
  const files = useMemo(() => {
    const rows = buildSharedFiles({
      contracts: [],
      handovers: [],
      chatFiles: messages
        .filter((m) => m.attachment_name || m.attachment_r2_key || m.attachment_url)
        .map((m) => ({
          message_id: m.message_id,
          sender_role: m.sender_role,
          created_at: m.created_at,
          attachment_name: m.attachment_name ?? null,
          attachment_mime: m.attachment_mime ?? null,
          attachment_size_bytes: m.attachment_size_bytes ?? null,
          attachment_r2_key: m.attachment_r2_key ?? null, // gitleaks:allow — a column name, not a key
          attachment_url: m.attachment_url ?? null,
        })),
      coupleLabel: viewerRole === 'vendor' ? counterpartyLabel : 'You',
    });
    // That builder sorts newest-first for the customer card's Files tab; this
    // view reads oldest-to-newest like the conversation it summarises.
    return [...rows].reverse();
  }, [messages, viewerRole, counterpartyLabel]);

  // In-app path back to THIS thread page — the return target for negotiation
  // server actions (appointment create / respond redirect + revalidate here).
  const returnPathFor = useCallback(
    (m: ChatMessageRow) =>
      viewerRole === 'couple'
        ? `/dashboard/${m.event_id}/messages/${threadId}`
        : `/vendor-dashboard/messages/${threadId}`,
    [viewerRole, threadId],
  );

  // Scroll management: only auto-stick to bottom if the user IS near the
  // bottom. Tracking this in a ref (not state) avoids spurious re-renders
  // every time a scroll event fires.
  const listRef = useRef<HTMLOListElement | null>(null);
  const stickToBottomRef = useRef(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Pin to the bottom on initial mount (no animation) so the user lands on
  // the latest message instead of the top of an old thread.
  useEffect(() => {
    scrollToBottom('auto');
  }, [scrollToBottom]);

  // ---------------------------------------------------------------------------
  // Postgres CHANGES subscription — new/updated messages on this thread.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const refetchAll = async () => {
      try {
        const fresh = await fetchMessages(supabase, threadId);
        if (cancelled) return;
        setMessages(fresh);
      } catch (err) {
        // Silent — Supabase auto-reconnects, the next event or refetch
        // will heal the gap. We don't want to render a scary error toast
        // for transient network blips. But we DO report so a persistent
        // fetchMessages failure (e.g. RLS / schema) is visible.
        void trackFailure({
          eventType: 'OTHER',
          elementName: 'Chat message stream refetch',
          filePath: 'app/_components/chat-message-stream.tsx',
          error: err,
          payload: { query: 'fetchMessages' },
        });
      }
    };

    const channel = supabase
      .channel(`chat-${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as ChatMessageRow;
          setMessages((prev) => {
            // Guard against the same INSERT echoing twice (e.g. on a
            // reconnect that replays the buffered event).
            if (prev.some((m) => m.message_id === row.message_id)) return prev;
            return [...prev, row].sort((a, b) =>
              a.created_at.localeCompare(b.created_at),
            );
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as ChatMessageRow;
          setMessages((prev) =>
            prev.map((m) => (m.message_id === row.message_id ? row : m)),
          );
        },
      )
      .subscribe((status) => {
        // On (re)SUBSCRIBED — including reconnects after a network drop —
        // pull a fresh batch so we backfill anything missed while offline.
        if (status === 'SUBSCRIBED') {
          void refetchAll();
        }
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, threadId]);

  // ---------------------------------------------------------------------------
  // Auto-scroll on new message (but only if the user was already at the bottom).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (stickToBottomRef.current) {
      scrollToBottom('smooth');
    }
  }, [messages, scrollToBottom]);

  /*
    Jump pills — owner, 2026-09-18: "chatbox everything inside it, and buttons
    to jump to the different latest proposals, so it can jump back on the latest
    conversation when they need to see it."

    ⚖ WHY PILLS AND NOT A PINNED BAR. The quote used to sit in a card ABOVE this
    list, and on a phone that card crushed the conversation to 32px of visible
    height against 498px of content. Anything permanently occupying the column
    costs the same rent. These are absolutely positioned over the scroller, so
    they cost NO layout height, and each only appears when its target is
    off-screen.
  */
  const latestProposalRef = useRef<HTMLLIElement | null>(null);
  // The newest quote in the thread — what "jump to the quote" means, and the
  // only card that gets the ref. Older quotes stay in place as the audit trail.
  const latestProposalId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const id = messages[i]?.proposal_id;
      if (id) return id;
    }
    return null;
  }, [messages]);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const [quoteOffScreen, setQuoteOffScreen] = useState(false);

  const recomputePills = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAwayFromBottom(distanceFromBottom > 240);
    const q = latestProposalRef.current;
    if (!q) {
      setQuoteOffScreen(false);
      return;
    }
    const lr = el.getBoundingClientRect();
    const qr = q.getBoundingClientRect();
    // Off-screen means genuinely out of the scroller's window, in either
    // direction — a quote above you is as unreachable as one below.
    setQuoteOffScreen(qr.bottom < lr.top + 8 || qr.top > lr.bottom - 8);
  }, []);

  const scrollToLatestQuote = useCallback(() => {
    latestProposalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
    recomputePills();
  }, [recomputePills]);

  // Messages arriving (or a quote landing) changes what is on screen without a
  // scroll event, so the pills have to be recomputed then too.
  useEffect(() => {
    recomputePills();
  }, [messages, proposalCards, recomputePills]);

  // ---------------------------------------------------------------------------
  // Presence channel — broadcast & receive typing state.
  // ---------------------------------------------------------------------------
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const typingActiveRef = useRef(false);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const channel = supabase.channel(`chat-presence-${threadId}`, {
      config: { presence: { key: currentUserId } },
    });

    type TypingState = {
      typing?: boolean;
      role?: 'couple' | 'vendor';
    };

    const recompute = () => {
      const state = channel.presenceState<TypingState>();
      let othersTyping = false;
      for (const [key, metas] of Object.entries(state)) {
        if (key === currentUserId) continue;
        if (metas?.some((m) => m.typing === true)) {
          othersTyping = true;
          break;
        }
      }
      setCounterpartyTyping(othersTyping);
    };

    channel
      .on('presence', { event: 'sync' }, recompute)
      .on('presence', { event: 'join' }, recompute)
      .on('presence', { event: 'leave' }, recompute)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Announce our presence with typing=false so the other side knows
          // we're connected. track() returns a promise; we don't need to
          // await it but ignoring the result triggers no-floating-promise.
          await channel.track({ typing: false, role: viewerRole });
        }
      });

    presenceChannelRef.current = channel;

    return () => {
      presenceChannelRef.current = null;
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
      typingActiveRef.current = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase, threadId, currentUserId, viewerRole]);

  const broadcastTyping = useCallback((typing: boolean) => {
    const channel = presenceChannelRef.current;
    if (!channel) return;
    typingActiveRef.current = typing;
    void channel.track({ typing, role: viewerRole });
  }, [viewerRole]);

  // Called by the send form on every keystroke. Debounces the "start
  // typing" broadcast so we don't burn presence updates on every letter,
  // and arms an idle timer to flip back to typing=false after 3s of no
  // input.
  const handleLocalTyping = useCallback(() => {
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    if (typingIdleRef.current) clearTimeout(typingIdleRef.current);

    typingDebounceRef.current = setTimeout(() => {
      if (!typingActiveRef.current) broadcastTyping(true);
    }, TYPING_DEBOUNCE_MS);

    typingIdleRef.current = setTimeout(() => {
      if (typingActiveRef.current) broadcastTyping(false);
    }, TYPING_IDLE_MS);
  }, [broadcastTyping]);

  // Called by the send form on submit — explicitly clear the typing flag
  // so the other side doesn't see a stale "still typing…" right after a
  // message lands.
  const handleSendClear = useCallback(() => {
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
    if (typingActiveRef.current) broadcastTyping(false);
  }, [broadcastTyping]);

  // Listen for the global "chat-stream:input" / "chat-stream:sent" events
  // dispatched by the surrounding form. This keeps the form a server-action
  // <form> (we don't take over send) — the stream just observes its events.
  useEffect(() => {
    const onInput = (e: Event) => {
      const detail = (e as CustomEvent<{ threadId: string }>).detail;
      if (!detail || detail.threadId !== threadId) return;
      handleLocalTyping();
    };
    const onSent = (e: Event) => {
      const detail = (e as CustomEvent<{ threadId: string }>).detail;
      if (!detail || detail.threadId !== threadId) return;
      handleSendClear();
    };
    window.addEventListener('chat-stream:input', onInput);
    window.addEventListener('chat-stream:sent', onSent);
    return () => {
      window.removeEventListener('chat-stream:input', onInput);
      window.removeEventListener('chat-stream:sent', onSent);
    };
  }, [threadId, handleLocalTyping, handleSendClear]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  // See the `flush` prop. One string, three scrollers, so the card chrome can
  // never be dropped from one view and kept on another.
  const scrollerChrome = flush ? 'px-0.5 py-3' : 'rounded-xl border border-ink/10 bg-cream p-4';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/*
        THE SWITCH — above the conversation, at every width. On a phone this
        row may be the most useful thing on the screen: the whole standing of a
        booking without scrolling a month of chat. It is never breakpoint-hidden.
      */}
      <ThreadViewSwitch
        view={view}
        onChange={setView}
        decisionsCount={decisions.length}
        needsYouCount={needsYouCount}
        filesCount={files.length}
      />

      {view === 'decisions' ? (
        <div className={`min-h-[14rem] flex-1 basis-0 overflow-y-auto ${scrollerChrome}`}>
          <DecisionsPanel
            entries={decisions}
            standing={standing}
            counterpartyLabel={counterpartyLabel}
            needsYouCount={needsYouCount}
            reply={{
              threadId,
              eventId: messages[0]?.event_id ?? '',
              vendorProfileId: messages[0]?.vendor_profile_id ?? '',
              // 🔑 THE REPLY LANDS BACK ON DECISIONS. Every reply action ends
              // in redirect(return_path); without the view in it, answering
              // the other side would drop you into the full chat after every
              // tap. The actions revalidate the bare route (lib/return-path.ts)
              // and redirect to this.
              returnPath: withThreadView(
                viewerRole === 'couple' && messages[0]
                  ? `/dashboard/${messages[0].event_id}/messages/${threadId}`
                  : `/vendor-dashboard/messages/${threadId}`,
                'decisions',
              ),
              eventDate,
              supplierActions: viewerRole === 'vendor' ? supplierReplyActions : undefined,
            }}
          />
        </div>
      ) : view === 'files' ? (
        <div className={`min-h-[14rem] flex-1 basis-0 overflow-y-auto ${scrollerChrome}`}>
          <FilesPanel files={files} />
        </div>
      ) : (
    <div className="relative flex min-h-0 flex-1 flex-col">
    <ol
      ref={listRef}
      onScroll={handleScroll}
      /*
        🔴 `min-h-[14rem]` — measured on production 2026-09-18, the first time a
        quote was ever sent on this platform.

        The thread column is a FIXED height (`h-[calc(100dvh-12rem)]` on the
        page) and this list is the only `flex-1` child, so it absorbs whatever
        its siblings leave. Siblings: a safety notice, the INQUIRING ABOUT chip,
        the tab row, a call row, the composer — and, once a supplier sends one,
        the CURRENT QUOTE card, which is unbounded and tall.

        With a quote present the list measured **clientHeight 32px against
        scrollHeight 498px**: the whole conversation, squeezed into a sliver the
        owner described as "the chatbox shrunk".

        🔑 IT WAS UNREACHABLE UNTIL TODAY. The card only renders when a quote
        exists, and no quote had ever been sent — so the layout was correct for
        every state anyone had been able to reach.

        A floor, not a fixed height: the list still grows into spare room and
        still scrolls internally. When the column genuinely cannot fit
        everything, the page scrolls instead of crushing the conversation to
        nothing.

        🔴 `basis-0` (2026-09-19) — the floor alone did not reach the frame:
        every wrapper above this list is `min-h-0`, so with "Send a quote" open
        the wrapper measured 0px tall and this list spilled over the quote
        builder. The frame (`chat/chat-box.tsx`) now keeps its automatic
        minimum, and `basis-0` makes that minimum count THIS FLOOR rather than
        the whole thread. Same on the Decisions and Files scrollers above.
      */
      className={`min-h-[14rem] flex-1 basis-0 space-y-2 overflow-y-auto ${scrollerChrome}`}
      aria-live="polite"
      aria-relevant="additions"
    >
      {cardsDegraded ? (
        <li className="rounded-md border border-warn-200/60 bg-warn-50/60 px-3 py-2 text-xs text-warn-900">
          Some quote or appointment cards in this conversation couldn&rsquo;t be loaded, so
          they&rsquo;re missing below. <strong>Nothing has been withdrawn or cancelled</strong>
          — reload to see them.
        </li>
      ) : null}
      {messages.length === 0 ? (
        <li className="rounded-md border border-dashed border-ink/15 bg-cream p-6 text-center text-sm text-ink/55">
          No messages yet — say hi to break the ice.
        </li>
      ) : (
        messages.map((m) => {
          // Proposal cards — a vendor-sent structured proposal lands in the
          // thread. Render the card (title · price · status + a Review/View
          // link to the existing /proposals page) instead of a plain bubble;
          // fall back to the message body until the card data loads.
          if (m.proposal_id) {
            const card = proposalCards[m.proposal_id];
            /*
              The quote now lives HERE, in the conversation, and nowhere else.
              It used to be duplicated into a pinned card above the list, which
              on a phone crushed the whole conversation to 32px of visible
              height — the owner's "the chatbox shrunk". A negotiation reads as
              quote → counter → counter-back, so the quote belongs in that
              order, not floating above it.
            */
            const isLatestProposal = m.proposal_id === latestProposalId;
            const items = (card?.lineItems ?? []).filter((li) => li.label?.trim());
            /*
              S5 · WHAT THIS CARD MAY OFFER is decided ONCE, in
              `quoteCardState`, from the quote's status, whether it is the
              latest, who is looking, and the lock handshake. Owner, live,
              2026-09-18: the card read "₱10,170 · Accepted" and still offered
              "Review & accept". The label used to be chosen by the viewer
              alone. Now: pending → Review & accept (couple) / Update this
              quote (supplier); accepted → no accept, a Lock pointer (couple);
              superseded or any earlier quote → history, view only.
            */
            const quoteState = card
              ? quoteCardState({
                  status: card.status,
                  isLatest: isLatestProposal,
                  viewer: viewerRole,
                  handshake: lockHandshake?.state ?? null,
                })
              : null;
            return (
              <li
                key={m.message_id}
                ref={isLatestProposal ? latestProposalRef : undefined}
                className="flex justify-center"
              >
                <div
                  className={`w-full max-w-[92%] rounded-xl border p-3 ${
                    quoteState?.history
                      ? 'border-ink/15 bg-ink/[0.03] opacity-80'
                      : 'border-terracotta/40 bg-terracotta/[0.06]'
                  }`}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
                    📄 Proposal
                  </p>
                  {card && quoteState ? (
                    <>
                      <p className="mt-1 text-sm font-semibold text-ink">{card.title}</p>
                      <p className="text-sm text-ink/70">
                        {card.totalCentavos > 0
                          ? formatCentavos(card.totalCentavos)
                          : 'Price on request'}
                        {/* Owner, live 2026-09-20: "₱16,750 · Accepted ·
                            Accepted · booked". When the note below already
                            opens with the status, the price line does not
                            repeat it. */}
                        {quoteState.note?.startsWith(statusLabelOf(card.status))
                          ? null
                          : ` · ${statusLabelOf(card.status)}`}
                      </p>
                      {quoteState.note ? (
                        <p className="mt-0.5 text-xs text-ink/60">{quoteState.note}</p>
                      ) : null}
                      {viewerRole === 'vendor' &&
                      isLatestProposal &&
                      card.status === 'accepted' ? (
                        <PayoutMethodNudge readiness={payoutReadiness} context="lock" />
                      ) : null}
                      {items.length > 0 ? (
                        <ul className="mt-2 space-y-0.5 border-t border-terracotta/20 pt-2 text-xs text-ink/70">
                          {items.slice(0, 5).map((li, i) => (
                            <li key={i} className="flex items-baseline justify-between gap-3">
                              <span className="min-w-0 truncate">
                                {li.label}
                                {li.detail ? (
                                  <span className="text-ink/45"> · {li.detail}</span>
                                ) : null}
                              </span>
                              <span className="shrink-0 tabular-nums">
                                {typeof li.amount_centavos === 'number'
                                  ? formatCentavos(li.amount_centavos)
                                  : 'Complimentary'}
                              </span>
                            </li>
                          ))}
                          {items.length > 5 ? (
                            <li className="text-ink/45">
                              + {items.length - 5} more in the full quote
                            </li>
                          ) : null}
                        </ul>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Link
                          href={`/proposals/${card.publicId}`}
                          className={
                            quoteState.primary.kind === 'review_accept'
                              ? 'inline-flex h-9 items-center rounded-lg bg-mulberry px-4 text-sm font-medium text-cream hover:bg-mulberry-600'
                              : 'inline-flex h-9 items-center rounded-lg border border-ink/20 px-4 text-sm font-medium text-ink/75 hover:bg-ink/[0.04]'
                          }
                        >
                          {quoteState.primary.label}
                        </Link>
                        {/*
                          S5 · the couple's ONE next step on an accepted quote,
                          performed HERE (owner 2026-09-19). The same component
                          and server action as the bench, so the confirm step,
                          the lock-impact text and every error arrive intact.
                          On success the button reports what happened and
                          refreshes the page, and the rule above re-reads the
                          handshake: the card's note turns to "you have asked
                          them to lock" and this button stops being offered. On
                          failure the button's own role="alert" line renders.
                        */}
                        {quoteState.offerLock && lockTarget ? (
                          lockTarget.groupId ? (
                            <AccordionLockButton
                              eventId={lockTarget.eventId}
                              groupId={lockTarget.groupId}
                              groupLabel={lockTarget.groupLabel}
                              vendorId={lockTarget.vendorId}
                              vendorName={counterpartyLabel}
                              label={
                                isLockHandshakeEnabled()
                                  ? `🔒 Ask ${counterpartyLabel} to lock`
                                  : `🔒 Lock ${counterpartyLabel}`
                              }
                              pendingLabel={isLockHandshakeEnabled() ? 'Asking…' : 'Locking…'}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-mulberry px-4 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-60"
                              wrapperClassName="flex w-full flex-col items-start"
                              source="chat_quote_card"
                            />
                          ) : (
                            <Link
                              href={lockTarget.benchHref}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-mulberry px-4 text-sm font-medium text-cream hover:bg-mulberry-600"
                            >
                              🔒 Lock on your Vendors page
                            </Link>
                          )
                        ) : null}
                        {/*
                          THE OTHER END OF THE SAME CONNECTION (owner, live as
                          the supplier, 2026-09-19: "there is no agree and
                          confirm booking"). The couple's ask above has exactly
                          one answer: the supplier's Agree / Turn it down, the
                          SAME two actions the Overview posts, handed in by the
                          supplier's page. The couple's page never passes them.
                        */}
                        {quoteState.offerLockAnswer &&
                        supplierReplyActions?.agreeLock &&
                        supplierReplyActions?.declineLock &&
                        lockHandshake?.eventVendorId ? (
                          <LockAnswerForms
                            eventVendorId={lockHandshake.eventVendorId}
                            returnTo={`/vendor-dashboard/messages/${threadId}`}
                            agreeLock={supplierReplyActions.agreeLock}
                            declineLock={supplierReplyActions.declineLock}
                            feeForecast={feeForecast}
                          />
                        ) : null}
                        {/*
                          S5 · the supplier revises by sending a NEW quote that
                          supersedes this one (owner, option a). Only on the
                          live quote, never once the couple has asked to lock.
                        */}
                        {quoteState.offerRevise && reviseHref ? (
                          <Link
                            href={reviseHref}
                            className="inline-flex h-9 items-center rounded-lg border border-mulberry/40 px-4 text-sm font-medium text-mulberry hover:bg-mulberry/[0.06]"
                          >
                            Update this quote
                          </Link>
                        ) : null}
                        {/*
                          🔴 A QUOTE IS NOT TAKE-IT-OR-LEAVE-IT. Owner,
                          2026-09-18: "so it should not be just review and
                          accept." The amendment builder — proposal_amendments,
                          its db tests, the whole negotiation loop — has shipped
                          for some time behind the composer's "Deal or meeting"
                          button, below the fold and named after neither
                          countering nor quoting. A couple reading ₱10,170 with
                          one button assumes those are the terms.
                        */}
                        {/*
                          A HREF, not a callback: this page is a server
                          component and cannot hand a function across the
                          boundary. The link opens the composer's existing
                          amendment builder via `?compose=deal`, so the counter
                          is also shareable and survives a reload.
                        */}
                        {counterHref ? (
                          // S5 · only on the LIVE, still-pending quote; an
                          // accepted or superseded quote is not countered.
                          quoteState.offerCounter ? (
                            <Link
                              href={counterHref}
                              className="inline-flex h-9 items-center rounded-lg border border-mulberry/40 px-4 text-sm font-medium text-mulberry hover:bg-mulberry/[0.06]"
                            >
                              Counter-offer
                            </Link>
                          ) : null
                        ) : null}
                      </div>
                      {/*
                        THE NEXT MONEY STEP — only on the live, accepted quote
                        of a BOOKED supplier. One line from `moneyStepLine`,
                        then the existing control for whoever acts next: the
                        couple's "Amount to pay" card (mounted), or the
                        supplier's Confirm (the payment card's own action).
                      */}
                      {isLatestProposal &&
                      card.status === 'accepted' &&
                      bookedStep &&
                      bookedStep.kind !== 'not_booked' ? (
                        <div className="mt-3 space-y-2 border-t border-terracotta/20 pt-2">
                          <p className="text-sm font-medium text-ink">
                            {moneyStepLine(bookedStep, viewerRole, counterpartyLabel)}
                          </p>
                          {viewerRole === 'couple' && couplePay ? (
                            <DepositReservation {...couplePay} step={bookedStep} compact />
                          ) : null}
                          {/* ⚖ LOOK BEFORE YOU CONFIRM. The receipt goes ABOVE
                              the button, because this is the moment the supplier
                              decides whether a couple's money arrived and the
                              only thing they had to go on was a sentence. */}
                          {viewerRole === 'vendor' &&
                          bookedStep.kind === 'first_payment_sent' &&
                          paymentProofUrl ? (
                            <ProofImage
                              url={paymentProofUrl}
                              alt="The payment proof the couple sent"
                            />
                          ) : null}
                          {viewerRole === 'vendor' &&
                          bookedStep.kind === 'first_payment_sent' &&
                          supplierFirstPaymentRowId &&
                          supplierReplyActions?.confirmPayment ? (
                            <form action={supplierReplyActions.confirmPayment}>
                              <input type="hidden" name="payment_id" value={supplierFirstPaymentRowId} />
                              <input type="hidden" name="thread_id" value={threadId} />
                              <button
                                type="submit"
                                className="inline-flex h-9 items-center rounded-lg bg-mulberry px-4 text-sm font-medium text-cream hover:bg-mulberry-600"
                              >
                                Confirm it reached you
                              </button>
                            </form>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink/80">
                      {m.body}
                    </p>
                  )}
                  <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                    {formatChatTimestamp(m.created_at)}
                  </p>
                </div>
              </li>
            );
          }
          // Appointment cards (negotiation Phase 1): a message with
          // appointment_id renders the schedule request card with the
          // counterparty's accept / propose-new-time / decline actions. Falls
          // back to the message body until the appointment data loads. Only when
          // the flag is on — off, it degrades to a plain bubble (body is a
          // readable "📅 Meeting request: …").
          if (negotiationOn && m.appointment_id) {
            const appt = appointmentCards[m.appointment_id];
            return (
              <li key={m.message_id} className="flex justify-center">
                {appt ? (
                  <ChatAppointmentCard
                    data={appt}
                    viewerRole={viewerRole}
                    eventId={m.event_id}
                    vendorProfileId={m.vendor_profile_id}
                    returnPath={returnPathFor(m)}
                    eventDate={eventDate}
                  />
                ) : (
                  <div className="w-full max-w-[92%] rounded-xl border border-terracotta/40 bg-terracotta/[0.06] p-3">
                    <p className="whitespace-pre-wrap break-words text-sm text-ink/80">{m.body}</p>
                  </div>
                )}
              </li>
            );
          }
          // Amendment cards (negotiation Phase 3): a message with amendment_id
          // renders the bundled proposal amendment (current-vs-requested, accept
          // / counter / decline + checklist). Falls back to the body until data
          // loads; degrades to a plain bubble when the flag is off.
          if (negotiationOn && m.amendment_id) {
            const am = amendmentCards[m.amendment_id];
            return (
              <li key={m.message_id} className="flex justify-center">
                {am ? (
                  <ChatAmendmentCard
                    data={am.data}
                    items={am.items}
                    viewerRole={viewerRole}
                    threadId={threadId}
                    returnPath={returnPathFor(m)}
                    counterpartyLabel={counterpartyLabel}
                    lockHandshake={lockHandshake}
                  />
                ) : (
                  <div className="w-full max-w-[92%] rounded-xl border border-mulberry/30 bg-mulberry/[0.06] p-3">
                    <p className="whitespace-pre-wrap break-words text-sm text-ink/80">{m.body}</p>
                  </div>
                )}
              </li>
            );
          }
          // A service the supplier OFFERED renders as the card they built —
          // cover photograph, showcase clip, price, what is included (migration
          // 20271214894972). Owner 2026-09-09: "the service card of each
          // service still needs that photo/image/video." It replaced a single
          // word in the "Inquiring about" chip row, which was the bare category
          // on every service that ships today.
          //
          // Deliberately NOT behind NEXT_PUBLIC_CHAT_NEGOTIATION_V1: the offer
          // control this serves has shipped since 2026-06-12, so gating the card
          // would leave the old chip-row behaviour live in production. The card
          // component fetches its own data and draws the message body until it
          // arrives, so a slow or refused resolve still reads as an offer.
          if (m.offered_service_id) {
            return (
              <li key={m.message_id} className="flex justify-center">
                <ChatOfferedServiceCard
                  messageId={m.message_id}
                  fallbackBody={m.body}
                />
              </li>
            );
          }
          // System messages (e.g. the Build re-quote nudge) are automated
          // Setnayan notes — centered, owned by neither side, labelled
          // "Setnayan". Never "from the couple"/"from the vendor".
          if (m.sender_role === 'system') {
            return (
              <li key={m.message_id} className="flex justify-center">
                <div className="max-w-[90%] rounded-xl border border-mulberry/20 bg-mulberry/[0.06] px-3 py-2 text-center text-sm text-ink">
                  {/* renderPerkUnlock: an old perk line stored with markdown
                      and a raw card key reads in today's words; any other
                      system body is unchanged. */}
                  <p className="whitespace-pre-wrap break-words">{renderPerkUnlock(m.body ?? '')}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-mulberry/70">
                    Setnayan · {formatChatTimestamp(m.created_at)}
                  </p>
                </div>
              </li>
            );
          }
          return (
            <li
              key={m.message_id}
              className={`flex flex-col ${ownsBubble(m, viewerRole) ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  ownsBubble(m, viewerRole)
                    ? 'bg-terracotta text-cream'
                    : 'bg-ink/[0.06] text-ink'
                }`}
              >
                {m.body ? (
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                ) : null}
                {/* 🔒 NEVER THE STORED VALUE. Since 2026-09-09 the row carries a
                    PRIVATE stored-asset ref, not a public URL, so the file is
                    fetched through a route that re-proves this viewer is a
                    party to the thread on every request. `attachment_url` is
                    the legacy public column — no writer has set it since, and
                    prod never had a row that used it, but a stored value there
                    is still somebody's file, so it keeps a way in. */}
                {m.attachment_r2_key || m.attachment_url ? (
                  <AttachmentBlock
                    url={`/api/chat/attachment/${m.message_id}`}
                    name={m.attachment_name ?? null}
                    mime={m.attachment_mime ?? null}
                    sizeBytes={m.attachment_size_bytes ?? null}
                    owns={ownsBubble(m, viewerRole)}
                    hasBody={!!m.body}
                  />
                ) : null}
                <p
                  className={`mt-1 font-mono text-[10px] uppercase tracking-[0.15em] ${
                    ownsBubble(m, viewerRole) ? 'text-cream/70' : 'text-ink/50'
                  }`}
                >
                  {/* AI-disclosure label (vendor-autoreply §2B): a bot message
                      is NEVER presented as a human. The couple sees it under
                      the vendor's name with an explicit AI tag; the vendor
                      sees the same tag instead of "You" (it wasn't them).
                      Copy is the §8 candidate string, pending owner sign-off. */}
                  {m.is_bot
                    ? viewerRole === 'vendor' && ownsBubble(m, viewerRole)
                      ? '⚡ AI auto-reply'
                      : `⚡ AI auto-reply · ${counterpartyLabel}`
                    : ownsBubble(m, viewerRole)
                      ? 'You'
                      : counterpartyLabel}
                  {' · '}
                  {formatChatTimestamp(m.created_at)}
                </p>
              </div>
              {/* Negotiation auto-reader (Phase 1): under the sender's OWN
                  message, if the deterministic reader flags a meeting topic,
                  offer a one-tap "set up this meeting" chip. Suggestion-grade —
                  nothing is created until they tap + confirm. Flag-gated. */}
              {negotiationOn &&
              ownsBubble(m, viewerRole) &&
              !m.proposal_id &&
              !m.appointment_id &&
              !m.change_order_id &&
              !m.amendment_id &&
              m.body &&
              detectNegotiation(m.body).primary === 'schedule' ? (
                <ScheduleSuggestChip
                  threadId={threadId}
                  returnPath={returnPathFor(m)}
                  body={m.body}
                  eventDate={eventDate}
                />
              ) : null}
              {/* Phase 3: bundled "request proposal changes" chip under the
                  sender's own message (supersedes the P2 single-item chip for
                  creating new changes; existing change-order cards still
                  resolve). Opens the multi-item amendment builder. */}
              {negotiationOn &&
              dealEntry.offerDeal &&
              ownsBubble(m, viewerRole) &&
              !m.proposal_id &&
              !m.appointment_id &&
              !m.change_order_id &&
              !m.amendment_id &&
              m.body ? (
                <AmendmentSuggestChip
                  threadId={threadId}
                  returnPath={returnPathFor(m)}
                  body={m.body}
                />
              ) : null}
            </li>
          );
        })
      )}
      {counterpartyTyping ? (
        <li className="flex justify-start" data-testid="typing-indicator">
          <div className="inline-flex items-center gap-1 rounded-full bg-ink/[0.06] px-3 py-1 text-xs text-ink/60">
            <span className="sr-only">{counterpartyLabel} is typing</span>
            <span aria-hidden>{counterpartyLabel} is typing</span>
            <span aria-hidden className="ml-1 inline-flex gap-0.5">
              <span className="h-1 w-1 animate-pulse rounded-full bg-ink/40" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-ink/40 [animation-delay:120ms]" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-ink/40 [animation-delay:240ms]" />
            </span>
          </div>
        </li>
      ) : null}
    </ol>

      {/*
        Jump pills. Absolutely positioned OVER the scroller, so they occupy no
        layout height — the whole point, after a pinned quote card cost this
        conversation all but 32px of its own column on a phone. Each appears
        only when its target is out of view.
      */}
      {quoteOffScreen && latestProposalId ? (
        <button
          type="button"
          onClick={scrollToLatestQuote}
          className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full border border-terracotta/40 bg-cream/95 px-3 py-1 text-xs font-medium text-terracotta shadow-sm backdrop-blur hover:bg-cream"
        >
          📄 Jump to the quote
        </button>
      ) : null}
      {awayFromBottom ? (
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full border border-ink/15 bg-cream/95 px-3 py-1 text-xs font-medium text-ink/70 shadow-sm backdrop-blur hover:bg-cream"
        >
          ↓ Latest messages
        </button>
      ) : null}
    </div>
      )}
    </div>
  );
}

function ownsBubble(
  m: { sender_role: ChatSenderRole },
  viewerRole: 'couple' | 'vendor',
): boolean {
  return m.sender_role === viewerRole;
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

/**
 * Renders an in-bubble attachment. Image MIMEs get a lazy <img> thumbnail that
 * links to the full-size file; everything else (PDF / doc) renders a compact
 * file chip with the name, size, and an open/download link. The bytes live on
 * public R2 (chat file sharing, PR 2) — signed-URL hardening is a follow-up.
 */
function AttachmentBlock({
  url,
  name,
  mime,
  sizeBytes,
  owns,
  hasBody,
}: {
  url: string;
  name: string | null;
  mime: string | null;
  sizeBytes: number | null;
  owns: boolean;
  hasBody: boolean;
}) {
  const isImage = (mime ?? '').startsWith('image/');
  const label = name?.trim() || (isImage ? 'Image' : 'Attachment');
  const size = formatBytes(sizeBytes);

  if (isImage) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`block overflow-hidden rounded-xl ${hasBody ? 'mt-2' : ''}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded R2 asset; next/image needs a configured loader/domain for arbitrary R2 hosts */}
        <img
          src={url}
          alt={label}
          loading="lazy"
          className="max-h-64 max-w-full rounded-xl object-cover"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={name ?? undefined}
      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${
        hasBody ? 'mt-2' : ''
      } ${
        owns
          ? 'bg-cream/20 text-cream hover:bg-cream/30'
          : 'bg-ink/[0.06] text-ink hover:bg-ink/10'
      }`}
    >
      <FileText className="h-5 w-5 shrink-0 opacity-80" strokeWidth={1.75} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        {size ? (
          <span className={`block text-[11px] ${owns ? 'text-cream/70' : 'text-ink/55'}`}>
            {size}
          </span>
        ) : null}
      </span>
      <Download className="h-4 w-4 shrink-0 opacity-70" strokeWidth={1.75} />
    </a>
  );
}
