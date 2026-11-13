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
 * 🔒 NO EMAIL DETAIL. The couple's `contact_email` is not a detail the supplier is asked to confirm. The only email box
 * is the ACCOUNT slide's "Continue with Email" (owner 7 Nov: "Yes"), beside Google and Apple; the shop's contact email
 * is the signed-in account's email, never a typed one.
 *
 * 🎁 SETNAYAN'S OWN INVITE uses the same door (owner 7 Nov: "yes" — `vendor_invites.source = 'admin'`, the personal
 * invite with "Your offer"). Its record comes from the invite and the shop the admin staged, never from a couple; it
 * carries the offer, which the shipped `claim_ready_the_invited_shop` applies on the finish.
 */

import { PAY_WAY_PROVIDERS } from './self-added-pay-ways';
import type { SelfAddedBasis } from './self-added-price-basis';

/** The ONE place a claim link points — a couple's and Setnayan's own. `/signup?as=vendor` is never a claim link again. */
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

/** The personal invite's **Your offer** rows, exactly as the claim page draws them (`doorOffer`). */
export type ClaimDoorOffer = {
  plan: { word: string; until: string } | null;
  photos: number | null;
  fee: string;
  note: string | null;
};

export type ClaimDoorRecord = {
  token: string;
  /**
   * WHO made the link: `couple` (a couple's QR / link / emailed invite — `couple` · `auto_share_link`) or `setnayan`
   * (the admin's personal invite). Setnayan's door has no event, no booking and no couple to "see yours", so its words
   * say "the Setnayan team", it has no bundle slide (nothing was booked), and it shows the offer.
   */
  from: 'couple' | 'setnayan';
  /** Setnayan's invite only: the offer rows, or null (a couple's link never carries one — a DB CHECK says so). */
  offer: ClaimDoorOffer | null;
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
  /**
   * The address the invite was sent to (`vendor_invites.email`), else the couple's record (`event_vendors.contact_email`)
   * — pre-fills ONLY the account slide's "Continue with Email" box (owner 7 Nov: "Yes" to Email on the claim door). Never a
   * detail to tick, never written to the shop: the shop's contact email is the signed-in account's.
   */
  inviteEmail: string | null;
  services: ClaimDoorService[];
  /** The price the couple confirmed for the whole booking — the bundle price. */
  price: number | null;
  inclusions: string[];
  plan: ClaimDoorPayment[];
  /**
   * 🧾 How the couple said the price works (v2, owner 2026-11-13) — the invite's own row's `pricing_basis` — and the
   * guests / hours they agreed (`pax_quote_base` / `agreed_hours`). Absent = One price (Setnayan's invite, a lab).
   */
  priceBasis?: SelfAddedBasis;
  agreedCount?: number | null;
  /** 🏦 How the couple recorded paying them (`event_manual_vendors.pay_ways`) — confirmed or fixed on the door. */
  payWays?: ClaimDoorPayWay[];
};

/** One way to pay, as the couple recorded it, for the supplier to confirm (the QR presigned for the door). */
export type ClaimDoorPayWay = {
  provider: string | null;
  accountName: string | null;
  accountNumber: string | null;
  qrUrl: string | null;
  /** The older free-text way (before account fields) — shown, never posted. */
  details: string | null;
};

/**
 * 🧾 A card's pricing as the supplier confirmed it on the door — the Card Maker's own fields (`pricing-basis-editor.tsx`):
 * One price → From (`card.price`) + Extras · Per guest → `per_pax_price_php` + `min_pax` · Per hour → `min_hours` +
 * `hour_base_php` + `extra_hour_php`.
 */
export type ClaimCardPricing = {
  basis: SelfAddedBasis;
  perPax: number | null;
  minPax: number | null;
  minHours: number | null;
  hourBase: number | null;
  extraHour: number | null;
  extras: { name: string; price: number | null }[];
};

export const CLAIM_EXTRAS_MAX = 12;

/** Per hour, the price for each extra hour is the supplier's to set — the door asks for it (v2: required). */
export function claimPricingMissing(p: ClaimCardPricing | undefined): 'extra_hour' | null {
  return p?.basis === 'per_hour' && !(p.extraHour != null && p.extraHour > 0) ? 'extra_hour' : null;
}

/**
 * The fields the SHIPPED card maker (`createVendorService`) reads, for one door card — or null when the card carries
 * no price to make it with (it is then not made, as before). Extras ride as the maker's own add-on rows.
 */
export function claimCardServiceFields(card: { price: number | null; pricing?: ClaimCardPricing }): Array<[string, string]> | null {
  const p = card.pricing;
  const out: Array<[string, string]> = [];
  if (p?.basis === 'per_pax') {
    if (!p.perPax) return null;
    out.push(['pricing_basis', 'per_pax'], ['per_pax_price_php', String(p.perPax)]);
    if (p.minPax) out.push(['min_pax', String(p.minPax)]);
  } else if (p?.basis === 'per_hour') {
    if (!p.hourBase) return null;
    out.push(['pricing_basis', 'per_hour'], ['hour_base_php', String(p.hourBase)]);
    if (p.minHours) out.push(['min_hours', String(p.minHours)]);
    if (p.extraHour) out.push(['extra_hour_php', String(p.extraHour)]);
  } else {
    if (!card.price) return null;
    out.push(['pricing_basis', 'fixed'], ['starting_price_php', String(card.price)]);
  }
  const extras = (p?.extras ?? []).filter((x) => x.name.trim()).slice(0, CLAIM_EXTRAS_MAX);
  if (extras.length) {
    out.push(['addons_present', '1']);
    for (const x of extras) out.push(['addon_label', x.name.trim()], ['addon_price', x.price != null ? String(x.price) : '']);
  }
  return out;
}

