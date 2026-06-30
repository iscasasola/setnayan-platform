/**
 * Vendor-benefits catalog for the "For vendors" overlay.
 *
 * Ported from the prototype's `ovVendors` overlay (source catalog:
 * `03_Strategy/Vendor_Benefits_Catalog_2026-06-29.md`). `soon` marks a benefit
 * still in active build — the tag clears as each ships.
 *
 * 2026-06-30 SHIPPED-STATE AUDIT (supersedes the 2026-06-29 "keep everything
 * Soon" default): a 4-pass code audit of `app/vendor-dashboard/*`, `app/v/[slug]`,
 * `app/explore`, and `lib/*` confirmed many benefits are now genuinely live
 * end-to-end, so their `soon` tags were cleared. A benefit only loses `soon`
 * when it has a real couple-visible/vendor-usable surface wired to actions+DB —
 * NOT when only the infrastructure exists. Kept `soon` (with reason) where the
 * feature is partial, manual-only, economically inert in the pilot, empty
 * pre-launch, or not built:
 *   - "Only the leads that fit" / "Pay only for inquiries that fit" / "Peso-per-lead":
 *     token-burn is economically INERT in the pilot (lib/v2/region-token-burn.ts
 *     "Does NOT charge anything") — vendors aren't actually charged yet.
 *   - "Run it all in one place" / "One-tap RA 8792 contracts" / "Contract-on-record":
 *     contracts are UPLOAD-ONLY today; in-app e-sign is not built.
 *   - "Automated bookings" / "Headcount that quotes itself": no inquiry→quote→
 *     milestone pipeline state machine / live re-quote yet.
 *   - "Style-twin discovery" / "Featured in Real Wedding stories" / "Editorial &
 *     Journal spotlights" / "Spotlight awards": surfaces built but empty
 *     pre-launch and/or backlinks are generic category links (no SEO value yet),
 *     awards not rendered on the homepage yet.
 *   - "Auto-shared to our socials": FB+IG auto-publish is live for COUPLE
 *     creations, but vendor-credited auto-share is limited and TikTok is not wired.
 *   - "One profile, every life event": multi-event-type tags exist but reviews/
 *     history are not pooled across event types yet.
 *   - "No-show downpayment protection" / "Reverse-image theft watch" /
 *     "Profile score" / "Won & lost reasons" / "White-label couple tools" /
 *     "Couple referral rewards": not built.
 * 2026-06-30 (b) — further `soon` clears after their features shipped:
 *   - "Change-order trail" (PR #2403) + "Day-of run-of-show" (PR #2411) both
 *     merged ~6h before the (a) audit ran but were missed by it — live surfaces
 *     in the couple↔vendor workspace + vendor clients page.
 *   - "Date-open priority" — the existing vendor calendar availability
 *     (vendor_calendar_blocks via lib/vendor-availability.ts) is now wired into
 *     the couple-facing Explore render order: vendors free on the couple's date
 *     window rank above vendors already booked that date (app/explore/page.tsx).
 *   - "Resell Setnayan Productions": vendor can recommend add-ons, not yet
 *     resell/bundle into a quote.
 *   - "Crew-rate marketplace": the "pull a vetted hand" half (Manpower gigs) is
 *     live; the "earn a cut on your crew" half is not — kept Soon.
 *   - "Setnayan-certified partner": partnership infra exists but is not
 *     couple-facing routing yet.
 *   - "No pay-to-rank, no fake reviews" / "Dispute mediation": fraud screening is
 *     a manual flag→HQ queue only (no automated pipeline) — kept Soon.
 * NOTE (owner sign-off): two items couples might expect are NOT real benefits
 * today and were intentionally NOT added — a vendor "direct invite QR" to bring a
 * customer in does not exist, and customer import is token-gated (1 token, thin
 * calendar block), NOT a free CRM import.
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
        b: 'Found by the rites you serve — Catholic, Muslim, Chinese/Tsinoy, Mixed and more — and the provinces your crew covers.',
      },
      { n: 'Date-open priority', b: 'Couples filter for who’s free; a current calendar ranks you up.' },
      { n: 'Lead capture + matchmaking', b: 'Every couple who finds you is a captured, well-fitted lead.' },
      { n: 'Shortlist radar', b: 'See who saved you; get alerted when a rival enters your date.' },
      { n: 'First-look window', b: 'Reply fast → a head-start slot in front of new couples.' },
      { n: 'Booked-out waitlist', b: 'Fully booked? Couples wait instead of bouncing.' },
      { n: 'Style-twin discovery', soon: true, b: 'Real Stories send look-alike couples to your past work.' },
    ],
  },
  {
    h: 'Booking, contracts & operations',
    items: [
      { n: 'Automated bookings', soon: true, b: 'Inquiries become a real pipeline with quotes + milestones.' },
      { n: 'Ultimate team calendar', b: 'One calendar across every service and crew member.' },
      { n: 'Headcount that quotes itself', soon: true, b: 'Quotes auto-update from the couple’s guest list + your crew.' },
      { n: 'One-tap RA 8792 contracts', soon: true, b: 'Pull, fill, e-sign in-app — legally valid, no printing.' },
      { n: 'Deposit reservation, lock-free', soon: true, b: 'A recorded deposit holds the date; the money goes to you.' },
      { n: 'Double-booking guard', b: 'A held slot blocks a second booking, per service + role.' },
      { n: 'Change-order trail', b: 'Mid-plan changes become logged, acknowledged orders.' },
      { n: 'Day-of run-of-show', b: 'A shared live timeline + a clean delivery handover.' },
    ],
  },
  {
    h: 'Money & payments',
    items: [
      { n: 'Set your price once', b: 'Packages + rates power every quote you send.' },
      {
        n: 'GCash or bank, your call',
        b: 'Couples pay you directly to your GCash/BDO — we never hold your money, never take a cut.',
      },
      {
        n: 'PH-style milestone tracking',
        b: 'Log reservation → progress → balance with proof, the way PH couples pay.',
      },
      { n: 'No-show downpayment protection', soon: true, b: 'A documented, defensible cancellation policy.' },
      { n: 'Payday calendar', b: 'Every milestone due-date on one cash-flow timeline.' },
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
      { n: 'Receipt-backed reviews', b: 'Every star is a real “booked through Setnayan” client.' },
      { n: 'Right-of-reply on reviews', b: 'One public, professional reply under any review.' },
    ],
  },
  {
    h: 'Marketing, exposure & editorial',
    items: [
      { n: 'Search-ready microsite', b: 'A profile built to rank on Google and inside Setnayan.' },
      { n: 'Auto-shared to our socials', soon: true, b: 'Your couples’ moments hit our FB/IG/TikTok with your name.' },
      { n: 'Featured in Real Wedding stories', soon: true, b: 'Credited beside the photos, with a permanent backlink.' },
      { n: 'Editorial & Journal spotlights', soon: true, b: 'In front of buyers at the exact moment of intent.' },
      { n: 'Spotlight awards', soon: true, b: 'Top performers earn a homepage feature money can’t buy.' },
      { n: 'Off-season promos', b: 'We flag lean months so your offer gets surfaced.' },
      { n: 'Couple referral rewards', soon: true, b: 'Happy couples refer; both get a perk, tracked in-app.' },
    ],
  },
  {
    h: 'Data, analytics & pricing intelligence',
    items: [
      { n: 'Category benchmarks', b: 'Your funnel vs anonymized peers in your exact category.' },
      { n: 'Profile score & fix-it tips', soon: true, b: 'What’s holding you back, ranked by inquiry lift.' },
      { n: 'Price-position meter', b: 'Under-priced, on-market, or premium for your category.' },
      { n: 'Demand radar', b: 'Which dates, regions, and looks couples book hardest.' },
      { n: 'Won & lost reasons', soon: true, b: 'Why couples said yes or walked — fix the real leak.' },
      { n: 'Quote-to-booking funnel', b: 'Where couples drop off + each booking’s source.' },
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
      { n: 'Team sub-accounts', b: 'Scoped logins for crew; one clean business identity.' },
      { n: 'Resell Setnayan Productions', soon: true, b: 'Bundle Papic, Live Studio, monogram, or Pakanta into your quote.' },
      { n: 'White-label the couple tools', soon: true, b: 'Hand couples the seating, mood board & schedule under your brand.' },
      { n: 'Crew-rate marketplace', soon: true, b: 'Earn a cut on your crew, or pull a vetted hand at a posted rate.' },
      { n: 'Setnayan-certified partner', soon: true, b: 'Get badged to deliver in-app services; couples routed to you.' },
    ],
  },
];
