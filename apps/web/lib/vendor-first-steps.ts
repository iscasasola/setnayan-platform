/**
 * The vendor's order of operations — the five things a new shop does, in order,
 * from "I just opened" to "I'm live and can run this myself".
 *
 * WHY THIS EXISTS (owner 2026-08-09): a brand-new shop lands on the Overview and
 * sees an empty decision feed, zeroed tiles and the line "new leads land here the
 * moment a couple unlocks you" — which cannot happen, because an unverified shop
 * is invisible to every couple. Everything a vendor needs to do before that IS
 * built; nothing told them the ORDER. This module is that order, computed from
 * live state so it can never congratulate a vendor for a step they haven't done.
 *
 * ── THE ORDER IS A RECOMMENDATION, NOT A LOCK ──────────────────────────────────
 * Exactly one step is `now`. Later steps render dimmed WITHOUT a call-to-action,
 * but their links stay live: a vendor could always build a service card before
 * finishing their profile and that still works. Turning the rail into a set of
 * locked doors would REMOVE shipped ability, which is a regression, not a
 * feature. The one genuine hard gate in the product is named as such:
 * `verificationSubmitMissing` refuses to submit documents while the business
 * profile is unfinished, so `documentsBlockedBy` carries that reason verbatim.
 *
 * ── WAITING IS NOT DOING ───────────────────────────────────────────────────────
 * Once documents are submitted the vendor cannot act on them — the 5-business-day
 * review is Setnayan's move. A step in `waiting` is therefore SKIPPED when picking
 * `now`, which promotes "bring in the customers you already have" to the current
 * action. That is deliberate: it is the honest answer to "what do I do while I
 * wait", and it is free and works unverified.
 *
 * Pure + input-only so the ordering rules are testable without a database.
 */

import { SERVICE_MAKER_HREF } from './service-picker-anchor';

export type FirstStepKey =
  | 'shop_details'
  | 'service_card'
  | 'documents'
  | 'own_customers'
  | 'go_live';

/**
 * `done`    — condition met.
 * `now`     — the one step being recommended right now. At most one per rail.
 * `waiting` — submitted; Setnayan is reviewing. Nothing for the vendor to press.
 * `later`   — not yet recommended. Reachable, just not the suggested next thing.
 */
export type FirstStepState = 'done' | 'now' | 'waiting' | 'later';

export type VerificationAppStatus =
  | 'none'
  | 'draft'
  | 'pending_review'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

export type FirstStep = {
  key: FirstStepKey;
  /** 1-based position, for the numbered bullet. */
  n: number;
  title: string;
  /** One plain sentence, in the vendor's language — never the plumbing. */
  body: string;
  state: FirstStepState;
  href: string | null;
  cta: string | null;
  /** Live counter ("6 of 8 in"), or null when the step has nothing to count. */
  meter: string | null;
  /**
   * The real, code-enforced reason this step cannot be COMPLETED yet — today
   * only "Finish your business profile" on the documents step, which mirrors
   * `verificationSubmitMissing`. Null when nothing blocks it.
   */
  blockedBy: string | null;
};

export type FirstStepsInput = {
  /** `vendor_profiles.verification_state === 'verified'`. */
  verified: boolean;
  /** Business-profile checklist counts (`businessProfileChecklist`). */
  profileDone: number;
  profileTotal: number;
  /** How many service cards the shop has authored (any state). */
  serviceCount: number;
  /** Latest verification application status; 'none' when never started. */
  docsStatus: VerificationAppStatus;
  /** Document slots filled, and how many exist. */
  docsIn: number;
  docsTotal: number;
  /**
   * Server-computed submit blockers from `verificationSubmitMissing`. Empty
   * means the vendor can press Submit today.
   */
  submitMissing: readonly string[];
  /** Customers on their list — booked events + accepted conversations. */
  customerCount: number;
  /** Admin's decision reason when the application came back rejected. */
  rejectionReason?: string | null;
};

export type FirstStepsRail = {
  steps: FirstStep[];
  /** Steps whose condition is met (go-live counts once verified). */
  doneCount: number;
  total: number;
  /** The single recommended step, or null when everything is done. */
  current: FirstStep | null;
  /** True once the shop is verified — the rail has served its purpose. */
  complete: boolean;
};

/** Documents are out of the vendor's hands while Setnayan reviews them. */
function isUnderReview(status: VerificationAppStatus): boolean {
  return status === 'pending_review' || status === 'in_review';
}

