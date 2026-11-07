/**
 * 🔗 THE CLAIM DOOR — a supplier the couple added by hand joins through `/open-shop`, pre-filled (owner 2026-11-06,
 * DECISION_LOG "A SUPPLIER WHO JOINS FROM A COUPLE'S QR / LINK GOES THROUGH THE SAME DOOR, PRE-FILLED"; the slides are
 * v21's, `prototypes/open_shop_redesign_2026-11-06/open-shop-redesign-v21.html` `Q_ORDER`).
 *
 * Pure: the address every claim link points at, the shape of the couple's record as the door reads it, and the
 * seeds the slides start from. The I/O is `lib/claim-door.server.ts`; the screens are
 * `app/open-shop/_components/claim-door.tsx`; the finish is `app/open-shop/claim-actions.ts`, which hands the
 * consent to the SHIPPED `/vendor/claim/<token>/finalize` — only the screens changed.
 *
 * 🔒 NO EMAIL FIELD. The couple's `contact_email` is not a detail the supplier is asked to confirm, and the door has
 * no email box: the account's email comes from signing in (Google · Apple · an existing account), and the shop's
 * contact email is that account email (controller, A6, 7 Nov).
 */

/** The ONE place a couple-made claim link points. `/signup?as=vendor` is never a claim link again. */
export const CLAIM_DOOR_PARAM = 'claim';
export function claimDoorHref(token: string): string {
  return `/open-shop?${CLAIM_DOOR_PARAM}=${encodeURIComponent(token)}`;
}

/** One service the couple filed under this supplier (one `event_vendors` row of the manual contact card). */
export type ClaimDoorService = {
  /** `event_vendors.category` — the coarse service the shop row has always been filled with. */
  category: string;
  /** `event_vendors.category_key` — the Admin › Categories tile, when the couple's form recorded one. */
  tileId: string | null;
  label: string;
  /** `event_vendors.total_cost_php`, the price the couple recorded for this row. */
  price: number | null;
  /** `event_vendors.host_inclusions`, what the couple recorded as included. */
  inclusions: string[];
};

export type ClaimDoorPayment = { label: string; due: string | null; amount: number };

export type ClaimDoorRecord = {
  token: string;
  /** First names only (`inviterFirstNames`), never a surname. */
  inviterName: string;
  /** 'couple' · 'family' · 'host' — WHO sent it, for the eyebrow. */
  hostNoun: string;
  eventWord: string;
  /** The event's own type key (`events.event_type`) — ticked on the shop's events. */
  eventType: string | null;
  /** "on 12 December 2026" / "in December 2026" — as precise as the couple set it, else null. */
  datePhrase: string | null;
  business: string;
  contactPerson: string | null;
  contactPhone: string | null;
  services: ClaimDoorService[];
  /** The price the couple confirmed for the whole booking — the bundle price. */
  price: number | null;
  inclusions: string[];
  plan: ClaimDoorPayment[];
};

/** The details slide 2 lists, in the prototype's order (`DETAILS`). Email is not one of them — see above. */
export const CLAIM_DETAIL_KEYS = ['name', 'who', 'phone', 'service', 'price', 'incl', 'plan'] as const;
export type ClaimDetailKey = (typeof CLAIM_DETAIL_KEYS)[number];

export const CLAIM_DETAIL_LABEL: Record<ClaimDetailKey, string> = {
  name: 'Shop name',
  who: 'Contact person',
  phone: 'Contact number',
  service: 'Services',
  price: 'Price',
  incl: 'What’s included',
  plan: 'Payment plan',
};

/** The details the couple actually recorded — a blank one is not a row to tick (it is asked later, if at all). */
export function claimDetailKeysOf(r: ClaimDoorRecord): ClaimDetailKey[] {
  return CLAIM_DETAIL_KEYS.filter((k) => {
    switch (k) {
      case 'name':
        return true; // the invite always carries the business name
      case 'who':
        return !!r.contactPerson;
      case 'phone':
        return !!r.contactPhone;
      case 'service':
        return r.services.length > 0;
      case 'price':
        return (r.price ?? 0) > 0;
      case 'incl':
        return r.inclusions.length > 0;
      case 'plan':
        return r.plan.length > 0;
    }
  });
}

