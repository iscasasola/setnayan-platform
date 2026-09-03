/**
 * What a couple is TOLD when a render does not happen (MB8).
 *
 * 🔑 THIS MODULE EXISTS BECAUSE A LOG LINE NEVER CHANGED A PIXEL.
 *
 * The guest-list failure this repo shipped was already bound to an error
 * handler and already reporting to Sentry, and a couple with 180 names was
 * still told "No guests yet. Start by adding the couple's first invite." The
 * measurement existed. It did not reach the render. So the rule taken from it
 * is: a failure is not handled until it has WORDS, and the words are a
 * deliverable, not a detail.
 *
 * ── WHY IT IS A `Record`, NOT A `switch` WITH A `default` ──────────────────
 * `Record<RenderFailureCode, …>` makes a new failure code a COMPILE ERROR here
 * until somebody writes the sentence. A `switch` with a `default: return
 * 'Something went wrong'` would accept every future code silently — and
 * "something went wrong" is the same non-answer as a stuck chip. There is
 * deliberately no fallback string in this file.
 *
 * ── THE THREE THINGS EVERY MESSAGE MUST DO ────────────────────────────────
 *   1. Say the render did NOT happen. Not "may not have", not silence.
 *   2. Say the credit came back, because it did — `moodboard_fail_render`
 *      refunds in the same transaction that marks the failure, so this is a
 *      fact we can state without hedging, and stating it is what stops a
 *      couple counting a loss they did not take.
 *   3. Say whether trying again is worth anything. "Try again" on a
 *      `not_configured` is a lie that wastes their afternoon.
 */

import type { RenderFailureCode } from './gemini-image';

export type RenderFailureCopy = {
  /** Shown on the tile. Short — it sits in a small box. */
  headline: string;
  /** One sentence under it. */
  detail: string;
  /** Is a retry worth their time? Drives whether the box offers the button. */
  retryable: boolean;
};

/**
 * Every code, with the sentence a couple reads. Keyed by the union, so the
 * type checker holds the promise that all of them have one.
 *
 * The credit line is stated in CREDITS, never pesos — section 04's peso guard
 * (`moodboard-make-it-real.test.ts`) covers this surface too.
 */
export const RENDER_FAILURE_COPY: Record<RenderFailureCode, RenderFailureCopy> = {
  not_configured: {
    headline: 'Renders are offline',
    detail:
      'Photo rendering is switched off right now — nothing was made and no credit was used. This is on us, not your board; please try later today.',
    // A retry cannot fix an unset key. Offering the button would be theatre.
    retryable: false,
  },
  refused: {
    headline: 'This one was declined',
    detail:
      'The photo service declined this brief, so no photo was made and your credit is back. Changing your note or the reference photo usually clears it.',
    retryable: true,
  },
  http_error: {
    headline: 'The photo service refused',
    detail:
      'We reached the photo service and it returned an error, so nothing was made and your credit is back. Trying again shortly usually works.',
    retryable: true,
  },
  timeout: {
    headline: 'It took too long',
    detail:
      'The photo did not come back in time, so we stopped waiting and put your credit back. Nothing is still running in the background.',
    // "Nothing is still running" is the whole point. The stuck upload chip sat
    // at 0% forever because the surface never said the attempt was over.
    retryable: true,
  },
  network: {
    headline: 'We could not reach the service',
    detail:
      'We could not get through to the photo service, so nothing was made and your credit is back. Please try again in a moment.',
    retryable: true,
  },
  no_image: {
    headline: 'No photo came back',
    detail:
      'The photo service answered without an image, so there is nothing to show and your credit is back. Trying again often gives a different result.',
    retryable: true,
  },
  bad_shape: {
    headline: 'Something is wrong on our side',
    detail:
      'We got an answer we could not read, so nothing was made and your credit is back. We are told about this one — please try later.',
    // Genuinely ours: the provider's contract moved, or we are pointed wrong.
    // A couple retrying into a shape mismatch just loses time.
    retryable: false,
  },
};

/**
 * Copy for a code that reached us as a plain string — e.g. read back out of
 * `event_renders.failure_reason` on a later page load, where the union has
 * been through the database and is `string` again.
 *
 * An UNRECOGNISED code still gets a truthful failure, never a success and
 * never a blank: it is the one place a fallback belongs, because the input is
 * an untrusted string rather than a value the type checker vouched for.
 */
export function renderFailureCopy(code: string | null | undefined): RenderFailureCopy {
  if (code && code in RENDER_FAILURE_COPY) {
    return RENDER_FAILURE_COPY[code as RenderFailureCode];
  }
  return {
    headline: 'This render did not finish',
    detail:
      'Something stopped this photo from being made, so there is nothing to show and your credit is back.',
    retryable: true,
  };
}

/**
 * How long an in-flight render may sit before the surface calls it stalled.
 *
 * ⚠ THIS IS THE STUCK-CHIP FENCE, AND IT IS THE ONE FAILURE THE SERVER ACTION
 * CANNOT REPORT ITSELF. Every other failure above is returned by an action
 * that is still running. If the process is KILLED mid-render — a platform
 * timeout, a deploy, an OOM — nobody gets to write `failed_at`, and the row
 * sits with `image_key IS NULL` forever. Read naively that is a tile that
 * looks like it is still working, for the rest of the couple's engagement.
 *
 * So the read path treats an in-flight row older than this as a FAILURE on the
 * box (see `isStalledRender`), with the credit shown as still held rather than
 * quietly written off — the couple is told the truth: it stopped, and here is
 * where their credit is. `event_renders_in_flight_idx` exists so an operator
 * can list exactly these.
 *
 * Deliberately longer than the provider deadline in `gemini-image.ts`, so a
 * render that is genuinely still working is never called stalled.
 */
export const RENDER_STALL_AFTER_MS = 10 * 60 * 1000;

export function isStalledRender(
  row: { image_key: string | null; failed_at: string | null; created_at: string },
  now: number = Date.now(),
): boolean {
  if (row.image_key !== null || row.failed_at !== null) return false;
  const started = Date.parse(row.created_at);
  if (!Number.isFinite(started)) return false;
  return now - started > RENDER_STALL_AFTER_MS;
}
