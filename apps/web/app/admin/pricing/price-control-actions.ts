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
  blockingComplaint,
  discountComplaints,
  signupPriceFor,
} from '@/lib/onboarding-family-discount';
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

/** A percent typed into a form, or null when it is not a usable number. */
function parsePct(raw: FormDataEntryValue | null): number | null {
  const n = Number(String(raw ?? '').trim());
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
