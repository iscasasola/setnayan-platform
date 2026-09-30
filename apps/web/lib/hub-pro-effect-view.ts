import type { HubProEffect } from '@/lib/hub-pro-effects';

/**
 * 💎 THE APPLY SHEET'S CLIENT HALF — an effect's one line, the view that crosses
 * to the client, and the "Unlock Pro and Apply" return.
 *
 * Split from `lib/hub-pro-effects.ts` (2026-09-29, the Maker JS budget): the
 * Apply bar and sheet (on the Maker's first screen) import only these, and
 * importing them from the list builder pulled the builder's whole world — the
 * hub draft's plan, the scene templates, Post Event's presets — into the
 * Maker's first-load JavaScript. `hub-pro-effects.ts` re-exports every name, so
 * a server caller is unchanged.
 *
 * Pure. No I/O. Client-safe.
 */

/** One line per effect — "Font · Names on the Hero". */
export function hubProEffectLine(e: Pick<HubProEffect, 'what' | 'where'>): string {
  return `${e.what} · ${e.where}`;
}

/** What crosses to the client: the effect without its patch (the server recomputes that). */
export type HubProEffectView = Omit<HubProEffect, 'remove'> & { removable: boolean };

/* ── "UNLOCK PRO AND APPLY" — THE RETURN FROM THE PURCHASE ─────────────────
   Owner 2026-09-28, verbatim, naming the Apply sheet's first button: "Unlock
   Pro and Apply". It goes through the ONE purchase page and asks it to come
   back to the Maker with `?apply=1` (`UNLOCK_AND_APPLY_PARAM`). Back in the
   Maker, this decides — once — what happens: */

/** The purchase page's way back asks the Maker to finish the Apply. */
export const UNLOCK_AND_APPLY_PARAM = 'apply';

/**
 * Back from the purchase:
 *   · 'apply' — Pro is now active (the bar names no Pro effect) and the draft
 *     has changes → press Apply for them, no second tap;
 *   · 'sheet' — still no Pro (cancelled, or the payment is under review) → the
 *     sheet again, the draft untouched, NOTHING applied;
 *   · 'none'  — not a return, or nothing left to apply.
 * The server's Apply is still the gate either way (`lookProAllows`): even a
 * wrong 'apply' here could never publish a Pro effect for a couple without Pro.
 */
export function unlockAndApplyOnReturn(input: {
  asked: boolean;
  proEffects: number;
  hasChanges: boolean;
  storeShell: boolean;
}): 'apply' | 'sheet' | 'none' {
  if (!input.asked || input.storeShell || !input.hasChanges) return 'none';
  return input.proEffects > 0 ? 'sheet' : 'apply';
}

/** The purchase page's address from the Apply sheet: it returns to the Maker to finish the Apply. */
export function unlockAndApplyHref(proHref: string): string {
  return `${proHref}${proHref.includes('?') ? '&' : '?'}then=apply`;
}
