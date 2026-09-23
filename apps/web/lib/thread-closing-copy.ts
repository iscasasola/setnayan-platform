/**
 * thread-closing-copy.ts — WHO CLOSED THIS CONVERSATION, AND THEREFORE WHAT IT SAYS.
 *
 * ── WHAT THIS EXISTS TO CATCH (owner, 2026-09-22: "fix the withdrew and
 *    booked-another copy") ────────────────────────────────────────────────────
 * Both thread pages ended their branch chain in a bare `else`:
 *
 *     accepted ? … : pending ? … : (  ← everything else lands here
 *
 * so `declined`, `displaced`, and a withdrawn thread all rendered ONE sentence.
 * The couple who withdrew their own inquiry was told **"{vendor} isn't available
 * for your date"** and offered *See similar vendors*, as though they had been
 * turned down. The supplier whose customer booked someone else was told
 * **"You declined this inquiry"** — an act they did not perform.
 *
 * 🔑 **THE APP STATED A FACT ABOUT THE OTHER PARTY THAT WAS NOT TRUE.** That is
 * worse than a blank: a blank invites a question, a false sentence closes one.
 *
 * ── THE MEASUREMENT THAT CHANGED THE SHAPE OF THE FIX ───────────────────────
 * A withdrawal is **not** `inquiry_status = 'withdrawn'`. `withdrawInquiry`
 * (`app/dashboard/[eventId]/messages/actions.ts`) writes
 * `.update({ archived_at: … })` and never touches `inquiry_status`, so a
 * withdrawn thread keeps the status it already had. Confirm with:
 *
 *     grep -n "archived_at" "apps/web/app/dashboard/[eventId]/messages/actions.ts"
 *
 * ⚠ So the closing state is a function of **TWO** columns, and a reader of
 * `inquiry_status` alone cannot see a withdrawal at all. The couple's LIST page
 * already knew this — `isRemoved = archived_at != null` → the "Removed" badge —
 * while the THREAD page never read the column. **The list was right and the
 * thread was wrong**, which is why the rule now lives here, in one place both
 * import, rather than being fixed twice.
 *
 * ⛔ `'withdrawn'` and `'expired'` ARE IN THE ENUM AND NOTHING WRITES THEM.
 * Measured 2026-09-22: zero rows for every non-`accepted` state in production,
 * and no occurrence of either label anywhere in `apps/web/app` or `apps/web/lib`
 * for a chat thread. The vocabulary is enforced by the TYPE, not by a CHECK
 * constraint — so grepping the migrations for a state list finds nothing, and
 * that nothing means nothing. **A state in the enum is not a state the product
 * can reach.** They are mapped here anyway, to the honest neutral copy, because
 * the cost of mapping a dead label is one line and the cost of missing a live
 * one is a false sentence.
 *
 * 🔑 **AN UNRECOGNISED STATE MUST NEVER BORROW THE DECLINE WORDING.** That is
 * the defect, not the two sentences — the old `else` meant any label added to
 * the enum later would silently inherit "declined". `resolveClosingKind`
 * returns an explicit `'unrecognised'` and `closingCopy` gives it neutral words
 * and NO "See similar vendors" (which would imply a rejection that did not
 * happen). It deliberately does not throw: a server component that throws takes
 * the whole conversation down, and a couple losing their thread is a worse
 * outcome than a vague sentence. `thread-closing-copy.test.ts` asserts the
 * unrecognised sentence differs from every other one.
 *
 * Pure: no imports, no I/O, no React. Both thread pages import it.
 */

/**
 * THE THREAD ROW ITSELF, not a hand-built literal — deliberately.
 *
 * 🔑 The first cut took `{ inquiryStatus, archivedAt }`, which both pages
 * assembled by hand at the call site. **A guard on the call cannot see the
 * argument:** drop `archivedAt:` from either literal and all eight tests stay
 * green while every withdrawal silently reads as a decline again — the exact
 * bug this module exists to kill, reintroduced without a single red light.
 * Taking the row means there is no literal to forget a field from; the caller
 * passes `thread` and the shape comes from `ChatThreadRow`.
 *
 * Field names are snake_case to match the row, so `closingCopy(thread, …)`
 * type-checks against the DTO with no adapter in between.
 */
export type ClosingInput = {
  /** `chat_threads.inquiry_status`. Unknown strings are handled, never trusted. */
  readonly inquiry_status: string | null | undefined;
  /** `chat_threads.archived_at` — non-null means the couple withdrew/removed it. */
  readonly archived_at?: string | null;
};

export type ClosingKind =
  /** Not closed — the composer or the pending card owns the screen. */
  | 'open'
  /** The couple withdrew. Stored as `archived_at`, NOT as a status. */
  | 'withdrawn'
  /** The couple booked someone else in a hard-single group. */
  | 'displaced'
  /** The supplier declined. May carry a reason. */
  | 'declined'
  /** A status this module does not know. Never borrows another kind's words. */
  | 'unrecognised';

