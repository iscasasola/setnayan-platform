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
  Wallet,
  ShoppingBag,
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
  { key: 'verify', label: 'Verify', href: '/admin/verify', icon: BadgeCheck, description: 'Vendors awaiting the verification badge.' },
  { key: 'payments', label: 'Payments', href: '/admin/payments', icon: Banknote, description: 'Order payments awaiting reconciliation.' },
  { key: 'payouts', label: 'Payouts', href: '/admin/payouts', icon: Wallet, description: 'Vendor payouts ready to release.' },
  { key: 'token-purchases', label: 'Token sales', href: '/admin/token-purchases', icon: ShoppingBag, description: 'Vendor token-pack purchases awaiting confirmation.' },
  { key: 'subscriptions', label: 'Subscriptions', href: '/admin/subscriptions', icon: Crown, description: 'Vendor Pro / Enterprise upgrades awaiting confirmation.' },
  { key: 'payment-options', label: 'Payment options', href: '/admin/payment-options', icon: CreditCard, description: 'Vendor payment destinations awaiting a fraud screen.' },
  { key: 'disputes', label: 'Disputes', href: '/admin/disputes', icon: Shield, description: 'Open customer and vendor disputes.' },
  { key: 'force-majeure', label: 'Force majeure', href: '/admin/force-majeure', icon: AlertOctagon, description: 'Event-impacting flags to triage.' },
  { key: 'reviews', label: 'Reviews', href: '/admin/reviews', icon: Star, description: 'Review appeals awaiting a decision.' },
  { key: 'concierge-abuse', label: 'Setnayan AI abuse', href: '/admin/concierge-abuse', icon: Flag, description: 'Trial-cycling flags to review.' },
  { key: 'account-deletions', label: 'Account deletions', href: '/admin/account-deletions', icon: UserX, description: 'Self-serve account-deletion requests to review.' },
  { key: 'approvals', label: 'Two-admin approvals', href: '/admin/approvals', icon: CheckCheck, description: 'A colleague is waiting on your second sign-off.' },
  { key: 'help', label: 'Help', href: '/admin/help', icon: LifeBuoy, description: 'Open help-center tickets.' },
  { key: 'vendor-partnerships', label: 'Partnerships', href: '/admin/vendor-partnerships', icon: Handshake, description: 'Vendor-to-vendor partnership claims awaiting two-admin verification.' },
  { key: 'user-reports', label: 'User reports', href: '/admin/user-reports', icon: MessageSquareWarning, description: 'Reported guest-gallery content awaiting moderation.' },
  { key: 'integrity-watch', label: 'Integrity watch', href: '/admin/integrity-watch', icon: ShieldCheck, description: 'Review-fraud and ghost-listing flags awaiting a verdict.' },
];

/**
 * Queues DELIBERATELY absent from the worklist despite being in ADMIN_QUEUE_META.
 * Encoded explicitly so the completeness test (work-rows.test.ts) can subtract
 * them — a genuinely-excluded queue is opt-in here, an accidentally-dropped one
 * (the integrity-watch bug this list was born from) fails the test. Currently
 * every metadata queue has a worklist row, so this is empty.
 */
export const WORKLIST_EXCLUDED_KEYS: readonly string[] = [];
