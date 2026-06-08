/**
 * /onboarding/wedding — V2 wedding-onboarding state types.
 *
 * Iteration 0016 V2 · Phase 1 of 5 (CLAUDE.md 2026-06-02 production-port row).
 * Spec: Onboarding_Wedding_Flow_2026-06-01.html (the locked /proto prototype).
 *
 * Architecture: state lives in the client (Onboarding shell + localStorage
 * resume) for screens 1-12 — no DB writes until screen 13 (account-or-skip
 * gate) commits the events row in one shot. This is the locked invest-then-gate
 * model from the prototype + the Blueprint §3.1a sequence.
 *
 * Phase 1 ships screens 1-4 + the shell. Later phases extend OnboardingState
 * with more fields without breaking the shape:
 *   Phase 2 — names · date · region · pax · budget
 *   Phase 3 — picker · style preferences (per-category)
 *   Phase 4 — find-vendor + account-or-skip + Your Plan commit
 */

/** Role on the event — Bride / Groom / Someone helping (parent/planner/entourage). */
export type OnboardingRole = 'bride' | 'groom' | 'helper';

/** Kind of wedding — Religious (faith ceremony) / Civil (judge/registrar) / Mixed (interfaith). */
export type OnboardingKind = 'religious' | 'civil' | 'mixed';

/**
 * Faith / tradition — maps to events.ceremony_type (single value when kind=religious)
 * + events.secondary_ceremony_type (when kind=mixed, up to 2 picks).
 * V1.x active: catholic + civil; INC/Christian/Muslim/Cultural ship as Coming Soon
 * with notify-me signup (per iteration 0043 · wedding_type_launch_status).
 */
export type OnboardingFaith =
  | 'catholic'
  | 'christian'
  | 'inc'
  | 'muslim'
  | 'cultural'
  | 'chinese'
  | 'jewish'
  | 'born_again';

/** Current screen index — 0-based into the SCREEN_SEQUENCE array. */
export type OnboardingStep = number;

/**
 * Full onboarding state — accumulates across screens, persisted to localStorage,
 * committed to events + event_moderators + event_vendor_preferences at screen 13.
 *
 * Every field is nullable / empty-default — Phase 1 only writes role/kind/faith;
 * later phases extend without renaming.
 */
export interface OnboardingState {
  /** Current screen index (0..N). 0 = Welcome. */
  step: OnboardingStep;

  /** The signing user's role on this event (Bride/Groom/Helper). Screen 2. */
  role: OnboardingRole | null;

  /** Kind of wedding (Religious/Civil/Mixed). Screen 3. */
  kind: OnboardingKind | null;

  /**
   * Faith picks — single-element array for kind=religious, up to 2 for kind=mixed,
   * empty for kind=civil. Maps to events.ceremony_type (first element) +
   * events.secondary_ceremony_type (second, when present). Screen 4.
   */
  faith: OnboardingFaith[];

  // -- Phase 2 fields (screens 4-8: name · date · region · pax · budget) --

  /** Bride first name (screen 4) — monogram initial + seeds the guest list (first guest). */
  brideFirstName: string;
  /** Bride last name (screen 4) — joined into events.bride_name + the guest-list row. */
  brideLastName: string;
  /** Groom first name (screen 4) — monogram initial + seeds the guest list (second guest). */
  groomFirstName: string;
  /** Groom last name (screen 4) — joined into events.groom_name + the guest-list row. */
  groomLastName: string;
  /**
   * Monogram design index into MONO_DESIGNS (screen 4 · free styling). Each design
   * is a live-typography lockup {style + font + frame?} (owner 2026-06-04 — the 5
   * lockups bar · script · duo · framed · infinity); "Generate another design" cycles them.
   * Commit derives events.monogram_style + monogram_frame_key + monogram_font_key.
   */
  monogramDesign: number;

  /**
   * Wedding-date capture mode (screen 5). 'specific' = 1-4 candidate dates within
   * a 90-day cluster; 'window' = a flexible range ≤30 days inclusive. The final
   * events.event_date settles later on vendor availability. Maps to events.date_mode.
   */
  dateMode: 'specific' | 'window';
  /** Specific-mode candidate dates, ISO yyyy-mm-dd, sorted asc (≤4). Maps to events.date_candidates. */
  dateCandidates: string[];
  /** Flexible-window start, ISO yyyy-mm-dd (null in specific mode). Maps to events.date_window_start. */
  windowStart: string | null;
  /** Flexible-window end, ISO yyyy-mm-dd (null until the end is picked). Maps to events.date_window_end. */
  windowEnd: string | null;

