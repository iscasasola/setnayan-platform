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
// Desktop-only editorial canvas around the locked phone frame (owner 2026-06-13).
// Layered ON TOP of the prototype CSS — see onboarding-desktop.css header.
import '../_styles/onboarding-desktop.css';
import { OnboardingDesktopAside } from './desktop-aside';
// Phase-5 cutover: the lazy DB commit + the existing auth server actions reused
// at the account gate (no new auth code — same OAuth/signup the marketing site uses).
import {
  commitOnboardingWedding,
  searchOnboardingReceptionVenues,
  getOnboardingVendorCounts,
  type OnboardingCommitPayload,
  type OnboardingVenueResult,
} from '../actions';
import { signInWithGoogle } from '@/app/auth/oauth-actions';
import { signUp } from '@/app/signup/actions';
import {
  EMPTY_ONBOARDING_STATE,
  ONBOARDING_DRAFT_KEY,
  ONBOARDING_DRAFT_TTL_DAYS,
  type OnboardingFaith,
  type OnboardingKind,
  type OnboardingRole,
  type OnboardingState,
} from '../types';
import { FAITH_REGISTRY, FAITH_LABELS } from '@/lib/faith-registry';
import { cityByKey } from '../_data/wedding-cities';
import { LocationStep } from './location-step';
import type { OnboardingPricing, OnboardingBundleVM } from './onboarding-pricing';
import { MonoLockup, type MonoDesign } from './mono-lockup';
import { SongBankStep } from './song-bank-step';
import { OnboardingMusic } from './onboarding-music';
import { REFINEMENTS_BY_KEY, REFINEMENTS_DATA, type RefineLeaf, type RefineOption } from '../_data/refinements';
import {
  weaveStory,
  masthead as weaveMasthead,
  pullQuote as weavePullQuote,
  timelineHtml as weaveTimeline,
  milestoneRows,
  fmtMomentYear,
  toneLine,
  type StoryTone,
  type WeaveContext,
} from './weave-story';
import { WelcomeMoments } from './welcome-moments';
import { resolvePick } from '../_data/wedding-cities';
import { trackFailure } from '@/lib/telemetry/track-error';
import { SDLoader } from '@/components/sd-loader';

/* ── string-id navigation model (replaces integer-step `step === N` addressing) ──
 * The 17 screens are addressed by a stable string id. The two forks that used to
 * be index arithmetic in go() are now array MEMBERSHIP: buildSequence() drops the
 * faith screen for Civil weddings and the account gate for signed-in users, so
 * state.step is the index into that FILTERED sequence (still a plain number — the
 * persisted draft stays readable). Same 17 screens, same order, same behaviour. */
/* The 6-screen LOVE STAGE is inserted after `name` (the couple has names + a mark to
   show) and before `date` — the website "Our Love Story" beats. love_intro is the skip
   GATE (always shown); the other 5 collection screens drop when the couple taps
   "Add it later" (loveSkipped). COVERT: every id is story-shaped, never editorial/song. */
/* The "Your Dream Team" chapter (4 NEW chrome screens · team_intro / reception_setting /
   team_payoff / aigate) is inserted after `budget`. `find` MOVES earlier — out of its old
   post-`account` slot into the chapter (right after reception_setting), matching the
   prototype's s1search position. The AI-gated team screens follow `aigate`:
   team_basics (4-card pax-style basics carousel) → team_extras (expandable parent→tiles
   browser of the full taxonomy minus the basics) → songs (Song Bank) → mood (feel picker).
   `account` follows the AI screens (prototype order).
   ⚠ ACCOUNT-REPOSITION flagged to owner — see PR-2 ownerFlags.
   PR-3: the interim flat `picker`+`prefs` ids are RETIRED. team_basics/team_extras both call
   the EXISTING pickChip → state.picks stays ONE flat array (Option-A bridge); songs/mood
   re-house the StyleSubStepper's music + palette dimensions (now standalone, still AI-gated).
   PR-4: the two-pass UNIFORM refine engine lands — refine_basic (right after team_basics) +
   refine_extras (right after team_extras) walk the picked leaves that have a REFINEMENTS entry
   ("what kind of X?"). Both are AI-gated; an empty pass is skipped (go() re-entry loop). */
/* Flow order (owner 2026-06-08): the wedding DATE is picked RIGHT AFTER the name +
   monogram, BEFORE the love stage ("choose the wedding date first before the love
   story because the date needs to be picked first") — so the love-story timeline can
   anchor to the real wedding year. The old single `love_met` (which crammed the Spark
   AND the Almost onto one page) is split into `love_spark` + `love_almost` so each page
   is ONE clearly-titled story (owner 2026-06-08 — "set each page to be 1 story"). */
const FLOW_IDS = ['welcome','role','kind','faith','name','date','love_intro','love_spark','love_almost','love_proposal','love_milestones','love_tone','love_preview','alaala_promise','region','pax','budget','team_intro','reception_setting','find','team_payoff','aigate','team_basics','refine_basic','team_extras','refine_extras','songs','mood','account','congrats','plan','bundle','services','summary'] as const;
type ScreenId = typeof FLOW_IDS[number];
/* The love collection screens dropped when the couple skips the stage (love_intro,
   the gate, always stays). */
const LOVE_SKIPPABLE: ReadonlySet<ScreenId> = new Set(['love_spark','love_almost','love_proposal','love_milestones','love_tone','love_preview']);
/* Dream Team AI-gated screens — shown only when the couple opts into AI matching on
   `aigate` (state.ai === true). team_basics (the 4 essentials) + team_extras (the full
   taxonomy browser) capture state.picks; songs + mood re-house the music + feel
   dimensions that the retired StyleSubStepper used to own (they were AI-gated as part of
   prefs, so they stay AI-gated here). PR-4: refine_basic/refine_extras (the two-pass "what
   kind of X?" engine) are present too — both AI-gated, so AI=No (or undecided) skips straight
   past all six to account → congrats. */
const TEAM_AI_ONLY: ReadonlySet<ScreenId> = new Set(['team_basics','refine_basic','team_extras','refine_extras','songs','mood']);
/* `songs` shows only when the couple picked a live-music maker (owner 2026-06-09 — "only
   show when Band/Orchestra/Wedding Singer is picked"); `mood` shows only when they picked a
   Stylist/Decorator (mood IS that refinement now). Both still ride the AI gate above; picks
   are known by these screens (they follow team_basics/team_extras in the flow). */
const SONG_PICK_CATS: ReadonlySet<string> = new Set(['live_band', 'orchestra', 'wedding_singer']);
function buildSequence(kind: OnboardingState['kind'], authed: boolean, loveSkipped: boolean, ai: boolean | null, picks: string[]): ScreenId[] {
  const hasMusician = picks.some((p) => SONG_PICK_CATS.has(p));
  const hasStylist = picks.includes('stylist');
  return FLOW_IDS.filter((id) =>
    !(id === 'faith' && kind === 'civil') &&        // Civil skips the faith screen
    !(id === 'account' && authed) &&                // signed-in users skip the account gate
    !(loveSkipped && LOVE_SKIPPABLE.has(id)) &&     // "Add it later" drops the 5 love collection screens
    !(ai !== true && TEAM_AI_ONLY.has(id)) &&       // team_basics/team_extras/songs/mood only when the couple opted into AI matching (aigate=Yes)
    !(id === 'songs' && !hasMusician) &&            // songs only when a Band / Orchestra / Wedding Singer is picked
    !(id === 'mood' && !hasStylist)                 // mood (= the stylist refinement) only when Stylist/Decorator is picked
  );
}

/* Primary-button label per screen (prototype nextLabel[]). 'plan' flips to
 * "Continue to checkout" once the bundle is added. `mood` (the last AI screen) carries the
 * "Looks good" flourish the retired prefs sub-stepper used to supply on its final screen. */
const NEXT_LABEL_BY_ID: Record<ScreenId, string> = {
  welcome:'Build my free plan', role:'Continue', kind:'Continue', faith:'Continue', name:'Continue',
  // Love stage: love_intro + love_preview carry their OWN in-screen buttons (no chrome CTA);
  // the three middle collection screens advance with "Continue", love_tone leads to the reveal.
  love_intro:'Continue', love_spark:'Continue', love_almost:'Continue', love_proposal:'Continue', love_milestones:'Continue',
  love_tone:'See our story', love_preview:'This is us',
  date:'Continue', region:'Continue', pax:'Continue', budget:'Continue',
  // alaala_promise: a brand moment after the love story (names the pillar +
  // states the guardrail); chrome Continue advances, canContinue defaults true.
  alaala_promise:'Continue',
  account:'Create account', find:'Continue', congrats:'Continue', plan:'Continue',
  // bundle (owner 2026-06-08): chrome CTA = the "skip the offer, build à la carte" advance to
  // `services`. The two bundle cards carry their OWN "Get {title}" CTAs that route to checkout.
  bundle:'Continue',
  services:'Review my picks', summary:'Done',
  // Dream Team chapter. aigate carries its OWN two in-screen CTAs (chrome CTA hidden
  // via AIGATE_NOCTA) — its key is required only to satisfy the exhaustive Record.
  team_intro:'Continue', reception_setting:'Continue', team_payoff:'Continue', aigate:'Continue',
  // AI-gated team screens (PR-3). mood is terminal of the AI fork → "Looks good".
  team_basics:'Continue', team_extras:'Continue', songs:'Continue', mood:'Looks good',
  // PR-4 refine passes — these keys exist only to satisfy the exhaustive Record; the
  // CHROME CTA label for a refine screen is computed dynamically ("Next service" mid-queue,
  // "Continue" on the last leaf) in the `nextLabel` derivation, never read from here.
  refine_basic:'Continue', refine_extras:'Continue',
};
/* Which screens show a Skip button. Skippable: team_extras · songs · mood · find · the
   à-la-carte services review — they sort/refine, never gate. The love collection screens
   (met/proposal/milestones/tone) are all optional → Skip advances. Everything that drives
   matching is required: role/kind/faith/name/date/region/pax/budget/team_basics. (owner
   2026-06-05 — removed Skip from faith · date · pax · budget; Continue already gates each.)
   team_basics is NOT skippable — it seeds state.picks (a Yes-to-AI couple always picks ≥1
   essential). songs/mood sort matches the way the retired prefs sub-stepper did, so they
   stay Skip-able. */
const CAN_SKIP_BY_ID: Partial<Record<ScreenId, boolean>> = {
  love_spark:true, love_almost:true, love_proposal:true, love_milestones:true, love_tone:true,
  team_extras:true, songs:true, mood:true, find:true, services:true,
  // bundle (owner 2026-06-08): Skip = advance to `services` (the à-la-carte path). The
  // in-screen "I'll pick à la carte instead" link is the primary escape; this is parity.
  bundle:true,
};
/* The love gate + reveal carry their OWN button rows (a primary CTA + a ghost) — the chrome
   Continue is hidden for these, the same way the account gate + summary are (data-nocta). */
const LOVE_NOCTA: ReadonlySet<ScreenId> = new Set(['love_intro','love_preview']);
/* The AI gate carries its OWN two in-screen CTAs (Yes / No thanks) — the chrome Continue
   is hidden for it, the same data-nocta pattern as the love gate + account + summary. */
const AIGATE_NOCTA: ReadonlySet<ScreenId> = new Set(['aigate']);

const ASSET = (name: string) => `/onboarding/${name}.webp`;
/* picker per-service photo + prefs photo + bundle thumbnail subdirs (mirror the pax/budget/mono pattern). */
const PICKER_ASSET = (key: string) => `/onboarding/picker/${key}.webp`;
const PREFS_ASSET = (key: string) => `/onboarding/prefs/${key}.webp`;
const BUNDLE_ASSET = (key: string) => `/onboarding/bundle/${key}.webp`;

/* Kind → hero photo + caption (prototype setKindPhoto). */
const KIND_PHOTO: Record<OnboardingKind, { img: string; cap: string }> = {
  religious: { img: 'wed_catholic', cap: 'A faith ceremony' },
  civil: { img: 'wed_civil', cap: 'A city-hall ceremony' },
  mixed: { img: 'wed_mixed', cap: 'A blended celebration' },
};

/* Faith → hero photo + caption (prototype setFaithPhoto, religious mode).
   Derived from lib/faith-registry — the single faith source (2026-06-12);
   new faiths reuse the closest existing scene asset until per-faith imagery
   is produced. */
const FAITH_PHOTO: Record<OnboardingFaith, { img: string; cap: string }> =
  Object.fromEntries(
    FAITH_REGISTRY.map((e) => [e.key, { img: e.photoImg, cap: e.photoCap }]),
  ) as Record<OnboardingFaith, { img: string; cap: string }>;

