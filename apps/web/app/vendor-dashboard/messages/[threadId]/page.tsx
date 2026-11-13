import Link from 'next/link';
import { resolveFeeEnforcement } from '@/lib/vendor-event-fee-access.server';
import { readWordsOnlyTopUp } from '@/lib/booking-fee-top-up.server';
import { TOP_UP_WORDS } from '@/lib/booking-fee-top-up';
import { manilaToday as manilaTodayYmd } from '@/lib/std-views';
import { notFound, redirect } from 'next/navigation';
import { CalendarDays, Send, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ServerTimer } from '@/lib/server-timing';
import { createAdminClient } from '@/lib/supabase/admin';
import { readBookedMoney } from '@/lib/booked-money-step.server';
import { readSupplierPayoutReadiness } from '@/lib/vendor-payment-methods.server';
import type { PayoutReadiness } from '@/lib/deposit-pay-step';
import { giftBasisFrom } from '@/lib/papic-on-a-quote';
import { fetchShopGiftQuoteBasis } from '@/lib/shop-gifts.server';
import { readQuoteDoors, type QuoteDoors } from '@/lib/quote-doors.server';
import { fetchVendorPaysGiftPrice } from '@/lib/setnayan-gift.server';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { openRailOptions } from '@/lib/payment-channels';
import { isVendorPapicCaptureEnabled } from '@/lib/vendor-dayof-flags';
import { isStoreShellRequest } from '@/lib/request-platform';
import { resolvePapicQuoteStanding } from '@/lib/papic-on-a-quote.server';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  fetchMessages,
  fetchReturningClientFlags,
  fetchLeadTrustActivePlanner,
  fetchThreadById,
  fetchVendorThreads,
  formatChatTimestamp,
} from '@/lib/chat';
import { leadTrustBadgeEnabled } from '@/lib/inquiry-gate';
import { eventHostHoldsFounderSeat } from '@/lib/entitlements';
import { FOUNDER_BADGE_LABEL, FOUNDER_INQUIRY_NOTE } from '@/lib/founder-seats';
import { inquiryCityLabel } from '@/lib/inquiry-customer.server';
import { readVendorConversationInputs } from '@/lib/vendor-conversation-inputs.server';
import { buildCustomerEventSummary } from '@/lib/customer-event-summary';
import {
  guestCountChip,
  guestCountLine,
  type GuestCounts,
} from '@/lib/guest-count-provenance';
import {
  fetchVendorDateDemand,
  vendorDateDemandLine,
  vendorDateDemandNote,
} from '@/lib/vendor-date-demand';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { displayServiceLabel } from '@/lib/vendors';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { readSupplierEventLines } from '@/lib/supplier-event-lines.server';
import { EventLinesBody, InquiryAnswers } from '../../_components/event-lines';
import { InfoTip } from '@/app/_components/info-tip';
import { VENDOR_PACKAGE_SELECT } from '@/lib/vendor-packages';
import { fetchOwnPaymentMethods } from '@/lib/vendor-payment-methods';
import { sendChatMessage, acceptInquiry, declineInquiry, markThreadRead } from '@/lib/chat-actions';
import { formatLongDate } from '@/lib/format-date';
import { fetchPipelinePressure } from '@/lib/vendor-pipeline-pressure';
import { PipelinePressureLine } from '../../_components/pipeline-pressure-line';
import { getThreadBlockState } from '@/lib/chat-block';
import { fetchThreadLockHandshake } from '@/lib/thread-lock-handshake.server';
import { readThreadReceipts } from '@/lib/chat-thread-receipts.server';
import { ThreadInterestChips } from '@/app/_components/thread-interest-chips';
import { fetchThreadInterests } from '@/lib/thread-interests';
import { fetchVendorServices } from '@/lib/vendor-services';
import { fetchAddonsByService } from '@/lib/vendor-service-addons';
import type { QuoteCardOption } from '@/app/_components/proposal-maker';
import { briefForQuote } from '@/lib/quote-event-brief';
import { chatHostsFrom, type ChatHost } from '@/lib/chat-hosts';
import { QUOTE_VERSION_SELECT, type QuoteVersionRow } from '@/lib/quote-versions';
import { askedOnce } from '@/lib/request-once';
import { MarkReadWhenShown } from './_components/mark-read-when-shown';
import { chatNegotiationEnabled } from '@/lib/chat-negotiation-flag';
import type { PinFact } from '@/lib/chat-pins';
import { readChatPinFacts, type ChatPinRead } from '@/lib/chat-pin-facts.server';
import { BLOCKER_OF, firstBlocker } from '@/lib/chat-pin-facts';
import { decisionPinBodies } from '@/app/_components/chat/decision-pin-bodies';
import { schedulePinBodies } from '@/app/_components/chat/schedule-pin-bodies';
import { ActionButton } from '@/components/action-button';
import { manilaTodayIsoFor } from '@/lib/quote-valid-until';
import { threadDecisionFacts, type DecisionCards, type DecisionQuoteCard } from '@/lib/thread-decisions';
import { DetailsDecisionsList } from '../../clients/[eventId]/_components/details-decisions-list';
import { fetchBudgetBands } from '@/lib/budget-bands-read';
import { bandMedianPerHeadPhp } from '@/lib/budget-band-money';
import { isFeeUnlocksEventEnabled } from '@/lib/event-access-stage';
import { FEEL_OPTIONS } from '@/lib/match-criteria';
import { CEREMONY_TYPE_TO_FAITH } from '@/lib/taxonomy-filters';
import { isCanonicalService, VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import { resolveLivePax, fetchVendorPaxProposals } from '@/lib/pax';
import { standingQuoteFollowsGuestList } from '@/lib/quote-pax-follow.server';
import {
  fetchThreadPayments,
  paxProposalsToGuestCounts,
  fetchLiveQuoteTotalPhp,
} from '@/lib/thread-decision-sources.server';
import { buildSupplierStanding } from '@/lib/supplier-standing';
import {
  fetchPendingVendorPayments,
  fetchPlanProgressForVendor,
} from '@/lib/vendor-service-payment-schedules.server';
import { acceptPaxSurcharge, declinePaxSurcharge } from './pax-actions';
import { confirmVendorPayment, refuseVendorPayment } from './pay-confirm-actions';
import { vendorAgreeToLock, vendorDeclineLock, vendorWaitlistTheAsk } from '../../clients/[eventId]/actions';
import { readDayCheck } from '@/lib/day-check.server';
import { heldServiceOfAsk } from '@/lib/service-plan-hold.server';
import {
  forecastForBooking,
  resolveBookingFeeStanding,
} from '@/lib/booking-fee-disclosure.server';
import { lockAgreeFeeHeld, lockAgreeHalls, lockAgreeNotice, lockDeclineNotice } from '@/lib/lock-answer-notice';
import { parseThreadView } from '@/lib/thread-view';
import { VendorPaymentLive } from './_components/vendor-payment-live';
// ⚡ The heavy client parts load on demand (`./_components/on-demand.tsx`): the same components under the same names,
// each in its own chunk — server-rendered and preloaded where they are on screen, so this page paints as before, and
// out of the picked client's first load (Details' Decisions renders this page).
import {
  ChatInfoRailTrigger,
  ChatMessageStream,
  ChatPrivacyNotice,
  ChatSendForm,
  ChatThreadMenu,
  ConversationColumn,
  InquiryOutcomeCapture,
  NegotiationComposerMenu,
  ProposalMaker,
  QuoteVersionLine,
  SendProposalCard,
  ThreadToolsSheet,
  VendorEventDayPrepCta,
  VendorOfferService,
} from './_components/on-demand';
import type { VendorOfferOption } from './_components/vendor-offer-service';
import { OUTCOME_NOTICE } from './_lib/outcome-notice';
import { DEMO_EVENT_BOOKS_DEMO_SHOPS_ONLY, DEMO_SHOP_CANNOT_BE_BOOKED } from '@/lib/demo-scope';
import { ChatThreadFrame } from '@/app/_components/chat/chat-thread-frame';
import { ChatBox } from '@/app/_components/chat/chat-box';
import { ChatThreadHead } from '@/app/_components/chat/chat-thread-head';
import { BookedCallButtons } from '@/app/_components/chat/booked-call-buttons';
import { ChatPrivacyTip } from '@/app/_components/chat-privacy-notice';
import { bookedCounterpartyPhone, shopIsBookedOnEvent } from '@/lib/shop-booking.server';
import { BackButton } from '@/app/_components/back-button';
import { eventChatTitle, eventDateOptionWords } from '@/lib/event-chat-title';
import { ThreadToolPanel } from '@/app/_components/chat/thread-tool-panel';
import { affordancePanelId } from '@/lib/chat-box-tools';
import { dealEntryFor, threadHasQuote } from '@/lib/deal-entry';
import {
  seedQuoteRevision,
  QUOTE_REVISION_SELECT,
  type QuoteRevisionSeed,
  type QuoteRevisionSource,
} from '@/lib/quote-revision-seed';
import {
  buildVendorConversationRows,
  initialsFor,
  readStandingExtras,
} from '@/lib/conversation-list';
import { THREAD_STAGE_HAS_AGREEMENT, VENDOR_THREAD_PANELS } from '@/lib/vendor-thread-tools';
import { QuestionsSendPanel } from './_components/questions-send-panel';
import { CHAT_ATTACH_INPUT_ID } from '@/lib/chat-attach-input-id';
import { QuickReplies, quickRepliesFor, ThreadAnswerLine } from './_components/thread-answer-line';
import { BlockerChangeRow } from '@/app/_components/chat/blocker-change-row';
import { LockRequestAnswer } from '../../clients/[eventId]/_components/booking-ask-panel';
import { readThreadDayAnswer } from '@/lib/thread-day-answer.server';
import type { ThreadDayAnswer } from '@/lib/thread-day-answer';
import { manilaDate } from '@/lib/vendor-schedule';
import { SubmitButton } from '@/app/_components/submit-button';
import { interestLabeller } from '@/lib/thread-interest-labels.server';
import {
  deriveThreadStage,
  THREAD_STAGE_LABEL,
  THREAD_STAGE_TONE,
} from '@/lib/vendor-thread-stage';
import { closingCopy } from '@/lib/thread-closing-copy';
import { fetchReasonCodes } from '@/lib/inquiry-outcomes';
import { regionLabel } from '@/lib/region-source';
import { eventTypeLabel } from '@/lib/demand-radar';
import type { OutcomeReasonOption } from './_components/inquiry-outcome-capture';
import {
  inquirySourceLabel,
  RETURNING_CUSTOMER_LABEL,
} from '@/lib/inquiry-source';
import {
  fetchThreadAttribution,
  fetchInquirerCollabActive,
  type ThreadAttribution,
} from '@/lib/inquiry-attribution';
import { cardKindLabeller } from '@/lib/card-kind-labeller';
import { formatCount } from '@/lib/format-number';

export const metadata = { title: 'Thread · Supplier' };

type Props = {
  params: Promise<{ threadId: string }>;
  searchParams?: Promise<{
    notice?: string;
    view?: string | string[];
    compose?: string;
    /** The RPC status of a booking-ask answer given from this thread's quote card. */
    lock_agree?: string;
    /** `held` — the couple's news waits on the booking fee (`vendorAgreeToLock`). */
    fee?: string;
    lock_decline?: string;
    /** `hall_taken` — the card's taken halls and the free ones to offer (`lockAgreeHallsParam`). */
    taken?: string;
    free?: string;
    competing?: string;
    /**
     * THE ONE BUILD (8 Nov 2026) — INTERNAL, set only by `SupplierThreadBody` (`_components/supplier-thread-body.tsx`):
     * the SAME thread, drawn inside the picked client's page instead of full screen. `chat` = the conversation
     * without the full-screen frame (no conversation list, the client's pinned row is the head); `quotation` = the
     * quote builder alone, seeded from the live quote. One body, one read path — never a second copy of these reads.
     * Build 2 #42: `decisions` = the Decisions list on the picked client's Details page, from the SAME one draw.
     */
    __embed?: string;
  }>;
};

const PROPOSAL_NOTICE: Record<string, string> = {
  proposal_sent: 'Quote sent — it’s in the conversation below.',
  proposal_failed: 'Couldn’t send that quote. Please try again.',
  proposal_needs_template: 'Pick a template to send a quote.',
  proposal_tier_free: 'Get your account verified to send quotes to couples.',
  proposal_sent_no_card: 'Quote sent — find it in your Quotes list (the in-chat card didn’t post).',
  // RW-24: it names the way through, and says the quote is kept (`quoteSentKey` in the maker).
  proposal_thread_closed:
    'Say yes to this inquiry first — a quote goes on an open conversation. Nothing was sent; your quote is kept on this device.',
  // S5 · a new quote would replace an ACCEPTED one that the booking already
  // rests on. Name the door that IS open instead of saying "failed".
  proposal_deal_locked:
    'This booking is already locked at the accepted quote — changes to it go through a change order, not a new quote.',
  proposal_gift_refused:
    'Your gifts on that quote didn’t fit — over this booking’s gift limit, or more than your stock. Check them and send again.',
  // 📅 No lifetime quotation (2026-11-09).
  proposal_needs_valid_until: 'Pick how long this quote is valid before you send it — nothing was sent.',
  proposal_plan_not_in_full: 'The payment plan must pay the whole quote — nothing was sent.',
  // 🧪 The demo rule (lib/demo-scope.ts) — the same sentences the rule itself uses, plus "nothing was sent".
  proposal_demo_shop: `${DEMO_SHOP_CANNOT_BE_BOOKED} Quotes from a demo shop go only to demo events — nothing was sent.`,
  proposal_demo_event: `${DEMO_EVENT_BOOKS_DEMO_SHOPS_ONLY} Nothing was sent.`,
  proposal_lock_requested:
    'The couple has asked to lock at the quote they accepted. Agree or decline that request on your Today page first — a new quote can’t replace it while it’s open.',
  // Won & Lost Reasons capture (Wave 6) — its words live in `_lib/outcome-notice.ts`, shared with the stay door.
  ...OUTCOME_NOTICE,
};

/** The picked client's three embeds of this thread (Chat · Quotation · Details' Decisions), drawn together. */
type ThreadDrawn = { full: React.ReactNode; chat: React.ReactNode; quotation: React.ReactNode; decisions: React.ReactNode };
type ThreadSearch = Awaited<NonNullable<Props['searchParams']>> | undefined;
type ThreadEmbedView = 'chat' | 'quotation' | 'decisions';

/** `askedOnce`'s name for "the picked client's draw of this thread" — one per render, per viewer, per thread. */
const THREAD_EMBEDS_DRAW = 'vendor-thread.embeds-draw';

/*
  ⚡ ONE CLIENT OPEN, ONE THREAD DRAW (Build 2 · lane D, 8 Nov 2026 — a Build-1 bug).
  The picked client builds EVERY page body on each request (`pickedPageBodies`) and only shows one, so Chat and
  Quotation — which both render THIS page — ran every read below TWICE per open, whichever page was on screen. Every
  embed now asks for the SAME draw (`askedOnce`, the repo's one-per-render memory — `lib/request-once.ts`): the first
  embed starts it, the others are handed its answer, and the draw returns all three embeds' nodes at once. Keyed by
  the viewer's session client (WHO) · the thread (ABOUT) — never shared across viewers or requests. The full-screen
  route draws alone, exactly as before. Held by `clients/[eventId]/a-client-open-draws-the-thread-once.test.ts`.
*/
export default async function VendorThreadPage({ params, searchParams }: Props) {
  const { threadId } = await params;
  const sp = await searchParams;
  const view: ThreadEmbedView | null =
    sp?.__embed === 'chat' || sp?.__embed === 'quotation' || sp?.__embed === 'decisions' ? sp.__embed : null;
  if (view) {
    const viewer = await createClient();
    const drawn = await askedOnce(viewer, THREAD_EMBEDS_DRAW, [threadId], () => drawVendorThread(threadId, undefined, true));
    return drawn[view];
  }
  return (await drawVendorThread(threadId, sp, false)).full;
}

/**
 * The thread page's ONE draw. `embedded` = the picked client's draw (no search params of its own): it returns the
 * Chat, Quotation and Details-Decisions nodes together; otherwise the full-screen page.
 */
async function drawVendorThread(threadId: string, sp: ThreadSearch, embedded: boolean): Promise<ThreadDrawn> {
  const noticeKey = sp?.notice;
  // Read on the server so a Decisions link paints Decisions, not the chat.
  const initialView = parseThreadView(sp?.view);
  // `?compose=deal` — the Counter-offer link on a quote card. It opens the
  // deal panel on the server (`<details open>`) AND seeds the builder; until
  // 2026-09-18 only the builder was seeded, inside a closed panel, so the link
  // landed on a page that looked unchanged.
  // `?compose=quote` (S5) — the "Update this quote" link on the live quote
  // card. Opens the Build-a-quote panel on the server AND seeds the builder
  // from the quote being replaced (see `quoteRevision` below), so the supplier
  // edits what they sent rather than retyping it. Same mechanism as `deal`.
  // The picked client's Quotation opens the builder ON the live quote, exactly as "Update this quote" does
  // (`compose=quote`) — its node is drawn with `'quote'` below (`toolNodesFor`); the Chat embed's tray with none.
  const composeMode: 'deal' | 'quote' | null =
    sp?.compose === 'deal' ? 'deal' : sp?.compose === 'quote' ? 'quote' : null;
  const proposalNotice = typeof noticeKey === 'string' ? PROPOSAL_NOTICE[noticeKey] : undefined;
  // The answer to a booking ask given from the accepted quote card lands back
  // HERE (`lockAnswerReturnTo`), so this page says what happened — the same
  // sentences the Overview says. Without it a refusal would reload the thread
  // with the Agree button still sitting on the card: a failure that looks
  // exactly like a dead button.
  const lockCompeting = Number.parseInt(sp?.lock_agree ? (sp?.competing ?? '') : '', 10);
  const lockAnswer =
    lockAgreeNotice(sp?.lock_agree, {
      competing: Number.isFinite(lockCompeting) ? lockCompeting : null,
      feeHeld: lockAgreeFeeHeld(sp?.fee),
      // RW-38: the live gate, so the notice claims a gate only when there is one.
      feeLocksEvent: lockAgreeFeeHeld(sp?.fee) ? await resolveFeeEnforcement() : false,
      halls: lockAgreeHalls(sp?.taken, sp?.free),
    }) ?? lockDeclineNotice(sp?.lock_decline);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const thread = await fetchThreadById(supabase, threadId);
  if (!thread || thread.vendor_profile_id !== profile.vendor_profile_id) notFound();

  /*
    📋 THEIR ASK, AT THE TOP OF THE CHAT (supplier dashboard v13, APPROVED 2026-10-29 — "the inquiry card at the top of a
    first chat"): a pending inquiry opens on the event's fixed lines and Accept · Decline · Ask, the same lines Today and
    Customers draw (`readSupplierEventLines`). Started now, beside every other read; only for a pending inquiry.
  */
  const askLinesRead =
    thread.inquiry_status === 'pending'
      ? readSupplierEventLines(createAdminClient(), {
          vendorProfileId: profile.vendor_profile_id,
          shopServices: (profile.services ?? null) as string[] | null,
          events: [{ eventId: thread.event_id, stage: 'asking' }],
        })
          .then((m) => m.get(thread.event_id) ?? null)
          .catch(() => null)
      : Promise.resolve(null);

  // ═══ EVERY READ BELOW STARTS AT ONCE (perf, 2026-09-29) ══════════════════
  // The 2026-07-01 batch below took the first fourteen reads off the serial
  // path, but it still waited for three reads before it, and about twenty more
  // ran ONE AFTER ANOTHER after it — add-ons, the revision seed, attribution,
  // the trust badge, the founder seat, pipeline pressure, pax proposals, the
  // stage, decisions, the service label, budget bands, the handshake, the fee
  // forecast, booked money, payout readiness, the standing, then the whole
  // conversation column — although most needed nothing but the thread. Each is
  // now STARTED here as a promise, with its own graceful-degrade exactly as it
  // was, and they are awaited together in the one `Promise.all` at the end of
  // the run. A read that needs another's answer awaits that one promise INSIDE its
  // own started block (the fee forecast waits for the handshake).
  //
  // ⚠ THE TWO WRITES KEEP THEIR PLACE. `markThreadRead` (the read marker) and
  // `resolveLivePax` (which can take the lazy guest-count lock) start only once
  // the three reads that preceded them have succeeded — they were inside the
  // batch, and the batch came after those three — and the conversation column,
  // which reads `chat_thread_reads`, still waits for the read marker's write.
  // ⚠ ADD A NEW READ AS ANOTHER STARTED PROMISE, NOT AS ANOTHER `await` IN THIS
  // RUN — one stray `await` puts a full database trip back in front of the page.

  // 📵 No calls in the chat (owner 2026-10-28, "remove both voice and video call") — the calls-gate read is gone
  // from this page; `lib/thread-calls-gate.ts` stays, unused here, for the owner to decide on.

  /**
   * THE TWO MONEY LINES UNDER THE QUOTE TOTAL — resolved ONCE here so the
   * composers can re-price them as the supplier types, rather than asking the
   * server on every keystroke.
   *
   * ⚠ Safe to run with the admin client HERE and not earlier: the ownership
   * gate above already refused the request unless this viewer is the supplier
   * on this thread (`thread.vendor_profile_id !== profile.vendor_profile_id` →
   * notFound).
   */
  // WHERE THIS SHOP STANDS ON THE FEE for this couple — handed to BOTH quote
  // composers so the supplier prices the job knowing what Setnayan takes.
  // Unlike the gift basis this is resolved even on a FREE booking: "free, 3 of
  // your first 5 left" is the disclosure, and silence would be the old defect.
  // 💸 WORDS ONLY ON A NEW INQUIRY WHILE A TOP-UP IS OVERDUE (owner 2026-11-12, booking-fee top-up rules; prototype
  // "New inquiry · text only … booked clients are unaffected"): this shop is not booked here and one of its top-ups is
  // past its event day and unsettled. Talking is never narrowed (the chat is one
  // of the always-open three, and this page never reads the event gate) — only files. A held top-up, or a failed
  // read, narrows nothing.
  const feeWordsOnlyRead = readWordsOnlyTopUp(profile.vendor_profile_id, thread.event_id, manilaTodayYmd()).then((o) =>
    o ? TOP_UP_WORDS.toolGated(o.amountPhp) : null,
  );
  const composerFeeStandingRead = resolveBookingFeeStanding(createAdminClient(), {
    vendorProfileId: profile.vendor_profile_id,
    eventId: thread.event_id,
  }).catch(() => null);
  /**
   * HOW MUCH EXCLUSIVE PAPIC THIS BOOKING CAN CARRY — owner 2026-09-20: *"the
   * maximum additional papic service they can also purchase on top to offer
   * that exclusive deal."*
   *
   * 🔑 ONE READ ANSWERS BOTH LINES. This asks `setnayan_gift_quote_applies`
   * once and keeps the REASON; the gift block's basis is then derived from the
   * same answer by `giftBasisFrom` — which returns one only for `'applies'`,
   * exactly `giftQuoteBasis`'s contract. Asking twice would let the two halves
   * of one screen be resolved against two different moments.
   */
  const composerPapicStandingRead = resolvePapicQuoteStanding(createAdminClient(), {
    eventId: thread.event_id,
    vendorProfileId: thread.vendor_profile_id,
  });
  // 🎁 THE SHOP'S OWN GIFTS for this quote (owner 2026-11-04): stock free to offer here (this event's old holds left
  // out), the live packs and the fee schedule; plus what buying from inside the quote needs. Best-effort: a failure
  // draws no gift block rather than fail the thread.
  // 🏷🧺 The quote's doors (owner 11 Nov 2026): the shop's offers and bundles, each behind its shared lock — read with
  // the thread, never on the quote's first open (lib/quote-doors.server.ts). Unread says so; it never reads as none.
  const quoteDoorsRead: Promise<QuoteDoors> = readQuoteDoors(supabase, profile.vendor_profile_id).catch((err) => {
    console.error('[supabase-error] messages/[threadId] · quote doors', err);
    return { offers: { kind: 'unread' }, bundles: { kind: 'unread' } };
  });
  const shopGiftsRead = (async () => {
    const giftAdmin = createAdminClient();
    const [basis, paysGiftPrice, settings, papicOn, storeShell] = await Promise.all([
      fetchShopGiftQuoteBasis(giftAdmin, profile.vendor_profile_id, thread.event_id),
      fetchVendorPaysGiftPrice(giftAdmin, profile.vendor_profile_id),
      fetchPlatformSettings(supabase),
      isVendorPapicCaptureEnabled(),
      isStoreShellRequest(),
    ]);
    // 💎 Event Plus / Pro are not Papic — with the Papic switch off only they are offered (slice 2).
    const packs = basis ? (papicOn ? basis.packs : basis.packs.filter((p) => p.kind !== 'papic')) : [];
    if (!basis || packs.length === 0) return { basis: null, buy: null };
    const openRails = openRailOptions(settings);
    return { basis: { ...basis, packs }, buy: storeShell ? null : { paysGiftPrice, openRails } };
  })().catch((err) => {
    console.error('[supabase-error] messages thread · shop gifts', err);
    return { basis: null, buy: null };
  });
  // The two writes in the batch below wait for these three — they used to be
  // awaited in turn before the batch started, so no write ran while one of them
  // could still fail the page.
  const writesWaitFor = Promise.all([
    composerFeeStandingRead,
    composerPapicStandingRead,
  ]);

  // ── Concurrent fetch (2026-07-01 perf) ──────────────────────────────────
  // Every read below the ownership gate is independent — only paxProposals needs
  // livePax first — so they run in ONE parallel batch instead of the former
  // ~14-step serial waterfall. Best-effort loaders keep their graceful-degrade
  // contract via per-item .catch(). markThreadRead is a WRITE fired inside the
  // batch (last element, result ignored): it still clears unread on this load,
  // but concurrently, adding zero serial round-trips instead of blocking render.
  // (2026-09-29) The batch is now STARTED, not awaited on its own; the members
  // other reads chain on — the event, interests + services, live pax and the
  // read marker — are started just above it and slotted into it by name.
  const msgTimer = new ServerTimer('vendor-dashboard/messages-thread');
  const paxAdmin = createAdminClient();
  // WHO IS ASKING. Read with the ADMIN client, like the three sibling reads
  // below, because a vendor holds no `events` RLS — not even after accepting
  // (measured in prod 2026-09-08: an accepted thread's vendor still had
  // `vendor_is_event_member = 0`). With the vendor's own client this row came
  // back null on EVERY load, so the header fell back to "Couple" and the rail
  // read "Not set yet" against a real 2026-12-18 date. The ownership gate
  // above (`thread.vendor_profile_id !== profile.vendor_profile_id` →
  // notFound) is what authorises the bypass.
  const eventRead = (async () => {
    return await paxAdmin
      .from('events')
      .select('display_name, event_date, event_type, region, setnayan_ai_active, created_at, budget_band, mood_feel_key, ceremony_type, date_candidates, date_window_start, date_window_end')
      .eq('event_id', thread.event_id)
      .maybeSingle();
  })();
  // Inverse cross-sell (owner-locked 2026-06-12) — active services minus those
  // already recorded as thread interests.
  const interestsAndServicesRead = Promise.all([
    fetchThreadInterests(supabase, threadId),
    fetchVendorServices(supabase, profile.vendor_profile_id),
  ]);
  // Adaptive Pax Pricing Phase 5 — recompute live pax FRESH on view (admin
  // client, gated by the thread-ownership check above).
  // `resolveLivePax` used to WRITE (a lazy date-based guest-count lock); since
  // 2026-09-30 only the host's Finalize writes it, so this is a pure read. It
  // still waits for the three reads above, as it always did.
  const livePaxRead = (async () => {
    await writesWaitFor;
    return resolveLivePax(paxAdmin, thread.event_id);
  })();
  // Mark read (WRITE) — fired concurrently; result ignored. No-op + logged if
  // migration 20260728000000_chat_thread_reads.sql isn't pushed yet.
  // ⚠ It waits for the three reads above, and the conversation column waits
  // for it (that column reads the `chat_thread_reads` row this writes).
  const markedRead = (async () => {
    await writesWaitFor;
    // ONLY THE CHAT VIEW MARKS READ (coordinator ruling, 8 Nov 2026). The picked client's draw is shared by Chat,
    // Quotation and Details at once, so a mark HERE ran whichever page was on screen — opening Details or Quotation
    // marked the chat read. The embedded draw therefore writes nothing; its Chat node mounts `MarkReadWhenShown`,
    // which the shell mounts only while Chat is shown (and on a swipe to Chat, which makes no request). The
    // full-screen route is the Chat view itself, so it marks here — before its conversation column reads the row.
    if (embedded) return;
    await markThreadRead(threadId).catch(() => undefined);
  })();
  const batchRead = msgTimer.track('thread', () => Promise.all([
    // UGC block state (Apple 1.2) — drives the thread menu label + composer gating.
    getThreadBlockState(thread, user.id, 'vendor'),
    // WHO IS ASKING — started above as `eventRead` (admin client; see there).
    eventRead,
    // Server-rendered first batch (SSR + SEO). Realtime takes over from here.
    fetchMessages(supabase, threadId),
    // Inverse cross-sell — started above as `interestsAndServicesRead`.
    interestsAndServicesRead,
    // In-chat proposals — the vendor's own templates + packages (RLS-scoped).
    Promise.all([
      supabase
        .from('vendor_proposal_templates')
        // `default_package_id` is NOT decoration: sendProposalCore prices the
        // proposal from it when the supplier leaves the package selector on
        // "No package". Without it the composer cannot know its own total.
        .select('template_id, template_name, default_package_id')
        .eq('vendor_profile_id', profile.vendor_profile_id),
      supabase
        .from('vendor_packages')
        // The package's own price is what the send path bills — the Price field
        // is only a fallback when this is 0.
        //
        // ⚠ READ THE CONSTANT, NOT A THIRD HAND-TYPED LIST. Adding
        // `total_price_centavos` to the old two-column literal took this read
        // past the duplicated-rule guard's threshold and turned CI red — and
        // the annotation it produced said "native encoder tests failed", a
        // crate this branch does not touch. The literal was the fault. Three
        // of these twelve columns are used below; the other nine cost one
        // round trip on a page that already makes a dozen.
        .select(VENDOR_PACKAGE_SELECT)
        .eq('vendor_profile_id', profile.vendor_profile_id),
    ]),
    // Returning-client flag (owner-locked 2026-06-12) — only relevant while the
    // inquiry is pending. Graceful-degrades pre-migration.
    thread.inquiry_status === 'pending'
      ? fetchReturningClientFlags(supabase, profile.vendor_profile_id, [thread.event_id])
      : Promise.resolve(null),
    // Live pax — started above as `livePaxRead` (it can write; see there).
    livePaxRead,
    // Phase 2 PR-C — couple-logged payments awaiting confirmation. Best-effort:
    // a failure degrades to no cards.
    fetchPendingVendorPayments({
      adminClient: paxAdmin,
      eventId: thread.event_id,
      vendorProfileId: profile.vendor_profile_id,
    }).catch((e): Awaited<ReturnType<typeof fetchPendingVendorPayments>> => {
      console.error('[vendor-thread] fetchPendingVendorPayments threw', e);
      return [];
    }),
    // Phase 2 PR-D — plan progress for this vendor's bookings. Best-effort.
    fetchPlanProgressForVendor({
      adminClient: paxAdmin,
      eventId: thread.event_id,
      vendorProfileId: profile.vendor_profile_id,
    }).catch((e): Awaited<ReturnType<typeof fetchPlanProgressForVendor>> => {
      console.error('[vendor-thread] fetchPlanProgressForVendor threw', e);
      return [];
    }),
    // Won & Lost Reasons (Wave 6) — live admin-managed reason taxonomy.
    fetchReasonCodes(supabase),
    // Any outcome already logged for THIS thread.
    supabase
      .from('inquiry_outcomes')
      .select('outcome, reason_code, free_text')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .eq('chat_thread_id', threadId)
      .is('vendor_proposal_id', null)
      .maybeSingle(),
    // WHO STARTED THE EVENT, and HOW FAR ALONG the plan is — the two halves of
    // the owner's 2026-09-08 summary ("User name create a … event … with X
    // locked vendors"). Admin-scoped for the same reason as the `events` read
    // above: a vendor holds no RLS on either table. Best-effort — the summary
    // degrades field by field rather than costing the page.
    (async (): Promise<{
      hostName: string | null;
      /** THE ONE BUILD (8 Nov 2026): every host in this chat (`event_chat_hosts`). NULL = unread, never "no hosts". */
      hosts: ChatHost[] | null;
      locked: number | null;
      total: number | null;
      lockedCategories: string[];
    }> => {
      try {
        const [members, vendors] = await Promise.all([
          // WHO THE HOSTS ARE — one source for the brief and this page (`event_chat_hosts`, 20271324946509): every
          // couple member, keyed by auth uid. Was `event_members … limit(1)` + a `users` read for one name.
          paxAdmin.rpc('event_chat_hosts', { p_event_id: thread.event_id }),
          paxAdmin
            // `category` rides along on a query this page already makes — the
            // locked-category chips cost no extra round trip. ⚠ `vendor_name`
            // is NOT selected: which SLOTS are taken is the owner's 2026-09-08
            // grant; WHO took them stays the booked-stage `vendor_roster`.
            .from('event_vendors')
            .select('status, category')
            .eq('event_id', thread.event_id),
        ]);
        const rows = (vendors.data ?? []) as Array<{
          status: string | null;
          category: string | null;
        }>;
        const confirmed = new Set<string>(CONFIRMED_VENDOR_STATUSES);
        const lockedRows = rows.filter((r) => r.status && confirmed.has(r.status));
        const locked = lockedRows.length;
        // `displayServiceLabel`, not a raw `category`: the column holds canonical
        // enum keys AND custom free-text entries, and that resolver is the one
        // place that already handles both. Its docblock: "NEVER PRINT A DATABASE
        // KEY AT A COUPLE" — a supplier deserves the same.
        const lockedCategories = lockedRows
          .map((r) => (r.category ? displayServiceLabel(r.category) : null))
          .filter((c): c is string => !!c);
        if (members.error) logQueryError('vendorThread.chatHosts', members.error, { eventId: thread.event_id }, 'graceful_degrade');
        const hosts = members.error ? null : chatHostsFrom(members.data);
        const hostName = hosts?.[0]?.name ?? null;
        return { hostName, hosts, locked, total: rows.length, lockedCategories };
      } catch {
        return { hostName: null, hosts: null, locked: null, total: null, lockedCategories: [] };
      }
    })(),
    // Vendor Proposal Maker (§ 9) — the vendor's OWN published payment methods
    // for the in-thread quote's method picker (RLS-scoped). Best-effort: any
    // failure degrades to no picker (the couple falls back to all approved).
    fetchOwnPaymentMethods(supabase, profile.vendor_profile_id).catch(
      (): Awaited<ReturnType<typeof fetchOwnPaymentMethods>> => [],
    ),
    // Mark read (WRITE) — started above as `markedRead`; result ignored.
    markedRead,
  ]));

  const kindLabelRead = cardKindLabeller();

  // The add-ons and "comes with" rows of the shop's ACTIVE cards — see THE
  // SHOP'S CARDS FOR THE QUOTE below. Needs the services, so it chains on them.
  const shopCardsRead = (async () => {
    const [, ownServices] = await interestsAndServicesRead;
    const activeServices = ownServices.filter((s) => s.is_active);
    const activeIds = activeServices.map((s) => s.vendor_service_id);
    const [addonsByService, linkRows] = await Promise.all([
      fetchAddonsByService(supabase, activeIds),
      activeIds.length > 0
        ? supabase
            .from('vendor_service_links')
            .select('vendor_service_id, linked_label')
            .in('vendor_service_id', activeIds)
            .order('display_order', { ascending: true })
        : Promise.resolve({ data: null }),
    ]);
    return { activeServices, addonsByService, linkRows };
  })();

  /**
   * S5 · "UPDATE THIS QUOTE" — the builder opens seeded from the LIVE quote.
   *
   * Only on `?compose=quote`. The live quote is the newest non-draft row for
   * (this event × this shop) that is still sent / viewed / accepted — the same
   * rule `fetchLiveQuoteTotalPhp` and the thread's own card use ("one thread,
   * one live quote"). Read under the supplier's OWN session (RLS: own org).
   * Null when there is nothing live to revise: the builder then opens empty,
   * which is the ordinary Build-a-quote, not an error.
   */
  const quoteRevisionRead = (async () => {
    let quoteRevision: QuoteRevisionSeed | null = null;
    // The picked client's draw always seeds it: its Quotation node opens on the live quote.
    if (composeMode === 'quote' || embedded) {
      const { data: liveQuote, error: liveQuoteErr } = await supabase
        .from('vendor_proposals')
        // The column list is a constant in lib/quote-revision-seed.ts so a unit
        // test can EXECUTE it — a query in a server component can only be
        // grepped, and this read silently dropped the supplier's gift answer.
        .select(QUOTE_REVISION_SELECT)
        .eq('event_id', thread.event_id)
        .eq('vendor_profile_id', profile.vendor_profile_id)
        // + 'expired' (Build 3): "Send a new quotation" opens seeded from the lapsed one.
        .in('status', ['sent', 'viewed', 'accepted', 'expired'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (liveQuoteErr) {
        console.error('[vendor thread] live quote read for revision refused', liveQuoteErr);
      } else if (liveQuote) {
        quoteRevision = seedQuoteRevision(liveQuote as QuoteRevisionSource);
      }
    }
    return quoteRevision;
  })();

  // ── Creator Economy PR-C · inquiry provenance (PRIVATE to the vendor) ──────
  // The source chip (owner's taxonomy; NULL = "Website Inquiry"), the returning
  // companion chip, the "Referred by [Storyteller] · via [chapter]" block with
  // the promised audience rate, and the "creator collab active" marker (the
  // INQUIRER holds an accepted collab with THIS vendor → agreed creator rate
  // applies). All fail-soft/pre-migration-safe.
  const sourceChipLabel = inquirySourceLabel(thread.inquiry_source ?? null);
  const attributionRead = Promise.all([
    thread.referring_chapter_id
      ? fetchThreadAttribution(thread)
      : Promise.resolve<ThreadAttribution | null>(null),
    fetchInquirerCollabActive(
      profile.vendor_profile_id,
      thread.created_by_user_id ?? null,
    ),
  ]);

  // Phase D — lead trust badge (fake-inquiry protection · "informed accept").
  // Flag-gated + pending-only + fail-soft. "Active planner" is a purely positive
  // cue (real engagement) — a new couple simply has no badge, never a warning.
  const leadActivePlannerRead =
    leadTrustBadgeEnabled() && thread.inquiry_status === 'pending'
      ? fetchLeadTrustActivePlanner(supabase, profile.vendor_profile_id, thread.event_id)
      : Promise.resolve(false);

  // Founder-seat inquiry — the explicit, server-asserted founder signal
  // (owner-locked 2026-07-16). Read from the founder_seats definer helper only
  // (never profile text — impersonation guard), shown pre- AND post-accept: the
  // vendor must know they're serving the people who built the app, and that
  // accepting was/is token-free. Unlike the trust badge this is NOT flag-gated —
  // pre-migration the RPC gracefully degrades to false.
  const founderInquiryRead = eventHostHoldsFounderSeat(supabase, thread.event_id);

  // How full is this shop's pipeline for THIS couple's date — the number the
  // per-tier ceiling refuses on, said out loud BEFORE the refusal. Pending-only
  // (an accepted thread has already spent its slot) and read through the
  // supplier's OWN session, because the RPC is caller-scoped and answering with
  // the service role would answer for a thread they do not own. Returns null —
  // and the component draws nothing — whenever the ceilings are switched off,
  // the couple has no date yet, or the read fails.
  const pipelinePressureRead =
    thread.inquiry_status === 'pending'
      ? fetchPipelinePressure(supabase, threadId)
      : Promise.resolve(null);

  // paxProposals depends on livePax, so it's the one query that follows the batch.
  // The date-demand counts ride alongside it rather than adding a third round
  // trip: two `head: true` counts, batched, never one per row.
  // (2026-09-29) Each now chains on the ONE read it needs — the proposals on
  // live pax, the date demand on the event — instead of on the whole batch.
  const paxProposalsRead = (async () => {
    const [livePax, quoteFollowsGuestList] = await Promise.all([
      livePaxRead,
      standingQuoteFollowsGuestList(paxAdmin, thread.event_id, profile.vendor_profile_id),
    ]);
    return fetchVendorPaxProposals(paxAdmin, {
      eventId: thread.event_id,
      vendorProfileId: profile.vendor_profile_id,
      livePax,
      paxAtInquiry: thread.pax_at_inquiry,
      quoteFollowsGuestList,
    });
  })();
  const dateDemandRead = (async () => {
    const { data: event } = await eventRead;
    /*
      WHO ELSE WANTS THIS DATE (owner: *"Target date for vendors will show who
      are also inquiring for that day so they do not need to browse their
      calendar?"*).

      🔒 COUNTS, NEVER NAMES, AND SUPPLIER SIDE ONLY. See
      lib/vendor-date-demand.ts — including why the shipped
      `get_vendor_same_day_bookings` could not answer this (it refuses unless
      the caller is already BOOKED on the event on screen, which an inquiry by
      definition is not) and why this is not built on the pipeline-ceiling RPC
      whose line sits a few rows below.
    */
    return fetchVendorDateDemand({
      adminClient: paxAdmin,
      vendorProfileId: profile.vendor_profile_id,
      eventDate: event?.event_date ?? null,
      excludeThreadId: threadId,
    });
  })();

  // ── Customer info rail (Customer Card respine PR-3) ──────────────────────
  // The rail no longer hides anything (owner ruling 2026-09-08). This flag now
  // means ONLY what its name says: a pending inquiry sits at the 'inquiry'
  // stage by definition, so there is no pipeline to derive yet. It must never
  // regain an identity meaning — that was the token wallet's lock.
  const threadIsPendingInquiry = thread.inquiry_status === 'pending';
  const railStageRead = threadIsPendingInquiry
    ? Promise.resolve('inquiry' as const)
    : deriveThreadStage({
        supabase,
        adminClient: paxAdmin,
        eventId: thread.event_id,
        vendorProfileId: profile.vendor_profile_id,
        // Without this a declined, withdrawn, expired or displaced thread keeps
        // reading as a live `Inquiry` — the pill said the conversation was
        // still open long after it had ended.
        inquiryStatus: thread.inquiry_status,
      });
  // ── DECISIONS · the two sources that are not messages ─────────────────────
  // Payments and the guest-count change are page sections rendered around the
  // stream, so the Decisions view can only get them from here. Both reads are
  // graceful — a refusal costs those rows, never the conversation.
  const decisionsRead = Promise.all([
    fetchThreadPayments({
      adminClient: paxAdmin,
      eventId: thread.event_id,
      vendorProfileId: profile.vendor_profile_id,
    }),
    // Under the supplier's OWN session — they read their own proposals.
    fetchLiveQuoteTotalPhp({
      supabase,
      eventId: thread.event_id,
      vendorProfileId: profile.vendor_profile_id,
    }),
  ]);

  // Service/category of the inquiry — the first recorded interest chip (the
  // same source the interest chips + cross-sell already use on this page).
  const railServiceRead = (async () => {
    const [existingInterests] = await interestsAndServicesRead;
    const firstInterest = existingInterests[0];
    return firstInterest
      ? (await interestLabeller(paxAdmin, [firstInterest]))(firstInterest)
      : null;
  })();

  // The budget bands for STEP 1 OF THE QUOTE (see there, below) — only when the
  // event names a band, so it chains on the event read.
  const budgetBandsRead = (async () => {
    const { data: event } = await eventRead;
    return event?.budget_band
      ? await fetchBudgetBands(paxAdmin).catch((): Awaited<ReturnType<typeof fetchBudgetBands>> => [])
      : [];
  })();

  // PR-H · IS THE BOOKING BEHIND THIS THREAD BOOKED, OR MERELY ASKED?
  // A supplier CANNOT read `event_vendors` through their own session — all four
  // policies on that table are couple- or moderator-scoped — so this uses the
  // admin client already in scope, narrowed to (this event × THIS shop's own
  // profile), the same pair the thread-ownership check above already proved.
  // Three handshake columns; no money, no guest data, no schedule.
  const lockHandshakeRead = fetchThreadLockHandshake(paxAdmin, {
    eventId: thread.event_id,
    vendorProfileId: profile.vendor_profile_id,
  });

  // WHAT AGREEING WILL COST THIS SHOP — resolved for the chat card's Agree
  // button, through the SAME `forecastForBooking` the Today feed and the client
  // page use, so the three cannot price or word it differently. Null when no
  // ask is on the card: nothing is read and nothing renders.
  const chatFeeForecastRead = (async () => {
    const lockHandshake = await lockHandshakeRead;
    return lockHandshake?.eventVendorId
      ? await forecastForBooking(paxAdmin, {
          vendorProfileId: profile.vendor_profile_id,
          eventVendorId: lockHandshake.eventVendorId,
        })
      : null;
  })();

  // THE DAY, BEFORE THE YES (owner 2026-11-04, `lib/day-check.ts`) — the ask's day read through the SAME capacity
  // rule the yes enforces (`vendor_day_check`). The supplier's own session: the RPC is DEFINER and carries the yes's
  // ownership gate. Read only while an ask is open; a refused read is `failed`, said on screen, never "0 booked".
  const dayCheckRead = (async () => {
    const lockHandshake = await lockHandshakeRead;
    return lockHandshake?.state === 'requested' && lockHandshake.eventVendorId
      ? await readDayCheck(supabase, lockHandshake.eventVendorId)
      : null;
  })();
  // 🧭 …and whether the asked-for service is on PLAN hold (owner 2026-11-06, SERVICES LIFE CYCLE) — then the panel
  // offers "Pick which stay on" in place of Agree. Started beside the day read; awaited after the batch.
  const heldServiceRead = (async () => {
    const lockHandshake = await lockHandshakeRead;
    return lockHandshake?.state === 'requested' && lockHandshake.eventVendorId
      ? await heldServiceOfAsk(supabase, lockHandshake.eventVendorId)
      : null;
  })();

  // THE SUPPLIER'S END OF THE NEXT MONEY STEP (2026-09-20) — the same
  // `readBookedMoney` → `moneyStep` the couple's card reads, so the two ends
  // say the same thing. Admin client: a supplier holds no `event_vendors` RLS,
  // and this page already refused anyone but this thread's supplier (notFound
  // above); the read is scoped to their own profile on this event.
  const bookedMoneyRead = (async () => {
    const { data: event } = await eventRead;
    return readBookedMoney(paxAdmin, {
      eventId: thread.event_id,
      vendorProfileId: profile.vendor_profile_id,
      eventDate: event?.event_date ?? null,
      viewer: 'vendor',
      otherName: 'the couple',
    });
  })();
  // 📌 THE PINS' OWN FACTS (Build 3 round 2) — payment due · call time · access ask · booking fee · coordinator Agree
  // · quote expired · open decisions, read as the supplier (`readChatPinFacts`). Started here, beside the batch; a
  // failure drops the pins it would have drawn, never the page.
  const chatPinsRead: Promise<ChatPinRead> = (async () => {
    const [{ data: ev }, money] = await Promise.all([eventRead, bookedMoneyRead]);
    return readChatPinFacts(supabase, {
      side: 'vendor',
      eventId: thread.event_id,
      vendorProfileId: profile.vendor_profile_id,
      threadId,
      userId: user.id,
      themName: ev?.display_name ?? 'the couple',
      supplierName: profile.business_name,
      bookedMoney: money,
    });
  })().catch((e: unknown): ChatPinRead => {
    console.error('[vendor thread] pin facts read failed', e);
    return { facts: [], masked: false, streamMasked: false, expiredQuoteId: null };
  });
  // 2026-09-19 · can this couple see anywhere to pay you? Shown on the live
  // ACCEPTED quote card as the same one-tap door the Overview's booking card
  // carries. The shop's OWN profile id (proved above), never a param.
  const payoutReadinessRead: Promise<PayoutReadiness> = readSupplierPayoutReadiness({
    adminClient: paxAdmin,
    vendorProfileId: profile.vendor_profile_id,
    vendorUserId: profile.user_id,
  }).catch((): PayoutReadiness => 'unreadable');

  // The facts beside the rung (SUP-2) — the SAME reader the couple's bench and
  // thread page use. `paxAdmin` because a supplier cannot read `event_vendors`
  // through their own session (see PR-H above); narrowed to this event × THIS
  // shop's own profile, the pair the ownership check already proved.
  const standingNowMs = Date.now();
  const standingExtrasRead = readStandingExtras(
    paxAdmin,
    thread.event_id,
    [profile.vendor_profile_id],
    standingNowMs,
  ).then((extras) => extras.get(profile.vendor_profile_id));

  /* THE ANSWER LINE (simpler supplier dashboard step 4 · prototype "Sat 12 Dec · Free"). The couple's date read off the
     supplier's OWN schedules — four narrow reads, `readThreadDayAnswer` — and only when there is a question: no date
     → "No date yet", already booked → "Booked", both with no read at all. It waits for the event and the stage, both
     already started above, so it never costs a read the answer does not need. */
  const todayIso = manilaDate(new Date().toISOString());
  const dayAnswerRead: Promise<ThreadDayAnswer | null> = (async () => {
    const [{ data: ev }, stage] = await Promise.all([eventRead, railStageRead]);
    if (!ev?.event_date) return { kind: 'no_date' };
    if (THREAD_STAGE_HAS_AGREEMENT[stage]) return { kind: 'booked' };
    return readThreadDayAnswer(supabase, {
      vendorProfileId: profile.vendor_profile_id,
      date: String(ev.event_date).slice(0, 10),
      todayIso,
    });
  })();

  /* ── THE LEFT COLUMN: every conversation, beside the one being read ────────
     Owner 2026-09-08: "list · conversation · context".

     ⚡ FOUR BATCHED READS FOR THE WHOLE LIST, not four per row. The stage
     probes live in buildVendorConversationRows; here we gather the three things
     a row shows that are not already on the thread row itself.

     ⚠ EVERY ONE FAILS QUIET. This column is navigation, not the page — a
     refused read must leave the conversation itself readable, so each degrades
     to an empty map and the row falls back to what it can still say. */
  const conversationRowsRead = (async () => {
    // The column reads `chat_thread_reads` (the unread dots, and the archived
    // embed on the thread list) — the row `markThreadRead` writes. It waits for
    // that write, as it did when the batch that held it was awaited first.
    // (Awaited FIRST, even for the embedded draw that reads nothing: the page's one wait holds `markedRead`
    // anyway, so this costs no time, and it keeps "the marker before any read" true for every branch below.)
    await markedRead;
    // The picked client draws no conversation list (its own Clients list is the list) — nothing is read for it.
    if (embedded) return [] as Awaited<ReturnType<typeof buildVendorConversationRows>>;
    const listThreads = await fetchVendorThreads(supabase, profile.vendor_profile_id).catch(
      (caught: unknown) => {
        logQueryError(
          'VendorThreadPage.conversationList',
          caught instanceof Error ? caught : new Error(String(caught)),
          { vendor_profile_id: profile.vendor_profile_id },
          'graceful_degrade',
        );
        return [] as Awaited<ReturnType<typeof fetchVendorThreads>>;
      },
    );
    const listThreadIds = listThreads.map((t) => t.thread_id);

    // What each row says — who the couple is, the last line, the service asked about — is read by the ONE helper the
    // full-screen Chats inbox reads too (`lib/vendor-conversation-inputs.server.ts`, 2026-11-06), so the two lists
    // cannot disagree about a row. The read markers stay HERE, beside the column's own unread rule below.
    const [listInputs, listReadRes] = await Promise.all([
      readVendorConversationInputs({
        supabase,
        adminClient: paxAdmin,
        vendorProfileId: profile.vendor_profile_id,
        threads: listThreads,
        nowMs: Date.now(),
        logAs: 'VendorThreadPage',
      }),
      // When this viewer last opened each thread — the dot and the bold preview.
      // ⚠ The read markers are a LATER migration than the threads themselves, so
      // this degrades to "nothing is unread": a missing dot understates, an
      // invented one sends a supplier into a conversation with nothing in it.
      listThreadIds.length > 0
        ? supabase
            .from('chat_thread_reads')
            .select('thread_id, last_read_at')
            .eq('user_id', user.id)
            .in('thread_id', listThreadIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const { lastMessages, lastMessageAt } = listInputs;

    /* Unread = something was said after this viewer last opened the thread.
       ⚠ A THREAD WITH NO READ MARKER IS NOT UNREAD HERE. The marker is written on
       open, so "never opened" and "the marker table is not reachable" are the same
       absence — and a whole column of dots on a shop that has read everything is
       noise that trains the eye to ignore the one that matters. */
    if (listReadRes.error) {
      logQueryError(
        'VendorThreadPage.listReads',
        listReadRes.error,
        { vendor_profile_id: profile.vendor_profile_id },
        'graceful_degrade',
      );
    }
    const listUnread = new Set<string>();
    for (const r of (listReadRes.data ?? []) as Array<{
      thread_id: string;
      last_read_at: string | null;
    }>) {
      const said = lastMessageAt.get(r.thread_id);
      if (said && r.last_read_at && new Date(said) > new Date(r.last_read_at)) {
        listUnread.add(r.thread_id);
      }
    }

    const conversationRows = await buildVendorConversationRows({
      supabase,
      adminClient: paxAdmin,
      vendorProfileId: profile.vendor_profile_id,
      threads: listThreads.map((t) => ({
        thread_id: t.thread_id,
        event_id: t.event_id,
        inquiry_status: t.inquiry_status ?? null,
        updated_at: t.updated_at,
      })),
      displayNames: listInputs.displayNames,
      labels: listInputs.labels,
      lastMessages,
      unreadThreadIds: listUnread,
      formatTime: formatChatTimestamp,
    });
    return conversationRows;
  })();

  // 🗂 The chat-files rule (C2) counts from the event's LAST day and only from a real day — its precision and end.
  // Its own read (admin, like `eventRead`: the ownership gate above already passed), so the brief's read stays as it is.
  const eventFileDayRead = (async () => {
    const { data, error } = await createAdminClient()
      .from('events')
      .select('event_date_precision, event_end_date')
      .eq('event_id', thread.event_id)
      .maybeSingle();
    if (error) logQueryError('VendorThreadPage.eventDay', error, { event_id: thread.event_id }, 'graceful_degrade');
    return (data ?? null) as { event_date_precision?: string | null; event_end_date?: string | null } | null;
  })();

  // ✓✓ "Seen" under the supplier's last message (owner 2026-10-28, *"yes show seen"*) — one started read, like the
  // rest; it waits for the batch only to know who has written for the couple (`lib/chat-thread-receipts.server.ts`).
  const receiptsRead = (async () => {
    const batch = await batchRead;
    return readThreadReceipts(createAdminClient(), {
      threadId,
      viewerRole: 'vendor',
      viewerUserId: user.id,
      vendorProfileId: thread.vendor_profile_id,
      messages: batch[2],
    });
  })();

  // BOOKED → Call · Video call in the head (owner 2026-11-04, "Viber and phone call booked suppliers"). The one booking
  // check; the couple's number is read only once it says yes, and only if they saved one (else no buttons).
  const shopBookedRead = shopIsBookedOnEvent(thread.event_id, profile.vendor_profile_id);
  const couplePhoneRead = shopBookedRead.then((booked) =>
    bookedCounterpartyPhone({ booked, viewer: 'vendor', eventId: thread.event_id, vendorProfileId: profile.vendor_profile_id }),
  );

  // ═══ THE ONE WAIT ═══════════════════════════════════════════════════════════
  const [
    shopBooked,
    couplePhone,
    composerFeeStanding,
    composerPapicStanding,
    [
      blockState,
      { data: event },
      initialMessages,
      [existingInterests, ownServices],
      [tplRes, pkgRes],
      returningMap,
      livePax,
      pendingPayments,
      planProgress,
      reasonCodes,
      { data: existingOutcome },
      customerPlan,
      ownPaymentMethods,
    ],
    kindLabel,
    { activeServices, addonsByService, linkRows },
    quoteRevision,
    [attribution, inquirerCollabActive],
    leadActivePlanner,
    founderInquiry,
    pipelinePressure,
    paxProposals,
    dateDemand,
    railStage,
    [decisionPayments, liveQuoteTotalPhp],
    railService,
    budgetBands,
    lockHandshake,
    chatFeeForecast,
    dayCheck,
    bookedMoney,
    payoutReadiness,
    standingExtras,
    conversationRows,
    dayAnswer,
    receipts,
    eventFileDay,
  ] = await Promise.all([
    shopBookedRead,
    couplePhoneRead,
    composerFeeStandingRead,
    composerPapicStandingRead,
    batchRead,
    kindLabelRead,
    shopCardsRead,
    quoteRevisionRead,
    attributionRead,
    leadActivePlannerRead,
    founderInquiryRead,
    pipelinePressureRead,
    paxProposalsRead,
    dateDemandRead,
    railStageRead,
    decisionsRead,
    railServiceRead,
    budgetBandsRead,
    lockHandshakeRead,
    chatFeeForecastRead,
    dayCheckRead,
    bookedMoneyRead,
    payoutReadinessRead,
    standingExtrasRead,
    conversationRowsRead,
    dayAnswerRead,
    receiptsRead,
    eventFileDayRead,
  ]);
  const heldAskService = await heldServiceRead;
  const chatPins = await chatPinsRead;

  const composerGiftBasis = giftBasisFrom(composerPapicStanding);
  const shopGifts = await shopGiftsRead;
  const quoteDoors = await quoteDoorsRead;
  // A bundle has ONE door on the quote — "Start from" — so the older package picker does not list it a second time.
  const bundleIds = new Set(quoteDoors.bundles.kind === 'read' ? quoteDoors.bundles.bundles.map((b) => b.id) : []);
  // The couple's booking ask is open — the one fact that lists "Answer their booking ask" and mounts its panel.
  const askOpen = lockHandshake?.state === 'requested' && Boolean(lockHandshake.eventVendorId);

  // WHO IS ASKING — one label, the same before and after accepting. The
  // anonymization-until-accept placeholder ("A couple planning a wedding in
  // Manila") is gone: it existed so that accepting, which cost a token, bought
  // something. The token wallet is retired, so it bought nothing and only
  // withheld a name from the one supplier this couple had already written to.
  // Owner ruling 2026-09-08: "we do not need to hide anything, since no more
  // tokens." 'Couple' remains only for a genuinely missing event row.
  const coupleLabel = event?.display_name ?? 'Couple';
  const inquiryCity = inquiryCityLabel(event?.region ?? null);

  const alreadyOnThread = new Set(
    existingInterests
      .map((r) => r.vendor_service_id)
      .filter((v): v is string => v !== null),
  );
  const offerOptions: VendorOfferOption[] = ownServices
    .filter((s) => s.is_active && !alreadyOnThread.has(s.vendor_service_id))
    .map((s) => ({
      vendorServiceId: s.vendor_service_id,
      // A card's kind may be the shop's own coverage word; the shared labeller
      // owns the fallback chain so no screen can end it at the raw key.
      label: s.title?.trim() || kindLabel(s.category),
    }));

  /**
   * THE SHOP'S CARDS FOR THE QUOTE (owner 2026-09-22: "load 1 or multiple
   * service cards combined"). Every ACTIVE card — not the offer list above,
   * which hides cards already on the thread: a quote is usually for exactly
   * the card the couple asked about. Add-ons and "comes with" ride along so
   * the picker can offer them; the seed itself is read again on the server
   * when a card is picked (`loadServiceCardLinesForQuote`).
   */
  const comesWith = new Map<string, string[]>();
  for (const r of ((linkRows as { data: { vendor_service_id: string; linked_label: string | null }[] | null }).data ?? [])) {
    if (!r.linked_label) continue;
    comesWith.set(r.vendor_service_id, [...(comesWith.get(r.vendor_service_id) ?? []), r.linked_label]);
  }
  const quoteCards: QuoteCardOption[] = activeServices.map((s) => ({
    id: s.vendor_service_id,
    label: s.title?.trim() || kindLabel(s.category),
    fromPhp:
      s.pricing_basis === 'per_pax'
        ? s.per_pax_price_php
        : s.pricing_basis === 'per_hour'
          ? s.hour_base_php
          : s.starting_price_php,
    addons: (addonsByService.get(s.vendor_service_id) ?? []).map((a) => ({ id: a.id, label: a.label, fromPhp: a.from_price_php })),
    comesWith: comesWith.get(s.vendor_service_id) ?? [],
    giftOn: Boolean(s.includes_setnayan_gift),
  }));

  const proposalTemplates = (
    (tplRes.data ?? []) as {
      template_id: string;
      template_name: string;
      default_package_id: string | null;
    }[]
  ).map((t) => ({
    id: t.template_id,
    name: t.template_name,
    defaultPackageId: t.default_package_id ?? null,
  }));
  const proposalPackages = (
    (pkgRes.data ?? []) as {
      package_id: string;
      package_name: string;
      total_price_centavos: number | null;
    }[]
  ).map((p) => ({
    id: p.package_id,
    name: p.package_name,
    totalCentavos: Number(p.total_price_centavos) || 0,
  }));
  // Vendor Proposal Maker (§ 9) — the vendor's payment rails for the quote's
  // method picker (default-selects the publishable ones).
  const proposalPaymentMethods = (ownPaymentMethods ?? []).map((m) => ({
    id: m.payment_method_id,
    label: m.label,
    methodType: m.method_type,
    provider: m.provider,
    publishable: m.is_shown && m.moderation_status === 'approved',
  }));

  const returning = returningMap ? returningMap.get(thread.event_id) : undefined;

  const headerPax = livePax ?? thread.pax_current;

  /*
    THE TWO GUEST COUNTS, READ ONCE.

    A thread stores what the couple ASKED with (`pax_at_inquiry`) and what they
    are planning NOW (live pax). Both are true and they routinely differ. Every
    surface on this page that shows a headcount takes it from HERE and says
    which one it is — see lib/guest-count-provenance.ts for why that is a helper
    rather than four careful edits.

    ⚠ MONEY RIDES ON THE DIFFERENCE. A supplier quotes against one and is paid
    against the other; the "guest count changed — accept or hold your price"
    card below exists because of it. The accept card used to render a bare
    "150 pax" beside a header saying 170.
  */
  const guestCounts: GuestCounts = {
    live: headerPax ?? null,
    atInquiry: thread.pax_at_inquiry ?? null,
  };

  const peso = (n: number) =>
    `₱${Math.abs(Math.round(n)).toLocaleString('en-PH')}`;

  const reasonOptions: OutcomeReasonOption[] = reasonCodes.map((r) => ({
    reasonCode: r.reasonCode,
    label: r.label,
    appliesTo: r.appliesTo,
  }));
  const currentOutcome = existingOutcome
    ? {
        outcome: existingOutcome.outcome as 'won' | 'lost' | 'no_response',
        reasonCode: existingOutcome.reason_code as string | null,
        freeText: existingOutcome.free_text as string | null,
      }
    : null;
  const outcomeCapture = (
    <InquiryOutcomeCapture
      threadId={threadId}
      reasons={reasonOptions}
      current={currentOutcome}
    />
  );

  // WHAT THE 🧾 ENTRY OFFERS (owner, 2026-09-19). No new read — the rung and the
  // live quote total just above decide it, and they were moved up here only so
  // the tool panels below can use them. Before a quote is out, the composer's
  // 🧾 is "Send a quote" (#build-quote) and "Send a deal" is not offered.
  const dealEntry = dealEntryFor({
    side: 'vendor',
    hasQuote: threadHasQuote({ stage: railStage, liveQuoteTotalPhp }),
  });

  // ── The customer summary and the quote's step-1 brief are built BEFORE the
  // tools mount: `toolNodes` is JSX created eagerly, and it carries the brief. ──

  // THE CUSTOMER SUMMARY (owner 2026-09-08). One builder, so the sentence and
  // the rows cannot disagree with each other or with the header above them.
  // 📅 No day set yet, but the couple picked candidate date(s) or a window (walk 13 Nov 2026) — said as options
  // wherever this page would otherwise say "Not set yet" / "(date not set)". `fitDateScope` underneath.
  const dateOptions = event && !event.event_date
    ? eventDateOptionWords({
        eventDate: null,
        precision: null,
        candidates: (event as { date_candidates?: unknown }).date_candidates,
        windowStart: (event as { date_window_start?: string | null }).date_window_start ?? null,
        windowEnd: (event as { date_window_end?: string | null }).date_window_end ?? null,
      })
    : null;
  const customerSummary = buildCustomerEventSummary({
    hostName: customerPlan.hostName,
    eventTypeLabel: event?.event_type ? eventTypeLabel(event.event_type) : null,
    eventName: event?.display_name ?? null,
    createdAt: event?.created_at ?? null,
    targetDate: event?.event_date ?? null,
    targetDateOptions: dateOptions,
    pax: headerPax ?? null,
    paxAtInquiry: thread.pax_at_inquiry ?? null,
    dateDemandNote: vendorDateDemandNote(dateDemand),
    location: inquiryCity,
    lockedVendors: customerPlan.locked,
    totalVendors: customerPlan.total,
    lockedCategoryLabels: customerPlan.lockedCategories,
  });

  /**
   * STEP 1 OF THE QUOTE — what Setnayan can tell this supplier while they price
   * (owner 2026-09-22). The rail's rows verbatim + the stage-1 facts of the
   * 2026-09-20 ruling: AREA (never the venue), asked-for, budget band (+ live
   * per-head median), style, locked categories.
   *
   * ⛔ THE CONVERSATION NEVER KNOWS THE FEE GATE (`the-fee-unlocks-the-event`
   * guard: the thread page must not import the gate resolver). This page
   * gates nothing; it only decides whether step 1 NAMES the withheld fields —
   * so the stage here is derived from the flag alone: enforced and not yet
   * booked ⇒ 'quoting'; otherwise 'unlocked', which prints no such line. With
   * the flag off (production, 2026-09-22) nothing is withheld and nothing is
   * announced. The rows themselves come from the rail, never from the RPC.
   */
  const briefStage: 'quoting' | 'unlocked' =
    isFeeUnlocksEventEnabled() && !THREAD_STAGE_HAS_AGREEMENT[railStage] ? 'quoting' : 'unlocked';
  const bandSlug = (event?.budget_band as string | null | undefined) ?? null;
  const bandRow = bandSlug
    ? budgetBands.find((b) => b.value === (bandSlug === 'nolimit' ? 'no_limit' : bandSlug)) ?? null
    : null;
  const feelLabel = FEEL_OPTIONS.find((o) => o.value === (event?.mood_feel_key as string | null | undefined))?.label ?? null;
  const ceremonyLabel =
    (event?.ceremony_type as string | null | undefined)
      ? (CEREMONY_TYPE_TO_FAITH[event!.ceremony_type as string] ??
        (event!.ceremony_type === 'civil' ? 'Civil' : null))
      : null;
  const quoteBrief = briefForQuote({
    eventId: thread.event_id,
    eventTypeLabel: event?.event_type ? eventTypeLabel(event.event_type) : null,
    // The rail's own Target date row — one formatting site, not a third
    // (`one-long-date-everywhere` counts them); null when the rail says Not set yet.
    targetDateLabel: customerSummary.facts.find((f) => f.label === 'Target date' && !f.unknown)?.value ?? null,
    area: regionLabel(event?.region) ?? null,
    facts: customerSummary.facts,
    askedFor: railService,
    budgetBand: bandRow ? { label: bandRow.label, perHeadPhp: bandMedianPerHeadPhp(budgetBands, bandSlug) } : null,
    styleLabels: [feelLabel, ceremonyLabel].filter((v): v is string => Boolean(v)),
    lockedCategories: customerSummary.lockedCategories,
    stage: briefStage,
  });

  /**
   * THE TOOLS, MOUNTED ONCE AND CLOSED.
   *
   * ── WHY THIS EXISTS (owner, 2026-09-08: "still messy chatbox") ───────────
   * Six panels used to sit BETWEEN the last message and the text box — the
   * cross-sell picker, the proposal-template banner, Build a quote, "How did
   * this inquiry end?", the call launcher and Deal-or-meeting. The
   * conversation was left a sliver, and on a phone it was pushed off screen
   * entirely. Every one of them is still here and still works; each is now a
   * closed disclosure ABOVE the stream, opened from the customer rail's tool
   * list (the right column), which is where the owner asked the tools to live.
   *
   * 🔑 MOUNTED ONCE, NOT PER BREAKPOINT. The rail renders twice — a desktop
   * column and a mobile sheet — so putting these components inside it would
   * mount `ProposalMaker` and `SendProposalCard` twice, duplicate every form
   * and every anchor id. The rail carries LAUNCHERS (cheap, safe to duplicate);
   * the heavy tools live here, once, and the launchers open them by id.
   */
  // `cm` = which compose mode the node is drawn for: the full screen's `?compose=`, the picked client's Quotation
  // (`'quote'`) or its Chat tray (none) — one draw serves both embeds, so the nodes are built per mode (no reads here).
  const toolNodesFor = (cm: 'deal' | 'quote' | null): Record<string, React.ReactNode> => ({
    /*
      ONE QUOTE TOOL (SUP-H · AREA-CHAT, 2026-09-19). `send-proposal` and
      `build-quote` were two panels and two launchers for one job; a supplier
      following the brief's "Quote" landed in the template form and following
      its "New quote" landed in the builder. Both composers still mount — once
      each, so the gift line, the anchors and the forms stay unique — inside
      the ONE panel: the builder first (it works for every shop; production has
      no proposal template on any shop), the saved-template shortcut under it.

      THE QUOTE OPENS AT THE LIVE COUNT (owner, 2026-09-09).

      Both numbers go in and the builder seeds itself from `livePax`, falling
      back to the inquiry count when there is no live one. The binding
      prototype's booked frame shows that field pre-filled at the live figure,
      and the owner ruled for it.

      🔑 IT MOVES MONEY, WHICH IS WHY BOTH STILL RENDER. A quote opened at 170
      when the couple asked with 150 is a different price, so the builder's
      header names the seed AND the inquiry count in every state — the point of
      this whole area is that no headcount appears without saying which one it
      is.
    */
    'build-quote': (
      <div className="space-y-3">
        <ProposalMaker
          threadId={threadId}
          eventDate={event?.event_date ? String(event.event_date).slice(0, 10) : null}
          giftBasis={composerGiftBasis}
          feeStanding={composerFeeStanding}
          papicStanding={composerPapicStanding}
          shopGifts={shopGifts.basis}
          shopGiftsBuy={shopGifts.buy}
          requestedPax={thread.pax_at_inquiry ?? headerPax ?? 100}
          livePax={headerPax ?? null}
          coupleName={coupleLabel}
          packages={proposalPackages.filter((p) => !bundleIds.has(p.id))}
          cards={quoteCards}
          doors={quoteDoors}
          brief={quoteBrief}
          paymentMethods={proposalPaymentMethods}
          // Seeded only where the builder opens ON the live quote; the chat tray's builder opens empty, as before.
          revision={cm === 'quote' ? quoteRevision : null}
          // Start from · a saved quote — hidden when the shop has none (owner 2026-10-14).
          savedQuotes={proposalTemplates.map((t) => ({ id: t.id, name: t.name }))}
          // The card this couple asked about, when it is one of the shop's active cards — the quote starts from it.
          askedCardId={existingInterests.find((i) => i.vendor_service_id)?.vendor_service_id ?? null}
          todayIso={todayIso}
          viewerPromo={
            attribution?.audienceRateTerms
              ? {
                  terms: attribution.audienceRateTerms,
                  creatorName: attribution.creatorName,
                }
              : null
          }
        />
        <SendProposalCard
          eventDate={event?.event_date ? String(event.event_date).slice(0, 10) : null}
          todayIso={manilaTodayIsoFor(Date.now())}
          giftBasis={composerGiftBasis}
          feeStanding={composerFeeStanding}
          papicStanding={composerPapicStanding}
          threadId={threadId}
          templates={proposalTemplates}
          packages={proposalPackages}
        />
      </div>
    ),
    /*
      THE COUPLE'S BOOKING ASK — the customer card's own panel (`LockRequestAnswer`), answered here: the fee named
      ABOVE Agree (`forecastForBooking`, the same forecast Today and the card read), Agree = `vendorAgreeToLock`, Turn it
      down = `vendorDeclineLock` with the reason. The answer lands back in this thread (`return_to`) and the line at
      the top of the page says what it did — "You said yes. Pay the booking fee…" with its Pay door when the fee held
      the couple's news back. Null (no panel) while no ask is open.
    */
    'booking-ask':
      askOpen && lockHandshake?.eventVendorId ? (
        <LockRequestAnswer
          eventVendorId={lockHandshake.eventVendorId}
          expiresAt={lockHandshake.expiresAt}
          payoutReadiness={payoutReadiness}
          feeForecast={chatFeeForecast}
          returnTo={`/vendor-dashboard/messages/${threadId}`}
          agreeLock={vendorAgreeToLock}
          declineLock={vendorDeclineLock}
          dayCheck={dayCheck}
          waitlistAsk={vendorWaitlistTheAsk}
          heldService={heldAskService}
        />
      ) : null,
    'offer-service': <VendorOfferService threadId={threadId} options={offerOptions} />,
    'deal-or-meeting': (
        <NegotiationComposerMenu
          embedded
          entry={dealEntry}
          // `quote` is the Build-a-quote panel's mode, not this menu's.
          initialMode={cm === 'deal' ? 'deal' : null}
          threadId={threadId}
          returnPath={`/vendor-dashboard/messages/${threadId}`}
          eventDate={event?.event_date ?? null}
        />
    ),
    // ❓ Questions for the couple — every supplier (owner 2026-11-04, "Yes, every supplier"): their own set, sent
    // into this event with one press; the couple answers in their event, the answers return to the customer card.
    'questions-for-couple': (
      <QuestionsSendPanel
        supabase={supabase}
        threadId={threadId}
        eventId={thread.event_id}
        vendorProfileId={profile.vendor_profile_id}
        coupleName={coupleLabel}
      />
    ),
    'log-outcome': outcomeCapture,
  });
  const toolNodes = toolNodesFor(composeMode);
  // 📌 The open booking ask as a pin fact (Build 3) — keyed by its own deadline, so a NEW ask is a new blocker.
  const askPin: PinFact | null =
    askOpen && lockHandshake?.eventVendorId
      ? {
          key: `booking_ask:${lockHandshake.eventVendorId}:${lockHandshake.expiresAt ?? 'open'}`,
          kind: 'booking_ask',
          title: 'They asked to book you',
          answerer: 'you',
          themName: coupleLabel,
          sinceMs: 0,
          dueMs: lockHandshake.expiresAt ? Date.parse(lockHandshake.expiresAt) : null,
        }
      : null;

  const pinFacts: PinFact[] = [...(askPin ? [askPin] : []), ...chatPins.facts];
  // 🚦 THE ONE BLOCKER — the booking ask first (its own panel answers it), else the oldest blocking fact this page has
  // an answer for: an expired quotation (Send a new quotation, seeded from the old one), an overdue booking fee (its
  // pay page), an unset call time within 7 days (their Schedule), a change they asked for within 7 days (Decline | Accept). Each answer is a door the supplier already has.
  const blockFact =
    askPin && toolNodes['booking-ask']
      ? askPin
      : firstBlocker(chatPins.facts, { nowMs: Date.now(), eventDate: event?.event_date ?? null }, ['quote_expired', 'booking_fee', 'call_time', 'change_approval']);
  const chatBlocker = (() => {
    if (!blockFact) return null;
    const kind = BLOCKER_OF[blockFact.kind];
    if (!kind) return null;
    const base = { pinKey: blockFact.key, kind, subjectKey: blockFact.key, title: blockFact.title };
    if (blockFact.kind === 'booking_ask' && lockHandshake?.eventVendorId) {
      return {
        ...base,
        topic: 'quote' as const,
        title: 'They asked to book you',
        why: 'Nothing is booked, and their date is not held for you, until you answer.',
        action: (
          <LockRequestAnswer
            layout="blocker"
            eventVendorId={lockHandshake.eventVendorId}
            expiresAt={lockHandshake.expiresAt}
            payoutReadiness={payoutReadiness}
            feeForecast={chatFeeForecast}
            returnTo={`/vendor-dashboard/messages/${threadId}`}
            agreeLock={vendorAgreeToLock}
            declineLock={vendorDeclineLock}
            dayCheck={dayCheck}
            waitlistAsk={vendorWaitlistTheAsk}
            heldService={heldAskService}
          />
        ),
      };
    }
    if (blockFact.kind === 'quote_expired') {
      return {
        ...base,
        topic: 'quote' as const,
        why: 'They can’t accept it any more. Send a new one — it opens filled in from the old quotation.',
        action: (
          <ActionButton tone="brand" main icon={<Send aria-hidden strokeWidth={1.9} />} label="Send a new quotation" href="?compose=quote" className="!h-11 !min-h-11 w-full" />
        ),
      };
    }
    if (blockFact.kind === 'booking_fee') {
      const payHref = `/vendor-dashboard/booking-fees/${blockFact.key.slice('booking_fee:'.length)}`;
      return {
        ...base,
        topic: 'payment' as const,
        why: 'The booking fee is past its day. Pay it to keep working on this event.',
        action: (
          <ActionButton tone="brand" main icon={<Wallet aria-hidden strokeWidth={1.9} />} label="Pay the booking fee" href={payHref} className="!h-11 !min-h-11 w-full" />
        ),
      };
    }
    if (blockFact.kind === 'change_approval') {
      return {
        ...base,
        topic: 'quote' as const,
        why: 'Their day is a week away or less. Answer it here, or return to the chat to counter.',
        action: (
          <BlockerChangeRow
            threadId={threadId}
            amendmentId={blockFact.key.slice('adjustment:'.length)}
            returnTo={`/vendor-dashboard/messages/${threadId}`}
          />
        ),
      };
    }
    if (blockFact.kind === 'call_time') {
      const scheduleHref = `/vendor-dashboard/clients/${thread.event_id}?tab=schedule`;
      return {
        ...base,
        topic: 'schedule' as const,
        why: 'Their event is a week away or less, and your part of the day has no time yet.',
        action: (
          <ActionButton tone="brand" main icon={<CalendarDays aria-hidden strokeWidth={1.9} />} label="Set your call time" href={scheduleHref} className="!h-11 !min-h-11 w-full" />
        ),
      };
    }
    return null;
  })();

  const toolsMounted = thread.inquiry_status === 'accepted';

  /* ⚠ CLOSED MEANS INVISIBLE, NOT "A ROW YOU CAN OPEN".
     The first cut of this rendered six collapsed strips above the stream, which
     is the SAME WALL the owner asked to be rid of, one row shorter — the
     conversation was still a sliver at the bottom of the screen. Owner, seeing
     it live: "This is so confusing."

     A closed tool now takes NO SPACE AT ALL (`[&:not([open])]:hidden`). The
     middle column is the conversation and the box you write in; a tool appears
     only when it is summoned from the list on the right, one at a time, with a
     way to put it away again. The components still mount ONCE, here, which is
     what keeps the rail cheap and every anchor id unique. */
  const vendorToolsFor = (cm: 'deal' | 'quote' | null) => {
    const nodes = cm === composeMode ? toolNodes : toolNodesFor(cm);
    return toolsMounted ? (
      <div>
        {/* A panel whose body is null (the booking ask, while none is open) is not drawn at all. */}
        {VENDOR_THREAD_PANELS.map((t) => nodes[t.id] == null ? null : (
          <ThreadToolPanel
            key={t.id}
            id={t.id}
            label={t.label}
            hint={t.hint}
            // `?compose=deal` opens the deal panel; `?compose=quote` (S5) opens
            // Build a quote, seeded from the live quote — both on the server,
            // so the link lands on an OPEN panel, never a page that looks unchanged.
            open={
              (t.id === affordancePanelId('deal') && cm === 'deal') ||
              (t.id === 'build-quote' && cm === 'quote')
            }
          >
            {nodes[t.id]}
          </ThreadToolPanel>
        ))}
      </div>
    ) : null;
  };
  const vendorTools = vendorToolsFor(composeMode);

  // ⚠ ONE derivation of a couple's two letters, shared with the conversation
  // column. Two copies is how one screen comes to show `CI` beside another
  // showing `C`.
  const railInitials = initialsFor(coupleLabel);
  const decisionGuestCounts = paxProposalsToGuestCounts(paxProposals, Date.now());


  /**
   * WHERE YOU STAND — the SAME derivation the couple's thread page and bench
   * card use (S6), read in the supplier's voice.
   *
   * Until 2026-09-10 this page had no standing line, because the sentence
   * spoke only in the couple's second person and would have told a supplier
   * "waiting on you" about a quote they were waiting on. The subject now turns
   * around inside `buildSupplierStanding` via `viewer`, so the two sides can
   * never be told different facts about one conversation — and there is still
   * exactly one sentence, not a supplier copy of it.
   *
   * The rung is `railStage`, the one the header pill already shows, so the
   * pill and this line cannot contradict each other.
   */

  const lastThreadMessage = initialMessages[initialMessages.length - 1];
  const threadStanding = buildSupplierStanding({
    viewer: 'vendor',
    stage: railStage,
    hasThread: true,
    quotedAmountPhp: liveQuoteTotalPhp,
    lastSpeaker:
      lastThreadMessage == null
        ? null
        : lastThreadMessage.sender_role === 'vendor'
          ? 'vendor'
          : lastThreadMessage.sender_role === 'couple'
            ? 'couple'
            : null,
    lastSaidAtMs: lastThreadMessage ? Date.parse(lastThreadMessage.created_at) || null : null,
    nowMs: standingNowMs,
    depositPaid: standingExtras?.depositPaid ?? false,
    meeting: standingExtras?.meeting ?? null,
    // THE ONE guestCounts object this page reads its headcounts from.
    guestCounts,
  });

  const railProps = {
    displayName: coupleLabel,
    summary: customerSummary,
    initials: railInitials,
    stage: { label: THREAD_STAGE_LABEL[railStage], tone: THREAD_STAGE_TONE[railStage] },
    service: railService,
    threadId,
    eventId: thread.event_id,
    // Inquiry-source chip (PR-C · owner taxonomy) — PRIVATE to the vendor; NULL resolves to "Website Inquiry". The
    // returning flag is a COMPANION chip: it combines with any origin, never replaces it.
    source: { label: sourceChipLabel, returning: thread.is_returning ? RETURNING_CUSTOMER_LABEL : null },
  };

  /*
    WHAT DECIDES EACH ROW OF THE ＋ TOOLS SHEET — facts this page already holds, no extra read. `hasAgreement` is
    read from the STAGE VALUE through the exhaustive map, never from the stage pill's label beside it: the pill is
    display text, and "Your call time" / "Ask for a payment" open only once they book you.
  */
  const toolsState = {
    hasAgreement: THREAD_STAGE_HAS_AGREEMENT[railStage],
    askOpen,
    paymentsToConfirm: pendingPayments.length,
    guestCountChanges: paxProposals.length,
  };

  /* THE ANSWER LINE — the couple's initials, their date and the day's answer (`ThreadAnswerLine`). */
  const eventDay = event?.event_date ? String(event.event_date).slice(0, 10) : null;
  const answerLine = (
    <ThreadAnswerLine
      initials={railInitials}
      eventDay={eventDay}
      todayIso={todayIso}
      answer={dayAnswer}
      askOpen={askOpen && toolsMounted}
    />
  );

  /* QUICK REPLIES — offered only while the couple spoke last, so they never sit over a conversation the supplier
     already answered; "Yes po, that day is free" only on an open day (`quickRepliesFor`). */
  const lastFromCouple = lastThreadMessage?.sender_role === 'couple';
  const quickReplies = quickRepliesFor(dayAnswer);

  msgTimer.flush();

  /* 🔴 A SHIPPED FEATURE NOBODY COULD REACH. `<VendorEventDayPrepCta>` — the
     supplier's "have the day ready offline" card — has existed since iteration
     0036 with ZERO mount sites: the couple's twin `<EventDayPrepCta>` is mounted
     on their event home, and the supplier's was never given a home at all. This
     thread page is the one screen that already holds every prop it needs.

     ⚖ GATED ON `booked`, deliberately. The component's own docblock scopes it to
     "a single upcoming event the vendor has a CONTRACTED relationship with", and
     an ASKED supplier must not be nudged to pull down a run-of-show they have
     not earned — the same boundary PR-H draws. Nothing is widened either way:
     the action runs on the RLS-bound user client, so a supplier can only cache
     what they could already read. The card also self-gates to the T-3 → T+1
     window, so on most days it renders nothing at all. */
  const showDayPrep = railStage === 'booked' && Boolean(event?.event_date);

  /*
    ── ONE CHAT BOX (owner-approved layout, 2026-09-18) ─────────────────────
    One bordered frame (`ChatBox`): header · one-line privacy notice · the
    cards that must stay in sight (a logged payment to confirm) · Chat /
    Decisions / Files · the conversation · the composer row with the deal and
    call icons on it · and, below, the nine closed tool panels. The couple's
    page is the same frame, so the two sides read as one product.

    The row is a FIXED height, which is what keeps a long thread scrolling
    inside its own box with the composer pinned under it, and `min-h-[27rem]`
    is its floor: on a 320px phone the row outgrows the viewport and the page
    scrolls, rather than the frame clipping its own composer. The middle column
    scrolls ITSELF (`min-h-0 overflow-y-auto`) so an open tool — "Build a
    quote" is taller than a laptop screen — pushes the conversation down to
    its floor instead of flattening it; the panel body scrolls inside the
    panel past 55dvh.
  */
  const blocked = blockState.blockedByMe || blockState.blockedByThem;
  const askLines = await askLinesRead;

  /*
    📦 ARCHIVE LIVES IN THE CHAT NOW (owner 2026-10-28: the Customers list IS the messages, so the Messages fold and
    its per-row archive button are gone). ⋮ › "Archive this chat" takes it off Customers' list (into "Archived and
    closed chats"); a new message brings it back on its own. Read AFTER the mark-read write, which upserts the same
    row — the shop's own marker (RLS scopes it), archived ⇔ marked no earlier than the last message (`lib/chat.ts`).
    ⚠ Unread → no archive item at all, never one that claims the wrong state.
  */
  /*
    THE PICKED CLIENT'S OWN TWO READS (Build 2 #42) — only in its draw, started together before the archive read:
    the quote versions (the Quotation's version line, as before — now also carrying each quote's title and decided
    date, so the SAME rows answer Details' quote decisions) and the meeting / adjustment rows the messages announce
    (what the stream reads in the browser; read here only when a message carries one — most threads read nothing).
  */
  const versionRowsRead = embedded
    ? supabase
        .from('vendor_proposals')
        .select(`${QUOTE_VERSION_SELECT}, title, resolved_at`)
        .eq('event_id', thread.event_id)
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .neq('status', 'draft')
        .order('created_at', { ascending: true })
        .limit(50)
    : null;
  const decisionCardsRead = embedded ? readDecisionCards(supabase, initialMessages) : null;

  await markedRead;
  const { data: archiveMark, error: archiveMarkError } = await supabase
    .from('chat_thread_reads')
    .select('archived_at')
    .eq('thread_id', threadId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (archiveMarkError) {
    logQueryError('VendorThreadPage.archiveMark', archiveMarkError, { thread_id: threadId }, 'graceful_degrade');
  }
  const archivedAt = (archiveMark as { archived_at?: string | null } | null)?.archived_at ?? null;
  const threadArchive = archiveMarkError
    ? null
    : {
        archived: Boolean(archivedAt && new Date(archivedAt).getTime() >= new Date(thread.updated_at).getTime()),
        returnTo: '/vendor-dashboard/customers',
      };

  // The SAME three actions this page's own sections post to — the payment-confirm row and the guest-count surcharge
  // card. One way to answer each request; the stream's Decisions AND Details' Decisions (Build 2 #42) are doors to it.
  const decisionReplyActions = {
    confirmPayment: confirmVendorPayment,
    refusePayment: refuseVendorPayment,
    applySurcharge: acceptPaxSurcharge,
    holdPrice: declinePaxSurcharge,
    // The answer to a booking ask — the SAME two actions the Overview and the client page post (2026-09-19).
    agreeLock: vendorAgreeToLock,
    declineLock: vendorDeclineLock,
  };

  /*
    THE CHAT PAGE (THE ONE BUILD, v111/v113 · B1 step 7) — the SAME box, drawn inside the picked client: no
    conversation list, no full-screen head; the stream draws the hosts strip and labels each host's run.
  */
  const chatBox = (
        <ChatBox
          // THE ONE BUILD · inside the picked client the client's pinned row IS the head (and the hosts strip sits
          // in the stream), so the full-screen head is drawn only on the full-screen route.
          header={
            embedded ? null : (
            <ChatThreadHead
              back={<BackButton route="/vendor-dashboard/messages/[threadId]" params={{ threadId }} variant="chat" />}
              // The chat is the EVENT (owner 2026-10-28, "User's event (date)"); pressing it opens the customer card.
              nameHref={`/vendor-dashboard/clients/${thread.event_id}?tab=details`}
              name={
                <>
                  {eventChatTitle({
                    name: event?.display_name ?? null,
                    kind: event?.event_type && event.event_type !== 'unspecified' ? eventTypeLabel(event.event_type) : null,
                    date: event?.event_date ?? null,
                    nowMs: Date.now(),
                    options: dateOptions,
                  })}
                  {founderInquiry ? (
                    <span className="ml-2 inline-block rounded-full bg-terracotta/15 px-2 py-0.5 align-middle font-mono text-[9px] uppercase tracking-[0.15em] text-terracotta-700">
                      {FOUNDER_BADGE_LABEL}
                    </span>
                  ) : null}
                </>
              }
              initials={railInitials}
              // ONE muted line: what they asked about · the date, as a date ("December 18, 2026", never the raw ISO
              // key — owner 2026-09-08) · the live count, naming the inquiry count whenever the two differ.
              line={
                <>
                  <ThreadInterestChips supabase={supabase} threadId={threadId} compact />
                  {event?.event_date ? <span>{formatLongDate(event.event_date)}</span> : dateOptions ? <span>{dateOptions}</span> : null}
                  {guestCountLine(guestCounts) ? (
                    <span className="text-terracotta-700">
                      Planning for {guestCountLine(guestCounts)}
                    </span>
                  ) : null}
                </>
              }
              actions={
                <>
                {/* "Customer" opens the customer card as a sheet, at every width — the same head as the couple's, with
                    the chat keeping the whole column (the card was a docked column from 1024 until 2026-10-29). The
                    private inquiry-source and returning chips are on that card now, not a second row under the name. */}
                <ChatInfoRailTrigger {...railProps} />
                <BookedCallButtons booked={shopBooked} phone={couplePhone} who={event?.display_name ?? 'the couple'} />
                <ChatThreadMenu
                  threadId={threadId}
                  returnTo={`/vendor-dashboard/messages/${threadId}`}
                  blockedByMe={blockState.blockedByMe}
                  archive={threadArchive}
                  // The client page's sections live behind ⋮ (One Chat Box,
                  // 2026-09-18). That page used to embed its own copy of this
                  // conversation; it now sends a chat landing HERE, and these
                  // are the way back to what it still holds. Each names a
                  // `?tab=` — a bare link would bounce straight back to this
                  // frame.
                  links={[
                    { href: `/vendor-dashboard/clients/${thread.event_id}?tab=quote`, label: 'Quote & payments', icon: 'quote' },
                    { href: `/vendor-dashboard/clients/${thread.event_id}?tab=files`, label: 'Files & contracts', icon: 'files' },
                    { href: `/vendor-dashboard/clients/${thread.event_id}?tab=schedule`, label: 'Schedule', icon: 'schedule' },
                    { href: `/vendor-dashboard/clients/${thread.event_id}?tab=details`, label: 'Full customer profile', icon: 'customer' },
                  ]}
                />
                </>
              }
            />
            )
          }
          notice={
            <>
              {/* THE ANSWER TO A BOOKING ASK, with its Pay door — inside the box, so a phone sees it (it sat above the
                  box until 2026-10-29, where the full-screen takeover covered it). */}
              {lockAnswer ? (
                <p
                  role={lockAnswer.tone === 'refused' ? 'alert' : 'status'}
                  // A band across the box, like the answer line under it — no frame: nothing here is pressed but the door.
                  className={`border-b border-ink/10 px-3.5 py-2 text-[13px] ${
                    lockAnswer.tone === 'refused' ? 'bg-danger-50/60 text-danger-900' : 'bg-mulberry/[0.06] text-ink'
                  }`}
                  data-lock-answer=""
                >
                  {lockAnswer.text}
                  {lockAnswer.door ? (
                    <>
                      {' '}
                      <Link href={lockAnswer.door.href} className="font-semibold text-sn-accent underline underline-offset-2" data-lock-answer-door="">
                        {lockAnswer.door.label}
                      </Link>
                    </>
                  ) : null}
                </p>
              ) : null}
              {answerLine}
              {embedded ? null : <ChatPrivacyNotice inBox viewer="vendor" />}
            </>
          }
          pinned={
            /* The cards that must stay in sight. Empty for most threads, and
               then it takes no space at all (`empty:hidden`). The band carries
               the `pending-payments` id the rail's "Log payment" reveals. */
            <div
              id="pending-payments"
              className="max-h-[40dvh] space-y-2 overflow-y-auto scroll-mt-24 border-b border-ink/10 px-3 py-2 empty:hidden sm:px-4"
            >
      {/* 📋 THEIR ASK — the inquiry card at the top of a first chat (supplier dashboard v13): the event's fixed lines, then
          Decline · Ask a question · Accept (Accept starts a quote here). The band under the conversation keeps the
          shipped "Talk to them" — the same answer, one more door. */}
      {askLines && thread.inquiry_status === 'pending' ? (
        <section data-chat-inquiry-card="" aria-label="Their ask" className="pb-2">
          <p className="home-k2 pt-1">
            <InfoTip label="Their ask" align="start">
              What they asked, read from their event before you answer. Accept says yes and starts a quote; Ask a question
              says yes and opens the chat to type; Decline tells them kindly. Nothing is booked until they ask to book.
            </InfoTip>
          </p>
          <EventLinesBody lines={askLines} />
          {/* 💬 Inside the picked client (owner 11 Nov, "Accepted it and still did not show the chatbox") Ask and Accept stay
              IN its Chat page — never out to another screen; full screen, Accept starts the quote in this chat as shipped. */}
          <InquiryAnswers
            threadId={threadId}
            returnTo={`/vendor-dashboard/messages/${threadId}`}
            pinned
            {...(embedded
              ? { chatHref: `/vendor-dashboard/clients/${thread.event_id}?tab=chat` }
              : { acceptTo: `/vendor-dashboard/messages/${threadId}?compose=quote` })}
            acceptInquiry={acceptInquiry}
            declineInquiry={declineInquiry}
          />
        </section>
      ) : null}
      {showDayPrep ? (
        <VendorEventDayPrepCta
          threadId={threadId}
          eventId={thread.event_id}
          eventDisplayName={coupleLabel}
          eventDate={event?.event_date ?? null}
        />
      ) : null}

      {/* Creator Economy PR-C — the influencer-referral context (vendor-private).
          Names the storyteller + chapter behind this inquiry and restates the
          audience rate the vendor promised, so the promo is honored at quote
          time. The collab-active marker below covers the OTHER money moment:
          the inquirer themself holds an accepted collab → creator rate. */}
      {attribution ? (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50/60 p-4 text-sm text-ink">
          <p>
            <span className="mr-1.5 inline-block rounded-full bg-amber-200/70 px-2 py-0.5 align-middle font-mono text-[9px] uppercase tracking-[0.15em] text-amber-900">
              Influencer Recommendation
            </span>
            Referred by{' '}
            {attribution.creatorSlug ? (
              <Link
                href={`/u/${attribution.creatorSlug}`}
                className="font-semibold hover:underline"
              >
                {attribution.creatorName}
              </Link>
            ) : (
              <span className="font-semibold">{attribution.creatorName}</span>
            )}{' '}
            · via{' '}
            {attribution.creatorSlug ? (
              <Link
                href={`/u/${attribution.creatorSlug}/c/${attribution.chapterPublicId}`}
                className="italic hover:underline"
              >
                {attribution.chapterTitle}
              </Link>
            ) : (
              <span className="italic">{attribution.chapterTitle}</span>
            )}
          </p>
          {attribution.audienceRateTerms ? (
            <p className="mt-1 text-ink/75">
              You promised their viewers:{' '}
              <span className="font-medium text-ink">
                {attribution.audienceRateTerms}
              </span>{' '}
              — honor it when you quote. The discount settles off-platform;
              Setnayan never touches the money.
            </p>
          ) : null}
        </div>
      ) : null}
      {inquirerCollabActive ? (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50/60 p-4 text-sm text-ink">
          <span className="mr-1.5 inline-block rounded-full bg-amber-200/70 px-2 py-0.5 align-middle font-mono text-[9px] uppercase tracking-[0.15em] text-amber-900">
            Creator collab active
          </span>
          This inquirer holds an accepted collab with you — your agreed creator
          rate applies.
        </div>
      ) : null}

      {/* Pending surcharge confirms (Adaptive Pax Pricing Phase 5) — the count
          moved a booked service's cost; nothing changes until the vendor taps
          Accept. Symmetric: a drop shows a credit. Owner-locked confirm flow. */}
      <div id="guest-count" className="space-y-2 scroll-mt-24 empty:hidden">
      {paxProposals.map((p) => {
        const up = p.delta > 0;
        return (
          <div
            key={p.eventVendorId}
            className="rounded-xl border border-terracotta/30 bg-terracotta/5 p-4"
          >
            <p className="text-sm font-semibold text-ink">
              Guest count changed — {p.label}
            </p>
            <p className="mt-1 text-sm text-ink/70">
              Now planning for <span className="font-semibold">{formatCount(p.livePax)}</span> guests
              (you quoted ~{formatCount(p.quoteBasePax)}). At {peso(p.ratePhp)}/guest, your total
              would {up ? 'increase' : 'decrease'} by{' '}
              <span className="font-semibold text-terracotta-700">
                {up ? '+' : '−'}{peso(p.delta)}
              </span>
              .
            </p>
            <div className="mt-3 flex gap-2">
              <form action={acceptPaxSurcharge}>
                <input type="hidden" name="event_vendor_id" value={p.eventVendorId} />
                <input type="hidden" name="thread_id" value={threadId} />
                <SubmitButton
                  pendingLabel="Applying…"
                  className="inline-flex h-9 items-center rounded-lg bg-mulberry px-4 text-sm font-medium text-cream hover:bg-mulberry-600"
                >
                  {up ? `Apply +${peso(p.delta)}` : `Apply −${peso(p.delta)}`}
                </SubmitButton>
              </form>
              <form action={declinePaxSurcharge}>
                <input type="hidden" name="event_vendor_id" value={p.eventVendorId} />
                <input type="hidden" name="thread_id" value={threadId} />
                <SubmitButton
                  pendingLabel="Holding…"
                  className="inline-flex h-9 items-center rounded-lg border border-ink/15 bg-white/70 px-4 text-sm text-ink/70 hover:border-ink/40"
                >
                  Hold price
                </SubmitButton>
              </form>
            </div>
          </div>
        );
      })}
      </div>

      {/* Pending payment confirms + per-booking plan progress — moved into a
          live client component so the vendor's payment cards update in real
          time (Realtime on the couple-RLS payment tables, gated by the
          vendor-read policy in 20270315091571). The server still computes the
          initial state above and passes it in. */}
      <VendorPaymentLive
        threadId={threadId}
        eventId={thread.event_id}
        initialPending={pendingPayments}
        initialPlans={planProgress}
      />

            </div>
          }
          composer={
            blocked ? (
              <div className="px-2 py-1 text-sm text-ink/70">
                {blockState.blockedByMe
                  ? 'You blocked this person. Unblock from the ⋯ menu to message again.'
                  : 'You can no longer message in this conversation.'}
              </div>
            ) : thread.inquiry_status === 'accepted' ? (
              <div className="space-y-1.5">
                {proposalNotice ? (
                  <p className="rounded-xl border border-mulberry/25 bg-mulberry/[0.06] px-4 py-2.5 text-sm text-ink">
                    {proposalNotice}
                  </p>
                ) : null}
                {lastFromCouple ? (
                  <QuickReplies threadId={threadId} replies={quickReplies} sendAction={sendChatMessage} />
                ) : null}
                {/* NOTHING BETWEEN THE LAST MESSAGE AND THE BOX BUT THE BOX.
                    ＋ · message · Send (simpler supplier dashboard step 4, 2026-10-14): the grey ＋ opens ONE sheet
                    of every tool this conversation has (`thread-tools-sheet.tsx`), grouped Money · Plan · Talk & files ·
                    Just you (chat prototype 2026-10-28, frame D) — 📵 no call. The paperclip is its ONE "Share a file"
                    (file · photo · video · the contract); its input stays here so the file still rides this form, and
                    📷 · 🖼 are the composer's shortcuts into the same input. */}
                <ChatSendForm
                  threadId={threadId}
                  sendAction={sendChatMessage}
                  lead={<ThreadToolsSheet eventId={thread.event_id} state={toolsState} threadId={threadId} hasQuote={dealEntry.offerDeal} />}
                  attachInputId={CHAT_ATTACH_INPUT_ID}
                  userId={user.id}
                  // 🏪 The shop's composer: this login may also host the event — here it speaks as the shop.
                  sentAs="vendor"
                  wordsOnly={await feeWordsOnlyRead}
                />
              </div>
                  ) : thread.inquiry_status === 'pending' ? (
        <div className="space-y-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-4">
          {/* 🧾 RW-24 (walk 13 Nov 2026): a quote sent before saying yes is refused — the notice is said HERE, on the
              pending inquiry, where it used to be drawn only for an open conversation (so the refusal was silent). */}
          {proposalNotice ? (
            <p role="status" data-proposal-notice="pending" className="rounded-xl border border-mulberry/25 bg-mulberry/[0.06] px-4 py-2.5 text-sm text-ink">
              {proposalNotice}
            </p>
          ) : null}
          {/* TALK TO THEM (prototype `inquiry`: "New inquiry · Say yes to talk — nothing is booked yet"). The
              shipped accept-to-reply, in plain words: it opens the conversation, it books nothing. */}
          <p className="text-sm text-ink">
            <span className="font-semibold">New inquiry.</span> Say yes to talk — nothing is booked yet.
          </p>
          {/* The facts a supplier decides on. These came from the gated
              get_pending_inquiry_basics RPC, which returned four deliberately
              NON-IDENTIFYING fields for a masked lead; they now come from the
              same admin-scoped `events` read that feeds the header, so the name
              above and the chips here can no longer disagree. Null-safe. */}
          {event ? (
            <div className="flex flex-wrap gap-1.5">
              {event.event_date ? (
                <span className="inline-flex items-center rounded-full bg-terracotta/15 px-2.5 py-1 text-xs font-medium text-terracotta-700">
                  {/* The chip a supplier reads before Accept/Decline. It showed
                      the raw ISO key while the line below it said "18 Dec." and
                      the header said something else again — three renderings of
                      one wedding day on one screen (owner 2026-09-08). */}
                  {formatLongDate(event.event_date)}
                </span>
              ) : dateOptions ? (
                <span className="inline-flex items-center rounded-full bg-terracotta/15 px-2.5 py-1 text-xs font-medium text-terracotta-700">
                  {dateOptions}
                </span>
              ) : null}
              {(() => {
                /* THE CHIP A SUPPLIER ACCEPTS ON. It rendered a bare "150 pax"
                   while the header above it said "~170 guests" — two numbers,
                   one screen, and nothing saying which was which. It leads with
                   the INQUIRY count, because that is the request being accepted,
                   and it now says so out loud even when there is only one number
                   to show: a missing label and a missing second number are
                   indistinguishable to the person reading. */
                const chip = guestCountChip(guestCounts, 'at_inquiry', { unit: 'pax' });
                return chip ? (
                  <span className="inline-flex items-center rounded-full bg-terracotta/15 px-2.5 py-1 text-xs font-medium text-terracotta-700">
                    {chip.label} <i className="not-italic opacity-70">· {chip.basisLabel}</i>
                  </span>
                ) : null;
              })()}
              {event.event_type ? (
                <span className="inline-flex items-center rounded-full bg-terracotta/15 px-2.5 py-1 text-xs font-medium text-terracotta-700">
                  {eventTypeLabel(event.event_type)}
                </span>
              ) : null}
              {inquiryCity ? (
                <span className="inline-flex items-center rounded-full bg-terracotta/15 px-2.5 py-1 text-xs font-medium text-terracotta-700">
                  {inquiryCity}
                </span>
              ) : null}
              {event.setnayan_ai_active ? (
                <span className="inline-flex items-center rounded-full bg-mulberry/10 px-2.5 py-1 text-xs font-semibold text-mulberry">
                  Setnayan AI · Active
                </span>
              ) : null}
            </div>
          ) : null}
          {/*
            WHO ELSE WANTS THIS DAY — the supplier's own diary, brought to the
            decision instead of left two screens away. Owner: *"Target date for
            vendors will show who are also inquiring for that day so they do not
            need to browse their calendar?"*

            🔒 COUNTS, NEVER NAMES, and never on the couple's side of this
            thread — see lib/vendor-date-demand.ts and
            lib/who-else-wants-this-date.test.ts.

            ⚠ "Accepting does not book it" is part of the line, not decoration.
            Told they already hold a booking that week, a supplier's next
            thought is whether accepting spends something; it does not.
          */}
          {vendorDateDemandLine(dateDemand) ? (
            <p className="flex items-start gap-1.5 rounded-lg bg-ink/[0.04] px-2.5 py-2 text-xs text-ink/70">
              <CalendarDays aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/45" />
              <span>
                {vendorDateDemandLine(dateDemand)} Accepting does not book it.
              </span>
            </p>
          ) : null}
          {returning ? (
            <p className="text-sm text-ink">
              <span className="mr-1.5 inline-block rounded-full bg-terracotta/15 px-2 py-0.5 align-middle font-mono text-[9px] uppercase tracking-[0.15em] text-terracotta-700">
                Returning client
              </span>
              Booked you for{' '}
              {returning.prior_event_display_name ?? 'a previous event'}.
            </p>
          ) : null}
          {/* Phase D — lead trust badge. Positive-only; shown only when the couple
              is already actively planning. A new couple gets no chip (never a
              warning), and the couple never sees this. */}
          {leadActivePlanner ? (
            <p className="text-sm text-ink">
              <span className="mr-1.5 inline-block rounded-full bg-mulberry/15 px-2 py-0.5 align-middle font-mono text-[9px] uppercase tracking-[0.15em] text-mulberry">
                Active planner
              </span>
              An engaged couple who&rsquo;s already deep in planning.
            </p>
          ) : null}
          {/* Founder-seat signal — server-asserted (founder_seats definer helper),
              never profile-editable. The one badge that must be unmistakable:
              this is the founders needing service, not a test or fake inquiry —
              and accepting costs the vendor nothing. */}
          {founderInquiry ? (
            <p className="text-sm text-ink">
              <span className="mr-1.5 inline-block rounded-full bg-terracotta/15 px-2 py-0.5 align-middle font-mono text-[9px] uppercase tracking-[0.15em] text-terracotta-700">
                {FOUNDER_BADGE_LABEL}
              </span>
              {FOUNDER_INQUIRY_NOTE}
            </p>
          ) : null}
          <PipelinePressureLine pressure={pipelinePressure} />
          <div className="flex flex-wrap gap-2">
            <form action={acceptInquiry}>
              <input type="hidden" name="thread_id" value={threadId} />
              <input
                type="hidden"
                name="return_to"
                value={`/vendor-dashboard/messages/${threadId}`}
              />
              <SubmitButton
                pendingLabel="Opening…"
                className="inline-flex h-11 items-center rounded-md bg-mulberry px-5 text-sm font-semibold text-cream hover:bg-mulberry-600"
              >
                Talk to them
              </SubmitButton>
            </form>
            <form action={declineInquiry}>
              <input type="hidden" name="thread_id" value={threadId} />
              <input
                type="hidden"
                name="return_to"
                value={`/vendor-dashboard/messages/${threadId}`}
              />
              <SubmitButton
                pendingLabel="Declining…"
                className="inline-flex h-11 items-center rounded-md border border-ink/20 px-5 text-sm font-semibold text-ink hover:bg-ink/5"
              >
                Decline
              </SubmitButton>
            </form>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {proposalNotice ? (
            <p className="rounded-xl border border-mulberry/25 bg-mulberry/[0.06] px-4 py-2.5 text-sm text-ink">
              {proposalNotice}
            </p>
          ) : null}
          {/* WHO CLOSED THIS (owner 2026-09-22). This branch is the page's bare
              `else`, so it also catches `displaced` and a withdrawn thread — it
              told a supplier "You declined this inquiry" when the COUPLE booked
              someone else or withdrew. One module decides for both sides;
              `archived_at` is required because withdrawInquiry writes only that. */}
          <div className="rounded-xl border border-ink/10 bg-ink/[0.03] p-4">
            <p className="text-sm text-ink/70">
              {
                closingCopy(
                  thread,
                  'vendor',
                  { counterpartyLabel: coupleLabel },
                ).sentence
              }
            </p>
          </div>
          {/* Won & Lost Reasons (Wave 6) — even on a decline, log WHY so your
              roll-up reflects it. */}
          {outcomeCapture}
        </div>
            )
          }
          tray={vendorTools}
        >
          <ChatMessageStream
            flush
            // THE ONE BUILD · the client's Chat page names every host (strip + run labels); full screen is unchanged.
            {...(embedded ? { hosts: customerPlan.hosts } : {})}
            // 🏪 The shop's own name for the strip: a login that also hosts this event sees the shop, then You.
            {...(embedded ? { shopLabel: profile.business_name ?? null } : {})}
            dealEntry={dealEntry}
            counterHref={`?compose=deal`}
            // S5 · "Update this quote" on the live card → Build a quote, seeded.
            reviseHref={`?compose=quote`}
            threadId={threadId}
            initialMessages={initialMessages}
            currentUserId={user.id}
            viewerRole="vendor"
            counterpartyLabel={coupleLabel}
            eventDate={event?.event_date ?? null}
            standing={threadStanding}
            decisionPayments={decisionPayments}
            decisionGuestCounts={decisionGuestCounts}
            initialView={initialView}
            // The SAME three actions this page's own sections post to — the
            // payment-confirm row and the guest-count surcharge card above. One
            // way to answer each request; Decisions is a second door to it.
            supplierReplyActions={decisionReplyActions}
            lockHandshake={lockHandshake}
            feeForecast={chatFeeForecast}
            bookedStep={bookedMoney.step}
            supplierFirstPaymentRowId={bookedMoney.firstPaymentRowId}
            bookedHistory={bookedMoney.history}
            /* The receipt the couple attached, signed through the scoped
               private signer — see the prop in chat-message-stream.tsx. */
            paymentProofUrl={bookedMoney.deposit?.proofUrl ?? null}
            payoutReadiness={payoutReadiness}
            theirLastReadAt={receipts.theirLastReadAt}
            fileExpiry={{
              eventDate: event?.event_date ?? null,
              endDate: eventFileDay?.event_end_date ?? null,
              precision: eventFileDay?.event_date_precision ?? null,
            }}
            // 📌🚦 SUPPLIER BUILD 3 — the booking ask is a BLOCKER: the whole screen until answered, then the red pin.
            // Its facts and its one action are the shipped panel (`LockRequestAnswer`: the fee forecast above Agree,
            // the ask's own expiry) — nothing re-priced or re-timed here.
            // Round 2: + the pins' real facts (payment due · call time · access · booking fee · coordinator Agree ·
            // quote expired · decisions); the oldest blocking one the supplier can answer takes the screen.
            extraPins={pinFacts}
            blocker={chatBlocker}
            pinBodies={Object.assign(decisionPinBodies(chatPins.facts), schedulePinBodies(chatPins.facts, threadId))}
            plus={{
              eventId: thread.event_id,
              returnPath: embedded ? `/vendor-dashboard/clients/${thread.event_id}?tab=chat` : `/vendor-dashboard/messages/${threadId}`,
            }}
            // 📞 Inside the picked client the routed head is not drawn — its Call · Video call stand in the picked head row
            // (title · 📞 · 🎥 · 📎 · ⚙ · ✕, v8.3), and the privacy words sit behind the strip's ⓘ instead of a notice row.
            // (Kept LAST: its JSX value closes with `/>`, and the guards that read this tag walk to the first `>`.)
            {...(embedded ? { headCalls: <BookedCallButtons booked={shopBooked} phone={couplePhone} who={event?.display_name ?? 'the couple'} />, headNote: <ChatPrivacyTip viewer="vendor" /> } : {})}
          />
        </ChatBox>
  );
  if (embedded) {
    const [versionRows, decisionCards] = await Promise.all([versionRowsRead!, decisionCardsRead!]);
    if (versionRows.error) console.error('[supplier quotation page] version rows read refused', versionRows.error);
    type VersionCardRow = QuoteVersionRow & { title: string | null; resolved_at: string | null };
    const versions = versionRows.error ? null : ((versionRows.data ?? []) as unknown as VersionCardRow[]);

    /*
      THE QUOTATION PAGE (THE ONE BUILD, v113 · B2 §2.2) — the picked client's "Quotation": the version line, then the
      SAME quote tool this page mounts in its tools panel (ProposalMaker in the owner's eleven steps + the saved-template
      shortcut), opened ON the live quote (`toolNodesFor('quote')`). Nothing re-read for it except the version rows.
    */
    const quotation = (
      <div data-picked-client-page="quotation" className="space-y-3">
        <QuoteVersionLine rows={versions} counterpartyLabel={coupleLabel} />
        {toolNodesFor('quote')['build-quote']}
      </div>
    );

    /*
      THE CHAT PAGE (THE ONE BUILD, v111/v113 · B1 step 7) — the SAME box, drawn inside the picked client: no
      conversation list, no full-screen head; the stream draws the hosts strip and labels each host's run.
    */
    const chat = (
      <div data-picked-client-page="chat" className="flex min-h-0 flex-1 flex-col">
        {/* The ONE place the picked client marks the conversation read — mounted only while Chat is shown. */}
        <MarkReadWhenShown threadId={threadId} />
        {chatBox}
      </div>
    );

    /*
      🤝 DETAILS' DECISIONS (Build 2 #42, v118 `dec`) — the list the conversation's Decisions view shows, on the picked
      client's Details page, from THIS draw: the SAME messages, the SAME live card rows, through the SAME merge
      (`threadDecisionFacts`) — 0 requests of Details' own. A refused card read is SAID (`partial`), never a shorter
      list that reads as "nothing else was decided".
    */
    const quoteCards: Record<string, DecisionQuoteCard> = {}; // filled here, then handed on as the read-only DecisionCards['quotes']
    for (const v of versions ?? []) {
      quoteCards[v.proposal_id] = {
        publicId: v.public_id,
        title: v.title ?? 'Quote',
        totalCentavos: Number(v.total_centavos) || 0,
        status: v.status,
        resolvedAt: v.resolved_at ?? null,
      };
    }
    const decisions = (
      <DetailsDecisionsList
        facts={threadDecisionFacts({
          viewer: 'vendor',
          messages: initialMessages,
          cards: {
            quotes: quoteCards,
            meetings: decisionCards.meetings,
            meetingPreviousAt: decisionCards.meetingPreviousAt,
            adjustments: decisionCards.adjustments,
          },
          payments: decisionPayments,
          guestCounts: decisionGuestCounts,
        })}
        partial={versions == null || decisionCards.refused}
        reply={{
          threadId,
          eventId: thread.event_id,
          vendorProfileId: profile.vendor_profile_id,
          // An answer given on Details lands back on Details (the actions revalidate the pathname, redirect here).
          returnPath: `/vendor-dashboard/clients/${thread.event_id}?tab=details`,
          eventDate: event?.event_date ?? null,
          supplierActions: decisionReplyActions,
        }}
      />
    );
    return { full: null, chat, quotation, decisions };
  }

  return { full: (
    // THE ONE THREAD PAGE (owner 2026-10-29, *"event dashboard chat is full screen. supplier chat not same?"*). The
    // couple's thread returns this same `ChatThreadFrame` holding one `ChatBox`; the wrapper is the event layout's own
    // content column, so the chat has the same width on both sides. Every supplier-only thing lives INSIDE the box:
    // the customer card behind the head's "Customer" (it used to be a 19rem column docked beside the chat from 1024),
    // the answer to a booking ask in the notice band (it used to sit ABOVE the box, under the phone's takeover).
    <div className="mx-auto w-full px-4 pb-6 pt-3 sm:px-6 sm:pt-6 lg:px-8">
    <ChatThreadFrame
      // LIST · CONVERSATION (owner 2026-09-08) — the list from xl, where there is room for it beside the conversation.
      list={
        <ConversationColumn
          rows={conversationRows}
          activeThreadId={threadId}
          side="vendor"
          hrefBase="/vendor-dashboard/messages"
        />
      }
    >
        {chatBox}
    </ChatThreadFrame>
    </div>
  ), chat: null, quotation: null, decisions: null };
}

/**
 * The meeting and adjustment rows the messages announce — the SAME columns the stream reads in the browser for its
 * cards (`chat-message-stream.tsx`), read here only for the picked client's draw (Details' Decisions), under the
 * supplier's OWN session (RLS: the same rows the stream would see). Nothing is read when no message carries one, or
 * while the negotiation cards are switched off (the stream reads none then either). `refused` = a read failed: the
 * caller SAYS so rather than drawing a shorter list as if it were whole.
 */
async function readDecisionCards(
  supabase: Awaited<ReturnType<typeof createClient>>,
  messages: ReadonlyArray<{ appointment_id?: string | null; amendment_id?: string | null }>,
): Promise<Pick<DecisionCards, 'meetings' | 'meetingPreviousAt' | 'adjustments'> & { refused: boolean }> {
  const out: Pick<DecisionCards, 'meetings' | 'meetingPreviousAt' | 'adjustments'> & { refused: boolean } = {
    meetings: {},
    meetingPreviousAt: {},
    adjustments: {},
    refused: false,
  };
  if (!chatNegotiationEnabled()) return out;
  const apptIds = [...new Set(messages.map((m) => m.appointment_id).filter((x): x is string => !!x))];
  const amIds = [...new Set(messages.map((m) => m.amendment_id).filter((x): x is string => !!x))];
  const none = Promise.resolve({ data: [] as unknown[], error: null });
  const [appts, ams, items] = await Promise.all([
    apptIds.length > 0
      ? supabase
          .from('event_appointments')
          .select('appointment_id, custom_label, scheduled_at, status, initiated_by, previous_scheduled_at')
          .in('appointment_id', apptIds)
      : none,
    amIds.length > 0
      ? supabase
          .from('proposal_amendments')
          .select('amendment_id, status, raised_by, note, locked_at')
          .in('amendment_id', amIds)
      : none,
    amIds.length > 0
      ? supabase.from('proposal_amendment_items').select('amendment_id, amount_php').in('amendment_id', amIds)
      : none,
  ]);
  for (const [label, res] of [
    ['appointments', appts],
    ['amendments', ams],
    ['amendment items', items],
  ] as const) {
    if (res.error) {
      out.refused = true;
      logQueryError(`VendorThreadPage.decisionCards.${label}`, res.error, {}, 'graceful_degrade');
    }
  }
  for (const a of (appts.data ?? []) as Array<{
    appointment_id: string;
    custom_label: string | null;
    scheduled_at: string | null;
    status: string;
    initiated_by: 'couple' | 'vendor' | null;
    previous_scheduled_at: string | null;
  }>) {
    (out.meetings as Record<string, DecisionCards['meetings'][string]>)[a.appointment_id] = {
      label: a.custom_label?.trim() || 'Meeting',
      scheduled_at: a.scheduled_at,
      status: a.status,
      initiated_by: a.initiated_by,
    };
    (out.meetingPreviousAt as Record<string, string | null>)[a.appointment_id] = a.previous_scheduled_at;
  }
  const itemsByAm = new Map<string, Array<{ amount_php: number | null }>>();
  for (const it of (items.data ?? []) as Array<{ amendment_id: string; amount_php: number | string | null }>) {
    const arr = itemsByAm.get(it.amendment_id) ?? [];
    arr.push({ amount_php: it.amount_php == null ? null : Number(it.amount_php) });
    itemsByAm.set(it.amendment_id, arr);
  }
  for (const a of (ams.data ?? []) as Array<{
    amendment_id: string;
    status: string;
    raised_by: 'couple' | 'vendor' | null;
    note: string | null;
    locked_at: string | null;
  }>) {
    (out.adjustments as Record<string, DecisionCards['adjustments'][string]>)[a.amendment_id] = {
      data: { note: a.note, status: a.status, lockedAt: a.locked_at, raised_by: a.raised_by },
      items: itemsByAm.get(a.amendment_id) ?? [],
    };
  }
  return out;
}