  /** Region key (screen 6) — area match for vendor coverage. Maps to events.region.
   *  Now DERIVED from the primary pick in `places` (kept for the existing region-scoped
   *  venue/vendor fetches + the screen-13 recap label). */
  region: string | null;

  /**
   * Location picks (screen 6) — up to 2 area keys from the Top-30 location step:
   * a curated city key (e.g. `tagaytay`), or `p:<norm>:<region>` for a long-tail
   * PSGC place. Scopes the reception-venue search; `region` + the committed venue
   * lat/lng are derived from places[0]. Supersedes the single-select region picker.
   */
  places: string[];

  /** Exact guest count (screen 7) — may be <50 or >500. Maps to events.estimated_pax. */
  pax: number | null;

  /**
   * Working-budget feel band (screen 8) — essentials/simple/classic/elevated/premium/
   * luxury/nolimit. Maps to events.budget_band. Couple-side compass, NOT a Setnayan SKU price.
   */
  budgetBand: string | null;

  /**
   * Working-budget AMOUNT in pesos (screen 8) — the editable text-box value + the
   * slider position (owner 2026-06-02: "a text box like how many guests, and a line
   * picker"). null until the couple touches it → the screen derives the band's MAX
   * for the pax as the default ("set to the max of the budget range chosen"). Cannot
   * go below the recommended floor for the guest count. Maps to events.estimated_budget_centavos.
   */
  budgetAmount: number | null;

  // -- Phase 3 fields (screens 9-10: picker · style sub-stepper) --

  /**
   * "What would you love?" picker (screen 9) — the selected service category keys
   * (53 across the 10 taxonomy parents · `data-cat` values). Drives the style
   * sub-stepper queue, the Phase-4 find-vendor demo, and the budget-matched bundle.
   * Seeded by applyBudgetHighlight() (budget-appropriate starter set) until the
   * couple first edits a chip (then pickerTouched latches and we stop overriding).
   * Maps to event_vendor_preferences (the wanted categories).
   */
  picks: string[];

  /**
   * True once the couple edits any picker chip — stops applyBudgetHighlight from
   * re-seeding the budget-appropriate starter set over their picks (prototype
   * window.pickerTouched). Persisted so a resumed draft isn't clobbered on reload.
   */
  pickerTouched: boolean;

  /**
   * Style preferences (screen 10 sub-stepper) — one focused screen per dimension
   * derived from the picks (reception/ceremony/catering/photo_video/music + palette
   * when any aesthetic category is picked). Preferences SORT vendor matches, never
   * exclude. Maps to event_vendor_preferences. Dietary halal/alcohol_free is
   * pre-LOCKED by faith (Muslim → halal, INC → alcohol-free) at render.
   */
  prefs: OnboardingPrefs;

  /**
   * AI-gate answer (Dream Team chapter · additive). `null` = not yet asked;
   * `true` = "match the rest for me" (the picks + refine screens show);
   * `false` = "I'll browse on my own" (skip straight to the plan/offer).
   * Drives buildSequence membership; persisted so a resumed draft restores the
   * fork. Default null is treated as "not yet AI" (fork OFF) until tapped.
   */
  ai: boolean | null;

  /**
   * Per-leaf refinement picks (the "what kind of {service}?" passes · Dream Team
   * chapter · additive). leafKey (a PICK_GROUPS category key — 'ceremony',
   * 'catering', 'photo_video', 'live_band', …) → selected option labels (multi).
   * Folded into events.style_preferences.refinements (JSONB) at commit for
   * DISPLAY + future vendor-match; the bridge ALSO projects the production-known
   * leaves (ceremony/catering/photo_video) back onto `prefs` so the find search +
   * recap keep working unchanged. Empty default = no refinements (commit unchanged).
   */
  refinements: Record<string, string[]>;

