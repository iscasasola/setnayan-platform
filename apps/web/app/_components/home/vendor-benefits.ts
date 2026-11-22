/**
 * Vendor-benefits catalog for the "For vendors" overlay — organized BY ACCOUNT
 * TYPE (owner 2026-07-01): Free → Supplier Plus → Pro → Ultra, each tier
 * showing what it ADDS on top of the one below. Mirrors the tier ladder on
 * /vendors and the hybrid gating decision in VENDOR_TIERS_AND_BENEFITS.md
 * (§2 allocation + §6 as-built). `soon` = not yet live end-to-end; it clears as
 * the vendor-dashboard session ships. Keep the tier assignments in step with the
 * doc + the coded caps in lib/vendor-tier-caps.ts.
 */
import { REQUIRED_DOC_COUNT } from '@/lib/vendor-verification';
import { formatCount } from '@/lib/format-number';

import { supplierCommissionShort, supplierCommissionPromise } from '@/lib/commission-promise';
import { PORTFOLIO_FREE_BASE, TIER_CAPS } from '@/lib/vendor-tier-caps';
import { storageWords } from '@/lib/downgrade-limits';
import { planRole, planSummaryWords } from '@/lib/supplier-storage';

/** A plan's size in words. `null` is only the type's "unreadable row" — every plan has a size — so it never invents one. */
const sizeWords = (bytes: number | null): string => (bytes == null ? 'Your storage' : storageWords(bytes));

/*
 * 📐 PLAN ALLOWANCES ARE READ, NEVER TYPED (owner 2026-11-04, DECISION_LOG "SUPPLIER PLAN ALLOWANCES" + "BRANCHES PER
 * PLAN"). Every category / card / seat / branch / waitlist number below is a `TIER_CAPS` read, so the next
 * ruling moves these lines with the table. Before this, "3 seats", "Three categories + 50 km", "Up to 10 team seats"
 * and "Reach up to 100 km" were typed here and went stale the day the owner moved them.
 */
const many = (n: number, one: string, more: string) => (n === 1 ? `${n} ${one}` : `${n} ${more}`);

export type VendorTier = 'free' | 'solo' | 'pro' | 'enterprise';

export type VendorBenefit = { n: string; soon?: boolean; b: string };
export type VendorTierGroup = { h?: string; items: VendorBenefit[] };
export type VendorTierSection = {
  tier: VendorTier;
  name: string;
  /** One-line "what this tier is for". */
  tagline: string;
  groups: VendorTierGroup[];
  // NOTE: prices are NOT stored here — the overlay resolves each tier's 28-day +
  // annual price from the live catalog (getVendorPrices via PricingData.vendor)
  // so a catalog reprice propagates without a code edit (never hardcode prices).
};

