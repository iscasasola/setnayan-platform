import type { ReactNode } from 'react';
import { RSVP_GROUP_ATTR, rsvpLayoutIsGroup, type RsvpAddedLine, type RsvpAddedText, type RsvpLayoutItem, type RsvpLayoutLine } from '@/lib/rsvp-look';

/**
 * 🧱 THE LINES OF A REPLY SCREEN, DRAWN FROM A LIST — the form's card, the When-yes note and the When-no note
 * (owner's ruling 2026-10-09: ＋ adds a line, a held line drags to a new place, several lines share one background
 * as a group; `Maker_RSVP_Per_Element_Add_Drag_Group_LOCKED_2026-10-09.md` §3).
 *
 * A page hands this the list its screen holds (`rsvpScreenLayout`, `lib/rsvp-look.ts` — the one strict reader) and
 * how each of the page's OWN lines is drawn; it walks the list, top to bottom:
 *
 *   · one of the page's own lines → the page's own element for it (`own[name]`), untouched;
 *   · a line the couple ADDED → a heading or a message, its words as TEXT (React escapes them; never markup);
 *   · a GROUP → one plain `<div>` round its lines. Plain is this wrapper's own paper; None and Frosted are rules of
 *     the look's one `<style>` (`rsvpLookRules`), from fixed declarations.
 *
 * 🔒 WHAT IT NEVER DOES: it draws no control and wraps none in anything that changes what it is. On the form the
 * group's `<div>` sits INSIDE the reply's one `<fieldset>`, so the two answers stay one radio group of one form
 * wherever they stand — in a group, apart, or with a line between them.
 *
 * 👻 AN ADDED LINE WITH NO WORDS IS NEVER DRAWN FOR A GUEST (owner's rule, controller 2026-10-10: no made-up words or
 * dates may ever print to guests — a new line arrives EMPTY). On the Maker's sample (`canvas`) it is drawn as its own
 * name in quiet ink, so the couple can see it, pick it and type it. A group whose lines are all empty is not drawn
 * for a guest either.
 *
 * A server component with no state and no script: a guest downloads nothing for it.
 */
export const RSVP_ADDED_NAME: Readonly<Record<RsvpAddedLine['k'], string>> = { h: 'Heading', m: 'Message', p: 'Picture' };
/** How an added line is set — one face each, the card's own: a serif heading, a quiet message. */
export const RSVP_ADDED_CLASS: Readonly<Record<RsvpAddedText['k'], string>> = {
  h: 'font-serif text-xl font-medium leading-tight text-ink',
  m: 'text-sm leading-relaxed text-ink/80',
};
/** An added line with no words yet, on the Maker's sample only. */
export const RSVP_ADDED_EMPTY_CLASS = 'italic !text-ink/45';
/** In a note (centred), an added line is centred with it. */
export const RSVP_NOTE_ADDED_CLASS = 'text-center';
/**
 * ♿ THE FORM'S TWO LEADING LINES, IN AND OUT OF ITS LEGEND (`rsvp-widget.tsx` says why): out of it they carry the ids
 * the fieldset is named by, and the question keeps the room the legend gave it below. ONE spelling, read by the card
 * (the server, for every guest) and by the Maker's live re-arranging of its sample (`rsvp-canvas-arrange.ts`).
 */
export const RSVP_FORM_LINE_ID = { eyebrow: 'rsvp-line-eyebrow', question: 'rsvp-line-question' } as const;
export const RSVP_FORM_QUESTION_CLASS = {
  led: 'mt-2 block font-serif text-[32px] font-medium leading-[1.1] tracking-tight text-ink',
  out: 'block pb-3 font-serif text-[32px] font-medium leading-[1.1] tracking-tight text-ink',
} as const;
/** A group's wrapper: the note's own paper (`data-landing-missed`'s recipe), its lines spaced as the card spaces them. */
export const RSVP_GROUP_CLASS = 'sn-glass-bare space-y-2 rounded-2xl bg-cream/95 p-3.5 shadow-sm';

/** Is there anything of this line to draw? One of the page's own always; an added one when it has words — or on the sample. */
function drawn(line: RsvpLayoutLine, canvas: boolean): boolean {
  if (line.added?.k === 'p') return false;
  return !line.added || canvas || Boolean(line.added.t);
}

export function RsvpLines({
  items,
  own,
  canvas = false,
  addedClass = '',
}: {
  /** The screen's list, top to bottom (`rsvpScreenLayout`) — or the part of it this place draws. */
  items: readonly RsvpLayoutItem[];
  /** The page's own element for each of its lines, by name. A name with none (a message nobody wrote) draws nothing. */
  own: Readonly<Record<string, ReactNode>>;
  /** The Maker's sample: an added line with no words is drawn, as its name. */
  canvas?: boolean;
  /** How the screen sets its lines apart from the card's default (the notes are centred). */
  addedClass?: string;
}) {
  const one = (line: RsvpLayoutLine): ReactNode => {
    if (!line.added) return <Keyed key={line.line}>{own[line.line] ?? null}</Keyed>;
    if (!drawn(line, canvas) || line.added.k === 'p') return null;
    const { k, t } = line.added;
    return (
      <p
        key={line.line}
        data-rsvp-line={line.line}
        data-rsvp-added={canvas ? k : undefined}
        data-rsvp-empty={canvas && !t ? '' : undefined}
        className={`${RSVP_ADDED_CLASS[k]}${addedClass ? ` ${addedClass}` : ''}${canvas && !t ? ` ${RSVP_ADDED_EMPTY_CLASS}` : ''}`}
      >
        {t || RSVP_ADDED_NAME[k]}
      </p>
    );
  };
  return (
    <>
      {items.map((item) => {
        if (!rsvpLayoutIsGroup(item)) return one(item);
        if (!item.lines.some((line) => drawn(line, canvas) && (line.added || own[line.line] != null))) return null;
        return (
          <div key={`g:${item.group.id}`} {...{ [RSVP_GROUP_ATTR]: item.group.id }} className={RSVP_GROUP_CLASS}>
            {item.lines.map(one)}
          </div>
        );
      })}
    </>
  );
}

/** A keyed pass-through: the page's own element, exactly as the page made it. */
function Keyed({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
