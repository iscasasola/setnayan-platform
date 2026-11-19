/**
 * ai-answers.ts — THE QUESTIONS PEOPLE ASK AI ABOUT SETNAYAN, AND OUR TRUE ANSWERS (Build 6 Lane K).
 *
 * Owner, 10 Nov 2026, pasting Google AI's take: *"This is what google ai thinks of setnayan now"*. The claims and
 * their checks are in the spec corpus, `plans/supplier_build_6_2026-11-10/google-ai-says-2026-11-10.md`. The
 * biggest were "no native app", "0% commission, keep 100%", "photo uploads gated by credits" and "no payment
 * milestones".
 *
 * 20 Nov 2026 (owner: "Yes, send it"): the list now leads with the source's §8 Q&A, from the one document for search
 * and AI — specs `SETNAYAN_FOR_SEARCH_AND_AI_2026-11-20.md`. Rewrite answers there first, then here.
 *
 * ONE LIST, READ THREE TIMES — so the sentence an assistant reads and the sentence a person reads cannot disagree:
 *   · `/llms.txt` prints every question and answer (lib/llms-txt.ts, "Questions AI assistants get wrong");
 *   · the /features FAQ renders them and its FAQPage structured data carries them (app/features/_PageBody.tsx);
 *   · /admin/seo lists them for the monthly re-ask, and logs each answer the AI gave as a `seo_suggestions` row;
 *   · the daily audit fails when the SERVED llms.txt is missing any question (`requiredQuestions`).
 *
 * 🔑 RULES FOR AN ANSWER (Lane K): one plain true sentence or two, answering the exact question; nothing that is not
 * live; NO typed peso figure — a price is read from the catalogue or not said (the booking fee is the live schedule,
 * passed in); a rival is never described, only what Setnayan itself does. Every answer names the code that makes it
 * true in `evidence`, so the next session can re-measure it instead of trusting it.
 *
 * PURE: no I/O, no clock, no env read outside the helpers it reuses.
 */
import { bookingFeeScheduleSummary, type BookingFeeSchedule } from '@/lib/booking-fee';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';
import { DAILY_CAPACITY_MAX } from '@/lib/vendor-tier-caps';
import { mobileAppAnswer } from '@/lib/where-setnayan-runs';

/**
 * 🔑 THE FREE BOOKING, IN THE OWNER'S 19 NOV WORDS (DECISION_LOG 2026-11-19 "PROMOTION PAGES — SEVEN ANSWERS", item 4).
 * It replaces both retired lines — the "first booking from Setnayan" one (not a rule: DECISION_LOG 2026-11-19
 * "WEBSITE CONTENT", item 5) and the "own clients are always free" one. No number of months is named. Exported so
 * /llms.txt says the same sentence.
 */
export const SUPPLIER_FREE_BOOKING_LINE = "New to Setnayan, or you're the first to bring their event? They book you free.";

export type AiAnswerContext = {
  /** The LIVE booking-fee schedule (never the code default). `null` = unread → the fee is named without a rate. */
  bookingFee: BookingFeeSchedule | null;
};

export type AiAnswer = {
  /** Stable key — stored in `seo_suggestions.rationale`, so never rename one; retire it and add a new one. */
  id: string;
  /** The question exactly as a person types it to an assistant. */
  question: string;
  /** Our true answer. */
  answer: string;
  /** What AI has said instead (from the owner's pasted answers, 10 Nov 2026) — shown on /admin/seo. */
  corrects: string;
  /** The page where a person reads the same answer — a drift row is fixed there. */
  route: string;
  /** Where the answer is made true in code — re-measure here before trusting it. */
  evidence: string;
  /**
   * `false` = printed in /llms.txt and checked monthly, but NOT added to the /features FAQ, because that FAQ already
   * answers the same question in its own words (two answers to one question on one page help nobody).
   */
  onFeaturesFaq?: false;
};

