/**
 * lib/hub-draft-stamp.ts — ONE NAME FOR ONE DRAFT STATE, so the Maker can prove its ↺ is the server's.
 *
 * ↺ AT ONCE (`lib/maker-drawn-undo.ts`, `lib/maker-undo-run.ts`): the Maker keeps a short list of the steps it DREW
 * itself, each with how to draw it backwards. A ↺ draws the top one at the press and sends a HELD undo — no whole-Maker
 * render, no new canvas page. That is only true while the server's newest step IS that step. Every draft answer carries
 * the stamp of the state it left (`stamp`), and the undo carries the stamp the Maker expects to find (`expect`); the
 * server always steps back ONE (one press = one step) and says whether the state it stepped back FROM was the one
 * expected (`matched`). Not matched — another tab, a write the Maker did not draw — the client falls back to the first
 * render after the undo, which is the truth (#6485).
 *
 * The stamp is of the state WITHOUT its Undo history, read the way the store reads it back (`sanitizeHubDraft` over a
 * JSON round trip — jsonb reorders keys and drops `undefined`), keys sorted. A 64-bit hash: two FNV-1a 32-bit passes
 * with different seeds, plus the length. Pure — no `node:crypto`, so the dev lab's in-browser draft door stamps the
 * same way. Never in the Maker's first load: imported by the server action and the lab's lazy engine only.
 */
import { sanitizeHubDraft, type HubDraft } from './hub-draft';

/** One spelling of a value: keys sorted, `undefined` dropped (as JSON drops it). */
export function canonicalJson(v: unknown): string {
  const sort = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(sort);
    if (x && typeof x === 'object') {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(x as Record<string, unknown>).sort()) {
        const y = (x as Record<string, unknown>)[k];
        if (y !== undefined) out[k] = sort(y);
      }
      return out;
    }
    return x;
  };
  return JSON.stringify(sort(v)) ?? 'null';
}

function fnv1a(s: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The stamp of a draft's STATE (its Undo history left out) — equal for equal states, however they were spelled. */
export function hubDraftStamp(draft: HubDraft): string {
  const read = sanitizeHubDraft(JSON.parse(JSON.stringify(draft)) as unknown);
  const { history: _history, v: _v, ...state } = read;
  const s = canonicalJson(state);
  return `${fnv1a(s, 0x811c9dc5)}${fnv1a(s, 0x01000193 ^ 0x9e3779b9)}-${s.length.toString(36)}`;
}

/**
 * ↺ The server's half of a drawn undo: did the undo step back FROM the state the Maker expected, and did it step at
 * all? (A draft with no history left answers as it is — a step the client drew but the server never took back.)
 * `expect` missing (an undo the Maker did not draw): nothing to say.
 */
export function hubDraftUndoMatched(current: HubDraft, expect: unknown): boolean | undefined {
  if (typeof expect !== 'string' || expect === '') return undefined;
  return current.history.length > 0 && hubDraftStamp(current) === expect;
}
