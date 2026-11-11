/**
 * /dev/supplier-chat-lab — the supplier's conversation, simpler-dashboard step 4, on fixture data: no sign-in, no
 * database. DEV-ONLY: production builds 404 this route (`the-lab-never-ships.test.ts`).
 *
 * Draws the REAL pieces the thread page mounts — the frame (`ChatBox`), the answer line, the quick replies, the ＋
 * Tools sheet on the real composer, the tray of tool panels with the customer card's booking-ask panel and the
 * one-screen quote (`ProposalMaker`, fed a `labSeed` so it opens filled without a server call) — inside the supplier's
 * REAL shell and the ONE thread frame (`ChatThreadFrame`), with the shared head and the shared stream (fixture
 * messages; Realtime cannot connect here). The "New inquiry" bar is a stand-in: the bar is the page's own.
 *
 *   ?m=inquiry   a new inquiry — the answer line, "Talk to them"
 *   ?m=tools     an accepted conversation, the couple spoke last — quick replies, ＋ beside the field (tap it)
 *   ?m=ask       the couple asked to book — "They asked to book" on the answer line, the panel open: fee BEFORE Agree
 *   ?m=agreed    …pressed Agree, the fee held the couple's news back — the live sentence and its Pay door
 *   ?m=quote     Send a quote — the one-screen quote, open   &gifts=1 · &gifts=over · &gifts=short (Gifts from you)
 *                &gifts=plus (their event has Event Plus · this one makes it Pro) · &gifts=pro (their event has Pro)
 *   ?m=full      the couple's date is full — no "Yes po, that day is free"
 *   &booked=1    the couple already booked you — every tool open
 *   &doors=1     (with m=quote) the quote's three doors (owner 11 Nov 2026): two fitting offers + one that does not,
 *                one saved bundle in "Start from", ＋ Make a new card last in the cards picker   &doors=locked  both 🔒
 *   &embed=quotation  THE ONE BUILD — the picked client's Quotation page: the quote tool alone, full width
 *   &hosts=1     THE ONE BUILD (8 Nov 2026) — the picked client's Chat: the hosts strip on top, each host's run named
 *                (sample hosts; the first is the fixture couple sender)
 *   ?m=chats     the supplier's Chats (✉): one row per event, Messenger order — "Unread · pinned", then "Recent"; two rows
 *                carry Lane B's 🚦 "needs you" dot (fixture levels: one blocker, one due-now)
 *     &pick=<id>&page=chat|details|…   Build 3 · Lane A — a row opens the picked client OVER the still-drawn list, on Chat
 *                (the real `PickedClientShell`; its Chat body is `LabPickedChat`; the other pages are lab lines)
 *
 *   — Supplier Build 3 · lane B —
 *   &pins=1      two automatic pins (a payment due tomorrow, a guest-count change) + one waiting on the couple
 *   &run=meeting a (+) Meeting card open at the foot: the Running-topic pin, the (+) shut   &shut=1 the tap's toast
 *   &decide=1    an open decision pin — tap it: the opened decision rises (fixture filed rows) · &decide=refused its refused read
 *   &blocker=1   (with m=ask) the booking ask's full-screen blocker   &shown=1|2|3 (5/30/60 s)   &left=N a fixed second
 *
 * The forms post the REAL actions; pressing them here needs a supplier's session (the lab draws, it does not book).
 * Names are samples: nobody real.
 */
