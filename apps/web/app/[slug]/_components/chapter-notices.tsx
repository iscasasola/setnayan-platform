import { NOTICE_ACTION } from '@/app/_components/notices/notices';
import { InlineNotice } from '@/app/_components/notices/inline-notice';
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
  // 🔔 Inventory #36 — News with replies (one notice system, owner approved 14 Nov 2026): "New on your invitation:
  // <chapter> · I'll be there · Can't make it". The answers are the close, so it has no close word of its own; it
  // leaves when the guest answers (the shipped reply action).
  return (
    <div data-chapter-notices="" className="w-full space-y-2 text-left">
      {added.map((c) => (
        <InlineNotice
          key={c.block_id}
          kind="news"
          closable={false}
          noticeKey={`chapter-added:${c.block_id}`}
          title={`New on your invitation: ${c.label}`}
          detail={`${chapterWhen(c)} · ${chapterWhere(c)}`}
          actions={
            <form action={action} data-chapter-added={c.block_id} className="flex flex-wrap justify-end gap-2">
              <input type="hidden" name={CHAPTER_ONLY_FIELD} value="1" />
              <input type="hidden" name={CHAPTER_ID_FIELD} value={c.block_id} />
              <button type="submit" name={CHAPTER_ANSWER_FIELD} value="yes" className={NOTICE_ACTION}>
                Yes, I’ll be there
              </button>
              <button type="submit" name={CHAPTER_ANSWER_FIELD} value="no" className={NOTICE_ACTION}>
                I can’t make it
              </button>
            </form>
          }
        />
      ))}
      {removed.map((r) => (
        <InlineNotice
          key={r.block_id}
          kind="news"
          closable={false}
          noticeKey={`chapter-removed:${r.block_id}`}
          title={`${r.label} is no longer part of your invitation.`}
          actions={
            <form action={action} data-chapter-removed={r.block_id}>
              <input type="hidden" name={CHAPTER_ONLY_FIELD} value="1" />
              <input type="hidden" name={CHAPTER_ID_FIELD} value={r.block_id} />
              <input type="hidden" name={CHAPTER_SEEN_FIELD} value="1" />
              <button type="submit" className={NOTICE_ACTION}>
                OK
              </button>
            </form>
          }
        />
      ))}
    </div>
  );
}
