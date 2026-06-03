'use client';

/**
 * /onboarding/wedding — Onboarding shell (Phases 1-3 of 5).
 *
 * PROTOTYPE-DIRECT PORT (owner directive 2026-06-02: "port the prototype's
 * actual CSS/HTML, not a Tailwind rewrite"). This mirrors the locked prototype
 * Onboarding_Wedding_Flow_2026-06-01.html one-for-one: the same .onbw > .phone >
 * .top / .body / .bottom chrome, the same .screen sections with verbatim class
 * names, the same gold SETNAYAN mark + progress bar + Continue CTA. The CSS in
 * ../_styles/onboarding.css IS the prototype CSS, scoped under `.onbw`
 * (onboarding-wedding). NOT `.pba` — that generic scope collided with the
 * Services Plan+Budget accordion's own global `.pba` styles (2026-06-03); each
 * surface now owns a unique root class. When re-porting, scope under `.onbw`.
 *
 * What changed vs the prototype: the imperative JS state machine (screens[] +
 * go()/render() + DOM toggles + buildFaith()/buildPax()/buildBudget()/initCal())
 * is re-wired into React state + localStorage resume. Behaviour is identical:
 *   - .active toggles by step index
 *   - Civil weddings skip the faith screen (index 3)
 *   - faith adapts to kind (single-pick Religious · pick-2 Mixed · note for Civil)
 *   - name screen: live monogram from the couple's names + Frame/Font cyclers
 *   - date screen: 2-mode calendar (specific 1-4 dates within a 90-day cluster ·
 *     flexible window ≤30 days) + the why-this-date nugget
 *   - region screen: top-5 + "Somewhere else" expand + 13 more + per-region nugget
 *   - pax screen: slider (10-500) + always-on exact box (any number) + tier photo
 *   - budget screen: feel-band chips + a look photo keyed to pax-tier × band
 *   - picker screen: 53 services grouped by the 10 parents + sticky preview +
 *     budget-appropriate auto-highlight (essentials first, scaling with budget)
 *   - style sub-stepper: one focused screen per picked dimension (reception ·
 *     ceremony · catering · photo/video · music · palette) · multi-pick photo
 *     cards · the 100-song picker · faith dietary pre-lock · budget-tiered feel photo
 *
 * Phases 1-3 ship screens 0-10 (welcome…prefs). Captured DATA is lifted into the
 * persisted OnboardingState (ephemeral UI state stays local); no DB write until
 * Phase 4's account-or-skip commit. Route stays noindex + unlinked until Phase 5.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import '../_styles/onboarding.css';
// Phase-5 cutover: the lazy DB commit + the existing auth server actions reused
// at the account gate (no new auth code — same OAuth/signup the marketing site uses).
import {
  commitOnboardingWedding,
  searchOnboardingReceptionVenues,
  getOnboardingVendorCounts,
  type OnboardingCommitPayload,
  type OnboardingVenueResult,
} from '../actions';
import { signInWithGoogle, signInWithFacebook } from '@/app/auth/oauth-actions';
import { signUp } from '@/app/signup/actions';
import {
  EMPTY_ONBOARDING_STATE,
  FLOW_TOTAL,
  ONBOARDING_DRAFT_KEY,
  ONBOARDING_DRAFT_TTL_DAYS,
  type OnboardingFaith,
  type OnboardingKind,
  type OnboardingRole,
  type OnboardingState,
} from '../types';

/* Full 15-screen flow (welcome..budget..picker..prefs..account..find..congrats..plan). */
const PHASE_SCREENS = 15;

/* Primary-button label per screen (prototype nextLabel[]). Index 10 (prefs) is
 * overridden at render time by the sub-stepper ("Continue" / "Looks good"); index
 * 14 (plan) flips to "Continue to checkout" once the bundle is added. */
const NEXT_LABEL = ['Let’s go', 'Continue', 'Continue', 'Continue', 'Continue', 'Continue', 'Continue', 'Continue', 'Continue', 'Continue', 'Continue', 'Create account', 'Continue', 'Continue', 'Done'];
/* Which screens show a Skip button (prototype canSkip[]): picker/name/region/account/congrats/plan not skippable, prefs/find are. */
const CAN_SKIP = [false, false, false, true, false, true, false, true, true, false, true, false, true, false, false];

const ASSET = (name: string) => `/onboarding/${name}.webp`;
/* picker per-service photo + prefs photo + bundle thumbnail subdirs (mirror the pax/budget/mono pattern). */
const PICKER_ASSET = (key: string) => `/onboarding/picker/${key}.webp`;
const PREFS_ASSET = (key: string) => `/onboarding/prefs/${key}.webp`;
const BUNDLE_ASSET = (key: string) => `/onboarding/bundle/${key}.webp`;

/* Kind → hero photo + caption (prototype setKindPhoto). */
const KIND_PHOTO: Record<OnboardingKind, { img: string; cap: string }> = {
  religious: { img: 'wed_catholic', cap: 'A church wedding' },
  civil: { img: 'wed_civil', cap: 'A city-hall ceremony' },
  mixed: { img: 'wed_mixed', cap: 'A blended celebration' },
};

/* Faith → hero photo + caption (prototype setFaithPhoto, religious mode). */
const FAITH_PHOTO: Record<OnboardingFaith, { img: string; cap: string }> = {
  catholic: { img: 'wed_catholic', cap: 'A Catholic wedding' },
  christian: { img: 'wed_christian', cap: 'A garden Christian wedding' },
  inc: { img: 'wed_inc', cap: 'An INC wedding' },
  muslim: { img: 'wed_muslim', cap: 'A Muslim wedding' },
  cultural: { img: 'wed_cultural', cap: 'A traditional Filipino wedding' },
};

const ROLE_OPTIONS: { value: OnboardingRole; title: string; desc: string }[] = [
  { value: 'bride', title: 'Bride', desc: 'Walking down the aisle.' },
  { value: 'groom', title: 'Groom', desc: 'Waiting at the altar.' },
  { value: 'helper', title: 'Someone helping', desc: 'A parent, planner, or part of the entourage.' },
];

const KIND_OPTIONS: { value: OnboardingKind; title: string; desc: string }[] = [
  { value: 'religious', title: 'Religious', desc: 'One faith — church, mosque, chapel, or temple.' },
  { value: 'civil', title: 'Civil', desc: 'A judge or registrar officiates.' },
  { value: 'mixed', title: 'Mixed', desc: 'Two faith traditions — an interfaith wedding (e.g. Catholic & Muslim).' },
];

/* Reception "setting" pref key (screen-10 multi-pick) → friendly label for the
 * find-vendor heading (step 12). Mirrors actions.ts RECEPTION_TO_VENUE_SETTING. */
const RECEPTION_SETTING_LABEL: Record<string, string> = {
  setting_ballroom: 'Hotel ballroom',
  setting_events_place: 'Events-place',
  setting_heritage: 'Heritage',
  setting_restaurant: 'Restaurant',
  setting_garden: 'Garden',
  setting_beach: 'Beach',
  setting_resort: 'Resort',
};

// All faiths unlocked (owner-directed 2026-06-03 "unlock all religions").
// Previously catholic-only with the other four behind `soon: true`. The DB
// `wedding_type_launch_status` rows are flipped to 'active' in the same change
// (migration 20260803000000) so create-event mirrors this.
const FAITH_CHIPS: { value: OnboardingFaith; label: string; soon: boolean }[] = [
  { value: 'catholic', label: 'Catholic', soon: false },
  { value: 'christian', label: 'Christian', soon: false },
  { value: 'inc', label: 'INC', soon: false },
  { value: 'muslim', label: 'Muslim', soon: false },
  { value: 'cultural', label: 'Cultural', soon: false },
];

/* ── monogram designs (owner 2026-06-02 — single "Generate another design" cycles
   10 curated {frame + font + ink} presets; replaced the separate Frame/Font cyclers).
   frame → /onboarding/mono/{frame}.webp · font → [data-font] CSS · ink → [data-ink] CSS.
   The couple's live initials render inside; commit derives monogram_frame/font_key from
   the active design. Library set — refine the 10 with the owner's inspirations later. */
type MonoDesign = { frame: string; font: string; ink: string };
const MONO_DESIGNS: MonoDesign[] = [
  { frame: 'wreath', font: 'cormorant', ink: 'mulberry' }, // floral · italic serif · wine
  { frame: 'oval', font: 'playfair', ink: 'ink' },         // oval cartouche · Playfair · ink
  { frame: 'crest', font: 'cinzel', ink: 'gold' },         // heraldic crest · engraved caps · gold
  { frame: 'botanical', font: 'script', ink: 'mulberry' }, // botanical · Great Vibes · wine
  { frame: 'laurel', font: 'cormorant', ink: 'gold' },     // laurel · italic serif · gold
  { frame: 'ribbon', font: 'playfair', ink: 'mulberry' },  // ribbon · Playfair · wine
  { frame: 'flourish', font: 'script', ink: 'ink' },       // flourish · script · ink
  { frame: 'square', font: 'cinzel', ink: 'ink' },         // deco square · caps · ink
  { frame: 'art_deco', font: 'cinzel', ink: 'gold' },      // art-deco · caps · gold
  { frame: 'baroque', font: 'cormorant', ink: 'mulberry' },// baroque · italic serif · wine
];

/* ── pax tier photos (prototype PAXTIERS) ── */
const PAXTIERS = [
  { max: 25, t: 't1', tag: 'Intimate · civil', line: 'Just you and your closest few — an unhurried, personal day.' },
  { max: 80, t: 't2', tag: 'Warm & intimate', line: 'Family and close friends, in a room where you can greet everyone.' },
  { max: 200, t: 't3', tag: 'The classic size', line: 'The most-loved Filipino wedding — full, lively, complete.' },
  { max: 400, t: 't4', tag: 'Grand', line: 'Extended family and the whole barkada — a big, joyful day.' },
  { max: 1e9, t: 't5', tag: 'A grand fiesta', line: 'A community-scale celebration — the whole town, it feels like.' },
];
const paxTierFor = (n: number) => PAXTIERS.find((x) => n <= x.max) ?? PAXTIERS[PAXTIERS.length - 1]!;

/* ── budget feel-band ladder (prototype buildBudget B{} + budgetTier) ── */
const BUDGET_BANDS: { value: string; label: string; tag: string; med: number }[] = [
  { value: 'essentials', label: 'Essentials', tag: 'Lean & intentional', med: 2000 },
  { value: 'simple', label: 'Simple', tag: 'Comfortable', med: 3500 },
  { value: 'classic', label: 'Classic', tag: 'The sweet spot', med: 5000 },
  { value: 'elevated', label: 'Elevated', tag: 'Polished', med: 7500 },
  { value: 'premium', label: 'Premium', tag: 'Entry luxury', med: 11000 },
  { value: 'luxury', label: 'Luxury', tag: 'No-compromise', med: 15000 },
  { value: 'nolimit', label: 'No limit', tag: 'No ceiling', med: 0 },
];
const budgetTierBand = (band: string) =>
  band === 'essentials' || band === 'simple' ? 'lean' : band === 'premium' || band === 'luxury' || band === 'nolimit' ? 'lavish' : 'mid';

/* ── budget AMOUNT math (owner 2026-06-02: text box + line picker + min-floor + max-of-range) ──
   Per-head median × pax, ±20%, rounded to the nearest ₱50k. Floor = the essentials low
   (the recommended-lowest for that guest count — the text box can't go below it).
   Ceiling = the luxury high. nolimit has no amount (med 0). */
const PRICED_BANDS = BUDGET_BANDS.filter((b) => b.med > 0);
const round50k = (n: number) => Math.round(n / 50000) * 50000;
const bandLo = (med: number, pax: number) => round50k(med * 0.8 * pax);
const bandHi = (med: number, pax: number) => {
  const a = round50k(med * 0.8 * pax);
  let z = round50k(med * 1.2 * pax);
  if (z <= a) z = a + 50000;
  return z;
};
const budgetFloor = (pax: number) => bandLo(2000, pax); // essentials low = recommended floor
const budgetCeiling = (pax: number) => bandHi(15000, pax); // luxury high
const nearestBand = (amount: number, pax: number) =>
  PRICED_BANDS.reduce(
    (best, b) => (Math.abs(b.med * pax - amount) < Math.abs(best.med * pax - amount) ? b : best),
    PRICED_BANDS[2] ?? PRICED_BANDS[0]!,
  );