import { GIFT_LIMIT_PCT_DEFAULT } from '@/lib/setnayan-gift';
import { notFound } from 'next/navigation';
import { shopGiftPacksFrom } from '@/lib/shop-gifts';
import { ChatBox } from '@/app/_components/chat/chat-box';
import { ThreadToolPanel } from '@/app/_components/chat/thread-tool-panel';
import { ChatThreadFrame } from '@/app/_components/chat/chat-thread-frame';
import { ChatThreadHead } from '@/app/_components/chat/chat-thread-head';
import { ChatMessageStream } from '@/app/_components/chat-message-stream';
import { ChatThreadMenu } from '@/app/_components/chat-thread-menu';
import { BackButton } from '@/app/_components/back-button';
import { SupplierLabShell } from '@/app/dev/_components/supplier-lab-shell';
import { ChatInfoRailTrigger } from '@/app/vendor-dashboard/messages/[threadId]/_components/chat-info-rail';
import { THREAD_STAGE_LABEL, THREAD_STAGE_TONE } from '@/lib/vendor-thread-stage';
import { LAB_EVENT, LAB_MESSAGES, LAB_STAFF, LAB_USER } from '@/app/dev/chat-lab/fixtures';
import { dealEntryFor } from '@/lib/deal-entry';
import { ChatSendForm } from '@/app/_components/chat-send-form';
import { BookedCallButtons } from '@/app/_components/chat/booked-call-buttons';
import { ChatPrivacyNotice } from '@/app/_components/chat-privacy-notice';
import { ProposalMaker } from '@/app/_components/proposal-maker';
import { blankOffer, type Offer } from '@/lib/offers';
import { papersProgress } from '@/lib/locks';
import { quoteSeedFromBundle } from '@/lib/quote-from-bundle';
import type { QuoteDoors } from '@/lib/quote-doors';
import { VendorOfferService } from '@/app/vendor-dashboard/messages/[threadId]/_components/vendor-offer-service';
import { ThreadToolsSheet } from '@/app/vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet';
import { CHAT_ATTACH_INPUT_ID } from '@/lib/chat-attach-input-id';
import { QuickReplies, quickRepliesFor, ThreadAnswerLine } from '@/app/vendor-dashboard/messages/[threadId]/_components/thread-answer-line';
import { Send } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { LockRequestAnswer } from '@/app/vendor-dashboard/clients/[eventId]/_components/booking-ask-panel';
import { vendorAgreeToLock, vendorDeclineLock } from '@/app/vendor-dashboard/clients/[eventId]/actions';
import { sendChatMessage } from '@/lib/chat-actions';
import { BOOKING_FEE } from '@/lib/booking-fee';
import { bookingFeeForecast, type BookingFeeStanding } from '@/lib/booking-fee-disclosure';
import { lockAgreeNotice } from '@/lib/lock-answer-notice';
import { VENDOR_THREAD_PANELS } from '@/lib/vendor-thread-tools';
import { QuestionsSendBody } from '@/app/vendor-dashboard/messages/[threadId]/_components/questions-send-panel';
import { startersForTiles } from '@/lib/emcee-questions';
import type { ThreadDayAnswer } from '@/lib/thread-day-answer';
import { SupplierChats, type SupplierChatsRead } from '@/app/vendor-dashboard/messages/_components/supplier-chats';
import { ThreadArchiveToggle } from '@/app/_components/chat/thread-archive-toggle';
import { PickedClientShell } from '@/app/vendor-dashboard/clients/[eventId]/_components/picked-client-shell';
import { PICKED_CLIENT_PAGES, pickedMenuFor, type PickedClientPage } from '@/app/vendor-dashboard/clients/[eventId]/_components/picked-client-menu';
import { LabPickedChat, type LabChatMode } from '@/app/dev/_components/lab-picked-chat';
import type { ChatsRowNeedsYou } from '@/lib/chats-by-event';
import { LabPlusSeed } from '@/app/dev/_components/lab-plus-seed';
import type { PinFact } from '@/lib/chat-pins';
import { decisionPinBodies } from '@/app/_components/chat/decision-pin-bodies';

