/**
 * lib/personal-invite-offer.ts — THE PERSONAL INVITE'S OFFER, in words. Pure: no database, no `server-only`.
 *
 * ⚖ OWNER 2026-10-23 (prototype `supplier_personal_invite_2026-10-23.html`, approved): the admin's invite to one
 * supplier can offer a plan — Solo · Pro · Ultra — free until a date, and (optionally, a switch that is off) 100
 * portfolio photos instead of the every-plan 50. RULING the same day: the 100 are the supplier's to KEEP after the
 * offer ends; only new invites stop offering them (DECISION_LOG 2026-10-23).
 *
 * The offer is written onto the invite (`vendor_invites.offer_*`) and applied when the supplier claims
 * (`claim_ready_the_invited_shop`). This file holds what the admin form accepts and what the card, the door and the
 * message SAY. Every number is read, never typed here:
 *   · plan prices — `vendor_billing_catalog` (`<tier>_vendor_monthly`), handed in; a plan with no catalogue row is
 *     named without a price, never given a guessed one;
 *   · the free booking — `FIRST_BOOKING_ON_US` (owner 2026-10-23, one booking, not five);
 *   · the launch offer — its cap from `platform_settings`, and only while `launchOfferIsOpen` says it runs;
 *   · the 100 — the owner's own number, `PERSONAL_INVITE_PHOTO_ALLOWANCE`.
 *
 * Held by `personal-invite-offer.test.ts`.
 */
import { FIRST_BOOKING_ON_US } from './booking-fee-lock';
import { formatPhp } from './php';
import { planWord } from './vendor-plan-change-words';

/** The plans an invite may give — the paid ladder (the key `enterprise` is shown as Ultra). */
export const PERSONAL_INVITE_TIERS = ['solo', 'pro', 'enterprise'] as const;
export type PersonalInviteTier = (typeof PERSONAL_INVITE_TIERS)[number];

/** The owner's number (2026-10-23: "normal is 50. we can make it 100"). The switch gives exactly this. */
export const PERSONAL_INVITE_PHOTO_ALLOWANCE = 100;

export type PersonalInviteOffer = {
  tier: PersonalInviteTier | null;
  /** `YYYY-MM-DD`, the last free day (Manila). Set exactly when `tier` is. */
  untilDay: string | null;
  /** `PERSONAL_INVITE_PHOTO_ALLOWANCE` when the switch was on, else null. */
  photos: number | null;
};

export const NO_OFFER: PersonalInviteOffer = Object.freeze({ tier: null, untilDay: null, photos: null }) as PersonalInviteOffer;

export function hasOffer(o: PersonalInviteOffer | null | undefined): o is PersonalInviteOffer {
  return Boolean(o && (o.tier || o.photos));
}

/** The last free day as the instant it ends — 23:59:59 in Manila (UTC+8 all year), so "until 31 Jan" covers the 31st. */
export function offerUntilInstant(untilDay: string): string {
  return new Date(`${untilDay}T23:59:59+08:00`).toISOString();
}

/** An instant back to its Manila day, `YYYY-MM-DD`. */
export function manilaDayOf(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t + 8 * 3_600_000).toISOString().slice(0, 10);
}

const DAY_FMT = new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const DAY_SHORT_FMT = new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "31 Jan 2027" — a Manila day, written the way the prototype writes it. */
export function offerDayWords(day: string): string {
  return DAY_FMT.format(new Date(`${day}T00:00:00Z`)).replace(/,/g, '');
}

/** "1 Feb" — the day after the last free day: the day the supplier chooses. */
export function dayAfterWords(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return DAY_SHORT_FMT.format(d).replace(/,/g, '');
}

/**
 * What the admin form posted, checked. `todayDay` is today in Manila (`YYYY-MM-DD`). A plan needs a date after
 * today; "Free · no gift" with the switch off is no offer at all (the shipped invite, unchanged).
 */
export function parsePersonalInviteOffer(
  raw: { tier: string | null; until: string | null; photos: string | null },
  todayDay: string,
): { ok: true; offer: PersonalInviteOffer } | { ok: false; message: string } {
  const tierRaw = (raw.tier ?? '').trim();
  const photos = raw.photos === 'on' || raw.photos === 'true' ? PERSONAL_INVITE_PHOTO_ALLOWANCE : null;
  if (tierRaw === '' || tierRaw === 'free') return { ok: true, offer: { tier: null, untilDay: null, photos } };
  if (!(PERSONAL_INVITE_TIERS as readonly string[]).includes(tierRaw)) {
    return { ok: false, message: 'Pick a plan from the list.' };
  }
  const until = (raw.until ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || Number.isNaN(Date.parse(`${until}T00:00:00Z`))) {
    return { ok: false, message: 'Pick the day the free plan ends.' };
  }
  if (until <= todayDay) return { ok: false, message: 'The free plan has to end after today.' };
  return { ok: true, offer: { tier: tierRaw as PersonalInviteTier, untilDay: until, photos } };
}

/** "Pro · free until 31 Jan 2027" (+ " · 100 portfolio photos") — the card's pill. Null when there is no offer. */
export function offerPill(o: PersonalInviteOffer): string | null {
  const parts: string[] = [];
  if (o.tier && o.untilDay) parts.push(`${planWord(o.tier)} · free until ${offerDayWords(o.untilDay)}`);
  if (o.photos) parts.push(`${o.photos} portfolio photos`);
  return parts.length ? parts.join(' · ') : null;
}