const fmtPeso = (n: number) =>
  n >= 1e6 ? `₱${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : `₱${Math.round(n / 1000)}K`;
/* the working-budget value the couple effectively chose: their typed/dragged amount,
   else the current band's MAX for the pax (the "set to max of the range chosen" default). */
function effectiveBudgetPesos(band: string, amount: number | null, pax: number): number | null {
  if (band === 'nolimit') return null;
  if (typeof amount === 'number' && amount > 0) return amount;
  const b = PRICED_BANDS.find((x) => x.value === band) ?? PRICED_BANDS[2] ?? PRICED_BANDS[0]!;
  return bandHi(b.med, pax);
}

/* ── region labels + nuggets (prototype REGLABEL/REGNUG) ── */
const REGLABEL: Record<string, string> = {
  ncr: 'Metro Manila', calabarzon: 'CALABARZON', 'c-visayas': 'Central Visayas', 'w-visayas': 'Western Visayas',
  'c-luzon': 'Central Luzon', ilocos: 'Ilocos', cagayan: 'Cagayan Valley', bicol: 'Bicol', mimaropa: 'MIMAROPA',
  'e-visayas': 'Eastern Visayas', zamboanga: 'Zamboanga', 'n-mindanao': 'Northern Mindanao', davao: 'Davao',
  soccsksargen: 'SOCCSKSARGEN', caraga: 'Caraga', barmm: 'BARMM', car: 'Cordillera · CAR', abroad: 'Outside the PH',
};
const REGNUG: Record<string, string> = {
  ncr: 'The grandest ballrooms and the most-booked names — every vendor you could dream of, minutes away.',
  calabarzon: "Tagaytay's cool ridge and lakeside views — the country's favourite garden escape, an hour out.",
  'c-visayas': 'Heritage churches and island resorts — a destination wedding without the passport.',
  'w-visayas': "Boracay's powder-white sand and Iloilo's grand old churches — beach and heritage in one region.",
  'c-luzon': "Kapampangan kitchens and Bulacan's grand halls — where Filipino feasting runs deepest.",
  ilocos: "Centuries-old Vigan stone and Paoay's UNESCO church — vows wrapped in living history.",
  cagayan: "Batanes' rolling hills and Ivatan stone houses, or Cagayan's Callao caves — wild, dramatic, far-north backdrops.",
  bicol: "Mayon's perfect cone on the horizon — a volcano view no venue could ever fake.",
  mimaropa: "Palawan's hidden lagoons and Puerto Princesa coves — the most cinematic island 'I do'.",
  'e-visayas': 'San Juanico sunsets and quiet island chapels — intimate, and far from the crowds.',
  zamboanga: "Vinta-sail colour and Asia's Latin City warmth — a wedding with real character.",
  'n-mindanao': "Cagayan de Oro's rivers and Camiguin's volcanic isle — adventure meets celebration.",
  davao: 'Mount Apo air, fine local fare and polished city venues — relaxed and grand at once.',
  soccsksargen: "Lake Sebu's highland calm and Gen San's fresh feast — serene and generous.",
  caraga: "Siargao's surf-town cool and golden island light — a laid-back, barefoot kind of beautiful.",
  barmm: 'Lake Lanao heritage and rich Maranao artistry — a wedding with deep cultural soul.',
  car: "Baguio pines and Sagada's cool highlands — crisp mountain air and evergreen views.",
  abroad: "Getting married overseas? We'll still plan it with you — and bring your vendors on board.",
};
const REGION_TOP: { value: string; title: string; desc: string }[] = [
  { value: 'ncr', title: 'Metro Manila · NCR', desc: 'Quezon City · Makati · Manila · Pasig' },
  { value: 'calabarzon', title: 'CALABARZON', desc: 'Tagaytay · Batangas · Laguna · Cavite' },
  { value: 'c-visayas', title: 'Central Visayas', desc: 'Cebu · Bohol' },
  { value: 'w-visayas', title: 'Western Visayas', desc: 'Boracay · Iloilo · Bacolod' },
  { value: 'c-luzon', title: 'Central Luzon', desc: 'Pampanga · Bulacan · Subic' },
];
const REGION_MORE = ['ilocos', 'cagayan', 'bicol', 'mimaropa', 'e-visayas', 'zamboanga', 'n-mindanao', 'davao', 'soccsksargen', 'caraga', 'barmm', 'car', 'abroad'];

/* ════════════ PHASE 3 — picker (screen 9) + style sub-stepper (screen 10) ════════════ */

/* ── "What would you love?" picker — 53 services grouped by the 10 taxonomy parents (prototype lines 780-830). Rows = chip rows (solo or pair). `s` = default-selected. ── */
type PickChip = { cat: string; label: string };
type PickGroup = { label: string; rows: PickChip[][] };
const PICK_GROUPS: PickGroup[] = [
  { label: 'Venue', rows: [[{ cat: 'reception', label: 'Reception venue' }, { cat: 'ceremony', label: 'Ceremony venue' }]] },
  { label: 'Planning', rows: [[{ cat: 'coordinator', label: 'Coordinator / planner' }]] },
  { label: 'Feast', rows: [[{ cat: 'catering', label: 'Catering' }], [{ cat: 'cake', label: 'Cake' }, { cat: 'stations', label: 'Food stations' }]] },
  { label: 'Design', rows: [[{ cat: 'stylist', label: 'Stylist / decorator' }], [{ cat: 'lights_sound', label: 'Lights & sound' }, { cat: 'florist', label: 'Florist' }], [{ cat: 'dance_floor', label: 'Dance floor' }, { cat: 'led_wall', label: 'LED wall' }], [{ cat: 'fireworks', label: 'Fireworks' }, { cat: 'outdoor', label: 'Outdoor setup' }]] },
  { label: 'Program', rows: [[{ cat: 'host_mc', label: 'Host / MC' }], [{ cat: 'live_band', label: 'Live band' }, { cat: 'orchestra', label: 'Orchestra' }], [{ cat: 'choir', label: 'Choir' }, { cat: 'wedding_singer', label: 'Wedding singer' }], [{ cat: 'dj', label: 'DJ' }, { cat: 'choreographer', label: 'Choreographer' }], [{ cat: 'performers', label: 'Performers' }]] },
  { label: 'Documentary', rows: [[{ cat: 'photo_video', label: 'Photo & Video' }], [{ cat: 'livestream', label: 'Livestream' }, { cat: 'editorial', label: 'Editorial feature' }]] },
  { label: 'Look', rows: [[{ cat: 'bride_attire', label: "Bride's attire" }], [{ cat: 'groom_attire', label: "Groom's attire" }, { cat: 'grooming', label: 'Grooming' }], [{ cat: 'hmua', label: 'Hair & makeup' }, { cat: 'wellness', label: 'Wellness & fitness' }], [{ cat: 'filipiniana', label: 'Filipiniana & Barong' }], [{ cat: 'women_attire', label: "Women's attire" }, { cat: 'men_attire', label: "Men's attire" }], [{ cat: 'jewelry', label: 'Jewellery & accessories' }]] },
  { label: 'Booths', rows: [[{ cat: 'photo_booth', label: 'Photo booth' }], [{ cat: 'coffee', label: 'Coffee / espresso' }, { cat: 'mocktail', label: 'Mocktail bar' }], [{ cat: 'mobile_bar', label: 'Mobile bar' }, { cat: 'dessert', label: 'Dessert' }], [{ cat: 'food_cart', label: 'Food cart' }, { cat: 'food_truck', label: 'Food truck' }], [{ cat: 'massage_chair', label: 'Massage chair' }, { cat: 'nail_bar', label: 'Mini nail bar' }], [{ cat: 'caricature', label: 'Calligraphy / Caricature / Live Art' }, { cat: 'tarot', label: 'Tarot / astrology' }], [{ cat: 'perfume_bar', label: 'Perfume bar' }, { cat: 'arcade', label: 'Arcade / games' }], [{ cat: 'henna', label: 'Henna / tattoo' }, { cat: 'engraving', label: 'Engraving / embroidery' }]] },
  { label: 'Prints', rows: [[{ cat: 'printing', label: 'Printing' }, { cat: 'souvenirs', label: 'Souvenirs / giveaways' }]] },
  { label: 'Transport', rows: [[{ cat: 'bridal_car', label: 'Bridal car' }], [{ cat: 'guest_shuttle', label: 'Guest shuttle' }, { cat: 'escort', label: 'Escort' }]] },
];
const ALL_CATS = PICK_GROUPS.flatMap((g) => g.rows.flat().map((c) => c.cat));
const PICK_INFO: Record<string, { g: string; d: string }> = {
  reception: { g: 'Venue', d: 'Where your celebration happens — the dinner, the program, and the dancing.' },
  ceremony: { g: 'Venue', d: 'The church, chapel, or garden where you say "I do."' },
  coordinator: { g: 'Planning', d: 'Runs your timeline and vendors so you can just enjoy the day.' },
  catering: { g: 'Feast', d: 'Food and service for your guests — buffet, plated, or family-style.' },
  cake: { g: 'Feast', d: 'Your wedding cake and dessert centerpiece.' },
  stations: { g: 'Feast', d: 'Live food stations — carving, pasta, lechon, and more.' },
  stylist: { g: 'Design', d: 'Designs and styles the whole look — venue, stage, and tables.' },
  florist: { g: 'Design', d: 'Bouquets, centerpieces, and floral styling throughout.' },
  lights_sound: { g: 'Design', d: 'Lighting design and the sound system for the day.' },
  dance_floor: { g: 'Design', d: 'A proper dance floor for the first dance and the party.' },
  outdoor: { g: 'Design', d: 'Tents, draping, and setup for an outdoor celebration.' },
  fireworks: { g: 'Design', d: 'A fireworks or pyro send-off for the big moment.' },
  led_wall: { g: 'Design', d: 'An LED video wall for visuals, the live feed, and your monogram.' },
  live_band: { g: 'Program', d: 'A live band to play your reception.' },
  choir: { g: 'Program', d: 'A choir for your ceremony.' },
  orchestra: { g: 'Program', d: 'A string ensemble or orchestra for an elegant ceremony.' },
  wedding_singer: { g: 'Program', d: 'A soloist for your processional and special moments.' },
  dj: { g: 'Program', d: 'A DJ to keep the party going all night.' },
  choreographer: { g: 'Program', d: 'Choreographs your first dance or entourage number.' },
  performers: { g: 'Program', d: 'Special performers — cultural acts, dancers, or a surprise.' },
  host_mc: { g: 'Program', d: 'A host or emcee to run your reception program.' },
  photo_video: { g: 'Documentary', d: 'Photo and video teams to capture the whole day.' },
  editorial: { g: 'Documentary', d: 'A styled editorial feature of your wedding.' },
  livestream: { g: 'Documentary', d: 'Livestream the ceremony for guests who cannot be there.' },
  bride_attire: { g: 'Look', d: 'The bride’s gown — bought, made, or rented.' },
  groom_attire: { g: 'Look', d: 'The groom’s suit or formalwear.' },
  women_attire: { g: 'Look', d: 'Gowns for your bridesmaids and women’s entourage.' },
  men_attire: { g: 'Look', d: 'Suits for your groomsmen and men’s entourage.' },
  filipiniana: { g: 'Look', d: 'Filipiniana gowns and Barong Tagalog for a heritage look.' },
  hmua: { g: 'Look', d: 'Hair and makeup for the bride and the entourage.' },
  grooming: { g: 'Look', d: 'Grooming for the groom and the men.' },
  wellness: { g: 'Look', d: 'Skin, fitness, and wellness prep before the day.' },
  jewelry: { g: 'Look', d: 'Rings, veil, and the finishing accessories.' },
  photo_booth: { g: 'Booths', d: 'A photo booth for instant guest keepsakes.' },
  mobile_bar: { g: 'Booths', d: 'A mobile bar serving cocktails and drinks.' },
  coffee: { g: 'Booths', d: 'A coffee and espresso cart for your guests.' },
  mocktail: { g: 'Booths', d: 'A mocktail bar — alcohol-free, all the fun.' },
  food_truck: { g: 'Booths', d: 'A food truck for a fun late-night bite.' },
  dessert: { g: 'Booths', d: 'A dessert cart or a sweets table.' },
  food_cart: { g: 'Booths', d: 'A classic Filipino food cart — fishball, ice cream, and more.' },
  massage_chair: { g: 'Booths', d: 'Massage chairs to pamper your guests.' },
  perfume_bar: { g: 'Booths', d: 'A perfume bar — guests blend a scent to take home.' },
  arcade: { g: 'Booths', d: 'Arcade and games to keep the crowd entertained.' },
  henna: { g: 'Booths', d: 'A henna or temporary-tattoo station.' },
  nail_bar: { g: 'Booths', d: 'A mini nail bar for quick pampering.' },
  tarot: { g: 'Booths', d: 'Tarot, astrology, or palm reading — just for fun.' },
  caricature: { g: 'Booths', d: 'A live caricature or calligraphy artist.' },
  engraving: { g: 'Booths', d: 'On-the-spot engraving or embroidery favors.' },
  printing: { g: 'Prints', d: 'Invitations, signage, and printed pieces.' },
  souvenirs: { g: 'Prints', d: 'Giveaways and souvenirs for your guests.' },
  bridal_car: { g: 'Transport', d: 'The bridal car for your grand entrance and exit.' },
  guest_shuttle: { g: 'Transport', d: 'Shuttles to bring your guests to the venue.' },
  escort: { g: 'Transport', d: 'A security or motorcade escort for the convoy.' },
};
/* budget-appropriate starter set — essentials first, scale up with budget (prototype PRIORITY_TIERS + applyBudgetHighlight). */
const PRIORITY_TIERS: string[][] = [
  ['reception', 'ceremony', 'photo_video', 'bride_attire'],
  ['catering', 'groom_attire', 'hmua'],
  ['cake', 'coordinator', 'florist', 'host_mc'],
  ['lights_sound', 'bridal_car', 'printing', 'dj'],
  ['mobile_bar', 'photo_booth', 'women_attire', 'men_attire', 'stylist'],
];
const BAND_LEVEL: Record<string, number> = { essentials: 0, simple: 1, classic: 2, elevated: 3, premium: 4, luxury: 5, nolimit: 5 };
function budgetStarterPicks(band: string): string[] {
  const lvl = BAND_LEVEL[band] ?? 2;
  if (lvl >= 5) return [...ALL_CATS]; // luxury — as many vendors as possible
  const set = new Set<string>();
  for (let t = 0; t <= lvl; t++) (PRIORITY_TIERS[t] ?? []).forEach((k) => set.add(k));
  return [...set];
}

/* ── style sub-stepper data (prototype LEANPREF + FEELS + MUSIC100) ── */
const MUSIC_CATS = ['live_band', 'choir', 'orchestra', 'wedding_singer', 'dj', 'performers'];
const AESTHETIC_CATS = ['stylist', 'florist', 'cake', 'led_wall', 'printing', 'bride_attire', 'groom_attire', 'women_attire', 'men_attire'];
const PREF_ORDER = ['reception', 'ceremony', 'catering', 'photo_video', 'music', 'palette'];
function prefQueueFrom(picks: string[]): string[] {
  const want = new Set<string>();
  picks.forEach((c) => {
    if (c === 'reception' || c === 'ceremony' || c === 'catering' || c === 'photo_video') want.add(c);
    else if (MUSIC_CATS.includes(c)) want.add('music');
  });
  if (picks.some((c) => AESTHETIC_CATS.includes(c))) want.add('palette');
  return PREF_ORDER.filter((k) => want.has(k));
}
const FEELS: Record<string, string[] | null> = {
  timeless: ['#f3ece0', '#e8d6b8', '#c5a059', '#8a6d3b', '#ffffff'],
  modern: ['#ffffff', '#1e2229', '#cfd3d6', '#3a5746', '#9aa0a6'],
  boho: ['#c98a5e', '#9c6b4f', '#d9b8a0', '#8a9a6b', '#e6d6c0'],
  rustic: ['#8a9a6b', '#b5a285', '#d9cbb0', '#6b7a8a', '#efe7d6'],
  glam: ['#7a1f2b', '#c5a059', '#1e2229', '#d9b8bd', '#f3ece0'],
  royalty: ['#3a5746', '#c5a059', '#5c2542', '#1e2540', '#e8d6b8'],
  filipiniana: ['#e8d6b8', '#c5a059', '#7a1f2b', '#3a5746', '#ffffff'],
  others: null,
};
const FEELLBL: Record<string, string> = { timeless: 'Timeless', modern: 'Modern', boho: 'Boho', rustic: 'Rustic', glam: 'Glam', royalty: 'Royalty', filipiniana: 'Filipiniana', others: 'Others' };
const FEEL_CHIPS = ['timeless', 'modern', 'boho', 'rustic', 'glam', 'royalty', 'filipiniana', 'others'];
/* photo-card option sets: [emoji, label, prefs-photo-key] */
const RECEPTION_SETTINGS: [string, string, string][] = [['✨', 'Hotel ballroom', 'setting_ballroom'], ['🎪', 'Events place', 'setting_events_place'], ['🏛️', 'Heritage', 'setting_heritage'], ['🍽️', 'Restaurant', 'setting_restaurant'], ['🌿', 'Garden', 'setting_garden'], ['🏖️', 'Beach', 'setting_beach'], ['🌴', 'Resort / destination', 'setting_resort']];
const CEREMONY_OPTS: [string, string, string][] = [['⛪', 'Church', 'ceremony_church'], ['🌿', 'Garden', 'ceremony_garden'], ['🏖️', 'Beach', 'ceremony_beach'], ['🏛️', 'Civil registrar', 'ceremony_civil'], ['🎪', 'Same as reception', 'ceremony_same_reception']];
const CUISINE_OPTS: [string, string, string][] = [['🍲', 'Filipino', 'cuisine_filipino'], ['🥢', 'Asian', 'cuisine_asian'], ['🌍', 'International', 'cuisine_international'], ['🥘', 'Spanish', 'cuisine_spanish'], ['🍝', 'Italian', 'cuisine_italian'], ['✨', 'Fusion', 'cuisine_fusion']];
const SERVICE_STYLES = ['Plated', 'Buffet', 'Family-style', 'Stations'];
const PV_LOOKS: [string, string, string][] = [['📸', 'Photojournalistic', 'pv_photojournalistic'], ['🤍', 'Classic', 'pv_classic'], ['📰', 'Editorial', 'pv_editorial'], ['🎞️', 'Fine-art / film', 'pv_fineart'], ['🎬', 'Cinematic', 'pv_cinematic']];
const PV_NEEDS = ['Both photo & video', 'Photo only', 'Video only'];
const PV_INCLUDED = ['Pre-nup', 'Wedding day', 'Same-day edit', 'Drone', 'Save-the-date', 'Album'];
/* Top-100 most-popular Filipino-wedding songs (prototype MUSIC100). */
const MUSIC100: [string, string][] = `Ikaw|Yeng Constantino
Perfect|Ed Sheeran
A Thousand Years|Christina Perri
Beautiful in White|Shane Filan
Forevermore|Side A
Kahit Maputi Na Ang Buhok Ko|Moira Dela Torre
Thinking Out Loud|Ed Sheeran
Can't Help Falling in Love|Elvis Presley
All of Me|John Legend
Especially for You|MYMP
Now That I Have You|Side A
Hawak Kamay|Yeng Constantino
Marry You|Bruno Mars
Marry Me|Train
Til My Heartaches End|Ella Mae Saison
Just the Way You Are|Bruno Mars
I'm Yours|Jason Mraz
You Are My Song|Martin Nievera
The Way You Look at Me|Christian Bautista
Since I Found You|Christian Bautista
Araw-Araw|Ben&Ben
Pagsamo|Arthur Nery
With a Smile|Eraserheads
Buko|Jireh Lim
Tuwing Umuulan|Basil Valdez
Saan Darating Ang Umaga|Rey Valera
Sa'Yo|Silent Sanctuary
Say You Won't Let Go|James Arthur
Make You Feel My Love|Adele
From This Moment On|Shania Twain
I Don't Want to Miss a Thing|Aerosmith
Truly Madly Deeply|Savage Garden
Endless Love|Lionel Richie & Diana Ross
At Last|Etta James
Lucky|Jason Mraz & Colbie Caillat
I Do (Cherish You)|98 Degrees
Eternal Flame|The Bangles
The Power of Love|Celine Dion
Because You Loved Me|Celine Dion
Got to Believe in Magic|David Pomeranz
On the Wings of Love|Jeffrey Osborne
Two Less Lonely People in the World|Air Supply
Could I Have This Dance|Anne Murray
The Time of My Life|Medley & Warnes
I Finally Found Someone|Barbra Streisand
Always|Atlantic Starr
Kailan|MYMP
You|Basil Valdez
Maybe This Time|Sarah Geronimo
Pangako|Regine Velasquez
The Prayer|Celine Dion & Andrea Bocelli
When You Say Nothing at All|Ronan Keating
Everything|Michael Bublé
L-O-V-E|Nat King Cole
Better Together|Jack Johnson
First Day of My Life|Bright Eyes
Speechless|Dan + Shay
10,000 Hours|Dan + Shay & Justin Bieber
Die a Happy Man|Thomas Rhett
Lover|Taylor Swift
Love Story|Taylor Swift
Amazed|Lonestar
This I Promise You|NSYNC
I Swear|All-4-One
Wonderful Tonight|Eric Clapton
Your Song|Elton John
Have I Told You Lately|Rod Stewart
Grow Old With You|Adam Sandler
God Gave Me You|Blake Shelton
Can You Feel the Love Tonight|Elton John
Unchained Melody|The Righteous Brothers
Stand by Me|Ben E. King
Isn't She Lovely|Stevie Wonder
Signed, Sealed, Delivered|Stevie Wonder
Sway|Michael Bublé
Fly Me to the Moon|Frank Sinatra
The Way You Look Tonight|Frank Sinatra
Can't Take My Eyes Off You|Frankie Valli
You're Still the One|Shania Twain
Photograph|Ed Sheeran
Until I Found You|Stephen Sanchez
A Whole New World|Peabo Bryson & Regina Belle
My Girl|The Temptations
How Sweet It Is|James Taylor
Die With a Smile|Bruno Mars & Lady Gaga
Best Part|Daniel Caesar & H.E.R.
Adore You|Harry Styles
At My Worst|Pink Sweat$
Beautiful Crazy|Luke Combs
Heaven|Bryan Adams
Crazy Little Thing Called Love|Queen
Three Times a Lady|Commodores
Tadhana|Up Dharma Down
Mundo|IV of Spades
Tahanan|Adie
Paraluman|Adie
Maybe the Night|Ben&Ben
Kathang Isip|Ben&Ben
Bakit Ngayon Ka Lang|Ariel Rivera
Kahit Kailan|South Border`
  .trim()
  .split('\n')
  .map((l) => {
    const [t, a] = l.split('|');
    return [t ?? '', a ?? ''] as [string, string];
  });

/** A photo-card option (prototype PGRID .pcard). */
function PCard({ emoji, label, photoKey, selected, onClick }: { emoji: string; label: string; photoKey?: string; selected: boolean; onClick: () => void }) {
  return (
    <div className={`pcard${selected ? ' sel' : ''}`} onClick={onClick}>
      <div className={`pimg ${photoKey ? 'haspic' : 'imgph'}`} style={photoKey ? { backgroundImage: `url(${PREFS_ASSET(photoKey)})` } : undefined}>
        {photoKey ? null : <span className="g">{emoji}</span>}
      </div>
      <div className="plbl">
        {label}
        <span className="ck" />
      </div>
    </div>
  );
}

/** A tap chip (prototype .chip), optionally locked (faith dietary pre-lock). */
function PrefChip({ label, selected, locked, lk, onClick }: { label: string; selected: boolean; locked?: boolean; lk?: string; onClick: () => void }) {
  return (
    <span className={`chip${selected ? ' sel' : ''}${locked ? ' locked' : ''}`} onClick={locked ? undefined : onClick}>
      {label}
      {lk ? <span className="lk">{lk}</span> : null}
    </span>
  );
}

/** A labelled preference block (prototype PB). */
function PBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pblock">
      <div className="plabel">
        <span className="picon" /> {label}
      </div>
      {children}
    </div>
  );
}

/**
 * Style sub-stepper — one focused screen per picked style dimension (prototype
 * buildPrefs + LEANPREF + showPref). The shell owns `idx` (which dimension); this
 * renders only the active dimension. Preferences SORT matches, never exclude →
 * multi-pick everywhere except ceremony (single, `data-single`). Dietary halal /
 * alcohol-free is pre-LOCKED by faith (Muslim → halal, INC → alcohol-free).
 */
function StyleSubStepper({
  queue,
  idx,
  faith,
  budgetTier,
  budgetLabel,
  prefs,
  onPrefs,
}: {
  queue: string[];
  idx: number;
  faith: OnboardingFaith[];
  budgetTier: string;
  budgetLabel: string;
  prefs: OnboardingState['prefs'];
  onPrefs: (p: Partial<OnboardingState['prefs']>) => void;
}) {
  const [songSearch, setSongSearch] = useState('');
  if (queue.length === 0) {
    return (
      <div className="prefstep" data-pi="0" style={{ display: 'flex' }}>
        <div className="viewzone">
          <div className="eyebrow">
            Your style <span className="tag new">New</span>
          </div>
          <h1 className="q">You’re all set on style.</h1>
          <p className="sub">
            Nothing to fine-tune yet — we’ll sort your matches by date, area, budget and reviews. Add a look anytime in <b>Personalize my matches</b> on your Home.
          </p>
        </div>
      </div>
    );
  }
  const dim = queue[idx] ?? queue[0]!;
  const toggleArr = (arr: string[], v: string): string[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  // faith dietary pre-lock
  const lockHalal = faith.includes('muslim');
  const lockAlcoholFree = faith.includes('muslim') || faith.includes('inc');
  const dietSelected = (k: string) => (k === 'halal' ? lockHalal : k === 'alcohol_free' ? lockAlcoholFree : false) || prefs.dietary.includes(k);
  const faithLabel = faith.includes('muslim') ? 'Muslim' : faith.includes('inc') ? 'INC' : null;

  const META: Record<string, { eb: string; q: string; sub: string }> = {
    reception: { eb: 'Reception', q: 'What setting do you love?', sub: 'Open to a few? Tap them all — we float matching venues to the top.' },
    ceremony: { eb: 'Ceremony', q: 'Where will you say “I do”?', sub: 'We’ll match officiants and venues that fit.' },
    catering: { eb: 'Catering', q: 'Pick your cuisine', sub: 'Open to a few cuisines? Tap them all.' },
    photo_video: { eb: 'Photo & Video', q: 'Your look', sub: 'Mix a couple — we’ll match teams who shoot that way.' },
    music: { eb: 'Music', q: 'Your songs', sub: 'Tap the ones you love — they jump to the top. Pick at least 10; we’ll build the rest of your playlist.' },
    palette: { eb: 'Your overall feel', q: 'Set the mood', sub: 'Pick a feel — see it in its colors. It guides your stylist, florist, cake & gown.' },
  };
  const meta = META[dim]!;
  const hasHero = dim === 'catering' || dim === 'photo_video';

  // -- bodies --
  let body: ReactNode = null;
  if (dim === 'reception') {
    body = (
      <div className="pgrid">
        {RECEPTION_SETTINGS.map(([e, l, k]) => (
          <PCard key={k} emoji={e} label={l} photoKey={k} selected={prefs.reception.includes(k)} onClick={() => onPrefs({ reception: toggleArr(prefs.reception, k) })} />
        ))}
      </div>
    );
  } else if (dim === 'ceremony') {
    body = (
      <div data-single>
        <div className="pgrid">
          {CEREMONY_OPTS.map(([e, l, k]) => (
            <PCard key={k} emoji={e} label={l} photoKey={k} selected={prefs.ceremony === k} onClick={() => onPrefs({ ceremony: k })} />
          ))}
        </div>
      </div>
    );
  } else if (dim === 'catering') {
    body = (
      <>
        <div className="pgrid strip">
          {CUISINE_OPTS.map(([e, l, k]) => (
            <PCard key={k} emoji={e} label={l} photoKey={k} selected={prefs.cuisine.includes(k)} onClick={() => onPrefs({ cuisine: toggleArr(prefs.cuisine, k) })} />
          ))}
        </div>
        <PBlock label="Service style">
          <div className="chips" data-single>
            {SERVICE_STYLES.map((s) => (
              <PrefChip key={s} label={s} selected={prefs.serviceStyle === s} onClick={() => onPrefs({ serviceStyle: s })} />
            ))}
          </div>
          <div className="chips" data-diet-row>
            <PrefChip label="🕌 HALAL-certified" selected={dietSelected('halal')} locked={lockHalal} lk={lockHalal ? 'Muslim' : undefined} onClick={() => onPrefs({ dietary: toggleArr(prefs.dietary, 'halal') })} />
            <PrefChip label="Alcohol-free" selected={dietSelected('alcohol_free')} locked={lockAlcoholFree} lk={lockAlcoholFree ? (faith.includes('muslim') ? 'Muslim' : 'INC') : undefined} onClick={() => onPrefs({ dietary: toggleArr(prefs.dietary, 'alcohol_free') })} />
          </div>
        </PBlock>
        <div className="micro" style={{ marginTop: 6 }} dangerouslySetInnerHTML={{ __html: faithLabel ? `Locked on for your <b>${faithLabel}</b> ceremony — every food vendor is pre-filtered.` : 'Tap HALAL / alcohol-free if any guests need it.' }} />
      </>
    );
  } else if (dim === 'photo_video') {
    body = (
      <>
        <div className="pgrid strip">
          {PV_LOOKS.map(([e, l, k]) => (
            <PCard key={k} emoji={e} label={l} photoKey={k} selected={prefs.pvLook.includes(k)} onClick={() => onPrefs({ pvLook: toggleArr(prefs.pvLook, k) })} />
          ))}
        </div>
        <PBlock label="What do you need?">
          <div className="chips" data-single>
            {PV_NEEDS.map((s) => (
              <PrefChip key={s} label={s} selected={prefs.pvNeed === s} onClick={() => onPrefs({ pvNeed: s })} />
            ))}
          </div>
        </PBlock>
        <PBlock label="What’s included?">
          <div className="chips">
            {PV_INCLUDED.map((s) => (
              <PrefChip key={s} label={s} selected={prefs.pvIncluded.includes(s)} onClick={() => onPrefs({ pvIncluded: toggleArr(prefs.pvIncluded, s) })} />
            ))}
          </div>
        </PBlock>
      </>
    );
  } else if (dim === 'music') {
    const picked = new Set(prefs.music);
    const n = prefs.music.length;
    const q = songSearch.trim().toLowerCase();
    const ordered = MUSIC100.map((s, i) => ({ i, title: s[0], artist: s[1], lbl: `${s[0]}|${s[1]}` })).sort((a, b) => {
      const ap = picked.has(a.lbl), bp = picked.has(b.lbl);
      if (ap !== bp) return ap ? -1 : 1;
      if (ap) return prefs.music.indexOf(a.lbl) - prefs.music.indexOf(b.lbl);
      return a.i - b.i;
    });
    body = (
      <div className="songpick">
        <div className="songhead">
          <div className="songbar">
            Picked <b>{n}</b> · <span className={n >= 10 ? 'done' : undefined}>{n >= 10 ? '✓ we’ll build the rest of your playlist' : `pick at least ${10 - n} more`}</span>
          </div>
          <div className="songsearch">
            <input id="songq" type="search" placeholder="Search songs or artists…" autoComplete="off" value={songSearch} onChange={(e) => setSongSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} />
          </div>
        </div>
        <div className="songlist">
          {ordered.map(({ title, artist, lbl }) => {
            const sel = picked.has(lbl);
            const show = q ? `${title} ${artist}`.toLowerCase().includes(q) : sel || n < 10;
            return (
              <div key={lbl} className={`song${sel ? ' sel' : ''}`} style={show ? undefined : { display: 'none' }} onClick={() => onPrefs({ music: sel ? prefs.music.filter((x) => x !== lbl) : [...prefs.music, lbl] })}>
                <span className="sck" />
                <span className="stxt">
                  <span className="st">{title}</span>
                  <span className="sa">{artist}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  } else if (dim === 'palette') {
    const feel = prefs.feel ?? 'timeless';
    const cols = FEELS[feel];
    body = (
      <>
        <div className="feelsw" id="feelsw">
          {cols ? cols.map((c, j) => <span key={j} className="fsw" style={{ background: c }} />) : <div className="feelnote">We’ll build your palette together in the mood board.</div>}
        </div>
        <PBlock label="The feel">
          <div className="chips" data-single data-feel>
            {FEEL_CHIPS.map((f) => (
              <PrefChip key={f} label={FEELLBL[f] ?? f} selected={feel === f} onClick={() => onPrefs({ feel: f })} />
            ))}
          </div>
        </PBlock>
      </>
    );
  }

  // vhero / feel photo (the viewzone hero per dimension)
  let hero: ReactNode = null;
  if (dim === 'catering') hero = <figure className="styhero" style={{ backgroundImage: `url(${PICKER_ASSET('catering')})` }} aria-hidden="true" />;
  else if (dim === 'photo_video') hero = <figure className="styhero" style={{ backgroundImage: `url(${PICKER_ASSET('photo_video')})` }} aria-hidden="true" />;

  const feel = prefs.feel ?? 'timeless';
  const feelHero =
    dim === 'palette' && FEELS[feel] ? (
      <figure className="feelphoto" id="feelphoto">
        <HeroImg src={PREFS_ASSET(`feel_${feel}_${budgetTier}`)} />
        <figcaption className="feelcap">
          <span id="feelcaptag">{`${FEELLBL[feel] ?? ''} · ${budgetLabel}`}</span>
        </figcaption>
      </figure>
    ) : null;

  return (
    <div className="prefstep" data-pi={idx} style={{ display: 'flex' }}>
      <div className={`viewzone${hasHero || feelHero ? ' has-hero' : ''}`}>
        <div className="prefprog">
          <span className="prefcount">Style {idx + 1} of {queue.length}</span>
          <span className="prefdots">{queue.map((_, k) => <i key={k} className={k <= idx ? 'on' : undefined} />)}</span>
        </div>
        <div className="eyebrow">
          {meta.eb} <span className="tag new">New</span>
        </div>
        <h1 className="q">{meta.q}</h1>
        <p className="sub">{meta.sub}</p>
        {hero}
        {feelHero}
      </div>
      <div className="tapzone">
        {body}
        <div className="prefmicro">
          <span>✦</span>Tap all that fit — refine anytime on your Home.
        </div>
      </div>
    </div>
  );
}

/* ── date helpers (prototype initCal) ── */
const DAY = 86400000;
const MAXSPAN = 29;
const MAXMULTI = 4;
const CLUSTER = 90;
const M_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromISO = (s: string) => {
  const p = s.split('-').map(Number);
  return new Date(p[0] ?? 1970, (p[1] ?? 1) - 1, p[2] ?? 1);
};
const fmtFull = (d: Date) => `${M_FULL[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
const fmtShort = (d: Date) => `${(M_FULL[d.getMonth()] ?? '').slice(0, 3)} ${d.getDate()}`;
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);
const seasonOf = (m: number) => (m >= 6 && m <= 9 ? 'rainy' : m >= 2 && m <= 4 ? 'dry' : 'cool-and-clear');

type WhyView = { tone: 'good' | 'note'; title: string; reasons: [string, string][]; more: string } | null;

/** Fade-in hero image (prototype setHero: add `loaded` on load; gradient shows on error/missing). */
function HeroImg({ src, alt = '' }: { src: string; alt?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt={alt}
      className={loaded ? 'loaded' : undefined}
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(false)}
    />
  );
}

