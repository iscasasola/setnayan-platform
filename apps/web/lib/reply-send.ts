/**
 * reply-send.ts — sending a reply never loses what was typed and never hangs.
 *
 * ── The defect ─────────────────────────────────────────────────────────────
 * The reply card posts through a plain `<form action={serverAction}>`. React
 * runs that action itself, and when the request FAILS — the phone is offline,
 * the server answers 5xx, the action throws — React throws the failure into the
 * nearest error boundary. On the guest side that boundary replaces the screen
 * ("This invitation didn't load."), which UNMOUNTS the form: every answer, the
 * plus-one's name, the note to the couple — gone. And while the request simply
 * never answers, the full-screen "Sending…" veil stays up with no end.
 *
 * ── The rule ───────────────────────────────────────────────────────────────
 * The press is caught on the client (`ReplyForm`, the form's own `onSubmit`),
 * and the send goes through `press()` below:
 *
 *   · it FAILED (offline · 5xx · the action threw) → `'not_sent'`. The form is
 *     never unmounted, so everything typed is still there, and the card says
 *     `REPLY_NOT_SENT` next to the button.
 *   · it did not answer within `REPLY_SEND_LIMIT_MS` → `'not_sent'` too: the
 *     veil gives the screen back and the same line shows.
 *   · a SECOND press while the first is still out → `'ignored'`, nothing sent.
 *   · Next's own signals (the redirect that IS a landed reply, a not-found)
 *     pass straight through `rethrow` — they are not failures.
 *
 * ⚠ THE PENDING STATE IS THE FORM'S OWN, NOT REACT'S FORM STATUS. The first
 * build ran the send in a `useTransition` and let `useFormStatus` drive the
 * button and the veil. In a real browser the "not sent" line appeared at the
 * limit and the veil was STILL UP: React ties a form's status to the whole
 * async action, Next's request included, so it cannot end before the request
 * does. `ReplyForm` therefore holds its own `sending` state, starts the send a
 * task after the submit event and outside any transition, and hands the state
 * to the button (`ReplySubmit` → `SubmitButton`'s `pending`).
 *
 * ⚠ WHAT A TIME LIMIT CANNOT KNOW. After the limit the request is still out; it
 * cannot be called back. If it lands late the guest is taken on to the
 * thank-you exactly as if it had answered in time (Next applies the redirect
 * whether or not anyone is still waiting), and a second press writes the same
 * answer to the same row. The line says "not recorded yet" because nothing has
 * confirmed it — it is the state of the guest's knowledge, not a promise.
 *
 * Without JavaScript none of this runs: the form's `action` is still the server
 * action, and the browser posts it as it always did.
 *
 * 🔑 Pure and DOM-free so the three outcomes can be driven in a unit test.
 * 🛡 lib/reply-send.test.ts.
 */

/** How long one send may stay out before the guest is given the screen back. */
export const REPLY_SEND_LIMIT_MS = 20_000;

/**
 * The line a failed send shows — the SAME words the page already uses for a
 * reply the server refused to save (`?rsvp=error`, app/[slug]/page.tsx and
 * invite/reply/page.tsx). One sentence for one fact. Pinned equal by
 * lib/reply-send.test.ts.
 */
export const REPLY_NOT_SENT =
  'We could not save your reply just now. Please try again — it has not been recorded yet.';

export type ReplySendOutcome = 'sent' | 'not_sent' | 'ignored';

export type ReplySenderDeps = {
  /** Re-throws what the framework must handle (a redirect, a not-found); returns for anything else. */
  rethrow: (err: unknown) => void;
  limitMs?: number;
  /** Injectable for tests. */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
};

/**
 * One sender per form. `press(send)` runs `send` unless a send is already out.
 */
export function makeReplySender(deps: ReplySenderDeps) {
  const limitMs = deps.limitMs ?? REPLY_SEND_LIMIT_MS;
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  let out = false;

  return {
    /** True while a send is out — a press now would be ignored. */
    busy: () => out,
    async press(send: () => Promise<unknown>): Promise<ReplySendOutcome> {
      if (out) return 'ignored';
      out = true;
      let timer: unknown;
      try {
        // `async` so a send that throws before its first await is a rejection too.
        const pending = (async () => send())();
        // A send that loses the race below is still out. Its late answer is
        // Next's to apply; its late failure must not surface as an unhandled
        // rejection after the guest was already told.
        pending.catch(() => {});
        await Promise.race([
          pending,
          new Promise<never>((_, reject) => {
            timer = setTimer(() => reject(new Error('The reply did not answer in time')), limitMs);
          }),
        ]);
        return 'sent';
      } catch (err) {
        deps.rethrow(err);
        return 'not_sent';
      } finally {
        clearTimer(timer);
        out = false;
      }
    },
  };
}
