/**
 * lib/reveal-access.ts — WHO MAY SEE A REVEAL. The one decision.
 *
 * Owner, 2026-09-24, verbatim: **"all reveal is paid".**
 *
 * Every opening — four-flap · two-flap-vertical · two-flap-horizontal ·
 * church-doors · veil-sheer — and every effect that rides on it needs Event Hub
 * Pro. `COUPLE_WEBSITE_PRO` grants `STD_PREMIUM_OPENINGS` through
 * `SKU_OWNERSHIP_ALIASES` (lib/entitlements.ts), so "owns Pro" is read as
 * `eventStdOpeningsActive()` (lib/std-openings.ts). A free couple gets
 * `NO_REVEAL`: the page / film plays directly.
 *
 * ── WHAT THIS REPLACES ─────────────────────────────────────────────────────
 * RevealOverlay used to activate on ANY of: the admin Reveal Studio master
 * toggle (`config.enabled`, "on for everyone") · the env preview flag · a
 * preview `?reveal=` · the couple owning the unlock. Measured 2026-09-24: the
 * prod master toggle is ON with `veil-sheer` as the house default, so every
 * free couple's guests were shown the paid veil. The admin toggle is no longer
 * an entitlement — it grants nothing. The admin still owns the house DEFAULT
 * (what a Pro couple who has not chosen gets) and the allowed-openings map.
 *
 * ── THE TABLE ──────────────────────────────────────────────────────────────
 *   staff preview + a valid `?reveal=`      → that override (demo builds only)
 *   not Pro, not a staff preview            → NO_REVEAL  (admin default ignored)
 *   couple chose 'none'                     → NO_REVEAL  (even when Pro)
 *   Pro (or staff preview), chose X         → X          (admin map may swap it)
 *   Pro (or staff preview), chose nothing   → admin default → 'four-flap'
 *
 * `isStaffPreview` is the build-time `NEXT_PUBLIC_STD_REVEAL=1` preview flag —
 * no visitor can set it, and it is off in production (SEC-3, 2026-07-26). A
 * public guest's `?reveal=` is therefore inert: `previewOverride` must already
 * be resolved through `resolveRevealOverride(param, isStaffPreview)`, and it is
 * ignored here too unless `isStaffPreview` is true — two locks, not one.
 *
 * PURE: no React, no window, no DB. Called by the server mount (which decides
 * whether the overlay is mounted at all) and by the client overlay (which is
 * the only side that can read `?reveal=`), so both halves agree by
 * construction.
 */
import type { RevealTemplateId } from '@/lib/reveal-config-pure';

/** Mirror of `NO_REVEAL` in app/[slug]/_components/reveal/reveal-templates.ts. */
export const REVEAL_NONE = 'none' as const;
export type RevealDecision = RevealTemplateId | typeof REVEAL_NONE;

export type RevealAccessInput = {
  /** The event holds Event Hub Pro (STD_PREMIUM_OPENINGS, active). */
  ownsPro: boolean;
  /** events.std_reveal_template, coerced: an id · 'none' · null (not chosen). */
  chosenTemplate: RevealDecision | null | undefined;
  /** Reveal Studio house default — for a Pro couple who has not chosen. */
  adminDefault: RevealTemplateId | null | undefined;
  /** Build-time preview authority (NEXT_PUBLIC_STD_REVEAL=1). Never a guest. */
  isStaffPreview: boolean;
  /** A resolved `?reveal=` override. Honoured ONLY with `isStaffPreview`. */
  previewOverride?: RevealTemplateId | null;
  /** Reveal Studio allowed-openings map; `false` deactivates an opening. */
  allowed?: Partial<Record<RevealTemplateId, boolean>> | null;
};

export function revealAllowedFor(input: RevealAccessInput): RevealDecision {
  const { ownsPro, chosenTemplate, adminDefault, isStaffPreview, previewOverride, allowed } =
    input;
  // 1 · A staff preview's explicit override wins over everything (demo builds).
  if (isStaffPreview && previewOverride) return previewOverride;
  // 2 · All reveal is paid. The admin default is NOT an entitlement.
  if (!ownsPro && !isStaffPreview) return REVEAL_NONE;
  // 3 · The couple's explicit "No Reveal" stands, Pro or not.
  if (chosenTemplate === REVEAL_NONE) return REVEAL_NONE;
  let template: RevealTemplateId = chosenTemplate ?? adminDefault ?? 'four-flap';
  // 4 · The admin's allowed-openings map: a deactivated opening falls back to
  //     the house default, else the first still-enabled opening.
  if (allowed && allowed[template] === false) {
    if (adminDefault && allowed[adminDefault] !== false) {
      template = adminDefault;
    } else {
      const first = (Object.keys(allowed) as RevealTemplateId[]).find(
        (t) => allowed[t] !== false,
      );
      if (first) template = first;
    }
  }
  return template;
}

/** The error code a refused reveal write returns (Save-the-Date builder). */
export const REVEAL_NEEDS_PRO = 'needs-event-hub-pro' as const;

/**
 * THE WRITE SIDE. May this couple persist `std_reveal_template = value`?
 * 'none' (and clearing to null) is ALWAYS writable — a free couple can always
 * choose No Reveal. Any opening needs Pro.
 */
export function revealTemplateWriteAllowed(value: string | null, ownsPro: boolean): boolean {
  if (value === null || value === REVEAL_NONE) return true;
  return ownsPro;
}

/** The reveal-only fields of events.std_reveal_effects (everything but `music`,
 *  which is the free film's own "Play music" toggle stored in the same JSON). */
const REVEAL_ONLY_EFFECT_KEYS = ['butterflies', 'petals', 'veilColor', 'petalColor', 'gold'] as const;

/**
 * May this couple persist these effects? A non-Pro couple may re-save what is
 * already stored and flip `music`, but may not CHANGE a reveal-only effect.
 * Both arguments must already be resolved (`resolveRevealEffects`).
 */
export function revealEffectsWriteAllowed(
  stored: Record<string, unknown>,
  incoming: Record<string, unknown>,
  ownsPro: boolean,
): boolean {
  if (ownsPro) return true;
  return REVEAL_ONLY_EFFECT_KEYS.every(
    (k) => JSON.stringify(stored[k] ?? null) === JSON.stringify(incoming[k] ?? null),
  );
}