export type Viewer = 'couple' | 'vendor';

export type ClosingCopy = {
  kind: ClosingKind;
  /** The one sentence. Never names an act the reader did not perform. */
  sentence: string;
  /** Offer alternatives? Only where the reader was actually turned down. */
  showSimilarVendors: boolean;
  /** Offer Withdraw? Only where there is still something to withdraw. */
  showWithdraw: boolean;
};

/**
 * `archived_at` wins over the status, because it is the only record a
 * withdrawal leaves and it is set on a thread whose status is still `pending`.
 */
export function resolveClosingKind(input: ClosingInput): ClosingKind {
  if (input.archived_at != null && String(input.archived_at).length > 0) return 'withdrawn';
  switch (input.inquiry_status) {
    case 'accepted':
    case 'pending':
      return 'open';
    case 'declined':
      return 'declined';
    case 'displaced':
      return 'displaced';
    // In the enum, written by nothing. Mapped to their honest meaning anyway.
    case 'withdrawn':
      return 'withdrawn';
    case 'expired':
      return 'unrecognised';
    default:
      return 'unrecognised';
  }
}

/**
 * IS THIS CONVERSATION OVER? The one predicate both pages gate their controls on.
 *
 * ⚠ **A WITHDRAWN THREAD IS STILL `inquiry_status = 'pending'`**, because
 * `withdrawInquiry` writes only `archived_at`. So a page that branches on the
 * status alone reaches its PENDING arm and offers the actions of a live
 * inquiry on a conversation the couple already closed:
 *   · the couple got a working composer, or "Waiting for {vendor} to accept"
 *     with a **Withdraw inquiry** button for an inquiry already withdrawn;
 *   · the supplier got **Accept inquiry**, on an inquiry that no longer exists.
 *
 * Both pages now ask this BEFORE they look at the status, so a closed thread
 * falls through to its closing sentence instead of pretending to be live.
 */
export function isThreadClosed(input: ClosingInput): boolean {
  return resolveClosingKind(input) !== 'open';
}

/** Trimmed, or null. A blank reason must not render empty quote marks. */
function cleanReason(reason: string | null | undefined): string | null {
  const t = (reason ?? '').trim();
  return t.length > 0 ? t : null;
}

export function closingCopy(
  input: ClosingInput,
  viewer: Viewer,
  opts: {
    /** The other party's display name, already anonymity-resolved by the caller. */
    counterpartyLabel: string;
    /** `chat_threads.decline_reason`, if the supplier left one. */
    declineReason?: string | null;
  },
): ClosingCopy {
  const kind = resolveClosingKind(input);
  const other = opts.counterpartyLabel;
  const reason = cleanReason(opts.declineReason);

  if (kind === 'open') {
    return { kind, sentence: '', showSimilarVendors: false, showWithdraw: false };
  }

  if (viewer === 'couple') {
    switch (kind) {
      case 'declined':
        // SHIPPED WORDING — unchanged. This is the only state where the couple
        // really was turned down, so it is the only one that offers alternatives.
        return {
          kind,
          sentence: reason
            ? `${other} declined this inquiry. Why: “${reason}” Browse similar vendors to keep your options open.`
            : `${other} isn’t available for your date. Browse similar vendors to keep your options open.`,
          showSimilarVendors: true,
          showWithdraw: true,
        };
      case 'withdrawn':
        // NEW WORDING. "Removed" is the owner's word on the list badge; the
        // sentence is this session's, and is flagged as such in the report.
        return {
          kind,
          sentence: `You withdrew this inquiry. ${other} was told, and the conversation is kept as your record.`,
          showSimilarVendors: false,
          showWithdraw: false,
        };
      case 'displaced':
        // "You booked another" is the owner's word on the list badge.
        return {
          kind,
          sentence: `You booked another supplier for this, so the conversation closed. Nothing was deleted.`,
          showSimilarVendors: false,
          showWithdraw: false,
        };
      default:
        return {
          kind: 'unrecognised',
          sentence: 'This conversation is closed.',
          showSimilarVendors: false,
          showWithdraw: false,
        };
    }
  }

  switch (kind) {
    case 'declined':
      // SHIPPED WORDING — unchanged.
      return {
        kind,
        sentence:
          'You declined this inquiry. The couple has been notified and pointed to other vendors.',
        showSimilarVendors: false,
        showWithdraw: false,
      };
    case 'withdrawn':
      return {
        kind,
        sentence: 'The couple withdrew this inquiry. The conversation is kept as the record.',
        showSimilarVendors: false,
        showWithdraw: false,
      };
    case 'displaced':
      // "Released · booked another" is the owner's word on the supplier's list badge.
      return {
        kind,
        sentence:
          'Released — the couple booked another supplier. Nothing you need to do.',
        showSimilarVendors: false,
        showWithdraw: false,
      };
    default:
      return {
        kind: 'unrecognised',
        sentence: 'This conversation is closed.',
        showSimilarVendors: false,
        showWithdraw: false,
      };
  }
}
