/**
 * Vendor-benefits catalog for the "For vendors" overlay.
 *
 * Ported from the prototype's `ovVendors` overlay (source catalog:
 * `03_Strategy/Vendor_Benefits_Catalog_2026-06-29.md`). `soon` marks a benefit
 * still in active build — the tag clears as each ships (owner 2026-06-29: keep
 * everything "Soon" except the two live business-model facts: 0% commission +
 * free listing/verification).
 */

export type VendorHeroCard = {
  ic: string;
  title: string;
  soon?: boolean;
  body: string;
};

export const VENDOR_HERO_CARDS: VendorHeroCard[] = [
  {
    ic: '⊘',
    title: '0% commission, forever',
    body: 'Couples pay you directly. You keep 100% — we never take a cut, on or off platform.',
  },
  {
    ic: '✓',
    title: 'Free to list & verify',
    body: 'A free business profile and a free verified badge — no fee just to be here.',
  },
  {
    ic: '◎',
    title: 'Faith & region matchmaking',
    soon: true,
    body: 'Matched by the rites you serve — Catholic, Muslim, Chinese/Tsinoy, Mixed — and where your crew travels.',
  },
  {
    ic: '▦',
    title: 'One profile, every life event',
    soon: true,
    body: 'Weddings, debuts, christenings, corporate and more — your reviews and history carry into each.',
  },
  {
    ic: '◆',
    title: 'Run it all in one place',
    soon: true,
    body: 'Bookings, quotes, RA 8792 e-contracts, calendar, clients, threads — one dashboard.',
  },
  {
    ic: '⌖',
    title: 'Only the leads that fit',
    soon: true,
    body: 'Charged only for matched, intent-qualified inquiries — never junk, never to merely exist.',
  },
];

export type VendorBenefit = { n: string; soon?: boolean; b: string };
export type VendorGroup = { h: string; items: VendorBenefit[] };