/** `?m=chats` — fixture rows in the shape the Chats page builds (sample names: nobody real). */
function labChatsRead(state: string): SupplierChatsRead {
  if (state === 'refused') return { kind: 'refused' };
  if (state === 'empty') return { kind: 'read', rows: [], unreadMeasured: true, complete: true };
  const row = (id: string, name: string, eventLine: string, preview: string, timeLabel: string, unread: boolean, archived = false, needsYou: ChatsRowNeedsYou | null = null) => ({
    threadId: id,
    // Build 3 · Lane A: a row opens the picked client on Chat, over this list (the real page's href is
    // `/vendor-dashboard/clients/<eventId>?tab=chat`, intercepted by `messages/@client`).
    href: `/dev/supplier-chat-lab?m=chats&pick=${id}&page=chat`,
    opensPicked: true,
    needsYou,
    name,
    logoUrl: null,
    preview,
    timeLabel,
    unread,
    eventLine,
    archived,
    archive: <ThreadArchiveToggle threadId={id} returnTo="/dev/supplier-chat-lab?m=chats" archived={archived} />,
  });
  return {
    kind: 'read',
    rows: [
      row('lab-c1', "Ana's Wedding (Dec 12)", '', 'Is the garden buffet still free that day?', '2m', true, false, 'blocker'),
      row('lab-c2', "Bea's Debut (Jan 24, 2027)", '', 'You: Sent you the quote po — 150 pax.', '1h', false, false, 'due-now'),
      row('lab-c3', "Carlo's Wedding (Feb 14, 2027)", '', 'Can we add the coffee bar?', 'Mon', true),
      row('lab-c4', "Dina's Christening (Nov 30)", '', 'Thank you! See you on the day.', 'Oct 28', false),
      row('lab-c5', "Eli's Anniversary (Mar 2, 2027)", '', 'You: Booked — see you!', 'Sep 9', false, true),
    ],
    unreadMeasured: true,
    complete: state !== 'partial',
  };
}

/** The picked client's pages in the lab: Chat is the embedded thread on fixture messages; the rest are lab lines (the
 * real bodies are proven in /dev/clients-lab). */
/** The lab chat's stand-in send — it writes nothing. */
async function labChatSend(formData: FormData): Promise<void> {
  'use server';
  void formData;
  if (process.env.NODE_ENV === 'production') throw new Error('lab: not in production');
}

function labPickedClientBodies(threadId: string, name: string, mode: LabChatMode): Record<PickedClientPage, React.ReactNode> {
  const later = (label: string) => (
    <p className="px-1 py-6 text-sm text-ink/60">(lab) {label} for {name} — drawn in /dev/clients-lab.</p>
  );
  const bodies = Object.fromEntries(PICKED_CLIENT_PAGES.map((p) => [p.id, later(p.label)])) as Record<PickedClientPage, React.ReactNode>;
  bodies.chat = <LabPickedChat threadId={threadId} side="vendor" counterpartyLabel={name} actions={{ send: labChatSend }} {...mode} />;
  return bodies;
}

const LAB_THREAD = '00000000-0000-4000-8000-0000000000aa';
const LAB_EVENT_VENDOR = '00000000-0000-4000-8000-0000000000bb';
const TODAY = '2026-10-14';
const DAY = '2026-12-12';
const NOW = new Date('2026-10-14T04:00:00Z');


/** `&doors=` — the quote's offer and bundle doors, as `readQuoteDoors` hands them (fixture offers; nobody real). */
function labQuoteDoors(v: string | string[] | undefined): QuoteDoors | null {
  if (v === 'locked') {
    const need = { kind: 'verify' as const, progress: papersProgress({ done: 2, of: 4 }) };
    return { offers: { kind: 'locked', need }, bundles: { kind: 'locked', need } };
  }
  if (!v) return null;
  const o = (over: Partial<Offer>): Offer => ({ ...blankOffer(over.id), ...over });
  return {
    offers: {
      kind: 'read',
      today: TODAY,
      offers: [
        o({ id: 'lab-offer-dry', name: 'Dry-season weekday', pctOff: 5 }),
        o({ id: 'lab-offer-buffet', name: 'Weekday garden buffet', phpOff: 5000, reachesAll: false, cards: ['card-buffet'] }),
        o({ id: 'lab-offer-cocktail', name: 'Cocktail early bird', phpOff: 3000, reachesAll: false, cards: ['card-cocktail'] }),
      ],
    },
    bundles: { kind: 'read', bundles: [{ id: 'lab-bundle', name: 'Garden reception pair' }] },
  };
}
/** The lab's one bundle, priced by the Bundle Maker's own sums (fixture card prices; the page reads the shop's). */
const LAB_BUNDLES = {
  'lab-bundle': quoteSeedFromBundle(
    { name: 'Garden reception pair', extraDiscountCentavos: 500000, plan: null, savedTotalCentavos: 10_570_000 },
    [
      { id: 'card-buffet', name: 'Garden buffet', pricePhp: 97500, discounts: [], inclusions: [{ label: 'Waiters and set-up' }, { label: 'Cake table styling' }] },
      {
        id: 'card-cocktail',
        name: 'Cocktail hour',
        pricePhp: 18000,
        discounts: [{ vendor_service_id: 'card-cocktail', discount_type: 'promo', rate: 10, unit: 'pct', min_lead_months: null, expires_at: null, conditions_md: null, sort_order: 0 }],
        inclusions: [{ label: 'Bar set-up' }],
      },
    ],
    new Date('2026-11-11T00:00:00Z'),
  ),
};

