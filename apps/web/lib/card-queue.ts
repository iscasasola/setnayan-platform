/**
 * lib/card-queue.ts — ➕ "MAKE N CARDS" (ruling 5820, the ONE Add-a-service picker).
 *
 * The dashboard's Add a service lets a supplier pick several services, then press "Make N cards". That opens the
 * SHIPPED Card Maker for the first one (`/vendor-dashboard/services/new/<service>`, the kind fixed by the address) with
 * the rest on the address (`?then=a,b`). The maker posts them back (`card_queue`); a successful CREATE goes straight on
 * to the next service's maker, and the last one lands where a card always lands. A refusal stays on the same card with
 * the queue kept. Nothing is written for a card the supplier has not made — no draft rows, no invented prices.
 *
 * 🔒 Every key is shape-checked (the same `[a-z0-9_]` shape the maker's `return_to` allowlist accepts), de-duplicated
 * and capped — never an open redirect, never a path segment someone typed. PURE. 🔒 lib/card-queue.test.ts
 */

/** The query key the maker is opened with: the services still to make after this one. */
export const CARD_QUEUE_PARAM = 'then';
/** The hidden field the maker posts it in. */
export const CARD_QUEUE_FIELD = 'card_queue';
/** Most cards one press queues — more than any plan's per-press need, small enough that the address stays short. */
export const CARD_QUEUE_MAX = 12;

const KEY = /^[a-z0-9_]{1,64}$/;

/** The queue on an address or in a form — only well-shaped service keys, in order, once each, at most `CARD_QUEUE_MAX`. */
export function parseCardQueue(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 1200) return [];
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const k = part.trim();
    if (KEY.test(k) && !out.includes(k)) out.push(k);
    if (out.length === CARD_QUEUE_MAX) break;
  }
  return out;
}

/**
 * 🏷 SPECIALTIES TRAVEL WITH THEIR SERVICE (prototype `makers_match_2026-11-07` §2: "+ Specialties (optional)" under
 * EACH service). `{ service: { field: [values] } }` — keyed by service, never one set for the shop. Picked in the
 * picker, carried on the address (`sp`) and in the maker's form (`card_specialties`) next to the queue, and only
 * PRE-TICKED on that service's own card: nothing is written until the supplier saves the card, and the save merges
 * them through the one refinement merge, which re-validates every key and value against the live schema.
 */
export const CARD_SPECIALTIES_PARAM = 'sp';
export const CARD_SPECIALTIES_FIELD = 'card_specialties';
export type CardSpecialties = Record<string, Record<string, string[]>>;
const MAX_SPECIALTIES_CHARS = 4000;

/** The carried specialties — shape-checked, only for well-shaped service keys, and only for `keys` when given. */
export function parseCardSpecialties(raw: unknown, keys?: readonly string[]): CardSpecialties {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_SPECIALTIES_CHARS) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const allow = keys ? new Set(keys) : null;
  const out: CardSpecialties = {};
  for (const [svc, fields] of Object.entries(data as Record<string, unknown>).slice(0, CARD_QUEUE_MAX + 1)) {
    if (!KEY.test(svc) || (allow && !allow.has(svc))) continue;
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) continue;
    const kept: Record<string, string[]> = {};
    for (const [field, vals] of Object.entries(fields as Record<string, unknown>).slice(0, 32)) {
      if (!KEY.test(field) || !Array.isArray(vals)) continue;
      const v = vals.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 128).slice(0, 64);
      if (v.length) kept[field] = v;
    }
    if (Object.keys(kept).length) out[svc] = kept;
  }
  return out;
}

/** The specialties as the address / form carries them — only the services still to make; '' when none. */
export function encodeCardSpecialties(picks: CardSpecialties, keys: readonly string[]): string {
  const kept = parseCardSpecialties(JSON.stringify(picks), keys);
  if (Object.keys(kept).length === 0) return '';
  const raw = JSON.stringify(kept);
  return raw.length > MAX_SPECIALTIES_CHARS ? '' : raw;
}

/**
 * One service's carried picks as its Details fold's starting values, over what the shop already saved for it — only
 * fields and options its own schema has (multi → list · enum → one value · boolean → true).
 */
export function specialtiesAsInitial(
  fields: Record<string, { type?: string; options?: readonly string[] | null }>,
  saved: Record<string, unknown>,
  picks: Record<string, string[]> | undefined,
): Record<string, unknown> {
  if (!picks) return saved;
  const out: Record<string, unknown> = { ...saved };
  for (const [key, values] of Object.entries(picks)) {
    const def = fields[key];
    if (!def) continue;
    if (def.type === 'boolean') {
      if (values.includes('true')) out[key] = true;
      continue;
    }
    const ok = values.filter((v) => (def.options ?? []).includes(v));
    if (ok.length === 0) continue;
    if (def.type === 'enum') out[key] = ok[0];
    else {
      const prior = Array.isArray(saved[key]) ? (saved[key] as unknown[]).filter((x): x is string => typeof x === 'string') : [];
      out[key] = Array.from(new Set([...prior, ...ok]));
    }
  }
  return out;
}

/**
 * The Card Maker for the first of `keys`, the rest queued behind it — null when there is nothing to make. The
 * specialties picked for these services ride along (`sp`), each one only for its own service.
 */
export function cardMakerQueueHref(keys: readonly string[], specialties: CardSpecialties = {}): string | null {
  const clean = parseCardQueue(keys.join(','));
  const [first, ...rest] = clean;
  if (!first) return null;
  const base = `/vendor-dashboard/services/new/${first}`;
  const q: string[] = [];
  if (rest.length > 0) q.push(`${CARD_QUEUE_PARAM}=${rest.join(',')}`);
  const sp = encodeCardSpecialties(specialties, clean);
  if (sp) q.push(`${CARD_SPECIALTIES_PARAM}=${encodeURIComponent(sp)}`);
  return q.length > 0 ? `${base}?${q.join('&')}` : base;
}

/** The words over a queued maker: "2 more after this: Lights, Sound" — null when nothing waits. */
export function cardQueueLine(rest: readonly string[], labelOf: (key: string) => string): string | null {
  if (rest.length === 0) return null;
  return `${rest.length} more after this: ${rest.map(labelOf).join(', ')}`;
}