export function buildFirstStepsRail(input: FirstStepsInput): FirstStepsRail {
  const {
    verified,
    profileDone,
    profileTotal,
    serviceCount,
    docsStatus,
    docsIn,
    docsTotal,
    submitMissing,
    customerCount,
    rejectionReason,
  } = input;

  const profileComplete = profileTotal > 0 && profileDone >= profileTotal;
  const underReview = isUnderReview(docsStatus);
  // `approved` is the application's own terminal state; `verified` is the shop's.
  // An admin can verify a shop directly without an application ever being filed
  // (the one-click path in /admin/verify), so either one closes this step —
  // otherwise a hand-verified shop would be nagged forever for paperwork it was
  // never asked for.
  const docsDone = docsStatus === 'approved' || verified;

  // ── The five steps, before `now` is assigned ────────────────────────────────
  const draft: Array<Omit<FirstStep, 'state'> & { done: boolean; waiting: boolean }> = [
    {
      key: 'shop_details',
      n: 1,
      title: 'Finish your shop details',
      body: 'Your logo, address pin, contact numbers and the services you cover. Couples see all of it, and Setnayan needs it complete before you can send your documents.',
      href: '/vendor-dashboard/shop',
      cta: 'Fill in my details',
      meter: profileTotal > 0 ? `${profileDone} of ${profileTotal} in` : null,
      blockedBy: null,
      done: profileComplete,
      waiting: false,
    },
    {
      key: 'service_card',
      n: 2,
      title: 'Put up your first service',
      body: 'A service card is what a couple actually books — a photo, what it covers, and your starting price. You can build it now; it stays private until you go live.',
      // 🔴 THE WORST INSTANCE OF THE DEAD CREATE LINK, because of WHO sees it:
      // this step renders only while `serviceCount === 0`, and a vendor with
      // zero cards is exactly who the services screen lands on the Coverage tab
      // — with the card picker in a hidden panel behind a shut drawer. Step two
      // of a new supplier's own checklist opened a page that did nothing.
      href: SERVICE_MAKER_HREF,
      cta: 'Create a service',
      meter:
        serviceCount > 0
          ? `${serviceCount} service${serviceCount === 1 ? '' : 's'} up`
          : null,
      blockedBy: null,
      done: serviceCount > 0,
      waiting: false,
    },
    {
      key: 'documents',
      n: 3,
      title: 'Send in your documents',
      body:
        docsStatus === 'rejected'
          ? `Setnayan sent your papers back${rejectionReason ? `: ${rejectionReason}` : '.'} Fix what's noted and send them again.`
          : underReview
            ? 'Sent. Setnayan checks these within 5 working days and will contact you to confirm.'
            : 'Your DTI or SEC, BIR 2303, business permit and bank proof. You can start uploading these any time — gathering them is the slow part.',
      href: '/vendor-dashboard/shop#get-verified',
      cta: docsStatus === 'rejected' ? 'Send them again' : 'Upload documents',
      meter: docsTotal > 0 ? `${docsIn} of ${docsTotal} uploaded` : null,
      // The one real hard gate in the flow, quoted from the server-side check.
      blockedBy: profileComplete ? null : (submitMissing[0] ?? null),
      done: docsDone,
      waiting: underReview,
    },
    {
      key: 'own_customers',
      n: 4,
      title: 'Bring in the customers you already have',
      body: "Two QR codes, for two different people. Someone who already booked and paid you a downpayment: set their package, total, downpayment and payment dates first, then they scan the Locked QR once and they're booked on the spot. Someone you're only talking to: the Shortlist QR just puts you on their list — no inquiry, nothing to answer. Both are free for you and for them, and both work before you're approved.",
      href: '/vendor-dashboard/customers',
      cta: 'Get my QR codes',
      meter:
        customerCount > 0
          ? `${customerCount} customer${customerCount === 1 ? '' : 's'} in`
          : null,
      blockedBy: null,
      done: customerCount > 0,
      waiting: false,
    },
    {
      key: 'go_live',
      n: 5,
      title: 'Setnayan approves you — you go live',
      body: 'The day your shop is approved, your page goes live at your own web address, your services become searchable to couples, and the subscription plans unlock. Nothing before this is visible to a stranger.',
      // Nothing to press — this one happens TO the vendor, not BY them.
      href: null,
      cta: null,
      meter: null,
      blockedBy: null,
      done: verified,
      waiting: !verified && underReview,
    },
  ];

  // ── Assign `now`: the first step that is neither done nor waiting ───────────
  // Walking in order is what makes this "one thing at a time". Skipping
  // `waiting` is what stops the rail from telling a vendor to do something they
  // physically cannot do while their papers sit with Setnayan.
  //
  // `go_live` is excluded from ever being `now` — a vendor cannot approve
  // themselves, so presenting it as an action would be a button-shaped lie.
  let assigned = false;
  const steps: FirstStep[] = draft.map((s) => {
    if (s.done) return toStep(s, 'done');
    if (s.waiting) return toStep(s, 'waiting');
    if (!assigned && s.key !== 'go_live') {
      assigned = true;
      return toStep(s, 'now');
    }
    return toStep(s, 'later');
  });

  const doneCount = steps.filter((s) => s.state === 'done').length;

  return {
    steps,
    doneCount,
    total: steps.length,
    current: steps.find((s) => s.state === 'now') ?? null,
    complete: verified,
  };
}

function toStep(
  s: Omit<FirstStep, 'state'> & { done: boolean; waiting: boolean },
  state: FirstStepState,
): FirstStep {
  const { done: _done, waiting: _waiting, ...rest } = s;
  return { ...rest, state };
}
