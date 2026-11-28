/**
 * 👗 gown/send — what the bride sends her designer (plan A10; prototype v210 `orderData`, `designSummary`): the design in
 * words, the gown's measurements the design needs (the mannequin's estimates; the designer measures her at the
 * fitting), and the payload the shop's send checks. No price ever: the shop prices it on the server.
 */
import { gownMeasuresNeeded, type GownBody, type GownConfig, type GownHand, type GownMeasures, type GownQuantities } from '../gown-config';
import type { GownBodyEstimates } from './body/estimate';
import { GOWN_CUSTOM_HEX, gownDesignSteps, gownHasCustomHex, gownPickOptions, type GownCustomColourKey } from './flow';

/** The approved privacy line (plan Q6: "Your measurements go to [shop] only."). */
export const gownSendPrivacy = (shop: string) => `Your measurements go to ${shop} only.`;

/** The design in words, one line per choice she can see (v210 `designSummary`): "Silhouette: Ball gown". */
export function gownDesignSummary(g: GownConfig, fabrics: readonly { id: string; label: string }[]): string[] {
  const out: string[] = [];
  for (const st of gownDesignSteps(g)) {
    if (st.id === 'fabric') { const f = fabrics.find((x) => x.id === g.fabric); if (f) out.push(`Fabric: ${f.label}`); continue; }
    for (const p of st.picks) {
      if (p.when && !p.when(g)) continue;
      const o = gownPickOptions(p, g).find((x) => x.id === String(g[p.key]));
      // Her own colour reads as the colour itself (v207: lace in any colour).
      const own = gownHasCustomHex(String(p.key)) && g[p.key] === 'custom' ? g[GOWN_CUSTOM_HEX[p.key as GownCustomColourKey]] : null;
      if (o) out.push(`${p.label}: ${own ? `her own colour ${own}` : o.label}`);
    }
  }
  return out;
}

/** The gown's measurements this design needs, as the mannequin estimates them (to the half cm). */
export function gownMeasuresToSend(g: GownConfig, est: GownBodyEstimates): GownMeasures {
  const out: GownMeasures = {};
  for (const k of gownMeasuresNeeded(g)) {
    const cm = est[k];
    if (cm && Number.isFinite(cm) && cm > 0) out[k] = { cm: Math.round(cm * 2) / 2, from: 'estimate' };
  }
  return out;
}

/** The send, as the shop's action takes it (`op: 'send'`). Her hand work travels beside the design, never inside it. */
export function gownSendInput(threadId: string, s: { config: GownConfig; body: GownBody; hand: GownHand; quantities: GownQuantities; estimates: GownBodyEstimates }) {
  return { op: 'send' as const, threadId, config: s.config, body: s.body, measures: gownMeasuresToSend(s.config, s.estimates), quantities: s.quantities, addOns: [] as string[], hand: s.hand };
}
