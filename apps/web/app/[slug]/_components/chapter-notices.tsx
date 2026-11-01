import { chapterWhen, chapterWhere, type InvitationChapter } from '@/lib/invitation-chapters';
import {
  CHAPTER_ANSWER_FIELD,
  CHAPTER_ID_FIELD,
  CHAPTER_ONLY_FIELD,
  CHAPTER_SEEN_FIELD,
} from '../_lib/chapter-reply-fields';

/**
 * ✉ AFTER THE INVITES WENT OUT (owner, ruled 1 Nov 2026 — plan §9 #7):
 *   · a chapter ADDED to the invitation after this guest replied → "New on your invitation", the chapter's time and
 *     place ("Venue TBA" when it has none), and ONE "Yes, I'll be there" / "I can't make it";
 *   · a chapter they said yes to that is NO LONGER on the invitation → one line saying so, and OK.
 *
 * Each button posts the guest's own reply action with `chapter_reply_only` (`answerOneChapter`), so nothing else of the
 * reply is touched. Server-rendered, no client state. Nothing is drawn when there is nothing to say.
 */
export function ChapterNotices({
  action,
  added,
  removed,
}: {
  action: (formData: FormData) => Promise<void>;
  added: readonly InvitationChapter[];
  removed: readonly { block_id: string; label: string }[];
}) {
  if (added.length === 0 && removed.length === 0) return null;
  return (
    <div data-chapter-notices="" className="w-full space-y-4 border-y border-ink/12 py-4 text-left">
      {added.map((c) => (
        <form key={c.block_id} action={action} data-chapter-added={c.block_id} className="space-y-2">
          <input type="hidden" name={CHAPTER_ONLY_FIELD} value="1" />
          <input type="hidden" name={CHAPTER_ID_FIELD} value={c.block_id} />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mulberry">New on your invitation</p>
          <p className="font-pahina text-xl font-light leading-snug text-ink">{c.label}</p>
          <p className="text-sm text-ink/70">
            {chapterWhen(c)} · {chapterWhere(c)}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              name={CHAPTER_ANSWER_FIELD}
              value="yes"
              className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-mulberry px-6 text-sm font-semibold text-cream hover:bg-mulberry-600"
            >
              Yes, I’ll be there
            </button>
            <button
              type="submit"
              name={CHAPTER_ANSWER_FIELD}
              value="no"
              className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-ink/20 px-6 text-sm font-semibold text-ink hover:border-ink/40"
            >
              I can’t make it
            </button>
          </div>
        </form>
      ))}
      {removed.map((r) => (
        <form key={r.block_id} action={action} data-chapter-removed={r.block_id} className="flex items-center justify-between gap-3">
          <input type="hidden" name={CHAPTER_ONLY_FIELD} value="1" />
          <input type="hidden" name={CHAPTER_ID_FIELD} value={r.block_id} />
          <input type="hidden" name={CHAPTER_SEEN_FIELD} value="1" />
          <p className="min-w-0 text-sm text-ink/80">{r.label} is no longer part of your invitation.</p>
          <button
            type="submit"
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg border border-ink/20 px-5 text-sm font-semibold text-ink hover:border-ink/40"
          >
            OK
          </button>
        </form>
      ))}
    </div>
  );
}
