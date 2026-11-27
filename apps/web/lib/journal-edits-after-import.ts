/**
 * 📰 JOURNAL EDITS MADE AFTER THE IMPORT WAS APPLIED.
 *
 * `supabase/migrations/20271355899662_the_journal_moves_into_articles.sql` copied the Journal source into
 * `creator_chapters` and is applied in production, so it is never edited again. A later correction is made twice,
 * in the same commit: in the source (`lib/blog-batches/*`) and as a NEW migration that UPDATEs that one post.
 * Each correction is listed here, so `lib/journal-move.test.ts` can undo it before comparing the import file with
 * what the source generates, and can prove that its migration carries exactly this text.
 */
import { JOURNAL_EDITS_2026_11_27 } from '@/lib/blog-batches/edits-after-import-2026-11-27';

export type JournalEditAfterImport = {
  slug: string;
  /** Which column the edit changes, as the post renders it (links written out as setnayan.com/…). Default body. */
  field?: 'title' | 'body';
  /** The text the import wrote. */
  from: string;
  /** The text the source and the post say now. */
  to: string;
  /** The migration that made the same edit in production. */
  migration: string;
};

export const JOURNAL_EDITS_AFTER_IMPORT: readonly JournalEditAfterImport[] = [
  {
    // Owner 2026-11-20/21: no free first booking for a client Setnayan brings (#8061).
    slug: 'what-zero-commission-means-for-couples',
    from: 'unless the supplier is the first to bring the event: a supplier’s first booking from Setnayan is on us, a supplier who is the first',
    to: 'unless the supplier is the first to bring the event: a supplier who is the first',
    migration: '20271356969132_the_zero_commission_post_drops_the_first_booking_promise.sql',
  },
  {
    // Owner 2026-11-19 PROMOTION PAGES (4): no number of months on any public page (#8086).
    slug: 'what-zero-commission-means-for-couples',
    from: 'books it free, and a couple a supplier brings onto Setnayan books them free for a year. Every other booking',
    to: 'books it free, and a couple new to Setnayan through a supplier books them free. Every other booking',
    migration: '20271356623783_the_new_client_free_window_is_a_setting.sql',
  },
  // Owner 27 Nov 2026, content finalization: generated, kept with the article sources (see the import).
  ...JOURNAL_EDITS_2026_11_27,
];
