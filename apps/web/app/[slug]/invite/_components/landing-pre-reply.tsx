import Link from 'next/link';
import { LANDING_WORDS } from '@/lib/guest-landing';
import { TicketPicture } from '../../_components/ticket-picture';

/**
 * THE GUEST'S LANDING BEFORE THE REPLY — ONE BUTTON.
 *
 * Owner, 2026-10-01, on the walk-through screenshot of `/invite/enter`
 * (DECISION_LOG "THE GUEST LANDING BEFORE THE REPLY HAS ONE BUTTON"): *"there
 * seems to have many places to go to. just 1 button to reply to the invitation —
 * the info after QR Code seems to repeat itself."*
 *
 * So until a guest has replied this page is exactly three things: the couple's
 * greeting card, ONE accented link — "Reply to the invitation" — and the faded
 * ticket as a PICTURE ("your ticket is waiting"; it carries no control of its own
 * any more — the "Reply to confirm your ticket" pill is gone).
 *
 * Everything else that used to sit under it — "How to use it", "Open the save the
 * date", "Your link opens this invitation any time" + Copy my link, the Terms
 * tick, "Save to my account", Your guests — is drawn by `enter/page.tsx` once a
 * reply exists, in the same page, exactly once. Nothing was removed from the
 * product; it moved behind the answer.
 *
 * 🔒 THE COUNT IS PINNED. `the-landing-before-the-reply-has-one-button.test.ts`
 * renders this component and counts its links and buttons: exactly one. Adding a
 * control here is a design change that test will name.
 *
 * ⚠ The page keeps its own inline copy of the message card and the reply link for
 * ONE case this component deliberately does not serve — a plus-one who has not
 * replied but whose bringer's reply already gave them a FULL ticket (they keep
 * Save, their guests and the account button). Both read `LANDING_WORDS.reply`.
 */
export function LandingPreReply({
  message,
  hosts,
  replyHref,
  replyByLabel,
  fadedTicket,
  ticketSrc,
  awaitingLine,
}: {
  /** The couple's message, name as given (`landingMessage`). */
  message: string;
  hosts: string;
  replyHref: string;
  /** "Please reply by …" — only a host-set date still ahead, else null. */
  replyByLabel: string | null;
  /** The ticket is a picture of what is waiting (`landingTicketOf` === 'faded'). */
  fadedTicket: boolean;
  ticketSrc: string;
  /** A request still waiting on the couple says so, as a sentence — never a control. */
  awaitingLine: string | null;
}) {
  return (
    <>
      <div data-landing="message" className="space-y-3">
        <div
          className="sn-glass-bare rounded-2xl bg-cream/95 px-[18px] py-4 text-[15px] leading-relaxed text-ink shadow-sm"
          data-landing-message=""
        >
          <p>{message}</p>
          <p className="mt-2.5 font-serif text-base italic text-mulberry">— {hosts}</p>
        </div>
      </div>

      <div data-landing="reply">
        <Link className="button-primary w-full" href={replyHref} data-landing-reply="">
          {LANDING_WORDS.reply}
        </Link>
        {replyByLabel ? <p className="mt-2.5 text-center text-xs text-ink/55">Please reply by {replyByLabel}</p> : null}
      </div>

      {fadedTicket ? (
        <section aria-hidden="true" className="relative text-center" data-landing="ticket" data-landing-ticket="faded">
          <div className="pointer-events-none mx-auto w-[min(260px,100%)] select-none overflow-hidden rounded-2xl opacity-[0.42] grayscale">
            <TicketPicture src={ticketSrc} alt="" fallback={null} />
          </div>
        </section>
      ) : null}
      {awaitingLine ? (
        <p className="text-sm text-ink/70" data-landing="ticket">
          {awaitingLine}
        </p>
      ) : null}
    </>
  );
}