/** One way the supplier confirmed on the door: kept (as fixed), or left off. `keepQr` keeps the couple's QR picture. */
export type ClaimDoorPayAnswer = { keep: boolean; provider: string | null; accountName: string; accountNumber: string; keepQr: boolean };

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
      : // Bundled only onto a price that exists (the same rule as the door's `syncCards`) — with no confirmed price
        // (Setnayan's invite, or a couple who set none) each card is priced on its own.
        { service: i, name: s.label, price: r.price ? null : s.price, inclusions: r.price ? [] : [...s.inclusions], bundled: !!r.price },
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
  /** One per service, in order. `fromRecord` = a service the couple recorded (the door's claim — the server re-checks it). */
  cards: {
    name: string;
    category: string;
    leaf: string | null;
    price: number | null;
    inclusions: string[];
    bundled: boolean;
    fromRecord: boolean;
    pricing?: ClaimCardPricing;
  }[];
  bundle: { name: string; extras: string[] } | null;
  specialties: Record<string, Record<string, string[]>>;
  /**
   * The details slide's "Price" — the ONE bundle price the couple confirmed, as the supplier states it (null = blank).
   * The server compares it with the couple's recorded price read on the server; a difference is the couple's to approve
   * (`lib/supplier-purchase-change.ts`).
   */
  price: number | null;
  /** In the record's order (`ClaimDoorRecord.payWays`) — the server re-reads the record and pairs them by index. */
  payWays?: ClaimDoorPayAnswer[];
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
    const pr = (o.pricing ?? null) as Record<string, unknown> | null;
    const basis = pr && (pr.basis === 'per_pax' || pr.basis === 'per_hour' || pr.basis === 'fixed') ? (pr.basis as SelfAddedBasis) : null;
    const hours = (v: unknown) => {
      const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.]/g, ''));
      return Number.isFinite(n) && n > 0 && n <= 999 ? Math.round(n * 2) / 2 : null;
    };
    const pricing: ClaimCardPricing | undefined = basis
      ? {
          basis,
          perPax: num(pr!.perPax),
          minPax: num(pr!.minPax),
          minHours: hours(pr!.minHours),
          hourBase: num(pr!.hourBase),
          extraHour: num(pr!.extraHour),
          extras: (Array.isArray(pr!.extras) ? pr!.extras : []).slice(0, CLAIM_EXTRAS_MAX).flatMap((x) => {
            const e = (x ?? {}) as Record<string, unknown>;
            const name = str(e.name, 80);
            return name ? [{ name, price: num(e.price) }] : [];
          }),
        }
      : undefined;
    return [
      {
        name: str(o.name, 80),
        category,
        leaf,
        price: num(o.price),
        inclusions: lines(o.inclusions),
        bundled: o.bundled === true,
        fromRecord: o.fromRecord === true,
        ...(pricing ? { pricing } : {}),
      },
    ];
  });
  const payWays = (Array.isArray(d.payWays) ? d.payWays : []).slice(0, 8).map((x) => {
    const w = (x ?? {}) as Record<string, unknown>;
    const provider = typeof w.provider === 'string' && PAY_WAY_PROVIDERS.includes(w.provider) ? w.provider : null;
    return { keep: w.keep !== false, provider, accountName: str(w.accountName, 96), accountNumber: str(w.accountNumber, 64), keepQr: w.keepQr === true };
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
    price: num(d.price),
    ...(payWays.length ? { payWays } : {}),
  };
}

/**
 * 🔒 THE COUPLE'S BUNDLE IS THE COUPLE'S RECORD (owner 2026-11-07: *"on the sign up the supplier can add more services
 * but not add them to the customers bundle"* — DECISION_LOG "ON THE CLAIM DOOR THE SUPPLIER MAY ADD MORE SERVICES TO
 * THEIR SHOP, BUT NEVER INTO THE COUPLE'S BUNDLE").
 *
 * Splits the posted cards into:
 *   · `theirs` — the services the couple recorded, which make up the couple's bundle (at their confirmed price, plus
 *     the couple's own extra lines);
 *   · `added`  — services the supplier added on the door: each becomes its own service card on the shop, priced on
 *     its own — NEVER bundled, never in the bundle, never in the package saved for that couple.
 *
 * A card counts as the couple's only when the door says so (`fromRecord`) AND its category is one the couple actually
 * recorded — `recordedCategories` is read on the server (`readClaimDoor`), never taken from the post. Anything else is
 * the supplier's own, and its `bundled` is forced off whatever was posted.
 */
export function splitClaimCards<C extends { category: string; bundled: boolean; fromRecord: boolean }>(
  cards: readonly C[],
  recordedCategories: ReadonlySet<string>,
): { theirs: C[]; added: C[] } {
  const theirs: C[] = [];
  const added: C[] = [];
  for (const c of cards) {
    if (c.fromRecord && recordedCategories.has(c.category)) theirs.push(c);
    else added.push({ ...c, bundled: false });
  }
  return { theirs, added };
}
