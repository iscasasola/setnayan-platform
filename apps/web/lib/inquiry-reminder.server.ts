import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { runClaimedJob, DAILY_GAP_MS } from '@/lib/periodic-jobs';
import {
  GHOST_THRESHOLD_HOURS,
  inquiriesDueAReminder,
  inquiryReminderLink,
  inquiryReminderNotice,
  reminderKey,
  type PendingInquiry,
} from '@/lib/inquiry-reminder';

/**
 * THE 48-HOUR INQUIRY REMINDER — the sweep. See lib/inquiry-reminder.ts for the
 * rule; this file only reads, asks the rule, and sends.
 *
 * ⚠ NOT GUARANTEED TO THE HOUR, and that is the honest cost of a cron-free
 * sweep: a pass runs when somebody loads a page, at most once a day. A reminder
 * goes out on the first pass after the inquiry turns 48 hours old, so it can be
 * up to a day late — or later if nobody at all visits. Mounted on the COUPLE's
 * layout as well as the supplier's and the admin's for exactly that reason: the
 * supplier this exists for is the one who is not visiting, and the person who
 * is still opening the app is the couple waiting on them.
 */
/** Threads read per page. Small on purpose: the "already sent" read below names
 *  one link per thread in its filter, and a long filter is a refused request. */
const PAGE = 50;
/** Pages per pass — a ceiling on work, not a number anyone is promised. */
const MAX_PAGES = 20;

export async function runInquiryReminderSweep(nowMs: number = Date.now()): Promise<{ reminded: number }> {
  const admin = createAdminClient();
  const cutoffIso = new Date(nowMs - GHOST_THRESHOLD_HOURS * 3600 * 1000).toISOString();
  const notice = inquiryReminderNotice();
  let reminded = 0;

  // PAGED, oldest first. An inquiry that was reminded and is STILL unanswered
  // stays `pending` for good, so a single fixed-size read would fill up with
  // those and never reach a newer one that is owed its reminder.
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data: threadRows, error: threadsError } = await admin
      .from('chat_threads')
      .select('thread_id, event_id, vendor_profile_id, created_at, inquiry_status, archived_at')
      .eq('inquiry_status', 'pending')
      .is('archived_at', null)
      .lt('created_at', cutoffIso)
      .order('created_at', { ascending: true })
      .order('thread_id', { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    // A refused read is a FAILED pass, not "nobody is waiting" — thrown so
    // runClaimedJob records the run as failed instead of as a clean zero.
    if (threadsError) throw new Error(`inquiry reminder: could not read waiting inquiries: ${threadsError.message}`);
    const threads = (threadRows ?? []) as PendingInquiry[];
    if (threads.length === 0) break;

    const shopIds = [...new Set(threads.map((t) => t.vendor_profile_id))];
    const { data: shops, error: shopsError } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, user_id')
      .in('vendor_profile_id', shopIds);
    if (shopsError) throw new Error(`inquiry reminder: could not read who to remind: ${shopsError.message}`);
    const supplierUserByShop = new Map<string, string>();
    for (const s of (shops ?? []) as Array<{ vendor_profile_id: string; user_id: string | null }>) {
      if (s.user_id) supplierUserByShop.set(s.vendor_profile_id, s.user_id);
    }

    // THE RECORD OF WHAT WAS ALREADY SENT. If it cannot be read, NOTHING is
    // sent: an unreadable record is not an empty one, and guessing "none sent"
    // is how one reminder becomes one a day.
    const links = threads.map((t) => inquiryReminderLink(t.thread_id));
    const { data: sentRows, error: sentError } = await admin
      .from('notifications')
      .select('user_id, related_url')
      .eq('type', 'inquiry_awaiting_reply')
      .in('related_url', links);
    if (sentError) throw new Error(`inquiry reminder: could not read which reminders were already sent: ${sentError.message}`);
    const alreadyReminded = new Set(
      ((sentRows ?? []) as Array<{ user_id: string; related_url: string }>).map((r) => reminderKey(r.user_id, r.related_url)),
    );

    for (const d of inquiriesDueAReminder({ threads, supplierUserByShop, alreadyReminded, nowMs })) {
      try {
        await emitNotification({
          userId: d.userId,
          type: 'inquiry_awaiting_reply',
          title: notice.title,
          body: notice.body,
          // The SAME function the record above was read by — one link, both sides.
          relatedUrl: inquiryReminderLink(d.thread.thread_id),
          // Which event: a supplier-side link carries none, so the email is told here.
          eventId: d.thread.event_id,
          // The stored row IS the record that stops the next reminder — no row, no email.
          onlyIfStored: true,
        });
        reminded += 1;
      } catch (e) {
        console.error(`[inquiry-reminder] notify failed for thread_id=${d.thread.thread_id}:`, e);
      }
    }
    if (threads.length < PAGE) break;
  }
  return { reminded };
}

/** Cron-free daily pass, fired from `after()` on request traffic. Never throws. */
export async function maybeRunInquiryReminder(): Promise<void> {
  await runClaimedJob('inquiry-reminder', DAILY_GAP_MS, async () => {
    const { reminded } = await runInquiryReminderSweep();
    return reminded;
  });
}
