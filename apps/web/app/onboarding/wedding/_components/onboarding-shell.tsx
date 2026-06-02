'use client';

/**
 * /onboarding/wedding — Onboarding shell (Phases 1-3 of 5).
 *
 * PROTOTYPE-DIRECT PORT (owner directive 2026-06-02: "port the prototype's
 * actual CSS/HTML, not a Tailwind rewrite"). This mirrors the locked prototype
 * Onboarding_Wedding_Flow_2026-06-01.html one-for-one: the same .pba > .phone >
 * .top / .body / .bottom chrome, the same .screen sections with verbatim class
 * names, the same gold SETNAYAN mark + progress bar + Continue CTA. The CSS in
 * ../_styles/onboarding.css IS the prototype CSS, scoped under .pba.
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
import '../_styles/onboarding.css';
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

/* Screens shipped so far (welcome..budget..picker..prefs). */
const PHASE_SCREENS = 11;

/* Primary-button label per screen (prototype nextLabel[]). Index 10 (prefs) is
 * overridden at render time by the sub-stepper ("Continue" / "Looks good"). */
const NEXT_LABEL = ['Let’s go', 'Continue', 'Continue', 'Continue', 'Continue', 'Continue', 'Continue', 'Continue', 'Continue', 'Continue', 'Continue'];
/* Which screens show a Skip button (prototype canSkip[]): picker not skippable, prefs is. */
const CAN_SKIP = [false, false, false, true, true, true, true, true, true, false, true];

const ASSET = (name: string) => `/onboarding/${name}.webp`;
/* picker per-service photo + prefs photo subdirs (mirror the pax/budget/mono pattern). */
const PICKER_ASSET = (key: string) => `/onboarding/picker/${key}.webp`;
const PREFS_ASSET = (key: string) => `/onboarding/prefs/${key}.webp`;

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

const FAITH_CHIPS: { value: OnboardingFaith; label: string; soon: boolean }[] = [
  { value: 'catholic', label: 'Catholic', soon: false },
  { value: 'christian', label: 'Christian', soon: true },
  { value: 'inc', label: 'INC', soon: true },
  { value: 'muslim', label: 'Muslim', soon: true },
  { value: 'cultural', label: 'Cultural', soon: true },
];

/* ── monogram (prototype MONO_FRAMES/MONO_FONTS) ── */
const MONO_FRAMES = ['wreath', 'crest', 'square', 'oval'];
const MONO_FONTS = ['cormorant', 'cinzel', 'playfair', 'script'];

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

