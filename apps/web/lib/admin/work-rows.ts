/**
 * BASE_ROWS — the presentation layer for the /admin/work command center: one
 * row per act-now queue (brand-voice label + copy + icon + destination). Urgency,
 * count, and lane are layered on from the shared digest at render time
 * (app/admin/work/page.tsx) — this list only holds the static per-queue chrome.
 *
 * Its keys MUST stay a 1:1 superset of ADMIN_QUEUE_META (lib/admin/queue-counts.ts):
 * every queue that carries a badge/urgency has to appear in the worklist, or the
 * command center silently undercounts totalOpen and drops a queue an admin needs
 * to clear. That coverage is enforced by work-rows.test.ts — extracted here from
 * the route file precisely so the invariant is unit-testable (the test glob only
 * reaches lib/**). Adding a new QUEUE_DEF without a row here fails that test.
 */
import {
  BadgeCheck,
  Banknote,
  Crown,
  CreditCard,
  Shield,
  AlertOctagon,
  Star,
  Flag,
  CheckCheck,
  LifeBuoy,
  UserX,
  Handshake,
  MessageSquareWarning,
  ShieldCheck,
  type LucideIcon,
  Receipt,
  Copy,
  ShieldAlert,
  FileWarning,
  TrendingUp,
  Share,
  Music,
  Undo2,
  Lightbulb,
  Bug,
  MailWarning,
} from 'lucide-react';

export type BaseRow = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

