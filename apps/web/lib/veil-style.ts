/**
 * lib/veil-style.ts — 🧵 THE SHEER VEIL IS THE COUPLE'S TO TUNE (owner 2026-10-17, verbatim: *"veil customization can
 * be fixed. fold coverage, veil thread count, veil color"* · *"wind speed/randomness"* — DECISION_LOG "THE VEIL IS THE
 * COUPLE'S TO TUNE" and "THE VEIL'S WIND IS THE COUPLE'S TOO").
 *
 * Cover Scene › Style, with Sheer veil, offers Fold ▾ · Weave ▾ · Wind ▾ (and Colour, the one colour sheet, on
 * `effects.veilColor` as the veil always had). Each is three presets, the middle one TODAY'S VEIL EXACTLY — stored as
 * nothing at all. The other two are sparse overrides of the house look in the event's own
 * `events.std_reveal_effects.tune` (no new column), which every surface that plays the veil already lays over the
 * Reveal Studio's look (`tuneRevealLooks` — the guest page, the Maker's ▶ and the hold-▶ preview alike), and which
 * rides the draft and is Event Hub Pro at Apply like every other change to the reveal's effects.
 *
 *   Fold   how much of the cover the LIFTED drape covers   `drape`   Light ≈ 12 % · Medium ≈ 18 % (today) · Full ≈ 28 %
 *   Weave  the thread count: how sheer the tulle reads     `weave`   Fine · Medium (today) · Dense
 *   Wind   speed and randomness together                    `wind` + `gust`   Still · Breeze (today) · Gusty
 *
 * The Fold's valances are measured on the cloth, settled, at 375 (WebKit iPhone 13, 2026-10-17 walk): drape 9 hangs
 * over 12.7 % of the cover, 15 over 18.4 %, 26 over 28.5 %. Reduced motion and Save-Data keep the veil still, as shipped.
 */
import type { VeilLook } from './reveal-config-pure';
import type { RevealEffects, RevealTune, RevealTuneKey } from './std-reveal-effects';

export type VeilFold = 'light' | 'medium' | 'full';
export type VeilWeave = 'fine' | 'medium' | 'dense';
export type VeilWind = 'still' | 'breeze' | 'gusty';

type Preset<K extends string> = Record<K, { label: string; hint: string; tune: RevealTune }>;

/** The Fold: the lifted drape's valance (the look's `drape`). Medium is the house value — nothing stored. */
export const VEIL_FOLDS: Preset<VeilFold> = {
  light: { label: 'Light', hint: 'A slim fold at the top', tune: { drape: 9 } },
  medium: { label: 'Medium', hint: 'As it hangs now', tune: {} },
  full: { label: 'Full', hint: 'A deep fold over the cover', tune: { drape: 26 } },
};

/** The Weave (thread count): the tulle's density and opacity (the look's `weave`, 50 = the locked weave). */
export const VEIL_WEAVES: Preset<VeilWeave> = {
  fine: { label: 'Fine', hint: 'Sheerer, finer threads', tune: { weave: 20 } },
  medium: { label: 'Medium', hint: 'As it is woven now', tune: {} },
  dense: { label: 'Dense', hint: 'Fuller, more veiled', tune: { weave: 85 } },
};

/** The Wind: its speed (`wind`) and its randomness (`gust`) together. Breeze is the house sway — nothing stored. */
export const VEIL_WINDS: Preset<VeilWind> = {
  still: { label: 'Still', hint: 'The veil hangs calm', tune: { wind: 0, gust: 0 } },
  breeze: { label: 'Breeze', hint: 'A gentle, even sway', tune: {} },
  gusty: { label: 'Gusty', hint: 'Quicker, in uneven gusts', tune: { wind: 80, gust: 100 } },
};

export const VEIL_FOLD_ORDER: readonly VeilFold[] = ['light', 'medium', 'full'];
export const VEIL_WEAVE_ORDER: readonly VeilWeave[] = ['fine', 'medium', 'dense'];
export const VEIL_WIND_ORDER: readonly VeilWind[] = ['still', 'breeze', 'gusty'];

/** Every tune key a choice owns — a pick clears all of its row's keys, then lays its own. */
const FOLD_KEYS: readonly RevealTuneKey[] = ['drape'];
const WEAVE_KEYS: readonly RevealTuneKey[] = ['weave'];
const WIND_KEYS: readonly RevealTuneKey[] = ['wind', 'gust'];