const CARDS = [
  { id: 'card-buffet', label: 'Garden buffet', fromPhp: 650, addons: [{ id: 1, label: 'Lechon station', fromPhp: 12000 }, { id: 2, label: 'Coffee bar', fromPhp: 6500 }], comesWith: [], giftOn: true },
  { id: 'card-cocktail', label: 'Cocktail hour', fromPhp: 18000, addons: [], comesWith: [], giftOn: false },
];

export default async function SupplierChatLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const m = typeof sp.m === 'string' ? sp.m : 'tools';
  // ?m=chats — the supplier's full-screen Chats inbox (owner 2026-11-06), the REAL `SupplierChats` in the real shell.
  // &state=refused · &state=empty · &state=partial draw the honest states.
  if (m === 'chats') {
    const state = typeof sp.state === 'string' ? sp.state : 'rows';
    const read = labChatsRead(state);
    const picked = typeof sp.pick === 'string' && read.kind === 'read' ? read.rows.find((r) => r.threadId === sp.pick) ?? null : null;
    const page = (PICKED_CLIENT_PAGES.find((p) => p.id === sp.page)?.id ?? 'chat') as PickedClientPage;
    return (
      <SupplierLabShell measure="own" page="/vendor-dashboard/messages">
        <SupplierChats read={read} viewerId="lab-supplier" />
        {picked ? (
          <PickedClientShell
            eventId={`lab-${picked.threadId}`}
            eventName={picked.name}
            menu={pickedMenuFor(true)}
            initialPage={page}
            bodies={labPickedClientBodies(picked.threadId, picked.name, { hostsFail: sp.hosts === 'fail', noMessages: sp.msgs === '0', solo: sp.solo === '1', tallPins: sp.pins === 'tall', ...(sp.self === 'vendor' || sp.self === 'couple' ? { selfShop: sp.self } : {}) })}
            settingsLine={{ line: 'This client only', tip: 'Lab.' }}
            settings={null}
            // 🔴 A lab sample for the Chat tab's badge (the real page reads `readThreadUnreadCount`); none on an empty chat.
            chatUnread={sp.msgs === '0' ? 0 : 2}
          />
        ) : null}
      </SupplierLabShell>
    );
  }
  const booked = sp.booked === '1';
  const inquiry = m === 'inquiry';
  const askOpen = m === 'ask';

  const answer: ThreadDayAnswer = booked ? { kind: 'booked' } : m === 'full' ? { kind: 'full' } : askOpen || m === 'agreed' ? { kind: 'fits', more: 2 } : { kind: 'free' };
  const feeStanding: BookingFeeStanding = { kind: 'billable', ordinal: 6, ordinalIsFrozen: false, schedule: BOOKING_FEE };
  const notice = m === 'agreed' ? lockAgreeNotice('ok', { feeHeld: true }) : null;

  const toolNodes: Record<string, React.ReactNode> = {
    'build-quote': (
      <ProposalMaker
        threadId={LAB_THREAD}
        requestedPax={150}
        livePax={150}
        coupleName="Ana & Miguel"
        cards={CARDS}
        feeStanding={feeStanding}
        papicStanding={{ kind: 'silent' }}
        shopGifts={
          sp.gifts
            ? {
                // Lab-only stand-in packs — the page reads the catalogue.
                packs: shopGiftPacksFrom([
                  { code: 'PAPIC_GUEST_150', title: 'Papic 150', credits: 150, pricePhp: 99, giftPricePhp: 90 },
                  { code: 'PAPIC_GUEST_1K', title: 'Papic 1000', credits: 1000, pricePhp: 499, giftPricePhp: 449 },
                  // 💎 Slice 2 — the price sheet's figures (20271308555594), copied for the lab only.
                  { code: 'EVENT_PLUS', title: 'Event Plus', credits: 1, pricePhp: 2990, giftPricePhp: 2690 },
                  { code: 'COUPLE_WEBSITE_PRO', title: 'Event Pro', credits: 1, pricePhp: 5690, giftPricePhp: 5190 },
                ]),
                schedule: BOOKING_FEE,
                limitPct: GIFT_LIMIT_PCT_DEFAULT,
                free: { papic: sp.gifts === 'short' ? 400 : 2150, event_plus: 2, event_pro: 1 },
                eventHas: sp.gifts === 'plus' ? 'plus' : sp.gifts === 'pro' ? 'pro' : 'none',
              }
            : null
        }
        shopGiftsBuy={sp.gifts ? { paysGiftPrice: true, openRails: [{ id: 'gcash', label: 'GCash' }] } : null}
        labGiftCodes={sp.gifts === 'over' ? ['PAPIC_GUEST_1K', 'PAPIC_GUEST_1K', 'PAPIC_GUEST_1K', 'PAPIC_GUEST_1K', 'PAPIC_GUEST_1K', 'PAPIC_GUEST_1K'] : sp.gifts === 'plus' || sp.gifts === 'pro' ? ['PAPIC_GUEST_150', 'EVENT_PLUS'] : sp.gifts ? ['PAPIC_GUEST_1K', 'PAPIC_GUEST_150'] : undefined}
        savedQuotes={[{ id: 'tpl-garden', name: 'Garden wedding 150' }]}
        askedCardId="card-buffet"
        todayIso={TODAY}
        doors={labQuoteDoors(sp.doors)}
        labSeed={{
          bundles: LAB_BUNDLES,
          lines: [
            { label: 'Garden buffet · 5 dishes', basis: 'per_pax', free: false, flatPhp: 0, ratePhp: 650, minPax: 100, basePhp: 0, inclHours: 0, extraPhp: 0 },
            { label: 'Waiters and set-up', basis: 'flat', free: false, flatPhp: 15000, ratePhp: 0, minPax: 0, basePhp: 0, inclHours: 0, extraPhp: 0 },
            { label: 'Cake table styling', basis: 'flat', free: true, flatPhp: 0, ratePhp: 0, minPax: 0, basePhp: 0, inclHours: 0, extraPhp: 0 },
          ],
          extras: [
            { id: 'x-dessert', label: 'Dessert table', line: { label: 'Dessert table', basis: 'flat', free: false, flatPhp: 9500, ratePhp: 0, minPax: 0, basePhp: 0, inclHours: 0, extraPhp: 0 } },
            { id: 'x-drinks', label: 'Bottomless iced tea', line: { label: 'Bottomless iced tea', basis: 'per_pax', free: false, flatPhp: 0, ratePhp: 45, minPax: 0, basePhp: 0, inclHours: 0, extraPhp: 0 } },
          ],
        }}
      />
    ),
    'booking-ask': askOpen ? (
      <LockRequestAnswer
        eventVendorId={LAB_EVENT_VENDOR}
        expiresAt="2026-10-15T20:00:00Z"
        payoutReadiness="ready"
        feeForecast={bookingFeeForecast(feeStanding, 112_500)}
        returnTo={`/vendor-dashboard/messages/${LAB_THREAD}`}
        agreeLock={vendorAgreeToLock}
        declineLock={vendorDeclineLock}
        now={NOW}
      />
    ) : null,
    'offer-service': <VendorOfferService threadId={LAB_THREAD} options={[{ vendorServiceId: 'card-cocktail', label: 'Cocktail hour' }]} />,
    // ❓ Questions for the couple (every supplier, 2026-11-04) — the caterer's starting set, not sent yet.
    'questions-for-couple': (
      <QuestionsSendBody
        threadId={LAB_THREAD}
        coupleName="Ana & Miguel"
        asked={startersForTiles(['catering']).map((q, i) => ({ question_id: `lab-q${i}`, prompt: q.prompt }))}
        sentAt={null}
        answered={null}
      />
    ),
  };

  // 📌 Supplier Build 3 · lane B — the pins and the blocker, on fixture facts (a clock-free sample: due "tomorrow").
  const DAY_MS = 86_400_000;
  const labPins: PinFact[] =
    sp.pins === '1'
      ? [
          { key: 'payment_due:lab-2', kind: 'payment_due', title: '₱33,750 · 2nd payment', answerer: 'you', themName: 'Ana & Miguel', sinceMs: Date.now() - DAY_MS, dueMs: Date.now() + DAY_MS },
          { key: 'guest_count:lab', kind: 'guest_count', title: 'Guest count 150 → 170', answerer: 'you', themName: 'Ana & Miguel', sinceMs: Date.now() - 2 * DAY_MS },
          { key: 'confirm_payment:lab', kind: 'confirm_payment', title: 'Your receipt for ₱11,250', answerer: 'them', themName: 'Ana & Miguel', sinceMs: Date.now() - 3 * DAY_MS },
        ]
      : [];
  // 🗳 &decide=1 — an open decision pin (11 Nov): tap it and it rises (filed messages · Edit topic · Close · settled).
  // The lab has no database, so the risen view is handed FIXTURE filed rows (`labFiled`), labelled as the lab's own;
  // &decide=refused draws the refused read instead (the alert with Try again).
  if (sp.decide === '1' || sp.decide === 'refused') {
    labPins.push({ key: 'decision:00000000-0000-4000-8000-00000000d001', kind: 'decision', title: 'Drone shot at sunset', answerer: 'you', themName: 'Ana & Miguel', sinceMs: Date.now() - DAY_MS, openedByYou: false, filedCount: 2 });
  }
  const labFiled =
    sp.decide === '1'
      ? {
          me: LAB_STAFF,
          filed: {
            '00000000-0000-4000-8000-00000000d001': [
              { messageId: LAB_MESSAGES[1]!.message_id, body: LAB_MESSAGES[1]!.body, senderUserId: LAB_STAFF, sentAt: LAB_MESSAGES[1]!.created_at, addedByUserId: LAB_STAFF, addedAt: new Date(Date.now() - 2 * 3_600_000).toISOString() },
              { messageId: LAB_MESSAGES[2]!.message_id, body: LAB_MESSAGES[2]!.body, senderUserId: LAB_USER, sentAt: LAB_MESSAGES[2]!.created_at, addedByUserId: LAB_USER, addedAt: new Date(Date.now() - 5 * 3_600_000).toISOString() },
            ],
          },
        }
      : undefined;
  if (sp.blocker === '1' && askOpen) {
    labPins.unshift({ key: 'booking_ask:lab', kind: 'booking_ask', title: 'They asked to book you', answerer: 'you', themName: 'Ana & Miguel', sinceMs: 0, dueMs: Date.parse('2026-10-15T20:00:00Z') });
  }
  const shown = typeof sp.shown === 'string' ? Number(sp.shown) : 1;
  const left = typeof sp.left === 'string' ? Number(sp.left) : undefined;
  // ⏳ Round 2 · `&blocker=expired` — the supplier's expired-quotation blocker (one action: Send a new quotation).
  if (sp.blocker === 'expired') {
    labPins.unshift({ key: 'quote_expired:lab', kind: 'quote_expired', title: 'Your quotation expired · valid until Nov 6, 2026', answerer: 'you', themName: 'Ana & Miguel', sinceMs: Date.now() - DAY_MS });
  }
  const labBlocker =
    sp.blocker === 'expired'
      ? {
          pinKey: 'quote_expired:lab',
          kind: 'quote_expired' as const,
          subjectKey: 'quote_expired:lab',
          topic: 'quote' as const,
          title: 'Your quotation expired · valid until Nov 6, 2026',
          why: 'They can’t accept it any more. Send a new one — it opens filled in from the old quotation.',
          action: (
            <ActionButton tone="brand" main icon={<Send aria-hidden strokeWidth={1.9} />} label="Send a new quotation" href="?compose=quote" className="!h-11 !min-h-11 w-full" />
          ),
          labShownCount: shown,
          labLeft: left,
        }
      : sp.blocker === '1' && askOpen
      ? {
          pinKey: 'booking_ask:lab',
          kind: 'booking_ask' as const,
          subjectKey: 'booking_ask:lab',
          topic: 'quote' as const,
          title: 'They asked to book you',
          why: 'Nothing is booked, and their date is not held for you, until you answer.',
          // v8.3: the blocker answers in one equal row — Turn down | Agree and book.
          action: (
            <LockRequestAnswer
              layout="blocker"
              eventVendorId={LAB_EVENT_VENDOR}
              expiresAt="2026-10-15T20:00:00Z"
              payoutReadiness="ready"
              feeForecast={bookingFeeForecast(feeStanding, 112_500)}
              returnTo={`/vendor-dashboard/messages/${LAB_THREAD}`}
              agreeLock={vendorAgreeToLock}
              declineLock={vendorDeclineLock}
              now={NOW}
            />
          ),
          labShownCount: shown,
          labLeft: left,
        }
      : null;

  // THE ONE BUILD (8 Nov 2026) · `&embed=quotation` — the picked client's Quotation page as the thread page's own
  // `__embed=quotation` view draws it: the quote tool alone, full width, no chat frame (the client's pinned row is above).
  if (sp.embed === 'quotation') {
    return (
      <SupplierLabShell measure="own">
        <div data-picked-client-page="quotation" className="mx-auto w-full max-w-xl space-y-3 px-0 pb-6">
          {toolNodes['build-quote']}
        </div>
      </SupplierLabShell>
    );
  }

  return (
    // The supplier's thread as its page draws it: the supplier's REAL shell (rail · bar · tabs), the page's column, the
    // ONE thread frame (`ChatThreadFrame`) holding one `ChatBox` — so a walk at 390 proves the takeover covers the
    // supplier's bar and tabs, and a walk from 1024 proves the chat has the same column as the couple's.
    <SupplierLabShell measure="own">
      <div className="mx-auto w-full px-4 pb-6 pt-3 sm:px-6 sm:pt-6 lg:px-8" data-lab-supplier-chat={m}>
      <ChatThreadFrame>
        <ChatBox
          header={
            <ChatThreadHead
              back={<BackButton href="/dev/supplier-lab" label="Customers" variant="chat" />}
              nameHref="#customer"
              name="Ana's Wedding (Dec 12)"
              initials="AM"
              line={
                <>
                  <span>Catering</span>
                  <span>December 12, 2026</span>
                  <span className="text-terracotta-700">Planning for ~150 guests</span>
                </>
              }
              actions={
                <>
                  <ChatInfoRailTrigger
                    displayName="Ana & Miguel"
                    initials="AM"
                    stage={{ label: THREAD_STAGE_LABEL[booked ? 'booked' : 'quoted'], tone: THREAD_STAGE_TONE[booked ? 'booked' : 'quoted'] }}
                    summary={{
                      sentence: 'Ana Reyes created a wedding called “Ana & Miguel” on September 2, 2026.',
                      facts: [
                        { label: 'Date', value: 'December 12, 2026' },
                        { label: 'Guests', value: '~150' },
                      ],
                      lockedCategories: ['Venue'],
                    }}
                    service="Catering"
                    threadId={LAB_THREAD}
                    eventId={LAB_EVENT}
                    source={{ label: 'Website Inquiry', returning: null }}
                  />
                  <ChatThreadMenu threadId={LAB_THREAD} returnTo="/dev/supplier-chat-lab" blockedByMe={false} links={[{ href: '#quote', label: 'Quote & payments', icon: 'quote' }, { href: '#files', label: 'Files & contracts', icon: 'files' }, { href: '#schedule', label: 'Schedule', icon: 'schedule' }, { href: '#details', label: 'Full customer profile', icon: 'customer' }]} />
                </>
              }
            />
          }
          notice={
            <>
              {notice ? (
                <p role="status" className="border-b border-ink/10 bg-mulberry/[0.06] px-3.5 py-2 text-[13px] text-ink" data-lock-answer="">
                  {notice.text}{' '}
                  {notice.door ? (
                    <a href={notice.door.href} className="font-semibold text-sn-accent underline underline-offset-2" data-lock-answer-door="">
                      {notice.door.label}
                    </a>
                  ) : null}
                </p>
              ) : null}
              <ThreadAnswerLine initials="AM" eventDay={DAY} todayIso={TODAY} answer={answer} askOpen={askOpen} />
              <ChatPrivacyNotice inBox viewer="vendor" />
            </>
          }
          composer={
            inquiry ? (
              // Stand-in for the page's own "New inquiry" bar — its words and its one button, as the page draws them.
              <div className="space-y-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-4"> {/* no-card-ok: a copy of the thread page's own New-inquiry bar, for the lab picture */}
                <p className="text-sm text-ink">
                  <span className="font-semibold">New inquiry.</span> Say yes to talk — nothing is booked yet.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="inline-flex h-11 items-center rounded-md bg-mulberry px-5 text-sm font-semibold text-cream">
                    Talk to them
                  </button>
                  <button type="button" className="inline-flex h-11 items-center rounded-md border border-ink/20 px-5 text-sm font-semibold text-ink">
                    Decline
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <QuickReplies threadId={LAB_THREAD} replies={quickRepliesFor(answer)} sendAction={sendChatMessage} />
                <ChatSendForm
                  threadId={LAB_THREAD}
                  sendAction={sendChatMessage}
                  lead={
                    <ThreadToolsSheet
                      eventId={LAB_EVENT}
                      threadId={LAB_THREAD}
                      state={{ hasAgreement: booked, askOpen, paymentsToConfirm: booked ? 1 : 0, guestCountChanges: 0 }}
                    />
                  }
                  attachInputId={CHAT_ATTACH_INPUT_ID}
                />
              </div>
            )
          }
          tray={
            inquiry ? null : (
              <div>
                {VENDOR_THREAD_PANELS.map((t) =>
                  toolNodes[t.id] == null ? null : (
                    <ThreadToolPanel
                      key={t.id}
                      id={t.id}
                      label={t.label}
                      hint={t.hint}
                      open={(t.id === 'build-quote' && m === 'quote') || (t.id === 'booking-ask' && askOpen)}
                    >
                      {toolNodes[t.id]}
                    </ThreadToolPanel>
                  ),
                )}
              </div>
            )
          }
        >
          {sp.run === 'meeting' ? <LabPlusSeed threadId={LAB_THREAD} draft="meeting" toast={sp.shut === '1' ? 'Finish or close: Meeting' : null} /> : null}
          <ChatMessageStream
            flush
            // A lab has no booked deal. Kept FIRST: the handshake guard reads the tag only up to the first "/>".
            lockHandshake={null}
            extraPins={labPins}
            pinBodies={decisionPinBodies(labPins, labFiled)}
            labFilings={
              labFiled
                ? {
                    topics: [{ topicId: '00000000-0000-4000-8000-00000000d001', title: 'Drone shot at sunset', filedCount: 2 }],
                    byMessage: new Map(
                      [LAB_MESSAGES[1]!, LAB_MESSAGES[2]!].map((x) => [x.message_id, { topicId: '00000000-0000-4000-8000-00000000d001', title: 'Drone shot at sunset' }]),
                    ),
                  }
                : undefined
            }
            blocker={labBlocker}
            plus={{ eventId: LAB_EVENT, returnPath: '/dev/supplier-chat-lab' }}
            {...(sp.hosts === '1'
              ? {
                  hosts: [
                    { userId: LAB_USER, firstName: 'Maria', name: 'Maria Reyes', role: 'bride', label: null },
                    { userId: '00000000-0000-4000-8000-0000000000ee', firstName: 'Jose', name: 'Jose Santos', role: 'groom', label: null },
                  ],
                  // 📞 A lab stand-in: a booked sample with a dummy number (the pages pass the ONE booking check).
                  headCalls: <BookedCallButtons booked phone="0917 000 0000" who="Ana & Miguel" />,
                }
              : {})}
            dealEntry={dealEntryFor({ side: 'vendor', hasQuote: false })}
            threadId={LAB_THREAD}
            initialMessages={LAB_MESSAGES.map((x) => ({ ...x, thread_id: LAB_THREAD }))}
            currentUserId={LAB_STAFF}
            viewerRole="vendor"
            counterpartyLabel="Ana & Miguel"
            fileExpiry={{ eventDate: DAY, precision: 'day' }}
          />
        </ChatBox>
      </ChatThreadFrame>
      </div>
    </SupplierLabShell>
  );
}