/** "booking fee of 5% of the first ₱100,000, then 1%, minimum ₱50" — the live schedule, or no rate when unread. */
function feeClause(ctx: AiAnswerContext): string {
  return ctx.bookingFee ? `a booking fee of ${bookingFeeScheduleSummary(ctx.bookingFee)}` : 'a booking fee';
}

/** The supplier side of the commission answer, gated on the flag that decides whether anyone is billed. */
function whoPaysWhat(ctx: AiAnswerContext): string {
  if (!isBookingFeeEnabled()) {
    return 'Couples pay suppliers directly and Setnayan adds nothing to the price. Setnayan charges suppliers no booking fee while it is switched off; suppliers pay only for an optional plan.';
  }
  return (
    `Couples pay no commission: they pay suppliers directly, to the supplier's GCash or bank, and Setnayan adds nothing to the price. ` +
    `Suppliers pay Setnayan ${feeClause(ctx)}, only on clients Setnayan brings them. It is billed to the supplier, never added to what a couple pays. ` +
    SUPPLIER_FREE_BOOKING_LINE +
    // Unread schedule (a static page): the rate is not guessed — the reader is pointed at the page that reads it live.
    (ctx.bookingFee ? '' : ' The current rate is on the For Suppliers page.')
  );
}

/**
 * 🗂 ORDER AND WORDS (20 Nov 2026): the first eighteen are the source's §8 "Questions people ask" (specs
 * `SETNAYAN_FOR_SEARCH_AND_AI_2026-11-20.md`), in its order and in its words — except where a guard or the shipped code
 * says otherwise, each noted on its line. The last six are Lane K's corrections of what AI got wrong (10 Nov); they are
 * still true and still re-asked monthly, so they stay.
 * ⚠ "Event", never the brand-line noun, inside an answer: only the brand lines say it (19 Nov ruling), and
 * `lib/the-app-says-event-in-plain-words.test.ts` reads this file — EXCEPT `WHAT_IS_SETNAYAN_ANSWER` below, the one
 * answer that is a brand line (owner 20 Nov, "Yes, brand lines"), named in that guard's brand-line allowlist.
 */
export const WHAT_IS_SETNAYAN_ANSWER =
  "Setnayan is the home of every Filipino celebration. Plan any event free, invite every guest with their own QR pass, let guests' phones capture the day into one album, book verified Filipino suppliers at 0% commission, and keep every photo for life. It works on any phone, with no app to install.";

