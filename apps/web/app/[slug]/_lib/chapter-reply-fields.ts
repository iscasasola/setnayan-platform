/**
 * ✉ The form fields of "one chapter, on its own" (`answerOneChapter`, chapter-reply.server.ts) — shared by the notices
 * that post them (`chapter-notices.tsx`) and the action that reads them, so the two can never name different fields.
 */
export const CHAPTER_ONLY_FIELD = 'chapter_reply_only';
export const CHAPTER_ID_FIELD = 'chapter_id';
export const CHAPTER_ANSWER_FIELD = 'chapter_attending';
export const CHAPTER_SEEN_FIELD = 'chapter_removal_seen';
