/**
 * The reveal library — the shared registry of openings.
 *
 * 🎭 NINE REVEALS (owner 23 Nov 2026, DECISION_LOG "NINE REVEALS SHIP; THE GIFT BOX IS HELD"; drawing specs
 * `prototypes/reveals_round3_veil_rules_2026-11-23/`): Veil · Beach curtains · Envelope (classic + gatefold) ·
 * Fabric · Scratch · Smoke · Cathedral doors · Petals · Fireworks. The veil is the shipped `veil-reveal.tsx`;
 * the others are scenes on one stage (`scene-reveal.tsx`). All share one set of motion rules (`lib/reveal-motion.ts`).
 * The 2026-06 openings (four-flap · two-flaps · church doors) are retired; their ids map to the nearest new
 * reveal (`RETIRED_REVEAL_IDS`, lib/reveal-config-pure.ts). A tiny pure module (no React, no three.js) so the live
 * overlay and every chooser share it at zero bundle cost.
 */
import { RETIRED_REVEAL_IDS, type RevealTemplateId } from '@/lib/reveal-config-pure';
import type { GatefoldClosure } from '@/lib/std-reveal-effects';

export type RevealTemplate = RevealTemplateId;

/**
 * The FREE choice — no opening reveal at all; the content film plays straight
 * away (the reveal templates are the premium "filter" layered on top). Stored
 * in `events.std_reveal_template` as the string 'none' so a couple's explicit
 * "no opening" is distinct from null ("not chosen → house default"), and is
 * honoured even for couples who own the premium unlock. (owner 2026-06-18)
 */
export const NO_REVEAL = 'none' as const;
export type RevealChoice = RevealTemplate | typeof NO_REVEAL;

/** The veil lifts and STAYS as a drape (its own engine); every other reveal is a scene that opens and clears. */
export function isVeilTemplate(t: RevealTemplate): boolean {
  return t === 'veil-sheer';
}

/**
 * `?reveal=` query-param aliases → template id. Lets a Vercel preview demo any
 * template without flipping the global flag. The retired ids still resolve (to their nearest new reveal).
 */
export const REVEAL_ALIASES: Record<string, RevealTemplate> = {
  veil: 'veil-sheer',
  'veil-sheer': 'veil-sheer',
  curtains: 'beach-curtains',
  'beach-curtains': 'beach-curtains',
  envelope: 'envelope-classic',
  'envelope-classic': 'envelope-classic',
  gatefold: 'envelope-gatefold',
  'envelope-gatefold': 'envelope-gatefold',
  fabric: 'fabric',
  scratch: 'scratch',
  smoke: 'smoke',
  doors: 'cathedral-doors',
  'cathedral-doors': 'cathedral-doors',
  petals: 'petals',
  fireworks: 'fireworks',
  'two-flap-v': 'envelope-gatefold',
  'two-flap-h': 'envelope-classic',
  ...RETIRED_REVEAL_IDS,
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
 * Ordered library for every chooser. `blurb` is a one-line plain-English description of HOW the opening moves;
 * `motion` a 2–3 word chip; `hint` the ONE instruction the guest reads over the closed reveal (the drawing's
 * `RV_META` hints, shortened). The veil's is the owner's own words (`VEIL_HINT`, reveal-overlay.tsx).
 */
export const REVEAL_LIBRARY: ReadonlyArray<{
  id: RevealTemplate;
  label: string;
  family: 'veil' | 'scene';
  blurb: string;
  motion: string;
  hint: string;
}> = [
  { id: 'veil-sheer', label: 'Veil', family: 'veil', blurb: 'A sheer bridal veil lifts from where they tap and hangs as a fold.', motion: 'Veil lifts away', hint: 'Tap or swipe up to unveil' },
  { id: 'beach-curtains', label: 'Beach curtains', family: 'scene', blurb: 'Two white beach curtains slide apart on their rod.', motion: 'Curtains part', hint: 'Tap or swipe to open' },
  { id: 'envelope-classic', label: 'Envelope · classic', family: 'scene', blurb: 'An ornate flap lifts under its gold wax seal; light pours out.', motion: 'Flaps unfold', hint: 'Tap the seal' },
  { id: 'envelope-gatefold', label: 'Envelope · gatefold', family: 'scene', blurb: 'Your wax seal stays whole on the left panel, or a satin bow comes undone, then two panels open like doors.', motion: 'Panels open', hint: 'Tap the seal' },
  { id: 'fabric', label: 'Fabric', family: 'scene', blurb: 'One satin drape slides slowly off the cover, like a car reveal.', motion: 'Cloth slides off', hint: 'Tap or pull the cloth' },
  { id: 'scratch', label: 'Scratch', family: 'scene', blurb: 'Gold foil to scratch away. It opens once 60% is gone.', motion: 'Scratch to open', hint: 'Scratch to open' },
  { id: 'smoke', label: 'Smoke', family: 'scene', blurb: 'Dry-ice fog fills the screen and opens in rings from the tap.', motion: 'Fog clears', hint: 'Tap anywhere' },
  { id: 'cathedral-doors', label: 'Cathedral doors', family: 'scene', blurb: 'Heavy doors swing in; you glide down the aisle into the light.', motion: 'Doors open', hint: 'Tap the doors' },
  { id: 'petals', label: 'Petals', family: 'scene', blurb: 'Sampaguita and rose petals lift in a ring from the tap and fall away.', motion: 'Petals lift', hint: 'Tap anywhere' },
  { id: 'fireworks', label: 'Fireworks', family: 'scene', blurb: 'A rocket rises from the tap; the night melts where its sparks fall.', motion: 'Night bursts open', hint: 'Tap anywhere' },
];

/** The one instruction over a closed reveal. */
export function revealHint(t: RevealTemplate, closure?: GatefoldClosure): string {
  /* 🎀 a gatefold tied with a ribbon has no seal to tap (owner 23 Nov: "ribbon and wax seal never co exist together") */
  if (t === 'envelope-gatefold' && closure === 'ribbon') return 'Tap the bow';
  return REVEAL_LIBRARY.find((r) => r.id === t)?.hint ?? 'Tap to open';
}
