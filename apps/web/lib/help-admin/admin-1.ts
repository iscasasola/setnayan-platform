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

/*
 * H7 · 2026-11-14 — INTERNAL. Every answer below was checked against origin/main; the code that proves it is named in
 * the comment above it (a greppable string, never a line number). No § 9.1 limit, SLA hour or count is typed — each
 * names the constant that holds it.
 *
 * ⚠ FOUND WHILE WRITING (owner, not copy — see the PR body): two of the eight § 9.1 two-admin promises are NOT enforced
 * in code (lib/two-admin-promise.ts rows with actionType: null — force-delisting without the due-process timeline, and
 * re-publishing a rejected application); a CUSTOMER/event comp above COMP_TWO_ADMIN_THRESHOLD_PHP is granted at once
 * by one admin (app/admin/users/actions.ts issueCompGrant — only a banner); supplier plan prices (saveVendorRow →
 * vendor_billing_catalog) and the bulk price writers (app/admin/pricing/price-control-actions.ts) save with one admin.
 * These answers describe what the console DOES, and say so where it falls short of § 9.1.
 * The existing topics in lib/help-admin.ts are largely stale (eight-surfaces, delete-vs-blacklist, approving-an-action,
 * the three force-majeure articles) — left untouched (shared file; what-needs-two-admins is pinned by a test).
 */
