import type { SupabaseClient } from '@supabase/supabase-js';
import { isTierAtLeast } from './vendor-tier-caps';

/**
 * vendor-photo-challenge.ts — Papic Challenges pricing + eligibility.
 *
 * ── OWNER 2026-08-28, verbatim: "unlimited us 2500 for 4 weeks." ────────────
 * Papic Challenges is a **₱2,500 / 28-day subscription, unlimited**, across
 * every celebration the shop is booked for. It replaces the ₱400-PER-EVENT
 * model locked on 2026-07-22. Four weeks is 28 days, the cadence every other
 * vendor add-on already bills on, so this reuses the Vendor AI add-on's shape
 * exactly — an expiry stamped on the shop's own row, evaluated at READ time
 * (this project is cron-free; nothing sweeps a lapse and nothing needs to).
 *
 * ── TWO DIFFERENT QUESTIONS, TWO DIFFERENT FUNCTIONS ────────────────────────
 * Under the per-event model these were one question, and collapsing them is the
 * mistake this file exists to avoid:
 *
 *   • CAN THIS SHOP BUY IT?  {@link photoChallengePurchaseEligibility} — about
 *     the SHOP. No event, because the subscription is not bought per event.
 *     "Already subscribed" is a denial HERE: it means don't charge them twice.
 *   • CAN THIS SHOP RUN ONE HERE?  {@link photoChallengeEventReady} — about one
 *     celebration: entitled AND booked AND Papic is running on it. "Already
 *     subscribed" is the state that says YES here — the exact inversion that
 *     made a single combined function wrong the moment the price became a
 *     subscription.
 *
 * The DATABASE re-asks the entitlement half itself
 * (`vendor_papic_challenge_entitled`, called by both the authoring RPC and the
 * photo-delivery RPC). These pure functions decide what a SCREEN shows; they
 * are never the gate.
 *
 * PURE + I/O split: the decisions carry no clock, no env and no I/O, and the DB
 * readers take their client as an argument, so this module has no `server-only`
 * import and stays testable under `tsx --test`.
 */

/** Catalog sku_code + the literal `orders.service_key`. ONE key, deliberately:
 *  it is also the key of the sku-activation hook, and a catalog row with no
 *  activation entry takes the money and grants nothing. */
export const VENDOR_PHOTO_CHALLENGE_SKU_CODE = 'vendor_photo_challenge';

/** One billing cycle = 28 days ("4 weeks", owner 2026-08-28) — the platform cadence. */
export const VENDOR_PHOTO_CHALLENGE_PERIOD_DAYS = 28;

/**
 * Fallback ₱2,500 / 28-day price. The live catalog value wins; this is the
 * last-resort figure used only when the `vendor_photo_challenge` row is missing
 * or unreadable (a CI build with no service-role key, or an unapplied
 * migration). Never hardcode this in UI copy — read via
 * {@link fetchVendorPhotoChallengePricePhp}.
 *
 * ⚠ Was 400 under the per-event model. A fallback that lags the owner's price
 * is how an unreadable catalog quietly sells a 28-day subscription for the old
 * per-event fee.
 */
export const VENDOR_PHOTO_CHALLENGE_FALLBACK_PHP = 2500;

/** A positive finite price, or the fallback when the catalog value is missing/invalid. */
function coercePrice(value: number | null | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * The price (PHP) a Papic Challenges order should charge: the catalog price for
 * one 28-day cycle, or the fallback. PURE. There is NO free first cycle — the
 * owner set a trial only for the AI + 3D add-ons, and that has not changed.
 */
export function resolveVendorPhotoChallengePricePhp(
  cyclePricePhp?: number | null,
): number {
  return coercePrice(cyclePricePhp, VENDOR_PHOTO_CHALLENGE_FALLBACK_PHP);
}

/**
 * Is the subscription live? PURE — `expiresAt` is the stored
 * vendor_profiles.papic_challenge_expires_at. Mirrors isVendorAiAddonActive.
 */
export function isPhotoChallengeSubscriptionActive(
  expiresAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) && t > nowMs;
}

/**
 * The new window end for a fresh 28-day cycle, stacking from the LATER of now /
 * the current expiry — an early re-up keeps the time already paid for. PURE.
 */