/** "Pro, free until 31 Jan 2027 — written when they claim." — the line under the link on the admin's result. */
export function offerResultLine(o: PersonalInviteOffer): string | null {
  const parts: string[] = [];
  if (o.tier && o.untilDay) parts.push(`${planWord(o.tier)}, free until ${offerDayWords(o.untilDay)}`);
  if (o.photos) parts.push(`${o.photos} portfolio photos to keep`);
  return parts.length ? `${parts.join(' · ')} — written when they claim.` : null;
}

/** Monthly (28-day) catalogue price per paid plan; absent = not in the catalogue, so named without a price. */
export type PlanPrices = Partial<Record<PersonalInviteTier, number>>;

/** "Solo ₱1,000" — or "Ultra" when the catalogue holds no price for it. */
function planWithPrice(tier: PersonalInviteTier, prices: PlanPrices): string {
  const p = prices[tier];
  return typeof p === 'number' && Number.isFinite(p) ? `${planWord(tier)} ${formatPhp(p)}` : planWord(tier);
}

/** "Free, Solo ₱1,000, Pro ₱2,500 or Ultra ₱8,000 / 28 days" — the four choices after the gift. */
export function planChoicesLine(prices: PlanPrices): string {
  const paid = PERSONAL_INVITE_TIERS.map((t) => planWithPrice(t, prices));
  return `Free, ${paid.slice(0, -1).join(', ')} or ${paid[paid.length - 1]} / 28 days`;
}

/** The dropdown's trailing note per plan: "no gift" for Free, the catalogue price, or nothing when there is none. */
export function planMenuNote(tier: 'free' | PersonalInviteTier, prices: PlanPrices): string | null {
  if (tier === 'free') return 'no gift';
  const p = prices[tier];
  return typeof p === 'number' && Number.isFinite(p) ? `${formatPhp(p)} / 28 days` : null;
}

/**
 * THE MESSAGE the admin copies and sends by hand (owner 2026-05-21: no automated send in V1; owner 2026-10-11: no new
 * emails). Text only. The launch-offer sentence is said only while the offer runs — `launchCap` is null otherwise.
 */
export function personalInviteMessage(input: {
  businessName: string;
  offer: PersonalInviteOffer;
  prices: PlanPrices;
  /** "2,000" when the launch offer is open now, else null. */
  launchCapWords: string | null;
  claimUrl: string;
}): string {
  const { businessName, offer, prices, launchCapWords, claimUrl } = input;
  const paras: string[] = [`Hi ${businessName} — your Setnayan shop is set up. Scan the card or open the link to claim it.`];

  const gift: string[] = [];
  if (offer.tier && offer.untilDay) gift.push(`${planWord(offer.tier)}, free until ${offerDayWords(offer.untilDay)}`);
  if (offer.photos) gift.push(`${offer.photos} portfolio photos, yours to keep`);
  if (gift.length) {
    const after = offer.tier
      ? ` After that it's up to you — ${planChoicesLine(prices)}. Nothing renews by itself.`
      : '';
    paras.push(`Your offer: ${gift.join(', and ')}.${after}`);
  }

  const fee = [FIRST_BOOKING_ON_US];
  if (launchCapWords) fee.push(`While Setnayan's first ${launchCapWords} bookings run, there is no booking fee at all.`);
  paras.push(fee.join(' '));

  paras.push(claimUrl);
  return paras.join('\n\n');
}

/** The offer as the invite row stores it (`vendor_invites.offer_*`). */
export type StoredInviteOffer = {
  offer_tier?: string | null;
  offer_until?: string | null;
  offer_photo_allowance?: number | null;
};

/** The stored columns back to the offer — an unknown tier or an unreadable date is no plan, never a guess. */
export function offerFromInvite(row: StoredInviteOffer): PersonalInviteOffer {
  const tier = (PERSONAL_INVITE_TIERS as readonly string[]).includes(row.offer_tier ?? '')
    ? (row.offer_tier as PersonalInviteTier)
    : null;
  const untilDay = tier && row.offer_until ? manilaDayOf(row.offer_until) : null;
  const photos = typeof row.offer_photo_allowance === 'number' && row.offer_photo_allowance > 0 ? row.offer_photo_allowance : null;
  return { tier: tier && untilDay ? tier : null, untilDay: tier && untilDay ? untilDay : null, photos };
}

/** The short fee line on the door's offer rows (owner 2026-10-23: one free booking). */
export const DOOR_FEE_LINE = 'Your first booking is on us';

/**
 * The door's **Your offer** rows (frame B1), or null when the invite carries no offer. The note under them is said
 * only for a plan gift: what happens the day after ("On 1 Feb you choose: stay on Free, or keep Pro.").
 */
export function doorOffer(o: PersonalInviteOffer): {
  plan: { word: string; until: string } | null;
  photos: number | null;
  fee: string;
  note: string | null;
} | null {
  if (!hasOffer(o)) return null;
  const plan = o.tier && o.untilDay ? { word: planWord(o.tier), until: offerDayWords(o.untilDay) } : null;
  return {
    plan,
    photos: o.photos,
    fee: DOOR_FEE_LINE,
    note:
      plan && o.untilDay
        ? `Nothing to pay, nothing renews by itself. On ${dayAfterWords(o.untilDay)} you choose: stay on Free, or keep ${plan.word}.`
        : null,
  };
}