export function OnboardingShell() {
  const [state, setState] = useState<OnboardingState>(EMPTY_ONBOARDING_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [regionExpanded, setRegionExpanded] = useState(false);
  const [monoPop, setMonoPop] = useState(false);
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* picker sticky-preview (local UI) + style sub-stepper index (local UI) */
  const [pickerPreview, setPickerPreview] = useState<{ cat: string; name: string }>({ cat: 'reception', name: 'Reception venue' });
  const [prefIdx, setPrefIdx] = useState(0);

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

  /* Persist on every change (after hydration, so we don't clobber the draft on mount). */
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        ONBOARDING_DRAFT_KEY,
        JSON.stringify({ ...state, lastSavedAt: new Date().toISOString() }),
      );
    } catch {
      /* storage full / blocked — non-fatal */
    }
  }, [state, hydrated]);

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
        return { ...s, step: n };
      });
      // entering the prefs sub-stepper forward (from the picker) → start at its first screen
      if (d > 0 && state.step === 9) setPrefIdx(0);
    },
    [state.step, prefIdx, prefQueue.length],
  );

  /* "What would you love?" auto-highlights a budget-appropriate starter set (prototype applyBudgetHighlight),
     re-seeding only while untouched — once the couple edits a chip, pickerTouched latches and we stop. */
  useEffect(() => {
    if (step === 9 && !state.pickerTouched) {
      patch({ picks: budgetStarterPicks(state.budgetBand ?? 'classic') });
    }
  }, [step, state.pickerTouched, state.budgetBand, patch]);

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
    const bi = firstInitial(state.brideName);
    const gi = firstInitial(state.groomName);
    if (bi && gi) return `${bi} & ${gi}`;
    return bi || gi || '··';
  })();
  const bumpMono = () => {
    setMonoPop(true);
    if (popTimer.current) clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => setMonoPop(false), 170);
  };
  const cycleFrame = () => {
    patch({ monogramFrame: (state.monogramFrame + 1) % MONO_FRAMES.length });
    bumpMono();
  };
  const cycleFont = () => {
    patch({ monogramFont: (state.monogramFont + 1) % MONO_FONTS.length });
    bumpMono();
  };

  /* ── pax ── */
  const pax = state.pax ?? 150;
  const paxTier = paxTierFor(pax);
  const paxFill = ((Math.min(500, Math.max(10, pax)) - 10) / (500 - 10)) * 100;

  /* ── budget (prototype buildBudget) ── */
  const budgetView = (() => {
    const band = state.budgetBand ?? 'classic';
    const tier = paxTier.t;
    const round50 = (n: number) => Math.round(n / 50000) * 50000;
    const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : `${n / 1000}K`);
    const total = (lo: number, hi: number) => {
      const a = round50(lo);
      let z = round50(hi);
      if (z <= a) z = a + 50000;
      return `₱${fmt(a)} – ₱${fmt(z)}`;
    };
    if (band === 'nolimit') {
      return { dataBand: 'luxury', img: `budget/${tier}_luxury`, tag: 'No ceiling', range: 'The best of everything' };
    }
    const b = BUDGET_BANDS.find((x) => x.value === band) ?? BUDGET_BANDS[2]!;
    const range = total(b.med * 0.8 * pax, b.med * 1.2 * pax) + ` · ~${pax} guests`;
    return { dataBand: band, img: `budget/${tier}_${band}`, tag: b.tag, range };
  })();

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
        return state.brideName.trim().length > 0 || state.groomName.trim().length > 0;
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
  const nextLabel = step === 10 ? prefsLabel : NEXT_LABEL[step] ?? 'Continue';

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

  return (
    <div className="pba">
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
                    <span key={c.value} className={`chip${sel(faith.includes(c.value))}`} onClick={() => selectFaith(c.value)}>
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
                  data-frame={MONO_FRAMES[state.monogramFrame]}
                  data-font={MONO_FONTS[state.monogramFont]}
                  style={monoPop ? { transform: 'scale(1.05)' } : undefined}
                >
                  <span className="mono-letters">{monoMark}</span>
                </div>
              </figure>
            </div>
            <div className="tapzone">
              <div className="mono-controls">
                <button type="button" className="mono-btn" onClick={cycleFrame}>
                  <span className="ic" aria-hidden="true">{'◯'}</span> Frame
                </button>
                <button type="button" className="mono-btn" onClick={cycleFont}>
                  <span className="ic" aria-hidden="true">Aa</span> Font
                </button>
              </div>
              <div className="namepair">
                <label className="nl">
                  <span className="nlk">Bride</span>
                  <input
                    className="field nf"
                    placeholder="Maria"
                    value={state.brideName}
                    onChange={(e) => {
                      patch({ brideName: e.target.value });
                      bumpMono();
                    }}
                  />
                </label>
                <label className="nl">
                  <span className="nlk">Groom</span>
                  <input
                    className="field nf"
                    placeholder="Juan"
                    value={state.groomName}
                    onChange={(e) => {
                      patch({ groomName: e.target.value });
                      bumpMono();
                    }}
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
                  <div className="rt">{regionExpanded ? 'Anywhere in the Philippines' : regionNug.title}</div>
                  <div className="rl">{regionExpanded ? 'Pick your region below — we match you with vendors who cover your area.' : regionNug.line}</div>
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
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  className="paxexactinput"
                  placeholder="type your count"
                  value={state.pax ?? ''}
                  onChange={(e) => {
                    const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                    patch({ pax: v === null || isNaN(v) ? null : v });
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
              <p className="sub">Pick the feel you{'’'}re going for — see how it looks, and we{'’'}ll size it to your guests.</p>
              <figure className="budgetphoto" data-band={budgetView.dataBand}>
                <HeroImg src={ASSET(budgetView.img)} />
                <figcaption className="budgetcap">
                  <span className="budgetcaptag">{budgetView.tag}</span>
                  <span className="budgetcaprange">{budgetView.range}</span>
                </figcaption>
              </figure>
            </div>
            <div className="tapzone">
              <div className="chips" data-single="">
                {BUDGET_BANDS.map((b) => (
                  <span
                    key={b.value}
                    className={`chip${sel(state.budgetBand === b.value)}`}
                    onClick={() => patch({ budgetBand: b.value })}
                  >
                    {b.label}
                  </span>
                ))}
              </div>
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
        </div>

        {/* bottom — primary CTA */}
        <div className="bottom">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => canContinue && go(1)}
            disabled={!canContinue}
            style={!canContinue ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
          >
            {nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