export function nextPhotoChallengeExpiry(
  currentExpiresAt: string | null | undefined,
  nowMs: number = Date.now(),
): string {
  const cur = currentExpiresAt ? Date.parse(currentExpiresAt) : NaN;
  const base = Number.isFinite(cur) && cur > nowMs ? cur : nowMs;
  return new Date(
    base + VENDOR_PHOTO_CHALLENGE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

// ── Can this shop BUY it? ────────────────────────────────────────────────────

export type PhotoChallengeDenyReason =
  /** Tier below Pro (Solo/Verified/Free) — Pro/Enterprise only, pre-2026-07-25 gate. */
  | 'tier_too_low'
  /** Paid tier but the shop is not verified yet. */
  | 'unverified'
  /** Already has a live 28-day subscription — don't charge them twice. */
  | 'already_subscribed'
  /** The vendor is not booked on this event. (Event-side only.) */
  | 'not_booked'
  /** Papic is not active on this event — nothing to run a challenge on. */
  | 'papic_inactive'
  /** Booked and Papic is on, but the shop has not turned the subscription on. */
  | 'not_subscribed';

export type PhotoChallengeEligibility =
  | { ok: true }
  | { ok: false; reason: PhotoChallengeDenyReason };

/**
 * The plans that may turn Papic Challenges on. OWNER 2026-08-29, verbatim:
 * *"Solo and Pro can buy Papic Challenges. they can only but if they are
 * solo,pro,enterprise,custom. but not when they are free"*.
 *
 * `isTierAtLeast(tier, 'solo')` is exactly that list: the ladder is
 * free → verified → solo → pro → enterprise → custom, so it admits the four he
 * named and refuses the two that cost nothing.
 *
 * ⚠ IT ALSO REFUSES `verified`, WHICH HE DID NOT NAME EITHER WAY. `verified` is
 * the LEGACY FREE tier — a real, checked business on the ₱0 plan — so it falls
 * under *"not when they are free"*. Written down rather than buried: if he meant
 * a verified free shop may buy, this constant is the one line to change.
 */
export const PHOTO_CHALLENGE_MIN_TIER = 'solo' as const;

export type PhotoChallengePurchaseInput = {
  /** vendor_profiles.tier_state. */
  tier: string | null | undefined;
  /** vendor_profiles.verification_state. */
  verification: string | null | undefined;
  /** Is a 28-day window already live for this shop? */
  subscriptionActive: boolean;
};

/**
 * May this shop turn Papic Challenges ON? Checked in the same order the buy
 * action rejects, so the surfaced reason always matches what a submit returns:
 * tier → verification → not-already-subscribed.
 *
 * ⚠ NO EVENT. Under the per-event model this asked "booked?" and "Papic on?",
 * and it had to: the thing being bought was one celebration. A subscription is
 * bought by the SHOP, so requiring an event to buy one would put the purchase
 * behind a route that needs a booking — which is the surface the owner's
 * repricing moves it off.
 */
export function photoChallengePurchaseEligibility(
  input: PhotoChallengePurchaseInput,
): PhotoChallengeEligibility {
  // ⚠ THE FLOOR IS UNCONDITIONAL — it is NOT lifted by the 2026-07-25 tiered
  // add-on flag, and that is the owner's 2026-08-29 ruling, not an oversight.
  //
  // Until today this read `!allTiersAllowed && !isTierAtLeast(tier, 'pro')`, so
  // one switch decided TWO different things: which PRICE band a shop pays, and
  // WHETHER IT MAY BUY AT ALL. The owner turned that switch on the same day and
  // ruled the floor separately — *"not when they are free"* — which the old
  // shape could not express: with the flag on it admitted everybody, with the
  // flag off it refused Solo, and he wants Solo in and free out.
  //
  // 🔑 One switch answering two questions is how a price change silently becomes
  // an access change. The flag keeps its PRICE job; the floor is its own rule.
  if (!isTierAtLeast(input.tier, PHOTO_CHALLENGE_MIN_TIER))
    return { ok: false, reason: 'tier_too_low' };
  if (input.verification !== 'verified') return { ok: false, reason: 'unverified' };
  if (input.subscriptionActive) return { ok: false, reason: 'already_subscribed' };
  return { ok: true };
}

// ── Can this shop RUN one on THIS celebration? ───────────────────────────────

export type PhotoChallengeEventInput = {
  /** Does this vendor own a BOOKED event_vendors row on the event? */
  booked: boolean;
  /** Is Papic active on the event (eventPapicActive)? */
  papicActive: boolean;
  /** A live subscription, or a legacy per-event sponsorship for THIS event. */
  entitled: boolean;
};

/**
 * The per-celebration answer. Ordered so the sentence a supplier reads names the
 * thing they can actually act on first: they cannot fix "not booked" by paying,
 * and telling somebody to subscribe for a celebration they are not booked on
 * would sell them something that does nothing.
 */
export function photoChallengeEventReady(
  input: PhotoChallengeEventInput,
): PhotoChallengeEligibility {
  if (!input.booked) return { ok: false, reason: 'not_booked' };
  if (!input.papicActive) return { ok: false, reason: 'papic_inactive' };
  if (!input.entitled) return { ok: false, reason: 'not_subscribed' };
  return { ok: true };
}

/** Human copy for each deny reason (surfaced in the vendor UI). */
export const PHOTO_CHALLENGE_DENY_MESSAGE: Record<PhotoChallengeDenyReason, string> = {
  tier_too_low:
    'Papic Challenges comes with a paid plan. Move up to Solo or above to turn it on.',
  unverified: 'Get your shop verified first — Papic Challenges unlocks once you’re verified.',
  already_subscribed: 'Papic Challenges is already on for your shop.',
  not_booked: 'You can only run Papic Challenges at a celebration you’re booked for.',
  papic_inactive:
    'Papic Challenges runs on Papic — it’s available once the couple has Papic active for this celebration.',
  not_subscribed:
    'Turn Papic Challenges on for your shop and you can run it here and at every other celebration you’re booked for.',
};

// ── DB readers (client passed in — no server-only import) ────────────────────

/**
 * Resolve the live Papic Challenges price (PHP) from the admin-managed catalog,
 * falling back to {@link VENDOR_PHOTO_CHALLENGE_FALLBACK_PHP} when the row is
 * missing/unreadable. Any non-positive / non-finite price is treated as missing.
 */
export async function fetchVendorPhotoChallengePricePhp(
  supabase: SupabaseClient,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('vendor_billing_catalog')
      .select('price_php')
      .eq('sku_code', VENDOR_PHOTO_CHALLENGE_SKU_CODE)
      .eq('is_active', true)
      .maybeSingle();
    if (error || !data) return VENDOR_PHOTO_CHALLENGE_FALLBACK_PHP;
    const price = Number((data as { price_php: number | string }).price_php);
    return Number.isFinite(price) && price > 0
      ? price
      : VENDOR_PHOTO_CHALLENGE_FALLBACK_PHP;
  } catch {
    return VENDOR_PHOTO_CHALLENGE_FALLBACK_PHP;
  }
}

/**
 * The shop's subscription window, or null. Soft: any error / missing column
 * degrades to null (not subscribed) so a pre-migration DB never crashes a
 * caller — and degrading toward "off" errs against US, never toward giving a
 * paid product away.
 */
export async function fetchPhotoChallengeExpiry(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('vendor_profiles')
      .select('papic_challenge_expires_at')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (error || !data) return null;
    const v = (data as { papic_challenge_expires_at?: string | null })
      .papic_challenge_expires_at;
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Is this shop entitled to run a challenge? Mirrors the SQL
 * `vendor_papic_challenge_entitled`, which is the actual gate.
 *
 * ⚠ ONE WAY IN. Owner 2026-08-29: *"vendors only purchase papic challenges for a
 * 4-week subscription."* This used to carry a second arm honouring a legacy ₱400
 * per-event `papic_photo_challenge_sponsorships` row, on the reasoning that a
 * repricing must never retroactively unsell what somebody had already bought.
 * That reasoning was right and the arm was provably dead: zero rows in
 * production ever, and — once the activation hook moved to stamping the 28-day
 * window — zero writers anywhere. **A read arm whose only writer is gone can
 * never be true**, and leaving it in made the gate say there were two ways to be
 * entitled when there is one.
 *
 * `eventId` is accepted and IGNORED, matching the SQL signature: a subscription
 * covers every celebration the shop is booked for, and the per-celebration
 * questions (booked? Papic on?) are {@link photoChallengeEventReady}'s.
 */
export async function fetchPhotoChallengeEntitled(
  supabase: SupabaseClient,
  _eventId: string,
  vendorProfileId: string,
  nowMs: number = Date.now(),
): Promise<boolean> {
  const expiry = await fetchPhotoChallengeExpiry(supabase, vendorProfileId);
  return isPhotoChallengeSubscriptionActive(expiry, nowMs);
}