  /**
   * Find-vendor shortlist (screen 12) — the REAL reception venues the couple
   * tapped to shortlist (from the criteria-based marketplace search, no longer
   * the prototype's hardcoded demo cards). Powers the recap count on screen 13
   * (owner 2026-06-02: "i shortlisted 3 ... only shows 1"). Persisting the exact
   * ids as event_vendors 'considering' picks at commit is a flagged follow-on
   * (CLAUDE.md WAVE 2); for now it's captured so the recap reflects the truth.
   */
  shortlist: ShortlistVenue[];

  /**
   * BYO vendors (screen 12 "Add your own vendor" bottom-sheet) — off-platform
   * vendors the couple typed in (name + contact person + email). Persisted at
   * commit as event_vendors 'considering' freeform rows (category 'misc',
   * source 'host_manual') so they show on the dashboard Services tab. Kept in
   * OnboardingState (not local UI state) so they survive the draft and reach
   * buildCommitPayload without a stale closure. Accumulates across submissions.
   */
  byoVendors: ByoVendor[];

  /**
   * Your Plan opt-ins (screen 14 · owner 2026-06-05). guidanceOptIn → free deadline-timeline
   * guidance (default ON · ₱0 · NOT the retired paid Setnayan AI). sendTopInquiries → fan out
   * the couple's first inquiry to the top-3 best-fit vendors at commit (default OFF · explicit
   * consent · RA 10173).
   */
  guidanceOptIn: boolean;
  sendTopInquiries: boolean;

  /**
   * Your Plan v2 (screen 14/16 · owner 2026-06-05). inquiriesPerCategory → how many best-fit
   * vendors to inquire per picked category when sendTopInquiries is on (1–5 · default 3).
   * interestedServices → paid in-app service keys the couple selected on screen 15, carried to
   * screen 16's summary + Purchase Now.
   */
  inquiriesPerCategory: number;
  interestedServices: string[];

  /**
   * Onboarding-only bundle choice (Essentials/Complete offer screen · owner 2026-06-08).
   * null = à-la-carte path. Persisted in the draft so a resumed flow restores the pick.
   * Read/written ONLY by the bundle screen + the purchase-routing branch — additive,
   * never touches picks/prefs/interestedServices/buildCommitPayload semantics.
   */
  selectedBundle: 'essentials' | 'complete' | null;

  // -- Love stage fields (the 6 love_* screens · website "Our Love Story" voice) --

  /**
   * True once the couple taps "Add it later" on love_intro — drops the 5 collection
   * love screens (the gate love_intro itself always shows). The whole love stage is
   * optional; a skipped stage leaves the rest of the flow untouched.
   * COVERT: this stage feeds ONLY the couple's wedding-website story.
   */
  loveSkipped: boolean;

  /**
   * The told-back love-story blob — every field the 6 love screens collect, persisted
   * verbatim into events.love_story (JSONB). Names are story-shaped / love-shaped
   * throughout (NEVER editorial/newspaper/song/lyric) so neither the state, the draft,
   * nor the network payload leaks the downstream reuse. Blank-field defaults keep the
   * reveal non-empty.
   */
  loveStory: LoveStory;

  /**
   * Love-story voice (love_tone screen) — drives how the website story reads. Maps to
   * the events.story_tone column (covert rename of editorial_tone). null until picked
   * (the screen defaults the live preview to 'warm' without committing a value).
   */
  storyTone: 'warm' | 'playful' | 'formal' | null;

  /**
   * Love-story generation language (silent-inherit from the account/site locale). Maps
   * to events.story_language (covert rename of editorial_language). Reserved — the love
   * screens don't surface a language picker in V1; it rides the commit for completeness.
   */
  storyLanguage: string | null;

  /** A note the couple leaves for their guests on the wedding page. Maps to events.special_message. */
  specialMessage: string;

  /** When the two of you have been together (free text / year). Maps to events.together_since. */
  togetherSince: string;

  /** Onboarding start (epoch ms) — powers the summary's "you did all this in X minutes" stat
   *  (owner 2026-06-05). Reset on resume after a long idle so it reflects the active sitting. */
  startedAt: number | null;
  /** Latches once the pick-matched recommended in-app services have been pre-added to
   *  interestedServices (screen 15) so removing one isn't re-added (owner 2026-06-05). */
  servicesSeeded: boolean;

  /** ISO timestamp of last save — for debugging stale drafts. */
  lastSavedAt: string;
}