export const ADMIN_1_TOPICS: AdminHelpTopic[] = [
  {
    key: 'admin-the-console',
    label: 'The console and the Work list',
    audience: 'admin',
    articles: [
      {
        // lib/admin/admin-tabs.ts ADMIN_TABS, ADMIN_AVATAR_ROWS; app/admin/admin-routes-all-have-a-tab.test.ts; lib/admin/admin-predicate.ts isAdminProfile; lib/admin/require-admin.ts
        slug: 'admin-five-tabs',
        title: 'How is the console laid out today?',
        body: 'Five tabs — Work, Money, People, Catalogue and Insights — each with a page picker (Page · View ▾), plus the avatar menu (Secrets & integrations, Email delivery, Switches, Business & compliance). Team & permissions and Admin log are listed but not built yet. Anyone who is internal, a team member or an admin account gets in; everyone else gets a 404.',
      },
      {
        // app/admin/work/page.tsx (AdminWorkLanding); lib/admin/queue-counts.ts ADMIN_QUEUE_META slaHours; admin-tab-rows.tsx COUNT_REFUSED
        slug: 'admin-work-list',
        title: 'What is the Work list, and how is “overdue” decided?',
        body: 'Work › All is the first screen: every queue ranked overdue, then due soon, then busiest, with the top item as Next. A queue is overdue when its oldest open item is older than that queue’s slaHours in ADMIN_QUEUE_META. A count shown as “—” means it could not be read — not the same as none — and “Nothing needs you” shows only when every count was read.',
      },
      {
        // app/admin/users/[userId]/_components/account-card-nav.tsx ACCOUNT_TABS; app/admin/users/[userId]/page.tsx (.limit(30)); app/admin/approvals/actions.ts "best-effort logs to admin_audit_log"
        slug: 'admin-where-actions-are-logged',
        title: 'Where do I see what admins did to an account?',
        body: 'On the person’s Account card, Activity lists their recent events, with admin actions marked Admin action. The rows live in admin_audit_log (actor, target, action, before/after, reason). Logging is best effort, so treat a missing row as unknown rather than as proof nothing happened.',
      },
    ],
  },
  {
    key: 'admin-two-admins',
    label: 'Two-admin approvals',
    audience: 'admin',
    articles: [
      {
        // lib/admin-approvals.ts APPROVAL_ACTIONS; app/admin/approvals/page.tsx "Submit for two-admin approval"
        slug: 'admin-propose-a-role-grant',
        title: 'How do I propose a role grant?',
        body: 'Work › Approvals › New request: pick the action (grant an internal account, promote to admin, or add to the team), enter the person’s email and your rationale, and Submit for two-admin approval. Refunds, fraud bans, receiving-account changes, customer price changes, plan contents, sponsored spotlights and partnerships start from their own pages instead.',
      },
      {
        // app/admin/approvals/page.tsx "You initiated this — a different admin must decide it."; DB CHECK decided_by <> initiated_by; migration 20260930000000 INTERVAL '7 days'
        slug: 'admin-decide-a-request',
        title: 'How do I decide another admin’s request?',
        body: 'Open it in Work › Approvals and press ✓ Approve & execute, or Reject with a reason. You cannot decide your own — the page says a different admin must, and the database refuses it too. A request expires if nobody decides it (refunds, comps and price changes sooner than the rest). With fewer than two admins, the page warns that four-eyes needs at least two.',
      },
      {
        // lib/two-admin-promise.ts TWO_ADMIN_PROMISES (actionType: null rows); app/admin/users/actions.ts issueCompGrant; saveVendorRow
        slug: 'admin-what-two-admins-really-enforce',
        title: 'Which § 9.1 promises does the console actually enforce?',
        body: 'Enforced with a second admin: promoting to an admin role, adding an internal account, supplier comps, refunds above REFUND_TWO_ADMIN_THRESHOLD_PHP, receiving-account changes, customer price changes and supplier plan contents. NOT enforced today: force-delisting without the due-process timeline and re-publishing a rejected application have no gate; a customer or event comp above COMP_TWO_ADMIN_THRESHOLD_PHP is granted at once (only a banner flags it); supplier plan prices and the bulk price tools save with one admin. Until those are built, route them to a second admin yourself.',
      },
    ],
  },
  {
    key: 'admin-money-desk',
    label: 'Money: payments, refunds, fees and plans',
    audience: 'admin',
    articles: [
      {
        // app/admin/payments/page.tsx "One-click approve · clean match", "Approve · matched"; lib/admin/green-payments.ts isDecisivePaymentMatch; an-ai-may-not-approve-money.test.ts
        slug: 'admin-confirm-a-payment',
        title: 'How do I confirm a couple’s payment?',
        body: 'Money › To confirm. A clean match gets One-click approve; anything else is Approve · matched, with an optional note. Approve all green on the Work row approves only decisive matches with no repeated reference — amber rows say why they were held. The AI receipt reading never decides on its own.',
      },
      {
        // app/admin/payments/_components/inbox-matcher.tsx "Paste from your GCash / BDO app"
        slug: 'admin-match-a-bank-notice',
        title: 'How do I match a GCash or bank notification?',
        body: 'Paste it into the matcher on the payments desk. It finds the matching payment for you; it approves nothing.',
      },
      {
        // app/admin/payments/page.tsx "Request resubmit", reject cancels the linked order
        slug: 'admin-reject-or-resubmit',
        title: 'Reject a payment, or ask for it again?',
        body: 'Request resubmit when the proof is unclear: your note is emailed to the couple word for word. Reject cancels the linked order — use it only when the payment is not real.',
      },
      {
        // payments desk "Record refund · notify couple"; refundOrder (approve_large_refund); REFUND_TWO_ADMIN_THRESHOLD_PHP; payments/supplier-refunds/page.tsx
        slug: 'admin-record-a-refund',
        title: 'How do I refund an order?',
        body: 'Send the money back first — the console cannot undo it. Then Record a refund on the order with the amount and a reason, which notifies the couple. Above REFUND_TWO_ADMIN_THRESHOLD_PHP it becomes a two-admin request instead. Converting to Papic credits or moving the order are other ways to make it right. Money › Refunds is a read-only list of refunds suppliers gave their own clients.',
      },
      {
        // app/admin/payouts/page.tsx ("Couples pay their suppliers directly, so Setnayan makes no new payouts"); app/admin/receipts/page.tsx
        slug: 'admin-payouts-and-receipts',
        title: 'Do we still pay suppliers, and are our receipts official?',
        body: 'No new payouts: couples pay suppliers directly, and Supplier payouts is the record of older bookings (Mark paid, Place on hold, Release hold). Transaction receipts are app receipts, one per paid order — not BIR Official Receipts.',
      },
      {
        // app/admin/booking-fees/page.tsx ("THIS PAGE DECIDES NOTHING"); setBookingsOpen (platform_settings.bookings_open)
        slug: 'admin-booking-fees',
        title: 'Where do I approve a supplier’s booking fee?',
        body: 'In Money › To confirm, like any payment. Fees owed only shows what is owed and decides nothing. It also holds the control that closes or opens bookings for the whole platform.',
      },
      {
        // app/admin/subscriptions/page.tsx "Confirm payment & activate plan" (approve_vendor_subscription)
        slug: 'admin-activate-a-supplier-plan',
        title: 'How does a supplier’s plan go live?',
        body: 'Money › Subscriptions: check the payment, then Confirm payment & activate plan — or Reject with a reason. One admin.',
      },
      {
        // /admin/discount-codes/new "Create code"; disable dialog "Existing orders that already redeemed it keep their special price."
        slug: 'admin-discount-codes',
        title: 'How do I create or stop a discount code?',
        body: 'Money ⚙ › Discount codes › Create code: a percentage off, a capped percentage, or free. Disable stops it — orders that already used it keep their price — and Enable turns it back on.',
      },
    ],
  },
  {
    key: 'admin-people-and-trust',
    label: 'People and trust',
    audience: 'admin',
    articles: [
      {
        // app/admin/users/actions.ts deleteUser → eraseUserAccount; blacklisted_emails; users-surface.tsx dialog wording
        slug: 'admin-delete-or-blacklist',
        title: 'What do Delete and Blacklist really do?',
        body: 'Both erase the person: their account is anonymised while orders and payments are kept for the books, without their name — there is no restore window. Delete frees the email to sign up again; Blacklist also blocks that email (email only — no device check) until someone presses Unblacklist. You cannot do either to yourself or to an internal account. The dialog still says “hard-delete … cascade-deletes”; that wording is wrong.',
      },
      {
        // users/[userId] Danger zone "Force sign-out"; account-hold-section.tsx Suspend/Unsuspend; "Team · waiting on 2nd admin"
        slug: 'admin-suspend-or-sign-out',
        title: 'How do I sign someone out, suspend them or add them to the team?',
        body: 'On their Account card: Force sign-out signs them out everywhere; Suspend (and Unsuspend) holds the account. Add to team needs a second admin and shows as waiting until one decides; Remove from team needs one.',
      },
      {
        // app/admin/verify (Applications · Listing visibility); "Mark in review", "Approve → Verified", "Confirm reject"; markVendorContactConfirmed
        slug: 'admin-verify-a-supplier',
        title: 'How do I verify a supplier?',
        body: 'People › To verify › Applications: Mark in review, then Approve → Verified, or reject with a required reason. Listing visibility handles what a shop shows. One admin. The console has no video-call scheduling — confirm the call yourself and record the contact check as Email received or Text received.',
      },
      {
        // app/admin/verification-docs ('In use', 'Left over', 'Not sure')
        slug: 'admin-id-documents',
        title: 'Where are suppliers’ ID documents?',
        body: 'People › ID documents. Each file is marked In use, Left over or Not sure; a Not sure file cannot be deleted.',
      },
      {
        // app/admin/account-deletions/page.tsx "Approve + delete", "Approve + blacklist", "Rejection note (required)"
        slug: 'admin-account-deletion-requests',
        title: 'How do I handle an account deletion request?',
        body: 'Work › Account deletions: check there are no active events, bookings or unpaid balances, then Approve + delete, Approve + blacklist, or reject with a note.',
      },
      {
        // app/admin/event-deletions/page.tsx "Remove it for good", "Keep it, and tell them why"
        slug: 'admin-event-removals',
        title: 'Why did an event removal reach me?',
        body: 'Only removals held by money come here. Write what you did about the money — the host reads it — then Remove it for good, or Keep it, and tell them why.',
      },
      {
        // users/<id>/export "Download their data"; app/admin/data-privacy (setDataPrivacyControl)
        slug: 'admin-data-requests',
        title: 'Someone asked for their data — what do I do?',
        body: 'On their Account card, Download their data gives the same file they can download themselves, without message text. Insights › Privacy & NPC holds the privacy controls, coverage, deletions, the NPC checklist and documents.',
      },
      {
        // app/admin/fraud ("Dismiss (false positive)", "Un-suspend (keep watching)"); wipe-ban-dialog.tsx (approve_fraud_wipe_ban)
        slug: 'admin-fraud-queue',
        title: 'How do I handle the fraud queue?',
        body: 'Dismiss (false positive) clears the flag and lifts the suspension; Un-suspend (keep watching) only lifts it. To ban, Confirm fraud and open a wipe + ban request with your rationale — a second admin confirms it in Approvals.',
      },
      {
        // app/admin/user-reports/page.tsx ("Hide content", "Block uploader", "Escalate", "Dismiss")
        slug: 'admin-user-reports',
        title: 'What can I do with a user report?',
        body: 'Hide the content, remove it from Real Stories, block the uploader, escalate it, or dismiss it.',
      },
      {
        // disputes page "Apply resolution"; lib/force-majeure.ts RESOLUTION_ACTIONS, sweepEscalateStaleFlags, auto_resolve_at
        slug: 'admin-disputes-and-force-majeure',
        title: 'How do I resolve a dispute or a force-majeure flag?',
        body: 'Disputes: pick the outcome, write the decision and its reason, and Apply resolution. Force majeure: Take ownership, then resolve it as Refund issued, Rescheduled, Partial credit, Mediation, Resolved or Dismissed — a refund or credit needs the amount and channel in the notes. A flag left open past auto_resolve_at is moved to Escalated when the page is opened, and only the couple is notified of the outcome.',
      },
    ],
  },
];
