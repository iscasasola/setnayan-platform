/**
 * 🧾 THE NOTE AFTER A REPLY, AS THE PAGE DREW IT BEFORE ITS LINES BECAME A LIST — a REFERENCE, never mounted.
 *
 * `invite/enter/page.tsx` is a page: it reads the database, so no test can render it. The two blocks below are its
 * own JSX for the note a guest sees after a No and after a Yes, COPIED VERBATIM by a script from the page at
 * `origin/main` 64746f064 (lines 661–681 and 683–714; only the indentation changed). The page's own variables are
 * this function's arguments, by the page's own names.
 *
 * What it is for (`the-note-after-a-reply-is-todays-page.test.ts`): the note the page draws from a LIST of lines
 * (the RSVP stage's ＋, drag and Group) must give these very bytes when a couple stored nothing.
 *
 * ⛔ Do not edit, do not import into app code. It changes only if the note is MEANT to change for every guest.
 */
import { LANDING_WORDS } from '@/lib/guest-landing';
import { rsvpWordBridgeKey } from '@/lib/rsvp-stage-shared';

export type NoteAsShipped = {
  reply: 'yes' | 'no';
  canvas: boolean;
  wordKeys: { heading: Parameters<typeof rsvpWordBridgeKey>[0]; message: Parameters<typeof rsvpWordBridgeKey>[0] } | null;
  headline: string;
  ownHeadline: string;
  ownMessage: string | null;
  firstName: string;
};

export function NoteAsShipped({ reply, canvas, wordKeys, headline, ownHeadline, ownMessage, firstName }: NoteAsShipped) {
  return reply === 'no' ? (
/* ── verbatim: the No branch ── */
    <div className="sn-glass-bare rounded-2xl bg-cream/95 px-5 py-7 text-center shadow-sm" data-landing-missed="">
      <p
        className="font-serif text-[34px] font-medium leading-tight text-ink"
        data-landing-heading=""
        data-rsvp-line="heading"
        data-rsvp-word={canvas && wordKeys ? rsvpWordBridgeKey(wordKeys.heading) : undefined}
        data-rsvp-default={canvas ? ownHeadline : undefined}
        data-rsvp-name={canvas ? firstName : undefined}
      >
        {headline}
      </p>
      <p
        className="mt-2 text-sm text-ink/60"
        data-thank-you-message=""
        data-rsvp-line="message"
        data-rsvp-word={canvas && wordKeys ? rsvpWordBridgeKey(wordKeys.message) : undefined}
        data-rsvp-name={canvas ? firstName : undefined}
      >
        {ownMessage ?? LANDING_WORDS.missedSub}
      </p>
    </div>
/* ── end ── */
  ) : (
/* ── verbatim: the Yes branch ── */
    <>
      <p className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F1EA] px-3.5 py-1.5 text-xs font-medium text-[#2F6B4F]"
          data-landing-done=""
          data-rsvp-line="heading"
        >
          ✓{' '}
          <span
            data-landing-heading=""
            data-rsvp-word={canvas && wordKeys ? rsvpWordBridgeKey(wordKeys.heading) : undefined}
            data-rsvp-default={canvas ? ownHeadline : undefined}
            data-rsvp-name={canvas ? firstName : undefined}
          >
            {headline}
          </span>
        </span>
      </p>
      {ownMessage || (canvas && wordKeys) ? (
        <p
          className="text-center text-base leading-relaxed text-ink/80"
          data-thank-you-message=""
          data-rsvp-line="message"
          data-rsvp-word={canvas && wordKeys ? rsvpWordBridgeKey(wordKeys.message) : undefined}
          data-rsvp-word-optional={canvas ? '' : undefined}
          data-rsvp-name={canvas ? firstName : undefined}
          hidden={!ownMessage || undefined}
        >
          {ownMessage}
        </p>
      ) : null}
    </>
/* ── end ── */
  );
}
