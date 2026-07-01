/**
 * Vendor-benefits catalog for the "For vendors" overlay — organized BY ACCOUNT
 * TYPE (owner 2026-07-01): Free → Solo → Pro → Enterprise → Custom, each tier
 * showing what it ADDS on top of the one below. Mirrors the tier ladder on
 * /for-vendors and the hybrid gating decision in VENDOR_TIERS_AND_BENEFITS.md
 * (§2 allocation + §6 as-built). `soon` = not yet live end-to-end; it clears as
 * the vendor-dashboard session ships. Keep the tier assignments in step with the
 * doc + the coded caps in lib/vendor-tier-caps.ts.
 */

export type VendorTier = 'free' | 'solo' | 'pro' | 'enterprise';

export type VendorBenefit = { n: string; soon?: boolean; b: string };
export type VendorTierGroup = { h?: string; items: VendorBenefit[] };
export type VendorTierSection = {
  tier: VendorTier;
  name: string;
  price: string;
  /** Short "/28d" style qualifier shown next to the price. */
  unit: string;
  /** One-line "what this tier is for". */
  tagline: string;
  groups: VendorTierGroup[];
};

export const VENDOR_TIER_SECTIONS: VendorTierSection[] = [
  {
    tier: 'free',
    name: 'Free · Verified',
    price: '₱0',
    unit: 'free while we launch',
    tagline: 'The whole business — get found, get trusted, get booked. Keep 100%.',
    groups: [
      {
        h: 'Get found',
        items: [
          { n: 'Faith & region matchmaking', b: 'Found by the rites you serve and the provinces your crew covers.' },
          { n: 'Date-open priority', b: 'Free on their date? You rank above vendors already booked then.' },
          { n: 'Lead capture & matchmaking', b: 'Every couple who finds you is a captured, well-fitted lead.' },
          { n: 'Shortlist radar', b: 'See how many couples saved you; get a rival-in-your-area demand feed.' },
          { n: 'First-look window', b: 'Reply fast, complete your profile — earn a head-start in front of new couples.' },
          { n: 'Booked-out waitlist', b: 'Fully booked? Couples wait instead of bouncing — a cancellation becomes a recovered booking.' },
          { n: 'Pay only for inquiries that fit', b: 'Charged only for matched, intent-qualified inquiries — never junk.' },
        ],
      },
      {
        h: 'Look credible & trusted',
        items: [
          { n: 'Verified badge, free', b: 'Pass a 12-doc check free — no copycat can fake your official page.' },
          { n: 'Search-ready microsite', b: 'A clean public profile built to rank on Google and inside Setnayan.' },
          { n: 'Fair merit-based rating', b: 'A Bayesian score protects new vendors — stars are earned, never bought.' },
          { n: 'Receipt-backed reviews', b: 'Every rating carries a real “booked through Setnayan” verified mark.' },
          { n: 'Right-of-reply on reviews', b: 'Post one public, professional reply under any review — your side shows.' },
          { n: 'Earned badges & experience tier', b: 'New / Verified / Top Pick / Most Booked, plus your years-in-business badge.' },
          { n: '“Recommended by N couples”', b: 'Real couples vouch for you, counted on your profile.' },
          { n: 'Self-review blocker', b: 'The system detects and blocks fake self-reviews before they post.' },
          { n: 'Flag a suspicious review', b: 'Flag a fake or unfair review; HQ reviews it within 48 hours.' },
          { n: 'Merit-only ranking', b: 'No pay-to-rank — you can’t buy your way up, and neither can rivals.' },
          { n: 'No fake reviews, no ghost listings', soon: true, b: 'We screen bought reviews and ghost listings — protecting honest vendors most.' },
          { n: 'Stand-up-for-yourself dispute mediation', soon: true, b: 'A neutral team reviews the record before anything touches your rating.' },
        ],
      },
      {
        h: 'Bring your business with you',
        items: [
          { n: 'Import past clients free', b: 'Pull your existing bookings into one dashboard — free, no fee.' },
          { n: 'Past weddings become reviews', b: 'Your old clients confirm and leave a verified review.' },
          { n: 'Claim-QR + “verified wedding” pill', b: 'A one-scan claim turns a past event into proof on your profile.' },
        ],
      },
      {
        h: 'Run every booking',
        items: [
          { n: 'One vendor dashboard', b: 'Run bookings, calendar, clients, threads and proposals from one place.' },
          { n: 'Shared team calendar', b: 'One calendar across every service and crew member.' },
          { n: 'Double-booking guard', b: 'A held date blocks a second booking, scoped per service and role.' },
          { n: 'Send package proposals', b: 'Draft, save and send proposals with package line items to booked couples.' },
          { n: 'Headcount that quotes itself', b: 'Catering covers auto-compute from the couple’s live guest list.' },
          { n: 'Bookings pipeline', b: 'Accepted inquiries become tracked booking items on the event.' },
          { n: 'Contract-on-record', b: 'Upload each contract to a timestamped, per-event paper trail.' },
          { n: 'Automated bookings', soon: true, b: 'Inquiries flow into a live pipeline with quotes and milestones auto-attached.' },
          { n: 'One-tap RA 8792 contracts', soon: true, b: 'Pull a clause, fill, and both e-sign in-app — no printing.' },
          { n: 'Change-order trail', soon: true, b: 'Mid-plan add-ons become logged, both-acknowledged change orders.' },
          { n: 'Day-of run-of-show & handover', soon: true, b: 'A shared minute-by-minute timeline; mark the gallery delivered.' },
        ],
      },
      {
        h: 'Get paid your way',
        items: [
          { n: '0% commission, forever', b: 'Keep every peso — we never take a cut, on or off platform.' },
          { n: 'GCash or bank, your call', b: 'Couples pay you directly to your GCash/BDO — we never hold your money.' },
          { n: 'Set your price once', b: 'Publish packages and rates once; they power every quote you send.' },
          { n: 'PH-style milestone tracking', b: 'Log reservation → progress → balance with proof, the way PH couples pay.' },
          { n: 'Deposit reservation, lock-free', b: 'A recorded deposit holds the date; the money settles straight to you.' },
          { n: 'No-show downpayment protection', b: 'A frozen, couple-agreed cancellation policy makes a forfeited downpayment defensible.' },
          { n: 'Payday calendar & cash-flow view', b: 'Every upcoming milestone due-date across all booked events on one timeline.' },
        ],
      },
      {
        h: 'Know your numbers',
        items: [
          { n: 'Price-position meter', b: 'Know if you’re under-priced, on-market, or premium for your category.' },
          { n: 'Profile score & fix-it tips', b: 'A ranked checklist of what’s holding your profile back.' },
        ],
      },
      {
        h: 'Seen & supported',
        items: [
          { n: 'Credited to guests on the day', b: 'You’re shown as one of “the vendors who made this day”.' },
          { n: 'Appear in the couple’s planner + budget', b: 'You sit inside the couple’s planning workspace, not just search.' },
          { n: 'Off-season promo surfacing', b: 'We flag your lean months so your off-peak deal gets surfaced.' },
          { n: 'Pull a vetted crew hand', b: 'Short a shooter or coordinator? Book a vetted hand at a posted PH rate.' },
          { n: 'Auto-shared to our socials', soon: true, b: 'Your couples’ standout moments hit our FB/IG with your name and logo.' },
          { n: 'Couple referral rewards', soon: true, b: 'Happy couples refer; when their referral books you, both get a perk.' },
          { n: 'One profile, every life event', soon: true, b: 'Reviews, calendar and history carry across weddings, debuts, christenings and more.' },
        ],
      },
    ],
  },
  {
    tier: 'solo',
    name: 'Solo',
    price: '₱999',
    unit: '/ 28 days',
    tagline: 'Operate friction-free. Everything in Free, plus your own business analytics.',
    groups: [
      {
        items: [
          { n: 'Unlimited answering', b: 'Answer every matched couple — no weekly cap (Free is capped at 10 a week).' },
          { n: 'Quote-to-booking funnel', b: 'See views → inquiries → signed over time, plus every booking’s source.' },
          { n: 'Won & lost reasons', b: 'See why couples said yes or walked, and fix the real leak.' },
          { n: 'Peso-per-lead scorecard', b: 'See the true cost of each booked couple vs your spend.' },
          { n: 'Your own funnel metrics', b: 'Track reply rate, average reply time, and inquiry-to-booking live.' },
          { n: 'Earnings dashboard', b: 'Year-to-date revenue, monthly subtotals and scheduled payouts in one view.' },
          { n: 'Recap sharing', b: 'One-tap share of every wedding you helped create, straight to your Facebook Page.' },
          { n: 'Three services per category', b: 'List up to three distinct service packages under your category.' },
        ],
      },
    ],
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: '₱2,499',
    unit: '/ 28 days',
    tagline: 'Grow — a team, wider reach, and premium market intelligence. Everything in Solo, plus:',
    groups: [
      {
        items: [
          { n: 'Team sub-accounts (3 seats)', b: 'Give each crew member a login scoped to their services — no shared passwords.' },
          { n: 'One clean business identity', b: 'Crew act under one verified profile — you look like a real studio.' },
          { n: 'Three categories + 50 km reach', b: 'List under three parent categories and serve a wider radius.' },
          { n: 'Demand Radar', b: 'See where demand is building in your market — by month and by the looks couples choose.' },
          { n: 'Reverse-image theft watch', b: 'Reposts of your portfolio get flagged as yours across the platform.' },
          { n: 'Custom slug + full written reviews', b: 'Your own /your-name URL, and the full text of every review on show.' },
          { n: 'Multiple events per day', b: 'Take more than one booking on the same date.' },
          { n: 'Category benchmarks vs peers', soon: true, b: 'Rank your funnel against anonymized peers in your exact category.' },
          { n: 'Featured in Real Wedding Stories', soon: true, b: 'A loved event becomes a published Real Story crediting your work, with a backlink.' },
          { n: 'Editorial & Journal spotlights', soon: true, b: 'Featured in the Journal couples read while planning — in front of buyers at intent.' },
          { n: 'Reply-time stats & Spotlight awards', soon: true, b: 'Top performers earn a Spotlight badge plus a homepage feature.' },
          { n: 'Resell Setnayan Productions', soon: true, b: 'Bundle Papic, Live Studio, monogram or Pakanta into your own quote.' },
          { n: 'White-label couple tools', soon: true, b: 'Hand couples the seating chart, mood board and schedule under your brand.' },
          { n: 'Setnayan-certified partner', soon: true, b: 'Get badged to deliver in-app services; couples who bought them route to you.' },
          { n: 'Earn on your crew', soon: true, b: 'Post your second shooters and HMUA — earn a referral cut when they’re booked.' },
          { n: 'Priority support', soon: true, b: 'Move to the front of the support queue.' },
        ],
      },
    ],
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    price: '₱7,499',
    unit: '/ 28 days',
    tagline: 'Scale as an organization. Everything in Pro, plus:',
    groups: [
      {
        items: [
          { n: 'All categories', b: 'List under every parent category, no cap.' },
          { n: 'Up to 10 team seats + multi-admin', b: 'A full team with shared, voted governance.' },
          { n: 'Nationwide reach', b: 'Serve couples in every region.' },
          { n: 'Up to 300 portfolio photos', b: 'A deep portfolio to show your full range.' },
          { n: 'Up to 8 events per category / day', b: 'Run at real studio volume.' },
          { n: 'Quarterly business review', soon: true, b: 'A scheduled review of your numbers with our team.' },
          { n: 'Priority dispute + account management', soon: true, b: 'A named contact and front-of-line dispute handling.' },
        ],
      },
    ],
  },
];

/** The negotiated tier above Enterprise — rendered as a teaser card, not a benefit list. */
export const VENDOR_CUSTOM_TIER = {
  name: 'Custom · Talk to us',
  tagline:
    'Franchises, chains and multi-brand houses beyond Enterprise caps: unlimited seats, multi-region, unlimited portfolio. Negotiated pricing.',
};
