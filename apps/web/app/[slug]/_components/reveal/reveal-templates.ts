/**
 * The Save-the-Date reveal library — the shared registry of opening templates.
 *
 * 5 templates (owner-locked 2026-06-17): 4 rigid (envelopes + church doors) + 1
 * veil (the sheer bridal veil). The Crown veil was removed 2026-06-17. Kept as a
 * tiny pure types/consts module (no React, no three.js) so both the live overlay
 * and the dashboard preview chooser can share it with zero bundle cost.
 */

export type RevealTemplate =
  | 'four-flap'
  | 'two-flap-vertical'
  | 'two-flap-horizontal'
  | 'church-doors'
  | 'veil-sheer';
// 'gold-monogram' + 'molten-monogram' were RETIRED as openings 2026-06-22 — they
// are now monogram-editor ANIMATIONS (the 'gold'/'molten' motion keys in
// lib/monogram-motion.ts, played by HeroMonogram), not reveal openings.

/**
 * The FREE choice — no opening reveal at all; the content film plays straight
 * away (the reveal templates are the premium "filter" layered on top). Stored
 * in `events.std_reveal_template` as the string 'none' so a couple's explicit
 * "no opening" is distinct from null ("not chosen → house default"), and is
 * honoured even for couples who own the premium unlock. (owner 2026-06-18)
 */
export const NO_REVEAL = 'none' as const;
export type RevealChoice = RevealTemplate | typeof NO_REVEAL;

/** Veil templates lift/fold themselves clear (drag-driven); rigid ones swing open on tap. */
export function isVeilTemplate(t: RevealTemplate): boolean {
  return t === 'veil-sheer';
}

/**
 * Rigid swing duration. The CSS transition on the flaps runs for RIGID_FOLD_MS;
 * the overlay (and the studio preview) wait RIGID_REVEAL_MS — a touch longer — to
 * remove the overlay so the swing finishes before the page beneath takes over.
 * NOTE: the Tailwind class on the flaps is the literal `duration-[1100ms]` (JIT
 * needs a static value) — keep it in sync with RIGID_FOLD_MS by hand.
 */
export const RIGID_FOLD_MS = 1100;
export const RIGID_REVEAL_MS = RIGID_FOLD_MS + 100;

/**
 * `?reveal=` query-param aliases → template id. Lets a Vercel preview demo any
 * template without flipping the global flag. Back-compat aliases kept: `veil`
 * (→ sheer) and `envelope` (→ four-flap) shipped in earlier PRs.
 */
export const REVEAL_ALIASES: Record<string, RevealTemplate> = {
  envelope: 'four-flap',
  'four-flap': 'four-flap',
  'two-flap-vertical': 'two-flap-vertical',
  'two-flap-v': 'two-flap-vertical',
  'two-flap-horizontal': 'two-flap-horizontal',
  'two-flap-h': 'two-flap-horizontal',
  'church-doors': 'church-doors',
  doors: 'church-doors',
  veil: 'veil-sheer',
  'veil-sheer': 'veil-sheer',
};

/**
 * Resolve the `?reveal=` preview override — SEC-3 (2026-07-26).
 *
 * ── THE BUG ────────────────────────────────────────────────────────────────
 * `?reveal=` used to be read straight off `window.location.search` and then
 * OR'd into the activation test in RevealOverlay:
 *
 *     (configEnabled || FLAG_ON || override !== null || premiumUnlocked)
 *
 * `override !== null` short-circuited `premiumUnlocked`, so ANY visitor — no
 * auth, no session, no relationship to the event — could append
 * `?reveal=veil-sheer` to a public couple page and get the ₱999 premium
 * cinematic opening on an event that never bought it. It was three bypasses in
 * one: it defeated the paywall, it resurrected openings the ADMIN had
 * deactivated (`allowedMap[template] === false`), and it overrode the COUPLE's
 * explicit "No Reveal" choice.
 *
 * ── WHY IT IS SCOPED RATHER THAN DELETED ───────────────────────────────────
 * The override is a real affordance, not an accident: "how we demo on Vercel
 * previews" (RevealOverlay's own header). But the preview environment already
 * has an env-scoped switch for exactly this — NEXT_PUBLIC_STD_REVEAL=1, which
 * is a build-time variable no visitor can set, and which turns the reveal on
 * for everyone anyway (so a preview deploy demoing openings has it on by
 * definition). Gating the override on that flag keeps every legitimate preview
 * working unchanged and makes the param inert in production, where the flag is
 * off.
 *
 * Host-side previewing is unaffected: the dashboard chooser
 * (dashboard/[eventId]/_components/reveal-preview.tsx) and the admin Reveal
 * Studio both render the templates directly from props and never read this
 * param.
 */
export function resolveRevealOverride(
  rawParam: string | null | undefined,
  previewAuthority: boolean,
): RevealTemplate | null {
  if (!previewAuthority) return null;
  if (!rawParam) return null;
  // hasOwnProperty, NOT a bare index: `REVEAL_ALIASES['constructor']` and
  // `['__proto__']` resolve off Object.prototype and come back TRUTHY, so the
  // old `REVEAL_ALIASES[reveal] ?? null` returned a non-null "override" for
  // `?reveal=constructor`. Since the activation test only asked
  // `override !== null`, that was a second, alias-free way to switch the
  // opening on — found while writing reveal-override.test.ts.
  if (!Object.prototype.hasOwnProperty.call(REVEAL_ALIASES, rawParam)) return null;
  return REVEAL_ALIASES[rawParam] ?? null;
}

/**
 * Ordered library for the dashboard chooser. `blurb` is a one-line plain-English
 * description of HOW the opening moves — the previews are intentionally small +
 * un-recordable (owner-locked 2026-06-18), so the blurb is what lets a couple
 * tell the five openings apart. `motion` is a 2-3 word gesture summary used as a
 * chip on each picker tile.
 */
export const REVEAL_LIBRARY: ReadonlyArray<{
  id: RevealTemplate;
  label: string;
  family: 'rigid' | 'veil';
  blurb: string;
  motion: string;
}> = [
  {
    id: 'four-flap',
    label: 'Four-flap envelope',
    family: 'rigid',
    blurb: 'A classic envelope — all four flaps unfold outward from the centre to reveal your film.',
    motion: 'Flaps unfold',
  },
  {
    id: 'two-flap-vertical',
    label: 'Two-flap · side open',
    family: 'rigid',
    blurb: 'Two panels part to the left and right, like opening a card from the side.',
    motion: 'Opens sideways',
  },
  {
    id: 'two-flap-horizontal',
    label: 'Two-flap · top open',
    family: 'rigid',
    blurb: 'Two panels swing up and down, opening from the middle like a top-fold note.',
    motion: 'Opens up & down',
  },
  {
    id: 'church-doors',
    label: 'Church doors',
    family: 'rigid',
    blurb: 'Two tall doors swing open from the centre — a grand, ceremonial entrance.',
    motion: 'Doors swing open',
  },
  {
    id: 'veil-sheer',
    label: 'Sheer bridal veil',
    family: 'veil',
    blurb: 'A soft, sheer veil lifts and floats away, uncovering your film beneath.',
    motion: 'Veil lifts away',
  },
];