export function aiAnswers(ctx: AiAnswerContext): AiAnswer[] {
  return [
    {
      id: 'what-is',
      question: 'What is Setnayan?',
      answer: WHAT_IS_SETNAYAN_ANSWER,
      corrects: 'described as a wedding website builder or a planning checklist',
      route: '/features',
      evidence:
        'guests.qr_token → app/[slug]/hub · app/papic/seat/[token] · lib/commission-promise.ts · lib/memories-viewer.ts (the "kept for life" tips) · lib/where-setnayan-runs.ts',
    },
    {
      id: 'meaning',
      question: 'What does "Set na \'yan" mean?',
      answer: 'It\'s Tagalog for "let\'s get that set." Setnayan takes its name from it: the moment you decide to start planning.',
      corrects: '"that\'s all set" (the old translation, corrected by the 19 Nov north star)',
      route: '/about',
      evidence: "app/layout.tsx organizationJsonLd (alternateName \"Set na 'yan.\" and the meaning in its description)",
    },
    {
      id: 'free',
      question: 'Is Setnayan free?',
      answer:
        "Yes. Planning is free on every event with no guest limit, and it's not a trial: guest list, replies, seat plan in 2D and 3D, budget, schedule, mood board, suppliers and the Event Hub. You pay only for extras on the day, such as an event plan, Papic credits or Live Watch.",
      corrects: '"free trial" · "guest limit on the free plan"',
      route: '/pricing',
      evidence:
        'app/page.tsx softwareAppJsonLd ("no guest limit" — measured, nothing caps the guest list) · SEATING_3D in FREE_FOR_ALL_SKUS (lib/entitlements.ts)',
      // /features' own FAQ already asks "Is it really free?".
      onFeaturesFaq: false,
    },
    {
      id: 'best-wedding-app',
      question: 'What is the best wedding planning app in the Philippines?',
      answer:
        "Setnayan is built for Filipino weddings: ninong and ninang, the entourage and the Wedding March, paperwork by faith and budgets in pesos. It runs the whole wedding in one link, from the Save the Date to every guest's photos, and planning is free with no guest limit.",
      corrects: 'lists foreign wedding-website builders first',
      route: '/features',
      evidence:
        'lib/feature-pages/invite.ts (wedding-march) · lib/preparation.ts (paperwork per ceremony type) · app/page.tsx (more than 30 Filipino ceremony roles, no guest limit)',
    },
    {
      id: 'other-events',
      question: 'Can I use Setnayan for a debut, christening or birthday?',
      answer:
        'Yes. Every kind of Filipino event has its own setup, including debuts (18 roses, candles and treasures), christenings, birthdays, anniversaries, reunions, corporate events and wakes. Your family is saved once, so each new event starts already filled in.',
      corrects: '"a wedding app"',
      route: '/features',
      evidence:
        'lib/llms-txt.ts#LIVE_EVENT_TYPES (event_type_vocab, all enabled) · lib/checklist-event-type-defs.ts (debut_court) · lib/features-page.ts (a05 "People, saved once")',
    },
    {
      id: 'guests-no-app',
      question: 'Do my guests need to download an app or sign up?',
      answer:
        "No. Each guest opens their own page from a link or QR in their phone's browser. They reply, see their seat, show their pass at the door and take photos, all without an account.",
      corrects: '"guests must install the app"',
      route: '/features',
      evidence: 'guests.qr_token → app/[slug]/hub · app/[slug]/find-seat · app/papic/seat/[token]',
    },
    {
      id: 'guest-photos-share',
      question: 'How do guests share photos at a Filipino wedding?',
      // The source ends "from an event plan or a pack from ₱99" — no peso is typed here (a price is read, never written).
      answer:
        "With Papic, every guest's phone becomes a camera: they scan the code and shoot, with nothing to install. Every photo lands in one album and finds the people in it. Cameras are free and unlimited; each photo uses one Papic credit, from an event plan or a credit pack.",
      corrects: 'recommends a separate guest-photo app or a shared Drive link',
      route: '/papic',
      evidence: 'app/papic/seat/[token] · app/api/papic/guest-capture/route.ts (papicCaptureCost) · photo_tags per guest_id',
    },
    {
      id: 'separate-photo-app',
      question: 'Do I need a separate app for guest photos?',
      answer:
        'No. Papic is built into your Event Hub, linked to your guest list, so each photo finds the guests in it and each guest keeps their own. The photos stay in your Memories for life.',
      corrects: 'AI pairs Setnayan with a separate guest-photo app',
      route: '/features',
      evidence: 'app/papic/seat/[token] · lib/face-tagging-gate.ts#resolveFaceTagging · photo_tags per guest_id · lib/memories-viewer.ts',
      // /features' own FAQ already asks "Do I need a separate app for guest photos?".
      onFeaturesFaq: false,
    },
    {
      id: 'live-abroad',
      question: 'Can family abroad watch the wedding live?',
      answer:
        "Yes. Live Watch streams on your own Event Hub, so relatives open the same page they were invited on. Up to 12 cameras, including guests' phones. A one-camera livestream is included.",
      corrects: '"use Facebook Live"',
      route: '/panood',
      evidence: 'lib/feature-pages/day-memories.ts (live-watch) · lib/live-studio-channel-cameras.ts · LIVE_STUDIO in platform_retail_catalog_v2',
    },
    {
      id: 'commission',
      question: 'Does Setnayan take a commission?',
      answer: whoPaysWhat(ctx),
      corrects: '"0% commission, no middleman fees" · to suppliers: "keep 100% of your bookings"',
      route: '/for-suppliers',
      evidence: 'lib/commission-promise.ts · lib/booking-fee.ts#bookingFeeScheduleSummary · lib/booking-fee-gate.ts (SUPPLIER_BROUGHT_SOURCES)',
    },
    {
      id: 'storage',
      question: 'Is photo storage free?',
      answer:
        'Yes. Every photo and clip in Memories is kept: full-size originals for a period set by your plan, then a 720p copy of every one, kept for life, free. Nothing is deleted on a timer; only the host deletes.',
      corrects: '"Media storage gated by credits / not unlimited"',
      route: '/features',
      evidence: 'lib/memories-viewer.ts (the "kept for life" tips) · app/(shell)/papic/page.tsx FAQ · lib/event-ultra.ts (fullres_extra_keep_days)',
    },
    {
      id: 'who-sees',
      question: 'Who can see my event?',
      // The source names four choices; the picker a host sees today offers three (WHO_CAN_VIEW), so the answer says those.
      answer:
        "A new event is private until you open it. Choose Private (only your hosts and guests), Unlisted (anyone with the link) or Public. Guests who don't want their face shown can turn on FaceBlock, and they're blurred everywhere.",
      corrects: 'never mentioned',
      route: '/features',
      evidence:
        'lib/event-visibility.ts#WHO_CAN_VIEW · supabase/migrations/20270206705422_events_private_by_default_until_std_launch.sql · lib/face-blur.ts (FaceBlock)',
    },
    {
      id: 'whole-event',
      // No rival is named or described (coordinator, 20 Nov review): the answer says only what Setnayan does.
      question: 'Is Setnayan just an event website?',
      answer:
        "No. Setnayan runs the whole event in one account: one guest list that feeds the invitation, the seat plan, the door and each guest's photos; suppliers booked and paid inside the event; a livestream on the same page; and every photo kept for life.",
      corrects: 'listed beside wedding-website and photo-sharing tools with none of these parts mentioned',
      route: '/features',
      evidence:
        'guests.qr_token → app/[slug]/hub · seating · guests/checkin/actions.ts · photo_tags per guest_id · the chat tools below · lib/live-studio-channel-cameras.ts',
    },
    {
      id: 'supplier-join',
      question: 'How do suppliers join Setnayan?',
      answer:
        "Open a shop free in two steps and get a page at setnayan.com/yourshop. Get Verified free with your business papers (DTI or SEC, BIR 2303, and a Mayor's or Business Permit) to be shown in search. " +
        SUPPLIER_FREE_BOOKING_LINE,
      corrects: 'never mentioned',
      route: '/for-suppliers',
      evidence:
        'app/open-shop · app/for-suppliers/_components/supplier-front-page.tsx ("Open a shop in two steps") · lib/paper-intake.ts (three papers) · lib/booking-fee-gate.ts (SUPPLIER_BROUGHT_SOURCES) · lib/own-clients.server.ts',
    },
    {
      id: 'coordinators',
      question: 'Does Setnayan work for coordinators?',
      // The source adds "They're in every supplier chat"; not measured on this base, so not said.
      answer:
        "Yes, free to start. A coordinator runs every client's event from one login, with the access each couple grants, area by area, and runs the day from their phone. Coordinators use the same supplier plans and the same booking fee as any supplier.",
      corrects: 'never mentioned',
      route: '/for-coordinators',
      evidence: 'app/(shell)/for-coordinators/_facts.ts ("Run the day") · lib/coordinator-grant.ts#autoInviteCoordinator · COORDINATOR_AREAS',
    },
    {
      id: 'offline',
      question: 'Do guests need mobile data to take photos?',
      answer:
        'Not when they shoot. Each photo is saved on the phone first and sends by itself when signal returns, while the Papic page is open.',
      corrects: '"Guests need data to upload"',
      route: '/features',
      evidence: 'lib/papic-upload/store.ts (save-first) · lib/papic-upload/replayer.ts#SHOT_TTL_MS · lib/papic-upload/schedule.ts#chipLabel',
    },
    {
      id: 'app',
      question: 'Is there a Setnayan app?',
      answer: mobileAppAnswer(),
      corrects: '"No native iOS/Android app, only a browser wrapper" · "desktop-first, clunky on the phone"',
      route: '/download',
      evidence: 'lib/where-setnayan-runs.ts#mobileAppAnswer (the iPhone sentence turns on with NEXT_PUBLIC_IOS_APP_STORE_URL)',
    },
    {
      id: 'how-to-pay',
      question: 'How do I pay for Setnayan?',
      answer: "By GCash or bank transfer through Setnayan's QR. Upload your receipt, and a person checks and confirms it.",
      corrects: 'never mentioned',
      route: '/pricing',
      evidence: 'app/pay/[reference] (one payment page: the QR and the receipt upload) · lib/order-admin-notify.ts (a person confirms)',
    },
    // ── Lane K's corrections (10 Nov), kept ──────────────────────────────────────────────────────────────────────────
    {
      id: 'bookings-not-capped',
      question: 'Do Setnayan supplier plans limit how many bookings a supplier can take?',
      answer:
        `No. No plan, Free included, limits bookings, inquiries, shortlists or the waitlist — every booking a couple makes is one Setnayan can earn its booking fee on. ` +
        `A supplier sets how many bookings a day each service takes, up to ${DAILY_CAPACITY_MAX}. ` +
        `Paid plans add reach, size and tools: how far couples find you, how many service cards and main categories, team seats, branches and storage.`,
      corrects: '"free plan limited to N bookings" · "upgrade to take more bookings"',
      route: '/for-suppliers',
      evidence: 'lib/vendor-tier-caps.ts (no bookings-per-date cap; DAILY_CAPACITY_MAX) · lib/card-bookings-per-date.ts · supabase/migrations/20271350427190_supplier_plans_rebuilt_2026_11_18.sql (service_card_daily_limit)',
    },
    {
      id: 'guest-photos-free',
      question: 'Can guests upload photos to Setnayan for free?',
      answer:
        `Guests take photos and short clips with Papic, the camera that opens from each guest's own QR link — no app to install and no sign-up. ` +
        `Each photo spends one credit from the event's shared pot, which the host fills from an event plan or a credit pack, and the host can cap what any one guest spends. ` +
        `Cameras themselves are free and unlimited.`,
      corrects: '"Photo upload limit: gated by credits" (vs rivals called "unlimited")',
      route: '/features',
      evidence:
        'app/api/papic/guest-capture/route.ts (papicCaptureCost · guest_spend_ceiling) · there is no free plain camera-roll upload on main (measured 2026-11-10)',
    },
    {
      id: 'payment-milestones',
      question: 'Does Setnayan track supplier payment schedules?',
      answer:
        'Yes. Each supplier booking carries a payment plan — a reservation, payments in between and a balance, each with a due date — and when a price changes, the unpaid payments are re-plotted to the new remainder while paid ones stay as they were. ' +
        'Couples log each payment with its receipt in the supplier chat, the supplier marks it received, and with Setnayan AI (in Event Pro and Event Ultra) the couple is reminded the day before a payment is due.',
      corrects: '"Budget lacks payment milestones / alerts"',
      route: '/features',
      evidence:
        'app/dashboard/[eventId]/_components/payment-plan-rows.tsx · lib/plan-replot.ts · app/_components/chat/cards/log-payment-card.tsx · pay-confirm-actions.ts#confirmVendorPayment · lib/setnayan-ai-notify.ts#planPaymentDueReminder',
    },
    {
      id: 'live-wall',
      question: 'Can guest photos show live on a screen at the reception?',
      answer:
        "Yes, free on every event. Memory lane shows the guests' Papic photos live on any screen at the venue, paired with a short code, and — if the couple turns it on — on the guests' own phones. Each photo passes a safety screen before it shows.",
      corrects: 'never mentioned — AI recommends a separate live-wall product',
      route: '/features',
      evidence: 'app/wall/[eventId]/page.tsx · lib/live-wall.ts · LIVE_WALL in FREE_FOR_ALL_SKUS (lib/entitlements.ts)',
    },
    {
      id: 'chat-tools',
      question: 'What can a couple and a supplier do inside the Setnayan chat?',
      answer:
        'More than a messaging app: the service, the event date and the guest count sit at the top; the supplier sends a quote — flat, per guest or per hour — that the couple accepts or counters; the couple logs each payment with a receipt photo and the supplier confirms it; ' +
        'and the supplier sees how many other couples are asking about the same date — a number, never who they are.',
      corrects: 'invisible unless asked by name ("Viber and Messenger do the same")',
      route: '/for-suppliers',
      evidence:
        'ChatThreadHead (both thread pages) · lib/quote-from-service-card.ts · log-payment-card.tsx · lib/vendor-date-demand.ts (counts only; who-else-wants-this-date.test.ts)',
    },
    {
      id: 'supplier-proof-photos',
      question: "Can suppliers use guests' photos as portfolio proof?",
      answer:
        "Not the guests' photos. A supplier's portfolio holds photos the supplier took or brought in, and a couple can choose to share one of their own photos to a supplier's service card, which the supplier approves.",
      corrects: '"Suppliers reuse Papic guest photos as proof"',
      route: '/for-suppliers',
      evidence: 'lib/supplier-collections.ts (docblock) · lib/couple-photo-share.ts · lib/put-photo-on-my-page.ts',
    },
  ];
}