// Key MUST match ADMIN_QUEUE_META + the digest keys + the sidebar item keys 1:1.
// Order here is the canonical tie-break only (equal-urgency, equal-count rows
// fall back to this order) — the page ranks by urgency then volume first.
export const BASE_ROWS: BaseRow[] = [
  { key: 'verify', label: 'Verify', href: '/admin/verify', icon: BadgeCheck, description: 'Suppliers awaiting the verification badge.' },
  { key: 'payments', label: 'Payments', href: '/admin/payments', icon: Banknote, description: 'Order payments awaiting reconciliation.' },
  // 'payouts' REMOVED from the work list 2026-08-04 — it can never accrue new
  // work. The payout dispatcher's own call site records the 2026-05-28 V2
  // cutover: "Setnayan is now a software publisher, not a marketplace
  // intermediary… new V2 orders won't route through it"
  // (app/admin/payments/actions.ts). It fires only for pre-V2 orders still
  // carrying vendor_profile_id. Couples pay vendors directly, off-platform.
  //
  // A ranked list of "what needs me today" cannot carry a lane that is
  // permanently empty by construction — it costs a row and a glance every day
  // forever. /admin/payouts itself STAYS, reachable from the Money menu, because
  // legacy orders may still need it. This removes the daily prompt, not the page.
  { key: 'subscriptions', label: 'Subscriptions', href: '/admin/subscriptions', icon: Crown, description: 'Supplier Pro / Supplier Ultra upgrades awaiting confirmation.' },
  { key: 'payment-options', label: 'Payment options', href: '/admin/payment-options', icon: CreditCard, description: 'Supplier payment destinations awaiting a fraud screen.' },
  { key: 'disputes', label: 'Disputes', href: '/admin/disputes', icon: Shield, description: 'Open customer and supplier disputes.' },
  { key: 'force-majeure', label: 'Force majeure', href: '/admin/force-majeure', icon: AlertOctagon, description: 'Event-impacting flags to triage.' },
  { key: 'reviews', label: 'Reviews', href: '/admin/reviews', icon: Star, description: 'Review appeals awaiting a decision.' },
  { key: 'concierge-abuse', label: 'Setnayan AI abuse', href: '/admin/concierge-abuse', icon: Flag, description: 'Trial-cycling flags to review.' },
  { key: 'account-deletions', label: 'Account deletions', href: '/admin/account-deletions', icon: UserX, description: 'Self-serve account-deletion requests to review.' },
  { key: 'event-deletions', label: 'Event removals', href: '/admin/event-deletions', icon: UserX, description: 'A couple has asked us to remove an event money is holding.' },
  { key: 'approvals', label: 'Two-admin approvals', href: '/admin/approvals', icon: CheckCheck, description: 'A colleague is waiting on your second sign-off.' },
  { key: 'help', label: 'Help', href: '/admin/help', icon: LifeBuoy, description: 'Open help-center tickets.' },
  { key: 'vendor-partnerships', label: 'Partnerships', href: '/admin/vendor-partnerships', icon: Handshake, description: 'Supplier-to-supplier partnership claims awaiting two-admin verification.' },
  { key: 'user-reports', label: 'User reports', href: '/admin/user-reports', icon: MessageSquareWarning, description: 'Reported guest Memories content awaiting moderation.' },
  /* ─── ADDED 2026-08-19 · the four the owner said matter ──────────────────
     The list counted 14 queues while ten other queue-shaped admin surfaces went
     uncounted, under a headline reading "You're all caught up". Three of the ten
     are correctly absent (a document browser, a compliance checklist, and one
     whose count would come from two tables — see queue-counts.ts) and payouts
     stays out because there is no payout. These four are real work.
  ──────────────────────────────────────────────────────────────────────────── */
  { key: 'booking-fees', label: 'Fees to sync', href: '/admin/booking-fees', icon: Receipt, description: 'Suppliers who have not yet paid the fee that syncs them to an event.' },
  { key: 'completions', label: 'Completions', href: '/admin/completions', icon: CheckCheck, description: 'Bookings whose completion both sides have not settled.' },
  { key: 'chat-flags', label: 'Chat flags', href: '/admin/chat-flags', icon: MessageSquareWarning, description: 'Messages flagged for taking a deal off-platform.' },
  { key: 'corrections', label: 'Profile corrections', href: '/admin/corrections', icon: Handshake, description: 'Verified shops asking to fix a locked detail.' },
  { key: 'integrity-watch', label: 'Integrity watch', href: '/admin/integrity-watch', icon: ShieldCheck, description: 'Review-fraud and ghost-listing flags awaiting a verdict.' },
  /* ─── ADDED 2026-11-13 · the silent queues (admin slice 4) ──────────────
     The solo-operator audit's fact 4: these filled with no badge and no digest
     line. Each counts in QUEUE_DEFS (lib/admin/queue-counts.ts) now. Pax
     changes and supplier refunds are trails to watch (`watchOnly`) — they show
     their week's number and stay out of "items need you". */
  { key: 'repost-watch', label: 'Repost watch', href: '/admin/repost-watch', icon: Copy, description: 'Reposted pictures and payment QR codes found in a supplier’s media.' },
  { key: 'fraud', label: 'Fraud queue', href: '/admin/fraud', icon: ShieldAlert, description: 'Auto-suspended suppliers — needs your look.' },
  { key: 'editorial-review', label: 'Editorial review', href: '/admin/editorial-review', icon: FileWarning, description: 'Flagged editorials — the couple waits until you look.' },
  { key: 'pax-changes', label: 'Pax changes', href: '/admin/pax-changes', icon: TrendingUp, description: 'Guest-count cost changes this week — you only watch these.' },
  { key: 'social-queue', label: 'Social queue', href: '/admin/studio?tab=social-queue', icon: Share, description: 'Auto-posts that failed, and posts to take down.' },
  { key: 'pakanta', label: 'Music Maker queue', href: '/admin/pakanta', icon: Music, description: 'Paid songs still to write.' },
  { key: 'supplier-refunds', label: 'Supplier refunds', href: '/admin/payments/supplier-refunds', icon: Undo2, description: 'Refunds suppliers recorded this week — you only watch these.' },
  { key: 'service-requests', label: 'Service requests', href: '/admin/categories/requests', icon: Lightbulb, description: 'Suppliers asking for a service we don’t list.' },
  { key: 'problems', label: 'Problems', href: '/admin/app-performance?tab=connection-logs', icon: Bug, description: 'Things failing in the app right now.' },
  { key: 'email-bounces', label: 'Email bounces', href: '/admin/settings?tab=notifications', icon: MailWarning, description: 'Emails this week that did not arrive.' },
];

/**
 * Queues DELIBERATELY absent from the worklist despite being in ADMIN_QUEUE_META.
 * Encoded explicitly so the completeness test (work-rows.test.ts) can subtract
 * them — a genuinely-excluded queue is opt-in here, an accidentally-dropped one
 * (the integrity-watch bug this list was born from) fails the test.
 */
export const WORKLIST_EXCLUDED_KEYS: readonly string[] = [
  // 'payouts' — permanently empty by construction, not merely quiet today.
  // The dispatcher's own call site records the 2026-05-28 V2 cutover:
  // "Setnayan is now a software publisher, not a marketplace intermediary…
  // new V2 orders won't route through it" (app/admin/payments/actions.ts).
  // Couples pay vendors directly, off-platform; only pre-V2 orders carrying
  // vendor_profile_id can ever reach it.
  //
  // It keeps its ADMIN_QUEUE_META entry on purpose: the Money menu still links
  // /admin/payouts for those legacy rows, and the badge should still light if
  // one ever surfaces. What it loses is a permanent row in the ranked list of
  // "what needs me today" — a lane that can never fill costs a glance every
  // morning forever.
  'payouts',
];
