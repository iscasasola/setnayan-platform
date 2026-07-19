/**
 * Iteration 0053 Phase 3 — shared types for the generic (non-wedding) onboarding
 * engine. The wedding flow keeps its own `OnboardingCommitPayload` in
 * `app/onboarding/wedding/actions.ts` (untouched / byte-identical); this is the
 * lean payload the generic `/onboarding/[type]` flow (PR2) commits via
 * `commitOnboardingEvent`.
 */
import type { ExpAxisAnswers, ExpForWhom } from '@/app/onboarding/wedding/_data/experience-personas';

export type GenericOnboardingPayload = {
  /** The non-wedding event-type key (an `event_type_vocab` key, e.g. 'birthday'). NEVER 'wedding'. */
  eventType: string;
  /** The event name the organizer typed (→ `events.display_name`). */
  displayName: string;
  region: string | null;
  /** Reception/venue anchor coords from the primary area pick (→ events.venue_latitude/longitude). */
  venueLatitude: number | null;
  venueLongitude: number | null;
  pax: number | null;
  budgetBand: string | null;
  /** Working-budget amount in centavos (→ events.estimated_budget_centavos). */
  budgetAmountCentavos: number | null;
  dateMode: 'specific' | 'window';
  dateCandidates: string[];
  windowStart: string | null;
  windowEnd: string | null;
  /** Palette feel key (→ events.mood_feel_key). */
  moodFeelKey: string | null;
  /** Experience-quiz intent — written ONLY when the experience-quiz flag is on (flag-guarded). */
  experiencePersona: string | null;
  experienceForWhom: ExpForWhom | null;
  experienceAxes: ExpAxisAnswers;
  /** Derived-plan vendor categories to line up (→ style_preferences.interested_categories). */
  picks: string[];
  /** In-app Setnayan services to pre-surface (→ style_preferences.interested_services). */
  interestedServices: string[];
  /** Per-leaf refinement seeds (→ style_preferences.refinements). */
  refinements: Record<string, string[]>;
  /** Derived palette hexes (→ style_preferences.basic_moodboard). */
  basicMoodboard: string[] | null;
  /** Up-to-2 area picks (→ style_preferences.search_areas). */
  places: string[];
  /** Free deadline-timeline guidance opt-in (default true · → style_preferences.guidance_opt_in). */
  guidanceOptIn: boolean;
  /** "Reach my matches" — held for anon couples, replayed on secure (→ pending_inquiry_dispatch). */
  sendTopInquiries: boolean;
  inquiriesPerCategory: number;
  /** The organizer's role key from the event's role set (e.g. 'host'). Reserved for PR3 host seeding. */
  role: string | null;
  /**
   * Cloudflare Turnstile token minted client-side (via mintTurnstileToken) when
   * global Supabase captcha is enabled. Anon-draft commit mints a Supabase
   * anonymous session, which captcha gates. Optional/undefined until the
   * Inquire-funnel build supplies it; empty → {} → no-op (see lib/turnstile.ts).
   */
  captchaToken?: string;
  /**
   * Per-type signature answers the generic flow's `tq_*` screens collect
   * (questionId → optionKey today; richer per-type fields when the per-type UI
   * lands) → events.signature_details (JSONB). Omitted / empty → NULL column
   * (see buildGenericEventInsert). Record<string, unknown> — the column is
   * generic JSONB and future per-type UI sends richer shapes; do not re-narrow.
   */
  signatureDetails?: Record<string, unknown>;
};

export type GenericCommitResult =
  | { ok: true; eventId: string }
  | { ok: false; error: string };