/** One service card slide's starting state (prototype v21 `qPrefill`). */
export type ClaimCardSeed = {
  /** Which record service this card is for (its index in `services`). */
  service: number;
  name: string;
  price: number | null;
  inclusions: string[];
  /** Part of the confirmed bundle, priced on the first card — carries no price of its own until split. */
  bundled: boolean;
};

/**
 * v21 (owner 7 Nov: *"they already confirmed … so why show this still?"*): one card per imported service. ONE service
 * carries the whole confirmed price and every line. SEVERAL: the first carries them, the rest are part of that bundle
 * until the supplier prices one on its own.
 */
export function seedClaimCards(r: Pick<ClaimDoorRecord, 'services' | 'price' | 'inclusions'>): ClaimCardSeed[] {
  return r.services.map((s, i) =>
    i === 0
      ? { service: i, name: s.label, price: r.price ?? s.price, inclusions: r.inclusions.length ? [...r.inclusions] : [...s.inclusions], bundled: false }
      : { service: i, name: s.label, price: null, inclusions: [], bundled: true },
  );
}

/** "Photographer & Photo booth" — the bundle's name, written for them (prototype `seedBundle`). */
export function seedBundleName(labels: readonly string[]): string {
  const s = labels.filter(Boolean);
  if (s.length <= 1) return s[0] ?? '';
  return `${s.slice(0, -1).join(', ')} & ${s[s.length - 1]}`;
}

/** The draft the door keeps in this browser while the supplier signs in (Google / Apple leave the page). */
export function claimDraftKey(token: string): string {
  return `setnayan:claim-door:${token}`;
}

/** The hidden field the finish posts the slides' answers in. */
export const CLAIM_DOOR_FIELD = 'claim_door';

export type ClaimDoorAnswers = {
  name: string;
  who: string;
  phone: string;
  role: string;
  /** Picked services: a record service (by category) or a leaf the supplier added. */
  services: { category: string; leaf: string | null; label: string; fromRecord: boolean }[];
  cards: { name: string; category: string; leaf: string | null; price: number | null; inclusions: string[]; bundled: boolean }[];
  bundle: { name: string; extras: string[] } | null;
  specialties: Record<string, Record<string, string[]>>;
};

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};
const lines = (v: unknown) =>
  (Array.isArray(v) ? v : []).map((x) => str(x, 80)).filter(Boolean).slice(0, 40);

/** The posted answers, re-read defensively (a hand-rolled POST gets only well-shaped values through). */
export function parseClaimDoorAnswers(raw: unknown): ClaimDoorAnswers | null {
  if (typeof raw !== 'string' || raw.length > 60_000) return null;
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const services = (Array.isArray(d.services) ? d.services : []).slice(0, 25).flatMap((s) => {
    const o = (s ?? {}) as Record<string, unknown>;
    const category = str(o.category, 64);
    const leaf = str(o.leaf, 96) || null;
    if (!category && !leaf) return [];
    return [{ category, leaf, label: str(o.label, 80) || category, fromRecord: o.fromRecord === true }];
  });
  const cards = (Array.isArray(d.cards) ? d.cards : []).slice(0, 25).flatMap((c) => {
    const o = (c ?? {}) as Record<string, unknown>;
    const category = str(o.category, 64);
    const leaf = str(o.leaf, 96) || null;
    if (!category && !leaf) return [];
    return [{ name: str(o.name, 80), category, leaf, price: num(o.price), inclusions: lines(o.inclusions), bundled: o.bundled === true }];
  });
  const b = d.bundle as Record<string, unknown> | null | undefined;
  const specialties: ClaimDoorAnswers['specialties'] = {};
  const sp = d.specialties;
  if (sp && typeof sp === 'object' && !Array.isArray(sp)) {
    for (const [svc, fields] of Object.entries(sp as Record<string, unknown>).slice(0, 25)) {
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) continue;
      const kept: Record<string, string[]> = {};
      for (const [k, vals] of Object.entries(fields as Record<string, unknown>).slice(0, 32)) {
        const v = lines(vals);
        if (v.length) kept[str(k, 64)] = v;
      }
      if (Object.keys(kept).length) specialties[str(svc, 96)] = kept;
    }
  }
  return {
    name: str(d.name, 50),
    who: str(d.who, 80),
    phone: str(d.phone, 32),
    role: str(d.role, 64),
    services,
    cards,
    bundle: b && typeof b === 'object' ? { name: str(b.name, 120), extras: lines(b.extras) } : null,
    specialties,
  };
}
