/**
 * service-card-snapshot.ts — ONE definition of "what this card looks like to a
 * couple", read from a form OR from a stored row.
 *
 * ── WHY IT MOVED OUT OF THE PREVIEW COMPONENT (owner, 2026-09-08) ──────────
 * *"we want to show the actual service cards."* The vendor's card LIST showed a
 * grey wrench glyph, a title and one line of text, while the real card — cover,
 * discount badge, inclusions, the Exclusive teaser — existed only inside the
 * collapsed "Edit details" editor. The instruction this file's original
 * docblock already carried, *"when we create a service card, we want to see the
 * exact card"*, had reached the editor and never the list.
 *
 * 🔑 THE LIST BUILDS ITS SNAPSHOT THROUGH `readSnapshot`, NOT ALONGSIDE IT.
 * `snapshotFromService` assembles a FormData with the same field names the
 * editor posts and hands it to the very same reader. That is deliberate: a
 * second implementation of "from ₱X", of which discount wins, of what counts as
 * not-included, would agree on the day it was written and drift by the first
 * pricing change. There is one implementation and the list is a caller of it.
 *
 * Pure: no React, no I/O, no `server-only` — a server component and a client
 * component both import it.
 */

export type Snapshot = {
  name: string;
  priceText: string;
  discountBadge: string | null;
  includesLine: string | null;
  notIncluded: string[];
  /**
   * The card SAYS it includes something extra, through the retired free-text
   * field. Kept because two live cards still promise through it — see
   * `givesSetnayanGift` for why the two are not one boolean.
   */
  hasExclusive: boolean;
  /**
   * The supplier said YES to the Setnayan gift — Papic credits, sized from the
   * booking fee (owner 2026-09-09). Deliberately SEPARATE from `hasExclusive`:
   * that one is prose a supplier typed, this one is a promise Setnayan bills
   * them for, and collapsing them would put a costed promise on two live cards
   * whose owners never made it.
   */
  givesSetnayanGift: boolean;
  hasCover: boolean;
};