/* ── DATE CALENDAR — port of the prototype initCal() IIFE ──
 * Working state (multi / window / view month) lives locally; the captured
 * values (dateMode + dateCandidates + windowStart/End) are lifted to the parent
 * via onChange so they persist + Phase 4 can commit them. */
function DateCalendar({
  mode,
  candidates,
  windowStart,
  windowEnd,
  onChange,
}: {
  mode: 'specific' | 'window';
  candidates: string[];
  windowStart: string | null;
  windowEnd: string | null;
  onChange: (p: Partial<OnboardingState>) => void;
}) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);
  const maxD = useMemo(() => {
    const d = new Date(today);
    d.setFullYear(d.getFullYear() + 3);
    return d;
  }, [today]);
  const minD = today;

  /* seed: a date ~6 months out (clamped), used when nothing is picked yet */
  const seed = useMemo(() => {
    const s = new Date(today);
    s.setMonth(s.getMonth() + 6);
    return s > maxD ? new Date(maxD) : s;
  }, [today, maxD]);

  /* working state — seeded once from props (resume), then local source of truth */
  const [multi, setMulti] = useState<Date[]>(() =>
    candidates.length ? candidates.map(fromISO) : [new Date(seed)],
  );
  const [rStart, setRStart] = useState<Date | null>(() => (windowStart ? fromISO(windowStart) : null));
  const [rEnd, setREnd] = useState<Date | null>(() => (windowEnd ? fromISO(windowEnd) : null));
  const [pickingEnd, setPickingEnd] = useState(false);
  const [view, setView] = useState(() => {
    const base = candidates.length ? fromISO(candidates[0]!) : windowStart ? fromISO(windowStart) : seed;
    return { y: base.getFullYear(), m: base.getMonth() };
  });

  const clampMax = (d: Date) => (d > maxD ? new Date(maxD) : d);
  const atMin = view.y === minD.getFullYear() && view.m === minD.getMonth();
  const atMax = view.y === maxD.getFullYear() && view.m === maxD.getMonth();

  /* push captured values up (persist + Phase-4 commit). */
  const lift = useCallback(
    (m: Date[], rs: Date | null, re: Date | null) => {
      const sorted = [...m].sort((a, b) => a.getTime() - b.getTime());
      onChange({
        dateCandidates: sorted.map(toISO),
        windowStart: rs ? toISO(rs) : null,
        windowEnd: re ? toISO(re) : null,
      });
    },
    [onChange],
  );

  const setMode = (m: 'specific' | 'window') => {
    if (m === 'window') {
      if (!rStart) {
        const s = new Date(seed);
        const e = clampMax(new Date(seed.getTime() + 13 * DAY));
        setRStart(s);
        setREnd(e);
        setPickingEnd(false);
        lift(multi, s, e);
      }
    } else if (multi.length === 0) {
      const m2 = [new Date(seed)];
      setMulti(m2);
      lift(m2, rStart, rEnd);
    }
    onChange({ dateMode: m });
  };

  const clickDay = (cur: Date) => {
    if (mode === 'specific') {
      const k = keyOf(cur);
      const idx = multi.findIndex((d) => keyOf(d) === k);
      let next: Date[];
      if (idx >= 0) next = multi.filter((_, i) => i !== idx);
      else if (multi.length < MAXMULTI) next = [...multi, new Date(cur)];
      else next = multi;
      setMulti(next);
      lift(next, rStart, rEnd);
      return;
    }
    if (!pickingEnd) {
      setRStart(cur);
      setREnd(null);
      setPickingEnd(true);
      lift(multi, cur, null);
      return;
    }
    if (rStart && cur <= rStart) {
      setRStart(cur);
      setREnd(null);
      lift(multi, cur, null);
      return;
    }
    const span = rStart ? daysBetween(rStart, cur) : 0;
    let end = cur;
    if (rStart && span > MAXSPAN) end = clampMax(new Date(rStart.getTime() + MAXSPAN * DAY));
    setREnd(end);
    setPickingEnd(false);
    lift(multi, rStart, end);
  };

  const prevMonth = () => {
    if (atMin) return;
    setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  };
  const nextMonth = () => {
    if (atMax) return;
    setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));
  };

  /* ── derived: grid cells ── */
  const sorted = [...multi].sort((a, b) => a.getTime() - b.getTime());
  let clo = minD;
  let chi = maxD;
  let locked = false;
  if (mode === 'specific' && multi.length >= 1) {
    const ts = multi.map((d) => d.getTime());
    clo = new Date(Math.max(minD.getTime(), Math.max(...ts) - CLUSTER * DAY));
    chi = new Date(Math.min(maxD.getTime(), Math.min(...ts) + CLUSTER * DAY));
    locked = multi.length >= MAXMULTI;
  }
  const first = new Date(view.y, view.m, 1).getDay();
  const dim = new Date(view.y, view.m + 1, 0).getDate();
  const cells: { d?: number; cur?: Date; cls: string; disabled: boolean }[] = [];
  for (let i = 0; i < first; i++) cells.push({ cls: 'calday empty', disabled: true });
  for (let d = 1; d <= dim; d++) {
    const cur = new Date(view.y, view.m, d);
    const isPicked = mode === 'specific' && multi.some((x) => keyOf(x) === keyOf(cur));
    let disabled = cur < minD || cur > maxD;
    if (mode === 'specific' && !disabled && !isPicked) {
      if (locked) disabled = true;
      else if (multi.length >= 1 && (cur < clo || cur > chi)) disabled = true;
    }
    let cls = 'calday';
    if (disabled) cls += ' disabled';
    if (keyOf(cur) === keyOf(today)) cls += ' today';
    if (mode === 'specific') {
      if (isPicked) cls += ' sel';
    } else if (rStart) {
      if (keyOf(cur) === keyOf(rStart)) cls += ' rstart';
      if (rEnd && keyOf(cur) === keyOf(rEnd)) cls += ' rend';
      if (rEnd && cur > rStart && cur < rEnd) cls += ' inrange';
    }
    cells.push({ d, cur, cls, disabled });
  }

  /* ── derived: readout + why-nugget (prototype updatePick) ── */
  const dateReasons = (d: Date): WhyView => {
    const dow = d.getDay();
    const m = d.getMonth();
    const n = d.getDate();
    const r: [string, string][] = [];
    let note = false;
    if (dow === 6) r.push(['Saturday', 'the day most Filipino weddings are held.']);
    else if (dow === 5) r.push(['Friday', 'Venus’s day — the day for love.']);
    else if (dow === 0) r.push(['Sunday', 'intimate, and vendors often cost a little less.']);
    else r.push(['A weekday', 'lower vendor rates and easier venue booking.']);
    if (m === 11) {
      r.push(['December', 'peak season — family’s home for the holidays, so lock vendors early.']);
      note = true;
    } else if (m >= 6 && m <= 9) {
      r.push(['Rainy / typhoon window', 'lush and dramatic, but plan a wet-weather backup.']);
      note = true;
    } else if (m >= 2 && m <= 4) r.push(['Dry season', 'outdoor-friendly — just mind the summer heat.']);
    else r.push(['Cool, clear months', 'comfortable for an outdoor celebration.']);
    if (n === 8 || n === 18 || n === 28) r.push([`The ${n}th`, 'a number of prosperity in Chinese-Filipino tradition.']);
    else if (n === 4 || n === 14 || n === 24) {
      r.push([`The ${n}th`, 'some families avoid 4 — worth a quick word with the elders.']);
      note = true;
    }
    return {
      tone: note ? 'note' : 'good',
      title: note ? '✦ A few things to note' : '✦ Why this date works',
      reasons: r.slice(0, 3),
      more: 'See all 5 layers — liturgical · numerology · folklore · weather · astrology — with Setnayan Concierge →',
    };
  };
  const rangeReasons = (a: Date, b: Date): WhyView => {
    const r: [string, string][] = [];
    let note = false;
    let sat = 0;
    const mid = new Date(a.getTime() + (b.getTime() - a.getTime()) / 2);
    for (let t = a.getTime(); t <= b.getTime(); t += DAY) if (new Date(t).getDay() === 6) sat++;
    r.push(['We lock the date, not you', 'we pick the day in this window every chosen vendor is free — nobody’s double-booked.']);
    if (sat > 0) r.push([`${sat} Saturday${sat > 1 ? 's' : ''} in here`, 'the prime wedding days — best shot your shortlist lines up.']);
    const mm = mid.getMonth();
    if (mm === 11) {
      r.push(['Crosses December', 'peak — a wider window helps you land popular vendors.']);
      note = true;
    } else if (mm >= 6 && mm <= 9) {
      r.push(['Rainy-season window', 'flexibility lets us dodge the worst weather too.']);
      note = true;
    } else r.push(['Good-weather window', 'comfortable months — easy on outdoor plans.']);
    return {
      tone: note ? 'note' : 'good',
      title: '✦ Why a flexible window works',
      reasons: r.slice(0, 3),
      more: 'As you shortlist vendors, your day settles on the date they’re all open inside this window.',
    };
  };
  const commonReasons = (ds: Date[]): WhyView => {
    const r: [string, string][] = [];
    let note = false;
    const dows = ds.map((d) => d.getDay());
    const months = ds.map((d) => d.getMonth());
    const nums = ds.map((d) => d.getDate());
    const allSame = <T,>(a: T[]) => a.every((x) => x === a[0]);
    const span = daysBetween(ds[0]!, ds[ds.length - 1]!);
    if (allSame(dows))
      r.push([`All ${DOW_FULL[dows[0]!]}s`, dows[0] === 6 ? 'the prime wedding day — vendors’ busiest slot, so options really help.' : 'one weekday pattern — easier for a vendor to hold one of them.']);
    else if (dows.every((x) => x === 0 || x === 6)) r.push(['All weekends', 'the days most vendors work — best odds your shortlist lines up.']);
    if (allSame(months)) r.push([`All in ${M_FULL[months[0]!]}`, 'one month to staff — a vendor only needs one open slot in it.']);
    else if (allSame(ds.map((d) => seasonOf(d.getMonth())))) {
      const s = seasonOf(ds[0]!.getMonth());
      r.push([`All in the ${s} season`, s === 'rainy' ? 'plan a wet-weather backup — but vendors book easier off-peak.' : 'consistent weather across your options.']);
    }
    if (allSame(nums) && [8, 18, 28].includes(nums[0]!)) r.push([`All land on the ${nums[0]}th`, 'a prosperity number in Chinese-Filipino tradition.']);
    r.push([`${span === 0 ? 'same' : `within ${span}`} days`, 'tight enough that one vendor’s calendar can cover them — as schedules fill, we lock the one they all share.']);
    if (months.includes(11)) note = true;
    return {
      tone: note ? 'note' : 'good',
      title: '✦ What your dates share',
      reasons: r.slice(0, 3),
      more: 'As vendors book up, your day settles on whichever of these stays open for all of them.',
    };
  };

  let pickHtml: ReactNode;
  let why: WhyView = null;
  let warn: string | null = null;
  if (mode === 'specific') {
    if (multi.length === 0) {
      pickHtml = 'Pick your date — or up to 4 within 3 months';
    } else if (multi.length === 1) {
      const dd = daysBetween(today, sorted[0]!);
      pickHtml = (
        <>
          Your date: <b>{fmtFull(sorted[0]!)}</b> · {dd <= 0 ? 'today' : `${dd} days`}{' '}
          <span className="addhint">· or add up to 3 nearby</span>
        </>
      );
      why = dateReasons(sorted[0]!);
    } else {
      const lk = multi.length >= MAXMULTI;
      pickHtml = (
        <>
          Your dates: <b>{sorted.map(fmtShort).join(' · ')}</b>{' '}
          <span className="addhint">· {lk ? '4 set' : `add ${MAXMULTI - multi.length} more`}</span>
        </>
      );
      why = commonReasons(sorted);
      if (lk) warn = '4 dates set — tap one to swap.';
    }
  } else if (!rEnd) {
    pickHtml = (
      <>
        Window start: <b>{rStart ? fmtFull(rStart) : '—'}</b> · tap an end date
      </>
    );
  } else if (rStart) {
    const span = daysBetween(rStart, rEnd) + 1;
    pickHtml = (
      <>
        Your window: <b>{fmtShort(rStart)} – {fmtShort(rEnd)}</b> · {span} days{' '}
        <span className="addhint">· we find the shared date</span>
      </>
    );
    why = rangeReasons(rStart, rEnd);
  }

  const setRangeMsg =
    mode === 'specific'
      ? 'Up to 4 dates within ~3 months — we lock the one all your vendors share.'
      : 'Tap a start + end (≤30 days) — we lock the shared date inside it.';

  return (
    <>
      <div className="calpick">{pickHtml}</div>
      {warn && <div className="rangewarn">{warn}</div>}
      <div className="micro">{setRangeMsg}</div>
      <div className="calmode">
        <button type="button" className={mode === 'specific' ? 'on' : undefined} onClick={() => setMode('specific')}>
          Specific dates<span className="ms">1–4 days</span>
        </button>
        <button type="button" className={mode === 'window' ? 'on' : undefined} onClick={() => setMode('window')}>
          Flexible window<span className="ms">a range</span>
        </button>
      </div>
      <div className="cal">
        <div className="calhead">
          <button className="calnav" type="button" onClick={prevMonth} disabled={atMin} aria-label="Previous month">‹</button>
          <div className="calmonth">{M_FULL[view.m]} {view.y}</div>
          <button className="calnav" type="button" onClick={nextMonth} disabled={atMax} aria-label="Next month">›</button>
        </div>
        <div className="caldow"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div>
        <div className="calgrid">
          {cells.map((c, i) =>
            c.d == null ? (
              <div key={`e${i}`} className={c.cls} />
            ) : (
              <div key={`d${i}`} className={c.cls} onClick={c.disabled ? undefined : () => c.cur && clickDay(c.cur)}>
                {c.d}
              </div>
            ),
          )}
        </div>
      </div>
      {why && (
        <div className="whydate">
          <span className={`wtone ${why.tone}`}>{why.title}</span>
          <div className="wsum">
            <b>{why.reasons[0]?.[0]}</b> — {why.reasons[0]?.[1]} <span className="wmore">{why.more}</span>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Budget-matched bundle (prototype BUNDLE_* + SVC + renderMatchedBundle · owner 2026-06-01/02) ──
   One curated bundle keyed to the working budget. Cumulative ladder (each tier adds to the one below).
   PRICE-FOLLOWER: in production the bundle reads each service's live price from the admin Add-on
   Management menu (iteration 0023 §3.12 / service_catalog); SVC below is the prototype demo stand-in. */
const BUNDLE_ITEMS: Record<string, string> = {
  advanced_website: 'Advanced Website', papic_guest: 'Papic for guests', sde: 'Same-Day Edit', guest_stories: 'Guest Stories', pabati: 'Pabati guestbook', papic_seats: 'Papic · 5 seats', animated_monogram: 'Animated Monogram', thank_you: 'Thank-You Video', pakanta: 'Pakanta · your song', custom_qr: 'Custom QR per guest', panood: 'Panood livestream', live_background: 'Live Background', live_photowall: 'Live Photo Wall', indoor_blueprint: 'Indoor Blueprint', high_res: 'High-Res Archive',
};
/* Plain-language benefit copy — functional outcome + emotional anchor (JTBD · Bundle_Benefits_Best_Practices_2026-06-02.md). */
const BUNDLE_BENEFIT: Record<string, string> = {
  advanced_website: "One link replaces 200 group-chat messages. RSVP, schedule, dress code, photos — your guests find their own answers, you stay present.",
  papic_guest: "Every guest's phone becomes a camera — their candids land in your gallery live, so you keep the unposed moments a single photographer would miss.",
  sde: "A 3-minute wedding film, edited and screened the same night at your reception — the rare gift of reliving your day with the people who lived it with you.",
  guest_stories: "Tito Boy's joke, Lola's blessing, your maid of honor's tears — short video greetings captured at the event, before the night blurs.",
  pabati: "A video guestbook — short wishes from everyone you love, kept forever. Better than a signed card you'll file away and forget.",
  papic_seats: "Five trusted friends, five cameras roaming the venue — the candid angles a single photographer can't catch from the front of the aisle.",
  animated_monogram: "Your monogram drawn in gold the moment a guest opens the invite — the small detail that says we took our wedding seriously.",
  thank_you: "A personalised thank-you video to send after the wedding — beats handwriting 200 cards, feels more like you.",
  pakanta: "An original song written just for your wedding. Yours, forever — the only couple in the world who'll ever dance to it.",
  custom_qr: "A custom QR per guest opens their table, schedule, and photos with one tap — no awkward 'which table am I at?' for anyone, all night.",
  panood: "Livestream your day to family abroad — multi-camera, broadcast quality, so Lolo in California feels like he was in the front row.",
  live_background: "An LED stage backdrop with your palette and monogram — your story on the wall, instead of generic venue draping.",
  live_photowall: "A live photo wall at the venue — the night writes itself, guest pictures appearing on the wall minutes after each moment.",
  indoor_blueprint: "A venue floor map — guests find their seats in seconds. Zero confused tito wandering around looking for table 7.",
  high_res: "Full-quality archive of all your originals, stored safely. Free with Setnayan — yours to keep, no subscription fees.",
};
/* JTBD grouping — preparation → the day → memories (research Finding #4). */
const BUNDLE_GROUPS: Record<string, string> = {
  advanced_website: 'plan', custom_qr: 'plan', indoor_blueprint: 'plan', animated_monogram: 'plan',
  papic_guest: 'celebrate', papic_seats: 'celebrate', sde: 'celebrate', guest_stories: 'celebrate', pabati: 'celebrate', panood: 'celebrate', live_background: 'celebrate', live_photowall: 'celebrate',
  thank_you: 'remember', pakanta: 'remember', high_res: 'remember',
};
const BUNDLE_GROUP_ORDER = ['plan', 'celebrate', 'remember'] as const;
const BUNDLE_GROUP_LABEL: Record<string, string> = { plan: 'Plan it', celebrate: 'Capture & celebrate', remember: 'Remember & share' };
const BUNDLE_GROUP_INTRO: Record<string, string> = {
  plan: 'Behind-the-scenes so you arrive ready, not exhausted.',
  celebrate: "Every angle of the day itself — what you'll feel, what you'll want to look back at.",
  remember: 'What stays with you long after the lights come down.',
};
const HIGH_RES_FREE: Record<string, boolean> = { high_res: true }; // free baseline (2026-06-01) — flagged on the card
const BUNDLE_TIERS: { key: string; name: string; add: string[] }[] = [
  { key: 'essential', name: 'Essential Bundle', add: ['advanced_website', 'papic_guest', 'sde'] },
  { key: 'simple', name: 'Simple Bundle', add: ['guest_stories', 'pabati'] },
  { key: 'classic', name: 'Classic Bundle', add: ['papic_seats', 'animated_monogram', 'thank_you', 'pakanta', 'custom_qr'] },
  { key: 'grand', name: 'Grand Bundle', add: ['panood', 'live_background', 'live_photowall', 'indoor_blueprint'] },
  { key: 'grandfiesta', name: 'Grand Fiesta Bundle', add: ['high_res'] },
];
/* out = market-equivalent "if hired separately" (admin-editable) · set = Setnayan price (pax items scale in admin). */
const SVC: Record<string, { out: number; set: number }> = {
  advanced_website: { out: 25000, set: 5499 }, papic_guest: { out: 32000, set: 2999 }, sde: { out: 35000, set: 3499 }, guest_stories: { out: 8000, set: 1999 }, pabati: { out: 12000, set: 999 }, papic_seats: { out: 75000, set: 2999 }, animated_monogram: { out: 15500, set: 2499 }, thank_you: { out: 60000, set: 5499 }, pakanta: { out: 12500, set: 2499 }, custom_qr: { out: 5000, set: 1499 }, panood: { out: 17500, set: 3499 }, live_background: { out: 20000, set: 2499 }, live_photowall: { out: 18000, set: 2499 }, indoor_blueprint: { out: 12500, set: 1499 }, high_res: { out: 5000, set: 0 },
};
const pesoB = (n: number) => '₱' + Math.round(n).toLocaleString('en-US');
/* Comma thousands-separators for the numeric text boxes (guest count + budget).
   Strips non-digits then groups, so the box shows "1,355,000" live while typing
   (owner 2026-06-02). Native type="number" can't render commas — those boxes are
   type="text" + inputMode="numeric" so the digits-only buffer formats on display. */
const groupDigits = (raw: string) => {
  const d = raw.replace(/[^\d]/g, '');
  return d ? Number(d).toLocaleString('en-US') : '';
};
const BUNDLE_INDEX: Record<string, number> = { essential: 0, simple: 1, classic: 2, grand: 3, grandfiesta: 4 };
const BUNDLE_TAGLINE: Record<string, string> = {
  essential: 'Plan it and capture it — the must-haves.', simple: 'A fuller set so every guest is part of the story.', classic: 'The complete celebration — planned, captured, scored, styled.', grand: 'A production: planned, livestreamed, lit, and easy to navigate.', grandfiesta: 'Everything, nothing held back — your grandest day.',
};
/* 7 budget bands → 5 bundles (elevated+premium→Grand · luxury+nolimit→Grand Fiesta) — FLAGGED for owner. */
const BAND_TO_BUNDLE: Record<string, string> = { essentials: 'essential', simple: 'simple', classic: 'classic', elevated: 'grand', premium: 'grand', luxury: 'grandfiesta', nolimit: 'grandfiesta' };
function bundleItemsFor(bk: string): string[] {
  const idx = BUNDLE_INDEX[bk] ?? 2;
  const out: string[] = [];
  for (let t = 0; t <= idx; t++) { const tier = BUNDLE_TIERS[t]; if (tier) tier.add.forEach((k) => out.push(k)); }
  return out;
}

/* The budget-matched bundle card (prototype renderMatchedBundle). Pure on `band`; Add CTA calls onAdd. */
function MatchedBundle({ band, added, onAdd }: { band: string; added: boolean; onAdd: () => void }) {
  const bk = BAND_TO_BUNDLE[band] ?? 'classic';
  const tier = BUNDLE_TIERS[BUNDLE_INDEX[bk] ?? 2] ?? BUNDLE_TIERS[2]!;
  const items = bundleItemsFor(bk);
  let outTotal = 0;
  let setTotal = 0;
  items.forEach((k) => { const p = SVC[k] ?? { out: 0, set: 0 }; outTotal += p.out; setTotal += p.set; });
  const bundlePrice = Math.round((setTotal * 0.7) / 100) * 100 - 1; // 30% off à la carte, charm-rounded
  const totalSavings = outTotal - bundlePrice; // headline savings — vs hiring everything elsewhere
  return (
    <div className="mbundle">
      <span className="mb-badge" data-prod-stat="Most-picked at this guest count"><span className="mbb-star">★</span>Picked for your wedding</span>
      <div className="mb-h"><span className="mb-name">{tier.name}</span><span className="mb-tag">{items.length} picks</span></div>
      <div className="mb-line">{BUNDLE_TAGLINE[bk] ?? ''}</div>
      <div className="mb-items">
        {BUNDLE_GROUP_ORDER.map((g) => {
          const rows = items.filter((k) => BUNDLE_GROUPS[k] === g);
          if (rows.length === 0) return null;
          return (
            <section className="bli-group" key={g}>
              <header className="bli-group-head"><span className="bgh-lbl">{BUNDLE_GROUP_LABEL[g] ?? ''}</span><span className="bgh-intro">{BUNDLE_GROUP_INTRO[g] ?? ''}</span></header>
              {rows.map((k) => (
                <div className={`bli-rich${HIGH_RES_FREE[k] ? ' free' : ''}`} key={k}>
                  <div className="bli-thumb" style={{ backgroundImage: `url('${BUNDLE_ASSET(k)}')` }} />
                  <div className="bli-body"><div className="bli-bene">{BUNDLE_BENEFIT[k] ?? ''}</div><div className="bli-prod">{(BUNDLE_ITEMS[k] ?? '') + (HIGH_RES_FREE[k] ? ' · free' : '')}</div></div>
                </div>
              ))}
            </section>
          );
        })}
      </div>
      <div className="mb-price">
        <span className="mb-out">{pesoB(outTotal)} if hired separately</span>
        <div className="mb-save"><span className="ms-lbl">★ You save</span><span className="ms-amt">{pesoB(totalSavings)}</span><span className="ms-vs">vs hiring everything separately</span></div>
        <div className="mb-now"><b className="mb-amt">{pesoB(bundlePrice)}</b><span className="mb-off">−30% bundle · book now</span></div>
        <div className="mb-sub">{pesoB(setTotal)} à la carte · the extra 30% holds only if you add it now</div>
      </div>
      <button className={`mb-add${added ? ' added' : ''}`} type="button" onClick={onAdd} aria-label="Add this bundle to my plan">
        {added ? (
          <>
            <span className="mb-add-h">✓ Added to your plan</span>
            <span className="mb-add-sub">You can review it before checkout</span>
          </>
        ) : (
          <>
            <span className="mb-add-h">Add this to my plan <b>{pesoB(bundlePrice)}</b></span>
            <span className="mb-add-sub">Save {pesoB(totalSavings)} · book now</span>
          </>
        )}
      </button>
    </div>
  );
}

/* ── Live savings compute (Time_and_Money_Saved_Model_2026-06-01.md §D) ──
   Per-couple from the onboarding state — REPLACES the hardcoded demo strip
   (₱42,992 / 745 / 48 · owner 2026-06-02: "why is this the same for everybody?
   we tried different input and it still gave the same data"). Free-feature money
   is flat (everyone gets the same free features → ₱32,992) + ₱2,500 × expos; the
   hours scale with the couple's actual picks · shortlist · runway · design
   categories · expos. Today's Focus EXCLUDED (paid SKU, not a free saving). The
   vendor stat tile is NOT computed here — it uses REAL marketplace counts from
   getOnboardingVendorCounts (owner 2026-06-03), not a fabricated formula. */
/* Name fields (bride/groom · screen 4) accept letters only — no digits, no symbols
   (owner 2026-06-02). Allows Unicode letters (Filipino ñ + accents), spaces (compound
   names + spaced surnames like "Dela Cruz"/"De Leon"), hyphens ("Anne-Marie") and
   apostrophes ("D'Souza"); strips everything else live as the couple types. */
function sanitizeName(raw: string): string {
  return (raw || '').replace(/[^\p{L}\s'-]/gu, '');
}

const SAVINGS_FLAT_PESOS = 32992; // sum of the 8 flat free-feature money values (model §D table)
const SAVINGS_PER_EXPO_PESOS = 2500; // marketplace — money per bridal expo replaced
function computeOnboardingSavings(state: OnboardingState, now: Date): { money: number; hours: number } {
  const categories = state.picks.length;
  const shortlisted = state.shortlist.length;
  const designVendors = state.picks.filter((p) => AESTHETIC_CATS.includes(p)).length;
  const exposReplaced = Math.min(5, Math.max(1, Math.ceil(Math.max(categories, 1) / 3)));
  // runway = earliest committed/candidate date (or window start) − today, clamped ≥0
  const iso =
    state.dateMode === 'window' && state.windowStart
      ? state.windowStart
      : ((state.dateCandidates ?? []).filter(Boolean).slice().sort()[0] ?? null);
  let runwayDays = 365; // 12-mo default when no date yet (the date screen gates, so rare)
  if (iso) {
    const days = Math.round((new Date(iso + 'T00:00:00').getTime() - now.getTime()) / 86400000);
    if (Number.isFinite(days)) runwayDays = Math.max(0, days);
  }
  const money = SAVINGS_FLAT_PESOS + SAVINGS_PER_EXPO_PESOS * exposReplaced;
  const hours = Math.round(
    3 * categories + // filtering — 3h/category
      8 + // monogram
      350 + // website (triple site)
      12 + // guest planner
      12 + // budget tracker
      3 * shortlisted + // vendor comparison — 3h/shortlisted
      0.5 * runwayDays + // dashboard — 0.5h/day
      2 * designVendors + // mood board — 2h/design vendor
      24 * exposReplaced, // marketplace — 24h/expo replaced
  );
  return { money, hours };
}

/* Onboarding-completion overlay (owner 2026-06-02). Once the couple taps the final
   button we lock the whole screen with a "creating your dashboard" overlay so they
   can't touch anything, preload the dashboard + its tabs, then navigate. The hold
   is a deliberate beat that lets the prefetches warm before we release — the
   dashboard then appears warm + instant ("make sure everything is preloaded before
   we release the loading screen to make it feel fast"). */
const ANALYZING_HOLD_MS = 2200;
const ANALYZING_STAGES = [
  'Analyzing your preferences…',
  'Matching your vendors…',
  'Building your personalized dashboard…',
];

/* Savings counter — counts up on screen entry (prototype countUp/runCounters · cubic ease-out ~1.15s). */
function CountUp({ value, prefix = '', suffix = '', active }: { value: number; prefix?: string; suffix?: string; active: boolean }) {
  const [disp, setDisp] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (!active) {
      setDisp(0);
      return;
    }
    const dur = 1150;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisp(Math.round(value * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [active, value]);
  return (
    <b>
      {prefix}
      {disp.toLocaleString('en-US')}
      {suffix}
    </b>
  );
}

export function OnboardingShell({ authed, resume }: { authed: boolean; resume: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState>(EMPTY_ONBOARDING_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [regionExpanded, setRegionExpanded] = useState(false);
  const [monoPop, setMonoPop] = useState(false);
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* picker sticky-preview (local UI) + style sub-stepper index (local UI) */
  const [pickerPreview, setPickerPreview] = useState<{ cat: string; name: string }>({ cat: 'reception', name: 'Reception venue' });
  const [prefIdx, setPrefIdx] = useState(0);
  /* Phase-4 local UI: budget-matched bundle add (screen 14) · BYO bottom-sheet (12) */
  const [bundleAdded, setBundleAdded] = useState(false);
  /* WAVE 2 (find-vendor, step 12): REAL reception venues, fetched once on entry
     (criteria-based search — the event doesn't exist yet). null = not loaded. */
  const [venues, setVenues] = useState<OnboardingVenueResult[] | null>(null);
  const [venuesLoading, setVenuesLoading] = useState(false);
  // (find-vendor "Expand search" demo set removed — replaced by the real reception query)
  /* Congrats stat tile #3 (step 13): REAL marketplace counts, fetched once on
     entry (criteria-based — the event doesn't exist yet). null = uncomputed →
     the tile auto-hides (owner 2026-06-03: "we want real numbers only"). */
  const [vendorCounts, setVendorCounts] = useState<{ matched: number; total: number } | null>(null);
  const [vendorCountsTried, setVendorCountsTried] = useState(false);
  const [byoOpen, setByoOpen] = useState(false);
  const [byoDone, setByoDone] = useState<string | null>(null);
  const [byoAdded, setByoAdded] = useState(false);
  const [byoName, setByoName] = useState('');
  const [byoPerson, setByoPerson] = useState('');
  const [byoEmail, setByoEmail] = useState('');
  /* Phase-5 cutover: account-gate email-mode toggle + the single lazy DB commit. */
  const [emailMode, setEmailMode] = useState(false);
  const [committedEventId, setCommittedEventId] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const committingRef = useRef(false);
  /* Finishing overlay — blocking "creating your dashboard" screen shown the instant
     the couple taps the final button (owner 2026-06-02). finStage cycles the status
     line for a premium "analyzing" feel while the dashboard preloads. */
  const [finishing, setFinishing] = useState(false);
  const [finStage, setFinStage] = useState(0);

  /* Hydrate from localStorage on mount (30-day TTL auto-clear). */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as OnboardingState;
        const ageMs = Date.now() - new Date(saved.lastSavedAt || 0).getTime();
        const ttlMs = ONBOARDING_DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000;
        if (saved.lastSavedAt && ageMs < ttlMs) {
          setState({ ...EMPTY_ONBOARDING_STATE, ...saved });
        } else {
          localStorage.removeItem(ONBOARDING_DRAFT_KEY);
        }
      }
    } catch {
      /* corrupt draft — ignore, start fresh */
    }
    setHydrated(true);
  }, []);

  /* Persist on every change (after hydration, so we don't clobber the draft on mount).
     Once committed (committedEventId set in handleFinish, right before navigating to the
     dashboard), STOP persisting — otherwise a late re-render during the soft navigation
     could resurrect the draft we just removed, and re-opening onboarding would show the
     just-created wedding's data (owner 2026-06-02: "the data on the onboarding still
     persisted"). handleFinish removes the key; this guard keeps it removed. */
  useEffect(() => {
    if (!hydrated || committedEventId) return;
    try {
      localStorage.setItem(
        ONBOARDING_DRAFT_KEY,
        JSON.stringify({ ...state, lastSavedAt: new Date().toISOString() }),
      );
    } catch {
      /* storage full / blocked — non-fatal */
    }
  }, [state, hydrated, committedEventId]);

  /* Phase-5 resume: an anonymous visitor authenticated at the account gate (11)
     and bounced back via ?resume=1. The hydrate effect restored their draft
     (step was 11); now authed, advance past the now-satisfied gate to find-vendor. */
  useEffect(() => {
    if (hydrated && resume && authed) {
      setState((s) => (s.step <= 11 ? { ...s, step: 12 } : s));
    }
  }, [hydrated, resume, authed]);

  const { step, role, kind, faith } = state;
  const patch = useCallback((p: Partial<OnboardingState>) => setState((s) => ({ ...s, ...p })), []);

  const isCivil = kind === 'civil';

  /* ── style sub-stepper queue (prototype buildPrefs) ── */
  const prefQueue = useMemo(() => prefQueueFrom(state.picks), [state.picks]);

  /* ── navigation (prototype go(d) + prefStep() sub-stepper + Civil-skip-faith) ── */
  const go = useCallback(
    (d: number) => {
      if (d === 0) return;
      // Style step (10) is an internal sub-stepper: walk its focused screens before leaving.
      if (state.step === 10) {
        const ni = prefIdx + d;
        if (ni >= 0 && ni < prefQueue.length) {
          setPrefIdx(ni);
          return;
        }
        // at an edge → fall through to leave the prefs screen
      }
      setState((s) => {
        let n = Math.max(0, Math.min(PHASE_SCREENS - 1, s.step + d));
        if (n === 3 && s.kind === 'civil') {
          n = Math.max(0, Math.min(PHASE_SCREENS - 1, n + (d > 0 ? 1 : -1)));
        }
        // Phase-5: signed-in customers (dashboard "Add event → Wedding") skip the
        // account gate (11) — they're already authenticated. Anonymous marketing
        // visitors hit it and authenticate there. Same skip mechanic as Civil/faith.
        if (n === 11 && authed) {
          n = Math.max(0, Math.min(PHASE_SCREENS - 1, n + (d > 0 ? 1 : -1)));
        }
        return { ...s, step: n };
      });
      // entering the prefs sub-stepper forward (from the picker) → start at its first screen
      if (d > 0 && state.step === 9) setPrefIdx(0);
    },
    [state.step, prefIdx, prefQueue.length, authed],
  );

  /* "What would you love?" auto-highlights a budget-appropriate starter set (prototype applyBudgetHighlight),
     re-seeding only while untouched — once the couple edits a chip, pickerTouched latches and we stop. */
  useEffect(() => {
    if (step === 9 && !state.pickerTouched) {
      patch({ picks: budgetStarterPicks(state.budgetBand ?? 'classic') });
    }
  }, [step, state.pickerTouched, state.budgetBand, patch]);

  /* Find-vendor (step 12): fetch REAL reception venues once on entry — the same
     criteria-based engine the dashboard reception search uses (no eventId). Cached
     after the first load (no re-fetch on back/forward) so the screen doesn't flicker. */
  useEffect(() => {
    if (step !== 12 || venues !== null || venuesLoading) return;
    setVenuesLoading(true);
    searchOnboardingReceptionVenues({
      kind: state.kind,
      faith: state.faith,
      receptionSettings: state.prefs.reception,
    })
      .then((rows) => setVenues(rows))
      .catch(() => setVenues([]))
      .finally(() => setVenuesLoading(false));
  }, [step, venues, venuesLoading, state.kind, state.faith, state.prefs.reception]);

  /* Congrats stat tile #3 — REAL marketplace counts (owner 2026-06-03: "we want
     real numbers only", replacing the fabricated max(categories×5,12) + "2,400+").
     Fires once on step-13 entry; a null result → the tile auto-hides. */
  useEffect(() => {
    if (step !== 13 || vendorCountsTried) return;
    setVendorCountsTried(true);
    getOnboardingVendorCounts({
      kind: state.kind,
      faith: state.faith,
      receptionSettings: state.prefs.reception,
      picks: state.picks,
    })
      .then((c) => setVendorCounts(c))
      .catch(() => setVendorCounts(null));
  }, [step, vendorCountsTried, state.kind, state.faith, state.prefs.reception, state.picks]);

  /* picker chip tap — toggles the pick (multi), latches pickerTouched, updates the sticky preview. */
  const pickChip = (cat: string, label: string) => {
    setPickerPreview({ cat, name: label });
    setState((s) => {
      const has = s.picks.includes(cat);
      return { ...s, picks: has ? s.picks.filter((x) => x !== cat) : [...s.picks, cat], pickerTouched: true };
    });
  };

  const patchPrefs = useCallback(
    (p: Partial<OnboardingState['prefs']>) => setState((s) => ({ ...s, prefs: { ...s.prefs, ...p } })),
    [],
  );

  /* find-vendor (step 12): toggle a reception venue in the shortlist (powers the
     recap count on screen 13). */
  const toggleShortlist = useCallback((vendorId: string, name: string) => {
    setState((s) => {
      const has = s.shortlist.some((v) => v.vendorId === vendorId);
      return {
        ...s,
        shortlist: has
          ? s.shortlist.filter((v) => v.vendorId !== vendorId)
          : [...s.shortlist, { vendorId, name }],
      };
    });
  }, []);

  const selectRole = (r: OnboardingRole) => patch({ role: r });

  const selectKind = (k: OnboardingKind) =>
    patch({ kind: k, faith: k === 'religious' ? ['catholic'] : [] });

  const selectFaith = (f: OnboardingFaith) => {
    if (kind === 'mixed') {
      setState((s) => {
        const has = s.faith.includes(f);
        const next = has ? s.faith.filter((x) => x !== f) : [...s.faith, f];
        return { ...s, faith: next.length > 2 ? next.slice(next.length - 2) : next };
      });
    } else {
      patch({ faith: [f] });
    }
  };

  /* ── name / monogram ── */
  const firstInitial = (s: string) => {
    const w = (s || '').replace(/[^A-Za-z]/g, '');
    return w ? w[0]!.toUpperCase() : '';
  };
  const monoMark = (() => {
    const bi = firstInitial(state.brideFirstName);
    const gi = firstInitial(state.groomFirstName);
    if (bi && gi) return `${bi} & ${gi}`;
    return bi || gi || '··';
  })();
  const bumpMono = () => {
    setMonoPop(true);
    if (popTimer.current) clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => setMonoPop(false), 170);
  };

  /* Couple display name for screens 13 (congrats) + 14 (Your Plan) — prototype [data-couple-name]. */
  const coupleDisplay = [state.brideFirstName.trim(), state.groomFirstName.trim()].filter(Boolean).join(' & ') || 'Maria & Juan';

  /* BYO vendor send (prototype sendByo) — name required → confirmation + relabel the add button. */
  const sendByo = () => {
    const name = byoName.trim();
    if (!name) return;
    const email = byoEmail.trim();
    setByoOpen(false);
    setByoDone(
      `✓ ${name} connected to your wedding. We've linked you on their Setnayan account${email ? ` and emailed ${email}` : ''} — chat, files, your website & day-of all run with them here.`,
    );
    setByoAdded(true);
    setByoName('');
    setByoPerson('');
    setByoEmail('');
  };
  const monoDesign = MONO_DESIGNS[state.monogramDesign] ?? MONO_DESIGNS[0]!;
  const cycleDesign = () => {
    patch({ monogramDesign: (state.monogramDesign + 1) % MONO_DESIGNS.length });
    bumpMono();
  };

  /* ── pax ── */
  const pax = state.pax ?? 150;
  const paxTier = paxTierFor(pax);
  const paxFill = ((Math.min(500, Math.max(10, pax)) - 10) / (500 - 10)) * 100;

  /* ── budget (text box + line picker + band-on-photo · owner 2026-06-02) ── */
  const budgetBandValue = state.budgetBand ?? 'classic';
  const budgetFloorV = budgetFloor(pax); // recommended-lowest for this guest count
  const budgetCeilingV = budgetCeiling(pax);
  const budgetView = (() => {
    const tier = paxTier.t;
    if (budgetBandValue === 'nolimit') {
      return { dataBand: 'luxury', img: `budget/${tier}_luxury`, label: 'No limit', tag: 'No ceiling', rangeText: 'The best of everything' };
    }
    const b = BUDGET_BANDS.find((x) => x.value === budgetBandValue) ?? BUDGET_BANDS[2]!;
    const lo = bandLo(b.med, pax);
    const hi = bandHi(b.med, pax);
    return { dataBand: budgetBandValue, img: `budget/${tier}_${budgetBandValue}`, label: b.label, tag: b.tag, rangeText: `${fmtPeso(lo)} – ${fmtPeso(hi)}` };
  })();
  /* The working-budget value shown in the text box + slider. Their typed/dragged
     amount, else the current band's MAX for the pax (the "set to max of range" default). */
  const budgetEff = effectiveBudgetPesos(budgetBandValue, state.budgetAmount, pax);
  const budgetSliderVal = Math.min(budgetCeilingV, Math.max(budgetFloorV, budgetEff ?? bandHi(5000, pax)));
  const budgetFill =
    budgetCeilingV > budgetFloorV
      ? ((budgetSliderVal - budgetFloorV) / (budgetCeilingV - budgetFloorV)) * 100
      : 0;
  /* Apply a budget choice. Re-seeds the picker (cascade) only when the BAND changes —
     "when i press back and click a new working budget, the recommended on what you love
     need to change as well" (owner 2026-06-02). Amount nudges within a band don't re-seed. */
  const applyBudget = useCallback(
    (band: string, amount: number | null) => {
      const bandChanged = (state.budgetBand ?? 'classic') !== band;
      patch({
        budgetBand: band,
        budgetAmount: amount,
        ...(bandChanged ? { pickerTouched: false } : {}),
      });
    },
    [patch, state.budgetBand],
  );
  const onBudgetBandPill = useCallback(
    (b: { value: string; med: number }) => {
      applyBudget(b.value, b.value === 'nolimit' ? null : bandHi(b.med, pax));
    },
    [applyBudget, pax],
  );
  const onBudgetAmount = useCallback(
    (raw: number) => {
      if (!Number.isFinite(raw)) return;
      const clamped = Math.max(budgetFloorV, Math.min(budgetCeilingV, Math.round(raw)));
      applyBudget(nearestBand(clamped, pax).value, clamped);
    },
    [applyBudget, budgetFloorV, budgetCeilingV, pax],
  );
  /* Text-box buffer: free typing while focused, clamp-to-floor on commit (blur/Enter)
     so the box "won't accept anything lower than the recommended floor" without
     fighting the keystrokes (owner 2026-06-02). When unfocused it mirrors the slider. */
  const [budgetInput, setBudgetInput] = useState('');
  const [budgetFocused, setBudgetFocused] = useState(false);
  const commitBudgetInput = useCallback(() => {
    setBudgetFocused(false);
    const n = Number(budgetInput.replace(/[^\d]/g, ''));
    if (budgetInput.trim() !== '' && Number.isFinite(n) && n > 0) onBudgetAmount(n);
  }, [budgetInput, onBudgetAmount]);

  /* ── per-step chrome ── */
  const canContinue = (() => {
    switch (step) {
      case 0:
        return true;
      case 1:
        return role !== null;
      case 2:
        return kind !== null;
      case 3:
        return isCivil ? true : faith.length >= 1;
      case 4:
        // All four name fields required — they auto-register the couple as the
        // bride + groom guests at commit, and go on the invitation/website/monogram.
        return (
          state.brideFirstName.trim().length > 0 &&
          state.brideLastName.trim().length > 0 &&
          state.groomFirstName.trim().length > 0 &&
          state.groomLastName.trim().length > 0
        );
      case 5:
        return state.dateMode === 'specific' ? state.dateCandidates.length >= 1 : state.windowStart !== null && state.windowEnd !== null;
      case 6:
        return state.region !== null;
      case 7:
        return state.pax !== null;
      case 8:
        return state.budgetBand !== null;
      case 9:
        return state.picks.length > 0;
      case 10:
        return true;
      default:
        return true;
    }
  })();

  /* ── budget tier + label for the palette feel photo (prototype budgetTier/budgetBandLabel) ── */
  const budgetTier = budgetTierBand(state.budgetBand ?? 'classic');
  const budgetLabel = (BUDGET_BANDS.find((x) => x.value === (state.budgetBand ?? 'classic')) ?? BUDGET_BANDS[2]!).label;

  /* Continue label: prefs sub-stepper shows "Looks good" on its last focused screen (prototype showPref). */
  const prefsLabel = prefQueue.length === 0 || prefIdx >= prefQueue.length - 1 ? 'Looks good' : 'Continue';
  const nextLabel =
    step === 10 ? prefsLabel : step === 14 && bundleAdded ? 'Continue to checkout' : NEXT_LABEL[step] ?? 'Continue';

  /* ── kind hero ── */
  const kindPhoto = KIND_PHOTO[kind ?? 'religious'];

  /* ── faith adaptive content (prototype buildFaith) ── */
  const faithView = (() => {
    if (kind === 'civil') {
      return {
        mode: 'civil' as const,
        eyebrow: 'Civil ceremony',
        h1: 'No tradition to set',
        sub: 'A judge or registrar officiates — we’ll skip the faith step.',
        photo: { img: 'wed_civil', cap: 'A civil ceremony' },
      };
    }
    if (kind === 'mixed') {
      return {
        mode: 'mixed' as const,
        eyebrow: 'Your two traditions',
        h1: 'Which two traditions?',
        sub: 'Pick the two faiths you’ll both honor — we’ll match vendors for each and pre-set dietary + protocols for both.',
        photo: { img: 'wed_mixed', cap: 'An interfaith wedding' },
      };
    }
    const firstF = (faith[0] ?? 'catholic') as OnboardingFaith;
    return {
      mode: 'religious' as const,
      eyebrow: 'Your tradition',
      h1: 'Your ceremony tradition',
      sub: 'We’ll match vendors who know your faith’s protocols — and pre-set things like halal catering.',
      photo: FAITH_PHOTO[firstF],
    };
  })();

  /* ── region nugget ── */
  const regionKey = state.region ?? 'ncr';
  const regionNug = { title: `Why ${REGLABEL[regionKey] ?? 'here'}`, line: REGNUG[regionKey] ?? '' };

  const sel = (cond: boolean) => (cond ? ' sel' : '');

  /* ── find-vendor (step 12) + recap (step 13) derived values · WAVE 2 real data ── */
  const receptionKey = state.prefs.reception[0];
  const findSettingLabel = receptionKey ? (RECEPTION_SETTING_LABEL[receptionKey] ?? null) : null;
  const findHeading = findSettingLabel
    ? `${findSettingLabel} venues that fit your wedding.`
    : 'Reception venues that fit your wedding.';
  const starStr = (r: number) => {
    const full = Math.max(0, Math.min(5, Math.round(r)));
    return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full);
  };
  const cap = (s: string | null | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : null);
  const recapDate = (() => {
    if (state.dateMode === 'window' && state.windowStart && state.windowEnd) return 'A flexible window';
    const cands = (state.dateCandidates ?? []).filter(Boolean);
    if (cands.length === 1) {
      try {
        return new Date(cands[0]! + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        return cands[0]!;
      }
    }
    if (cands.length > 1) return `${cands.length} possible dates`;
    return 'To be set';
  })();
  const recapWhere = REGLABEL[state.region ?? 'ncr'] ?? 'Philippines';
  const recapGuests = state.pax != null ? String(state.pax) : '—';
  const recapStyle = [findSettingLabel, cap(state.prefs.feel)].filter(Boolean).join(' · ') || '—';
  const shortlistCount = state.shortlist.length;
  /* live per-couple savings — replaces the hardcoded demo strip (owner 2026-06-02) */
  const savings = computeOnboardingSavings(state, new Date());

  /* ── Phase-5 lazy DB commit (events + event_members), then to the dashboard ──
     The account gate's OAuth/email actions round-trip back here via this `next`. */
  const RESUME_NEXT = '/onboarding/wedding?resume=1';
  const buildCommitPayload = useCallback(
    (s: OnboardingState): OnboardingCommitPayload => ({
      brideFirstName: s.brideFirstName,
      brideLastName: s.brideLastName,
      groomFirstName: s.groomFirstName,
      groomLastName: s.groomLastName,
      kind: s.kind,
      faith: s.faith,
      region: s.region,
      pax: s.pax,
      budgetBand: s.budgetBand,
      budgetAmountCentavos:
        (() => {
          const pesos = effectiveBudgetPesos(s.budgetBand ?? 'classic', s.budgetAmount, s.pax ?? 150);
          return pesos == null ? null : Math.round(pesos * 100);
        })(),
      dateMode: s.dateMode,
      dateCandidates: s.dateCandidates,
      windowStart: s.windowStart,
      windowEnd: s.windowEnd,
      monogramFrameKey: MONO_DESIGNS[s.monogramDesign]?.frame ?? null,
      monogramFontKey: MONO_DESIGNS[s.monogramDesign]?.font ?? null,
      moodFeelKey: s.prefs.feel,
      musicPlaylistSeed: s.prefs.music,
      // Phase A: persist the picker selections (auto-inquired best-fit per
      // category at commit) + the reception setting (seeds venue_setting).
      picks: s.picks,
      receptionSettings: s.prefs.reception,
      // The find-vendor shortlist (real reception venues the couple tapped) —
      // persisted as event_vendors 'considering' so they show on the Services tab.
      shortlist: s.shortlist.map((v) => ({ vendorId: v.vendorId, name: v.name })),
      // The full style sub-stepper prefs blob → events.style_preferences for
      // DISPLAY on the Home "Personalized for you" card (the features that
      // matter for the different services). Display only, not vendor matching.
      // Cast: OnboardingPrefs is a fixed-key interface (no index signature),
      // so it needs an explicit widen to the payload's Record<string, unknown>.
      stylePreferences: { ...s.prefs } as Record<string, unknown>,
    }),
    [],
  );

  /* Cycle the analyzing-overlay status line while finishing (reads as real work). */
  useEffect(() => {
    if (!finishing) {
      setFinStage(0);
      return;
    }
    const id = window.setInterval(() => {
      setFinStage((s) => Math.min(s + 1, ANALYZING_STAGES.length - 1));
    }, 720);
    return () => window.clearInterval(id);
  }, [finishing]);

  const handleFinish = useCallback(async () => {
    if (committingRef.current) return;
    setCommitError(null);

    // Preload the dashboard + every tab the couple might click, then hold the
    // analyzing overlay a beat so the prefetches warm before we navigate. The
    // overlay covers everything until the dashboard actually swaps in — no flash
    // of the onboarding underneath + no click-lag on Home/Guests/Services/Website/
    // More once they land (owner 2026-06-02).
    const goToDashboard = (eventId: string) => {
      const base = `/dashboard/${eventId}`;
      try {
        router.prefetch(base); // Home
        router.prefetch(`${base}/guests`); // Guests
        router.prefetch(`${base}/vendors`); // Services
        router.prefetch(`${base}/website`); // Website
        router.prefetch(`${base}/more`); // More
      } catch {
        /* prefetch is best-effort */
      }
      window.setTimeout(() => router.push(base), ANALYZING_HOLD_MS);
    };

    // Idempotent: event already exists (back-then-forward) — show the overlay + go.
    if (committedEventId) {
      setFinishing(true);
      try {
        localStorage.removeItem(ONBOARDING_DRAFT_KEY);
      } catch {
        /* non-fatal */
      }
      goToDashboard(committedEventId);
      return;
    }

    // Lock the screen the instant they tap finish — the overlay covers the whole
    // commit + preload so the customer can't touch anything (owner 2026-06-02).
    setFinishing(true);
    committingRef.current = true;
    setCommitting(true);
    const res = await commitOnboardingWedding(buildCommitPayload(state));
    committingRef.current = false;
    setCommitting(false);
    if (res.ok) {
      setCommittedEventId(res.eventId);
      try {
        localStorage.removeItem(ONBOARDING_DRAFT_KEY);
      } catch {
        /* non-fatal */
      }
      // DON'T reset the in-memory state here. setState({...EMPTY_ONBOARDING_STATE})
      // flips step→0, which flashed the welcome screen under the overlay before
      // navigation (owner 2026-06-02: "it initially loaded to the first screen of
      // the onboarding before it proceeded to the dashboard"). Clearing the draft
      // above already makes a re-open blank; the committedEventId guard keeps the
      // persist effect from re-writing it. The overlay stays up, then we navigate.
      goToDashboard(res.eventId);
    } else if (res.error === 'not_authenticated') {
      // Session lost mid-flow — drop the overlay + bounce to the account gate.
      setFinishing(false);
      setCommitError('Please create your account to save your plan.');
      setState((s) => ({ ...s, step: 11 }));
    } else {
      // Surface the error + let them retry — don't strand them on the overlay.
      setFinishing(false);
      setCommitError('Something went wrong saving your plan. Please try again.');
    }
  }, [committedEventId, state, buildCommitPayload, router]);

  return (
    <div className="onbw">
      {/* Blocking completion overlay — covers the whole viewport so the customer
          can't touch anything while we create the event + preload the dashboard
          (owner 2026-06-02). Stays up until the dashboard navigation swaps in. */}
      {finishing && (
        <div className="fin-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="fin-inner">
            <svg className="fin-mark" viewBox="0 0 5333.3335 5333.3335" role="img" aria-label="Setnayan">
              <path
                d="M 1859.526,3749.781 C 1458.028,3717.757 1065.454,3548.554 758.3406,3241.44 451.2286,2934.328 282.2397,2541.742 250.2195,2140.255 l 1326.8215,1.536 V 661.7647 C 1368.543,727.4195 1172.067,841.5416 1006.804,1006.804 768.3191,1245.29 633.8543,1548.261 602.7217,1859.526 H 250 C 282.024,1458.028 451.2265,1065.455 758.3406,758.3406 1065.453,451.2287 1458.039,282.2396 1859.526,250.2195 V 2422.739 H 661.7647 c 65.6549,208.498 179.7773,404.975 345.0393,570.237 238.486,238.486 541.457,372.95 852.722,404.083 z m 280.948,0 1.537,-1609.307 h 280.948 v 1197.761 c 208.498,-65.655 404.974,-179.776 570.237,-345.039 238.485,-238.486 372.95,-541.457 404.082,-852.722 H 3750 c -32.024,401.498 -201.226,794.071 -508.341,1101.185 -307.112,307.112 -699.697,476.101 -1101.185,508.122 z m 0,-1890.255 c 32.025,-401.498 201.227,-794.073 508.341,-1101.1854 0.658,-0.6584 1.316,-1.3173 1.975,-1.9754 -80.395,-42.041 -163.892,-76.0428 -249.331,-101.7389 -85.439,-25.696 -172.821,-43.0864 -260.985,-51.9046 V 250.2195 c 401.497,32.0253 794.073,201.0094 1101.185,508.1211 307.114,307.1134 476.317,699.6874 508.341,1101.1854 h -352.722 c -31.132,-311.265 -165.597,-614.236 -404.082,-852.722 -15.719,-15.7189 -32.464,-29.741 -48.727,-44.5564 -15.975,14.4789 -31.774,29.1397 -47.191,44.5564 -238.485,238.486 -372.95,541.457 -404.082,852.722 z"
                fill="#cb9e4b"
                fillRule="nonzero"
                transform="matrix(1.3333333,0,0,-1.3333333,0,5333.3333)"
              />
            </svg>
            <div className="fin-spinner" aria-hidden="true" />
            <div className="fin-title">Creating your personalized dashboard</div>
            <div className="fin-sub">{ANALYZING_STAGES[finStage]}</div>
          </div>
        </div>
      )}
      <div className="phone">
        {/* top — brand + progress */}
        <div className="top">
          <div className="brandrow">
            <button
              className="btn-back"
              type="button"
              onClick={() => go(-1)}
              aria-label="Back"
              style={{ display: step === 0 ? 'none' : 'inline-flex' }}
            >
              {'‹'}
            </button>
            <span className="brandlock">
              <svg className="blmark-img" viewBox="0 0 5333.3335 5333.3335" role="img" aria-label="Setnayan">
                <path
                  d="M 1859.526,3749.781 C 1458.028,3717.757 1065.454,3548.554 758.3406,3241.44 451.2286,2934.328 282.2397,2541.742 250.2195,2140.255 l 1326.8215,1.536 V 661.7647 C 1368.543,727.4195 1172.067,841.5416 1006.804,1006.804 768.3191,1245.29 633.8543,1548.261 602.7217,1859.526 H 250 C 282.024,1458.028 451.2265,1065.455 758.3406,758.3406 1065.453,451.2287 1458.039,282.2396 1859.526,250.2195 V 2422.739 H 661.7647 c 65.6549,208.498 179.7773,404.975 345.0393,570.237 238.486,238.486 541.457,372.95 852.722,404.083 z m 280.948,0 1.537,-1609.307 h 280.948 v 1197.761 c 208.498,-65.655 404.974,-179.776 570.237,-345.039 238.485,-238.486 372.95,-541.457 404.082,-852.722 H 3750 c -32.024,401.498 -201.226,794.071 -508.341,1101.185 -307.112,307.112 -699.697,476.101 -1101.185,508.122 z m 0,-1890.255 c 32.025,-401.498 201.227,-794.073 508.341,-1101.1854 0.658,-0.6584 1.316,-1.3173 1.975,-1.9754 -80.395,-42.041 -163.892,-76.0428 -249.331,-101.7389 -85.439,-25.696 -172.821,-43.0864 -260.985,-51.9046 V 250.2195 c 401.497,32.0253 794.073,201.0094 1101.185,508.1211 307.114,307.1134 476.317,699.6874 508.341,1101.1854 h -352.722 c -31.132,-311.265 -165.597,-614.236 -404.082,-852.722 -15.719,-15.7189 -32.464,-29.741 -48.727,-44.5564 -15.975,14.4789 -31.774,29.1397 -47.191,44.5564 -238.485,238.486 -372.95,541.457 -404.082,852.722 z"
                  fill="#cb9e4b"
                  fillRule="nonzero"
                  transform="matrix(1.3333333,0,0,-1.3333333,0,5333.3333)"
                />
              </svg>
              <span className="wm">SETNAYAN</span>
            </span>
            <button
              className="skip"
              type="button"
              onClick={() => go(1)}
              style={{ display: CAN_SKIP[step] ? 'inline-block' : 'none' }}
            >
              Skip
            </button>
          </div>
          <div className="bar">
            <div className="barfill" style={{ width: `${((step + 1) / FLOW_TOTAL) * 100}%` }} />
          </div>
        </div>

        {/* body — only the active screen displays */}
        <div className="body">
          {/* 1 WELCOME */}
          <section className={`screen welcomescreen${step === 0 ? ' active' : ''}`}>
            <div className="welcomehero">
              <HeroImg src={ASSET('welcome')} />
              <div className="welcomeoverlay">
                <h1>Let{'’'}s plan your wedding.</h1>
                <p>
                  A few quick questions and we{'’'}ll build a plan made for <i>your</i> day
                  {' — '}every vendor sorted to fit. Free to start, always.
                </p>
              </div>
            </div>
          </section>

          {/* 2 ROLE */}
          <section className={`screen${step === 1 ? ' active' : ''}`} id="screen-role">
            <div className="viewzone">
              <div className="eyebrow">About you</div>
              <h1 className="q">Who are you in this wedding?</h1>
              <p className="sub">This account is just you {'—'} your partner can join as a co-host anytime.</p>
              <figure className="rolephoto">
                <HeroImg src={ASSET('role')} />
                <figcaption className="rolecap">
                  <span className="rolecapline">You and your people.</span>
                </figcaption>
              </figure>
            </div>
            <div className="tapzone">
              <div className="stack" data-single="">
                {ROLE_OPTIONS.map((o) => (
                  <div key={o.value} className={`opt${sel(role === o.value)}`} onClick={() => selectRole(o.value)}>
                    <div className="otrow">
                      <div className="ot">{o.title}</div>
                      <span className="check" />
                    </div>
                    <div className="od">{o.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 3 KIND */}
          <section className={`screen${step === 2 ? ' active' : ''}`} id="screen-kind">
            <div className="viewzone">
              <div className="eyebrow">Your wedding</div>
              <h1 className="q">What kind of wedding?</h1>
              <p className="sub">This shapes your timeline, your paperwork, and which vendors we show.</p>
              <figure className="kindphoto">
                <HeroImg src={ASSET(kindPhoto.img)} />
                <figcaption className="kindcap">
                  <span className="kindcapline">{kindPhoto.cap}</span>
                </figcaption>
              </figure>
            </div>
            <div className="tapzone">
              <div className="stack" data-single="">
                {KIND_OPTIONS.map((o) => (
                  <div key={o.value} className={`opt${sel(kind === o.value)}`} onClick={() => selectKind(o.value)}>
                    <div className="otrow">
                      <div className="ot">{o.title}</div>
                      <span className="check" />
                    </div>
                    <div className="od">{o.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 4 FAITH — adaptive */}
          <section className={`screen${step === 3 ? ' active' : ''}`} id="screen-faith">
            <div className="viewzone">
              <div className="eyebrow">
                {faithView.eyebrow}
                {faithView.mode === 'mixed' && <span className="tag new">Interfaith</span>}
              </div>
              <h1 className="q">{faithView.h1}</h1>
              <p className="sub">{faithView.sub}</p>
              <figure className="faithphoto">
                <HeroImg src={ASSET(faithView.photo.img)} />
                <figcaption className="faithcap">
                  <span className="faithcapline">{faithView.photo.cap}</span>
                </figcaption>
              </figure>
            </div>
            <div className="tapzone">
              {faithView.mode === 'civil' ? (
                <div className="note">
                  <span>{'✦'}</span>
                  <div>
                    <b>Civil ceremony</b> {'—'} no religious tradition to set. We{'’'}ll skip this step in the real flow.
                  </div>
                </div>
              ) : (
                <div className="chips" {...(faithView.mode === 'religious' ? { 'data-single': '' } : { 'data-max': '2' })}>
                  {FAITH_CHIPS.map((c) => (
                    <span
                      key={c.value}
                      className={`chip${sel(faith.includes(c.value))}${c.soon ? ' is-soon' : ''}`}
                      onClick={c.soon ? undefined : () => selectFaith(c.value)}
                      aria-disabled={c.soon || undefined}
                    >
                      {c.label}
                      {c.soon && <span className="soon">soon</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* 5 NAME — live monogram + Frame/Font cyclers + bride/groom */}
          <section className={`screen${step === 4 ? ' active' : ''}`} id="screen-name">
            <div className="viewzone">
              <div className="eyebrow">Your wedding</div>
              <h1 className="q">The two of you.</h1>
              <p className="sub">Bride &amp; groom — it goes on your invitation, website &amp; monogram.</p>
              <figure className="monogram">
                <div
                  className={`mono-mark${monoMark.length > 2 ? ' long' : ''}`}
                  data-frame={monoDesign.frame}
                  data-font={monoDesign.font}
                  data-ink={monoDesign.ink}
                  style={monoPop ? { transform: 'scale(1.05)' } : undefined}
                >
                  <span className="mono-letters">{monoMark}</span>
                </div>
              </figure>
            </div>
            <div className="tapzone">
              <div className="mono-controls">
                <button type="button" className="mono-btn mono-gen" onClick={cycleDesign}>
                  <span className="ic" aria-hidden="true">{'↻'}</span> Generate another design
                </button>
                <span className="mono-count" aria-hidden="true">
                  {state.monogramDesign + 1} / {MONO_DESIGNS.length}
                </span>
              </div>
              <div className="namepair">
                <label className="nl">
                  <span className="nlk">Bride</span>
                  <input
                    className="field nf"
                    placeholder="First"
                    autoComplete="off"
                    autoCapitalize="words"
                    inputMode="text"
                    required
                    aria-required="true"
                    value={state.brideFirstName}
                    onChange={(e) => {
                      patch({ brideFirstName: sanitizeName(e.target.value) });
                      bumpMono();
                    }}
                  />
                  <input
                    className="field nf"
                    placeholder="Last"
                    autoComplete="off"
                    autoCapitalize="words"
                    inputMode="text"
                    required
                    aria-required="true"
                    value={state.brideLastName}
                    onChange={(e) => patch({ brideLastName: sanitizeName(e.target.value) })}
                  />
                </label>
                <label className="nl">
                  <span className="nlk">Groom</span>
                  <input
                    className="field nf"
                    placeholder="First"
                    autoComplete="off"
                    autoCapitalize="words"
                    inputMode="text"
                    required
                    aria-required="true"
                    value={state.groomFirstName}
                    onChange={(e) => {
                      patch({ groomFirstName: sanitizeName(e.target.value) });
                      bumpMono();
                    }}
                  />
                  <input
                    className="field nf"
                    placeholder="Last"
                    autoComplete="off"
                    autoCapitalize="words"
                    inputMode="text"
                    required
                    aria-required="true"
                    value={state.groomLastName}
                    onChange={(e) => patch({ groomLastName: sanitizeName(e.target.value) })}
                  />
                </label>
              </div>
            </div>
          </section>

          {/* 6 DATE — 2-mode calendar + why-this-date nugget */}
          <section className={`screen${step === 5 ? ' active' : ''}`}>
            <div className="viewzone">
              <div className="eyebrow">Your wedding</div>
              <h1 className="q">When{'’'}s the big day?</h1>
            </div>
            <div className="tapzone">
              <DateCalendar
                mode={state.dateMode}
                candidates={state.dateCandidates}
                windowStart={state.windowStart}
                windowEnd={state.windowEnd}
                onChange={patch}
              />
            </div>
          </section>

          {/* 7 REGION — top-5 + Somewhere-else expand + 13 more + nugget */}
          <section className={`screen${step === 6 ? ' active' : ''}`} id="screen-region">
            <div className="viewzone">
              <div className="eyebrow">Where</div>
              <h1 className="q">Where will it be?</h1>
              <p className="sub">Top PH wedding regions — or open the full list. We only show vendors who cover your area.</p>
              <div className="regnug">
                <span className="ic" aria-hidden="true">{'✦'}</span>
                <div className="regnug-tx">
                  <div className="rt">{regionExpanded && !REGION_MORE.includes(regionKey) ? 'Anywhere in the Philippines' : regionNug.title}</div>
                  <div className="rl">{regionExpanded && !REGION_MORE.includes(regionKey) ? 'Pick your region below — we match you with vendors who cover your area.' : regionNug.line}</div>
                </div>
              </div>
            </div>
            <div className="tapzone">
              {!regionExpanded && (
                <div className="stack">
                  {REGION_TOP.map((o) => (
                    <div
                      key={o.value}
                      className={`opt rowimg${sel(state.region === o.value)}`}
                      onClick={() => patch({ region: o.value })}
                    >
                      <div className="otcol">
                        <div className="ot">{o.title}</div>
                        <div className="od">{o.desc}</div>
                      </div>
                      <span className="check" />
                    </div>
                  ))}
                </div>
              )}
              <div
                className={`opt rowimg${regionExpanded ? ' expanded' : ''}`}
                onClick={() => setRegionExpanded((v) => !v)}
              >
                <div className="otcol">
                  <div className="ot">Somewhere else</div>
                  <div className="od">Open every region — match by area.</div>
                </div>
                <span className="check" />
              </div>
              {regionExpanded && (
                <div>
                  <div className="moreback" onClick={() => setRegionExpanded(false)}>‹ Show top regions</div>
                  <div className="regiongrid">
                    {REGION_MORE.map((r) => (
                      <span
                        key={r}
                        className={`regopt${sel(state.region === r)}`}
                        onClick={() => patch({ region: r })}
                      >
                        {REGLABEL[r]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 8 PAX — slider + exact box + tier photo */}
          <section className={`screen${step === 7 ? ' active' : ''}`} id="screen-pax">
            <div className="viewzone">
              <div className="eyebrow">The day</div>
              <h1 className="q">How many guests?</h1>
              <p className="sub">Your starting headcount, shared with vendors — be as specific as you can for the best matches.</p>
              <figure className="paxphoto" data-tier={paxTier.t}>
                <HeroImg src={ASSET(`pax/${paxTier.t}`)} />
                <figcaption className="paxcap">
                  <span className="paxcaptag">{paxTier.tag}</span>
                  <span className="paxcapline">{paxTier.line}</span>
                </figcaption>
              </figure>
            </div>
            <div className="tapzone">
              <div className="paxreadout">
                <span>{pax}</span> <small>{pax === 1 ? 'guest' : 'guests'}</small>
              </div>
              <input
                type="range"
                min={10}
                max={500}
                value={Math.min(500, Math.max(10, pax))}
                className="paxslider"
                aria-label="Guest count slider"
                style={{ background: `linear-gradient(to right,var(--gold) 0%,var(--gold) ${paxFill}%,#e7dfce ${paxFill}%,#e7dfce 100%)` }}
                onChange={(e) => patch({ pax: parseInt(e.target.value, 10) })}
              />
              <div className="paxends"><span>10{'−'}</span><span>500+</span></div>
              <div className="paxexactwrap">
                <span className="paxexactlbl">Exact count</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="paxexactinput"
                  placeholder="type your count"
                  value={state.pax == null ? '' : state.pax.toLocaleString('en-US')}
                  onChange={(e) => {
                    const d = e.target.value.replace(/[^\d]/g, '');
                    patch({ pax: d === '' ? null : parseInt(d, 10) });
                  }}
                />
              </div>
            </div>
          </section>

          {/* 9 BUDGET — feel-band chips + a look photo keyed to pax-tier × band */}
          <section className={`screen${step === 8 ? ' active' : ''}`} id="screen-budget">
            <div className="viewzone">
              <div className="eyebrow">The day</div>
              <h1 className="q">Your working budget?</h1>
              <p className="sub">Set your number — we{'’'}ll show the feel it buys for ~{pax} guests.</p>
              <figure className="budgetphoto budgetphoto--compact" data-band={budgetView.dataBand}>
                <HeroImg src={ASSET(budgetView.img)} />
                <figcaption className="budgetcap">
                  <span className="budgetcaptag">{budgetView.label} budget · {pax} pax</span>
                  <span className="budgetcapsub">{budgetView.tag}</span>
                  <span className="budgetcaprange">{budgetView.rangeText}</span>
                </figcaption>
              </figure>
            </div>
            <div className="tapzone">
              {budgetBandValue === 'nolimit' ? (
                <div className="bdg-nolimit-row">
                  <span className="bdg-nolimit-note">No ceiling — the best of everything.</span>
                  <button type="button" className="bdg-nolimit-exit" onClick={() => onBudgetAmount(budgetCeilingV)}>
                    Set a budget instead
                  </button>
                </div>
              ) : (
                <>
                  {/* Swapped 2026-06-02 (owner): line picker (slider + its min/No-limit/max
                      labels) on top, precise amount text box below — matches the guest-count
                      screen's slider→ends→exact-box order. */}
                  <input
                    type="range"
                    min={budgetFloorV}
                    max={budgetCeilingV}
                    step={10000}
                    value={budgetSliderVal}
                    className="paxslider"
                    aria-label="Working budget slider"
                    style={{
                      background: `linear-gradient(to right,var(--gold) 0%,var(--gold) ${budgetFill}%,#e7dfce ${budgetFill}%,#e7dfce 100%)`,
                    }}
                    onChange={(e) => onBudgetAmount(Number(e.target.value))}
                  />
                  <div className="paxends">
                    <span>{fmtPeso(budgetFloorV)} min</span>
                    <button type="button" className="bdg-nolimit" onClick={() => applyBudget('nolimit', null)}>
                      No limit
                    </button>
                    <span>{fmtPeso(budgetCeilingV)}+</span>
                  </div>
                  <div className="paxexactwrap bdg-amtwrap">
                    <span className="paxexactlbl">Your budget</span>
                    <span className="bdg-peso">₱</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="paxexactinput bdg-amtinput"
                      aria-label="Working budget in pesos"
                      value={budgetFocused ? groupDigits(budgetInput) : budgetSliderVal.toLocaleString('en-US')}
                      onFocus={() => {
                        setBudgetFocused(true);
                        setBudgetInput(String(budgetSliderVal));
                      }}
                      onChange={(e) => setBudgetInput(e.target.value.replace(/[^\d]/g, ''))}
                      onBlur={commitBudgetInput}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* 9 PICKER — "What would you love?" (53 services grouped by the 10 parents) */}
          <section className={`screen${step === 9 ? ' active' : ''}`} id="screen-picker">
            <div className="eyebrow">What you{'’'}re after</div>
            <h1 className="q" style={{ marginBottom: 18 }}>What would you love?</h1>
            <div className="picker-preview" id="pickerPreview" data-cat={pickerPreview.cat}>
              <div className="pp-photo">
                <HeroImg src={PICKER_ASSET(pickerPreview.cat)} />
                <div className="pp-cap">
                  <div className="pp-cat" id="ppCat">{(PICK_INFO[pickerPreview.cat]?.g ?? '').toUpperCase()}</div>
                  <div className="pp-name" id="ppName">{pickerPreview.name}</div>
                </div>
              </div>
              <div className="pp-desc" id="ppDesc">{PICK_INFO[pickerPreview.cat]?.d ?? ''}</div>
            </div>
            <p className="picker-sub">Tap everything you want — preview what each one provides above.</p>
            {PICK_GROUPS.map((g) => (
              <div key={g.label}>
                <div className="grouplbl">{g.label}</div>
                {g.rows.map((row, ri) => (
                  <div className="chips" key={`${g.label}-${ri}`}>
                    {row.map((c) => (
                      <span key={c.cat} className={`chip${sel(state.picks.includes(c.cat))}`} data-cat={c.cat} onClick={() => pickChip(c.cat, c.label)}>
                        {c.label}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </section>

          {/* 10 PREFERENCES — style sub-stepper (one focused screen per picked dimension) */}
          <section className={`screen${step === 10 ? ' active' : ''}`} id="screen-prefs">
            <StyleSubStepper
              queue={prefQueue}
              idx={prefIdx}
              faith={faith}
              budgetTier={budgetTier}
              budgetLabel={budgetLabel}
              prefs={state.prefs}
              onPrefs={patchPrefs}
            />
          </section>

          {/* 11 ACCOUNT — the auth gate for anonymous marketing visitors. Signed-in
              customers (dashboard "Add event → Wedding") skip this screen (see go()).
              Reuses the site's existing OAuth + signup server actions; `next`
              round-trips back to /onboarding/wedding?resume=1 so the shell restores
              the localStorage draft + advances to find-vendor. The DB commit fires
              later at the final button (handleFinish), always with an authed user. */}
          <section className={`screen${step === 11 ? ' active' : ''}`} id="screen-account">
            <div className="welcome" style={{ paddingTop: 24 }}>
              <div className="mark">✓</div>
              <h1 style={{ fontSize: 34 }}>Your plan is ready.</h1>
              <p style={{ marginBottom: 24 }}>Create your free account to keep it {'—'} and start finding your vendors.</p>
            </div>
            <div className="stack">
              <form action={signInWithGoogle}>
                <input type="hidden" name="next" value={RESUME_NEXT} />
                <button
                  className="opt"
                  type="submit"
                  style={{ width: '100%', font: 'inherit', cursor: 'pointer', textAlign: 'center', justifyContent: 'center' }}
                >
                  <div className="ot" style={{ justifyContent: 'center', width: '100%' }}>Continue with Google</div>
                </button>
              </form>
              <form action={signInWithFacebook}>
                <input type="hidden" name="next" value={RESUME_NEXT} />
                <button
                  className="opt"
                  type="submit"
                  style={{ width: '100%', font: 'inherit', cursor: 'pointer', textAlign: 'center', justifyContent: 'center' }}
                >
                  <div className="ot" style={{ justifyContent: 'center', width: '100%' }}>Continue with Facebook</div>
                </button>
              </form>
            </div>
            {emailMode ? (
              <form action={signUp} style={{ margin: '14px 0 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input type="hidden" name="next" value={RESUME_NEXT} />
                <input type="hidden" name="account_type" value="customer" />
                <input type="hidden" name="public_summary_consent" value="yes" />
                <input
                  className="field"
                  name="email"
                  type="email"
                  required
                  placeholder="your@email.com"
                  style={{ fontFamily: 'var(--sans)', fontStyle: 'normal', fontSize: 15 }}
                />
                <input
                  className="field"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Create a password (8+ characters)"
                  style={{ fontFamily: 'var(--sans)', fontStyle: 'normal', fontSize: 15 }}
                />
                <button className="byo-send" type="submit">Create account</button>
              </form>
            ) : (
              <div className="ghost" onClick={() => setEmailMode(true)} style={{ cursor: 'pointer' }}>
                <u>Use email instead</u>
              </div>
            )}
          </section>

          {/* 12 FIND FIRST VENDOR — REAL reception venues from the marketplace
              (criteria search, no eventId · WAVE 2). Tap to shortlist → recap count. */}
          <section className={`screen${step === 12 ? ' active' : ''}`} id="screen-find">
            <div className="eyebrow">Find your first vendor</div>
            <h1 className="q" style={{ fontSize: 30 }}>{findHeading}</h1>
            <p className="sub">Sorted for you: your style first, then everyone available. <b>Tap one to shortlist.</b></p>
            {venuesLoading && (
              <div className="vload">Finding reception venues that fit your wedding…</div>
            )}
            {!venuesLoading && venues && venues.length > 0 && (
              <>
                <div className="grouplbl">★ Matches your preference</div>
                {venues.map((v) => {
                  const picked = state.shortlist.some((s) => s.vendorId === v.vendorId);
                  const hasRating = v.rating != null && v.reviewCount != null && v.reviewCount > 0;
                  return (
                    <div
                      key={v.vendorId}
                      className={`vcard${picked ? ' picked' : ''}`}
                      onClick={() => toggleShortlist(v.vendorId, v.name)}
                    >
                      <div
                        className="vimg"
                        style={v.photoUrl ? { backgroundImage: `url(${v.photoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                      >
                        <div className="vbadges">{v.verified && <span className="vbadge green">Verified</span>}</div>
                      </div>
                      <div className="vbody">
                        <div className="vname">{v.name}</div>
                        <div className="vmeta">
                          {hasRating && (
                            <>
                              <span className="stars">{starStr(v.rating!)}</span> {v.rating!.toFixed(1)} ({v.reviewCount})
                              {v.city ? ' · ' : ''}
                            </>
                          )}
                          {v.city && <span>{v.city}</span>}
                        </div>
                        <div className="eyeing">
                          {picked ? <span className="shortpill">✓ Shortlisted</span> : <span className="shorthint">Tap to shortlist</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
            {!venuesLoading && venues && venues.length === 0 && (
              <div className="vempty">
                We{'’'}re still onboarding reception venues for your area. Add your own below, or browse the full marketplace from your dashboard anytime.
              </div>
            )}
            <div className="byowrap">
              <button className="byo-add" type="button" onClick={() => setByoOpen(true)}>{byoAdded ? '+ Add another venue' : '+ Add your own venue'}</button>
              {byoDone && <div className="byo-done">{byoDone}</div>}
            </div>
          </section>

          {/* 13 STARTING PLAN — congrats + savings counter (counts up on entry) */}
          <section className={`screen${step === 13 ? ' active' : ''}`} id="screen-congrats">
            <div className="eyebrow">You did the hard part</div>
            <h1 className="q" style={{ fontSize: 29 }}>Congratulations,<br /><span>{coupleDisplay}</span>.</h1>
            <p className="sub">You&apos;ve done the most crucial part — your whole wedding is on track. From here, we help you finish, so you can focus on everything else.</p>
            {/* SAVINGS — money + hours computed live per couple (Time_and_Money_Saved_Model_2026-06-01.md §D).
                Vendor tile = REAL marketplace counts (owner 2026-06-03: "we want real numbers only"); auto-hides when uncomputable. */}
            <div className="statstrip">
              <div className="stat"><CountUp value={savings.money} prefix="₱" active={step === 13} /><span>saved with Setnayan — free</span></div>
              <div className="stat"><CountUp value={savings.hours} active={step === 13} /><span>hours saved vs planning alone</span></div>
              {vendorCounts && (
                <div className="stat"><CountUp value={vendorCounts.matched} active={step === 13} /><span>that fit your wedding · from {vendorCounts.total.toLocaleString()}</span></div>
              )}
            </div>
            <div className="recap tight">
              <div className="recapline"><span className="rk">Wedding</span><span className="rv">{coupleDisplay}</span></div>
              <div className="recapline"><span className="rk">Date</span><span className="rv">{recapDate}</span></div>
              <div className="recapline"><span className="rk">Where</span><span className="rv">{recapWhere}</span></div>
              <div className="recapline"><span className="rk">Guests</span><span className="rv">{recapGuests}</span></div>
              <div className="recapline"><span className="rk">Style</span><span className="rv">{recapStyle}</span></div>
              <div className="recapline"><span className="rk">Shortlisted</span><span className="rv">{shortlistCount} {shortlistCount === 1 ? 'venue' : 'venues'}</span></div>
            </div>
            <div className="note mul"><span>✦</span><div>Change or switch off any of your personalization anytime in <b>Personalize my matches</b> on your Home.</div></div>
          </section>

          {/* 14 YOUR PLAN — freebies + the budget-matched bundle */}
          <section className={`screen${step === 14 ? ' active' : ''}`} id="screen-plan">
            <div className="eyebrow">Your plan</div>
            <h1 className="q" style={{ fontSize: 31, lineHeight: 1.08 }}><span>{coupleDisplay}</span></h1>
            <p className="sub" style={{ marginTop: -3 }}>Your wedding, planned.</p>
            <div className="plansave">
              <div className="ps-amt"><CountUp value={savings.money} prefix="₱" active={step === 14} /> <span className="ps-and">·</span> <CountUp value={savings.hours} suffix=" hrs" active={step === 14} /></div>
              <div className="ps-lbl">already saved — free, just by planning here</div>
            </div>
            <div className="planfree">
              <div className="ph">All your freebies</div>
              <div className="pp">Everything below is yours — ₱0, forever.</div>
              <div className="freeli">
                <b>Your dashboard</b> · <b>vendor marketplace</b> + shortlist + side-by-side compare · <b>free wedding website</b> (RSVP · event site · editorial) · <b>mood board</b> · guest list · seat plan · budget tracker · basic monogram · smart vendor matching · real reviews · <b>verified-vendor safety</b> · in-app vendor chat · day-of guest portal · multi-host co-planning · <b>photos synced to your Google Drive</b>.
              </div>
            </div>
            <div className="grouplbl">Matched to your wedding</div>
            <MatchedBundle band={state.budgetBand ?? 'classic'} added={bundleAdded} onAdd={() => setBundleAdded(true)} />
            {!bundleAdded && <div className="plan-skip" id="planSkip">or <u>continue with the free plan</u></div>}
          </section>
        </div>

        {/* bottom — primary CTA. Phase-5: step 14 (Your Plan) is terminal — it
            commits the event + redirects to the dashboard (handleFinish). The
            account gate (11) hides the primary button for anonymous visitors —
            the screen's own OAuth/email forms carry the action; authed users
            skip 11 entirely so its button never renders. */}
        <div className="bottom">
          {commitError && (
            <p style={{ color: 'var(--mulberry)', fontSize: 13, margin: '0 0 8px', textAlign: 'center' }}>
              {commitError}
            </p>
          )}
          {!(step === 11 && !authed) && (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                if (!canContinue || committing) return;
                if (step === 14) {
                  void handleFinish();
                  return;
                }
                go(1);
              }}
              disabled={!canContinue || committing}
              style={!canContinue || committing ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
            >
              {committing ? 'Creating your plan…' : nextLabel}
            </button>
          )}
        </div>

        {/* BYO vendor — bottom-sheet popup (prototype #byoSheet/#byoBackdrop · vendor_invites auto-connect, CLAUDE.md 2026-05-19) */}
        <div className={`sheet-backdrop${byoOpen ? ' open' : ''}`} onClick={() => setByoOpen(false)} />
        <div className={`sheet${byoOpen ? ' open' : ''}`} role="dialog" aria-label="Add your own vendor">
          <div className="sheet-handle" />
          <div className="sheet-h">Add your own vendor</div>
          <div className="sheet-sub">We&apos;ll connect you to them on Setnayan.</div>
          <label className="byo-l"><span className="byo-lk">Vendor name</span><input className="field" value={byoName} onChange={(e) => setByoName(e.target.value)} placeholder="e.g. Bloom & Co. Florals" /></label>
          <label className="byo-l"><span className="byo-lk">Contact person</span><input className="field" value={byoPerson} onChange={(e) => setByoPerson(e.target.value)} placeholder="Who you talk to" /></label>
          <label className="byo-l"><span className="byo-lk">Email address</span><input className="field" type="email" value={byoEmail} onChange={(e) => setByoEmail(e.target.value)} placeholder="name@email.com" /></label>
          <button className="byo-send" type="button" onClick={sendByo}>Send invite &amp; connect</button>
          <button className="sheet-cancel" type="button" onClick={() => setByoOpen(false)}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