function which<K extends string>(presets: Preset<K>, order: readonly K[], tune: RevealTune | undefined, fallback: K): K {
  const t = tune ?? {};
  for (const k of order) {
    const want = Object.entries(presets[k].tune) as [RevealTuneKey, number][];
    if (want.length > 0 && want.every(([key, v]) => t[key] === v)) return k;
  }
  /* Nothing of this row stored (or a value no preset carries — an older slider's): the middle, today's veil. */
  return fallback;
}

export const veilFoldOf = (e: Pick<RevealEffects, 'tune'>): VeilFold => which(VEIL_FOLDS, VEIL_FOLD_ORDER, e.tune, 'medium');
export const veilWeaveOf = (e: Pick<RevealEffects, 'tune'>): VeilWeave => which(VEIL_WEAVES, VEIL_WEAVE_ORDER, e.tune, 'medium');
export const veilWindOf = (e: Pick<RevealEffects, 'tune'>): VeilWind => which(VEIL_WINDS, VEIL_WIND_ORDER, e.tune, 'breeze');

/** The effects with one row's preset laid in: that row's keys cleared, its own set; an empty tune is dropped. */
function withPreset(effects: RevealEffects, keys: readonly RevealTuneKey[], tune: RevealTune): RevealEffects {
  const next: RevealTune = { ...(effects.tune ?? {}) };
  for (const k of keys) delete next[k];
  Object.assign(next, tune);
  const { tune: _old, ...rest } = effects;
  void _old;
  return Object.keys(next).length > 0 ? { ...rest, tune: next } : rest;
}

export const withVeilFold = (e: RevealEffects, f: VeilFold): RevealEffects => withPreset(e, FOLD_KEYS, VEIL_FOLDS[f].tune);
export const withVeilWeave = (e: RevealEffects, w: VeilWeave): RevealEffects => withPreset(e, WEAVE_KEYS, VEIL_WEAVES[w].tune);
export const withVeilWind = (e: RevealEffects, w: VeilWind): RevealEffects => withPreset(e, WIND_KEYS, VEIL_WINDS[w].tune);

/* ── the cloth's side (`veil-reveal.tsx`) — pure, so the guard runs them without WebGL ── */

/**
 * 🧵 The valance the LIFTED veil folds to. The kept drape (the Event Hub's) hangs at the look's `drape` — the house
 * value (`DRAPE_VALANCE`, `house`), or the couple's Fold ▾ (owner 2026-10-17, *"fold coverage"*, `lib/veil-style.ts`). A Fold the couple
 * CHOSE is the fold wherever the veil lifts — the Save the Date's and the Maker's ▶ too — so the preview shows the
 * fold they picked; untouched, the veil that does not stay keeps the locked `topValance`, exactly as before.
 */
export function liftedValance(cfg: Pick<VeilLook, 'drape' | 'topValance'>, keepsOpen: boolean, house: number): number {
  return keepsOpen || cfg.drape !== house ? cfg.drape : cfg.topValance;
}
/**
 * 🧵 The tulle's weave for the couple's Weave ▾ (`weave` 0–100). 50 is the locked weave to the digit — a `#242424`
 * ground (≈14 % of the colour shows through the material's 0.92), threads every 12 px at 5.5 % white — so an event that
 * never chose one is drawn exactly as before. Finer → a fainter ground and wider-set threads (sheerer); denser → a
 * heavier ground and closer threads (more veiled).
 */
export function weaveOf(weave: number): { ground: string; thread: string; pitch: number } {
  if (weave === 50) return { ground: '#242424', thread: 'rgba(255,255,255,0.055)', pitch: 12 };
  const f = Math.pow(2, (weave - 50) / 25);
  const g = Math.max(4, Math.min(140, Math.round(36 * f)));
  const hx = g.toString(16).padStart(2, '0');
  const alpha = Math.min(0.2, 0.055 * Math.sqrt(f));
  const pitch = Math.max(6, Math.min(20, Math.round(12 / Math.sqrt(f))));
  return { ground: `#${hx}${hx}${hx}`, thread: `rgba(255,255,255,${alpha.toFixed(3)})`, pitch };
}