const ROLE_OPTIONS: { value: OnboardingRole; title: string; desc: string }[] = [
  { value: 'bride', title: 'Bride', desc: 'Walking down the aisle.' },
  { value: 'groom', title: 'Groom', desc: 'Waiting at the front.' },
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

// Derived from lib/faith-registry (the single faith source, 2026-06-12) —
// registry order = chip order. `defaultSoon` is only the offline/error
// fallback: the live answer comes from `wedding_type_launch_status` (read at
// mount, filtered at render), so the owner flips faiths live in
// /admin/wedding-types without a code change.
const FAITH_CHIPS: { value: OnboardingFaith; label: string; soon: boolean }[] =
  FAITH_REGISTRY.map((e) => ({ value: e.key, label: e.label, soon: e.defaultSoon }));

/* ── monogram designs (owner 2026-06-05 — kept 3 live-typography lockups: bar · duo ·
   infinity. Dropped #2 (script) + #4 (framed) for now; more designs to come. MonoLockup
   (./mono-lockup) still renders all five styles by its .lk-* class from the couple's real
   initials + first names — these three are pure typography (no image frame), so the mark
   stays crisp at any size. "Generate another design" cycles these; commit still derives
   monogram_frame/font_key. */
const MONO_DESIGNS: MonoDesign[] = [
  { style: 'bar', font: 'cormorant' },                  // serif caps | & | caps + names
  { style: 'duo', font: 'playfair' },                   // serif caps, close / overlapping
  { style: 'infinity', font: 'cormorant' },             // two caps linked by a gold ∞
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

/* ── region labels (prototype REGLABEL) — region key → display label for the screen-13 recap ── */
const REGLABEL: Record<string, string> = {
  ncr: 'Metro Manila', calabarzon: 'CALABARZON', 'c-visayas': 'Central Visayas', 'w-visayas': 'Western Visayas',
  'c-luzon': 'Central Luzon', ilocos: 'Ilocos', cagayan: 'Cagayan Valley', bicol: 'Bicol', mimaropa: 'MIMAROPA',
  'e-visayas': 'Eastern Visayas', zamboanga: 'Zamboanga', 'n-mindanao': 'Northern Mindanao', davao: 'Davao',
  soccsksargen: 'SOCCSKSARGEN', caraga: 'Caraga', barmm: 'BARMM', car: 'Cordillera · CAR', abroad: 'Outside the PH',
};
/* Region picker (REGNUG / REGION_TOP / REGION_MORE) retired 2026-06-04 — replaced by the
   Top-30 location step (location-step.tsx). REGLABEL above is kept for the recap label. */

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
/* Dream Team chapter (PR-3) — the 4 ESSENTIAL services rendered on `team_basics`, in the
   canonical BASIC order (ceremony → catering → coordinator → photo_video; owner ISSUE-1).
   These are PRODUCTION PICK_GROUPS keys (NOT the prototype's `ceremony_venue`) so
   CATEGORY_MAP + the auto-inquire loop keep resolving. `team_extras` renders every other
   PICK_GROUPS leaf EXCEPT these AND except `reception` (captured on reception_setting).
   BRIDGE: basics vs extras is a RENDER-TIME partition of ONE flat state.picks — both
   screens call the same pickChip(cat); there is no basicPicks/enhancePicks. */
const BASIC_CATS = ['ceremony', 'catering', 'coordinator', 'photo_video'] as const;
const BASIC_SET = new Set<string>(BASIC_CATS);
const PICK_INFO: Record<string, { g: string; d: string }> = {
  reception: { g: 'Venue', d: 'Where your celebration happens — the dinner, the program, and the dancing.' },
  ceremony: { g: 'Venue', d: 'Where you exchange vows — church, mosque, temple, garden, or civil hall.' },
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
/* ── feel/palette data (prototype FEELS) — re-housed into the standalone `mood` screen
   (PR-3) after the StyleSubStepper was retired. Still read by buildCommitPayload
   (moodFeelKey + basicMoodboard) + the congrats recap. ── */
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
/* mood `stylist` refinement option → existing palette feel (owner 2026-06-09 — "keep the
   palette, mapped per stylist style"). The stylist option keys (=== labels, from the DB
   `stylist` leaf) map onto the FEELS palettes + feel_*_<tier> photos so the swatch reveal +
   the commit's moodFeelKey/basic_moodboard are unchanged. `Themed` → 'others' (no fixed palette).
   An unmapped (admin-added) style falls back to the timeless palette so it never breaks. */
const STYLE_TO_FEEL: Record<string, string> = {
  'Modern minimalist': 'modern',
  'Traditional classic': 'timeless',
  'Rustic / industrial': 'rustic',
  Bohemian: 'boho',
  'Luxe glamour': 'glam',
  'Garden / organic': 'boho',
  Themed: 'others',
};
const feelForStyle = (styleKey: string): string => STYLE_TO_FEEL[styleKey] ?? 'timeless';
/* photo-card option sets: [emoji, label, prefs-photo-key] */
const RECEPTION_SETTINGS: [string, string, string][] = [['✨', 'Hotel ballroom', 'setting_ballroom'], ['🎪', 'Events place', 'setting_events_place'], ['🏛️', 'Heritage', 'setting_heritage'], ['🍽️', 'Restaurant', 'setting_restaurant'], ['🌿', 'Garden', 'setting_garden'], ['🏖️', 'Beach', 'setting_beach'], ['🌴', 'Resort / destination', 'setting_resort']];
// Ceremony venue options are FAITH-ADAPTIVE — Setnayan caters every tradition,
// not just church weddings. Each picked faith contributes its house of worship
// (deduped); the universal settings always follow. Civil / no-faith couples get
// the universal set only. (owner-directed 2026-06-03 "cater all religious weddings".)
const WORSHIP_OPT: Partial<Record<OnboardingFaith, [string, string, string]>> = {
  catholic: ['⛪', 'Church', 'ceremony_church'],
  christian: ['⛪', 'Church', 'ceremony_church'],
  inc: ['⛪', 'Chapel', 'ceremony_church'],
  muslim: ['🕌', 'Mosque', 'ceremony_mosque'],
  chinese: ['🛕', 'Temple', 'ceremony_temple'],
  jewish: ['🕍', 'Synagogue', 'ceremony_synagogue'],
  born_again: ['⛪', 'Church', 'ceremony_church'],
  // cultural: indigenous Filipino ceremonies are outdoor / ancestral — no single
  //   house of worship; the universal options below cover them.
};
const UNIVERSAL_CEREMONY_OPTS: [string, string, string][] = [
  ['🌿', 'Garden', 'ceremony_garden'],
  ['🏖️', 'Beach', 'ceremony_beach'],
  ['🏛️', 'Civil registrar', 'ceremony_civil'],
  ['🎪', 'Same as reception', 'ceremony_same_reception'],
];
function ceremonyOptsFor(faith: OnboardingFaith[]): [string, string, string][] {
  const worship: [string, string, string][] = [];
  const seen = new Set<string>();
  for (const f of faith) {
    const w = WORSHIP_OPT[f];
    if (w && !seen.has(w[2])) {
      seen.add(w[2]);
      worship.push(w);
    }
  }
  return [...worship, ...UNIVERSAL_CEREMONY_OPTS];
}
const CUISINE_OPTS: [string, string, string][] = [['🍲', 'Filipino', 'cuisine_filipino'], ['🥢', 'Asian', 'cuisine_asian'], ['🌍', 'International', 'cuisine_international'], ['🥘', 'Spanish', 'cuisine_spanish'], ['🍝', 'Italian', 'cuisine_italian'], ['✨', 'Fusion', 'cuisine_fusion']];
const SERVICE_STYLES = ['Plated', 'Buffet', 'Family-style', 'Stations'];
const PV_LOOKS: [string, string, string][] = [['📸', 'Photojournalistic', 'pv_photojournalistic'], ['🤍', 'Classic', 'pv_classic'], ['📰', 'Editorial', 'pv_editorial'], ['🎞️', 'Fine-art / film', 'pv_fineart'], ['🎬', 'Cinematic', 'pv_cinematic']];
const PV_NEEDS = ['Both photo & video', 'Photo only', 'Video only'];
const PV_INCLUDED = ['Pre-nup', 'Wedding day', 'Same-day edit', 'Drone', 'Save-the-date', 'Album'];

/* ════════════ PR-4 · REFINEMENTS — the two-pass UNIFORM "what kind of X?" engine ════════════
   REFINEMENTS maps a PICK_GROUPS leaf key → { label, options }. ONLY leaves with an entry
   get a refine screen; a picked leaf with NO entry (host_mc, lights_sound, …) is skipped
   silently ("nothing to refine"). Options are [emoji, label, optionKey] tuples — the SAME
   shape the ceremony / cuisine / pv carousels already use, so RefineStep renders every leaf
   identically (owner 2026-06-07 "one template, same for all").

   THREE leaves are PROJECTABLE — their option KEYS are reused verbatim from the existing
   production consts so projectRefinementsToPrefs can map them back onto prefs (the recap +
   commit read prefs, not the raw refinements blob):
     • ceremony   → faith-adaptive at render via ceremonyOptsFor(faith) → prefs.ceremony
       (the option keys are ceremony_church/mosque/…, the SAME keys the ceremony recap reads).
     • catering   → CUISINE_OPTS keys (cuisine_*) → prefs.cuisine, plus a SYNTHETIC
       'cuisine_halal' option that the projector routes to prefs.dietary 'halal' (NOT cuisine).
     • photo_video → PV_LOOKS keys (pv_*) → prefs.pvLook.
   Every OTHER leaf is NON-projectable — its options carry the prototype's verbatim strings
   as [emoji, label, label] triples (key === label); those ride only the refinements JSONB. */
/* The leaf catalogue (labels · descriptions · options · 4:3 photos) now lives in DATA
   (app/onboarding/wedding/_data/refinements.ts — the seed source + fallback), read DB-first via
   getOnboardingRefinements() and threaded in as the `refinements` prop (owner 2026-06-08, items
   8 + 9 — de-hardcoded + admin-editable). REFINEMENTS_BY_KEY is the STATIC fallback map; it drives
   only the QUEUE (which leaves are refinable — the onboarding's fixed PICK_GROUPS taxonomy), while
   per-leaf CONTENT renders from the DB-or-fallback `refinements` prop. The 3 PROJECTABLE leaves keep
   their production option keys (cuisine_/pv_/ceremony_) so projectRefinementsToPrefs still maps them. */

/* ── refine pass order (§5.1) ──────────────────────────────────────────────────
   BASIC pass = canonical BASIC order (ceremony → catering → coordinator → photo_video),
   NOT pick order. EXTRAS pass = the FLAT PICK_GROUPS taxonomy order minus the basics +
   minus reception (captured on reception_setting). A leaf is QUEUED only if it's both
   picked AND has a REFINEMENTS entry → an extras-pick like host_mc (no entry) drops out,
   and a pass can end up empty → the go() re-entry loop skips it. */
const REFINE_BASIC_ORDER: readonly string[] = BASIC_CATS;
// Exclude reception (captured on reception_setting) AND stylist (captured on the `mood`
// screen — it IS the stylist refinement now, owner 2026-06-09) so neither is re-asked here.
const EXTRAS_ORDER: string[] = PICK_GROUPS.flatMap((g) => g.rows.flat().map((c) => c.cat)).filter((c) => c !== 'reception' && c !== 'stylist' && !BASIC_SET.has(c));
function refineBasicQueueFor(picks: string[]): string[] {
  return REFINE_BASIC_ORDER.filter((k) => picks.includes(k) && k in REFINEMENTS_BY_KEY);
}
function refineExtrasQueueFor(picks: string[]): string[] {
  return EXTRAS_ORDER.filter((k) => picks.includes(k) && k in REFINEMENTS_BY_KEY);
}
function queueFor(id: ScreenId, picks: string[]): string[] {
  return id === 'refine_basic' ? refineBasicQueueFor(picks) : refineExtrasQueueFor(picks);
}
/* the two refine passes (used by the go() re-entry loop + the render dispatch). */
const REFINE_SCREENS: ReadonlySet<ScreenId> = new Set(['refine_basic', 'refine_extras']);

/* ── projector (§3.3) ──────────────────────────────────────────────────────────
   Map the 3 PROJECTABLE refine leaves back onto prefs so the recap + commit reflect the
   refine picks. The other ~35 leaves are NOT touched — they ride only refinements JSONB.
   Returns a Partial<prefs> so it spreads cleanly over { ...s.prefs }; only writes a key
   when there's a value, so it never clobbers prefs.reception/feel/music/serviceStyle/etc. */
function projectRefinementsToPrefs(refinements: Record<string, string[]>, faith: OnboardingFaith[]): Partial<OnboardingState['prefs']> {
  const out: Partial<OnboardingState['prefs']> = {};
  // ceremony → single key (LAST valid pick; prefs.ceremony is string|null + the recap is single-value).
  const cer = refinements.ceremony ?? [];
  if (cer.length) {
    const valid = new Set(ceremonyOptsFor(faith).map((o) => o[2]));
    const last = [...cer].reverse().find((k) => valid.has(k));
    if (last) out.ceremony = last;
  }
  // catering → cuisine_* keys (EXCLUDING the synthetic Halal) + push 'halal' into dietary.
  const cat = refinements.catering ?? [];
  const cuisine = cat.filter((k) => k.startsWith('cuisine_') && k !== 'cuisine_halal');
  if (cuisine.length) out.cuisine = cuisine;
  if (cat.includes('cuisine_halal')) out.dietary = ['halal'];
  // photo_video → pv_* keys.
  const pv = (refinements.photo_video ?? []).filter((k) => k.startsWith('pv_'));
  if (pv.length) out.pvLook = pv;
  return out;
}

/* ── RefineStep — the DB-backed "what kind of X?" card (owner 2026-06-08, item 8) ──
   ONE component renders BOTH passes + EVERY leaf identically from the `leafData` (DB-or-fallback
   RefineLeaf): a 4:3 MAIN photo on top + a one-line description + a 4:3 OPTION carousel. The
   ceremony leaf is faith-adaptive (options from ceremonyOptsFor, reusing the /prefs photos).
   COVERT: copy is "what kind of X?" service-shaped only — never love/song/pricing. */
function RefineStep({
  scope = 'extras',
  queue = [],
  idx = 0,
  leafData,
  faith,
  chosen,
  onToggle,
  hideProgress = false,
  eyebrow: eyebrowProp,
  title: titleProp,
  subtitle: subtitleProp,
}: {
  scope?: 'basic' | 'extras';
  queue?: string[];
  idx?: number;
  leafData: RefineLeaf;
  faith: OnboardingFaith[];
  chosen: string[];
  onToggle: (leaf: string, optKey: string) => void;
  /** Standalone (non-queue) use — hides the "Service N of M" progress + dots. */
  hideProgress?: boolean;
  /** Override eyebrow / title / sub for a standalone screen (reception, mood). */
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}) {
  const leaf = leafData.key;
  // Ceremony is faith-adaptive: resolve its options from ceremonyOptsFor + reuse the /prefs photos.
  const options: RefineOption[] =
    leafData.dynamic === 'ceremony'
      ? ceremonyOptsFor(faith).map(([emoji, label, key]) => ({ emoji, label, key, photo: PREFS_ASSET(key) }))
      : leafData.options;
  const eyebrow = eyebrowProp ?? (scope === 'basic' ? 'Refine your essentials' : 'Refine the extras you love');
  const title = titleProp ?? `What kind of ${leafData.label.toLowerCase()}?`;
  const subtitle =
    subtitleProp ?? `${leafData.description ? leafData.description + ' ' : ''}Pick the ones that feel like you — we’ll match the rest.`;
  return (
    <div className="prefstep refinestep">
      <div className="viewzone">
        {hideProgress ? null : (
          <div className="prefprog">
            <span className="prefcount">Service {idx + 1} of {queue.length} · {leafData.label}</span>
            <span className="prefdots">{queue.map((_, d) => <i key={d} className={d <= idx ? 'on' : ''} />)}</span>
          </div>
        )}
        {/* MAIN photo on top + description (owner 2026-06-08, item 8) */}
        {leafData.mainPhoto ? (
          <figure className="refine-hero">
            <HeroImg src={leafData.mainPhoto} alt={leafData.label} />
          </figure>
        ) : null}
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="q">{title}</h1>
        <p className="sub">{subtitle}</p>
      </div>
      <div className="tapzone">
        <Rail className="car refine-rail">
          {options.map((o) => (
            <RefineCard
              key={o.key}
              emoji={o.emoji}
              label={o.label}
              photo={o.photo}
              selected={chosen.includes(o.key)}
              onClick={() => onToggle(leaf, o.key)}
            />
          ))}
        </Rail>
      </div>
    </div>
  );
}

/** A 4:3 photo-card option (owner 2026-06-08) — the photo is a URL from the data; emoji glyph
    is the graceful fallback when no photo is set / it 404s before generation. */
function RefineCard({ emoji, label, photo, selected, onClick }: { emoji: string; label: string; photo: string | null; selected: boolean; onClick: () => void }) {
  return (
    <div className={`pcard refine-card${selected ? ' sel' : ''}`} onClick={onClick}>
      <div className={`pimg refine-img ${photo ? 'haspic' : 'imgph'}`} style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
        {photo ? null : <span className="g">{emoji}</span>}
      </div>
      <div className="plbl">
        {label}
        <span className="ck" />
      </div>
    </div>
  );
}

/** A photo-card option keyed by a /prefs asset (prototype PGRID .pcard) — used by the
    reception-setting + AI-team basics pickers (the refine cards use RefineCard above). */
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

/* ── Reusable horizontal carousel with edge affordances ── applied to every
   onboarding carousel (owner 2026-06-05): a "more →" chevron + edge fades while
   there's more to scroll either way, and a vertical end-line once you reach the
   end. Rows that already fit show none of it ('flat'). */
function Rail({ children, className, wrapClassName }: { children: ReactNode; className?: string; wrapClassName?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const sync = useCallback(() => {
    const el = railRef.current;
    const w = wrapRef.current;
    if (!el || !w) return;
    const max = el.scrollWidth - el.clientWidth;
    const flat = max <= 6;
    w.classList.toggle('flat', flat);
    w.classList.toggle('canl', !flat && el.scrollLeft > 4);
    w.classList.toggle('canr', !flat && el.scrollLeft < max - 4);
  }, []);
  useEffect(() => {
    sync();
    const el = railRef.current;
    if (!el) return;
    el.addEventListener('scroll', sync, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
    ro?.observe(el);
    const t = setTimeout(sync, 350); // re-measure once card photos settle
    return () => {
      el.removeEventListener('scroll', sync);
      ro?.disconnect();
      clearTimeout(t);
    };
  }, [sync]);
  return (
    <div className={`railwrap${wrapClassName ? ` ${wrapClassName}` : ''}`} ref={wrapRef}>
      <div className={`rail${className ? ` ${className}` : ''}`} ref={railRef}>
        {children}
        <span className="railend" aria-hidden="true" />
      </div>
      <span className="fade l" aria-hidden="true" />
      <span className="fade r" aria-hidden="true" />
      <span className="chev" aria-hidden="true">›</span>
    </div>
  );
}

/* Picker service card — per-service photo + label + select check (owner 2026-06-05). */
function PickCard({ cat, label, desc, selected, onClick }: { cat: string; label: string; desc?: string; selected: boolean; onClick: () => void }) {
  return (
    // key flips with `selected` so the button remounts on each pick → the .sn-bounce
    // selection-feedback animation replays every time this card becomes selected.
    <button key={selected ? 'on' : 'off'} type="button" className={`svccard${selected ? ' sel sn-bounce' : ''}`} onClick={onClick} aria-pressed={selected} title={desc} aria-label={desc ? `${label} — ${desc}` : label}>
      <span className="svcph" style={{ backgroundImage: `url(${PICKER_ASSET(cat)})` }} />
      <span className="svcck" aria-hidden="true">✓</span>
      <span className="svclb">{label}</span>
    </button>
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

/* ── predicted demand "heat" (deterministic · cold-start-safe · spec Date-Aligner §L.1).
   Stacks the same calendar signals the why-nugget already reads (peak month · weekday ·
   repeating/symbolic) into a 0–4 tier. This is the PREDICTED half only — the observed
   inquiry/relative-to-supply escalation (§L.2) is deferred until the marketplace has
   inquiry data (founder-only today → it would be dead code). Mirrors the verified
   prototype Hot_Date_Heat_Calendar_Prototype_2026-06-09.html. */
const HEAT_PEAK: Record<number, number> = { 11: 2, 0: 2, 1: 2, 10: 2, 3: 1, 4: 1, 9: 1 }; // getMonth() idx: Dec/Jan/Feb/Nov=2 · Apr/May/Oct=1
function heatTier(d: Date): 0 | 1 | 2 | 3 | 4 {
  const m = d.getMonth();
  const dow = d.getDay();
  const n = d.getDate();
  let s = HEAT_PEAK[m] ?? 0;
  if (dow === 6) s += 2; // Saturday — the prime wedding day
  else if (dow === 5 || dow === 0) s += 1; // Friday / Sunday
  if (m + 1 === n) s += 2; // repeating MM·DD (12/12, 11/11…)
  if (m === 1 && n === 14) s += 2; // Valentine's
  if (dow === 6 && m + 1 === n) s += 1; // Saturday + repeating combo
  return s <= 0 ? 0 : s <= 2 ? 1 : s === 3 ? 2 : s <= 5 ? 3 : 4;
}
const DEMAND_LABEL = ['Open', 'Quiet', 'Popular', 'In-demand', 'Hottest'] as const;
const flamesFor = (t: number) => (t >= 3 ? '🔥' : ''); // single restrained accent on the hot tiers; the 1–4 gradient lives in the cell colour ramp
const demandOf = (tier: number) => ({ tier, label: DEMAND_LABEL[tier]!, flames: flamesFor(tier) });

type WhyView = {
  tone: 'good' | 'note';
  title: string;
  reasons: [string, string][];
  more: string;
  demand?: { tier: number; label: string; flames: string };
} | null;

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
    candidates.length ? candidates.map(fromISO) : [],
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
    // Switching to the flexible window seeds a starter range to nudge (responds to
    // the explicit mode choice). Specific mode never auto-seeds a date — the screen
    // opens with nothing selected (owner 2026-06-05: no prefilled onboarding values).
    if (m === 'window' && !rStart) {
      const s = new Date(seed);
      const e = clampMax(new Date(seed.getTime() + 13 * DAY));
      setRStart(s);
      setREnd(e);
      setPickingEnd(false);
      lift(multi, s, e);
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
    // predicted-demand heat tint — only on enabled, non-selected, non-range cells
    // (selection/range mulberry fill always wins). tier 0 = no tint.
    const ht = heatTier(cur);
    if (ht > 0 && !disabled && !/\b(sel|rstart|rend|inrange)\b/.test(cls)) cls += ` heat-${ht}`;
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
      demand: demandOf(heatTier(d)),
    };
  };
  const rangeReasons = (a: Date, b: Date): WhyView => {
    const r: [string, string][] = [];
    let note = false;
    let sat = 0;
    let peakTier = 0;
    const mid = new Date(a.getTime() + (b.getTime() - a.getTime()) / 2);
    for (let t = a.getTime(); t <= b.getTime(); t += DAY) {
      const dd = new Date(t);
      if (dd.getDay() === 6) sat++;
      peakTier = Math.max(peakTier, heatTier(dd));
    }
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
      demand: demandOf(peakTier),
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
      demand: demandOf(Math.max(...ds.map(heatTier))),
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
      {/* viewzone — title + the "why these dates" nugget sits up top, above the calendar (owner 2026-06-05) */}
      <div className="viewzone">
        <div className="eyebrow">Your wedding</div>
        <h1 className="q">When{'’'}s the big day?</h1>
        {why && (
          <div className="whydate">
            <div className="whead">
              <span className={`wtone ${why.tone}`}>{why.title}</span>
              {why.demand && why.demand.tier > 0 && (
                <span className={`wdemand d${why.demand.tier}`}>
                  {why.demand.flames && <span className="wflame">{why.demand.flames}</span>}
                  {why.demand.label}
                </span>
              )}
            </div>
            <div className="wsum">
              <b>{why.reasons[0]?.[0]}</b> — {why.reasons[0]?.[1]} <span className="wmore">{why.more}</span>
            </div>
          </div>
        )}
      </div>
      <div className="tapzone">
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
      </div>
    </>
  );
}

/* ── In-app service display metadata (BUNDLE_ITEMS name · BUNDLE_BENEFIT blurb · BUNDLE_ASSET poster).
   Prices are NOT here — they come live from the admin catalog via the `pricing` prop (owner 2026-06-08,
   onboarding-pricing.ts → buildOnboardingPricing reading platform_retail_catalog_v2). These maps carry
   only display copy + posters; pricing.svc[k] carries the numbers. */
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
/* Bundle tiers/groups removed 2026-06-05 — Your Plan v2 replaces the one-shot bundle with the
   à-la-carte in-app-services flow (screens 15–16). BUNDLE_ITEMS/BUNDLE_BENEFIT/BUNDLE_ASSET
   stay (above + below) and are reused by INAPP_SERVICES. */
/* Pricing source (owner directive 2026-06-08): the hardcoded SVC {out,set} table was REMOVED —
   onboarding now reads live SELLING prices from the admin-managed catalog. Each service's price
   arrives as `pricing.svc[inappKey]` (built in page.tsx by buildOnboardingPricing from
   platform_retail_catalog_v2 + platform_package_catalog — the SAME source /pricing reads).
   `pricing.svc[k].set` = Setnayan price (pesos · catalog), `.label` = display string
   (pax-correct "from ₱X"), `.out` = illustrative "if hired elsewhere" market anchor (NOT a
   Setnayan price · lives in onboarding-pricing.ts OUT_ANCHORS, no DB column exists for it). */
const pesoB = (n: number) => '₱' + Math.round(n).toLocaleString('en-US');
/* Comma thousands-separators for the numeric text boxes (guest count + budget).
   Strips non-digits then groups, so the box shows "1,355,000" live while typing
   (owner 2026-06-02). Native type="number" can't render commas — those boxes are
   type="text" + inputMode="numeric" so the digits-only buffer formats on display. */
const groupDigits = (raw: string) => {
  const d = raw.replace(/[^\d]/g, '');
  return d ? Number(d).toLocaleString('en-US') : '';
};
/* In-app paid services offered on screen 15 (Boost & enhance) — replaces the removed bundle.
   Curated keys reuse BUNDLE_ITEMS (name) · BUNDLE_BENEFIT (blurb) · pricing.svc (set/out/label) ·
   BUNDLE_ASSET (poster); ordered by savings/wow. high_res excluded (free baseline). Prices are
   live from the admin catalog via the `pricing` prop (lib/v2-catalog.ts → buildOnboardingPricing);
   the inapp keys here map 1:1 to service_codes in onboarding-pricing.ts INAPP_TO_SERVICE_CODE. */
// indoor_blueprint RETIRED from the catalog (owner 2026-06-08) → removed from the offered set
// (a retired SKU drops out of fetchV2CustomerCatalog → would otherwise render at ₱0).
const INAPP_KEYS = ['papic_seats', 'advanced_website', 'animated_monogram', 'panood', 'papic_guest', 'sde', 'pakanta', 'custom_qr', 'live_background', 'pabati', 'guest_stories', 'thank_you', 'live_photowall'];
// Onboarding pick → its in-app add-on checkout route (the InlineCheckoutDrawer · BDO/GCash QR +
// reference card). Only services with a BUILT checkout page are listed; Purchase Now jumps to the
// first picked one of these, else falls back to the Services tab (owner 2026-06-06).
const INAPP_TO_ADDON_SLUG: Record<string, string> = {
  papic_seats: 'papic',
  animated_monogram: 'animated-monogram',
  panood: 'panood',
  custom_qr: 'custom-qr-guest',
  indoor_blueprint: 'indoor-blueprint',
};
const INAPP_VS: Record<string, string> = {
  papic_seats: '5 hired photographers', advanced_website: 'a hired web developer', animated_monogram: 'a motion studio', panood: 'a livestream crew', papic_guest: '20+ disposable cams + developing', sde: 'a same-day-edit crew', pakanta: 'a composer + singer', custom_qr: 'an invitation designer', indoor_blueprint: 'a floor-plan service', live_background: 'an LED wall rental + crew', pabati: 'a guestbook booth + attendant', guest_stories: 'per-guest manual editing', thank_you: 'a hired cinematographer', live_photowall: 'an onsite slideshow team',
};

/* Onboarding promo — 20% off any in-app add-on when added during onboarding (owner 2026-06-05,
   was 10% on the retired bundle). Applied to the services-summary total (screen 16). */
const ONBOARDING_PROMO = 0.2;

/* Pick → recommended in-app add-ons (owner 2026-06-05 · "recommended services for the other
   services" → "Matched to their picks"). For each vendor category the couple picks, suggest the
   Setnayan add-ons that complement it. EVERY leaf category maps to ≥1 add-on (owner 2026-06-05:
   "recommended services for all the chosen leaf categories"); the deduped union is pre-added to
   the services summary, each removable, feeding the 20%-off total. */
const PICK_TO_INAPP: Record<string, string[]> = {
  // Venue
  reception: ['live_photowall', 'papic_seats'], ceremony: ['panood'],
  // Planning
  coordinator: ['advanced_website'],
  // Feast
  cake: ['papic_guest'], stations: ['papic_guest'],
  // Design
  stylist: ['animated_monogram', 'live_background'], florist: ['animated_monogram'], lights_sound: ['live_background'],
  dance_floor: ['live_photowall'], led_wall: ['live_background'], fireworks: ['sde', 'thank_you'], outdoor: ['panood'],
  // Program
  host_mc: ['pabati'], live_band: ['pakanta'], orchestra: ['pakanta'], choir: ['pakanta'], wedding_singer: ['pakanta'],
  dj: ['pakanta'], performers: ['sde'], choreographer: ['sde'],
  // Documentary
  photo_video: ['sde', 'thank_you', 'guest_stories', 'papic_guest'], livestream: ['panood'], editorial: ['advanced_website'],
  // Look
  bride_attire: ['animated_monogram'], groom_attire: ['animated_monogram'], women_attire: ['animated_monogram'],
  men_attire: ['animated_monogram'], filipiniana: ['animated_monogram'], jewelry: ['animated_monogram'],
  hmua: ['guest_stories'], grooming: ['guest_stories'], wellness: ['guest_stories'],
  // Booths
  photo_booth: ['papic_seats', 'papic_guest', 'pabati'], coffee: ['papic_guest'], mocktail: ['papic_guest'],
  dessert: ['papic_guest'], food_cart: ['papic_guest'], food_truck: ['papic_guest'], mobile_bar: ['pabati'],
  massage_chair: ['guest_stories'], nail_bar: ['guest_stories'], perfume_bar: ['guest_stories'], henna: ['guest_stories'],
  tarot: ['guest_stories'], caricature: ['guest_stories'], arcade: ['pabati'], engraving: ['custom_qr'],
  // Prints
  printing: ['custom_qr', 'animated_monogram'], souvenirs: ['custom_qr', 'animated_monogram'],
  // Transport
  bridal_car: ['sde'], guest_shuttle: ['custom_qr'], escort: ['custom_qr'],
};
/* Priority order for the recommended set. Dedup against the picks bounds the union to the ≤14
   in-app services, so every chosen leaf surfaces its matched add-on(s) — no cap (owner 2026-06-05). */
const REC_PRIORITY = ['sde', 'papic_seats', 'thank_you', 'animated_monogram', 'pakanta', 'panood', 'live_background', 'live_photowall', 'papic_guest', 'guest_stories', 'pabati', 'advanced_website', 'custom_qr'];
function recommendedInappFor(picks: string[]): string[] {
  const set = new Set<string>();
  for (const p of picks) for (const k of (PICK_TO_INAPP[p] ?? [])) set.add(k);
  return REC_PRIORITY.filter((k) => set.has(k));
}

/* Faith key → display label for the congrats recap — lib/faith-registry. */
const FAITH_LABEL: Record<string, string> = FAITH_LABELS;
/* Picker cat key → its chip label, for the congrats recap "Services" row. */
const PICK_LABEL: Record<string, string> = Object.fromEntries(
  PICK_GROUPS.flatMap((g) => g.rows.flat().map((c) => [c.cat, c.label] as const)),
);

/* Live wedding countdown (owner 2026-06-05 · congrats screen) — anchors on PH-midnight of the
   nearest picked date (same as Home) and ticks HH:MM:SS each second while the screen is active. */
function WeddingCountdown({ iso, active }: { iso: string; active: boolean }) {
  const target = useMemo(() => new Date(`${iso}T00:00:00+08:00`).getTime(), [iso]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || !Number.isFinite(target)) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active, target]);
  if (!Number.isFinite(target)) return null;
  const ms = target - now;
  if (ms <= 0) {
    return (
      <div className="cd"><span className="cd-days">Today</span><span className="cd-lbl">it’s your wedding day</span></div>
    );
  }
  const days = Math.floor(ms / 86400000);
  const rem = ms % 86400000;
  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = `${pad(Math.floor(rem / 3600000))}:${pad(Math.floor((rem % 3600000) / 60000))}:${pad(Math.floor((rem % 60000) / 1000))}`;
  return (
    <div className="cd" role="timer" aria-label={`${days} days until your wedding`}>
      <div className="cd-main"><span className="cd-days">{days}</span><span className="cd-dayslbl">{days === 1 ? 'day' : 'days'} to go</span></div>
      <div className="cd-clock" aria-hidden="true">{clock}</div>
    </div>
  );
}

/* MatchedBundle removed 2026-06-05 — the paid upsell is now the à-la-carte in-app-services flow on
   screens 15–16 (browse + detail + savings → interested summary → Purchase Now). See INAPP_* above. */

/* ── Live savings compute — Time & Money Saved model §H/§I (owner-LOCKED 2026-06-03) ──
   Per-couple from the onboarding state — REPLACES the hardcoded demo strip (owner 2026-06-02:
   "why is this the same for everybody?"). Money is mostly flat (everyone gets the same free
   tools → ₱53,486) + ₱2,500 × expos; hours scale with the couple's picks · shortlist · runway ·
   expos. Setnayan AI stays EXCLUDED (paid SKU, retired 2026-06-03).
   See FREE_TOOL_DRIVERS below for the per-tool breakdown the Your Plan slider renders. */
/* Name fields (bride/groom · screen 4) accept letters only — no digits, no symbols
   (owner 2026-06-02). Allows Unicode letters (Filipino ñ + accents), spaces (compound
   names + spaced surnames like "Dela Cruz"/"De Leon"), hyphens ("Anne-Marie") and
   apostrophes ("D'Souza"); strips everything else live as the couple types. */
function sanitizeName(raw: string): string {
  return (raw || '').replace(/[^\p{L}\s'-]/gu, '');
}

/* Free-tool value drivers — Time & Money Saved model §H/§I (owner-LOCKED 2026-06-03,
   supersedes the old §A–§F set). `money` = market-equivalent "what you'd pay elsewhere"
   (NOT a Setnayan SKU price — these are free); `hours` = practical-time-audited (§I).
   Apparatus rule (LOCKED): every tool replaces *hiring people / DIY toil*, the couple
   brings their own. Flat money sums to ₱53,486; marketplace adds ₱2,500 × expos. The Your
   Plan slider renders this breakdown; .plansave + congrats sum it. lockedVendors/invited are
   0 at onboarding (those hours accrue post-commit), so the headline shows ~₱63.5K / ~290h. */
type SavingsInputs = {
  categories: number; shortlisted: number; runwayDays: number;
  exposReplaced: number; lockedVendors: number; invitedVendors: number;
};
type FreeToolValue = { key: string; label: string; blurb: string; vsRole: string; money: number; hours: number };
const FREE_TOOL_DRIVERS: ReadonlyArray<{
  key: string; label: string; blurb: string; vsRole: string;
  money: (c: SavingsInputs) => number; hours: (c: SavingsInputs) => number;
}> = [
  { key: 'website', label: 'Basic website', blurb: 'RSVP, your event site, and an editorial page — built for you.', vsRole: 'a hired web developer', money: () => 14999, hours: () => 50 },
  { key: 'drive', label: 'Photos on your Google Drive', blurb: 'Every original synced to your own Drive, yours to keep.', vsRole: 'a USB-and-delivery service', money: () => 5000, hours: () => 5 },
  { key: 'filtering', label: 'Smart vendor matching', blurb: 'We filter the whole market down to the vendors that fit your wedding.', vsRole: "a planner's vendor sourcing", money: () => 4999, hours: (c) => 3 * c.categories },
  { key: 'mood', label: 'Mood board', blurb: 'One styled board your vendors actually follow.', vsRole: 'a styling consult', money: () => 3999, hours: () => 5 },
  { key: 'budget', label: 'Budget tracker', blurb: 'Live spend and payment reminders — never a missed due date.', vsRole: "a planner's budget service", money: () => 3999, hours: () => 12 },
  { key: 'dashboard', label: 'Your planning dashboard', blurb: 'Checklist, schedule, and every vendor in one hub.', vsRole: 'spreadsheets and group chats', money: () => 3999, hours: (c) => 0.25 * c.runwayDays },
  { key: 'guest', label: 'Guest list + seat plan', blurb: 'Guests, RSVPs, and seating in one connected place.', vsRole: 'a guest-management service', money: () => 2999, hours: () => 12 },
  { key: 'marketplace', label: 'Verified vendor marketplace', blurb: 'Every verified PH vendor — like 50 bridal expos in your pocket.', vsRole: 'bridal-expo trips', money: (c) => 2500 * c.exposReplaced, hours: (c) => 10 * c.exposReplaced },
  { key: 'comparison', label: 'Side-by-side compare', blurb: 'Line up quotes and pick with clarity.', vsRole: 'quote-vetting legwork', money: () => 2499, hours: (c) => c.shortlisted },
  { key: 'dayof', label: 'Day-of guest portal', blurb: 'Guests self-serve their table, schedule, and photos on the day.', vsRole: 'day-of guest coordination', money: () => 1999, hours: () => 6 },
  { key: 'contract', label: 'Contract organizer', blurb: 'Upload, track key terms, e-sign, and never miss a deadline.', vsRole: 'contract admin', money: () => 1999, hours: () => 3 },
  { key: 'songlist', label: 'Songlist maker', blurb: 'Your must-play and do-not-play list for the band or DJ.', vsRole: 'a music planner', money: () => 1499, hours: () => 3 },
  { key: 'datealigner', label: 'Wedding date aligner', blurb: 'The best date your top vendors can all actually make.', vsRole: 'a date consult', money: () => 1499, hours: () => 3 },
  { key: 'foodplanner', label: 'Food planner', blurb: 'Menu plus dietary, allergy, and halal prefs for your caterer.', vsRole: 'a menu planner', money: () => 1499, hours: () => 4 },
  { key: 'monogram', label: 'Basic monogram', blurb: 'A custom mark for your wedding, generated in seconds.', vsRole: 'a designer', money: () => 1499, hours: () => 4 },
  { key: 'qr', label: 'Branded QR', blurb: 'One scan opens everything for your guests.', vsRole: 'an invitation designer', money: () => 999, hours: () => 2 },
  { key: 'fanout', label: 'One-tap inquiries', blurb: 'Reach your top matches in one tap — not one chat at a time.', vsRole: 'messaging each vendor yourself', money: () => 0, hours: (c) => 0.5 * c.categories },
  { key: 'chat', label: 'All chats in one place', blurb: 'Every vendor thread in one app, not scattered across Viber and email.', vsRole: 'chasing replies everywhere', money: () => 0, hours: (c) => 0.5 * c.lockedVendors },
  { key: 'invite', label: 'Bring your own vendor', blurb: 'Already love a vendor? Invite them — they plug right in.', vsRole: 'onboarding them yourself', money: () => 0, hours: (c) => c.invitedVendors },
  { key: 'trust', label: 'Verified-vendor safety', blurb: 'Real reviews and verified badges — no guessing, no scams.', vsRole: 'due-diligence and asking around', money: () => 0, hours: () => 0 },
];

function computeOnboardingSavings(
  state: OnboardingState,
  now: Date,
): { money: number; hours: number; breakdown: FreeToolValue[] } {
  const categories = state.picks.length;
  const shortlisted = state.shortlist.length;
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
  // No vendors locked / no BYO invites yet at onboarding-commit time — those hours accrue later.
  const c: SavingsInputs = { categories, shortlisted, runwayDays, exposReplaced, lockedVendors: 0, invitedVendors: 0 };
  const breakdown: FreeToolValue[] = FREE_TOOL_DRIVERS.map((d) => ({
    key: d.key, label: d.label, blurb: d.blurb, vsRole: d.vsRole,
    money: Math.round(d.money(c)), hours: d.hours(c),
  }));
  const money = breakdown.reduce((s, d) => s + d.money, 0);
  const hours = Math.round(breakdown.reduce((s, d) => s + d.hours, 0));
  return { money, hours, breakdown };
}

/* Free-value slider on Your Plan (owner 2026-06-05) — renders the locked §H breakdown as a
   swipeable list: each free tool with its time saved + market-equivalent "what you'd pay
   elsewhere" (apparatus rule: instead of hiring people / DIY toil). Closes on a tally card =
   the grand total. Horizontal scroll-snap keeps the no-scroll golden rule (no extra vertical
   height). Cards shown only when they save real money or ≥1 hr for this couple. */
function FreeValueSlider({ tools, money, hours, active }: { tools: FreeToolValue[]; money: number; hours: number; active: boolean }) {
  const cards = tools
    .filter((t) => t.money > 0 || t.hours >= 1)
    .slice()
    .sort((a, b) => b.money - a.money || b.hours - a.hours);
  return (
    <section className="freeblock" aria-label="What you get free">
      <div className="fb-pad">
        <div className="fb-eyebrow">Everything you get · free</div>
        <div className="fb-hero">
          <span className="fb-amt"><CountUp value={money} prefix="₱" active={active} /></span>
          <span className="fb-hrs">+ <CountUp value={hours} suffix=" hours" active={active} /></span>
        </div>
        <div className="fb-lbl">Tools a wedding planner would charge you for. Yours, ₱0 — forever.</div>
        <div className="fb-meter"><i /></div>
      </div>
      <div className="fvs-track">
        {cards.map((t, i) => (
          <article className="fvs-card" key={t.key} data-i={String(i + 1).padStart(2, '0')}>
            <div className="fvs-label">{t.label}</div>
            <div className="fvs-blurb">{t.blurb}</div>
            <div className="fvs-foot">
              <div className="fvs-price">
                {t.money > 0 && <span className="fvs-was">{pesoB(t.money)}</span>}
                <span className="fvs-free">Free</span>
                <span className="fvs-vs">{t.money > 0 ? `vs ${t.vsRole}` : `instead of ${t.vsRole}`}</span>
              </div>
              {t.hours >= 1 && <span className="fvs-hrs">⏱ {Math.round(t.hours)}h</span>}
            </div>
          </article>
        ))}
        <article className="fvs-card fvs-tally" key="__tally">
          <div className="fvs-tally-lbl">All of it</div>
          <div className="fvs-tally-amt"><CountUp value={money} prefix="₱" active={active} /> · <CountUp value={hours} suffix="h" active={active} /></div>
          <div className="fvs-tally-sub">Yours, ₱0, forever — plus one-place chat, bring-your-own-vendor &amp; verified-vendor safety.</div>
        </article>
      </div>
    </section>
  );
}

/* Onboarding-completion overlay (owner 2026-06-02). Once the couple taps the final
   button we lock the whole screen with a "creating your dashboard" overlay so they
   can't touch anything, preload the dashboard + its tabs, then navigate. The hold
   is a deliberate beat that lets the prefetches warm before we release — the
   dashboard then appears warm + instant ("make sure everything is preloaded before
   we release the loading screen to make it feel fast"). */
const ANALYZING_HOLD_MS = 2200;
// Narration steps for the completion overlay's <SDLoader> (it adds its own
// "thinking" dots, so no trailing "…"). The loader cycles these internally.
const ANALYZING_STAGES = [
  'Analyzing your preferences',
  'Matching your vendors',
  'Building your personalized dashboard',
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

export function OnboardingShell({
  authed,
  resume,
  activeFaiths = null,
  pricing,
  bgMusicUrl = null,
  refinements = REFINEMENTS_DATA,
  hiddenCats = [],
}: {
  authed: boolean;
  resume: boolean;
  /** Picker EXTRAS cats to hide (no live marketplace supply) — spec §0 available-only. */
  hiddenCats?: string[];
  /**
   * Active wedding religions from wedding_type_launch_status (the per-religion
   * launch gate, admin-controlled at /admin/wedding-types). When provided, a
   * faith chip is greyed/non-selectable unless its value is in this list. Null
   * (read failed) → fall back to the built-in `soon` flags on FAITH_CHIPS.
   */
  activeFaiths?: string[] | null;
  /**
   * Live onboarding pricing view-model, built server-side from the admin-managed
   * catalog (platform_retail_catalog_v2 + platform_package_catalog) by
   * buildOnboardingPricing in page.tsx. The à-la-carte services screens (15/16)
   * read SELLING prices from here — NO hardcoded prices (owner 2026-06-08).
   */
  pricing: OnboardingPricing;
  /**
   * Resolved stream URL for the owner-uploaded onboarding background music
   * (owner 2026-06-08 — admin uploads an owned/AI-generated track at
   * /admin/settings). Null when unset/disabled → the player never mounts.
   */
  bgMusicUrl?: string | null;
  /**
   * DB-backed refinement catalogue (owner 2026-06-08, items 8 + 9) — fetched
   * server-side via getOnboardingRefinements() in page.tsx (DB-first, falls back
   * to the REFINEMENTS_DATA module). Drives the "what kind of X?" cards. Defaults
   * to the static module so the shell renders without the prop.
   */
  refinements?: RefineLeaf[];
}) {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState>(EMPTY_ONBOARDING_STATE);
  const [hydrated, setHydrated] = useState(false);
  // Pure-moment conversational welcome (owner 2026-06-05): the intro plays once on
  // first arrival at step 0, collecting role/kind/faith inline, then hands off to the
  // Name screen. Re-entering step 0 (back-nav) shows the plain hero so it never traps.
  const [momentsDone, setMomentsDone] = useState(false);
  const [monoPop, setMonoPop] = useState(false);
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* Dream Team picker local UI (PR-3): team_basics' focused service (drives the hero
     photo + caption) + team_extras' single-open accordion parent index. Neither persists —
     only state.picks does (the flat pick array both screens mutate via pickChip). */
  const [basicFocus, setBasicFocus] = useState<string>(BASIC_CATS[0]);
  const [extrasOpen, setExtrasOpen] = useState<number | null>(null);
  /* PR-4 refine engine: position WITHIN the active pass's queue. The two passes
     (refine_basic / refine_extras) re-enter the same screen index for each queued leaf;
     refineIdx is the cursor go() walks. Both queues are pure fns of state.picks. */
  const [refineIdx, setRefineIdx] = useState(0);
  /* Phase-4 local UI: BYO bottom-sheet (12) · in-app-services detail focus (15) */
  const [focusedService, setFocusedService] = useState('');
  /* Step-14 "Reach my best matches" gate: matchAvail = did the AI find best-fit
     vendors (getOnboardingVendorCounts ≠ null)? null = not yet fetched → card hidden. */
  const [matchAvail, setMatchAvail] = useState<boolean | null>(null);
  const [matchTried, setMatchTried] = useState(false);
  const toggleInterested = (key: string) =>
    patch({
      interestedServices: state.interestedServices.includes(key)
        ? state.interestedServices.filter((x) => x !== key)
        : [...state.interestedServices, key],
    });
  // Your Plan opt-ins (screen 14) live in OnboardingState so they reach buildCommitPayload(s)
  // without a stale-closure read. state.guidanceOptIn (default ON) is still a toggle via `patch`.
  // sendTopInquiries is NO LONGER a toggle (owner 2026-06-05) — it's driven by match availability:
  // the matchAvail fetch sets it true iff the AI found best-fit vendors (else false → no fan-out).
  /* WAVE 2 (find-vendor, step 12): REAL reception venues, fetched once on entry
     (criteria-based search — the event doesn't exist yet). null = not loaded. */
  const [venues, setVenues] = useState<OnboardingVenueResult[] | null>(null);
  const [venuesLoading, setVenuesLoading] = useState(false);
  // "Expand search" reveals the "Farther afield" ring — real out-of-area venues
  // that still pass every other leaf dim (owner-locked 2026-06-05 · region rings,
  // it no longer hard-drops). Collapsed until tapped.
  const [showFarther, setShowFarther] = useState(false);
  const [byoOpen, setByoOpen] = useState(false);
  const [byoDone, setByoDone] = useState<string | null>(null);
  const [byoAdded, setByoAdded] = useState(false);
  const [byoName, setByoName] = useState('');
  const [byoPerson, setByoPerson] = useState('');
  const [byoEmail, setByoEmail] = useState('');
  /* Phase-5 cutover: account-gate email-mode toggle + the single lazy DB commit. */
  const [emailMode, setEmailMode] = useState(false);
  /* ── love-stage ephemeral UI state (the love-story DATA lives in OnboardingState) ──
     openAnchor = which of the 4 anchor tiles is inline-editing; the moment mini-form +
     its edit index. None of this persists — only state.loveStory does. */
  const [openAnchor, setOpenAnchor] = useState<keyof OnboardingState['loveStory']['anchors'] | null>(null);
  const [momentOpen, setMomentOpen] = useState(false);
  const [momentEditIdx, setMomentEditIdx] = useState<number | null>(null);
  const [mfTitle, setMfTitle] = useState('');
  const [mfYear, setMfYear] = useState('');
  const [mfMonth, setMfMonth] = useState('');
  const [mfDay, setMfDay] = useState('');
  const [committedEventId, setCommittedEventId] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const committingRef = useRef(false);
  /* Finishing overlay — blocking "creating your dashboard" screen shown the instant
     the couple taps the final button (owner 2026-06-02). The completion overlay's
     <SDLoader> narrates the "analyzing" steps internally while the dashboard
     preloads. */
  const [finishing, setFinishing] = useState(false);

  /* Hydrate from localStorage on mount (30-day TTL auto-clear). */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as OnboardingState;
        const ageMs = Date.now() - new Date(saved.lastSavedAt || 0).getTime();
        const ttlMs = ONBOARDING_DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000;
        if (saved.lastSavedAt && ageMs < ttlMs) {
          // Keep the original start time on resume UNLESS the draft sat idle a while (a fresh
          // sitting) — so "you did all this in X min" reflects active time, not wall-clock.
          const idleGap = Date.now() - new Date(saved.lastSavedAt).getTime();
          const startedAt = saved.startedAt && idleGap < 30 * 60 * 1000 ? saved.startedAt : Date.now();
          // Clamp the restored step into the current sequence so a stale index (e.g. a
          // draft saved before a fork flipped) can't point past the end. authed may be
          // false at hydrate — that's fine, activeId re-derives the filtered seq each render.
          const clampedStep = Math.min(
            Math.max(0, saved.step ?? 0),
            // Pass saved.ai (PR-1 field; legacy drafts saved before PR-1 fall back to null
            // = AI not yet asked → picker/prefs filtered out until they tap Yes on aigate).
            buildSequence(saved.kind, authed, saved.loveSkipped ?? false, saved.ai ?? null, saved.picks ?? []).length - 1,
          );
          setState({ ...EMPTY_ONBOARDING_STATE, ...saved, step: clampedStep, startedAt });
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

  /* Phase-5 resume: an anonymous visitor authenticated at the account gate and
     bounced back via ?resume=1. The hydrate effect restored their draft (parked at
     the account gate); now authed, advance past the now-satisfied gate.
     ⚠ account now follows the Dream Team chapter (find → team_payoff → aigate → …
     → account), so jumping back to 'find' would re-walk the chapter. Target 'congrats'
     instead — the first screen AFTER the (now-later) account gate — so an authenticated
     returner lands past the gate, not before it (account-reposition consequence · PR-2). */
  useEffect(() => {
    if (hydrated && resume && authed) {
      setState((s) => {
        const sq = buildSequence(s.kind, authed, s.loveSkipped, s.ai, s.picks);
        const ci = sq.indexOf('congrats');
        return ci >= 0 && s.step < ci ? { ...s, step: ci } : s;
      });
    }
  }, [hydrated, resume, authed]);

  /* Stamp the onboarding start once hydrated (a fresh draft has no startedAt yet) so the
     services summary can show "you did all this in X minutes" (owner 2026-06-05). */
  useEffect(() => {
    if (!hydrated) return;
    setState((s) => (s.startedAt == null ? { ...s, startedAt: Date.now() } : s));
  }, [hydrated]);

  const { role, kind, faith } = state;
  const patch = useCallback((p: Partial<OnboardingState>) => setState((s) => ({ ...s, ...p })), []);

  /* The active screen id, derived from state.step (an index into the FILTERED
     sequence). buildSequence drops faith for Civil + account for signed-in users,
     so the same numeric step addresses a different screen depending on those forks —
     exactly the old skip behaviour, now via array membership. */
  const seq = useMemo(() => buildSequence(state.kind, authed, state.loveSkipped, state.ai, state.picks), [state.kind, authed, state.loveSkipped, state.ai, state.picks]);
  const stepClamped = Math.min(Math.max(0, state.step), seq.length - 1);
  const activeId: ScreenId = seq[stepClamped] ?? 'welcome';

  /* PR-4 refine queues — pure derivations of state.picks (the basics in canonical BASIC
     order, the extras in flat-taxonomy order; each filtered to picked ∩ has-a-REFINEMENTS-
     entry). activeRefineQueue selects the one the current refine screen walks. */
  const refineBasicQueue = useMemo(() => refineBasicQueueFor(state.picks), [state.picks]);
  const refineExtrasQueue = useMemo(() => refineExtrasQueueFor(state.picks), [state.picks]);
  const activeRefineQueue = activeId === 'refine_basic' ? refineBasicQueue : activeId === 'refine_extras' ? refineExtrasQueue : [];
  const refinePosClamped = Math.min(Math.max(0, refineIdx), Math.max(0, activeRefineQueue.length - 1));
  const activeRefineLeaf = activeRefineQueue[refinePosClamped];
  // DB-backed refinement catalogue → O(1) lookup; resolve the active leaf's data
  // (DB-first via the `refinements` prop, static fallback for safety).
  const refinementsByKey = useMemo<Record<string, RefineLeaf>>(
    () => Object.fromEntries(refinements.map((l) => [l.key, l])),
    [refinements],
  );
  const activeRefineLeafData: RefineLeaf | undefined =
    (activeRefineLeaf ? refinementsByKey[activeRefineLeaf] : undefined) ??
    (activeRefineLeaf ? REFINEMENTS_BY_KEY[activeRefineLeaf] : undefined);

  const isCivil = kind === 'civil';

  // Loop the monogram Trace (owner 2026-06-04 "make the animation of monogram
  // loop"): while the name screen (4) is shown, replay the self-draw every few
  // seconds by bumping the lockup key below — reusing the tuned one-shot Trace
  // as a clean draw → hold → redraw loop. Gated to step 4 + prefers-reduced-
  // motion (reduced-motion users keep the static filled mark, no replay).
  const [monoReplay, setMonoReplay] = useState(0);
  useEffect(() => {
    if (activeId !== 'name') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setMonoReplay((n) => n + 1), 4500);
    return () => window.clearInterval(id);
  }, [activeId]);

  // Auto-restyle (owner 2026-06-05 "animation loop every 30 seconds"): while the
  // name screen (4) is shown, advance to the next monogram DESIGN every 30s so
  // couples see the curated styles without tapping "Generate another design".
  // The design change re-keys the mark → the self-draw Trace replays + a gentle
  // pop. Gated to step 4 + prefers-reduced-motion (reduced-motion = one static
  // design, no auto-restyle). Separate from the 4.5s self-draw replay above.
  useEffect(() => {
    if (activeId !== 'name') return;
    // Freeze the auto-restyle once the couple locks a design (owner 2026-06-08) — the
    // chosen mark must not change out from under a finalized choice.
    if (state.monogramFinalized) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let popT: number | undefined;
    const id = window.setInterval(() => {
      setState((s) => ({ ...s, monogramDesign: (s.monogramDesign + 1) % MONO_DESIGNS.length }));
      setMonoPop(true);
      popT = window.setTimeout(() => setMonoPop(false), 170);
    }, 30000);
    return () => {
      window.clearInterval(id);
      if (popT) window.clearTimeout(popT);
    };
  }, [activeId, state.monogramFinalized]);

  /* ── navigation (prototype go(d)) ──
     Navigate by INDEX within the filtered sequence. The Civil-skips-faith +
     signed-in-skips-account + AI-gated-team forks are automatic (those ids aren't in the
     seq), so there's no skip arithmetic here. PR-4 re-adds a sub-stepper: the two refine
     passes (refine_basic / refine_extras) re-enter the SAME screen index for each queued
     leaf, so go() walks refineIdx within the active pass BEFORE stepping the screen index.
     Entering a refine pass seeds the cursor (idx 0 forward · last item backward) — or skips
     the whole pass if its queue is empty. Both queues are pure fns of s.picks, computed
     inside the SAME setState updater. */
  const go = useCallback(
    (d: number) => {
      if (d === 0) return;
      setState((s) => {
        const sq = buildSequence(s.kind, authed, s.loveSkipped, s.ai, s.picks);
        const activeIdNow = sq[Math.min(Math.max(0, s.step), sq.length - 1)] ?? 'welcome';
        // ── refine re-entry: walk the queued leaves within the active pass before leaving ──
        if (REFINE_SCREENS.has(activeIdNow) && s.ai === true) {
          const q = queueFor(activeIdNow, s.picks);
          if (d > 0 && refineIdx < q.length - 1) { setRefineIdx(refineIdx + 1); return s; } // forward within the pass
          if (d < 0 && refineIdx > 0) { setRefineIdx(refineIdx - 1); return s; }            // backward within the pass
          // else: fall through to leave the pass (generic step below)
        }
        let n = Math.max(0, Math.min(sq.length - 1, s.step + d));
        const targetId = sq[n] ?? 'welcome';
        // entering a refine pass FORWARD → seed idx 0, or skip past it if the queue is empty
        if (REFINE_SCREENS.has(targetId) && d > 0) {
          const q = queueFor(targetId, s.picks);
          if (q.length === 0) { n = Math.min(sq.length - 1, n + 1); } else { setRefineIdx(0); }
        }
        // entering a refine pass BACKWARD → land on its LAST item, or keep stepping back if empty
        if (REFINE_SCREENS.has(targetId) && d < 0) {
          const q = queueFor(targetId, s.picks);
          if (q.length === 0) { n = Math.max(0, n - 1); } else { setRefineIdx(q.length - 1); }
        }
        return { ...s, step: n };
      });
    },
    [authed, refineIdx],
  );

  /* Absolute jump to a screen by id (resolves to its index in the filtered seq).
     Used by the two non-linear transitions: the ?resume bounce + the account gate. */
  const goToId = useCallback(
    (id: ScreenId) => {
      setState((s) => {
        const sq = buildSequence(s.kind, authed, s.loveSkipped, s.ai, s.picks);
        const i = sq.indexOf(id);
        return i >= 0 ? { ...s, step: i } : s;
      });
    },
    [authed],
  );

  /* The "What would you love?" picker starts empty — nothing pre-selected (owner 2026-06-05). */

  /* Find-vendor (step 12): fetch REAL reception venues once on entry — the same
     criteria-based engine the dashboard reception search uses (no eventId). Cached
     after the first load (no re-fetch on back/forward) so the screen doesn't flicker. */
  useEffect(() => {
    if (activeId !== 'find' || venues !== null || venuesLoading) return;
    setVenuesLoading(true);
    // Hold the "Finding the best venues for you…" skeleton for a beat so the search
    // always reads as a deliberate moment as vendors populate, never a flash (owner 2026-06-05).
    const startedAt = Date.now();
    const MIN_SKELETON_MS = 700;
    searchOnboardingReceptionVenues({
      kind: state.kind,
      faith: state.faith,
      receptionSettings: state.prefs.reception,
      region: state.region,
      pax: state.pax,
      // Only the discrete "specific" dates schedule-filter venues; a flexible
      // window-mode couple isn't date-constrained, so leave it unscoped.
      dateCandidates: state.dateMode === 'specific' ? state.dateCandidates : undefined,
    })
      .then((rows) => setVenues(rows))
      .catch(() => setVenues([]))
      .finally(() => {
        const wait = Math.max(0, MIN_SKELETON_MS - (Date.now() - startedAt));
        setTimeout(() => setVenuesLoading(false), wait);
      });
  }, [activeId, venues, venuesLoading, state.kind, state.faith, state.prefs.reception, state.region, state.pax, state.dateMode, state.dateCandidates]);

  /* Step-14 "Reach my best matches" gate (owner 2026-06-05): the card only shows when
     the AI actually found best-fit vendors. getOnboardingVendorCounts returns null when
     there are no real matches (it never reports a discouraging "0 fit you"), so a non-null
     result = matches exist → show the card + drive the inquiry fan-out (sendTopInquiries);
     null / error → hide it + never fan out. Fetched once on the congrats→plan stretch
     (step ≥ 13) so it's ready by step 14. */
  useEffect(() => {
    if (seq.indexOf(activeId) < seq.indexOf('congrats') || matchTried) return;
    setMatchTried(true);
    getOnboardingVendorCounts({
      kind: state.kind,
      faith: state.faith,
      receptionSettings: state.prefs.reception,
      picks: state.picks,
      region: state.region,
      pax: state.pax,
    })
      .then((c) => { const ok = c !== null; setMatchAvail(ok); setState((s) => ({ ...s, sendTopInquiries: ok })); })
      .catch(() => { setMatchAvail(false); setState((s) => ({ ...s, sendTopInquiries: false })); });
  }, [activeId, seq, matchTried, state.kind, state.faith, state.prefs.reception, state.picks, state.region, state.pax]);

  /* Pre-add the pick-matched recommended in-app services when the couple reaches Boost &
     enhance (owner 2026-06-05 · "Matched to their picks"). One-time latch (servicesSeeded) so a
     removed recommendation isn't re-added; they become normal, removable entries that feed the
     services-summary 20%-off total. */
  useEffect(() => {
    if (activeId !== 'services' || state.servicesSeeded) return;
    const rec = recommendedInappFor(state.picks);
    setState((s) => ({
      ...s,
      interestedServices: Array.from(new Set([...rec, ...s.interestedServices])),
      servicesSeeded: true,
    }));
  }, [activeId, state.servicesSeeded, state.picks]);

  /* picker card tap — toggles the pick (multi); latches pickerTouched. */
  const pickChip = (cat: string) => {
    setState((s) => {
      const has = s.picks.includes(cat);
      return { ...s, picks: has ? s.picks.filter((x) => x !== cat) : [...s.picks, cat], pickerTouched: true };
    });
  };

  /* ════ LOVE STAGE handlers (prototype loveStart · loveSkipStage · onLove · drop · pick ·
     anchors · milestones · pickTone) — the love-story DATA writes into state.loveStory /
     storyTone. COVERT: only the couple's wedding-website "Our Love Story". ════ */

  /* love_intro gate — "Tell it" enters the stage (loveSkipped false → forward). */
  const loveStart = useCallback(() => {
    setState((s) => (s.loveSkipped ? { ...s, loveSkipped: false } : s));
    go(1);
  }, [go]);
  /* love_intro gate — "Add it later" drops the love collection screens + jumps to
     'region' (the screen right after the love stage — date now PRECEDES the stage,
     owner 2026-06-08 reorder). Single setState so the recomputed sequence already
     excludes the love screens when we resolve 'region''s index. */
  const loveSkip = useCallback(() => {
    setState((s) => {
      const sq = buildSequence(s.kind, authed, true, s.ai, s.picks);
      const i = sq.indexOf('region');
      return { ...s, loveSkipped: true, step: i >= 0 ? i : s.step };
    });
  }, [authed]);

  /* ════ DREAM TEAM · the AI gate (prototype aiAnswer) ════
     The two in-screen CTAs on `aigate`. Yes → state.ai=true reveals the AI-gated
     picker+prefs (PR-2 interim set); No → state.ai=false skips them straight to
     account → congrats. go(1) then re-derives the sequence with the fork set, so the
     next screen is picker (Yes) or account (No) automatically. */
  const aiAnswer = useCallback(
    (yes: boolean) => {
      setState((s) => ({ ...s, ai: yes }));
      go(1);
    },
    [go],
  );

  /* small typed writers into state.loveStory.* (mirror onLoveText / onLoveYear). */
  const patchLove = useCallback(
    (p: Partial<OnboardingState['loveStory']>) =>
      setState((s) => ({ ...s, loveStory: { ...s.loveStory, ...p } })),
    [],
  );
  const setLoveText = (k: keyof OnboardingState['loveStory'], v: string) =>
    patchLove({ [k]: v } as Partial<OnboardingState['loveStory']>);
  const setLoveYear = (k: keyof OnboardingState['loveStory'], v: string) =>
    patchLove({ [k]: (v || '').replace(/[^0-9]/g, '') } as Partial<OnboardingState['loveStory']>);

  /* S1 · Spark sensory chip — drops a stem opener into spark only if it's still empty. */
  const dropSpark = (stem: string) => {
    setState((s) => {
      const ls = s.loveStory;
      const spark = ls.spark.trim() ? ls.spark : stem;
      return { ...s, loveStory: { ...ls, spark_anchor: stem, spark } };
    });
  };
  /* S1 · Almost cue — sets the obstacle_kind enum (the couple still finishes the sentence). */
  const pickCue = (kind: string) => patchLove({ obstacle_kind: kind });
  /* S1 · guilt-free Almost exit — clears the obstacle so the reveal gracefully omits it. */
  const skipAlmost = () => {
    patchLove({ obstacle: '', obstacle_kind: '', obstacle_kept: '' });
    go(1);
  };

  /* S2 · setting chip — seeds the proposal stem's OPENING only if still empty. */
  const PROP_OPENING: Record<string, string> = {
    beach: 'on the beach, ', surprise: 'completely out of nowhere, ', home: 'at home, ',
    trip: 'on a trip, ', meaningful: 'somewhere that already meant everything, ',
  };
  const pickProposal = (setting: string) => {
    setState((s) => {
      const ls = s.loveStory;
      const open = PROP_OPENING[setting] || '';
      const proposal = ls.proposal.trim() ? ls.proposal : open;
      return { ...s, loveStory: { ...ls, proposal_setting: setting, proposal } };
    });
  };
  /* S2 · who-asked — proposal_voice (unlocks the two-voice braid + re-points the feel prompt). */
  const pickProposalVoice = (voice: string) => patchLove({ proposal_voice: voice });

  /* S3 · 2×2 anchor tile inline value. */
  const setAnchor = (k: keyof OnboardingState['loveStory']['anchors'], v: string) =>
    setState((s) => ({ ...s, loveStory: { ...s.loveStory, anchors: { ...s.loveStory.anchors, [k]: v } } }));

  /* S4 · tone chip — storyTone (the website story voice). */
  const pickTone = (t: 'warm' | 'playful' | 'formal') => patch({ storyTone: t });

  /* S3 · milestone mini-form (add / edit / remove). Auto-sorts on every change. */
  const sortLoveMilestones = (ms: OnboardingState['loveStory']['milestones']) =>
    [...ms].sort((a, b) => {
      const k = (m: { year?: string; month?: string; day?: string }) =>
        (parseInt(m.year || '', 10) || 0) * 10000 + (parseInt(m.month || '', 10) || 0) * 100 + (parseInt(m.day || '', 10) || 0);
      return k(a) - k(b);
    });
  const weddingYearLocal = () => {
    const iso = state.dateCandidates[0] || state.windowStart || '';
    if (iso) { const y = parseInt(String(iso).slice(0, 4), 10); if (y) return y; }
    return new Date().getFullYear() + 1;
  };
  const openMomentForm = (editIdx?: number) => {
    if (typeof editIdx === 'number') {
      const m = state.loveStory.milestones[editIdx];
      setMomentEditIdx(editIdx);
      setMfTitle(m?.title || ''); setMfYear(m?.year || ''); setMfMonth(m?.month || ''); setMfDay(m?.day || '');
    } else {
      setMomentEditIdx(null);
      setMfTitle(''); setMfYear(String(Math.max(2000, weddingYearLocal() - 1))); setMfMonth(''); setMfDay('');
    }
    setMomentOpen(true);
  };
  const closeMomentForm = () => { setMomentOpen(false); setMomentEditIdx(null); };
  const submitMoment = () => {
    const title = mfTitle.trim();
    if (!title) return;
    let year = mfYear.replace(/[^0-9]/g, '').slice(0, 4);
    let month = mfMonth.replace(/[^0-9]/g, '').slice(0, 2);
    let day = mfDay.replace(/[^0-9]/g, '').slice(0, 2);
    if (parseInt(month, 10) < 1 || parseInt(month, 10) > 12) month = '';
    if (parseInt(day, 10) < 1 || parseInt(day, 10) > 31) day = '';
    if (!year) year = String(weddingYearLocal());
    setState((s) => {
      const ms = [...s.loveStory.milestones];
      if (momentEditIdx != null && ms[momentEditIdx]) ms[momentEditIdx] = { title, year, month, day };
      else ms.push({ title, year, month, day });
      return { ...s, loveStory: { ...s.loveStory, milestones: sortLoveMilestones(ms) } };
    });
    closeMomentForm();
  };
  const removeMoment = () => {
    if (momentEditIdx != null) {
      setState((s) => {
        const ms = s.loveStory.milestones.filter((_, i) => i !== momentEditIdx);
        return { ...s, loveStory: { ...s.loveStory, milestones: sortLoveMilestones(ms) } };
      });
    }
    closeMomentForm();
  };
  const MOMENT_CHIPS = ['First date', 'Pamamanhikan', 'Moved in together', 'Reunited', 'Got a pet', 'Met the family'];

  const patchPrefs = useCallback(
    (p: Partial<OnboardingState['prefs']>) => setState((s) => ({ ...s, prefs: { ...s.prefs, ...p } })),
    [],
  );

  /* PR-4 refine toggle — multi-select a leaf's option AND live-project the 3 projectable
     leaves (ceremony/catering/photo_video) onto prefs in the SAME setState so refinements +
     prefs stay atomically consistent (the recap + commit read prefs, never the raw blob).
     state.picks is NEVER mutated here — refine reads it, the picker writes it. */
  const patchRefine = useCallback((leaf: string, optKey: string) => {
    setState((s) => {
      const cur = s.refinements[leaf] ?? [];
      const nextLeaf = cur.includes(optKey) ? cur.filter((x) => x !== optKey) : [...cur, optKey];
      const refinements = { ...s.refinements, [leaf]: nextLeaf };
      return { ...s, refinements, prefs: { ...s.prefs, ...projectRefinementsToPrefs(refinements, s.faith) } };
    });
  }, []);

  /* mood = the stylist refinement (owner 2026-06-09). SINGLE-select: store the chosen style in
     refinements.stylist (taxonomy) AND derive prefs.feel via STYLE_TO_FEEL in the SAME setState so
     the palette swatches + the commit's moodFeelKey/basic_moodboard keep working. Tapping the
     selected style again clears both (lets the couple un-pick). */
  const pickStyle = useCallback((optKey: string) => {
    setState((s) => {
      const isOn = s.refinements.stylist?.[0] === optKey;
      return {
        ...s,
        refinements: { ...s.refinements, stylist: isOn ? [] : [optKey] },
        prefs: { ...s.prefs, feel: isOn ? null : feelForStyle(optKey) },
      };
    });
  }, []);

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

  // No faith is pre-selected — the couple picks their tradition on the faith screen
  // (owner 2026-06-05: no prefilled onboarding values).
  const selectKind = (k: OnboardingKind) => patch({ kind: k, faith: [] });

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

  /* Pure-moment welcome handoff (owner 2026-06-05): the conversation collected
     role/kind/faith inline → jump straight to the Name screen (step 4). Stable
     identity so the WelcomeMoments effect dep doesn't re-fire. */
  const finishMoments = useCallback(() => {
    setMomentsDone(true);
    goToId('name'); // jump past the screens the moments intro already answered (id-addressed, civil-safe)
  }, [goToId]);

  /* Active faith chips the moment player offers — mirror the standalone faith
     screen's gate (admin /admin/wedding-types when available, else the soon flag),
     so coverage never narrows below what the couple could otherwise pick. */
  const momentFaithOptions = useMemo(
    () =>
      FAITH_CHIPS.filter((c) => (activeFaiths ? activeFaiths.includes(c.value) : !c.soon)).map((c) => ({
        value: c.value,
        label: c.label,
      })),
    [activeFaiths],
  );

  /* The conversational welcome plays only on the first arrival at step 0. */
  const momentsActive = activeId === 'welcome' && !momentsDone;

  /* ── name / monogram ── */
  const firstInitial = (s: string) => {
    const w = (s || '').replace(/[^A-Za-z]/g, '');
    return w ? w[0]!.toUpperCase() : '';
  };
  const bumpMono = () => {
    setMonoPop(true);
    if (popTimer.current) clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => setMonoPop(false), 170);
  };

  /* Couple display name for screens 13 (congrats) + 14 (Your Plan) — prototype [data-couple-name]. */
  const coupleDisplay = [state.brideFirstName.trim(), state.groomFirstName.trim()].filter(Boolean).join(' & ') || 'Maria & Juan';

  /* BYO vendor send — name required → accumulate into state.byoVendors (persisted
     to the draft + the commit payload), confirm truthfully, relabel the add button. */
  const sendByo = () => {
    const name = byoName.trim();
    if (!name) return;
    const person = byoPerson.trim();
    const email = byoEmail.trim();
    setByoOpen(false);
    // Functional update so two quick "Send" taps can't clobber each other's entry.
    setState((s) => ({ ...s, byoVendors: [...s.byoVendors, { name, person, email }] }));
    setByoDone(
      `✓ ${name} added to your wedding. They'll appear in your dashboard's vendor list, where you can track and manage them.`,
    );
    setByoAdded(true);
    setByoName('');
    setByoPerson('');
    setByoEmail('');
  };
  const monoDesign = MONO_DESIGNS[state.monogramDesign] ?? MONO_DESIGNS[0]!;
  /* Only show the live monogram once BOTH first-name initials exist (owner 2026-06-05) —
     before that the figure shows a quiet hint instead of a "· & ·" placeholder. */
  const monoBi = firstInitial(state.brideFirstName);
  const monoGi = firstInitial(state.groomFirstName);
  const monoReady = monoBi !== '' && monoGi !== '';
  const cycleDesign = () => {
    // Cycling to a new design un-finalizes (owner 2026-06-08) — a fresh mark must be
    // re-confirmed via "Use this monogram" before Continue re-enables.
    patch({ monogramDesign: (state.monogramDesign + 1) % MONO_DESIGNS.length, monogramFinalized: false });
    bumpMono();
  };

  /* ── love stage derived ── */
  // The render context the weaver needs beyond the love-story blob (names + date + place).
  const lovePlaceLabel = (() => {
    const k = state.places[0];
    if (!k) return null;
    const c = cityByKey(k);
    if (c) return c.n;
    const rk = resolvePick(k).rk;
    return rk ? (REGLABEL[rk] ?? null) : null;
  })();
  /* The wedding YEAR(S) for the love timeline + reveal dateline (owner 2026-06-08 — "the
     year will be the year on the wedding date. if there are two years, then show both
     until … one is chosen"). Distinct calendar years across the couple's candidate dates
     (specific mode) or the flexible window (window mode). One year → "2027"; two →
     "2026 / 2027" until they narrow to a single year. With the date step now placed BEFORE
     the love stage, this is set by the time the timeline renders. */
  const weddingYearLabel = (() => {
    const years = new Set<number>();
    const add = (iso: string | null | undefined) => {
      const y = iso ? parseInt(String(iso).slice(0, 4), 10) : 0;
      if (y) years.add(y);
    };
    if (state.dateMode === 'specific') state.dateCandidates.forEach(add);
    else { add(state.windowStart); add(state.windowEnd); }
    const sorted = [...years].sort((a, b) => a - b);
    if (sorted.length === 0) return null; // no date yet → weave-story falls back to weddingYear()
    return sorted.slice(0, 2).join(' / ');
  })();
  const weaveCtx: WeaveContext = {
    brideFirst: state.brideFirstName,
    groomFirst: state.groomFirstName,
    brideLast: state.brideLastName,
    groomLast: state.groomLastName,
    weddingDateIso: state.dateCandidates[0] || state.windowStart || null,
    weddingYearLabel,
    placeLabel: lovePlaceLabel,
  };
  const loveTone: StoryTone = state.storyTone ?? 'warm';
  // S4 live one-line preview + S5 reveal HTML — all pure, instant (no fake "weaving" delay).
  const tonePreviewHtml = `&ldquo;${toneLine(loveTone, state.loveStory)}&rdquo;`;
  const lovePreviewMasthead = weaveMasthead(state.loveStory, weaveCtx);
  const lovePreviewPull = weavePullQuote(state.loveStory);
  const lovePreviewProse = weaveStory(loveTone, state.loveStory, weaveCtx);
  const lovePreviewTimeline = weaveTimeline(state.loveStory, weaveCtx);
  // S3 milestone rows for the in-screen (collection) timeline — derived anchors + user moments.
  const loveTLRows = milestoneRows(state.loveStory, weaveCtx);
  // The greyed duet name-pills on the hook (display-only).
  const loveDuetBride = state.brideFirstName.trim() || 'You';
  const loveDuetGroom = state.groomFirstName.trim() || 'Them';
  // S2 other-side feel prompt — name the partner when we can.
  const feelPrompt = (() => {
    const v = state.loveStory.proposal_voice;
    const b = state.brideFirstName.trim();
    const g = state.groomFirstName.trim();
    const other = v === 'me' ? b : v === 'them' ? g : '';
    return other ? `${other} — how did it actually feel right then?` : 'How did you actually feel right then?';
  })();
  // S1 whose-turn cue, pre-filled from the groom name (neutral default).
  const sparkTurn = state.groomFirstName.trim() ? `${state.groomFirstName.trim()}, you noticed first` : 'The spark';

  /* ── pax ── */
  const pax = state.pax ?? 150;
  const paxTier = paxTierFor(pax);
  const paxFill = ((Math.min(500, Math.max(10, pax)) - 10) / (500 - 10)) * 100;

  /* ── budget (text box + line picker + band-on-photo · owner 2026-06-02) ── */
  const budgetBandValue = state.budgetBand ?? 'classic';
  const budgetFloorV = budgetFloor(pax); // recommended-lowest for this guest count
  const budgetCeilingV = budgetCeiling(pax);
  const budgetSet = state.budgetBand != null; // false until the couple sets a budget — drives the unset (empty) display
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

  /* Budget starts HALFWAY (owner 2026-06-08 — "working budget must start half way"):
     the first time the couple reaches the budget screen with no budget set yet, seed it
     to the midpoint of the recommended [floor, ceiling] range for their pax. onBudgetAmount
     clamps + snaps to the nearest band, so budgetSet flips true and the slider opens
     centered. They can still drag/type or choose "No limit" from there. */
  useEffect(() => {
    if (activeId !== 'budget') return;
    if (state.budgetBand != null) return; // already set / chose "No limit"
    if (state.pax == null) return; // need a guest count to derive the range
    onBudgetAmount(Math.round((budgetFloorV + budgetCeilingV) / 2));
  }, [activeId, state.budgetBand, state.pax, budgetFloorV, budgetCeilingV, onBudgetAmount]);

  /* ── per-step chrome ── */
  const canContinue = (() => {
    switch (activeId) {
      case 'welcome':
        return true;
      case 'role':
        return role !== null;
      case 'kind':
        return kind !== null;
      case 'faith':
        return isCivil ? true : faith.length >= 1;
      case 'name':
        // All four name fields required — they auto-register the couple as the
        // bride + groom guests at commit, and go on the invitation/website/monogram.
        // PLUS the monogram must be finalized (owner 2026-06-08 — "the monogram …
        // must finalize before they can click continue").
        return (
          state.brideFirstName.trim().length > 0 &&
          state.brideLastName.trim().length > 0 &&
          state.groomFirstName.trim().length > 0 &&
          state.groomLastName.trim().length > 0 &&
          state.monogramFinalized
        );
      case 'date':
        return state.dateMode === 'specific' ? state.dateCandidates.length >= 1 : state.windowStart !== null && state.windowEnd !== null;
      case 'region':
        return state.places.length >= 1;
      case 'pax':
        return state.pax !== null;
      case 'budget':
        return state.budgetBand !== null;
      case 'team_basics':
        // Seeds state.picks — a Yes-to-AI couple always picks at least one essential.
        return state.picks.length > 0;
      // Love stage — every screen is optional, nothing blocks Continue.
      case 'love_intro':
      case 'love_spark':
      case 'love_almost':
      case 'love_proposal':
      case 'love_milestones':
      case 'love_tone':
      case 'love_preview':
        return true;
      default:
        return true;
    }
  })();

  /* ── budget tier + label for the palette feel photo (prototype budgetTier/budgetBandLabel) ── */
  const budgetTier = budgetTierBand(state.budgetBand ?? 'classic');
  const budgetLabel = (BUDGET_BANDS.find((x) => x.value === (state.budgetBand ?? 'classic')) ?? BUDGET_BANDS[2]!).label;

  /* Continue label per screen. `mood` (the terminal AI screen) carries the "Looks good"
     flourish via NEXT_LABEL_BY_ID (PR-3 — the retired prefs sub-stepper supplied it before).
     PR-4: a refine screen's CHROME CTA reads "Next service" while there are more queued
     leaves in the pass, then "Continue" on the last leaf (go() walks refineIdx, then steps). */
  const nextLabel = REFINE_SCREENS.has(activeId)
    ? (refinePosClamped < activeRefineQueue.length - 1 ? 'Next service' : 'Continue')
    : (NEXT_LABEL_BY_ID[activeId] ?? 'Continue');

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
    const firstF = faith[0] as OnboardingFaith | undefined;
    return {
      mode: 'religious' as const,
      eyebrow: 'Your tradition',
      h1: 'Your ceremony tradition',
      sub: 'We’ll match vendors who know your faith’s protocols — and pre-set things like halal catering.',
      // No faith picked yet → neutral placeholder (gradient) instead of defaulting to Catholic.
      photo: firstF ? FAITH_PHOTO[firstF] : { img: 'wed_none', cap: 'Pick your tradition' },
    };
  })();

  /* ── region nugget ── */
  // (region nugget retired — the Top-30 location step renders its own carousel + per-city nuggets)

  const sel = (cond: boolean) => (cond ? ' sel' : '');

  /* ── find-vendor (step 12) + recap (step 13) derived values · WAVE 2 real data ── */
  const receptionKey = state.prefs.reception[0];
  const findSettingLabel = receptionKey ? (RECEPTION_SETTING_LABEL[receptionKey] ?? null) : null;
  const findHeading = findSettingLabel
    ? `${findSettingLabel} venues that fit your wedding.`
    : 'Reception venues that fit your wedding.';

  /* ── Dream Team payoff stats (team_payoff + aigate proof line) ──
     FACTUAL only (no inflation): `matched` = the reception venues the find search
     actually returned; `shortlisted` = venues the couple tapped onto their shortlist;
     `hoursSaved` is a transparent derived estimate (~2.8 hrs of legwork per matched
     venue, floored at 8). `venuePool` is the plausible total pool we searched within
     (admin-tunable constant; never below `matched`). NO login on team_payoff (owner
     stripped it 2026-06-07). */
  const teamMatched = venues?.length ?? 0;
  const teamShortlisted = state.shortlist.length;
  const teamHoursSaved = Math.max(8, Math.round(teamMatched * 2.8));
  const VENUE_POOL_TOTAL = 312;
  const teamVenuePool = Math.max(VENUE_POOL_TOTAL, teamMatched);
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
  const shortlistCount = state.shortlist.length;
  /* live per-couple savings — replaces the hardcoded demo strip (owner 2026-06-02) */
  const savings = computeOnboardingSavings(state, new Date());

  /* ── Full congrats recap + services-summary extras (owner 2026-06-05) ── */
  const isHelper = state.role === 'helper';
  const recapType = (() => {
    if (state.kind === 'civil') return 'Civil';
    const fl = state.faith.map((f) => FAITH_LABEL[f] ?? cap(f)).filter((x): x is string => Boolean(x));
    if (state.kind === 'mixed') return `Mixed${fl.length ? ' · ' + fl.join(' & ') : ''}`;
    if (state.kind === 'religious') return `Religious${fl[0] ? ' · ' + fl[0] : ''}`;
    return null;
  })();
  const recapLocations = (() => {
    const names = (state.places ?? [])
      .map((k) => {
        const c = cityByKey(k);
        if (c) return c.n;
        const rk = resolvePick(k).rk;
        return rk ? (REGLABEL[rk] ?? null) : null;
      })
      .filter((x): x is string => Boolean(x));
    return names.length ? Array.from(new Set(names)).join(' · ') : null;
  })();
  const recapBudget = (() => {
    if (!state.budgetBand) return null;
    if (state.budgetBand === 'nolimit') return 'No limit';
    const band = BUDGET_BANDS.find((b) => b.value === state.budgetBand);
    const eff = effectiveBudgetPesos(state.budgetBand, state.budgetAmount, state.pax ?? 150);
    return [band?.label, eff ? fmtPeso(eff) : null].filter(Boolean).join(' · ') || null;
  })();
  const recapServices = state.picks.length
    ? `${state.picks.length} chosen — ${state.picks.slice(0, 6).map((p) => PICK_LABEL[p] ?? p).join(', ')}${state.picks.length > 6 ? '…' : ''}`
    : null;
  const recapReception = state.prefs.reception.length
    ? state.prefs.reception.map((k) => RECEPTION_SETTINGS.find((x) => x[2] === k)?.[1] ?? k).join(', ')
    : null;
  const recapCeremony = state.prefs.ceremony
    ? (ceremonyOptsFor(state.faith).find((x) => x[2] === state.prefs.ceremony)?.[1] ?? null)
    : null;
  const recapCatering = (() => {
    const parts = state.prefs.cuisine.map((k) => CUISINE_OPTS.find((x) => x[2] === k)?.[1] ?? k);
    if (state.prefs.serviceStyle) parts.push(state.prefs.serviceStyle);
    if (state.prefs.dietary.includes('halal')) parts.push('Halal');
    if (state.prefs.dietary.includes('alcohol_free')) parts.push('Alcohol-free');
    return parts.length ? parts.join(' · ') : null;
  })();
  const recapPV = (() => {
    const parts = state.prefs.pvLook.map((k) => PV_LOOKS.find((x) => x[2] === k)?.[1] ?? k);
    if (state.prefs.pvNeed) parts.push(state.prefs.pvNeed);
    if (state.prefs.pvIncluded.length) parts.push(state.prefs.pvIncluded.join(', '));
    return parts.length ? parts.join(' · ') : null;
  })();
  const recapMood = state.prefs.feel ? (FEELLBL[state.prefs.feel] ?? cap(state.prefs.feel)) : null;
  const recapSongs = state.prefs.music.length ? `${state.prefs.music.length} song${state.prefs.music.length === 1 ? '' : 's'}` : null;
  /* countdown anchor — the nearest picked date (earliest candidate · window start) */
  const earliestDateISO =
    state.dateMode === 'window'
      ? state.windowStart
      : ((state.dateCandidates ?? []).filter(Boolean).slice().sort()[0] ?? null);

  /* ════ THE DASHBOARD BLOOM (congrats screen) ════ the reveal that makes the couple feel
     their wedding website already exists (prototype buildDashboard · port plan §3). All values
     derive from captured state — no new authoritative state. COVERT: the love block is titled
     ONLY "Our Love Story"; never a song / editorial / Pakanta surface. */
  // Surnames for the identity headline — prefer captured last names, else fall back to first names.
  const bloomSurnameA = state.brideLastName.trim() || state.brideFirstName.trim() || 'Maria';
  const bloomSurnameB = state.groomLastName.trim() || state.groomFirstName.trim() || 'Juan';
  // Partner first name for the share footer "Show {partner} 💍" row (groom side, mirrors prototype).
  const bloomPartnerName = state.groomFirstName.trim() || 'them';
  // Display-only share slug ("brideandgroom") — the real page link is minted on the dashboard.
  const coupleSlug =
    [state.brideFirstName, state.groomFirstName]
      .map((n) => n.trim().toLowerCase().replace(/[^a-z0-9]+/g, ''))
      .filter(Boolean)
      .join('and') || 'yourwedding';
  // Does the couple actually have a love story, or did they skip / leave it blank?
  const bloomHasStory =
    !state.loveSkipped &&
    Boolean(
      state.loveStory.spark.trim() ||
        state.loveStory.how_we_met.trim() ||
        state.loveStory.spark_why.trim() ||
        state.loveStory.proposal.trim(),
    );
  // The woven "Our Love Story" prose — same call the love-stage reveal uses (loveTone + weaveCtx).
  const bloomStoryProse = bloomHasStory ? weaveStory(loveTone, state.loveStory, weaveCtx) : null;

  /* services summary (16): pick-matched recommendations · onboarding duration · grand total saved */
  const recommendedSet = useMemo(() => new Set(recommendedInappFor(state.picks)), [state.picks]);
  const elapsedMin = state.startedAt ? Math.max(1, Math.round((Date.now() - state.startedAt) / 60000)) : null;
  // Live SELLING price from the admin catalog (pricing.svc[k].set). For the
  // pax SKU (PAPIC_GUEST) this aggregate uses the floor — onboarding has no
  // committed pax; the authoritative charge is recomputed at order time. The
  // `out` market anchors are illustrative (not Setnayan prices).
  const addonSetTotal = state.interestedServices.reduce((sum, k) => sum + (pricing.svc[k]?.set ?? 0), 0);
  const addonMarketTotal = state.interestedServices.reduce((sum, k) => sum + (pricing.svc[k]?.out ?? 0), 0);
  const grandMoney = savings.money + Math.max(0, addonMarketTotal - Math.round(addonSetTotal * (1 - ONBOARDING_PROMO)));

  /* ════ THE MIRROR ════ a live wedding-website preview ribbon that accretes one real
     element with every answer (prototype Onboarding_Wedding_Adaptive_Flow §3 · port plan §4).
     Born at the `name` screen (the moment the couple has names + a mark to show); hidden on
     the welcome moments, the love reveal, and the final recap/plan/summary screens (those are
     themselves full previews, so the mini-mirror would be redundant). It is a pure read-model
     of OnboardingState — no new authoritative state, no interaction beyond an optional caption
     peek. COVERT: it surfaces only wedding-website-shaped facts (names, mark, tone-voice, kind,
     place, guests, date, reception) — never a song / editorial / Pakanta chip. */
  const mirror = useMemo(() => {
    const nameAt = seq.indexOf('name');
    const here = seq.indexOf(activeId);
    const show =
      nameAt >= 0 &&
      here >= nameAt &&
      !momentsActive &&
      activeId !== 'love_preview' &&
      activeId !== 'congrats' &&
      activeId !== 'plan' &&
      activeId !== 'summary';

    // countdown days to the nearest picked date (earliest candidate · window start)
    const days = (() => {
      if (!earliestDateISO) return null;
      const d = new Date(earliestDateISO.slice(0, 10) + 'T00:00:00');
      if (Number.isNaN(d.getTime())) return null;
      const n = Math.round((d.getTime() - Date.now()) / 86400000);
      return n > 0 ? n : null;
    })();

    // the live wedding page is "live" the moment names exist — always the first chip,
    // so the row reads left→right like "look how far you've come".
    const hasNames = state.brideFirstName.trim().length > 0 || state.groomFirstName.trim().length > 0;
    // date chip is present once any date intent exists (specific candidate(s) or a window)
    const hasDate =
      (state.dateMode === 'specific' && (state.dateCandidates ?? []).filter(Boolean).length > 0) ||
      (state.dateMode === 'window' && state.windowStart !== null);

    // chips accrete IN ORDER; each carries a stable key (for the pop-once animation) +
    // a payoff caption that flashes over the row the first time the chip lands.
    const chips = [
      hasNames && { k: 'page', t: '♥ Page', cap: "That's your wedding page — it fills in as you go." },
      // love-story tone = the website's "Our Love Story" VOICE (the only love chip allowed)
      !state.loveSkipped &&
        state.storyTone && {
          k: 'voice',
          t: '“Our Love Story”',
          cap: `${cap(state.storyTone)} — your Love Story voice is set on your page.`,
        },
      recapType && { k: 'kind', t: recapType, cap: 'Your ceremony is on your page.' },
      lovePlaceLabel && { k: 'loc', t: '📍 ' + lovePlaceLabel, cap: 'Your guests get directions from your page.' },
      state.pax != null && { k: 'pax', t: `${state.pax} guests`, cap: 'Your guest count is set.' },
      hasDate && {
        k: 'date',
        t: days ? `⏱ ${days}d` : '⏱ Date',
        cap: days ? `${days} days until you become one.` : 'Your countdown is on your page.',
      },
      recapReception && { k: 'venue', t: '🏛 ' + recapReception, cap: 'Your reception — with a map — is on your page.' },
    ].filter((c): c is { k: string; t: string; cap: string } => Boolean(c));

    return {
      show,
      monoA: monoBi || 'M',
      monoB: monoGi || 'C',
      names: hasNames ? coupleDisplay : 'Your wedding website',
      chips,
    };
  }, [
    seq,
    activeId,
    momentsActive,
    earliestDateISO,
    state.brideFirstName,
    state.groomFirstName,
    state.dateMode,
    state.dateCandidates,
    state.windowStart,
    state.loveSkipped,
    state.storyTone,
    state.pax,
    recapType,
    lovePlaceLabel,
    recapReception,
    monoBi,
    monoGi,
    coupleDisplay,
  ]);

  /* Mirror accretion: track which chip keys have been seen so each pops only the first
     time it lands, and flash its caption over the row on arrival (mirrors the prototype's
     mirrorSeen + mir-cap behaviour). seenChips is a ref (no re-render); newest drives the
     caption via a short-lived piece of state. */
  const mirSeen = useRef<Set<string>>(new Set());
  const [mirCap, setMirCap] = useState<string | null>(null);
  const mirCapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mirPoppedKeys = useMemo(() => {
    if (!mirror.show) return new Set<string>();
    const fresh = new Set<string>();
    let newestCap: string | null = null;
    for (const c of mirror.chips) {
      if (!mirSeen.current.has(c.k)) {
        mirSeen.current.add(c.k);
        fresh.add(c.k);
        newestCap = c.cap; // last new chip in order wins the caption
      }
    }
    if (newestCap) {
      // defer the caption flash out of render (avoids a setState-in-render warning)
      queueMicrotask(() => {
        setMirCap('✨ ' + newestCap);
        if (mirCapTimer.current) clearTimeout(mirCapTimer.current);
        mirCapTimer.current = setTimeout(() => setMirCap(null), 1800);
      });
    }
    return fresh;
  }, [mirror.show, mirror.chips]);
  const peekMirror = () => {
    setMirCap('✨ Keep going — your whole website appears at the end');
    if (mirCapTimer.current) clearTimeout(mirCapTimer.current);
    mirCapTimer.current = setTimeout(() => setMirCap(null), 1400);
  };

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
      venueLatitude: s.places[0] ? resolvePick(s.places[0]).lat : null,
      venueLongitude: s.places[0] ? resolvePick(s.places[0]).lon : null,
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
      monogramStyle: MONO_DESIGNS[s.monogramDesign]?.style ?? null,
      moodFeelKey: s.prefs.feel,
      musicPlaylistSeed: s.prefs.music,
      // Phase A: persist the picker selections (auto-inquired best-fit per
      // category at commit) + the reception setting (seeds venue_setting).
      picks: s.picks,
      receptionSettings: s.prefs.reception,
      // owner 2026-06-05 canonical-fields close-out: screen-2 role (G1) → event_moderators,
      // the up-to-2 area picks (G2), and the FEELS palette derived from the feel (G4).
      role: s.role,
      places: s.places,
      basicMoodboard: s.prefs.feel ? (FEELS[s.prefs.feel] ?? null) : null,
      // The find-vendor shortlist (real reception venues the couple tapped) —
      // persisted as event_vendors 'considering' so they show on the Services tab.
      shortlist: s.shortlist.map((v) => ({ vendorId: v.vendorId, name: v.name })),
      // The full style sub-stepper prefs blob → events.style_preferences for
      // DISPLAY on the Home "Personalized for you" card (the features that
      // matter for the different services). Display only, not vendor matching.
      // Cast: OnboardingPrefs is a fixed-key interface (no index signature),
      // so it needs an explicit widen to the payload's Record<string, unknown>.
      // PR-4: the refine projection is re-applied here IDEMPOTENTLY so the commit carries
      // the projected ceremony/cuisine/pvLook/dietary even if a resumed draft never ran a
      // live patchRefine. Re-projecting an already-projected state yields the same keys.
      stylePreferences: { ...s.prefs, ...projectRefinementsToPrefs(s.refinements, s.faith) } as Record<string, unknown>,
      // Your Plan opt-ins (screen 14) — free-guidance flag + top-3 inquiry fan-out choice.
      guidanceOptIn: s.guidanceOptIn,
      sendTopInquiries: s.sendTopInquiries,
      inquiriesPerCategory: s.inquiriesPerCategory,
      interestedServices: s.interestedServices,
      // Dream Team chapter — per-leaf refinement detail (the raw multi-select blob; the
      // 3 projectable leaves ALSO ride prefs via the projection above). Projection onto
      // prefs landed PR-4 (live in patchRefine + idempotent in stylePreferences above).
      refinements: s.refinements,
      // BYO vendors (screen-12 "Add your own vendor" sheet) — off-platform contacts
      // the couple typed in. Persisted at commit as event_vendors 'considering'
      // freeform rows so they show on the dashboard Services tab.
      byoVendors: s.byoVendors,
      // LOVE STAGE → the couple's wedding-website "Our Love Story". The full told-back
      // blob (every love_* field, incl. the together_since YEAR) rides events.love_story;
      // the chosen voice → story_tone. specialMessage / togetherSince stay top-level
      // (their own events columns) — null unless explicitly set, so the DATE/TEXT inserts
      // never choke on an empty string. A SKIPPED stage leaves love_story largely blank
      // but still persists the (empty) shape, which is harmless. COVERT: story-shaped only.
      loveStory: s.loveSkipped ? {} : (s.loveStory as unknown as Record<string, unknown>),
      storyTone: s.loveSkipped ? null : s.storyTone,
      storyLanguage: s.storyLanguage,
      specialMessage: s.specialMessage.trim() ? s.specialMessage : null,
      togetherSince: s.togetherSince.trim() ? s.togetherSince : null,
    }),
    [],
  );

  const handleFinish = useCallback(async (purchase = false, bundleOverride?: 'essentials' | 'complete' | null) => {
    if (committingRef.current) return;
    setCommitError(null);

    // Preload the dashboard + every tab the couple might click, then hold the
    // analyzing overlay a beat so the prefetches warm before we navigate. The
    // overlay covers everything until the dashboard actually swaps in — no flash
    // of the onboarding underneath + no click-lag on Home/Guests/Services/Website/
    // More once they land (owner 2026-06-02).
    const goToDashboard = (eventId: string, toServices = false) => {
      const base = `/dashboard/${eventId}`;
      // Bundle branch (owner 2026-06-08): if the couple chose an Essentials/Complete bundle on
      // the new `bundle` screen, Purchase Now routes to the bundle checkout (add-ons/bundle?code=
      // <package_code>), which resolves the package price SERVER-SIDE from the live package
      // catalog and mounts InlineCheckoutDrawer keyed service_key=package_code. Mutually
      // exclusive with the à-la-carte path: a bundle pick takes precedence and the
      // interestedServices paySlug logic below is skipped entirely. Null (no bundle) →
      // identical à-la-carte behavior as before.
      // Use the explicit override (the card's own "Get {title}" CTA passes its key, since
      // setState in the same tick hasn't flushed yet) and fall back to committed state.
      const sel = bundleOverride !== undefined ? bundleOverride : state.selectedBundle;
      const bundleVM = toServices && sel ? pricing.bundles[sel] : null;
      // Purchase Now jumps straight to the in-app checkout card (InlineCheckoutDrawer · BDO/GCash QR
      // + reference) for the FIRST picked service that has a built checkout page (owner 2026-06-06)
      // — the couple pays there; the rest stay payable on the Services tab. Falls back to the
      // Services tab when no pick is mappable; continue-free lands on Home.
      const paySlug = toServices && !bundleVM
        ? state.interestedServices.map((k) => INAPP_TO_ADDON_SLUG[k]).find(Boolean)
        : undefined;
      const dest = bundleVM
        ? `${base}/add-ons/bundle?code=${encodeURIComponent(bundleVM.code)}`
        : paySlug
          ? `${base}/add-ons/${paySlug}`
          : toServices
            ? `${base}/vendors`
            : base;
      try {
        router.prefetch(base); // Home
        router.prefetch(`${base}/guests`); // Guests
        router.prefetch(`${base}/vendors`); // Services
        router.prefetch(`${base}/website`); // Website
        router.prefetch(`${base}/more`); // More
        if (paySlug || bundleVM) router.prefetch(dest); // the checkout card we're landing on
      } catch {
        /* prefetch is best-effort */
      }
      // Warm SPA transition after the deliberate hold.
      window.setTimeout(() => {
        try {
          router.push(dest);
        } catch (err) {
          // SPA push threw — fall back to a hard navigation (backup route).
          // Report it: a recurring router wedge here is exactly the "stuck on
          // Creating your dashboard" class the watchdog below guards against.
          void trackFailure({
            eventType: 'BLANK_FALLBACK',
            elementName: 'Onboarding · post-commit router.push (hard-nav fallback)',
            filePath: 'app/onboarding/wedding/_components/onboarding-shell.tsx',
            error: err,
            payload: { dest },
          });
          window.location.assign(dest);
        }
      }, ANALYZING_HOLD_MS);
      // Stranding watchdog (owner report 2026-06-03: stuck forever on "Creating
      // your personalized dashboard"). If the client router wedges or the push
      // silently no-ops, force a hard navigation — a real page load always works
      // even when the SPA router is stuck, so the couple can never be trapped on
      // the overlay. A successful push has already left /onboarding by now, so on
      // the happy path this is a no-op.
      window.setTimeout(() => {
        if (
          typeof window !== 'undefined' &&
          window.location.pathname.startsWith('/onboarding')
        ) {
          window.location.assign(dest);
        }
      }, ANALYZING_HOLD_MS + 4000);
    };

    // Idempotent: event already exists (back-then-forward) — show the overlay + go.
    if (committedEventId) {
      setFinishing(true);
      try {
        localStorage.removeItem(ONBOARDING_DRAFT_KEY);
      } catch {
        /* non-fatal */
      }
      goToDashboard(committedEventId, purchase);
      return;
    }

    // Lock the screen the instant they tap finish — the overlay covers the whole
    // commit + preload so the customer can't touch anything (owner 2026-06-02).
    setFinishing(true);
    committingRef.current = true;
    setCommitting(true);
    try {
      const payload = buildCommitPayload(state);
      // Purchase Now carries the couple's selected paid services into the commit (persisted to
      // events.style_preferences.interested_services); "continue with the free plan" drops them.
      if (!purchase) payload.interestedServices = [];
      const res = await commitOnboardingWedding(payload);
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
        goToDashboard(res.eventId, purchase);
      } else if (res.error === 'not_authenticated') {
        // Session lost mid-flow — drop the overlay + bounce to the account gate.
        setFinishing(false);
        setCommitError('Please create your account to save your plan.');
        goToId('account');
      } else {
        // Surface the error + let them retry — don't strand them on the overlay.
        setFinishing(false);
        setCommitError('Something went wrong saving your plan. Please try again.');
      }
    } catch (err) {
      // The server action REJECTED outright — a 500, a serverless function
      // timeout, or a dropped RSC transport on a wobbly mobile connection. With
      // no catch the awaited promise rejected unhandled, so committingRef stayed
      // locked and the overlay stayed up forever with no error + no way to retry
      // (owner report 2026-06-03: "never loaded"). Unwind everything + let them
      // tap finish again.
      console.error('[onboarding] commit rejected', err);
      void trackFailure({
        eventType: 'SUPABASE_SAVE_ERROR',
        elementName: 'Onboarding · commit wedding plan (rejected)',
        filePath: 'app/onboarding/wedding/_components/onboarding-shell.tsx',
        error: err,
        payload: { action: 'commitOnboardingWedding', hadCommittedEventId: Boolean(committedEventId) },
      });
      committingRef.current = false;
      setCommitting(false);
      setFinishing(false);
      setCommitError('Something went wrong saving your plan. Please try again.');
    }
  }, [committedEventId, state, buildCommitPayload, router, goToId, pricing]);

  return (
    <div className="onbw">
      {/* Desktop-only editorial canvas (≥1024px) beside the phone frame. Hidden
          on mobile + tablet; the phone frame below is byte-for-byte unchanged. */}
      <OnboardingDesktopAside />
      {/* Blocking completion overlay — covers the whole viewport so the customer
          can't touch anything while we create the event + preload the dashboard
          (owner 2026-06-02). Stays up until the dashboard navigation swaps in. */}
      {finishing && (
        <div className="fin-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="fin-inner">
            <div className="fin-title">Creating your personalized dashboard</div>
            {/*
              Shared brand loader (Organic loaders handoff 2026-06-07) — the
              animated mark gathers + the status line narrates the stages while
              we create the event and preload the dashboard. Replaces the old
              ring spinner + static mark + cycling sub-text.
            */}
            <SDLoader steps={ANALYZING_STAGES} hint="Personalizing" />
          </div>
        </div>
      )}
      <div className="phone" data-welcome={activeId === 'welcome' ? '' : undefined}>
        {/* top — brand + progress */}
        <div className="top">
          <div className="brandrow">
            <button
              className="btn-back"
              type="button"
              onClick={() => go(-1)}
              aria-label="Back"
              style={{ display: activeId === 'welcome' ? 'none' : 'inline-flex' }}
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
            {/* Owner-uploaded background music (owner 2026-06-08) — only when admin set a
                track. margin-left:auto right-aligns it; sits beside Skip when shown. */}
            {bgMusicUrl ? <OnboardingMusic src={bgMusicUrl} /> : null}
            <button
              className="skip"
              type="button"
              onClick={() => go(1)}
              style={{ display: CAN_SKIP_BY_ID[activeId] ? 'inline-block' : 'none' }}
            >
              Skip
            </button>
          </div>
          {activeId === 'welcome' && !momentsActive && <div className="brandtag">Wedding planning, simplified</div>}
          <div className="bar" style={momentsActive ? { visibility: 'hidden' } : undefined}>
            <div className="barfill" style={{ width: `${((stepClamped + 1) / seq.length) * 100}%` }} />
          </div>
          {/* THE MIRROR — pinned live wedding-website preview ribbon (never in the scrollable
              body, so it can't grow the frame). Accretes one chip per answer from the `name`
              screen onward. Tap flashes a "keep going" caption (peekMirror). */}
          {mirror.show && (
            <div
              className="mirror"
              onClick={peekMirror}
              role="button"
              tabIndex={0}
              aria-label="Your wedding website preview"
            >
              <div className="mir-card">
                <div className="mir-mono">
                  {mirror.monoA}
                  <span className="amp">&amp;</span>
                  {mirror.monoB}
                </div>
                <div className="mir-mid">
                  <div className="mir-top">
                    <span className="mir-names">{mirror.names}</span>
                    <span className="mir-badge">
                      <span className="dot" />
                      building
                    </span>
                  </div>
                  <div className="mir-r2">
                    <div className="mir-chips">
                      {mirror.chips.map((c) => (
                        <span key={c.k} className={`mir-chip${mirPoppedKeys.has(c.k) ? ' pop' : ''}`}>
                          {c.t}
                        </span>
                      ))}
                    </div>
                    <div className={`mir-cap${mirCap ? ' show' : ''}`}>{mirCap}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* body — only the active screen displays */}
        <div className="body">
          {/* 1 WELCOME — pure-moment conversation on first arrival (owner 2026-06-05);
              plain hero on back-nav re-entry so the screen never traps. */}
          <section className={`screen welcomescreen${activeId === 'welcome' ? ' active' : ''}${momentsActive ? ' moments-on' : ''}`}>
            {momentsActive ? (
              <div className="viewzone momentwrap">
                <WelcomeMoments
                  faithOptions={momentFaithOptions}
                  onPickRole={selectRole}
                  onPickKind={selectKind}
                  onPickFaith={selectFaith}
                  onDone={finishMoments}
                />
              </div>
            ) : (
              <div className="welcomehero">
                <HeroImg src={ASSET('welcome')} />
                <div className="welcomeoverlay">
                  <h1>Start with the view. We{'’'}ll handle the details.</h1>
                  <p>Tell us your date. Get a free wedding plan + matched vendors in minutes.</p>
                </div>
              </div>
            )}
          </section>

          {/* 2 ROLE */}
          <section className={`screen${activeId === 'role' ? ' active' : ''}`} id="screen-role">
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
                  // key includes `role` on the selected card so it remounts when the
                  // selection moves → the .sn-bounce replays on each newly-picked role.
                  <div key={role === o.value ? `${o.value}-sel-${role}` : o.value} className={`opt${sel(role === o.value)}${role === o.value ? ' sn-bounce' : ''}`} onClick={() => selectRole(o.value)}>
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
          <section className={`screen${activeId === 'kind' ? ' active' : ''}`} id="screen-kind">
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
                  // key includes `kind` on the selected card so it remounts when the
                  // selection moves → the .sn-bounce replays on each newly-picked kind.
                  <div key={kind === o.value ? `${o.value}-sel-${kind}` : o.value} className={`opt${sel(kind === o.value)}${kind === o.value ? ' sn-bounce' : ''}`} onClick={() => selectKind(o.value)}>
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
          <section className={`screen${activeId === 'faith' ? ' active' : ''}`} id="screen-faith">
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
                  {FAITH_CHIPS.map((c) => {
                    // Gate on the launch status when we have it (admin
                    // /admin/wedding-types); fall back to the built-in soon
                    // flag if the status read was unavailable.
                    const soon = activeFaiths ? !activeFaiths.includes(c.value) : c.soon;
                    const picked = faith.includes(c.value);
                    return (
                      <span
                        // key folds in this chip's selected state so it remounts when it
                        // becomes selected → the .sn-bounce replays on each pick.
                        key={picked ? `${c.value}-sel` : c.value}
                        className={`chip${sel(picked)}${soon ? ' is-soon' : ''}${picked ? ' sn-bounce' : ''}`}
                        onClick={soon ? undefined : () => selectFaith(c.value)}
                        aria-disabled={soon || undefined}
                      >
                        {c.label}
                        {soon && <span className="soon">soon</span>}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* 5 NAME — live monogram + Frame/Font cyclers + bride/groom */}
          <section className={`screen${activeId === 'name' ? ' active' : ''}`} id="screen-name">
            <div className="viewzone">
              <div className="eyebrow">Your wedding</div>
              <h1 className="q">The two of you.</h1>
              <figure className="monogram">
                {/* Only render the monogram once BOTH first-name initials are in
                    (owner 2026-06-05) — until then a quiet hint holds the space, so
                    the couple never sees a "· & ·" mark with no values. key by design
                    index + a periodic replay tick so the Trace effect (letters draw
                    themselves) LOOPS: it replays on "Generate another design" AND every
                    ~4.5s while this screen is shown (monoReplay). The mark propagates to
                    the couple's invitation, website, save-the-date, live background,
                    livestream + videos. */}
                {monoReady ? (
                  <MonoLockup
                    key={`${state.monogramDesign}:${monoReplay}`}
                    design={monoDesign}
                    bi={monoBi}
                    gi={monoGi}
                    brideName={state.brideFirstName}
                    groomName={state.groomFirstName}
                    pop={monoPop}
                  />
                ) : (
                  <div className="mono-empty" aria-hidden="true">Your monogram appears here</div>
                )}
              </figure>
            </div>
            <div className="tapzone">
              {/* Monogram controls (owner 2026-06-08): the couple must FINALIZE the mark
                  before Continue unlocks. While unconfirmed → cycle designs + "Use this
                  monogram". Once set → a calm confirmation + "Change design" to re-open. */}
              <div className="mono-controls">
                {monoReady && state.monogramFinalized ? (
                  <div className="mono-locked">
                    <span className="mono-locked-tag"><span className="ic" aria-hidden="true">✓</span> Monogram set</span>
                    <button type="button" className="mono-btn mono-gen" onClick={cycleDesign}>
                      <span className="ic" aria-hidden="true">{'↻'}</span> Change design
                    </button>
                  </div>
                ) : (
                  <>
                    <button type="button" className="mono-btn mono-gen" onClick={cycleDesign}>
                      <span className="ic" aria-hidden="true">{'↻'}</span> Generate another design
                    </button>
                    <button
                      type="button"
                      className="mono-btn mono-use"
                      onClick={() => patch({ monogramFinalized: true })}
                      disabled={!monoReady}
                      title={monoReady ? undefined : 'Add both first names to see your monogram'}
                    >
                      Use this monogram
                    </button>
                  </>
                )}
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
                      // Editing a first name changes the mark → require re-confirming it.
                      patch({ brideFirstName: sanitizeName(e.target.value), monogramFinalized: false });
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
                      // Editing a first name changes the mark → require re-confirming it.
                      patch({ groomFirstName: sanitizeName(e.target.value), monogramFinalized: false });
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

          {/* ════════════════ LOVE STAGE (6 screens · website "Our Love Story") ════════════════
              COVERT: couple-facing copy names ONLY "your wedding website" / "…website story".
              S0 hook · S1 spark+almost · S2 the yes · S3 little things · S4 voice · S5 reveal.
              Ported faithfully from Onboarding_Wedding_Adaptive_Flow_2026-06-07.html. ════════ */}

          {/* S0 · THE HOOK (love_intro) — twin-ghost threshold; "Add it later" skips the stage. */}
          <section className={`screen${activeId === 'love_intro' ? ' active' : ''}`} id="screen-love-intro">
            <div className="viewzone">
              <div className="loveglyph">{'♡'}</div>
              <div className="eyebrow">Your wedding website</div>
              <h1 className="q">How did the two of you happen?</h1>
              <p className="sub">Tell it like you{'’'}d tell a friend over coffee — we{'’'}ll write it onto your page and read it back to you. Two minutes, mostly tapping.</p>
              <div className="duet">
                <span className="vpill muted"><span className="dot her" />{loveDuetBride}</span>
                <span className="vpill muted"><span className="dot" />{loveDuetGroom}</span>
              </div>
            </div>
            <div className="tapzone">
              <button type="button" className="btn btn-primary" style={{ width: '100%', marginBottom: 6 }} onClick={loveStart}>Tell it</button>
              <div className="ghost" onClick={loveSkip}><u>Add it later</u></div>
            </div>
          </section>

          {/* S1a · THE SPARK (love_spark) — ONE story per page (owner 2026-06-08 "set each
              page to be 1 story"): how you two met + the detail that stuck. */}
          <section className={`screen${activeId === 'love_spark' ? ' active' : ''}`} id="screen-love-spark">
            <div className="viewzone">
              <div className="eyebrow">Your love story · 1 of 4 · how you met</div>
              <h1 className="q">How you two met</h1>
              <p className="sub">{sparkTurn} — what{'’'}s the very first thing you noticed about each other?</p>
              {/* the Spark stem */}
              <div className="stem">
                <span className="stem-pre">The first thing I noticed was{'…'}</span>
                <textarea
                  className="field"
                  rows={2}
                  placeholder="his hands — shaking as he handed me the wrong coffee"
                  value={state.loveStory.spark}
                  onChange={(e) => setLoveText('spark', e.target.value)}
                />
              </div>
              <div className="sparkchips">
                {[
                  { stem: '☂ the weather — ', label: '☂ the weather' },
                  { stem: '🎵 the song that was playing — ', label: '🎵 a song' },
                  { stem: '📍 the place — ', label: '📍 the place' },
                  { stem: '😅 the awkward part — ', label: '😅 the awkward part' },
                ].map((c) => (
                  <span key={state.loveStory.spark_anchor === c.stem ? `${c.stem}-sel` : c.stem} className={`sc${sel(state.loveStory.spark_anchor === c.stem)}${state.loveStory.spark_anchor === c.stem ? ' sn-bounce' : ''}`} onClick={() => dropSpark(c.stem)}>{c.label}</span>
                ))}
              </div>
              <div className={`followup${state.loveStory.spark.trim() ? ' show' : ''}`}>
                <div className="fu-q">Why did that stick?</div>
                <textarea
                  className="field"
                  rows={2}
                  placeholder="she held the cup with both hands like it was the only warm thing in Baguio"
                  value={state.loveStory.spark_why}
                  onChange={(e) => setLoveText('spark_why', e.target.value)}
                />
              </div>
              <div className="tinyyear">
                <label>+ when did you meet?</label>
                <input inputMode="numeric" maxLength={4} placeholder="2018" value={state.loveStory.met_year} onChange={(e) => setLoveYear('met_year', e.target.value)} />
                <label>together since{'…'}</label>
                <input inputMode="numeric" maxLength={4} placeholder="2019" value={state.loveStory.together_since} onChange={(e) => setLoveYear('together_since', e.target.value)} />
              </div>
            </div>
          </section>

          {/* S1b · THE ALMOST (love_almost) — its OWN page now (owner 2026-06-08). */}
          <section className={`screen${activeId === 'love_almost' ? ' active' : ''}`} id="screen-love-almost">
            <div className="viewzone">
              <div className="eyebrow">Your love story · 2 of 4 · the almost</div>
              <h1 className="q">The almost</h1>
              <p className="sub">Every story has an almost — it{'’'}s what makes the ending land. If yours was easy, skip it.</p>
              <div className="stem tight">
                <span className="stem-pre">There was a moment we almost didn{'’'}t make it because{'…'}</span>
                <textarea
                  className="field"
                  rows={2}
                  placeholder="finish it in your own words"
                  value={state.loveStory.obstacle}
                  onChange={(e) => setLoveText('obstacle', e.target.value)}
                />
              </div>
              <div className="sparkchips">
                {[
                  { kind: 'distance', label: 'Time apart?' },
                  { kind: 'family', label: 'Family questions?' },
                  { kind: 'different_paths', label: 'Different dreams?' },
                  { kind: 'doubt', label: 'Just wasn’t sure?' },
                ].map((c) => (
                  <span key={state.loveStory.obstacle_kind === c.kind ? `${c.kind}-sel` : c.kind} className={`sc${sel(state.loveStory.obstacle_kind === c.kind)}${state.loveStory.obstacle_kind === c.kind ? ' sn-bounce' : ''}`} onClick={() => pickCue(c.kind)}>{c.label}</span>
                ))}
              </div>
              <div className={`followup${state.loveStory.obstacle.trim() ? ' show' : ''}`}>
                <div className="fu-q">What kept you going?</div>
                <textarea
                  className="field"
                  rows={2}
                  placeholder="we kept counting down to the next time we’d be in the same room"
                  value={state.loveStory.obstacle_kept}
                  onChange={(e) => setLoveText('obstacle_kept', e.target.value)}
                />
              </div>
              <div className="ghost" style={{ textAlign: 'left', marginTop: 9 }} onClick={skipAlmost}><u>Ours was easy — skip</u></div>
            </div>
          </section>

          {/* S2 · THE YES (love_proposal) — setting chips + stem + who-asked + required feel. */}
          <section className={`screen${activeId === 'love_proposal' ? ' active' : ''}`} id="screen-love-proposal">
            <div className="viewzone">
              <div className="eyebrow">Your love story · 3 of 4 · the yes</div>
              <h1 className="q">The proposal</h1>
              <p className="sub">Where it happened, how it felt, who asked.</p>
              <div className="sparkchips">
                {[
                  { prop: 'beach', label: 'Beach' },
                  { prop: 'surprise', label: 'A surprise' },
                  { prop: 'home', label: 'At home' },
                  { prop: 'trip', label: 'On a trip' },
                  { prop: 'meaningful', label: 'Somewhere meaningful' },
                ].map((c) => (
                  <span key={state.loveStory.proposal_setting === c.prop ? `${c.prop}-sel` : c.prop} className={`sc${sel(state.loveStory.proposal_setting === c.prop)}${state.loveStory.proposal_setting === c.prop ? ' sn-bounce' : ''}`} onClick={() => pickProposal(c.prop)}>{c.label}</span>
                ))}
              </div>
              <div className="stem">
                <span className="stem-pre">I knew the moment{'…'}</span>
                <textarea
                  className="field"
                  rows={2}
                  placeholder="we were back at the same pew where we first really talked — I forgot every word I'd practiced"
                  value={state.loveStory.proposal}
                  onChange={(e) => setLoveText('proposal', e.target.value)}
                />
              </div>
              <div className="walbl">Who asked?</div>
              <div className="whoasked">
                {[
                  { voice: 'me', label: 'I asked' },
                  { voice: 'them', label: 'They asked' },
                  { voice: 'both', label: 'We both knew' },
                ].map((c) => (
                  <span key={c.voice} className={`wa${sel(state.loveStory.proposal_voice === c.voice)}`} onClick={() => pickProposalVoice(c.voice)}>{c.label}</span>
                ))}
              </div>
              <div className="stem tight" style={{ marginTop: 12 }}>
                <span className="stem-pre">{feelPrompt}</span>
                <textarea
                  className="field"
                  rows={2}
                  placeholder="zero idea it was coming — annoyed they were walking so slow"
                  value={state.loveStory.proposal_feel}
                  onChange={(e) => setLoveText('proposal_feel', e.target.value)}
                />
              </div>
              <div className="tinyyear">
                <label>+ when?</label>
                <input inputMode="numeric" maxLength={4} placeholder="2024" value={state.loveStory.proposal_year} onChange={(e) => setLoveYear('proposal_year', e.target.value)} />
              </div>
            </div>
          </section>

          {/* S3 · THE LITTLE THINGS (love_milestones) — 2×2 anchor tiles + auto-sorted timeline. */}
          <section className={`screen${activeId === 'love_milestones' ? ' active' : ''}`} id="screen-love-milestones">
            <div className="viewzone">
              <div className="eyebrow">Your love story · 4 of 4 · the little things</div>
              <h1 className="q">The stuff only you two would know.</h1>
              <p className="sub" style={{ marginBottom: 12 }}>Tap what{'’'}s yours. Skip the rest.</p>
              <div className="lovetiles">
                {([
                  { k: 'song' as const, ic: '🎵', lbl: 'Our song', ph: 'the song that was always playing' },
                  { k: 'place' as const, ic: '📍', lbl: 'Our place', ph: 'the milk-tea place on Maginhawa' },
                  { k: 'injoke' as const, ic: '😂', lbl: 'What we call each other', ph: 'he calls me Gwapa, sarcastically' },
                  { k: 'food' as const, ic: '🍜', lbl: 'Our food', ph: 'strawberry taho, lagi' },
                ]).map((t) => {
                  const v = state.loveStory.anchors[t.k];
                  const isOpen = openAnchor === t.k;
                  return (
                    <div
                      key={t.k}
                      className={`lovetile${v.trim() ? ' filled' : ''}${isOpen ? ' open' : ''}`}
                      onClick={() => { if (!isOpen) setOpenAnchor(t.k); }}
                    >
                      {isOpen ? (
                        <>
                          <div className="lt-lbl" style={{ marginBottom: 6 }}>{t.ic} {t.lbl}</div>
                          <input
                            className="lt-in"
                            autoFocus
                            value={v}
                            placeholder={t.ph}
                            onChange={(e) => setAnchor(t.k, e.target.value)}
                            onBlur={() => setOpenAnchor(null)}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          />
                        </>
                      ) : (
                        <>
                          <div className="lt-ic">{t.ic}</div>
                          <div className="lt-lbl">{t.lbl}</div>
                          <div className="lt-val">{v}</div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="lovetl">
                {loveTLRows.map((r, i) => (
                  <div
                    key={i}
                    className="tl"
                    {...(r.seed ? {} : { onClick: () => openMomentForm(r.idx), style: { cursor: 'pointer' } })}
                  >
                    <span className="d" />
                    <div>
                      <div className="yr">{fmtMomentYear(r)}</div>
                      <div className="mm">{r.title || 'A moment'}</div>
                    </div>
                  </div>
                ))}
              </div>
              {!momentOpen && (
                <button type="button" className="loveaddmom" onClick={() => openMomentForm()}>＋ a moment that mattered</button>
              )}
              {momentOpen && (
                <div className="momentform">
                  <div className="mf-lbl">{momentEditIdx != null ? 'Edit this moment' : 'Add a moment'}</div>
                  <div className="mf-chips">
                    {MOMENT_CHIPS.map((c) => (
                      <span key={c} className="mf-chip" onClick={() => setMfTitle(c)}>{c}</span>
                    ))}
                  </div>
                  <input className="field mf-title" placeholder="Our first trip together…" maxLength={48} autoComplete="off" value={mfTitle} onChange={(e) => setMfTitle(e.target.value)} />
                  <div className="mf-when">
                    <input className="field mf-num" inputMode="numeric" placeholder="Year" maxLength={4} autoComplete="off" value={mfYear} onChange={(e) => setMfYear(e.target.value)} />
                    <input className="field mf-num mf-mini" inputMode="numeric" placeholder="Mo" maxLength={2} autoComplete="off" value={mfMonth} onChange={(e) => setMfMonth(e.target.value)} />
                    <input className="field mf-num mf-mini" inputMode="numeric" placeholder="Day" maxLength={2} autoComplete="off" value={mfDay} onChange={(e) => setMfDay(e.target.value)} />
                    <span className="mf-opt">month &amp; day optional</span>
                  </div>
                  <div className="mf-actions">
                    <button type="button" className="mf-add" onClick={submitMoment}>{momentEditIdx != null ? 'Save ♥' : 'Add to our story ♥'}</button>
                    {momentEditIdx != null && <button type="button" className="mf-remove" onClick={removeMoment}>Remove</button>}
                    <button type="button" className="mf-cancel" onClick={closeMomentForm}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* S4 · THE VOICE (love_tone) — 3 tone chips + a LIVE one-line preview. */}
          <section className={`screen${activeId === 'love_tone' ? ' active' : ''}`} id="screen-love-tone">
            <div className="viewzone">
              <div className="eyebrow">Your love story · the voice</div>
              <h1 className="q">How should it sound?</h1>
              <p className="sub" style={{ marginBottom: 14 }}>Same story, your voice — change it anytime.</p>
              <div className="sitecard" style={{ marginBottom: 14 }}>
                <div className="sc-inner" style={{ padding: '18px 18px' }}>
                  <div className="sc-pull" style={{ fontSize: 20, margin: 0 }} dangerouslySetInnerHTML={{ __html: tonePreviewHtml }} />
                </div>
              </div>
              <div className="chips">
                {([
                  { tone: 'warm' as const, label: 'Warm' },
                  { tone: 'playful' as const, label: 'Playful' },
                  { tone: 'formal' as const, label: 'Formal' },
                ]).map((c) => (
                  <div key={c.tone} className={`chip${sel(loveTone === c.tone)}`} onClick={() => pickTone(c.tone)}>{c.label}</div>
                ))}
              </div>
              <div className="lovebadge">● Appears as &quot;Our Love Story&quot;</div>
            </div>
          </section>

          {/* S5 · THE REVEAL (love_preview) — the told-back published page; twin-ghost CTA. */}
          <section className={`screen${activeId === 'love_preview' ? ' active' : ''}`} id="screen-love-preview">
            <div className="viewzone">
              <div className="eyebrow">Your love story · the reveal</div>
              <h1 className="q">Here{'’'}s the two of you.</h1>
              <p className="sub" style={{ marginBottom: 14 }}>This is how it{'’'}ll read on your wedding page.</p>
              <div className="sitecard">
                <div className="sc-inner">
                  <div className="sc-masthead" dangerouslySetInnerHTML={{ __html: lovePreviewMasthead }} />
                  <div className="sc-pull" dangerouslySetInnerHTML={{ __html: lovePreviewPull }} />
                  <div className="sc-prose" dangerouslySetInnerHTML={{ __html: lovePreviewProse }} />
                  <div className="sc-tl" dangerouslySetInnerHTML={{ __html: lovePreviewTimeline }} />
                </div>
              </div>
              <div className="livecap"><span className="pulse" />Updates live as you tell it</div>
            </div>
            <div className="tapzone">
              <button type="button" className="btn btn-primary" style={{ width: '100%', marginBottom: 6 }} onClick={() => go(1)}>This is us</button>
              <div className="ghost" onClick={() => goToId('love_spark')}><u>Change a line</u></div>
            </div>
          </section>

          {/* 6 DATE — 2-mode calendar + why-this-date nugget (DateCalendar owns its viewzone title + nugget) */}
          <section className={`screen${activeId === 'date' ? ' active' : ''}`}>
            <DateCalendar
              mode={state.dateMode}
              candidates={state.dateCandidates}
              windowStart={state.windowStart}
              windowEnd={state.windowEnd}
              onChange={patch}
            />
          </section>

          {/* ALAALA PROMISE — a brand moment after the love story, before the
              practical questions: name the pillar + state the guardrail. The
              chrome Continue advances (canContinue defaults true). */}
          <section className={`screen${activeId === 'alaala_promise' ? ' active' : ''}`} id="screen-alaala-promise">
            <div className="viewzone">
              <div className="eyebrow">Our promise</div>
              <h1 className="q">Your day, kept alive.</h1>
              <p className="sub">
                Everything you just shared {'—'} and everything that happens on the day {'—'} we keep
                as your <em>Alaala</em>: the moments you{'’'}ll be too busy to see, the people who
                can{'’'}t be there, the stories your guests tell. A living memory, not a frozen album.
              </p>
              <p className="sub" style={{ opacity: 0.72, marginTop: 8 }}>
                And we stay out of the way. The day is yours to live {'—'} we just quietly remember it.
              </p>
            </div>
          </section>

          {/* 7 REGION — top-5 + Somewhere-else expand + 13 more + nugget */}
          <section className={`screen${activeId === 'region' ? ' active' : ''}`} id="screen-region">
            <LocationStep
              value={state.places}
              onChange={(places) =>
                patch({ places, region: places[0] ? resolvePick(places[0]).rk : null })
              }
            />
          </section>

          {/* 8 PAX — slider + exact box + tier photo */}
          <section className={`screen${activeId === 'pax' ? ' active' : ''}`} id="screen-pax">
            <div className="viewzone">
              <div className="eyebrow">The day</div>
              <h1 className="q">How many guests?</h1>
              <p className="sub">Your starting headcount, shared with vendors — be as specific as you can for the best matches.</p>
              <figure className="paxphoto" data-tier={state.pax == null ? 'none' : paxTier.t}>
                <HeroImg src={state.pax == null ? '' : ASSET(`pax/${paxTier.t}`)} />
                <figcaption className="paxcap">
                  {state.pax == null ? (
                    <span className="paxcapline">Drag or type your headcount to preview the day.</span>
                  ) : (
                    <>
                      <span className="paxcaptag">{paxTier.tag}</span>
                      <span className="paxcapline">{paxTier.line}</span>
                    </>
                  )}
                </figcaption>
              </figure>
            </div>
            <div className="tapzone">
              {/* Number box on top, slider beneath it (owner 2026-06-05). */}
              <div className="numbox">
                <input
                  type="text"
                  inputMode="numeric"
                  className="numbox-input"
                  placeholder="Number of guests"
                  value={state.pax == null ? '' : state.pax.toLocaleString('en-US')}
                  onChange={(e) => {
                    const d = e.target.value.replace(/[^\d]/g, '');
                    patch({ pax: d === '' ? null : parseInt(d, 10) });
                  }}
                />
                {state.pax != null && (
                  <span className="numbox-suffix">{state.pax === 1 ? 'guest' : 'guests'}</span>
                )}
              </div>
              <input
                type="range"
                min={10}
                max={500}
                value={state.pax == null ? 10 : Math.min(500, Math.max(10, state.pax))}
                className="paxslider"
                aria-label="Guest count slider"
                style={{ background: `linear-gradient(to right,var(--gold) 0%,var(--gold) ${state.pax == null ? 0 : paxFill}%,#e7dfce ${state.pax == null ? 0 : paxFill}%,#e7dfce 100%)` }}
                onChange={(e) => patch({ pax: parseInt(e.target.value, 10) })}
              />
              <div className="paxends"><span>10{'−'}</span><span>500+</span></div>
            </div>
          </section>

          {/* 9 BUDGET — feel-band chips + a look photo keyed to pax-tier × band */}
          <section className={`screen${activeId === 'budget' ? ' active' : ''}`} id="screen-budget">
            <div className="viewzone">
              <div className="eyebrow">The day</div>
              <h1 className="q">Your working budget?</h1>
              <p className="sub">Set your number — we{'’'}ll show the feel it buys for ~{pax} guests.</p>
              <figure className="budgetphoto budgetphoto--compact" data-band={budgetSet ? budgetView.dataBand : 'none'}>
                <HeroImg src={budgetSet ? ASSET(budgetView.img) : ''} />
                <figcaption className="budgetcap">
                  {budgetSet ? (
                    <>
                      <span className="budgetcaptag">{budgetView.label} budget · {pax} pax</span>
                      <span className="budgetcapsub">{budgetView.tag}</span>
                      <span className="budgetcaprange">{budgetView.rangeText}</span>
                    </>
                  ) : (
                    <span className="budgetcapsub">Set your number to preview the feel it buys.</span>
                  )}
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
                  {/* Slider under the number box (owner 2026-06-05): precise amount box on top,
                      line picker (slider + its min/max labels) below — matches the guest-count
                      screen's numbox→slider→ends order. (Reverses the 2026-06-02 slider-on-top swap.) */}
                  <div className="bdg-row">
                    <div className="numbox numbox--peso">
                      <span className="numbox-prefix">₱</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="numbox-input bdg-amtinput"
                        aria-label="Working budget in pesos"
                        placeholder="Your budget"
                        value={budgetFocused ? groupDigits(budgetInput) : budgetSet ? budgetSliderVal.toLocaleString('en-US') : ''}
                        onFocus={() => {
                          setBudgetFocused(true);
                          setBudgetInput(budgetSet ? String(budgetSliderVal) : '');
                        }}
                        onChange={(e) => setBudgetInput(e.target.value.replace(/[^\d]/g, ''))}
                        onBlur={commitBudgetInput}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                      />
                    </div>
                    <button type="button" className="bdg-nolimit" onClick={() => applyBudget('nolimit', null)}>
                      No limit
                    </button>
                  </div>
                  <input
                    type="range"
                    min={budgetFloorV}
                    max={budgetCeilingV}
                    step={10000}
                    value={budgetSet ? budgetSliderVal : budgetFloorV}
                    className="paxslider"
                    aria-label="Working budget slider"
                    style={{
                      background: `linear-gradient(to right,var(--gold) 0%,var(--gold) ${budgetSet ? budgetFill : 0}%,#e7dfce ${budgetSet ? budgetFill : 0}%,#e7dfce 100%)`,
                    }}
                    onChange={(e) => onBudgetAmount(Number(e.target.value))}
                  />
                  <div className="paxends">
                    <span>{fmtPeso(budgetFloorV)} min</span>
                    <span>{fmtPeso(budgetCeilingV)}+</span>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* ════════════════ "YOUR DREAM TEAM" CHAPTER (4 chrome screens) ════════════════
              team_intro (education) · reception_setting (photo-cards → prefs.reception) ·
              [find moves into the chapter here, after reception_setting] · team_payoff
              (factual stats) · aigate (the AI offer · two in-screen CTAs). PR-2 = chrome
              only; the picks split + refine engine are PR-3 / PR-4. COVERT: openly
              service/vendor-shaped copy — no song / editorial / pricing leak. ════════ */}

          {/* TEAM_INTRO — education: the reception is home base (prototype s1edu). */}
          <section className={`screen${activeId === 'team_intro' ? ' active' : ''}`} id="screen-team-intro">
            <div className="viewzone">
              <div className="loveglyph">{'⛬'}</div>
              <div className="eyebrow">Your venue</div>
              <h1 className="q">Let{'’'}s start with your reception.</h1>
              <p className="sub">Your reception venue is home base. Once we know <i>where</i> you{'’'}re celebrating, we match every other vendor by who can actually get there.</p>
              <div className="note mul"><span>✦</span><div>Lock your venue and it becomes your <b>home base</b>. We sort every caterer, photographer &amp; stylist by <b>who can get there</b> — far ones flagged <b>{'“'}travel fee may apply.{'”'}</b></div></div>
            </div>
            <div className="tapzone" />
          </section>

          {/* RECEPTION_SETTING — now the FIRST taxonomy refinement, rendered with the UNIFORM
              RefineStep template (4:3 hero + 4:3 option carousel · owner 2026-06-09), DB-sourced
              from the `reception` leaf (getOnboardingRefinements → refinementsByKey, static fallback).
              Option keys stay `setting_*` and write straight to prefs.reception (NOT state.refinements)
              so the `find` venue match + the recap keep working unchanged. Standalone (early, pre-aigate,
              always shown) → hideProgress + custom copy. */}
          <section className={`screen${activeId === 'reception_setting' ? ' active' : ''}`} id="screen-reception-setting">
            {activeId === 'reception_setting' && (() => {
              const receptionLeaf = refinementsByKey['reception'] ?? REFINEMENTS_BY_KEY['reception'];
              return receptionLeaf ? (
                <RefineStep
                  leafData={receptionLeaf}
                  faith={state.faith}
                  chosen={state.prefs.reception}
                  onToggle={(_leaf, key) =>
                    patchPrefs({
                      reception: state.prefs.reception.includes(key)
                        ? state.prefs.reception.filter((x) => x !== key)
                        : [...state.prefs.reception, key],
                    })
                  }
                  hideProgress
                  eyebrow="Reception"
                  title="What setting do you love?"
                  subtitle="Pick one or two — we’ll lead with venues that match."
                />
              ) : null;
            })()}
          </section>

          {/* TEAM_BASICS — pax-style: a maximized hero photo of the focused essential (top)
              + the 4 BASIC_CATS as a multi-select carousel (bottom · prototype s2pick).
              BRIDGE: cards call the EXISTING pickChip(cat) → state.picks stays ONE flat
              array; basicFocus only drives the hero swap (local UI). */}
          <section className={`screen${activeId === 'team_basics' ? ' active' : ''}`} id="screen-team-basics">
            <div className="viewzone">
              <div className="eyebrow">Your essentials</div>
              <h1 className="q">Your basic services.</h1>
              <p className="sub">The must-haves. Tap the ones you still need {'—'} we{'’'}ll match each.</p>
              <figure className="styhero" style={{ backgroundImage: `url(${PICKER_ASSET(basicFocus)})` }}>
                <figcaption className="styhcap">
                  <span className="bft">{PICK_LABEL[basicFocus] ?? basicFocus}</span>
                  <span className="bfd">{PICK_INFO[basicFocus]?.d ?? ''}</span>
                </figcaption>
              </figure>
            </div>
            <div className="tapzone">
              <Rail className="pgrid car">
                {BASIC_CATS.map((cat) => (
                  <PickCard
                    key={cat}
                    cat={cat}
                    label={PICK_LABEL[cat] ?? cat}
                    desc={PICK_INFO[cat]?.d}
                    selected={state.picks.includes(cat)}
                    onClick={() => { pickChip(cat); setBasicFocus(cat); }}
                  />
                ))}
              </Rail>
            </div>
          </section>

          {/* REFINE_BASIC (PR-4) — the FIRST refine pass: "What kind of X?" for each picked
              BASIC leaf that has a REFINEMENTS entry, in canonical BASIC order. The go()
              re-entry loop walks refineIdx through refineBasicQueue; RefineStep renders the
              active leaf with the UNIFORM template. An empty queue is skipped by go(). */}
          <section className={`screen${activeId === 'refine_basic' ? ' active' : ''}`} id="screen-refine-basic">
            {activeId === 'refine_basic' && activeRefineLeaf && activeRefineLeafData && (
              <RefineStep
                scope="basic"
                queue={activeRefineQueue}
                idx={refinePosClamped}
                leafData={activeRefineLeafData}
                faith={state.faith}
                chosen={state.refinements[activeRefineLeaf] ?? []}
                onToggle={patchRefine}
              />
            )}
          </section>

          {/* TEAM_EXTRAS — expandable parent → tiles browser of the FULL taxonomy MINUS the
              4 basics AND minus `reception` (captured on reception_setting · prototype s3pick).
              Single-open accordion; each open parent reveals a Rail.car of PickCards. BRIDGE:
              tiles call the EXISTING pickChip(cat) → flat state.picks; extrasOpen is local UI.
              An empty parent (e.g. Venue after ceremony+reception are excluded) is hidden. */}
          <section className={`screen${activeId === 'team_extras' ? ' active' : ''}`} id="screen-team-extras">
            <div className="viewzone">
              <div className="eyebrow">The extras</div>
              <h1 className="q">The extras you love.</h1>
              <p className="sub">Everything that turns a wedding into <i>your</i> wedding. Tap a category to browse {'—'} pick any.</p>
            </div>
            <div className="tapzone">
              <div className="exscroll">
                {(() => {
                  const hiddenSet = new Set(hiddenCats);
                  const extrasGroups = PICK_GROUPS
                    .map((g) => ({ label: g.label, leaves: g.rows.flat().filter((c) => c.cat !== 'reception' && !BASIC_SET.has(c.cat) && !hiddenSet.has(c.cat)) }))
                    .filter((g) => g.leaves.length > 0);
                  // default-open the first group with a selection, else the first group
                  const openIdx = extrasOpen !== null
                    ? extrasOpen
                    : Math.max(0, extrasGroups.findIndex((g) => g.leaves.some((c) => state.picks.includes(c.cat))));
                  return extrasGroups.map((g, gi) => {
                    const open = gi === openIdx;
                    const sel = g.leaves.filter((c) => state.picks.includes(c.cat)).length;
                    return (
                      <div className={`exgroup${open ? ' open' : ''}`} key={g.label}>
                        <button type="button" className="exhead" onClick={() => setExtrasOpen(open ? -1 : gi)}>
                          <span className="exname">{g.label}</span>
                          <span className="exmeta">
                            {sel > 0
                              ? <span className="excount">{sel} selected</span>
                              : <span className="extiles">{g.leaves.length}</span>}
                            <span className="exchev">{'›'}</span>
                          </span>
                        </button>
                        <div className="exbody">
                          {open && (
                            <Rail className="pgrid car">
                              {g.leaves.map((c) => (
                                <PickCard key={c.cat} cat={c.cat} label={c.label} desc={PICK_INFO[c.cat]?.d} selected={state.picks.includes(c.cat)} onClick={() => pickChip(c.cat)} />
                              ))}
                            </Rail>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </section>

          {/* REFINE_EXTRAS (PR-4) — the SECOND refine pass: "What kind of X?" for each picked
              EXTRA leaf that has a REFINEMENTS entry, in flat-taxonomy order. Same UNIFORM
              RefineStep template as refine_basic — only the eyebrow + the queue differ. An
              extras-pick with no REFINEMENTS entry (host_mc, lights_sound, …) drops out; an
              empty queue is skipped by the go() re-entry loop. */}
          <section className={`screen${activeId === 'refine_extras' ? ' active' : ''}`} id="screen-refine-extras">
            {activeId === 'refine_extras' && activeRefineLeaf && activeRefineLeafData && (
              <RefineStep
                scope="extras"
                queue={activeRefineQueue}
                idx={refinePosClamped}
                leafData={activeRefineLeafData}
                faith={state.faith}
                chosen={state.refinements[activeRefineLeaf] ?? []}
                onToggle={patchRefine}
              />
            )}
          </section>

          {/* SONGS — the music dimension, lifted out of the retired StyleSubStepper into a
              standalone AI-gated screen. SongBankStep is unchanged; picks stay "Title|Artist"
              labels in prefs.music → buildCommitPayload.musicPlaylistSeed (syncEventSongPicks). */}
          <section className={`screen${activeId === 'songs' ? ' active' : ''}`} id="screen-songs">
            <div className="viewzone">
              <div className="eyebrow">Music</div>
              <h1 className="q">Your songs</h1>
              <p className="sub">Browse the top 100, search for any song, or check your playlist. Pick at least 10 {'—'} we{'’'}ll build the rest.</p>
            </div>
            <div className="tapzone">
              <SongBankStep
                picked={state.prefs.music}
                onToggle={(lbl) =>
                  patchPrefs({
                    music: state.prefs.music.includes(lbl)
                      ? state.prefs.music.filter((x) => x !== lbl)
                      : [...state.prefs.music, lbl],
                  })
                }
              />
            </div>
          </section>

          {/* MOOD — now the Stylist / Decorator refinement (owner 2026-06-09), DB-sourced from the
              `stylist` leaf (taxonomy-driven options · getOnboardingRefinements, static fallback),
              SINGLE-select. The colour-palette reveal is KEPT: each style maps to a FEELS palette via
              STYLE_TO_FEEL, so prefs.feel still seeds buildCommitPayload.moodFeelKey + basicMoodboard.
              Gated to couples who picked Stylist (buildSequence) + dropped from the refine_extras
              queue (EXTRAS_ORDER) so it's never asked twice. */}
          {(() => {
            const stylistLeaf = refinementsByKey['stylist'] ?? REFINEMENTS_BY_KEY['stylist'];
            const styleOpts = stylistLeaf?.options ?? [];
            const selectedStyle = state.refinements.stylist?.[0] ?? null;
            const feel = state.prefs.feel ?? 'timeless';
            const cols = FEELS[feel];
            return (
              <section className={`screen${activeId === 'mood' ? ' active' : ''}`} id="screen-mood">
                <div className="viewzone">
                  <div className="eyebrow">Your overall feel</div>
                  <h1 className="q">Set the mood</h1>
                  <p className="sub">Pick the look you love {'—'} see it in its colors. It guides your stylist, florist, cake &amp; gown.</p>
                  {FEELS[feel] ? (
                    <figure className="feelphoto">
                      <HeroImg src={PREFS_ASSET(`feel_${feel}_${budgetTier}`)} />
                      <figcaption className="feelcap">
                        <span>{`${selectedStyle ?? FEELLBL[feel] ?? ''} · ${budgetLabel}`}</span>
                      </figcaption>
                    </figure>
                  ) : null}
                </div>
                <div className="tapzone">
                  <div className="feelsw">
                    {cols ? cols.map((c, j) => <span key={j} className="fsw" style={{ background: c }} />) : <div className="feelnote">We{'’'}ll build your palette together in the mood board.</div>}
                  </div>
                  <div className="pgrid strip" data-feel>
                    {styleOpts.map((o) => {
                      const cf = STYLE_TO_FEEL[o.key];
                      return (
                        <PCard
                          key={o.key}
                          emoji={o.emoji || '🎨'}
                          label={o.label}
                          photoKey={cf && FEELS[cf] ? `feel_${cf}_${budgetTier}` : undefined}
                          selected={selectedStyle === o.key}
                          onClick={() => pickStyle(o.key)}
                        />
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })()}

          {/* 11 ACCOUNT — the auth gate for anonymous marketing visitors. Signed-in
              customers (dashboard "Add event → Wedding") skip this screen (see go()).
              Reuses the site's existing OAuth + signup server actions; `next`
              round-trips back to /onboarding/wedding?resume=1 so the shell restores
              the localStorage draft + advances to find-vendor. The DB commit fires
              later at the final button (handleFinish), always with an authed user. */}
          <section className={`screen${activeId === 'account' ? ' active' : ''}`} id="screen-account">
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
          <section className={`screen${activeId === 'find' ? ' active' : ''}`} id="screen-find">
            <div className="eyebrow">Find your first vendor</div>
            <h1 className="q" style={{ fontSize: 30 }}>{findHeading}</h1>
            <p className="sub">Sorted for you: your style first, then everyone who can host you. <b>Tap one to shortlist.</b></p>
            {venuesLoading && (
              <div className="vskel-wrap" aria-live="polite" aria-busy="true">
                <div className="grouplbl">★ Finding the best venues for you…</div>
                {[0, 1, 2].map((i) => (
                  <div className="vcard vskel" key={i}>
                    <div className="vimg vskel-box" />
                    <div className="vbody">
                      <div className="vskel-line vskel-box" style={{ width: '64%' }} />
                      <div className="vskel-line sm vskel-box" style={{ width: '46%' }} />
                      <div className="vskel-line sm vskel-box" style={{ width: '30%' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!venuesLoading && venues && venues.length > 0 && (() => {
              // Serviceability rings (owner-locked 2026-06-05): natives serve the
              // couple's area (rings 1-2); travels still pass every other leaf dim
              // but sit outside the region — shown behind "Expand search".
              const natives = venues.filter((v) => v.tier === 'native');
              const travels = venues.filter((v) => v.tier === 'travel');
              const card = (v: OnboardingVenueResult, isTravel: boolean) => {
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
                        {isTravel && <span className="softflag">Outside your area</span>}
                      </div>
                      <div className="eyeing">
                        {picked ? <span className="shortpill">✓ Shortlisted</span> : <span className="shorthint">Tap to shortlist</span>}
                      </div>
                    </div>
                  </div>
                );
              };
              return (
                <>
                  {natives.length > 0 && <div className="grouplbl">★ Matches your preference</div>}
                  {natives.map((v) => card(v, false))}
                  {travels.length > 0 && natives.length > 0 && !showFarther && (
                    <button className="expand" type="button" onClick={() => setShowFarther(true)}>
                      Expand search — see {travels.length} farther {travels.length === 1 ? 'venue' : 'venues'} ↓
                    </button>
                  )}
                  {travels.length > 0 && (natives.length === 0 || showFarther) && (
                    <>
                      <div className="grouplbl muted">
                        {natives.length === 0 ? 'Venues near your region' : 'Farther afield — outside your area'}
                      </div>
                      {travels.map((v) => card(v, true))}
                    </>
                  )}
                  <div className="removednote">🚫 <span>Venues that can’t fit your guest count, aren’t free on your date, or don’t match your ceremony aren’t shown — change those details to see more.</span></div>
                  <div className="note mul"><span>✦</span><div>Your venue is your <b>home base</b>. Every other vendor — caterer, florist, photographer — is then sorted by <b>who can reach it</b>; ones outside their service area still appear, flagged <b>“travel fee may apply.”</b></div></div>
                </>
              );
            })()}
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

          {/* TEAM_PAYOFF — factual stats celebration, NO login (owner stripped it 2026-06-07).
              matched/shortlisted derive from the real find search; hours saved is a transparent
              estimate. (prototype s1payoff) */}
          <section className={`screen${activeId === 'team_payoff' ? ' active' : ''}`} id="screen-team-payoff">
            <div className="viewzone">
              <div className="eyebrow">The payoff</div>
              <h1 className="q" style={{ fontSize: 30 }}>Look how far you are.</h1>
              <p className="sub" style={{ marginBottom: 10 }}>Out of <b>{teamVenuePool}</b> reception venues, we found you <b>{teamMatched}</b> to start.</p>
              <div className="statstrip">
                <div className="stat"><b>{teamMatched}</b><span>venues<br />matched</span></div>
                <div className="stat"><b>~{teamHoursSaved}</b><span>hours<br />saved</span></div>
                <div className="stat"><b>{teamShortlisted}</b><span>on your<br />shortlist</span></div>
              </div>
            </div>
            <div className="tapzone">
              <div className="note mul" style={{ marginTop: 0, marginBottom: 0 }}><span>✦</span><div>This is just your reception. Next, <b>Setnayan AI</b> can match every other vendor the same way.</div></div>
            </div>
          </section>

          {/* AIGATE — the AI offer · TWO in-screen CTAs (Yes / No thanks) · chrome Continue
              hidden via AIGATE_NOCTA. COVERT: only ₱0 / no-obligation framing — no pricing,
              editorial or song copy. (prototype aigate) */}
          <section className={`screen${activeId === 'aigate' ? ' active' : ''}`} id="screen-aigate">
            <div className="viewzone">
              <div className="eyebrow">Setnayan AI <span className="tag new">New</span></div>
              <h1 className="q">You did the venue. Let us do the rest.</h1>
              <div className="note mul" style={{ marginTop: 2, marginBottom: 14 }}>
                <span>✦</span>
                <div>You just matched <b>{teamMatched}</b> {teamMatched === 1 ? 'venue' : 'venues'} in a few taps — and saved about <b>~{teamHoursSaved} hours</b> already. Let Setnayan do that for every other vendor too.</div>
              </div>
              <p className="sub" style={{ marginBottom: 13 }}>Finding one venue took a few taps. You still need a caterer, photographer, coordinator and more — <b>we match every one</b> the same way.</p>
              <div className="aibenefits">
                <div className="aibene"><div className="ic">✓</div><div className="tx"><b>Verified vendors, matched to you</b><span>Region · date · guest count · budget · venue · style — checked all at once, every vendor confirmed real.</span></div></div>
                <div className="aibene"><div className="ic">⚡</div><div className="tx"><b>Tuned to your taste</b><span>One quick {'“'}what kind?{'”'} per service narrows it to exactly your style.</span></div></div>
                <div className="aibene"><div className="ic">💬</div><div className="tx"><b>Free to browse — no obligation</b><span>Shortlist, compare &amp; message vendors at ₱0. Book only if you love them.</span></div></div>
              </div>
            </div>
            <div className="tapzone">
              <button type="button" className="btn btn-primary" style={{ width: '100%', marginBottom: 10 }} onClick={() => aiAnswer(true)}>Yes — match the rest of my vendors</button>
              <div className="stayfree"><u onClick={() => aiAnswer(false)}>No thanks, I{'’'}ll browse on my own</u></div>
            </div>
          </section>

          {/* 13 THE DASHBOARD BLOOM — congrats reveal: the couple's wedding website, already built.
              Hero masthead (MonoLockup + names + identity headline) → countdown → covert "Our Love
              Story" → the full recap → share footer. The viewzone scrolls internally; chrome's
              Continue still flows to the plan/services screens (nav unchanged). */}
          <section className={`screen${activeId === 'congrats' ? ' active' : ''}`} id="screen-congrats">
            <div className="viewzone">
              <div className="eyebrow">You did the hard part</div>
              <div className="dash-site">
                {/* HERO — the live monogram + initials/names + the identity headline */}
                <div className="dash-sec dash-hero">
                  {monoReady ? (
                    <figure className="dash-mono">
                      <MonoLockup
                        design={monoDesign}
                        bi={monoBi}
                        gi={monoGi}
                        brideName={state.brideFirstName}
                        groomName={state.groomFirstName}
                      />
                    </figure>
                  ) : null}
                  <div className="dash-cnames">{coupleDisplay}</div>
                  <div className="dash-head"><span className="setna">Set na&nbsp;&rsquo;yan.</span> &#10024; This is the {bloomSurnameA}&ndash;{bloomSurnameB} wedding &mdash; and it already exists.</div>
                </div>
                {/* COUNTDOWN — the existing live HH:MM:SS timer, anchored on the nearest picked date */}
                {earliestDateISO ? (
                  <div className="dash-sec dash-count">
                    <WeddingCountdown iso={earliestDateISO} active={activeId === 'congrats'} />
                  </div>
                ) : null}
                {/* OUR LOVE STORY — woven in the couple's chosen voice (COVERT: titled only "Our Love
                    Story"). Omitted gracefully if the love stage was skipped or left empty. */}
                {bloomStoryProse ? (
                  <div className="dash-sec">
                    <div className="dash-eb">Our Love Story</div>
                    <div className="dash-story sc-prose" dangerouslySetInnerHTML={{ __html: bloomStoryProse }} />
                  </div>
                ) : null}
                {/* THE RECAP — "here's your wedding", every captured answer */}
                <div className="dash-sec">
                  <div className="dash-eb">Your Wedding</div>
                  <div className="recap tight">
                    <div className="recapline"><span className="rk">Wedding</span><span className="rv">{coupleDisplay}{isHelper ? <span className="rv-sub"> · you’re helping plan</span> : null}</span></div>
                    {recapType ? <div className="recapline"><span className="rk">Type</span><span className="rv">{recapType}</span></div> : null}
                    <div className="recapline"><span className="rk">Date</span><span className="rv">{recapDate}</span></div>
                    <div className="recapline"><span className="rk">Where</span><span className="rv">{recapLocations ?? recapWhere}</span></div>
                    <div className="recapline"><span className="rk">Guests</span><span className="rv">{recapGuests}</span></div>
                    {recapBudget ? <div className="recapline"><span className="rk">Budget</span><span className="rv">{recapBudget}</span></div> : null}
                    {recapServices ? <div className="recapline col"><span className="rk">Services</span><span className="rv">{recapServices}</span></div> : null}
                    {recapReception ? <div className="recapline"><span className="rk">Reception</span><span className="rv">{recapReception}</span></div> : null}
                    {recapCeremony ? <div className="recapline"><span className="rk">Ceremony</span><span className="rv">{recapCeremony}</span></div> : null}
                    {recapCatering ? <div className="recapline col"><span className="rk">Catering</span><span className="rv">{recapCatering}</span></div> : null}
                    {recapPV ? <div className="recapline col"><span className="rk">Photo &amp; Video</span><span className="rv">{recapPV}</span></div> : null}
                    {recapMood ? <div className="recapline"><span className="rk">Mood board</span><span className="rv">{recapMood}</span></div> : null}
                    {recapSongs ? <div className="recapline"><span className="rk">Song list</span><span className="rv">{recapSongs}</span></div> : null}
                    <div className="recapline"><span className="rk">Shortlisted</span><span className="rv">{shortlistCount} {shortlistCount === 1 ? 'venue' : 'venues'}</span></div>
                  </div>
                </div>
                {/* SHARE footer — covert, website-framed (display-only; the real link lives on the dashboard) */}
                <div className="dash-sec dash-share">
                  <div className="dash-shrow">
                    <span className="dash-shbtn">Show {bloomPartnerName} &#128141;</span>
                    <span className="dash-shbtn">your page <span className="lnk">setnayan.com/{coupleSlug}</span></span>
                  </div>
                  <div className="dash-guests">{state.pax != null ? `${state.pax} guests` : 'Your guests'} will see this page</div>
                </div>
              </div>
            </div>
          </section>

          {/* 14 YOUR PLAN — freebies + the budget-matched bundle */}
          <section className={`screen${activeId === 'plan' ? ' active' : ''}`} id="screen-plan">
            <div className="eyebrow">Your plan</div>
            <h1 className="q" style={{ fontSize: 31, lineHeight: 1.08 }}><span>{coupleDisplay}</span></h1>
            <p className="sub" style={{ marginTop: -3 }}>Your wedding, planned.</p>
            <FreeValueSlider tools={savings.breakdown} money={savings.money} hours={savings.hours} active={activeId === 'plan'} />
            <div className="grouplbl">A little help, if you want it</div>
            <div className="optcard">
              <div className="opt-main">
                <div className="opt-h">Keep guiding me</div>
                <div className="opt-d">Your personalized deadline timeline and what to do next — free.</div>
              </div>
              <button type="button" role="switch" aria-checked={state.guidanceOptIn} aria-label="Keep guiding me, free" className={`opt-sw${state.guidanceOptIn ? ' on' : ''}`} onClick={() => patch({ guidanceOptIn: !state.guidanceOptIn })}><span className="opt-knob" /></button>
            </div>
            {matchAvail === true && (
              <div className="optcard optcard-col">
                <div className="opt-main">
                  <div className="opt-h">Reach my best matches</div>
                  <div className="opt-d">We&apos;ll send your first inquiry to the best-fit vendors we found. You can always do this yourself later.</div>
                </div>
                <div className="opt-step">
                  <span className="opt-step-l">inquiries per category</span>
                  <button type="button" className="opt-step-b" aria-label="Fewer inquiries" onClick={() => patch({ inquiriesPerCategory: Math.max(1, state.inquiriesPerCategory - 1) })}>−</button>
                  <span className="opt-step-v">{state.inquiriesPerCategory}</span>
                  <button type="button" className="opt-step-b" aria-label="More inquiries" onClick={() => patch({ inquiriesPerCategory: Math.min(5, state.inquiriesPerCategory + 1) })}>+</button>
                </div>
              </div>
            )}
          </section>

          {/* 14b THE BUNDLE OFFER — Essentials/Complete (onboarding-only · owner 2026-06-08).
              Lives BEFORE services so "get the bundle" precedes "build your own à la carte".
              Reads pricing.bundles (live price + struck worth + savings from the admin package
              catalog). Selecting a card sets state.selectedBundle → Purchase Now routes to the
              bundle checkout (goToDashboard bundle branch). The chrome "Continue" + the in-screen
              "I'll pick à la carte instead" link both leave selectedBundle null → the unchanged
              à-la-carte services/summary path. COVERT: pricing/offer copy only — not a love screen. */}
          <section className={`screen${activeId === 'bundle' ? ' active' : ''}`} id="screen-bundle">
            {(() => {
              const eB = pricing.bundles.essentials;
              const cB = pricing.bundles.complete;
              // Catalog read failure → both null: render only the escape so the couple is never stranded.
              if (!eB && !cB) {
                return (
                  <>
                    <div className="eyebrow">Make it unforgettable</div>
                    <h1 className="q" style={{ fontSize: 29, lineHeight: 1.06 }}>Two ways to make it unforgettable.</h1>
                    <p className="sub">Pick the bundle that fits your day — or keep planning free.</p>
                    <div className="plan-skip"><u onClick={() => { patch({ selectedBundle: null }); go(1); }}>I&apos;ll pick à la carte instead</u></div>
                  </>
                );
              }
              const card = (k: 'essentials' | 'complete', b: OnboardingBundleVM) => {
                const sel = state.selectedBundle === k;
                const reco = k === 'complete';
                return (
                  <div
                    key={k}
                    className={`bdl-card${sel ? ' sel' : ''}${reco ? ' reco' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={sel}
                    onClick={() => patch({ selectedBundle: k })}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); patch({ selectedBundle: k }); } }}
                  >
                    {reco && <div className="bc-reco"><span className="bcr-star">★</span> Best value</div>}
                    <div className="bc-name">{b.title}</div>
                    <div className="bc-pricerow">
                      {b.worth > b.price && <span className="bc-was">{pesoB(b.worth)}</span>}
                      <span className="bc-now">{pesoB(b.price)}</span>
                    </div>
                    {b.savings > 0 && <div className="bc-save">Save {pesoB(b.savings)} vs buying each on its own</div>}
                    {b.items.length > 0 && (
                      <ul className="bc-items">
                        {b.items.map((it) => (
                          <li key={it}><span className="bci-ck">✓</span>{it}</li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      className="bc-cta"
                      disabled={committing}
                      onClick={(e) => { e.stopPropagation(); patch({ selectedBundle: k }); void handleFinish(true, k); }}
                    >
                      {committing ? 'Setting up…' : `Get ${b.title} · ${pesoB(b.price)}`}
                    </button>
                  </div>
                );
              };
              return (
                <>
                  <div className="eyebrow">Make it unforgettable</div>
                  <h1 className="q" style={{ fontSize: 29, lineHeight: 1.06 }}>Two ways to make it unforgettable.</h1>
                  <p className="sub">Pick the bundle that fits your day — or keep planning free.</p>
                  <div className="bdl-cards">
                    {eB && card('essentials', eB)}
                    {cB && card('complete', cB)}
                  </div>
                  <div className="plan-skip"><u onClick={() => { patch({ selectedBundle: null }); go(1); }}>I&apos;ll pick à la carte instead</u></div>
                </>
              );
            })()}
          </section>

          {/* 15 BOOST & ENHANCE — paid in-app services: focused detail + bottom carousel (owner 2026-06-05) */}
          <section className={`screen${activeId === 'services' ? ' active' : ''}`} id="screen-services">
            <div className="eyebrow">Boost &amp; enhance your wedding</div>
            <h1 className="q" style={{ fontSize: 29, lineHeight: 1.06 }}>Make it unforgettable</h1>
            <p className="sub">Optional add-ons — each one a tool, priced honestly. Add what you love.</p>
            {(() => {
              const fk = focusedService || INAPP_KEYS[0]!;
              const p = pricing.svc[fk] ?? { set: 0, out: 0, label: '', isPax: false, buildStatus: 'not_built' as const };
              const save = Math.max(0, p.out - p.set);
              const added = state.interestedServices.includes(fk);
              return (
                <div className="svc-detail">
                  <div className="svc-poster" style={{ backgroundImage: `url('${BUNDLE_ASSET(fk)}')` }}>
                    <button type="button" className={`svc-heart${added ? ' on' : ''}`} aria-pressed={added} aria-label={added ? 'Saved to your wedding' : 'Save to your wedding'} onClick={() => toggleInterested(fk)}>
                      <svg viewBox="0 0 24 24" width="20" height="20" fill={added ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 21s-7.5-4.6-10-9.3C.6 8.7 2 5.5 5 5.5c1.9 0 3.2 1.1 4 2.3.8-1.2 2.1-2.3 4-2.3 3 0 4.4 3.2 3 6.2C19.5 16.4 12 21 12 21z" /></svg>
                    </button>
                  </div>
                  <div className="svc-dpad">
                    <div className="svc-dnm">{BUNDLE_ITEMS[fk] ?? fk}</div>
                    <div className="svc-ddesc">{BUNDLE_BENEFIT[fk] ?? ''}</div>
                    <div className="svc-dprice"><span className="svc-dset">{p.label || pesoB(p.set)}</span><span className="svc-dwas">{pesoB(p.out)}</span></div>
                    {save > 0 && <div className="svc-dsave">You save {pesoB(save)} vs {INAPP_VS[fk] ?? 'hiring it elsewhere'}</div>}
                    <button type="button" className={`svc-add${added ? ' added' : ''}`} onClick={() => toggleInterested(fk)}>
                      {added ? '♥ Saved to your wedding' : '♡ Save to my wedding'}
                    </button>
                  </div>
                </div>
              );
            })()}
            <div className="svc-car">
              {INAPP_KEYS.map((k) => {
                const pp = pricing.svc[k] ?? { set: 0, out: 0, label: '', isPax: false, buildStatus: 'not_built' as const };
                const on = (focusedService || INAPP_KEYS[0]) === k;
                const added = state.interestedServices.includes(k);
                return (
                  <button type="button" key={k} className={`svc-chip${on ? ' on' : ''}`} onClick={() => setFocusedService(k)}>
                    <div className="svc-chip-p" style={{ backgroundImage: `url('${BUNDLE_ASSET(k)}')` }}>{added && <span className="svc-chip-chk" aria-label="Saved">♥</span>}</div>
                    <div className="svc-chip-i"><div className="svc-chip-n">{BUNDLE_ITEMS[k] ?? k}</div><div className="svc-chip-pr">{pp.label || pesoB(pp.set)}</div></div>
                  </button>
                );
              })}
            </div>
            <div className="svc-carlbl">{state.interestedServices.length > 0 ? `${state.interestedServices.length} added · swipe for more →` : 'Swipe to explore · tap a card to view →'}</div>
          </section>

          {/* 16 SERVICES YOU'RE INTERESTED IN — summary + Purchase Now + continue-free (TERMINAL · owner 2026-06-05) */}
          <section className={`screen${activeId === 'summary' ? ' active' : ''}`} id="screen-services-summary">
            <div className="eyebrow">Your picks</div>
            <h1 className="q" style={{ fontSize: 28, lineHeight: 1.08 }}>Services you&apos;re interested in</h1>
            <p className="sub" style={{ marginBottom: 12 }}>Pay only when you&apos;re ready — no charge yet.</p>
            {/* Grand total — the climactic "what you saved, and how fast" stat (owner 2026-06-05). */}
            <div className="svc-grand">
              <div className="svc-grand-h"><CountUp value={grandMoney} prefix="₱" active={activeId === 'summary'} /> <span className="svc-grand-and">·</span> <CountUp value={savings.hours} suffix=" hrs" active={activeId === 'summary'} /></div>
              <div className="svc-grand-l">saved with Setnayan{elapsedMin ? ` — you did all this in ${elapsedMin} minute${elapsedMin === 1 ? '' : 's'}` : ''}</div>
            </div>
            {state.interestedServices.length === 0 ? (
              <div className="svc-empty">No add-ons selected — and that&apos;s perfectly fine. Your free plan already has everything you need to start.</div>
            ) : (
              <>
                <div className="svc-rows-scroll">
                  {state.interestedServices.map((k) => {
                    const p = pricing.svc[k] ?? { set: 0, out: 0, label: '', isPax: false, buildStatus: 'not_built' as const };
                    const save = Math.max(0, p.out - p.set);
                    return (
                      <div className="svc-row" key={k}>
                        <div className="svc-row-th" style={{ backgroundImage: `url('${BUNDLE_ASSET(k)}')` }} />
                        <div className="svc-row-m"><div className="svc-row-n">{BUNDLE_ITEMS[k] ?? k}{recommendedSet.has(k) ? <span className="svc-rec">Recommended</span> : null}</div>{save > 0 && <div className="svc-row-save">save {pesoB(save)}</div>}</div>
                        <div className="svc-row-p">{p.label || pesoB(p.set)}</div>
                        <button type="button" className="svc-row-x" aria-label={`Remove ${BUNDLE_ITEMS[k] ?? k}`} onClick={() => toggleInterested(k)}>×</button>
                      </div>
                    );
                  })}
                </div>
                {(() => {
                  // Live catalog SELLING prices. For the pax SKU (PAPIC_GUEST) this
                  // aggregate uses the floor `set` (onboarding has no committed pax);
                  // the authoritative charge is recomputed at order time. This is an
                  // onboarding estimate — do NOT "fix" it into a hardcode.
                  const setTotal = state.interestedServices.reduce((s, k) => s + (pricing.svc[k]?.set ?? 0), 0);
                  const promo = Math.round(setTotal * ONBOARDING_PROMO);
                  const due = setTotal - promo;
                  return (
                    <div className="svc-totals">
                      <div className="svc-tot-k">{state.interestedServices.length} {state.interestedServices.length === 1 ? 'service' : 'services'} · total</div>
                      <div className="svc-tot-promo"><span className="svc-tot-was">{pesoB(setTotal)}</span><span className="svc-tot-tag">−20% onboarding promo</span></div>
                      <div className="svc-tot-a">{pesoB(due)}</div>
                    </div>
                  );
                })()}
              </>
            )}
            {state.interestedServices.length > 0 ? (
              <>
                <button type="button" className="svc-buy" onClick={() => void handleFinish(true)} disabled={committing}>{committing ? 'Setting up…' : 'Purchase Now'}</button>
                <button type="button" className="svc-freelink" onClick={() => void handleFinish(false)} disabled={committing}>Will purchase later, <u>continue for FREE</u></button>
              </>
            ) : (
              <button type="button" className="svc-buy" onClick={() => void handleFinish(false)} disabled={committing}>{committing ? 'Setting up…' : 'Go to my dashboard'}</button>
            )}
          </section>
        </div>

        {/* bottom — primary CTA. Screens 14 & 15 advance via go(1). The TERMINAL
            commit moved to step 16 (Services summary), which renders its OWN
            Purchase Now / continue-free buttons → the global button is hidden there
            (like the account gate at 11, hidden for anonymous visitors). */}
        <div className="bottom">
          {commitError && (
            <p style={{ color: 'var(--mulberry)', fontSize: 13, margin: '0 0 8px', textAlign: 'center' }}>
              {commitError}
            </p>
          )}
          {!((activeId === 'account' && !authed) || activeId === 'summary' || LOVE_NOCTA.has(activeId) || AIGATE_NOCTA.has(activeId) || momentsActive) && (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                if (!canContinue || committing) return;
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
