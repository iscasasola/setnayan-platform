/**
 * 👗 gown/body/refit — the designer's tape re-fits the mannequin (prototype v206 `refitTo`, v175). Women only.
 *
 * Her real lengths re-fit the mannequin's proportions; the limits and the hem follow. Waist to floor (or else nape to
 * waist) re-fits her legs and torso; shoulder to bust point re-fits the bust position. Each is a bisection on the solved,
 * posed body: standing straight, in her shoes and gown, exactly as the tape was taken. The other tape numbers are kept
 * for the pattern (the mannequin's shape doesn't change for them). Exported for the designer's "Open on the mannequin".
 */
import { GOWN_MEASURES, type GownMeasureKey } from '../../gown-config';
import { gownLimit } from '../body-rules';
import type { GownBodyEstimates } from './estimate';
import type { GownRig } from './rig';

export type GownTape = Partial<Record<GownMeasureKey, number>>;
export type GownRefit = {
  /** The lines the designer reads, word for word as v175. */
  lines: string[];
  /** Fine-tune values the re-fit set (the stage marks them as hers). */
  leg?: number;
  bustT?: number;
};

/**
 * v206 `refitTo`. `look` solves her body at its current numbers, poses and dresses her standing straight, and measures
 * her (the stage's own pipeline); the re-fit sets `B.vals.leg` and `B.fine.bustT` through it.
 */
export function gownRefitTo(B: GownRig, m: GownTape, look: () => GownBodyEstimates): GownRefit {
  const out: string[] = [], res: GownRefit = { lines: out };
  const fit1 = (set: (x: number) => void, lo: number, hi: number, get: (e: GownBodyEstimates) => number, target: number) => {
    set(lo);
    let a = lo, fa = get(look());
    set(hi);
    const fb = get(look());
    if ((target - fa) * (target - fb) > 0) {
      const best = Math.abs(target - fa) < Math.abs(target - fb) ? a : hi;
      set(best);
      return { ok: false, got: get(look()) };
    }
    let b = hi;
    for (let i = 0; i < 7; i++) {
      const c = (a + b) / 2;
      set(c);
      const fc = get(look());
      if ((target - fa) * (target - fc) <= 0) b = c;
      else { a = c; fa = fc; }
    }
    set((a + b) / 2);
    return { ok: true, got: get(look()) };
  };
  const [l0, l1] = gownLimit(B.vals, 'leg'), lenKey = (m.waistFloor ?? 0) > 0 ? 'waistFloor' : (m.napeWaist ?? 0) > 0 ? 'napeWaist' : null;
  if (lenKey) {
    const r = fit1((x) => { B.vals.leg = x; }, l0, l1, (e) => e[lenKey] ?? 0, m[lenKey]!);
    res.leg = B.vals.leg;
    out.push(`${lenKey === 'waistFloor' ? 'Waist to floor' : 'Nape to waist'} ${m[lenKey]} cm: ${r.ok ? 'legs and torso re-fitted' : `the closest the mannequin allows is ${Math.round(r.got * 2) / 2} cm`}.`);
    if (lenKey === 'waistFloor' && (m.napeWaist ?? 0) > 0) {
      const nw = look().napeWaist ?? 0;
      if (Math.abs(nw - m.napeWaist!) > 2) out.push(`Nape to waist on the mannequin is now ${nw} cm (tape ${m.napeWaist} cm): check both.`);
    }
  }
  if ((m.shoulderApex ?? 0) > 0) {
    const r = fit1((t) => { B.fine.bustT = t; }, -1, 1, (e) => e.shoulderApex ?? 0, m.shoulderApex!);
    res.bustT = B.fine.bustT;
    out.push(`Shoulder to bust point ${m.shoulderApex} cm: ${r.ok ? 'bust position re-fitted' : `the closest the mannequin allows is ${r.got} cm`}.`);
  }
  look();
  const kept = (Object.keys(m) as GownMeasureKey[]).filter((k) => !['waistFloor', 'napeWaist', 'shoulderApex'].includes(k) && (m[k] ?? 0) > 0).map((k) => GOWN_MEASURES.find((g) => g.id === k)?.label ?? k);
  if (kept.length) out.push(`Kept for the pattern (the mannequin's shape doesn't change for them): ${kept.join(', ')}.`);
  if (!lenKey && !((m.shoulderApex ?? 0) > 0)) out.push('Add waist to floor, nape to waist or shoulder to bust point to re-fit her proportions.');
  return res;
}
