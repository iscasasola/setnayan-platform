import Link from 'next/link';
import type { ReactNode } from 'react';
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
  whenWhere = null,
  shut = null,
}: {
  /** 📬 The couple's reply window is shut: its note (`ReplyWindowNote`) stands where the button was — no button. */
  shut?: ReactNode;
  /**
   * 🗓 WHEN AND WHERE, ONE LINE, ABOVE THE BUTTON (owner 2026-10-11: a guest was
   * asked to reply without being told when or where) — `landingWhenWhere`:
   * the date as far as it is decided, the ceremony's time beside a real day,
   * the place. Null (nothing set) draws no line.
   */
  whenWhere?: string | null;
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
        {whenWhere ? (
          <p data-landing-when-where="" className="mb-3 text-center text-sm text-ink/80">
            {whenWhere}
          </p>
        ) : null}
        {shut ? (
          shut
        ) : (
          <>
            <Link className="button-primary w-full" href={replyHref} data-landing-reply="">
              {LANDING_WORDS.reply}
            </Link>
            {replyByLabel ? <p className="mt-2.5 text-center text-xs text-ink/70">Please reply by {replyByLabel}</p> : null}
          </>
        )}
      </div>

      {fadedTicket ? (
        <section className="relative text-center" data-landing="ticket" data-landing-ticket="faded">
          <div aria-hidden="true" className="pointer-events-none mx-auto w-[min(260px,100%)] select-none overflow-hidden rounded-2xl opacity-[0.42] grayscale">
            <TicketPicture src={ticketSrc} alt="" fallback={null} />
          </div>
          {/* 🎟 WHY IT IS FAINT (owner 2026-10-11: drawn grey with nothing saying why, it read as a picture that
              failed to load). One line, said to everyone — the picture stays hidden from a screen reader, the
              reason does not. */}
          <p data-landing-ticket-line="" className="mt-2.5 text-sm text-ink/75">
            {LANDING_WORDS.ticketWaiting}
          </p>
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

/**
 * THE GUEST'S LANDING WHILE THE EVENT IS STILL ITS SAVE THE DATE — NOTHING IS ASKED.
 *
 * A guest's walk, 2026-10-11 (faults N04 · N05): the landing said "You're
 * invited… please reply" while the film behind it said "Save the date — formal
 * invitation to follow". Owner the same day ("ok all"): until the invitation
 * has launched, the landing says "Save the date" and asks for nothing — no
 * "please reply", no Reply button. (`replyIsAsked`, lib/invite-destination.ts,
 * decides; `enter/page.tsx` draws this instead of `LandingPreReply`.)
 *
 * So this page is: the couple's greeting card (their words, without the ask),
 * when and where if anything is set, and ONE button — the door to the Save the
 * Date itself, in the words the door has always used for it.
 *
 * 🎟 NO TICKET HERE, AND NO LINE ABOUT ONE. The faint ticket's line is "ready
 * once you reply", and no reply is offered yet — a promise about a button that
 * is not on the page. The ticket (faint, with its line) returns with the reply
 * when the invitation launches.
 *
 * 🔒 ONE CONTROL, like the landing it stands in for
 * (`the-landing-before-the-reply-has-one-button.test.ts`).
 */
export function LandingSaveTheDate({
  message,
  hosts,
  whenWhere,
  openHref,
  openLabel,
  awaitingLine,
}: {
  /** The couple's message, name as given, WITHOUT the ask (`landingMessage`, `askToReply: false`). */
  message: string;
  hosts: string;
  /** `landingWhenWhere` — null when nothing is set. */
  whenWhere: string | null;
  /** The Event Hub, which is wearing the Save the Date. */
  openHref: string;
  /** `arrivalDestinationWords('save_the_date').cta` — "Open the save the date". */
  openLabel: string;
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

      <div data-landing="open">
        {whenWhere ? (
          <p data-landing-when-where="" className="mb-3 text-center text-sm text-ink/80">
            {whenWhere}
          </p>
        ) : null}
        <Link className="button-primary w-full" href={openHref} data-landing-open="">
          {openLabel}
        </Link>
      </div>

      {awaitingLine ? (
        <p className="text-sm text-ink/70" data-landing="ticket">
          {awaitingLine}
        </p>
      ) : null}
    </>
  );
}
