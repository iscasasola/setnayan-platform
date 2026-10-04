import { PASS_ANCHOR } from '@/lib/arrival-action';
import { PASS_CARD_ROUTE, PASS_CARD_WORDS, passCardLine, type PassCardEligibility } from '@/lib/pass-card';
import { REQUEST_WORDS } from '@/lib/request-key';
import { GuestCodeKeepers } from './guest-code-keepers';
import { TicketPicture } from './ticket-picture';

/**
 * THE GUEST'S DIGITAL TICKET, ON ME.
 *
 * Owner, verbatim 2026-09-30, pointing at the Event Hub's pass section
 * (`#site-pass`: a GUEST / ARRIVE grid over a round QR): *"i thought this will
 * be the digital ticket"* — and the same day: the ticket belongs on the
 * guest's **Me** page only, not on Home/Details. So Home has no pass any more
 * (site-body.tsx) and this is the one place a guest sees their ticket.
 *
 * 🔑 ONE SOURCE. The card is `/api/guest/pass-card` — the 1080 × 1440 PNG
 * the ticket renderer draws (lib/pass-card-render.ts, the couple's chosen
 * look, Classic by default) and "Save my ticket" downloads. Shown at 300 CSS
 * px it is 3.6 device pixels per CSS pixel, so its QR is scannable off the
 * screen (decode-tested at that size in `the-hub-shows-the-ticket.test.ts`).
 * No table on it (owner 2026-09-30: "no seat plan on the digital ticket for
 * the moment") — the route decides that, not this file.
 *
 * STATES — `passCardEligibility`, reused, never re-decided:
 *   pass       → the ticket, "Save my ticket", "Show this at the door."
 *   awaiting   → the SAME route draws the "Request pending" ticket for this
 *                guest's own session (`decidePassCardAccess` → `pending`),
 *                with the prototype's own line (REQUEST_WORDS.sentUnlocks).
 *   cannotCome → no ticket: the one declined line.
 *   none       → nothing here (Me then offers "My QR", as it always did).
 *
 * ⚓ IT CARRIES `PASS_ANCHOR`, so the day-of "Show your ticket" action still
 * lands on it, and `GuestHubBar` still sees a ticket on the page and hides
 * its duplicate "My QR" button. One mount, one id.
 */
export function GuestTicket({
  state,
  name,
  invitationUrl,
  src = PASS_CARD_ROUTE,
}: {
  state: PassCardEligibility;
  name: string;
  invitationUrl: string;
  /**
   * 👁 SEE AS (PR-10): the Maker's sample guest has no session for the guest
   * ticket route, so its picture is the host's own ticket preview
   * (`sampleTicketSrc`, lib/simulated-guest-preview.ts). Every real guest: the default.
   */
  src?: string;
}) {
  if (state === 'none') return null;
  if (state === 'cannotCome') {
    return (
      <section id={PASS_ANCHOR} data-guest-ticket="cannotCome" className="scroll-mt-6 text-center">
        <p className="text-sm text-ink/70">{passCardLine(state)}</p>
      </section>
    );
  }
  const pending = state === 'awaiting';
  return (
    <section
      id={PASS_ANCHOR}
      data-motion="pass"
      data-guest-ticket={state}
      aria-label={`Your ${PASS_CARD_WORDS.digitalTicket}`}
      className="scroll-mt-6 text-center"
    >
      <TicketPicture
        src={src}
        alt={`${name}’s ${PASS_CARD_WORDS.digitalTicket}`}
        fallback={
          <div data-ticket-fallback="" className="mx-auto w-[min(300px,100%)]">
            {pending ? null : (
              // The bare code, from the route that needs no drawing — the door
              // still works when the picture could not be made.
              // eslint-disable-next-line @next/next/no-img-element -- cookie-authenticated PNG
              <img
                src="/api/guest/qr"
                alt={`QR code for ${name}`}
                width={224}
                height={224}
                className="mx-auto h-56 w-56 rounded-xl bg-white p-3"
              />
            )}
            <p role="alert" className="mt-2 text-xs text-ink/70">
              {pending
                ? `We couldn’t draw your ${PASS_CARD_WORDS.noun} just now.`
                : `We couldn’t draw your ${PASS_CARD_WORDS.noun} just now — this code still works at the door.`}
            </p>
          </div>
        }
      />
      <p className="mx-auto mt-3 max-w-prose text-sm text-ink/60">
        {pending ? REQUEST_WORDS.sentUnlocks : 'Show this at the door.'}
      </p>
      <GuestCodeKeepers invitationUrl={invitationUrl} className="mt-3" passCardHref={src} />
    </section>
  );
}
