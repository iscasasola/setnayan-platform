import { replyWindowWords, type ReplyWindow } from '@/lib/reply-window';

/**
 * 📬 THE COUPLE'S REPLY WINDOW IS SHUT — said where the reply's button would have been (owner 2026-10-14,
 * DECISION_LOG 📬 items 2–3; words from `replyWindowWords`, lib/reply-window.ts):
 *
 *   not yet  "Replies open on Saturday, 14 November"
 *   closed   "Replies are closed." · "Need to change? Message the couple."
 *
 * Never a button, never a disabled one. ONE drawing for every door that has no Reply card of its own —
 * the reply page (`invite/reply`), the guest's landing (`invite/enter`, `LandingPreReply`) and the Event
 * Hub's untabbed reply section — and for the lab that pictures them. `refused`: a Send was just refused
 * outside the window (`?rsvp=window`) — "Your reply was not sent." is said first, as an alert, and the
 * window's own words follow it (never said twice). Nothing at all while replies are open.
 */
export function ReplyWindowNote({
  window: replies,
  organizer,
  refused = false,
  align = 'start',
}: {
  window: ReplyWindow;
  /** The event's word for its hosts (`EventWords.theOrganizer` — "the couple"). */
  organizer: string;
  refused?: boolean;
  align?: 'start' | 'center';
}) {
  const said = replyWindowWords(replies, organizer);
  if (!said) return null;
  return (
    <div data-reply-window={replies.state} className={`flex flex-col gap-1 py-1 ${align === 'center' ? 'items-center text-center' : ''}`}>
      {refused ? (
        <p role="alert" className="mb-1 text-sm font-medium text-terracotta-700" data-reply-refused="">
          Your reply was not sent.
        </p>
      ) : null}
      <p className="font-serif text-lg leading-snug text-ink">{said.line}</p>
      {said.sub ? <p className="text-sm text-ink/70">{said.sub}</p> : null}
    </div>
  );
}
