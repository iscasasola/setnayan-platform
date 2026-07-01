/**
 * Vendor-benefits catalog for the "For vendors" overlay.
 *
 * SYNCED 2026-07-01 (owner): ONE source of truth reconciled across the source
 * catalog (03_Strategy/Vendor_Benefits_Catalog_2026-06-29.md), the §6 as-built
 * audit in apps/web/VENDOR_TIERS_AND_BENEFITS.md, and the live code — via a
 * 7-lens merge + per-benefit code verification. `soon` = not yet live end-to-end
 * (buildable/roadmap/partial); it clears as the vendor-dashboard session ships.
 * Totals: 60 distinct benefits · 40 live · 20 soon.
 * Keep in step with VENDOR_TIERS_AND_BENEFITS.md §6 (the SSOT).
 */

export type VendorHeroCard = { ic: string; title: string; soon?: boolean; body: string };

export const VENDOR_HERO_CARDS: VendorHeroCard[] = [
  { ic: '⊘', title: '0% Commission, Forever', body: 'Keep every peso — we never take a cut, on or off platform.' },
  { ic: '✓', title: 'Free to List & Verify', body: 'Publish your profile and pass a 12-doc verification for free — no fee to be found or trusted.' },
  { ic: '◎', title: 'Faith & Region Matchmaking', body: 'Found by the rites you serve and the provinces your crew covers.' },
  { ic: '▦', title: 'One Profile, Every Life Event', soon: true, body: 'One verified page that carries across weddings, debuts, christenings and more.' },
  { ic: '◆', title: 'Run It All In One Place', body: 'Bookings, calendar, clients, threads, proposals and payments — one dashboard.' },
  { ic: '⌖', title: 'Only Leads That Fit', body: 'Every couple who finds you is a captured, well-fitted, intent-matched lead.' },
];

export type VendorBenefit = { n: string; soon?: boolean; b: string };
export type VendorGroup = { h: string; items: VendorBenefit[] };