/** A moment on the love-story timeline (love_milestones). Month + day are OPTIONAL. */
export interface LoveMilestone {
  /** 4-digit year (string, as typed). */
  year: string;
  /** 1-2 digit month (optional). */
  month?: string;
  /** 1-2 digit day (optional). */
  day?: string;
  /** Short title — "Our first trip together…". */
  title: string;
}

/**
 * The told-back love-story blob (the 6 love_* screens → events.love_story JSONB).
 * v1 keys: how_we_met/met_year/together_since/proposal/proposal_setting/proposal_year.
 * v2 keys (this redesign): + spark/spark_why/spark_anchor/obstacle/obstacle_kind/
 * obstacle_kept/proposal_voice/proposal_feel/anchors{}/milestones[].
 * COVERT: every key is story-shaped — nothing names editorial/song/lyric.
 */
export interface LoveStory {
  /** Legacy free-text "how we met" (kept for v1 back-compat; the v2 flow leads with spark). */
  how_we_met: string;
  met_year: string;
  together_since: string;
  /** The Spark stem — "the first thing I noticed was…". */
  spark: string;
  /** The causal follow-up — "why did that stick?". */
  spark_why: string;
  /** The sensory starter-chip opener the couple dropped into the Spark box. */
  spark_anchor: string;
  /** The Almost stem — "there was a moment we almost didn't make it because…". */
  obstacle: string;
  /** The Almost cue → enum (distance|family|different_paths|doubt|timing|other). */
  obstacle_kind: string;
  /** The Almost follow-up — "what kept you going?". */
  obstacle_kept: string;
  /** The Yes stem — "I knew the moment…". */
  proposal: string;
  /** The Yes setting chip (beach|surprise|home|trip|meaningful). */
  proposal_setting: string;
  proposal_year: string;
  /** Who asked (me|them|both) — unlocks the two-voice braid. */
  proposal_voice: string;
  /** The other side's felt moment (required) — seeds the braid. */
  proposal_feel: string;
  /** The 2×2 anchor tiles — the little things only the two of them would know. */
  anchors: { song: string; place: string; injoke: string; food: string };
  /** User-added moments, auto-sorted chronologically. */
  milestones: LoveMilestone[];
}

/** An off-platform vendor the couple added via the "Add your own vendor" sheet (screen 12). */
export interface ByoVendor {
  /** Business / vendor name → event_vendors.vendor_name. */
  name: string;
  /** Who the couple talks to → event_vendors.notes. */
  person: string;
  /** Contact email → event_vendors.contact_email. */
  email: string;
}

/** A reception venue shortlisted on the find-vendor screen (screen 12). */
export interface ShortlistVenue {
  /** vendor_profiles.vendor_profile_id of the shortlisted reception venue. */
  vendorId: string;
  /** Display name at shortlist time (venues are name-exempt from anonymization). */
  name: string;
}

/** Per-dimension style picks captured by the screen-10 sub-stepper. */
export interface OnboardingPrefs {
  /** Reception setting keys — multi-pick (ballroom/garden/beach/…). */
  reception: string[];
  /** Ceremony where — single-pick (church/garden/beach/civil/same_reception). */
  ceremony: string | null;
  /** Catering cuisine keys — multi-pick (filipino/asian/…). */
  cuisine: string[];
  /** Catering service style — single (Plated/Buffet/Family-style/Stations). */
  serviceStyle: string | null;
  /** Dietary needs — halal / alcohol_free (faith pre-locks some). */
  dietary: string[];
  /** Photo/video look keys — multi-pick (photojournalistic/classic/…). */
  pvLook: string[];
  /** Photo/video need — single (both/photo/video). */
  pvNeed: string | null;
  /** Photo/video inclusions — multi-pick (pre-nup/wedding-day/sde/drone/std/album). */
  pvIncluded: string[];
  /** Music — the song seed (≥10 "Title|Artist" picks, pick order). */
  music: string[];
  /** Palette feel — single (timeless/modern/boho/rustic/glam/royalty/filipiniana/others). */
  feel: string | null;
}

/**
 * Progress-bar denominator. The bar reflects the FULL eventual 15-screen flow
 * (Blueprint §3.1a) — not just the screens shipped this phase — so it doesn't
 * read "complete" at the Phase-1 boundary. Phase 1 renders 4 of these 15.
 */
