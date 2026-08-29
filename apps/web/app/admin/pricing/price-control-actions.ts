'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminAction } from '@/lib/admin/require-admin';
import { BOOKING_FEE } from '@/lib/booking-fee';
import { VENDOR_BOOKING_FEES_PATH } from '@/lib/vendor-booking-fees';
import {
  PAPIC_ANCHOR_SHOTS,
  buildPapicLadder,
  ladderComplaints,
} from '@/lib/papic-anchor-ladder';
import {
  type DiscountFamily,
  FAMILY_DISCOUNT_DEFAULT_PCT,
  blockingComplaint,
  discountComplaints,
  signupPriceFor,
} from '@/lib/onboarding-family-discount';
import { AI_TIER_SKU } from '@/lib/setnayan-ai-type-pricing';
import type { RowActionState } from './actions';

/**
 * /admin/pricing — the three OWNER-SET controls added 2026-08-28.
 *
 *   1. `saveBookingFeeSchedule`  — the vendor booking fee's 5% / ₱100,000 / 1%.
 *   2. `savePapicLadder`         — five anchor prices; eleven rungs computed.
 *   3. `saveFamilyDiscount`      — one sign-up discount for a whole family.
 *
 * They live in their own file rather than in `actions.ts` for the reason that
 * file's own docblock gives: every action there owns exactly ONE catalog row's
 * fields, deliberately, after a bulk-save shape once blanked 32 descriptions.
 * These three are settings/family-wide by nature and must not be filed among
 * the per-row ones where a future reader would assume the same contract.
 *
 * ⚠ ALL THREE WRITE MONEY. Each one re-reads the prior value, refuses a
 * nonsense input in plain English, writes an `admin_audit_log` row carrying
 * before → after, and returns a sentence naming what actually moved.
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * A percent typed into a form, or null when it is not a usable number.
 *
 * 🪤 A BLANK BOX IS REFUSED, NEVER READ AS 0%. `Number('')` is 0, 0 is finite,
 * and 0 is a LEGAL discount — so without the emptiness test an empty field saved
 * cleanly as "0% off" and stripped the sign-up saving from every row in the
 * family at once, reporting success. Sixteen Papic prices on one accidental
 * save.
 *
 * 🔑 THIS EXACT GUARD EXISTED ON THE CONTROL THIS ONE REPLACED. The retired
 * house set-up discount refused a blank explicitly and had a test saying why;
 * the per-family control that superseded it on 2026-08-28 did not inherit
 * either. Found 2026-08-29 by asking what that retiring test had been protecting
 * before deleting it — which is the whole reason not to delete a guard just
 * because its subject moved.
 */
