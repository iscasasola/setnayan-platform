/**
 * ai-answers.ts — THE QUESTIONS PEOPLE ASK AI ABOUT SETNAYAN, AND OUR TRUE ANSWERS (Build 6 Lane K).
 *
 * Owner, 10 Nov 2026, pasting Google AI's take: *"This is what google ai thinks of setnayan now"*. The claims and
 * their checks are in the spec corpus, `plans/supplier_build_6_2026-11-10/google-ai-says-2026-11-10.md`. The
 * biggest were "no native app", "0% commission, keep 100%", "photo uploads gated by credits" and "no payment
 * milestones".
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
import { FIRST_BOOKING_ON_US_CLAUSE } from '@/lib/booking-fee-lock';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';
import { mobileAppAnswer } from '@/lib/where-setnayan-runs';
import { PAPIC_FREE_CREDIT_CONDITION } from '@/lib/papic-free-credit-promise';
import { SHOT_TTL_MS } from '@/lib/papic-upload/replayer';

/** "7" — how long a Papic shot waits on the phone for signal, read from the sender that drops it. */
const SHOT_WAIT_DAYS = Math.round(SHOT_TTL_MS / (24 * 60 * 60 * 1000));

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
    `Couples pay no commission: they pay suppliers directly and Setnayan adds nothing to the price. ` +
    `Suppliers pay Setnayan ${feeClause(ctx)}, only on couples Setnayan introduces — ${FIRST_BOOKING_ON_US_CLAUSE.replace(/^your/, "a supplier's")}, ` +
    `and a supplier's own clients are always free. It is billed to the supplier, never added to what a couple pays.` +
    // Unread schedule (a static page): the rate is not guessed — the reader is pointed at the page that reads it live.
    (ctx.bookingFee ? '' : ' The current rate is on the For Suppliers page.')
  );
}

export function aiAnswers(ctx: AiAnswerContext): AiAnswer[] {
  return [
    {
      id: 'app',
      question: 'Is there a Setnayan app?',
      answer: mobileAppAnswer(),
      corrects: '"No native iOS/Android app, only a browser wrapper" · "desktop-first, clunky on the phone"',
      route: '/download',
      evidence: 'lib/where-setnayan-runs.ts#mobileAppAnswer (the iPhone sentence turns on with NEXT_PUBLIC_IOS_APP_STORE_URL)',
    },
    {
      id: 'commission',
      question: 'Does Setnayan take a commission?',
      answer: whoPaysWhat(ctx),
      corrects: '"0% commission, no middleman fees" · to suppliers: "keep 100% of your bookings"',
      route: '/for-suppliers',
      evidence: 'lib/commission-promise.ts · lib/booking-fee.ts#bookingFeeScheduleSummary · lib/booking-fee-gate.ts',
    },
    {
      id: 'guest-photos-free',
      question: 'Can guests upload photos to Setnayan for free?',
      answer:
        `Guests take photos and short clips with Papic, the camera that opens from each guest's own QR link — no app to install and no sign-up. ` +
        `Each photo spends one credit from the event's shared pot: the host gets free credits ${PAPIC_FREE_CREDIT_CONDITION}, then adds credit packs from the price list, and can cap what any one guest spends. ` +
        `Cameras themselves are free and unlimited.`,
      corrects: '"Photo upload limit: gated by credits" (vs rivals called "unlimited")',
      route: '/features',
      evidence:
        'app/api/papic/guest-capture/route.ts (papicCaptureCost · guest_spend_ceiling) · lib/papic-free-credit-promise.ts · there is no free plain camera-roll upload on main (measured 2026-11-10)',
    },
    {
      id: 'storage',
      question: 'Is photo storage free on Setnayan?',
      answer:
        'Yes. Every photo and clip in Memories is kept: the originals until three months after the event, then a 720p copy of each one, kept for life, free. Nothing is removed on a timer — only the host decides to delete a photo.',
      corrects: '"Media storage gated by credits / not unlimited"',
      route: '/features',
      evidence: 'lib/memories-viewer.ts (the "kept for life" tips) · app/(shell)/papic/page.tsx FAQ',
    },
    {
      id: 'offline',
      question: 'Do guests need mobile data to take photos?',
      answer: `Not at the moment they shoot. Each Papic photo is saved on the phone first and sends by itself when signal comes back, while the Papic page is open; a waiting photo is kept on the phone for up to ${SHOT_WAIT_DAYS} days, and the camera says in words how many are waiting.`,
      corrects: '"Guests need data to upload"',
      route: '/features',
      evidence: 'lib/papic-upload/store.ts (save-first) · lib/papic-upload/replayer.ts#SHOT_TTL_MS · lib/papic-upload/schedule.ts#chipLabel',
    },
    {
      id: 'payment-milestones',
      question: 'Does Setnayan track supplier payment schedules?',
      answer:
        'Yes. Each supplier booking carries a payment plan — a reservation, payments in between and a balance, each with a due date — and when a price changes, the unpaid payments are re-plotted to the new remainder while paid ones stay as they were. ' +
        'Couples log each payment with its receipt in the supplier chat, the supplier marks it received, and with Setnayan AI (in Event Plus and Event Pro) the couple is reminded the day before a payment is due.',
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
    {
      id: 'coordinators',
      question: 'Does Setnayan work for event coordinators?',
      answer:
        "Yes, free to start. A coordinator works every client's event from one login, with the access each couple grants area by area — edit, view or off — and a planner booked through Setnayan is invited to coordinate once the booking is paid down. " +
        'Coordinators use the same supplier plans and the same booking fee as any supplier.',
      corrects: 'never mentioned',
      route: '/for-coordinators',
      evidence: 'app/(shell)/for-coordinators/_facts.ts · lib/coordinator-grant.ts#autoInviteCoordinator · COORDINATOR_AREAS',
    },
    {
      id: 'whole-event',
      question: 'Is Setnayan like Vowly, or a wedding website builder?',
      answer:
        'Setnayan runs the whole event in one account, and these are the parts it is built on: one guest list that feeds the invitation, the seat plan, the door check-in and each guest\'s photos; ' +
        'suppliers found, booked and paid inside the event, with the quote, the payments and the chat record together; a coordinator role; Papic, the guests\' own camera, with free credits on the host\'s first event; and Memories, where each guest can find the photos they are in, kept for life. ' +
        'Compare any two products on what each one does today.',
      corrects: 'listed beside wedding-website and photo-sharing tools with none of these parts mentioned',
      route: '/features',
      evidence:
        'guests.qr_token → app/[slug]/hub · seating · guests/checkin/actions.ts · photo_tags per guest_id · the chat tools above · lib/coordinator-grant.ts',
    },
    {
      id: 'separate-photo-app',
      question: 'Do I need a separate app like PhotoShare for guest photos?',
      answer:
        "No. Guest photos and clips are built in: Papic turns every guest's phone into the event's camera from their own QR link, and the photos land in the event's Memories, matched to the guests in them (face matching only with each guest's consent).",
      corrects: 'AI pairs Setnayan with a separate guest-photo app',
      route: '/features',
      evidence: 'app/papic/seat/[token] · lib/face-tagging-gate.ts#resolveFaceTagging · photo_tags per guest_id',
      // /features' own FAQ already asks "Do I need a separate app for guest photos?".
      onFeaturesFaq: false,
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