export const FLOW_TOTAL = 17;

/** Localstorage key for the in-flight draft. Single namespace per browser. */
export const ONBOARDING_DRAFT_KEY = 'setnayan_onboarding_wedding_draft_v1';

/** localStorage TTL: drafts older than this (in days) are auto-cleared on load. */
export const ONBOARDING_DRAFT_TTL_DAYS = 30;

/**
 * Production-blank seed. The /proto prototype (Onboarding_Wedding_Flow_2026-06-01.html)
 * seeds demo data (Maria/Juan · ncr · 150 · classic · timeless) so reviewers see a
 * populated flow — but the LIVE shell must start EMPTY so a fresh onboarding (and a
 * re-opened one after a couple has already created a wedding) shows blank fields, not a
 * stranger's pre-filled wedding (owner 2026-06-02: "the data on the onboarding still
 * persisted"). Names → '' (no "Maria & Juan"); region/pax/budgetBand/feel → null so the
 * couple actively picks each (canContinue locks each screen until they do; the screens
 * still render via `?? fallback` for slider/photo positions). The draft is also cleared
 * on commit (handleFinish) — these blank defaults are what a cleared/fresh draft restores.
 */
export const EMPTY_ONBOARDING_STATE: OnboardingState = {
  step: 0,
  role: null,
  kind: null,
  faith: [],
  brideFirstName: '',
  brideLastName: '',
  groomFirstName: '',
  groomLastName: '',
  monogramDesign: 0,
  dateMode: 'specific',
  dateCandidates: [],
  windowStart: null,
  windowEnd: null,
  region: null,
  places: [],
  pax: null,
  budgetBand: null,
  budgetAmount: null,
  picks: [],
  pickerTouched: false,
  prefs: {
    reception: [],
    ceremony: null,
    cuisine: [],
    serviceStyle: null,
    dietary: [],
    pvLook: [],
    pvNeed: null,
    pvIncluded: [],
    music: [],
    feel: null,
  },
  ai: null,
  refinements: {},
  shortlist: [],
  byoVendors: [],
  guidanceOptIn: true,
  sendTopInquiries: false,
  inquiriesPerCategory: 3,
  interestedServices: [],
  selectedBundle: null,
  loveSkipped: false,
  loveStory: {
    how_we_met: '',
    met_year: '',
    together_since: '',
    spark: '',
    spark_why: '',
    spark_anchor: '',
    obstacle: '',
    obstacle_kind: '',
    obstacle_kept: '',
    proposal: '',
    proposal_setting: '',
    proposal_year: '',
    proposal_voice: '',
    proposal_feel: '',
    anchors: { song: '', place: '', injoke: '', food: '' },
    milestones: [],
  },
  storyTone: null,
  storyLanguage: null,
  specialMessage: '',
  togetherSince: '',
  startedAt: null,
  servicesSeeded: false,
  lastSavedAt: '',
};

/**
 * Canonical screen sequence. Phase 1 ships screens 0-3 (welcome/role/kind/faith).
 * Later phases extend this list — the shell renders by index, so adding screens
 * in the middle requires a coordinated update of step transitions.
 *
 * Faith (index 3) is SKIPPED when kind=civil — handled in shell goNext() logic.
 */
export const SCREEN_SEQUENCE = [
  'welcome',  // 0
  'role',     // 1
  'kind',     // 2
  'faith',    // 3  (skipped when kind=civil — shell go() logic)
  'name',     // 4
  'date',     // 5
  'region',   // 6
  'pax',      // 7
  'budget',   // 8
  'picker',   // 9   "What would you love?"
  'prefs',    // 10  style sub-stepper (one focused screen per picked dimension)
  'account',  // 11  account-or-skip gate (demo in onboarding; real auth + events-row commit in Phase 5)
  'find',     // 12  find-your-first-vendor demo + BYO-vendor bottom-sheet
  'congrats', // 13  "You did the hard part" — savings counter
  'plan',     // 14  Your Plan — free value + the two asks
  'services', // 15  Boost & enhance — paid in-app services carousel + detail
  'services_summary', // 16  Services you're interested in + Purchase Now
] as const;

export type ScreenId = (typeof SCREEN_SEQUENCE)[number];