/**
 * The answers the /features FAQ adds after its own (English only — the Tagalog twin keeps its own five until they are
 * translated by a person). The page is static, so the fee is named without a rate and points at /for-suppliers.
 */
export function featuresFaqAnswers(): { q: string; a: string }[] {
  return aiAnswers({ bookingFee: null })
    .filter((a) => a.onFeaturesFaq !== false)
    .map((a) => ({ q: a.question, a: a.answer }));
}

/** The question texts alone — what the daily audit requires the served llms.txt to contain. Context-free. */
export function aiAnswerQuestions(): string[] {
  return aiAnswers({ bookingFee: null }).map((a) => a.question);
}

export function aiAnswerById(id: string, ctx: AiAnswerContext): AiAnswer | undefined {
  return aiAnswers(ctx).find((a) => a.id === id);
}

/* ── The monthly re-ask, logged in `seo_suggestions` ──────────────────────────────────────────────────────────── */

/** Every AI-answer row's `rationale` starts with this — how the /admin/seo check finds its own rows. */
export const AI_ANSWER_TAG = 'AI-answer check';
/** Re-ask each question this often (Lane K: "the team re-asks them monthly"). */
export const AI_ANSWER_RECHECK_DAYS = 30;
/** The longest AI answer the check stores. */
export const AI_SAID_MAX_CHARS = 4000;

