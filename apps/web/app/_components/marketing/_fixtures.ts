/**
 * v2.1 homepage fixtures · canonical mock data from template.
 *
 * WHY: CLAUDE.md 2026-05-28 10th row "v2.1 BRIEF LOCKED AS CANONICAL". The
 * template's components/mock-data.jsx ships SETNAYAN_DATA as window.* globals.
 * Ported here as TypeScript shapes consumed by static homepage sections.
 *
 * Pilot wedding: Claire & Ice · 18 Dec 2026 · La Castellana. Same data feeds
 * dashboard preview + personal-site preview + marketplace preview cards.
 *
 * v2.1 DRIFT SCRUBS applied:
 *   - "5% platform fee" / "we take a cut" → "0% commission"
 *   - "₱499/wk Pro" → "₱1,999/28 days Pro Vendor"
 *   - "Setnayan Concierge" → "Setnayan AI"
 *   - "₱1,499 one-time verification" + "₱499 refresh" preserved (v2.1-correct)
 */

export type EventFixture = {
  couple: string;
  date: string;
  dateShort: string;
  daysOut: number;
  venue: string;
  headcount: number;
  confirmed: number;
  pending: number;
  budget: number;
  spent: number;
  phase: string;
};

export type VendorPreview = {
  id: string;
  name: string;
  category: string;
  status: string;
  paidPct: number;
  totalPhp: number;
  next: string;
  verified: boolean;
};

export type TimelineItem = {
  date: string;
  label: string;
  type: 'vendor' | 'deadline' | 'task' | 'day';
  done?: boolean;
  hero?: boolean;
  hot?: boolean;
};

export const PILOT_EVENT: EventFixture = {
  couple: 'Claire & Ice',
  date: '18 · 12 · 2026',
  dateShort: 'Dec 18, 2026',
  daysOut: 213,
  venue: 'La Castellana, Negros Occidental',
  headcount: 213,
  confirmed: 166,
  pending: 47,
  budget: 2_000_000,
  spent: 1_240_000,
  phase: 'Inviting',
};

export const PILOT_VENDORS: VendorPreview[] = [
  {
    id: 'v1',
    name: 'Ato Catering',
    category: 'Catering',
    status: 'Booked',
    paidPct: 60,
    totalPhp: 380_000,
    next: 'Final headcount lock · Dec 5',
    verified: true,
  },
  {
    id: 'v2',
    name: 'Bloom & Co. Florals',
    category: 'Florals',
    status: 'Booked',
    paidPct: 50,
    totalPhp: 145_000,
    next: 'Sample swatch review · this week',
    verified: true,
  },
  {
    id: 'v3',
    name: 'Studio Sereno',
    category: 'Photography',
    status: 'Booked',
    paidPct: 30,
    totalPhp: 220_000,
    next: 'Pre-nup shoot · Nov 14',
    verified: true,
  },
  {
    id: 'v5',
    name: 'La Castellana Estate',
    category: 'Venue',
    status: 'Booked',
    paidPct: 100,
    totalPhp: 480_000,
    next: 'Walkthrough · Nov 28',
    verified: true,
  },
  {
    id: 'v6',
    name: 'Ilaya Coordinators',
    category: 'Coordination',
    status: 'Booked',
    paidPct: 25,
    totalPhp: 95_000,
    next: 'Run-of-show draft · Dec 1',
    verified: true,
  },
];

export const PILOT_TIMELINE: TimelineItem[] = [
  { date: 'Nov 14', label: 'Pre-nup shoot — Studio Sereno', type: 'vendor', done: true },
  { date: 'Nov 28', label: 'Venue walkthrough — La Castellana', type: 'vendor' },
  { date: 'Dec 1', label: 'Run-of-show draft from Ilaya', type: 'vendor' },
  { date: 'Dec 5', label: 'Final headcount lock for caterer', type: 'deadline', hot: true },
  { date: 'Dec 8', label: 'Print individual QR sheets', type: 'task' },
  { date: 'Dec 11', label: 'Crew arrival · La Castellana', type: 'day' },
  { date: 'Dec 12', label: 'Ceremony · 4:00pm', type: 'day', hero: true },
  { date: 'Dec 12', label: 'Reception · 6:30pm', type: 'day', hero: true },
];

// Couple-side feature list — v2.1 brief § 4 "For couples" rows.
export const COUPLE_FEATURES = [
  '18 free planning tools. Guest list, RSVP, seating, mood board, budget. No subscription, no paywall.',
  'Personal QR invitations for every guest, with optional branded monogram.',
  "Day-of livestream so anyone who can't be there sees every moment.",
  "Papic guest capture — your guests' phones become a coordinated photo crew.",
  'Same-Day Edit highlight reel delivered 30 minutes before the reception starts.',
  '0% commission on vendor bookings. Vendors keep 100% of what you pay them.',
];

// Vendor-side feature list — v2.1 brief § 4 "For vendors" rows, drift-scrubbed.
export const VENDOR_FEATURES = [
  'Free listing. Profile, chat with couples, accept bookings — no monthly fee to start.',
  'Real calendar with team roles, agent privacy redaction, per-service scoping.',
  '₱1,499 one-time verification badge. ₱499 per refresh when documents change.',
  'Pro Vendor ₱1,999/28 days unlocks AI proposals, analytics, custom microsite.',
  'Enterprise ₱5,499/28 days unlocks multi-category listing + sub-4hr priority support.',
  '100 free tokens on verification before 2027-01-31. Founder bonus for pilot vendors.',
];

// "What's live today" pills — v2.1 brief § 1.
export const LIVE_TODAY = [
  'Proper receipts, automatic',
  'QR invitations',
  'Verified vendor marketplace',
  'Day-of livestream',
  'Same-Day Edit highlight reel',
  'Multi-host event access',
  'In-app chat with vendors',
  '0% commission · always',
];

// FAQ — v2.1 brief § 1 + § 7 (with drift scrubs).
export const FAQ_ITEMS = [
  {
    q: 'Is Setnayan really free for couples?',
    a: 'Yes. 18 planning tools — guest list, RSVP, seating, mood board, budget, vendor messaging, personal website, QR invitations — all free, forever. We make money from Setnayan Productions services (livestream, highlight reels, monograms, etc.) that you choose à la carte, and from vendor subscriptions.',
  },
  {
    q: 'What does Setnayan take from vendor bookings?',
    a: "Zero. Setnayan never touches the money between you and your vendor. They quote, you pay them directly via GCash / Maya / bank transfer / cash. That's between you two — no platform fee, no commission, no 5% markup.",
  },
  {
    q: 'What do vendors pay?',
    a: 'Free to list. ₱1,499 one-time for the lifetime verification badge (₱499 per refresh when documents change). Pro Vendor ₱1,999/28 days unlocks visibility upgrades, AI proposals, and custom microsite. Enterprise ₱5,499/28 days adds multi-category listing and priority support.',
  },
  {
    q: "What's the pilot?",
    a: "December 2026. Our own wedding — Claire & Ice, December 18 at La Castellana — ships first. We're inviting 5-20 family and friends to plan alongside us. Same product, real money flow, calmer launch. Public open after.",
  },
];