function parsePct(raw: FormDataEntryValue | null): number | null {
  const raw_str = String(raw ?? '').trim();
  if (raw_str === '') return null;
  const n = Number(raw_str);
  return Number.isFinite(n) ? round2(n) : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · THE VENDOR BOOKING FEE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The three numbers the owner ruled his: the head rate, the band ceiling and
 * the tail rate.
 *
 * 🔒 The ₱50 floor and the no-cap rule are NOT here. He ruled on the taper and
 * did not rule on those; they stay fixed in `BOOKING_FEE`. The screen says so.
 *
 * ⚠ THIS IS THE SUPPLIER'S FEE, NOT THE CUSTOMER'S. `setnayan_pay_fee_pct` —
 * edited a few centimetres up the same page — is a dormant gateway fee the
 * CUSTOMER would pay. Two different 5%s; they are never written together.
 */
export async function saveBookingFeeSchedule(
  _prev: RowActionState,
  formData: FormData,
): Promise<RowActionState> {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();

  const rate = parsePct(formData.get('booking_fee_rate_pct'));
  const tail = parsePct(formData.get('booking_fee_tail_rate_pct'));
  const bandRaw = Number(String(formData.get('booking_fee_tier1_limit_php') ?? '').trim());
  const band = Number.isFinite(bandRaw) ? round2(bandRaw) : null;

  if (rate == null || rate < 0 || rate > 100) {
    return { ok: false, message: 'The first rate must be between 0% and 100%.' };
  }
  if (tail == null || tail < 0 || tail > 100) {
    return { ok: false, message: 'The rate above the threshold must be between 0% and 100%.' };
  }
  if (band == null || band <= 0) {
    return { ok: false, message: 'The threshold must be more than ₱0.' };
  }

  // ⚠ THE ONE THAT PROTECTS THE MODEL. A tail rate ABOVE the head rate turns
  // the taper into a surcharge: the fee would climb faster past the threshold
  // than below it, and a supplier would then be better off declaring LESS than
  // they agreed. The whole schedule exists to remove that incentive.
  if (tail > rate) {
    return {
      ok: false,
      message:
        `The rate above ₱${band.toLocaleString('en-PH')} (${tail}%) can't be higher than the rate below it (${rate}%) — ` +
        `that would charge more for being honest about a bigger booking.`,
    };
  }

  const { data: prior } = await admin
    .from('platform_settings')
    .select('booking_fee_rate_pct, booking_fee_tail_rate_pct, booking_fee_tier1_limit_php')
    .eq('id', 1)
    .maybeSingle();

  const before = {
    rate: prior?.booking_fee_rate_pct != null ? Number(prior.booking_fee_rate_pct) : BOOKING_FEE.rate * 100,
    tail: prior?.booking_fee_tail_rate_pct != null ? Number(prior.booking_fee_tail_rate_pct) : BOOKING_FEE.tailRate * 100,
    band: prior?.booking_fee_tier1_limit_php != null ? Number(prior.booking_fee_tier1_limit_php) : BOOKING_FEE.tier1LimitPhp,
  };
  if (before.rate === rate && before.tail === tail && before.band === band) {
    return { ok: true, message: 'No changes to save.' };
  }

  const { error } = await admin
    .from('platform_settings')
    .update({
      booking_fee_rate_pct: rate,
      booking_fee_tail_rate_pct: tail,
      booking_fee_tier1_limit_php: band,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) return { ok: false, message: `Couldn't save — ${error.message}` };

  await admin.from('admin_audit_log').insert({
    action: 'booking_fee_schedule_edit',
    target_id: 'booking_fee_schedule',
    actor_user_id: adminUserId,
    metadata: {
      table: 'platform_settings',
      before,
      after: { rate, tail, band },
    },
  });

  revalidatePath('/admin/pricing');
  // NARROWED from a layout-scoped bust of the vendor dashboard root — which threw
  // away the whole dashboard shell, for every supplier, on an edit that happens
  // maybe twice a year, to refresh a number that shell never shows.
  // (Written without the literal call: lint-vendor-layout-revalidate.mjs scans raw
  // source and does not strip comments, so quoting it here re-trips the guard.)
  //
  // Measured, not assumed: the only component that renders the SCHEDULE in words is
  // app/vendors/_components/vendor-tier-deltas.tsx, and it is mounted on /vendors
  // ALONE — so the line below covers the entire public claim. Nothing under
  // /vendor-dashboard renders the schedule; the fee figures there are per-order
  // amounts already computed and stored at charge time, which a reprice does not
  // move. (booking-fees/page.tsx quotes "5% … then 1%" in a DOCBLOCK, not in JSX.)
  //
  // Kept page-scoped on the booking-fee surface because that is the vendor's money
  // document for these charges and the plausible home for a rendered schedule line
  // later; page scope costs one path instead of the shell.
  revalidatePath('/vendors');
  revalidatePath(VENDOR_BOOKING_FEES_PATH);
  return {
    ok: true,
    message: `Saved — ${rate}% of the first ₱${band.toLocaleString('en-PH')}, then ${tail}%.`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · THE PAPIC LADDER — five typed prices, eleven computed
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Writes all sixteen Papic regular prices from the five anchors the owner types.
 *
 * 🔑 NO SECOND SOURCE OF TRUTH IS CREATED, and this is the design decision worth
 * reading. The anchors are NOT stored anywhere. They are five of the sixteen
 * catalog rows, and the derivation happens HERE, at save time: the eleven
 * computed prices are written into their own `platform_retail_catalog_v2` rows.
 * After a save there is still exactly ONE price per rung, in the catalog, read
 * by `resolveRetailChargeCentavos` exactly as before. Nothing new is read at
 * charge time.
 *
 * ⚠ THE RESIDUAL SEAM, NAMED RATHER THAN HIDDEN: because the derivation is
 * save-time, editing a computed rung directly from the Pricing tab's row editor
 * would drift it off its anchor. `tests/db/papic-rungs-are-fundable.db.test.ts`
 * is what catches that, by asserting the per-credit bands independently.
 *
 * ⚠ THE ORDER OF THE TWO DERIVED LAYERS IS FIXED: anchors produce the REGULAR
 * prices; the family discount then produces the SIGN-UP prices from those. Both
 * run here so a save can never leave half the ladder recomputed.
 */
export async function savePapicLadder(
  _prev: RowActionState,
  formData: FormData,
): Promise<RowActionState> {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();

  // The five typed prices, read by the shot count they anchor.
  const anchors: [number, number][] = [];
  for (const shots of PAPIC_ANCHOR_SHOTS) {
    const raw = Number(String(formData.get(`anchor_${shots}`) ?? '').trim());
    if (!Number.isFinite(raw) || raw <= 0) {
      return { ok: false, message: `The price for ${shots.toLocaleString('en-PH')} shots must be more than ₱0.` };
    }
    anchors.push([shots, round2(raw)]);
  }

  // The rung SET comes from the catalog + the tier table, never from a list in
  // code — those decide which rungs exist.
  const [{ data: tierRows }, { data: catRows }] = await Promise.all([
    admin.from('papic_pass_tiers').select('service_code, points').eq('is_active', true),
    admin
      .from('platform_retail_catalog_v2')
      .select('service_code, retail_price_php, onboarding_price_php')
      .like('service_code', 'PAPIC_GUEST%'),
  ]);
  if (!tierRows || !catRows) {
    return { ok: false, message: "Couldn't read the Papic rungs — nothing was saved." };
  }

  const shotsByCode = new Map<string, number>();
  for (const t of tierRows as { service_code?: string; points?: number }[]) {
    if (t.service_code && Number.isFinite(t.points)) shotsByCode.set(t.service_code, Number(t.points));
  }
  const priced = (catRows as { service_code: string; retail_price_php: number | string }[]).filter((r) =>
    shotsByCode.has(r.service_code),
  );
  const allShots = priced.map((r) => shotsByCode.get(r.service_code)!);

  const rungs = buildPapicLadder(allShots, anchors);
  const complaints = ladderComplaints(rungs);
  if (complaints.length > 0) {
    // ⚠ REFUSED, NOT CLAMPED. A ladder that inverts is a real defect — a rung
    // nobody should ever buy — and quietly "fixing" his numbers would hide it.
    return { ok: false, message: `Not saved — ${complaints[0]!.message}` };
  }

  // The family discount in force, so the sign-up half is recomputed in the same
  // save rather than left stale against the new regular prices.
  const { data: settings } = await admin
    .from('platform_settings')
    .select('papic_signup_discount_pct')
    .eq('id', 1)
    .maybeSingle();
  const discountPct =
    settings?.papic_signup_discount_pct != null ? Number(settings.papic_signup_discount_pct) : 10;

  const phpByShots = new Map(rungs.map((r) => [r.shots, r.php]));
  let moved = 0;
  for (const row of priced) {
    const shots = shotsByCode.get(row.service_code)!;
    const regular = phpByShots.get(shots);
    if (regular == null) continue;
    const signup = signupPriceFor(regular, discountPct);
    if (Number(row.retail_price_php) === regular) {
      // Regular unchanged — still re-derive the sign-up half in case the
      // discount moved since this row was last written.
      const { error } = await admin
        .from('platform_retail_catalog_v2')
        .update({ onboarding_price_php: signup, updated_at: new Date().toISOString() })
        .eq('service_code', row.service_code);
      if (error) return { ok: false, message: `Couldn't save ${row.service_code} — ${error.message}` };
      continue;
    }
    const { error } = await admin
      .from('platform_retail_catalog_v2')
      .update({
        retail_price_php: regular,
        onboarding_price_php: signup,
        updated_at: new Date().toISOString(),
      })
      .eq('service_code', row.service_code);
    if (error) return { ok: false, message: `Couldn't save ${row.service_code} — ${error.message}` };
    moved += 1;
  }

  await admin.from('admin_audit_log').insert({
    action: 'papic_ladder_edit',
    target_id: 'papic_ladder',
    actor_user_id: adminUserId,
    metadata: { anchors, rowsMoved: moved, discountPct },
  });

  revalidatePath('/admin/pricing');
  revalidatePath('/pricing');
  return {
    ok: true,
    message:
      moved === 0
        ? 'Saved — no rung price changed.'
        : `Saved — ${moved} of ${priced.length} rung prices changed.`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · ONE SIGN-UP DISCOUNT PER FAMILY
// ═══════════════════════════════════════════════════════════════════════════

const FAMILY_COLUMN: Record<DiscountFamily, string> = {
  papic: 'papic_signup_discount_pct',
  ai: 'ai_signup_discount_pct',
};

const FAMILY_LABEL: Record<DiscountFamily, string> = {
  papic: 'Papic',
  ai: 'Setnayan AI',
};

/**
 * Sets a family's single sign-up discount and re-derives every sign-up price in
 * that family from it.
 *
 * ⚠ ONE BOX, MANY PRICES. Nudging this reprices sixteen rows for Papic and four
 * for Setnayan AI. The screen shows the before → after for every affected row
 * BEFORE the save; this action then reports how many actually moved, so the
 * count is confirmed by the write rather than only promised by the preview.
 *
 * 🔒 The Papic FLOOR REFUSES (owner 2026-08-29) and is scoped to Papic — Setnayan
 * AI answers to no floor. The NONSENSE guards — negative, 100%+ — refuse for both
 * families. A 0% discount still only WARNS: it is legal, just pointless.
 */
export async function saveFamilyDiscount(
  _prev: RowActionState,
  formData: FormData,
): Promise<RowActionState> {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();

  const family = String(formData.get('family') ?? '') as DiscountFamily;
  if (family !== 'papic' && family !== 'ai') {
    return { ok: false, message: 'Unrecognised product family.' };
  }
  const pct = parsePct(formData.get('discount_pct'));
  if (pct == null) return { ok: false, message: 'That is not a number.' };

  // ⚠ WHICH COMPLAINTS ARE FATAL IS NOT DECIDED HERE. `BLOCKING_COMPLAINTS`
  // lives beside the rule itself and is read by the per-row card too, so the
  // floor cannot refuse on one writer and wave through on the other.
  const complaints = discountComplaints(family, pct);
  const blocking = blockingComplaint(complaints);
  if (blocking) return { ok: false, message: `Not saved — ${blocking.message}` };

  const column = FAMILY_COLUMN[family];
  // ⚠ SETNAYAN_AI_RENEW is deliberately absent from the AI set: a renewal is not
  // an onboarding purchase, so it must never gain a sign-up price. Matching
  // 'SETNAYAN_AI%' here would have swept it in.
  const SELECT_COLS = 'service_code, retail_price_php, onboarding_price_php';
  const { data: rows, error: readErr } =
    family === 'papic'
      ? await admin
          .from('platform_retail_catalog_v2')
          .select(SELECT_COLS)
          .like('service_code', 'PAPIC_GUEST%')
      : await admin
          .from('platform_retail_catalog_v2')
          .select(SELECT_COLS)
          .in('service_code', ['SETNAYAN_AI', 'SETNAYAN_AI_B', 'SETNAYAN_AI_C', 'SETNAYAN_AI_D']);

  // ⚠ Supabase RESOLVES with `{ error }`. An unchecked read here would write a
  // family-wide reprice against an empty row set and report success.
  if (readErr || !rows) {
    return { ok: false, message: "Couldn't read the prices — nothing was saved." };
  }

  // The column name is chosen from FAMILY_COLUMN above, never from the form, so
  // the computed key can only ever be one of the two known settings columns.
  const patch: Record<string, number | string> = {
    [column]: pct,
    updated_at: new Date().toISOString(),
  };
  const { error: setErr } = await admin.from('platform_settings').update(patch).eq('id', 1);
  if (setErr) return { ok: false, message: `Couldn't save — ${setErr.message}` };

  let moved = 0;
  for (const row of rows as { service_code: string; retail_price_php: number | string; onboarding_price_php: number | string | null }[]) {
    const regular = Number(row.retail_price_php);
    if (!Number.isFinite(regular) || regular <= 0) continue;
    const next = signupPriceFor(regular, pct);
    const current = row.onboarding_price_php == null ? null : Number(row.onboarding_price_php);
    if (next === current) continue;
    const { error } = await admin
      .from('platform_retail_catalog_v2')
      .update({ onboarding_price_php: next, updated_at: new Date().toISOString() })
      .eq('service_code', row.service_code);
    if (error) return { ok: false, message: `Couldn't save ${row.service_code} — ${error.message}` };
    moved += 1;
  }

  await admin.from('admin_audit_log').insert({
    action: 'family_signup_discount_edit',
    target_id: `${family}_signup_discount_pct`,
    actor_user_id: adminUserId,
    metadata: { family, after: pct, rowsMoved: moved, warnings: complaints.map((c) => c.kind) },
  });

  revalidatePath('/admin/pricing');
  revalidatePath('/pricing');

  const warned = complaints.find((c) => c.kind !== 'out_of_range');
  const head =
    moved === 0
      ? `Saved — ${FAMILY_LABEL[family]} at ${pct}% off. No sign-up price changed.`
      : `Saved — ${FAMILY_LABEL[family]} at ${pct}% off. ${moved} sign-up price${moved === 1 ? '' : 's'} changed.`;
  return { ok: true, message: warned ? `${head} ${warned.message}` : head };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · WHICH BAND EACH KIND OF CELEBRATION PAYS
// ═══════════════════════════════════════════════════════════════════════════

const AI_BANDS = ['A', 'B', 'C', 'D', 'E'] as const;
type AiBand = (typeof AI_BANDS)[number];

/**
 * Moves ONE kind of celebration into ONE band.
 *
 * ⚖ Owner 2026-08-28: *"a price and a checkbox. If a checkbox is checked, it
 * should not show to the other prices."*
 *
 * 🔑 THE EXCLUSIVITY IS STRUCTURAL, NOT ENFORCED BY SWEEPING. A kind's band is
 * a single column on its own row, so writing one band IS unticking every other —
 * there is no second place it could still be ticked, and no "now clear the
 * others" pass that could half-fail and leave a kind in two bands at once. That
 * is why the assignment is a column rather than a join table.
 *
 * ⚠ AN EMPTY BAND IS A LEGAL, MEANINGFUL STATE. Passing no band writes NULL —
 * "no band chosen" — which is what the wake carries today. It is deliberately
 * NOT the same as C: an unassigned kind still RESOLVES to C, so nothing is
 * re-priced and the SEC-5 tier-crossing guard cannot be dodged, but the screen
 * shows it in the tray as an unanswered question rather than as a decision.
 */
export async function setEventTypeBand(
  _prev: RowActionState,
  formData: FormData,
): Promise<RowActionState> {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();

  const eventType = String(formData.get('event_type') ?? '').trim();
  if (!eventType) return { ok: false, message: 'No kind of celebration was named.' };

  const raw = String(formData.get('band') ?? '').trim();
  const band: AiBand | null = raw === '' ? null : (raw as AiBand);
  if (band !== null && !(AI_BANDS as readonly string[]).includes(band)) {
    return { ok: false, message: 'Unrecognised price band.' };
  }

  const { data: prior, error: readErr } = await admin
    .from('event_type_vocab')
    .select('event_type, label_en, ai_price_tier')
    .eq('event_type', eventType)
    .maybeSingle();
  if (readErr) return { ok: false, message: `Couldn't read that celebration — ${readErr.message}` };
  if (!prior) return { ok: false, message: 'That kind of celebration no longer exists.' };

  const before = (prior as { ai_price_tier?: string | null }).ai_price_tier ?? null;
  const label = (prior as { label_en?: string | null }).label_en ?? eventType;
  if (before === band) return { ok: true, message: 'No changes to save.' };

  const { error } = await admin
    .from('event_type_vocab')
    .update({ ai_price_tier: band, updated_at: new Date().toISOString() })
    .eq('event_type', eventType);
  if (error) return { ok: false, message: `Couldn't save — ${error.message}` };

  await admin.from('admin_audit_log').insert({
    action: 'ai_band_assignment_edit',
    target_id: eventType,
    actor_user_id: adminUserId,
    metadata: { table: 'event_type_vocab', field: 'ai_price_tier', before, after: band },
  });

  revalidatePath('/admin/pricing');
  return {
    ok: true,
    message:
      band === null
        ? `${label} has no band now — it falls through to the middle price.`
        : `${label} moved to band ${band}.`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · WHAT ONE BAND OF SETNAYAN AI COSTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sets ONE Setnayan AI band's regular price, and re-derives its sign-up price
 * from the AI family discount in the same save.
 *
 * ⚖ Owner 2026-08-29: *"i need to be able to edit the prices here as well (the
 * regular price)"*. Until this existed, three of the four AI prices could only
 * be changed by a migration: bands B, C and D are `is_active = false` price
 * SOURCES, so they sat in the retired shelf of the main catalog screen rather
 * than anywhere a person would look for a live price.
 *
 * 🔑 THE SIGN-UP PRICE IS NEVER TYPED HERE, and that is deliberate. He ruled on
 * 2026-08-28 that Setnayan AI carries ONE discount for the whole family; typing
 * a second number per band would recreate the four drifted per-band discounts
 * that ruling removed. Change the price, the sign-up price follows.
 *
 * ⚠ TIER E HAS NO SKU AND THEREFORE NO PRICE. It means "not offered", not
 * "free", so it is refused here rather than being allowed to store a ₱0 that
 * would read as a free version somebody could switch on.
 */
export async function saveAiBandPrice(
  _prev: RowActionState,
  formData: FormData,
): Promise<RowActionState> {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();

  const band = String(formData.get('band') ?? '').trim();
  if (!(AI_BANDS as readonly string[]).includes(band)) {
    return { ok: false, message: 'Unrecognised price band.' };
  }
  const sku = AI_TIER_SKU[band as (typeof AI_BANDS)[number]];
  if (!sku) {
    return {
      ok: false,
      message: 'This band means Setnayan AI is not offered, so it has no price to set.',
    };
  }

  const raw = String(formData.get('regular_price_php') ?? '').trim();
  const priceNum = Number(raw);
  if (raw === '' || !Number.isFinite(priceNum) || priceNum <= 0) {
    return { ok: false, message: 'A band price has to be more than ₱0.' };
  }
  const price = round2(priceNum);

  const { data: prior, error: readErr } = await admin
    .from('platform_retail_catalog_v2')
    .select('service_code, title, retail_price_php, onboarding_price_php')
    .eq('service_code', sku)
    .maybeSingle();
  // ⚠ Supabase RESOLVES with `{ error }`. Unchecked, a refused read would write
  // a price with no before-value and log a false audit row.
  if (readErr) return { ok: false, message: `Couldn't read that price — ${readErr.message}` };
  if (!prior) return { ok: false, message: 'That price row no longer exists.' };

  const { data: settings } = await admin
    .from('platform_settings')
    .select('ai_signup_discount_pct')
    .eq('id', 1)
    .maybeSingle();
  const discountPct =
    settings?.ai_signup_discount_pct != null
      ? Number(settings.ai_signup_discount_pct)
      : FAMILY_DISCOUNT_DEFAULT_PCT.ai;

  // The family discount decides the sign-up half — the same function the
  // family-wide save uses, so one band edited here and the whole family edited
  // there can never produce two different answers for the same inputs.
  const signup = signupPriceFor(price, discountPct);

  const before = {
    regular: Number(prior.retail_price_php),
    signup: prior.onboarding_price_php == null ? null : Number(prior.onboarding_price_php),
  };
  if (before.regular === price && before.signup === signup) {
    return { ok: true, message: 'No changes to save.' };
  }

  const { error } = await admin
    .from('platform_retail_catalog_v2')
    .update({
      retail_price_php: price,
      onboarding_price_php: signup,
      updated_at: new Date().toISOString(),
      updated_by_admin_id: adminUserId,
    })
    .eq('service_code', sku);
  if (error) return { ok: false, message: `Couldn't save — ${error.message}` };

  await admin.from('admin_audit_log').insert({
    action: 'ai_band_price_edit',
    target_id: sku,
    actor_user_id: adminUserId,
    metadata: {
      table: 'platform_retail_catalog_v2',
      band,
      before,
      after: { regular: price, signup },
      discountPct,
    },
  });

  revalidatePath('/admin/pricing');
  revalidatePath('/pricing');
  return {
    ok: true,
    message:
      signup == null
        ? `Saved — band ${band} is ₱${price.toLocaleString('en-PH')}.`
        : `Saved — band ${band} is ₱${price.toLocaleString('en-PH')}, ₱${signup.toLocaleString('en-PH')} during set-up.`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · THE REST OF PAPIC — the products that are not ladder rungs
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sets ONE non-rung Papic product's regular price.
 *
 * ⚖ Owner 2026-08-29, of the Papic tab: *"free credits should be here. with the
 * rest of papic services and the thank you video."* The tab held the credit
 * ladder and nothing else, so the whole Papic picture was never in one place.
 *
 * ⛔ SCOPED TO PAPIC, AND THE SCOPE IS THE SECURITY. The code arrives from a
 * browser; without this test the action would be a general "write any price"
 * endpoint reachable from one admin screen. A rung is refused too — those are
 * derived from the ladder's anchors and typing one here would be overwritten by
 * the next ladder save, silently.
 *
 * 🔑 THE FOUR CAMERA RATES ARE EDITABLE HERE EVEN THOUGH THEY ARE SWITCHED OFF,
 * and that is deliberate rather than an oversight. `fetchCameraRates` reads all
 * four PAST `is_active`, and two of them price a charge a couple can make today.
 * A price that still charges must be visible where prices are set — burying it
 * on a "switched off" shelf is how a live number stops being looked at.
 */
export async function savePapicProductPrice(
  _prev: RowActionState,
  formData: FormData,
): Promise<RowActionState> {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();

  const code = String(formData.get('service_code') ?? '').trim().toUpperCase();
  if (!code.startsWith('PAPIC')) {
    return { ok: false, message: 'That is not a Papic price.' };
  }
  if (/^PAPIC_GUEST(_|$)/.test(code)) {
    return {
      ok: false,
      message: 'Credit rungs are set by the ladder above — a price typed here would be overwritten.',
    };
  }

  const raw = String(formData.get('regular_price_php') ?? '').trim();
  if (raw === '') return { ok: false, message: 'A price is needed.' };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return { ok: false, message: 'A price must be ₱0 or more.' };
  const price = round2(n);

  const { data: prior, error: readErr } = await admin
    .from('platform_retail_catalog_v2')
    .select('service_code, title, retail_price_php, is_active')
    .eq('service_code', code)
    .maybeSingle();
  // ⚠ Supabase RESOLVES with `{ error }`. Unchecked, a refused read would write
  // a price with no before-value and log a false audit row.
  if (readErr) return { ok: false, message: `Couldn't read that price — ${readErr.message}` };
  if (!prior) return { ok: false, message: 'That price no longer exists.' };

  const before = Number(prior.retail_price_php);
  if (before === price) return { ok: true, message: 'No changes to save.' };

  const { error } = await admin
    .from('platform_retail_catalog_v2')
    .update({
      retail_price_php: price,
      updated_at: new Date().toISOString(),
      updated_by_admin_id: adminUserId,
    })
    .eq('service_code', code);
  if (error) return { ok: false, message: `Couldn't save — ${error.message}` };

  await admin.from('admin_audit_log').insert({
    action: 'papic_product_price_edit',
    target_id: code,
    actor_user_id: adminUserId,
    metadata: {
      table: 'platform_retail_catalog_v2',
      before: { regular: before },
      after: { regular: price },
      wasActive: prior.is_active === true,
    },
  });

  revalidatePath('/admin/pricing');
  revalidatePath('/pricing');
  return { ok: true, message: `Saved — ₱${price.toLocaleString('en-PH')}.` };
}