export type AiAnswerVerdict = 'right' | 'wrong';

/** "AI-answer check · commission · wrong" */
export function aiAnswerRationale(id: string, verdict: AiAnswerVerdict): string {
  return `${AI_ANSWER_TAG} · ${id} · ${verdict}`;
}

export function parseAiAnswerRationale(rationale: string | null): { id: string; verdict: AiAnswerVerdict } | null {
  if (!rationale?.startsWith(AI_ANSWER_TAG)) return null;
  const [, id, verdict] = rationale.split(' · ');
  if (!id || (verdict !== 'right' && verdict !== 'wrong')) return null;
  return { id, verdict };
}

/** Newest `created_at` per question id, over the check's rows (any order). */
export function lastAskedById(rows: readonly { rationale: string | null; created_at: string }[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of rows) {
    const p = parseAiAnswerRationale(r.rationale);
    if (!p) continue;
    const prev = out.get(p.id);
    if (!prev || r.created_at > prev) out.set(p.id, r.created_at);
  }
  return out;
}

/** True when a question has never been asked, or was last asked more than `AI_ANSWER_RECHECK_DAYS` ago. */
export function recheckDue(lastAskedIso: string | null, nowMs: number): boolean {
  if (!lastAskedIso) return true;
  const t = Date.parse(lastAskedIso);
  return !Number.isFinite(t) || nowMs - t > AI_ANSWER_RECHECK_DAYS * 24 * 60 * 60 * 1000;
}
