import { LANDING_WORDS } from '@/lib/guest-landing';
import { RSVP_SCREEN_LINES, type RsvpLayoutItem } from '@/lib/rsvp-look';
import { rsvpWordBridgeKey } from '@/lib/rsvp-stage-shared';
import { RSVP_NOTE_ADDED_CLASS, RsvpLines } from './rsvp-lines';

/**
 * 💌 THE NOTE A GUEST SEES AFTER THEIR REPLY — after a Yes (the "✓ You replied" pill and the couple's message) and
 * after a No (the note's own card) — drawn from the LIST of its lines (owner's ruling 2026-10-09: ＋ adds a line, a
 * held line drags to a new place, several lines share one background; `rsvp-lines.tsx`).
 *
 * It was two blocks of `invite/enter/page.tsx`. Their elements are here unchanged — the same tags, the same
 * attributes in the same order, the same classes — and with `lines` null (a couple who arranged nothing) the note is
 * the very bytes the page served before (`the-note-after-a-reply-is-todays-page.test.ts`, against a record made of
 * the page's own JSX).
 *
 * `lines`: `rsvpScreenLayout(readRsvpLook(config), 'yesnote' | 'nonote')` — the one strict reader. The other
 * arguments are the page's own variables, by the page's own names.
 */
const NOTE_OWN_LINES: readonly RsvpLayoutItem[] = RSVP_SCREEN_LINES.yesnote.map((line) => ({ line, added: null }));

export function RsvpNoteLines({
  reply,
  canvas,
  wordKeys,
  headline,
  ownHeadline,
  ownMessage,
  firstName,
  lines = null,
  pictures,
}: {
  reply: 'yes' | 'no';
  /** The Maker's sample (a verified host): the words carry their names, and an added line with no words is shown. */
  canvas: boolean;
  wordKeys: { heading: Parameters<typeof rsvpWordBridgeKey>[0]; message: Parameters<typeof rsvpWordBridgeKey>[0] } | null;
  headline: string;
  ownHeadline: string;
  ownMessage: string | null;
  firstName: string;
  lines?: readonly RsvpLayoutItem[] | null;
  /** 🖼 The picture lines' files, signed by the page (`signRsvpPictures`). */
  pictures?: Readonly<Record<string, string>>;
}) {
  const items = lines ?? NOTE_OWN_LINES;
  if (reply === 'no') {
    return (
      /* Arranged, the card spaces its lines itself (`space-y-2`) — the message's own step down (`mt-2`) assumed it
         stood under the heading. */
      <div className={lines ? 'sn-glass-bare space-y-2 rounded-2xl bg-cream/95 px-5 py-7 text-center shadow-sm' : 'sn-glass-bare rounded-2xl bg-cream/95 px-5 py-7 text-center shadow-sm'} data-landing-missed="">
        <RsvpLines
          items={items}
          canvas={canvas}
          pictures={pictures}
          own={{
            heading: (
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
            ),
            message: (
              <p
                className={lines ? 'text-sm text-ink/60' : 'mt-2 text-sm text-ink/60'}
                data-thank-you-message=""
                data-rsvp-line="message"
                data-rsvp-word={canvas && wordKeys ? rsvpWordBridgeKey(wordKeys.message) : undefined}
                data-rsvp-name={canvas ? firstName : undefined}
              >
                {ownMessage ?? LANDING_WORDS.missedSub}
              </p>
            ),
          }}
        />
      </div>
    );
  }
  return (
    <RsvpLines
      items={items}
      canvas={canvas}
      pictures={pictures}
      addedClass={RSVP_NOTE_ADDED_CLASS}
      own={{
        heading: (
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
        ),
        message:
          ownMessage || (canvas && wordKeys) ? (
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
          ) : null,
      }}
    />
  );
}
