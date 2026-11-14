/**
 * ADMIN HELP SLOT H7 — admin areas A1–A17 — Work, Money, People. INTERNAL: for the Setnayan team, never the public.
 *
 * Owned by ONE answer-writing session (H7); no other session edits this file.
 * Covers: the Work list and queues · approvals · payments, payouts, receipts, refunds, booking fees, subscriptions, discount codes · users, accounts, suppliers, verification, deletions, data privacy, fraud and reports.
 * Where those live: app/admin (work, queues, approvals, money, payments, payouts, receipts, booking-fees, subscriptions, discount-codes, users, accounts, vendors, verify, verification-docs, account-deletions, event-deletions, data-privacy, fraud, user-reports, chat-flags, disputes, force-majeure).
 *
 * ⛔ Behind the same wall as lib/help-admin.ts: only lib/help-admin.ts may import
 * this file, and only app/admin/** may import that
 * (lib/public-help-says-what-is-true.test.ts). Never import it from lib/help.ts.
 * Every slug is globally unique across lib/help/ and lib/help-admin/
 * (lib/help-slugs-are-unique.test.ts).
 */
import type { AdminHelpTopic } from '@/lib/help-admin';

export const ADMIN_1_TOPICS: AdminHelpTopic[] = [];
