import {
  CANT_CHAPTER_FIELD,
  chapterWhen,
  chapterWhere,
  joinChapterNames,
  type ChapterAnswer,
  type InvitationChapter,
} from '@/lib/invitation-chapters';

/**
 * ✉ THE REPLY, BY CHAPTER (owner 2026-11-01, plan §3 "RSVP depends on chapters", §12 Step 5; the approved prototype's
 * `invite()` — "you are invited to the Ceremony and Reception", each chapter with its time and venue, then
 * "Yes, I'll be there" · "I can't make it", and on a no with two or more chapters "Which part can't you make?").
 *
 * Two pieces, both server-rendered with no client state, inside the reply card's one form:
 *   · `RsvpChapterList` — what the guest is answering: every chapter ON THE INVITATION, its time ("Time TBA" when it
 *     has none) and its place ("Venue TBA" when it has none — the reply still sends, owner: *"Sometime it can be tba"*),
 *     and, once they have replied, their own answer per chapter.
 *   · `RsvpCantPick` — on the decline arm only (revealed by the card's `:has()` rule), one tick per chapter; nothing
 *     ticked = can't make any. "You'll be at: …" follows the ticks (a few lines of inline script; without script the
 *     line is simply not drawn and the ticks still post).
 *
 * The form fields are `cant_chapter` = a chapter's id; `submitRsvp` keeps only the invitation's own chapters
 * (`resolveChapterReply`). A guest is never asked about a chapter that is not on their invitation.
 */

const ANSWER_WORDS: Partial<Record<ChapterAnswer, string>> = {
  yes: 'You’ll be there',
  no: 'Can’t make it',
  new: 'New — not answered yet',
};

export function RsvpChapterList({
  chapters,
  answers,
}: {
  chapters: readonly InvitationChapter[];
  answers: ReadonlyMap<string, ChapterAnswer>;
}) {
  if (chapters.length === 0) return null;
  return (
    <div data-rsvp-chapters="" className="space-y-2">
      <p className="text-sm text-ink/75">You’re invited to the {joinChapterNames(chapters.map((c) => c.label))}</p>
      <ul className="divide-y divide-ink/10 border-y border-ink/10">
        {chapters.map((c) => {
          const answer = ANSWER_WORDS[answers.get(c.block_id) ?? 'unanswered'];
          return (
            <li key={c.block_id} data-rsvp-chapter={c.block_id} className="py-2.5">
              <p className="font-pahina text-lg font-light leading-snug text-ink">{c.label}</p>
              <p className="text-sm text-ink/70">
                <span data-chapter-when="">{chapterWhen(c)}</span> · <span data-chapter-where="">{chapterWhere(c)}</span>
              </p>
              {answer ? <p className="mt-0.5 text-xs font-medium text-mulberry">{answer}</p> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Keeps "You'll be at: …" true to the ticks. Reads only this block's own inputs; writes only its own line. */
const YOU_WILL_BE_AT_JS =
  "(function(){var s=document.currentScript,b=s&&s.parentElement;if(!b)return;var o=b.querySelector('[data-you-will-be-at]');if(!o)return;function y(){var l=[];b.querySelectorAll('input[name=\"" +
  CANT_CHAPTER_FIELD +
  "\"]').forEach(function(i){if(!i.checked)l.push(i.getAttribute('data-label'))});var t=l.length===0?'none of these':l.length===1?l[0]:l.slice(0,-1).join(', ')+' and '+l[l.length-1];o.textContent='You’ll be at: '+t;o.hidden=false}b.addEventListener('change',y);y()})()";

export function RsvpCantPick({
  chapters,
  answers,
  className,
  questionClassName,
}: {
  chapters: readonly InvitationChapter[];
  answers: ReadonlyMap<string, ChapterAnswer>;
  /** The card's decline reveal (`declined-reveal`), so this shows only after "I can't make it". */
  className: string;
  questionClassName: string;
}) {
  // One chapter: "I can't make it" already says which.
  if (chapters.length < 2) return null;
  return (
    <div data-rsvp-step data-rsvp-cant="" className={`${className}space-y-2`}>
      <p className={questionClassName}>Which part can’t you make?</p>
      <p className="text-xs text-ink/70">Leave them all unticked if you can’t make any.</p>
      <div className="divide-y divide-ink/10 border-y border-ink/10">
        {chapters.map((c) => (
          <label key={c.block_id} className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{c.label}</span>
              <span className="block truncate text-xs text-ink/70">
                {chapterWhen(c)} · {chapterWhere(c)}
              </span>
            </span>
            <input
              type="checkbox"
              name={CANT_CHAPTER_FIELD}
              value={c.block_id}
              data-label={c.label}
              // A guest coming to only some chapters reopens the card with the ones they can't make still ticked.
              defaultChecked={answers.get(c.block_id) === 'no' && [...answers.values()].some((a) => a === 'yes')}
              className="h-5 w-5 shrink-0 accent-mulberry"
            />
          </label>
        ))}
      </div>
      <p data-you-will-be-at="" hidden className="text-sm text-ink/80" />
      <script dangerouslySetInnerHTML={{ __html: YOU_WILL_BE_AT_JS }} />
    </div>
  );
}
