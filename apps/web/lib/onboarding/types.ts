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
  /**
   * The celebrant's first name (→ `events.honoree_label`) — asked ONLY for the
   * five gated life types (debut · christening · birthday · graduation · gender
   * reveal). It is the cardinality key: the cap is one in-planning event per
   * (account × type × HONOREE), so without it every birthday an account creates
   * collides with every other and the second one is refused forever.
   * NULL for lifestyle types, and for a user who skips the question.
   * Ordinary PI (a first name) — never a birthdate, never a dependent link.
   *
   * OPTIONAL so every existing payload constructor (and every fixture) stays
   * valid without a churn edit; absent and null mean the same thing — unlabeled,
   * which contends for the per-type singleton slot.
   */
  honoreeLabel?: string | null;
  /**
   * WHICH alaga that name is (→ `events.honoree_dependent_id`) — the STRONGER
   * half of the same cardinality key, carried from the create step's who
   * question. A link to a RECORD, so renaming the alaga no longer moves the
   * event to a different slot and two alaga who share a first name stop sharing
   * one. NULL for "You", for "Someone else", and for every account with no
   * People roster — i.e. for everything that behaved as it does today.
   *
   * ⚠ NEVER trust this from the wire. The client can forge it, and writing an
   * unowned id would leak a relationship AND corrupt another account's cap.
   * `commitOnboardingEvent` replaces whatever arrives here with the result of
   * `resolveHonoreeDependentId` (ownership + label re-checked server-side)
   * before it reaches `buildGenericEventInsert`.
   *
   * Still not a birthdate, and still not a link to one — the counsel gate in
   * event-insert.ts is untouched.
   */
  honoreeDependentId?: string | null;
  /**
   * The date this event COMMEMORATES (→ `events.anchor_date`) — NOT the day it
   * is held. Two columns on purpose: an anniversary marks a wedding date but is
   * celebrated whenever the couple holds it, and in PH a Tuesday milestone is
   * very often a Saturday party.
   *
   * ⚠ COUNSEL GATE — only ever written for anchor kinds that are NOT
   * `person_birthdate`. A person's birthdate is never stored on an event, so
   * birthday / debut / christening pass NULL here even though their anchor kind
   * names a birthdate. `buildGenericEventInsert` enforces this; the wizard also
   * never asks.
   */
  anchorDate?: string | null;
  /**
   * Why that date matters (→ `events.anchor_origin`). CHECK-constrained in the
   * DB to POSITIVE origins only — there is deliberately no memorial option
   * (babang-luksa stays out of this product).
   */
  anchorOrigin?: string | null;
  /** Does it come back every year? (→ `events.recurs`) */
  recurs?: boolean;
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
  /**
   * What the couple picked on the Papic services step (owner 2026-08-11) — the
   * shared-pool rung and how many dedicated cameras to add. Shape:
   * `lib/onboarding-services-selection.ts` · ServicesStepSelection.
   *
   * ⚠ UNTRUSTED, and deliberately typed `unknown`. It carries service_codes and
   * a count and NO amount; the commit re-parses it and re-prices every rung
   * from the live catalog (SEC-4). Typing it as ServicesStepSelection here would
   * suggest the server may trust its shape, which it may not.
   *
   * Absent / undefined ⇒ nothing was picked ⇒ no order. Every couple still gets
   * the free pool grant and the free dedicated camera.
   */
  servicesSelection?: unknown;
};

export type GenericCommitResult =
  | {
      ok: true;
      eventId: string;
      /**
       * Where to send the couple when they bought Papic shots or cameras on the
       * services step — the studio, carrying its payment banner.
       *
       * OPTIONAL AND ALWAYS SKIPPABLE. Absent means "nothing was bought, or the
       * order could not be minted", and the caller falls through to the normal
       * dashboard landing. The event is committed and its free grants armed
       * before this is ever computed, so a couple must never be blocked, bounced
       * or stranded because of it.
       */
      paymentPath?: string | null;
    }
  /**
   * `blocking` rides ONLY with error 'life_event_exists'. Without it the client
   * could say no more than "something went wrong", which is what made the
   * duplicate-life-event refusal a silent dead end: the user was never told
   * WHICH event conflicted, and the one act that resolves it — naming a
   * different celebrant — was never suggested.
   */
  | {
      ok: false;
      error: string;
      blocking?: { eventId: string; displayName: string };
    };