export const VENDOR_TIER_SECTIONS: VendorTierSection[] = [
  {
    tier: 'free',
    name: 'Free · Verified',
    tagline: 'The whole business: get found, get trusted, get booked. Keep 100%.',
    groups: [
      {
        h: 'Get found',
        items: [
          { n: 'Faith & region matchmaking', b: 'Found by the rites you serve and the provinces your crew covers.' },
          { n: 'Date-open priority', b: 'Free on their date? You rank above suppliers already booked then.' },
          { n: 'Lead capture & matchmaking', b: 'Every couple who finds you is a captured, well-fitted lead.' },
          { n: 'Shortlist radar', b: 'See how many couples saved you; get a rival-in-your-area demand feed.' },
          { n: 'First-look window', b: 'Reply fast, complete your profile, earn a head-start in front of new couples.' },
          { n: 'Pay only for inquiries that fit', b: 'Charged only for matched, intent-qualified inquiries, never junk.' },
        ],
      },
      {
        h: 'Look credible & trusted',
        items: [
          { n: 'Verified badge, free', b: `Send your ${formatCount(REQUIRED_DOC_COUNT)} required papers and take a short video call with our team — free. No copycat can fake your official page.` },
          { n: 'Your public page, auto-built', b: 'A clean, search-ready public page, auto-composed from your profile and live the moment you set an address. Ranks on Google and inside Setnayan.' },
          { n: 'Fair merit-based rating', b: 'A Bayesian score protects new suppliers: stars are earned, never bought.' },
          { n: 'Receipt-backed reviews', b: 'Every rating carries a real “booked through Setnayan” verified mark.' },
          { n: 'Right-of-reply on reviews', b: 'Post one public, professional reply under any review. Your side shows.' },
          { n: 'Earned badges & experience tier', b: 'New / Verified / Top Pick / Most Booked, plus your years-in-business badge.' },
          { n: '“Recommended by N couples”', b: 'Real couples vouch for you, counted on your profile.' },
          { n: 'Self-review blocker', b: 'The system detects and blocks fake self-reviews before they post.' },
          { n: 'Flag a suspicious review', b: 'Flag a fake or unfair review; HQ reviews it within 48 hours.' },
          { n: 'Merit-only ranking', b: 'No pay-to-rank. You can’t buy your way up, and neither can rivals.' },
          { n: 'Stand-up-for-yourself dispute mediation', soon: true, b: 'A neutral team reviews the record before anything touches your rating.' },
        ],
      },
      {
        h: 'Bring your business with you',
        items: [
          { n: 'Import past clients free', b: 'Pull your existing bookings into one dashboard: free, no fee.' },
          { n: 'Past weddings become reviews', b: 'Your old clients confirm and leave a verified review.' },
          { n: 'Claim-QR + “verified wedding” pill', b: 'A one-scan claim turns a past event into proof on your profile.' },
        ],
      },
      {
        h: 'Run every booking',
        items: [
          // ⚖ PLANS PRICE REACH, NEVER INCOME (owner 2026-10-23). Everything that leads to a booking is on every
          // plan, so these four live on Free and no paid tier re-sells them. Numbers read from the plan table.
          { n: 'Answer every couple', b: 'No weekly limit on answering, on any plan.' },
          { n: 'Take as many bookings a day as you set', b: 'Your own number, per calendar and per service card. No plan limit.' },
          { n: `${many(TIER_CAPS.verified.serviceCardsTotal, 'service card', 'service cards')} live`, b: `Make as many service cards as you like. Show ${many(TIER_CAPS.verified.serviceCardsTotal, 'card', 'cards')} to couples once you’re verified.` },
          // 🔓 Reach is not a plan allowance (owner 2026-11-19): once verified, every plan sets its own.
          { n: 'Set your own reach', b: 'Once you’re verified, you choose how far you go — on every plan. Until then couples reach you by your own link and QR.' },
          { n: `${PORTFOLIO_FREE_BASE} portfolio photos, free`, b: `Your first ${PORTFOLIO_FREE_BASE} portfolio photos are free on every plan.` },
          { n: 'One supplier dashboard', b: 'Run bookings, calendar, clients, threads and quotes from one place.' },
          { n: 'Shared team calendar', b: 'One calendar across every service and crew member.' },
          { n: 'Double-booking guard', b: 'A held date blocks a second booking, scoped per service and role.' },
          { n: 'Send package quotes', b: 'Draft, save and send quotes with package line items to booked couples.' },
          { n: 'Headcount that quotes itself', b: 'Catering covers auto-compute from the couple’s live guest list.' },
          { n: 'Bookings pipeline', b: 'Accepted inquiries become tracked booking items on the event.' },
          { n: 'Contract-on-record', b: 'Upload each contract to a timestamped, per-event paper trail.' },
          { n: 'Automated bookings', b: 'Inquiries flow into a live pipeline with quotes and milestones auto-attached.' },
          { n: 'Change-order trail', b: 'Mid-plan add-ons become logged, both-acknowledged change orders.' },
          { n: 'Day-of run-of-show & handover', b: 'A shared minute-by-minute timeline; mark the photos delivered.' },
        ],
      },
      {
        h: 'Get paid your way',
        items: [
          // Was '0% commission at launch' with a HAND-TYPED 5% / 1% / ₱100,000 —
          // two ways to go stale in one row, and the launch half was already
          // false the day a supplier was billed ₱837.50. Both derive now.
          // A module constant has no render to read the live schedule in, so it
          // names the fee WITHOUT a rate (null) rather than printing the code
          // default (audit 2026-10-12, item 5). Pages that can read the live
          // rate print it beside this — the /for-suppliers matrix footer.
          { n: supplierCommissionShort(null), b: supplierCommissionPromise(null) },
          { n: 'GCash or bank, your call', b: 'Couples pay you directly to your GCash/BDO. We never hold your money.' },
          { n: 'Set your price once', b: 'Publish packages and rates once; they power every quote you send.' },
          { n: 'PH-style milestone tracking', b: 'Log reservation → progress → balance with proof, the way PH couples pay.' },
          { n: 'Reserve with a first payment, lock-free', b: 'A recorded first payment holds the date; the money settles straight to you.' },
          { n: 'No-show first payment protection', b: 'A frozen, couple-agreed cancellation policy makes a forfeited first payment defensible.' },
          { n: 'Money in calendar & cash-flow view', b: 'Every upcoming milestone due-date across all booked events on one timeline.' },
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
          { n: 'Credited to guests on the day', b: 'You’re shown as one of “the suppliers who made this day”.' },
          { n: 'Appear in the couple’s planner + budget', b: 'You sit inside the couple’s planning workspace, not just search.' },
          { n: 'Off-season promo surfacing', b: 'We flag your lean months so your off-peak deal gets surfaced.' },
          { n: 'Pull a vetted crew hand', b: 'Short a shooter or coordinator? Book a vetted hand at a posted PH rate.' },
          { n: 'Auto-shared to our socials', b: 'Your couples’ standout moments hit our FB/IG with your name and logo.' },
          { n: 'Couple referral rewards', soon: true, b: 'Happy couples refer; when their referral books you, both get a perk.' },
        ],
      },
    ],
  },
  {
    // 💾 Owner 2026-11-22, DECISION_LOG "SUPPLIER PLANS MIRROR ICLOUD+: ONE PRODUCT, SAME FEATURES IN EVERY SIZE" +
    // "STARTER BUSINESS": every paid size has every feature; only storage differs, and Plus keeps its starter limits.
    // So every feature row lives here, under the first paid size, and Pro and Ultra add only room and no limits.
    tier: 'solo',
    name: 'Plus',
    tagline: `${planRole('solo')}: ${planSummaryWords('solo')}. Everything in Free, plus:`,
    groups: [
      {
        h: 'Your size',
        items: [
          { n: `${sizeWords(TIER_CAPS.solo.storageBytes)} for your files`, b: 'Photos, videos, albums and documents in one place. Storage is what the plans are sold by.' },
          { n: `${many(TIER_CAPS.solo.serviceCardsTotal, 'service card', 'service cards')} live · every category`, b: `List under every category you serve. Make as many service cards as you like, with up to ${many(TIER_CAPS.solo.serviceCardsTotal, 'card', 'cards')} live.` },
          { n: `You and ${formatCount(TIER_CAPS.solo.agentAccounts)} more · multi-admin`, b: 'Give each helper their own login, scoped to their services, and share admin with a partner.' },
        ],
      },
      {
        h: 'Every feature',
        items: [
          { n: 'Your own web address', b: 'Point your own domain at your Setnayan page.' },
          { n: 'Personalize your public page', b: 'Add an About intro, pick an accent colour, feature your top services, and choose which sections show. Your page, your look.' },
          { n: 'Premium two-column page', b: 'A wide, editorial layout with a sticky “Inquire” rail, a hero photo, a pinned review, and your featured Stories.' },
          { n: 'Flagship page + video films', b: 'A cinematic hero with your name over your best photo, plus a playable “Films” reel. Link your YouTube highlight videos and couples watch them right on your page.' },
          { n: 'Custom slug + full written reviews', b: 'Your own /your-name URL, and the full text of every review on show.' },
          { n: 'One clean business identity', b: 'Crew act under one verified profile, you look like a real studio.' },
          { n: 'Quote-to-booking funnel', b: 'See views → inquiries → signed over time, plus every booking’s source.' },
          { n: 'Won & lost reasons', b: 'See why couples said yes or walked, and fix the real leak.' },
          { n: 'Your own funnel metrics', b: 'Track reply rate, average reply time, and inquiry-to-booking live.' },
          { n: 'Earnings dashboard', b: 'Year-to-date revenue, monthly subtotals and scheduled payouts in one view.' },
          { n: 'Market Intelligence — category benchmarks vs peers', b: 'Rank your funnel against anonymized peers in your exact category. Numbers fill in as category volume grows.' },
          { n: 'Demand Radar', b: 'See where demand is building in your market, by month and by the looks couples choose.' },
          { n: 'Booked-out waitlist', b: 'Fully booked? Couples wait instead of bouncing — you choose how many to take off it per date, so a cancellation becomes a recovered booking.' },
          { n: 'Reverse-image theft watch', b: 'Reposts of your portfolio get flagged as yours across the platform.' },
          { n: 'Recap sharing', b: 'One-tap share of every wedding you helped create, straight to your Facebook Page.' },
          { n: 'Featured in Stories', b: 'A loved event becomes a published Story crediting your work, with a backlink.' },
          { n: 'Editorial & article spotlights', b: 'Featured in the articles couples read while planning, in front of buyers at intent.' },
          { n: 'Logo on the couple’s 3D seat plan', b: 'Your brand mark rides along on the couple’s 3D seat plan — quiet credit in front of every guest who opens it. Included.' },
          // ⛔ SEVEN "soon" ROWS RETIRED 2026-11-05 (owner: "retire this") — nothing was behind them. A "soon" label is
          // not a licence to advertise an unstarted thing.
          { n: 'Reply-time stats & Spotlight awards', soon: true, b: 'Top performers earn a Spotlight badge plus a homepage feature.' },
          { n: 'Priority support', b: 'Move to the front of the support queue.' },
          // ⛔ TWO ROWS WERE DELETED 2026-08-27 (owner ruling): "Quarterly business review" and "a named contact"
          // promised human attention that does not exist. What DOES exist is queue ORDERING: /admin/disputes surfaces
          // paid plans first. That is real, so it is the only thing claimed — with no response-time promise.
          { n: 'Front-of-line dispute handling', b: 'Disputes from paid plans surface first in our queue.' },
        ],
      },
    ],
  },
  {
    tier: 'pro',
    name: 'Pro',
    tagline: `${planRole('pro')}: ${planSummaryWords('pro')}. Everything in Plus, plus:`,
    groups: [
      {
        items: [
          { n: `${sizeWords(TIER_CAPS.pro.storageBytes)} for your files`, b: 'More room for albums, films and every file you keep.' },
          { n: 'No limit on live service cards', b: 'Show every package you sell, across every category you serve.' },
          { n: 'No limit on people', b: 'Give every crew member a login scoped to their services, no shared passwords.' },
          { n: 'No limit on branches', b: 'Run your other locations under your one registered business, with no branch fee.' },
        ],
      },
    ],
  },
  {
    tier: 'enterprise',
    name: 'Ultra',
    tagline: `${planRole('enterprise')}: ${planSummaryWords('enterprise')}. Everything in Pro, plus:`,
    groups: [
      {
        items: [
          { n: `${sizeWords(TIER_CAPS.enterprise.storageBytes)} for your files`, b: 'The most room for a studio’s albums, films and archives.' },
        ],
      },
    ],
  },
];

/*
 * ⛔ `VENDOR_CUSTOM_TIER` and `customTierDialLabels` were DELETED 2026-11-06 — the Custom supplier plan was retired
 * from the app (owner: *"from the app"*). The way past Ultra is Ultra's add-ons, read from the catalogue.
 */
