/**
 * lib/inquiry-reminder.ts — AN INQUIRY THAT HAS WAITED TOO LONG: WHICH ONES,
 * AND WHAT THE SUPPLIER IS TOLD. The pure half.
 *
 * 🔴 WHY (2026-10-10). Nothing time-based ends an unanswered inquiry, and until
 * now nothing reminded the supplier away from the app either. The only nudge
 * (`inquiry_awaiting_reply`) was written at the supplier's OWN sign-in — it
 * reached exactly the suppliers who had come back, and never the one who had
 * not. The couple, meanwhile, waited on a reply that could not come.
 *
 * So: ONE reminder email per inquiry, when it has waited `GHOST_THRESHOLD_HOURS`
 * with no answer, sent from a traffic-driven sweep
 * (`lib/inquiry-reminder.server.ts`; this repo has no scheduler, deliberately).
 *
 * 🔑 ONE NUMBER. `GHOST_THRESHOLD_HOURS` is defined HERE and nowhere else. The
 * sign-in nudge in `lib/ghosting.ts` imports it; the sweep imports it; the
 * sentence below prints it. `inquiry-reminder.test.ts` fails if a second
 * definition appears.
 *
 * 🔒 ONCE PER INQUIRY. The reminder's own stored notification row is the
 * record that it went: its link is the THREAD's page, which no other notice of
 * this type uses (the sign-in nudge links the inbox). `inquiriesDueAReminder`
 * never returns a thread whose (supplier, link) is already in that record, and
 * the sweep sends with `onlyIfStored`, so an email cannot go without the row
 * that stops the next one.
 *
 * Pure. No I/O.
 */

/** How long an inquiry may sit unanswered before either side is nudged. */
export const GHOST_THRESHOLD_HOURS = 48;

export type PendingInquiry = {
  thread_id: string;
  event_id: string;
  vendor_profile_id: string;
  created_at: string;
  inquiry_status: string | null;
  archived_at: string | null;
};

/** The reminder's link — the thread itself, where Accept and Decline are. */
export function inquiryReminderLink(threadId: string): string {
  return `/vendor-dashboard/messages/${threadId}`;
}

/** The key one sent reminder is remembered by. */
export const reminderKey = (userId: string, link: string): string => `${userId} ${link}`;

/**
 * The inquiries that are owed their ONE reminder now.
 *
 * Due = still `pending` · not withdrawn by the couple (`archived_at`) · older
 * than the threshold · its shop has an account to tell · and no reminder for
 * that (supplier, thread) is on record.
 */
export function inquiriesDueAReminder(args: {
  threads: readonly PendingInquiry[];
  /** `vendor_profile_id` → the shop owner's user id. Absent = nobody to tell. */
  supplierUserByShop: ReadonlyMap<string, string>;
  /** `reminderKey(userId, link)` of every reminder already stored. */
  alreadyReminded: ReadonlySet<string>;
  nowMs: number;
}): Array<{ thread: PendingInquiry; userId: string; link: string }> {
  const cutoff = args.nowMs - GHOST_THRESHOLD_HOURS * 3600 * 1000;
  const due: Array<{ thread: PendingInquiry; userId: string; link: string }> = [];
  const seen = new Set<string>();
  for (const thread of args.threads) {
    if (thread.inquiry_status !== 'pending' || thread.archived_at) continue;
    const created = Date.parse(thread.created_at);
    if (!Number.isFinite(created) || created > cutoff) continue;
    const userId = args.supplierUserByShop.get(thread.vendor_profile_id);
    if (!userId) continue;
    const link = inquiryReminderLink(thread.thread_id);
    const key = reminderKey(userId, link);
    // On record already — or listed twice in one read: once is the whole point.
    if (args.alreadyReminded.has(key) || seen.has(key)) continue;
    seen.add(key);
    due.push({ thread, userId, link });
  }
  return due;
}

/**
 * The words. The title is the sign-in nudge's own (one inquiry). The second
 * sentence is the customer card's ("Accept to open the chat, or decline if
 * you’re not available."). Pre-accept, so nobody is named.
 */
export function inquiryReminderNotice(): { title: string; body: string } {
  return {
    title: 'An inquiry is awaiting your reply',
    body: `A couple wrote to your shop more than ${GHOST_THRESHOLD_HOURS} hours ago and has not had an answer. Accept to open the chat, or decline if you’re not available.`,
  };
}
