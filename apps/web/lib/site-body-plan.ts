/**
 * The guest-site body plan — the ONE phase-spine computation site
 * (OPEN-BROWSE PR3 — council build plan §3 row 3).
 *
 * Before this PR the 3-way body decision (editorial | save-the-date | normal)
 * and its dependent chrome gates were written TWICE in `app/[slug]/page.tsx`
 * (once in PublicLanding, once in InvitationSite) — the exact duplication the
 * council named as the program's highest-subtlety hazard: a future phase
 * change edited in one tree and not the other silently forks the site.
 * `resolveSiteBodyPlan` is now the only place those conditions exist;
 * `SiteBody` (app/[slug]/_components/site-body.tsx) consumes the plan for
 * every phase-driven gate.
 *
 * Every field below is the VERBATIM condition from the pre-merge page.tsx
 * (line references are to the last two-tree revision, PR #3596's merge).
 * Golden tests in `site-body-plan.test.ts` pin the full 4-phases × identities
 * matrix — a diff there is a product decision, never a refactoring accident.
 *
 * Dependency note: this module is pure (no React, no DB, no cookies) so the
 * node:test unit suite can exercise it directly.
 */
import { PUBLIC_WIDGET_ALLOWLIST } from './public-widget-allowlist';
import {
  visibleHideableWidgets,
  widgetByType,
  widgetShouldRender,
  widgetInPhase,
  type InvitationWidgetRow,
  type LifecyclePhase,
} from './invitation-widgets';

/**
 * The two identity tiers the body renders for. The third council tier —
 * the HOST — renders the `anonymous` body (hosts without a guest cookie have
 * always seen the public landing); what distinguishes a host is the
 * orchestrator-side `?phase=` preview permission, not a body variant.
 */
export type SiteIdentityKind = 'anonymous' | 'guest';

/** Which of the three bodies renders. Editorial wins over Save-the-Date by
 *  ternary order (they are mutually exclusive anyway — one lifecycle phase). */
export type SiteBodyKind = 'editorial' | 'save_the_date' | 'normal';

export type SiteBodyPlan = {
  /** The 3-way body: `phasesEnabled && phase==='editorial'` → editorial ·
   *  `phasesEnabled && phase==='save_the_date'` → save_the_date · else normal.
   *  (old page.tsx: showEditorialPlaceholder / showSaveTheDate, both trees) */
  body: SiteBodyKind;
  /** InvitationShell full-screen mode — the STD film IS the whole experience.
   *  Old: `fullBleed={showSaveTheDate && stdFilm}` (both trees). */
  fullBleed: boolean;
  /** STD view-tracking beacon — old: `showSaveTheDate && !event.is_sample`. */
  stdViewBeacon: boolean;
  /** RevealOverlayServer `enabled` — old: `enabled={showSaveTheDate}`. */
  revealEnabled: boolean;
  /** Floating background-music player mounts — old:
   *  `bgMusicUrl && !showSaveTheDate` (the STD film owns audio there). */
  backgroundMusic: boolean;
  /** SaveTheDateView's text-hero — old: anonymous passed `!hasHeroMedia`,
   *  guest passed `false` (the guest hero renders above). Only meaningful
   *  when body === 'save_the_date'. */
  stdShowTextHero: boolean;
  /** The anonymous full-bleed hero banner above the body — old:
   *  `hasHeroMedia && !showEditorialPlaceholder && !showSaveTheDate`
   *  (PublicLanding only; the guest hero is widget-gated below). */
  anonymousHeroBanner: boolean;
  /** Guest-tree always-on widget gates — old InvitationSite:
   *  `widgetShouldRender(widgetByType(widgets, T)) &&
   *   (!phasesEnabled || widgetInPhase(T, lifecyclePhase))`. */
  heroShouldRender: boolean;
  greetingShouldRender: boolean;
  qrCardShouldRender: boolean;
  rsvpShouldRender: boolean;
  /** Guest-tree hideable widgets in display order — old InvitationSite:
   *  `visibleHideableWidgets(widgets).filter(w => !phasesEnabled ||
   *   widgetInPhase(w.widget_type, lifecyclePhase))`. */
  hideableInOrder: InvitationWidgetRow[];
  /** Anonymous-tree public-safe widgets — old PublicLanding: the same
   *  visible-hideable set additionally fenced by PUBLIC_WIDGET_ALLOWLIST
   *  (PR1's exported firewall). The allow-list is the privacy boundary:
   *  guest-personal types can never appear here by construction. */
  publicSafeWidgets: InvitationWidgetRow[];
  /** Open-browse PR5 (owner 2026-07-23) — may the LIVE-media blocks
   *  (watch-live + Live Photo Wall) render? Guests always may; an anonymous
   *  (cookie-less) viewer only when the couple opted `events.live_media_public`.
   *  site-body.tsx ANDs this onto the two anonymous live-render gates. */
  liveMediaVisible: boolean;
};