export const VENDOR_GROUPS: VendorGroup[] = [
  {
    h: 'Discovery & lead quality',
    items: [
      { n: 'Faith & Region Matchmaking', b: 'Found by the rites you serve and the provinces your crew covers.' },
      { n: 'Date-Open Priority', b: 'Free on their date? You rank above vendors already booked then.' },
      { n: 'Lead Capture & Matchmaking', b: 'Every couple who finds you is a captured, well-fitted lead.' },
      { n: 'Shortlist Radar', b: 'See how many couples saved you; get a rival-in-your-area demand feed.' },
      { n: 'First-Look Window', b: 'Reply fast, complete your profile — earn a head-start in front of new couples.' },
      { n: 'Booked-Out Waitlist', b: 'Fully booked? Couples wait instead of bouncing — a cancellation becomes a recovered booking.' },
    ],
  },
  {
    h: 'Booking, contracts & operations',
    items: [
      { n: 'One Vendor Dashboard', b: 'Run bookings, calendar, clients, threads and proposals from one place.' },
      { n: 'Ultimate Team Calendar', b: 'One shared calendar across every service and crew member.' },
      { n: 'Double-Booking Guard', b: 'A held date blocks a second booking, scoped per service and role.' },
      { n: 'Send Package Proposals', b: 'Draft, save and send proposals with package line items to booked couples.' },
      { n: 'Headcount That Quotes Itself', b: 'Catering covers auto-compute from the couple\'s live guest list.' },
      { n: 'Bookings Pipeline', b: 'Accepted inquiries become tracked booking items on the event.' },
      { n: 'Import Your Off-App Clients', b: 'Pull your existing bookings into one dashboard — free, no fee.' },
      { n: 'Contract-on-Record', b: 'Upload each contract to a timestamped, per-event paper trail.' },
      { n: 'Automated Bookings', soon: true, b: 'Inquiries flow into a live pipeline with quotes and milestones auto-attached.' },
      { n: 'One-Tap RA 8792 Contracts', soon: true, b: 'Pull a clause, fill, and both e-sign in-app — no printing.' },
      { n: 'Change-Order Trail', soon: true, b: 'Mid-plan add-ons become logged, both-acknowledged change orders with amount and deadline.' },
      { n: 'Day-Of Run-of-Show & Handover', soon: true, b: 'A shared minute-by-minute timeline; mark the gallery delivered against the booking.' },
    ],
  },
  {
    h: 'Money & payments',
    items: [
      { n: '0% Commission, Forever', b: 'Keep every peso — we never take a cut, on or off platform.' },
      { n: 'GCash or Bank, Your Call', b: 'Couples pay you directly to your GCash/BDO — we never hold your money.' },
      { n: 'Set Your Price Once', b: 'Publish packages and rates once; they power every quote you send.' },
      { n: 'PH-Style Milestone Tracking', b: 'Log reservation to progress to balance with proof, the way PH couples pay.' },
      { n: 'Deposit Reservation, Lock-Free', b: 'A recorded deposit holds the date; the money settles straight to you.' },
      { n: 'No-Show Downpayment Protection', b: 'A frozen, couple-agreed cancellation policy makes a forfeited downpayment defensible.' },
      { n: 'Payday Calendar & Cash-Flow View', b: 'Every upcoming milestone due-date across all booked events on one timeline.' },
    ],
  },
  {
    h: 'Trust, reputation & anti-fraud',
    items: [
      { n: 'Verified Badge, Free', b: 'Pass a 12-doc check free — no copycat can fake your official page.' },
      { n: 'Fair Merit-Based Rating', b: 'A Bayesian score protects new vendors — stars are earned, never bought.' },
      { n: 'Automated Self-Review Blocker', b: 'The system detects and blocks fake self-reviews before they post.' },
      { n: 'Receipt-Backed Reviews', b: 'Every rating carries a real \'booked through Setnayan\' verified mark.' },
      { n: 'Right-of-Reply on Reviews', b: 'Post one public, professional reply under any review — your side shows.' },
      { n: 'Flag a Suspicious Review', b: 'Flag a fake or unfair review; HQ reviews it within 48 hours.' },
      { n: 'Merit-Only Ranking', b: 'No pay-to-rank — you can\'t buy your way up, and neither can rivals.' },
      { n: 'No Fake Reviews, No Ghost Listings', soon: true, b: 'We screen bought reviews and ghost listings — protecting honest vendors most.' },
      { n: 'Stand-Up-for-Yourself Dispute Mediation', soon: true, b: 'A neutral team reviews the record before anything touches your rating.' },
      { n: 'Reverse-Image Theft Watch', b: 'Reposts of your portfolio get flagged as yours across the platform.' },
    ],
  },
  {
    h: 'Marketing, exposure & editorial',
    items: [
      { n: 'Search-Ready Vendor Microsite', b: 'A clean public profile built to rank on Google and inside Setnayan.' },
      { n: 'Off-Season Promo Surfacing', b: 'We flag your lean months so your off-peak deal gets surfaced to couples.' },
      { n: 'Auto-Shared to Our Socials', soon: true, b: 'Your couples\' standout moments hit our FB/IG with your name and logo.' },
      { n: 'Featured in Real Wedding Stories', soon: true, b: 'A loved event becomes a published Real Story crediting your work, with a backlink.' },
      { n: 'Editorial & Journal Spotlights', soon: true, b: 'Featured in the Journal couples read while planning — in front of buyers at intent.' },
      { n: 'Reply-Time Stats & Spotlight Awards', soon: true, b: 'Top performers earn a Spotlight badge plus a homepage feature money can\'t buy.' },
      { n: 'Style-Twin Discovery from Real Stories', soon: true, b: 'Couples who love a Real Story tap through to the vendors who made it.' },
      { n: 'Couple Referral Rewards', soon: true, b: 'Happy couples refer; when their referral books you, both get a perk.' },
    ],
  },
  {
    h: 'Data, analytics & pricing intelligence',
    items: [
      { n: 'Quote-to-Booking Funnel', b: 'See views to inquiries to signed, plus every booking\'s source.' },
      { n: 'Price-Position Meter', b: 'Know if you\'re under-priced, on-market, or premium for your category.' },
      { n: 'Demand Radar (Dates, Regions & Styles)', b: 'See which dates, regions, and looks couples book hardest.' },
      { n: 'Won & Lost Reasons', b: 'See why couples said yes or walked, and fix the real leak.' },
      { n: 'Peso-Per-Lead Scorecard', b: 'See the true cost of each booked couple vs your spend.' },
      { n: 'Your Own Funnel Metrics', b: 'Track reply rate, average reply time, and inquiry-to-booking live.' },
      { n: 'Category Benchmarks vs Peers', soon: true, b: 'Rank your funnel against anonymized peers in your exact category.' },
      { n: 'Profile Score & Fix-It Tips', b: 'Get a ranked checklist of what\'s holding your profile back.' },
    ],
  },
  {
    h: 'Ecosystem, crew & growth',
    items: [
      { n: 'Team Sub-Accounts', b: 'Give each crew member a login scoped to their services — no shared passwords.' },
      { n: 'One Clean Business Identity', b: 'Crew act under one verified profile — you look like a real studio.' },
      { n: 'Pull a Vetted Crew Hand', b: 'Short a shooter or coordinator? Book a vetted hand at a posted PH rate.' },
      { n: 'One Profile, Every Life Event', soon: true, b: 'Reviews, calendar and history carry across weddings, debuts, christenings and more.' },
      { n: 'Earn On Your Crew', soon: true, b: 'Post your second shooters and HMUA — earn a referral cut when they\'re booked.' },
      { n: 'Resell Setnayan Productions', soon: true, b: 'Bundle Papic, Live Studio, monogram or Pakanta into your own quote.' },
      { n: 'White-Label Couple Tools', soon: true, b: 'Hand couples the seating chart, mood board and schedule under your brand.' },
      { n: 'Setnayan-Certified Partner', soon: true, b: 'Get badged to deliver in-app services; couples who bought them route to you.' },
      { n: 'Pay Only For Inquiries That Fit', b: 'Charged only for matched, intent-qualified inquiries — never junk.' },
    ],
  },
];
