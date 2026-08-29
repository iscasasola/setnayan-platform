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
import type { WeddingOnlyParts } from './wedding-only-parts';
import { PUBLIC_WIDGET_ALLOWLIST } from './public-widget-allowlist';
import { anonymousPublicCapability } from './public-capability';
import {
  visibleHideableWidgets,
  widgetByType,
  widgetShouldRender,
  widgetInPhase,
  openBrowseWidgetsInOrder,
  resolveWidgetTerminalState,
  type InvitationWidgetRow,
  type LifecyclePhase,
  type WidgetType,
  type WidgetTerminalState,
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

/**
 * Home's one signature spotlight under open-browse (council §1.1 Home tab,
 * §1.3 phase-as-emphasis). The phase decides what Home leads with; identity
 * modulates it so an anonymous rsvp-phase visitor gets find-mode, never an
 * RSVP imperative into a tab with no form (the §1.3 graft).
 *   - `std_film`        — save_the_date: the reveal / "Watch the film" door.
 *   - `countdown`       — save_the_date fallback when no film / null date.
 *   - `rsvp`            — rsvp phase, cookie guest: the RSVP card → Me.
 *   - `find_invite`     — rsvp phase, anonymous: find-mode "Find your invite".
 *   - `watch_live`      — event phase: the Watch Live door.
 *   - `editorial_cover` — editorial phase: the story cover.
 */
export type HomeSpotlightKind =
  | 'std_film'
  | 'countdown'
  | 'rsvp'
  | 'find_invite'
  | 'watch_live'
  | 'editorial_cover';

export type HomeSpotlight = { kind: HomeSpotlightKind };

/**
 * Pick Home's spotlight for the phase + identity (open-browse only). Pure:
 * `stdFilm` (a plan input — a launched film exists) is the only content signal
 * needed; every other case is a fixed phase→emphasis mapping.
 */
export function pickHomeSpotlight(
  identity: SiteIdentityKind,
  phase: LifecyclePhase,
  stdFilm: boolean,
): HomeSpotlight {
  switch (phase) {
    case 'save_the_date':
      // No launched film / null-date events must NOT get a dead "Watch the
      // film" door — fall back to the countdown/plate (council §1.1).
      return { kind: stdFilm ? 'std_film' : 'countdown' };
    case 'rsvp':
      // Identity-aware: anonymous → find-mode, never an RSVP imperative.
      return { kind: identity === 'guest' ? 'rsvp' : 'find_invite' };
    case 'event':
      return { kind: 'watch_live' };
    case 'editorial':
      return { kind: 'editorial_cover' };
  }
}

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
  /**
   * The guest list is finalized — the invitation is closed (owner 2026-08-20:
   * the invitation "will only show while the guest list is not yet
   * finalized").
   *
   * 🔑 IT GATES NOTHING ON ITS OWN — it is handed to the reply card, which
   * freezes the going-or-not ANSWER and leaves the rest of itself open.
   *
   * The obvious implementation (AND it into `rsvpShouldRender`, or hide the
   * form) was built first and was WRONG, twice over. That flag gates the whole
   * RSVP SECTION, which is also where a guest who already replied finds their
   * keepsake ticket and seat. And the form itself is not a headcount: it also
   * carries the selfie that makes their photos findable, their meal, their
   * dietary notes and a note to the host. The list finalizes about two weeks
   * out — exactly when "nut allergy" matters most — so hiding it takes the
   * allergy box away from a caterer's last fortnight.
   *
   * The database drew this line correctly all along: its post-lock guard
   * blocks only count-affecting writes and lets meal / photo / seating
   * through. Only the ANSWER freezes.
   */
  guestListClosed: boolean;
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

  // -------------------------------------------------------------------------
  // Open-browse PR7 (council §1.3). All FALSE/empty/null on the flag-off path
  // (`openBrowse` FALSE — the prod default), so the flag-off render is
  // byte-identical and the goldens are unaffected (they assert named fields,
  // never the whole object). Populated only when `events.website_open_browse`
  // is TRUE, at which point phases are EMPHASIS, not gates.
  // -------------------------------------------------------------------------
  /** Echo of the open-browse input — the render tree branches its spotlight
   *  card + terminal-state rendering on this. */
  openBrowse: boolean;
  /** Home's one signature spotlight for this phase + identity, or null on the
   *  flag-off path. Consumed by the open-browse Home lead card. */
  spotlight: HomeSpotlight | null;
  /** Per-widget terminal state for THIS phase (open-browse only; `{}` off).
   *  PR7 already excludes non-`active` widgets from the widened lists; this
   *  map is the seam PR8's degraded (`archive`/`closed`) renderers consume. */
  widgetTerminalStates: Partial<Record<WidgetType, WidgetTerminalState>>;
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
  /**
   * Which wedding-only parts this EVENT TYPE may show. Resolved from the
   * event-type profile by `resolveWeddingOnlyParts`.
   *
   * 🔴 THIS RESOLVER USED TO NOT KNOW WHAT KIND OF EVENT IT WAS. The body was
   * chosen from the calendar alone, so a birthday booked far enough ahead got
   * the WEDDING Save-the-Date film — a cinematic reveal built around two names.
   * The profile had recorded that this may not happen since the type engine
   * shipped; nothing read it.
   *
   * Optional so every existing caller and golden test is byte-identical while
   * absent — and when absent, every part is ALLOWED, which is exactly today's
   * behaviour. The guest tree passes it; nothing else has to.
   */
  weddingOnlyParts?: Partial<WeddingOnlyParts>;
  widgets: readonly InvitationWidgetRow[];
  /**
   * Open-browse PR7 — `Boolean(event.website_open_browse)`. Default FALSE (the
   * prod default), which yields the byte-identical flag-off render. TRUE flips
   * lifecycle phases from GATES to EMPHASIS: every published, non-empty,
   * audience-permitted widget renders in every phase, ordered by
   * WIDGET_SPOTLIGHT, with a Home spotlight pick. Dormant until the couple's
   * board toggle (PR9) / new-event default (PR11) sets the column.
   */
  openBrowse?: boolean;
  /**
   * `guestListIsClosed(...)` for this event — the guest-list edit deadline has
   * passed (or the finalize stamp is already written), so the count is frozen
   * and `guard_guest_edits_when_locked` refuses changes.
   *
   * Optional and defaulting to FALSE so every existing caller and golden test
   * stays byte-identical while absent — the same posture `weddingOnlyParts`
   * took. Only the guest tree passes it.
   */
  guestListClosed?: boolean;
  /**
   * Per-widget content presence for the shared `hasContent` predicate
   * (open-browse only). A widget the couple kept visible but that has no
   * content this event (e.g. `schedule` with zero public blocks) is dropped
   * from the widened list so the menu never points at an empty section.
   * Widgets absent from the map fail OPEN (assumed to have content), matching
   * the "render everything for pre-backfill rows" posture. Ignored on the
   * flag-off path.
   */
  content?: Partial<Record<WidgetType, boolean>>;
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
    weddingOnlyParts,
    openBrowse = false,
    guestListClosed = false,
    content = {},
  } = input;

  // Increment C: after the wedding the body is the editorial takeover; far
  // before it, the minimal Save the Date. Verbatim from both old trees.
  const showEditorial = phasesEnabled && lifecyclePhase === 'editorial';
  // A Save-the-Date body is the FILM — a wedding-signature reveal. An event
  // type that may not have one falls through to the ordinary body rather than
  // being handed somebody else's product. Absent ⇒ allowed ⇒ today's behaviour.
  const mayShowStdFilm = weddingOnlyParts?.save_the_date_film ?? true;
  const showSaveTheDate =
    phasesEnabled && lifecyclePhase === 'save_the_date' && mayShowStdFilm;

  /**
   * THE CINEMATIC REVEAL ALSO PLAYS OVER THE INVITATION (owner 2026-08-29:
   * *"event hub should also have the cinematic reveal"* — "also", so an
   * addition, never a move).
   *
   * 🔴 WHAT IT WAS: `revealEnabled` was `showSaveTheDate`, so the veil lifted
   * ONLY while the event was still far enough out to be in its save-the-date
   * window. The moment the page became the invitation the reveal stopped
   * forever — which is the moment most guests actually open the link. The
   * couple had paid for an opening almost none of their guests would meet.
   *
   * ⛔ THE DAY ITSELF AND THE STORY AFTERWARDS ARE DELIBERATELY EXCLUDED, and
   * that is an owner ruling, not an oversight: on the day a guest is opening
   * this to find their table, and a veil between them and a table number at
   * the venue is a toll gate, not a flourish. The editorial phase has its own
   * cover.
   *
   * 🔒 `mayShowStdFilm` IS LOAD-BEARING HERE IN A WAY IT WAS NOT BEFORE.
   * Previously a wake was excluded twice over — it never ENTERS the
   * save_the_date phase (gated on the solemn register in app/[slug]/page.tsx)
   * AND its profile has no `save_the_date` surface. A wake DOES reach the rsvp
   * phase, so that first protection is gone here and this flag is the whole
   * fence. `wedding-only-parts.ts` calls this part "The Save-the-Date cinematic
   * film AND ITS FIVE REVEAL OPENINGS" — the openings are already inside its
   * scope, so this is the existing rule applied, not a new one invented.
   * ⚖ Measured against prod 2026-08-29: of the 17 event-type profiles, ONLY
   * `wedding` carries the `save_the_date` surface. So this reaches weddings
   * today and a wake can never see a cinematic veil over its invitation.
   */
  const showInvitationReveal =
    phasesEnabled && lifecyclePhase === 'rsvp' && mayShowStdFilm;
  const body: SiteBodyKind = showEditorial
    ? 'editorial'
    : showSaveTheDate
      ? 'save_the_date'
      : 'normal';

  // --- The widget-list + always-on gates. Two mutually-exclusive paths: -----
  //  · flag-OFF (openBrowse FALSE, the prod default) — VERBATIM the pre-PR7
  //    computation, so every golden holds and prod is byte-identical.
  //  · open-browse (openBrowse TRUE) — phases become emphasis: the widened,
  //    WIDGET_SPOTLIGHT-ordered, mode/audience/content/terminal-filtered lists
  //    (openBrowseWidgetsInOrder); qr_card + greeting widen to every phase
  //    (council §1.2); rsvp follows its terminal state (open form until the
  //    post-event 'closed' card, which is excluded until PR8's copy).
  let heroShouldRender: boolean;
  let greetingShouldRender: boolean;
  let qrCardShouldRender: boolean;
  let rsvpShouldRender: boolean;
  let hideableInOrder: InvitationWidgetRow[];
  let publicSafeWidgets: InvitationWidgetRow[];
  let spotlight: HomeSpotlight | null;
  let widgetTerminalStates: Partial<Record<WidgetType, WidgetTerminalState>>;

  if (openBrowse) {
    heroShouldRender = widgetShouldRender(widgetByType(widgets, 'hero'));
    // qr_card + greeting are reachable in EVERY phase (the personal QR
    // personalizes always; council §1.2 — fixes the WIDGET_PHASES strip).
    greetingShouldRender = widgetShouldRender(widgetByType(widgets, 'greeting'));
    qrCardShouldRender = widgetShouldRender(widgetByType(widgets, 'qr_card'));
    // RSVP: open form while its terminal state is 'active'; the post-event
    // 'closed' card is PR8 copy, so exclude it here (correct-but-incomplete).
    rsvpShouldRender =
      widgetShouldRender(widgetByType(widgets, 'rsvp')) &&
      resolveWidgetTerminalState('rsvp', lifecyclePhase) === 'active';
    // Guest tree: widened list under the GUEST audience (sees guests_only).
    hideableInOrder = openBrowseWidgetsInOrder({
      widgets,
      identity: 'guest',
      phase: lifecyclePhase,
      content,
    });
    // Anonymous tree: widened list under the ANONYMOUS audience, then fenced by
    // the exported firewall via the capability object (council §1.2 — the
    // allow-list stays the boundary; the capability object is its one user).
    const cap = anonymousPublicCapability();
    publicSafeWidgets = openBrowseWidgetsInOrder({
      widgets,
      identity: 'anonymous',
      phase: lifecyclePhase,
      content,
    }).filter((w) => cap.canRenderType(w.widget_type));
    spotlight = pickHomeSpotlight(identity, lifecyclePhase, stdFilm);
    // The terminal-state seam for PR8: every guest-visible hideable widget +
    // rsvp, mapped to its state for this phase (even non-`active` ones, which
    // PR7 excludes above but PR8 renders as archive/closed copy).
    widgetTerminalStates = {};
    widgetTerminalStates.rsvp = resolveWidgetTerminalState('rsvp', lifecyclePhase);
    for (const w of widgets) {
      if (w.is_always_on) continue;
      widgetTerminalStates[w.widget_type] = resolveWidgetTerminalState(
        w.widget_type,
        lifecyclePhase,
      );
    }
  } else {
    heroShouldRender =
      widgetShouldRender(widgetByType(widgets, 'hero')) &&
      (!phasesEnabled || widgetInPhase('hero', lifecyclePhase));
    greetingShouldRender =
      widgetShouldRender(widgetByType(widgets, 'greeting')) &&
      (!phasesEnabled || widgetInPhase('greeting', lifecyclePhase));
    qrCardShouldRender =
      widgetShouldRender(widgetByType(widgets, 'qr_card')) &&
      (!phasesEnabled || widgetInPhase('qr_card', lifecyclePhase));
    rsvpShouldRender =
      widgetShouldRender(widgetByType(widgets, 'rsvp')) &&
      (!phasesEnabled || widgetInPhase('rsvp', lifecyclePhase));
    hideableInOrder = visibleHideableWidgets(widgets).filter(
      (w) => !phasesEnabled || widgetInPhase(w.widget_type, lifecyclePhase),
    );
    // The anonymous firewall: PUBLIC_WIDGET_ALLOWLIST types only (every one
    // carries event-level data — no per-guest fields), then the same phase
    // fence as the guest list. Old PublicLanding filtered exactly this way.
    publicSafeWidgets = visibleHideableWidgets(widgets).filter(
      (w) =>
        PUBLIC_WIDGET_ALLOWLIST.includes(w.widget_type) &&
        (!phasesEnabled || widgetInPhase(w.widget_type, lifecyclePhase)),
    );
    spotlight = null;
    widgetTerminalStates = {};
  }

  return {
    body,
    fullBleed: showSaveTheDate && stdFilm,
    stdViewBeacon: showSaveTheDate && !isSample,
    revealEnabled: showSaveTheDate || showInvitationReveal,
    // ⚠ DELIBERATELY STILL KEYED ON `showSaveTheDate` ALONE, not on the reveal.
    // The 2026-06-19 ruling is that the STD FILM owns audio in its own phase;
    // it is not a rule about the veil. Over the invitation the veil (z-60) sits
    // ABOVE the floating speaker (z-50), so the control is simply hidden until
    // the veil lifts — and background music never autoplays (it starts only on
    // a tap), so there is no soundtrack playing underneath a closed veil.
    // Widening this to the reveal would silence a paid Event Hub PRO feature
    // for the whole invitation phase.
    backgroundMusic: hasBgMusic && !showSaveTheDate,
    stdShowTextHero: identity === 'anonymous' && !hasHeroMedia,
    anonymousHeroBanner:
      identity === 'anonymous' && hasHeroMedia && body === 'normal',
    heroShouldRender,
    greetingShouldRender,
    qrCardShouldRender,
    rsvpShouldRender,
    guestListClosed,
    hideableInOrder,
    publicSafeWidgets,
    // Guests always see live media; an anonymous viewer only when the couple
    // opted in (PR5). site-body.tsx ANDs this onto the two anonymous gates.
    liveMediaVisible: identity === 'guest' || liveMediaPublic,
    openBrowse,
    spotlight,
    widgetTerminalStates,
  };
}