export function resolveSiteBodyPlan(input: {
  identity: SiteIdentityKind;
  phasesEnabled: boolean;
  lifecyclePhase: LifecyclePhase;
  /** PR4 P1 — the auto-playing STD film (`?film=0` disables). */
  stdFilm: boolean;
  /** `Boolean(event.is_sample)` — sample events never beacon. */
  isSample: boolean;
  /** `Boolean(heroVideoUrl || heroPhotoUrl)` — resolved media, not intent. */
  hasHeroMedia: boolean;
  /** `Boolean(bgMusicUrl)`. */
  hasBgMusic: boolean;
  /** `Boolean(event.live_media_public)` — the couple's opt-in for anonymous
   *  live media (PR5). Guests see live media regardless of this. */
  liveMediaPublic: boolean;
  widgets: readonly InvitationWidgetRow[];
}): SiteBodyPlan {
  const {
    identity,
    phasesEnabled,
    lifecyclePhase,
    stdFilm,
    isSample,
    hasHeroMedia,
    hasBgMusic,
    liveMediaPublic,
    widgets,
  } = input;

  // Increment C: after the wedding the body is the editorial takeover; far
  // before it, the minimal Save the Date. Verbatim from both old trees.
  const showEditorial = phasesEnabled && lifecyclePhase === 'editorial';
  const showSaveTheDate = phasesEnabled && lifecyclePhase === 'save_the_date';
  const body: SiteBodyKind = showEditorial
    ? 'editorial'
    : showSaveTheDate
      ? 'save_the_date'
      : 'normal';

  return {
    body,
    fullBleed: showSaveTheDate && stdFilm,
    stdViewBeacon: showSaveTheDate && !isSample,
    revealEnabled: showSaveTheDate,
    backgroundMusic: hasBgMusic && !showSaveTheDate,
    stdShowTextHero: identity === 'anonymous' && !hasHeroMedia,
    anonymousHeroBanner:
      identity === 'anonymous' && hasHeroMedia && body === 'normal',
    heroShouldRender:
      widgetShouldRender(widgetByType(widgets, 'hero')) &&
      (!phasesEnabled || widgetInPhase('hero', lifecyclePhase)),
    greetingShouldRender:
      widgetShouldRender(widgetByType(widgets, 'greeting')) &&
      (!phasesEnabled || widgetInPhase('greeting', lifecyclePhase)),
    qrCardShouldRender:
      widgetShouldRender(widgetByType(widgets, 'qr_card')) &&
      (!phasesEnabled || widgetInPhase('qr_card', lifecyclePhase)),
    rsvpShouldRender:
      widgetShouldRender(widgetByType(widgets, 'rsvp')) &&
      (!phasesEnabled || widgetInPhase('rsvp', lifecyclePhase)),
    hideableInOrder: visibleHideableWidgets(widgets).filter(
      (w) => !phasesEnabled || widgetInPhase(w.widget_type, lifecyclePhase),
    ),
    // The anonymous firewall: PUBLIC_WIDGET_ALLOWLIST types only (every one
    // carries event-level data — no per-guest fields), then the same phase
    // fence as the guest list. Old PublicLanding filtered exactly this way.
    publicSafeWidgets: visibleHideableWidgets(widgets).filter(
      (w) =>
        PUBLIC_WIDGET_ALLOWLIST.includes(w.widget_type) &&
        (!phasesEnabled || widgetInPhase(w.widget_type, lifecyclePhase)),
    ),
    // Guests always see live media; an anonymous viewer only when the couple
    // opted in (PR5). site-body.tsx ANDs this onto the two anonymous gates.
    liveMediaVisible: identity === 'guest' || liveMediaPublic,
  };
}