export const VENDOR_GROUPS: VendorGroup[] = [
  {
    h: 'Discovery & lead quality',
    items: [
      { n: '0% commission, forever', b: 'Keep every peso — we never take a cut, on or off platform.' },
      {
        n: 'Faith & region matchmaking',
        soon: true,
        b: 'Found by the rites you serve — Catholic, Muslim, Chinese/Tsinoy, Mixed and more — and the provinces your crew covers.',
      },
      { n: 'Date-open priority', soon: true, b: 'Couples filter for who’s free; a current calendar ranks you up.' },
      { n: 'Lead capture + matchmaking', soon: true, b: 'Every couple who finds you is a captured, well-fitted lead.' },
      { n: 'Shortlist radar', soon: true, b: 'See who saved you; get alerted when a rival enters your date.' },
      { n: 'First-look window', soon: true, b: 'Reply fast → a head-start slot in front of new couples.' },
      { n: 'Booked-out waitlist', soon: true, b: 'Fully booked? Couples wait instead of bouncing.' },
      { n: 'Style-twin discovery', soon: true, b: 'Real Stories send look-alike couples to your past work.' },
    ],
  },
  {
    h: 'Booking, contracts & operations',
    items: [
      { n: 'Automated bookings', soon: true, b: 'Inquiries become a real pipeline with quotes + milestones.' },
      { n: 'Ultimate team calendar', soon: true, b: 'One calendar across every service and crew member.' },
      { n: 'Headcount that quotes itself', soon: true, b: 'Quotes auto-update from the couple’s guest list + your crew.' },
      { n: 'One-tap RA 8792 contracts', soon: true, b: 'Pull, fill, e-sign in-app — legally valid, no printing.' },
      { n: 'Deposit reservation, lock-free', soon: true, b: 'A recorded deposit holds the date; the money goes to you.' },
      { n: 'Double-booking guard', soon: true, b: 'A held slot blocks a second booking, per service + role.' },
      { n: 'Change-order trail', soon: true, b: 'Mid-plan changes become logged, acknowledged orders.' },
      { n: 'Day-of run-of-show', soon: true, b: 'A shared live timeline + a clean delivery handover.' },
    ],
  },
  {
    h: 'Money & payments',
    items: [
      { n: 'Set your price once', soon: true, b: 'Packages + rates power every quote you send.' },
      {
        n: 'GCash or bank, your call',
        soon: true,
        b: 'Couples pay you directly to your GCash/BDO — we never hold your money, never take a cut.',
      },
      {
        n: 'PH-style milestone tracking',
        soon: true,
        b: 'Log reservation → progress → balance with proof, the way PH couples pay.',
      },
      { n: 'No-show downpayment protection', soon: true, b: 'A documented, defensible cancellation policy.' },
      { n: 'Payday calendar', soon: true, b: 'Every milestone due-date on one cash-flow timeline.' },
    ],
  },
  {
    h: 'Trust, reputation & anti-fraud',
    items: [
      { n: 'Verified badge, free', b: 'A 12-doc check; no copycat can fake your official page.' },
      { n: 'No pay-to-rank, no fake reviews', soon: true, b: 'We screen fraud — which protects honest vendors most.' },
      { n: 'Dispute mediation', soon: true, b: 'A neutral team reviews the record before your rating moves.' },
      { n: 'Contract-on-record protection', soon: true, b: 'A timestamped, RA 8792-valid paper trail.' },
      { n: 'Reverse-image theft watch', soon: true, b: 'Reposts of your portfolio get flagged as yours.' },
      { n: 'Receipt-backed reviews', soon: true, b: 'Every star is a real “booked through Setnayan” client.' },
      { n: 'Right-of-reply on reviews', soon: true, b: 'One public, professional reply under any review.' },
    ],
  },
  {
    h: 'Marketing, exposure & editorial',
    items: [
      { n: 'Search-ready microsite', soon: true, b: 'A profile built to rank on Google and inside Setnayan.' },
      { n: 'Auto-shared to our socials', soon: true, b: 'Your couples’ moments hit our FB/IG/TikTok with your name.' },
      { n: 'Featured in Real Wedding stories', soon: true, b: 'Credited beside the photos, with a permanent backlink.' },
      { n: 'Editorial & Journal spotlights', soon: true, b: 'In front of buyers at the exact moment of intent.' },
      { n: 'Spotlight awards', soon: true, b: 'Top performers earn a homepage feature money can’t buy.' },
      { n: 'Off-season promos', soon: true, b: 'We flag lean months so your offer gets surfaced.' },
      { n: 'Couple referral rewards', soon: true, b: 'Happy couples refer; both get a perk, tracked in-app.' },
    ],
  },
  {
    h: 'Data, analytics & pricing intelligence',
    items: [
      { n: 'Category benchmarks', soon: true, b: 'Your funnel vs anonymized peers in your exact category.' },
      { n: 'Profile score & fix-it tips', soon: true, b: 'What’s holding you back, ranked by inquiry lift.' },
      { n: 'Price-position meter', soon: true, b: 'Under-priced, on-market, or premium for your category.' },
      { n: 'Demand radar', soon: true, b: 'Which dates, regions, and looks couples book hardest.' },
      { n: 'Won & lost reasons', soon: true, b: 'Why couples said yes or walked — fix the real leak.' },
      { n: 'Quote-to-booking funnel', soon: true, b: 'Where couples drop off + each booking’s source.' },
      { n: 'Peso-per-lead scorecard', soon: true, b: 'True cost of each booked couple vs your spend.' },
    ],
  },
  {
    h: 'Ecosystem, crew & growth',
    items: [
      { n: 'Pay only for inquiries that fit', soon: true, b: 'Charged only for matched intent — never junk, never to exist.' },
      {
        n: 'One profile, every life event',
        soon: true,
        b: 'One listing across weddings, debuts, birthdays, christenings, corporate and more — your reviews + history carry into each.',
      },
      { n: 'Team sub-accounts', soon: true, b: 'Scoped logins for crew; one clean business identity.' },
      { n: 'Resell Setnayan Productions', soon: true, b: 'Bundle Papic, Live Studio, monogram, or Pakanta into your quote.' },
      { n: 'White-label the couple tools', soon: true, b: 'Hand couples the seating, mood board & schedule under your brand.' },
      { n: 'Crew-rate marketplace', soon: true, b: 'Earn a cut on your crew, or pull a vetted hand at a posted rate.' },
      { n: 'Setnayan-certified partner', soon: true, b: 'Get badged to deliver in-app services; couples routed to you.' },
    ],
  },
];