function num(v: FormDataEntryValue | null | undefined): number | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(/[^0-9.]/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
export function php(n: number): string {
  return `₱${Math.round(n).toLocaleString('en-PH')}`;
}

const DISCOUNT_LABEL: Record<string, string> = {
  early_booking: 'Early booking',
  off_peak: 'Off-peak',
  bundle: 'Bundle',
  promo: 'Promo',
  returning: 'Returning couple',
};

export function readSnapshot(fd: FormData): Snapshot {
  const name = String(fd.get('title') ?? '').trim() || 'Untitled service';
  const basis = String(fd.get('pricing_basis') ?? 'fixed');
  const isCrewMeals = String(fd.get('category') ?? '') === 'crew_meals';
  const perPaxUnit = isCrewMeals ? 'meal' : 'guest';

  // ── "from ₱X" anchor per basis (v20 priceText) ─────────────────────────
  let anchor: number | null = null;
  let priceText = 'from ₱—';
  if (basis === 'per_pax') {
    const rate = num(fd.get('per_pax_price_php'));
    const minPax = num(fd.get('min_pax'));
    if (rate != null) {
      anchor = minPax ? rate * minPax : rate;
      priceText = minPax
        ? `from ${php(rate * minPax)} · ${php(rate)}/${perPaxUnit}`
        : `from ${php(rate)} / ${perPaxUnit}`;
    }
  } else if (basis === 'per_hour') {
    const base = num(fd.get('hour_base_php'));
    const minHrs = num(fd.get('min_hours'));
    const extra = num(fd.get('extra_hour_php'));
    if (base != null) {
      anchor = base;
      priceText =
        `from ${php(base)}` +
        (minHrs ? ` · ${minHrs}-hr min` : '') +
        (extra ? ` · +${php(extra)}/hr` : '');
    }
  } else {
    const bracketPrices = fd
      .getAll('bracket_price')
      .map((v) => num(v))
      .filter((n): n is number => n != null);
    const flat = num(fd.get('starting_price_php'));
    if (bracketPrices.length) {
      anchor = Math.min(...bracketPrices);
      priceText = `from ${php(anchor)}${bracketPrices.length > 1 ? ' · by pax' : ''}`;
    } else if (flat != null) {
      anchor = flat;
      priceText = `from ${php(flat)}`;
    }
  }

  // ── Best discount (couples see the single best one) ────────────────────
  const dTypes = fd.getAll('discount_type').map(String);
  const dRates = fd.getAll('discount_rate').map((v) => num(v));
  const dUnits = fd.getAll('discount_unit').map(String);
  let best: { label: string; savings: number } | null = null;
  for (let i = 0; i < dTypes.length; i++) {
    const type = dTypes[i];
    const rate = dRates[i] ?? null;
    if (!type || rate == null || rate <= 0) continue;
    const unit = dUnits[i] === 'php' ? 'php' : 'pct';
    const savings =
      unit === 'pct' ? ((anchor ?? 0) * rate) / 100 : Math.min(rate, anchor ?? rate);
    const label = `${DISCOUNT_LABEL[type] ?? type} · ${
      unit === 'pct' ? `${rate}% off` : `−${php(rate)}`
    }`;
    if (!best || savings > best.savings) best = { label, savings };
  }

  // ── Inclusions — the FREE value story ───────────────────────────────────
  const iLabels = fd.getAll('inclusion_label').map((v) => String(v).trim());
  const iWorths = fd.getAll('inclusion_worth').map((v) => num(v));
  const incNames: string[] = [];
  let worth = 0;
  for (let i = 0; i < iLabels.length; i++) {
    const label = iLabels[i];
    if (!label) continue;
    incNames.push(label);
    worth += iWorths[i] ?? 0;
  }
  const includesLine = incNames.length
    ? `Includes: ${incNames.slice(0, 3).join(' · ')}${incNames.length > 3 ? ` +${incNames.length - 3}` : ''}${
        worth > 0 ? ` · ${php(worth)} free` : ''
      }`
    : null;

  // ── Not-included flags ──────────────────────────────────────────────────
  const notIncluded: string[] = [];
  if (!isCrewMeals && fd.get('crew_meal_included') !== 'on') notIncluded.push('crew meal');
  if (fd.get('transport_included') !== 'on') {
    const fee = num(fd.get('transport_flat_fee_php'));
    notIncluded.push(fee != null ? `transport (+${php(fee)})` : 'transport (by distance)');
  }

  return {
    name,
    priceText,
    discountBadge: best?.label ?? null,
    includesLine,
    notIncluded,
    hasExclusive: String(fd.get('exclusive_perk_text') ?? '').trim().length > 0,
    // Checkbox: `'on'` exactly, same rule as crew_meal_included below.
    givesSetnayanGift: fd.get('includes_setnayan_gift') === 'on',
    hasCover: String(fd.get('primary_photo_r2_key') ?? '').trim().length > 0,
  };
}

/** The stored shape the vendor list holds for one card. */
export type StoredServiceCard = {
  title?: string | null;
  category?: string | null;
  pricing_basis?: string | null;
  starting_price_php?: number | null;
  per_pax_price_php?: number | null;
  min_pax?: number | null;
  hour_base_php?: number | null;
  min_hours?: number | string | null;
  extra_hour_php?: number | null;
  crew_meal_included?: boolean | null;
  transport_included?: boolean | null;
  transport_flat_fee_php?: number | null;
  exclusive_perk_text?: string | null;
  includes_setnayan_gift?: boolean | null;
  primary_photo_r2_key?: string | null;
};

/** One discount row as the manager already loads it. */
export type StoredDiscount = {
  discount_type?: string | null;
  rate?: number | null;
  unit?: string | null;
};
/** One free-inclusion row as the manager already loads it. */
export type StoredInclusion = { label?: string | null; worth_php?: number | null };
/** One Fixed-basis pax bracket as the manager already loads it. */
export type StoredBracket = { price_php?: number | null };

function put(fd: FormData, key: string, value: unknown): void {
  if (value === null || value === undefined) return;
  fd.append(key, String(value));
}

/**
 * The couple-facing snapshot of a SAVED card.
 *
 * Mirrors the editor's field names exactly and then delegates — see this
 * module's header for why it must not compute any of it itself. A field the
 * caller does not pass is simply absent, which is the same thing an untouched
 * input means to `readSnapshot`.
 *
 * ⚠ `crew_meal_included` / `transport_included` are checkboxes: `readSnapshot`
 * tests them against the literal `'on'`, so a stored `true` has to be written
 * as `'on'` and a stored `false` must be OMITTED, not sent as `'false'` —
 * sending the string would read as "not on" by accident rather than by rule,
 * and it would keep reading correctly right up until someone made the check
 * truthiness-based.
 */
export function snapshotFromService(
  card: StoredServiceCard,
  extras?: {
    discounts?: readonly StoredDiscount[];
    inclusions?: readonly StoredInclusion[];
    brackets?: readonly StoredBracket[];
  },
): Snapshot {
  const fd = new FormData();
  put(fd, 'title', card.title);
  put(fd, 'category', card.category);
  put(fd, 'pricing_basis', card.pricing_basis ?? 'fixed');
  put(fd, 'starting_price_php', card.starting_price_php);
  put(fd, 'per_pax_price_php', card.per_pax_price_php);
  put(fd, 'min_pax', card.min_pax);
  put(fd, 'hour_base_php', card.hour_base_php);
  put(fd, 'min_hours', card.min_hours);
  put(fd, 'extra_hour_php', card.extra_hour_php);
  put(fd, 'transport_flat_fee_php', card.transport_flat_fee_php);
  put(fd, 'exclusive_perk_text', card.exclusive_perk_text);
  put(fd, 'primary_photo_r2_key', card.primary_photo_r2_key);
  if (card.includes_setnayan_gift) fd.append('includes_setnayan_gift', 'on');
  if (card.crew_meal_included) fd.append('crew_meal_included', 'on');
  if (card.transport_included) fd.append('transport_included', 'on');

  for (const d of extras?.discounts ?? []) {
    if (!d.discount_type || d.rate == null) continue;
    fd.append('discount_type', String(d.discount_type));
    fd.append('discount_rate', String(d.rate));
    fd.append('discount_unit', String(d.unit ?? 'pct'));
  }
  for (const inc of extras?.inclusions ?? []) {
    if (!inc.label) continue;
    fd.append('inclusion_label', String(inc.label));
    fd.append('inclusion_worth', String(inc.worth_php ?? 0));
  }
  for (const b of extras?.brackets ?? []) {
    if (b.price_php == null) continue;
    fd.append('bracket_price', String(b.price_php));
  }
  return readSnapshot(fd);
}
