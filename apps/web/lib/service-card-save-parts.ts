import type { SupabaseClient } from '@supabase/supabase-js';
import {
  MAX_SCHEDULE_ITEMS,
  pctToBps,
  phpToCentavos,
  type AmountKind,
  type DueAnchor,
} from '@/lib/vendor-service-payment-schedules';
import {
  SLOT_CAPACITY_MAX,
  SLOT_CAPACITY_MIN,
  SLOT_LABEL_MAX,
  SLOT_TIME_RE,
} from '@/lib/vendor-time-slots';

/**
 * service-card-save-parts.ts — THE PARTS OF A CARD THAT USED TO NEED THEIR OWN SAVE, PARSED ONCE.
 *
 * The simpler maker (supplier-easy step 3, 2026-10-14) shows every field of a card on one screen with ONE save:
 * Create on a new card, Save on an existing one (owner 2026-10-08 Q3 "one create button"). Four parts of a card were
 * only ever written by their own per-part action and their own button — the payment schedule (with the no-show terms
 * on its first payment), the add-ons, the time slots and which schedule the card books on. Each parser here is the
 * one the per-part action uses AND the one `commitVendorService` uses, so the two doors cannot read the same fields
 * two ways.
 *
 * Pure parsing (throws a supplier-readable sentence on a bad row) + small owner-scoped writes. No redirects: the
 * callers decide where a refusal lands.
 */

// ── Payment schedule ────────────────────────────────────────────────────────

export type ParsedScheduleRow = {
  seq: number;
  label: string;
  amount_kind: AmountKind;
  percent_bps: number | null;
  amount_centavos: number | null;
  due_anchor: DueAnchor | null;
  due_offset_days: number | null;
  cancellation_terms: string | null;
  downpayment_non_refundable: boolean;
  refund_window_days: number | null;
  no_show_forfeit: boolean;
};

/**
 * Parse the payment-schedule parallel arrays (`item_*`), the no-show reservation terms included. The terms live on
 * the first payment (seq 0) ONLY — a stray value on a later row is ignored, so it can never smuggle a policy onto a
 * later installment. Throws on the first bad row; never half-applies.
 */
export function parsePaymentScheduleForm(formData: FormData): ParsedScheduleRow[] {
  const labels = formData.getAll('item_label');
  const kinds = formData.getAll('item_amount_kind');
  const values = formData.getAll('item_value');
  const anchors = formData.getAll('item_due_anchor');
  const offsets = formData.getAll('item_due_offset_days');
  const nonRefundables = formData.getAll('item_downpayment_non_refundable');
  const noShowForfeits = formData.getAll('item_no_show_forfeit');
  const refundWindows = formData.getAll('item_refund_window_days');
  const cancellationTerms = formData.getAll('item_cancellation_terms');

  const n = labels.length;
  if (n > MAX_SCHEDULE_ITEMS) {
    throw new Error(`A schedule can have up to ${MAX_SCHEDULE_ITEMS} payments.`);
  }
  const rows: ParsedScheduleRow[] = [];
  for (let i = 0; i < n; i++) {
    const label = typeof labels[i] === 'string' ? (labels[i] as string).trim() : '';
    if (label.length === 0 || label.length > 80) {
      throw new Error('Each payment needs a label (up to 80 characters).');
    }
    const kindRaw = kinds[i];
    if (kindRaw !== 'percent' && kindRaw !== 'fixed') {
      throw new Error('Each payment must be a percent or a fixed amount.');
    }
    const amount_kind: AmountKind = kindRaw;
    const valueRaw = typeof values[i] === 'string' ? (values[i] as string).trim() : '';
    const value = Number(valueRaw);
    if (valueRaw.length === 0 || !Number.isFinite(value) || value < 0) {
      throw new Error('Each payment needs a non-negative amount.');
    }
    let percent_bps: number | null = null;
    let amount_centavos: number | null = null;
    if (amount_kind === 'percent') {
      if (!Number.isInteger(value) || value > 100) {
        throw new Error('A percentage must be a whole number between 0 and 100.');
      }
      percent_bps = pctToBps(value);
    } else {
      if (!Number.isInteger(value)) {
        throw new Error('A fixed amount must be a whole peso figure.');
      }
      amount_centavos = phpToCentavos(value);
    }
    const anchorRaw = anchors[i];
    let due_anchor: DueAnchor | null = null;
    let due_offset_days: number | null = null;
    if (anchorRaw === 'on_lock' || anchorRaw === 'before_event') {
      due_anchor = anchorRaw;
      const offRaw = typeof offsets[i] === 'string' ? (offsets[i] as string).trim() : '';
      if (offRaw.length > 0) {
        const off = Number(offRaw);
        if (!Number.isInteger(off) || off < 0) {
          throw new Error('Due-date days must be a non-negative whole number.');
        }
        due_offset_days = off;
      } else {
        due_offset_days = 0;
      }
    }
    let cancellation_terms: string | null = null;
    let downpayment_non_refundable = false;
    let refund_window_days: number | null = null;
    let no_show_forfeit = false;
    if (i === 0) {
      downpayment_non_refundable = nonRefundables[i] === '1';
      no_show_forfeit = noShowForfeits[i] === '1';
      const termsRaw =
        typeof cancellationTerms[i] === 'string' ? (cancellationTerms[i] as string).trim() : '';
      cancellation_terms = termsRaw.length > 0 ? termsRaw.slice(0, 2000) : null;
      const windowRaw =
        typeof refundWindows[i] === 'string' ? (refundWindows[i] as string).trim() : '';
      if (windowRaw.length > 0) {
        const w = Number(windowRaw);
        if (!Number.isInteger(w) || w < 0) {
          throw new Error('Refund window must be a non-negative whole number of days.');
        }
        refund_window_days = w;
      }
    }
    rows.push({
      seq: i,
      label: label.slice(0, 80),
      amount_kind,
      percent_bps,
      amount_centavos,
      due_anchor,
      due_offset_days,
      cancellation_terms,
      downpayment_non_refundable,
      refund_window_days,
      no_show_forfeit,
    });
  }
  return rows;
}

/** Does the first payment carry any no-show term? (The atomic save RPC writes the schedule WITHOUT them.) */
export function scheduleHasPolicy(rows: readonly ParsedScheduleRow[]): boolean {
  const first = rows[0];
  return Boolean(
    first &&
      (first.cancellation_terms !== null ||
        first.downpayment_non_refundable ||
        first.refund_window_days !== null ||
        first.no_show_forfeit),
  );
}

/**
 * Write the first payment's no-show terms onto the row `save_vendor_service` just replaced. Owner-scoped. The RPC's
 * replace-all inserts the schedule without these four columns, so without this a card's reservation terms would be
 * dropped silently on every save from the maker.
 */
export async function writeSchedulePolicy(
  supabase: SupabaseClient,
  serviceId: string,
  vendorProfileId: string,
  rows: readonly ParsedScheduleRow[],
): Promise<string | null> {
  const first = rows[0];
  if (!first || !scheduleHasPolicy(rows)) return null;
  const { error } = await supabase
    .from('vendor_service_payment_schedules')
    .update({
      cancellation_terms: first.cancellation_terms,
      downpayment_non_refundable: first.downpayment_non_refundable,
      refund_window_days: first.refund_window_days,
      no_show_forfeit: first.no_show_forfeit,
    })
    .eq('vendor_service_id', serviceId)
    .eq('vendor_profile_id', vendorProfileId)
    .eq('seq', 0);
  return error ? error.message : null;
}

// ── Add-ons ─────────────────────────────────────────────────────────────────

export const MAX_ADDONS = 12;

export type ParsedAddon = { label: string; from_price_php: number | null; sort_order: number };

/** `addon_label[]` / `addon_price[]` → rows. Blank labels are dropped; at most 12. */
export function parseAddonRows(formData: FormData): ParsedAddon[] {
  const labels = formData.getAll('addon_label').map((v) => String(v));
  const prices = formData.getAll('addon_price').map((v) => String(v));
  const rows: ParsedAddon[] = [];
  for (let i = 0; i < labels.length && rows.length < MAX_ADDONS; i++) {
    const label = (labels[i] ?? '').trim();
    if (!label) continue;
    const priceRaw = (prices[i] ?? '').trim();
    const priceNum = priceRaw === '' ? NaN : Math.round(Number(priceRaw));
    rows.push({
      label: label.slice(0, 80),
      from_price_php: Number.isFinite(priceNum) && priceNum >= 0 ? priceNum : null,
      sort_order: rows.length,
    });
  }
  return rows;
}

/** Replace-all, owner-scoped: DELETE then INSERT. Returns an error sentence or null. */
export async function replaceServiceAddons(
  supabase: SupabaseClient,
  serviceId: string,
  vendorProfileId: string,
  rows: readonly ParsedAddon[],
): Promise<string | null> {
  const del = await supabase
    .from('vendor_service_addons')
    .delete()
    .eq('vendor_service_id', serviceId)
    .eq('vendor_profile_id', vendorProfileId);
  if (del.error) return del.error.message;
  if (rows.length === 0) return null;
  const ins = await supabase.from('vendor_service_addons').insert(
    rows.map((r) => ({ ...r, vendor_service_id: serviceId, vendor_profile_id: vendorProfileId })),
  );
  return ins.error ? ins.error.message : null;
}

// ── Time slots ──────────────────────────────────────────────────────────────

export type ParsedSlot = {
  slot_label: string;
  start_time: string;
  end_time: string;
  slot_capacity: number;
  display_order: number;
};

/** One slot's checks — the SAME as `addServiceTimeSlot` always made. Throws a supplier-readable sentence. */
export function checkSlot(input: {
  label: string;
  start: string;
  end: string;
  capRaw: string;
  orderRaw?: string;
}): ParsedSlot {
  const label = input.label.trim();
  const cap = input.capRaw.trim().length === 0 ? 1 : Number(input.capRaw.trim());
  const order = (input.orderRaw ?? '').trim().length === 0 ? 0 : Number((input.orderRaw ?? '').trim());
  if (!label || label.length > SLOT_LABEL_MAX) {
    throw new Error(`Slot label is required (up to ${SLOT_LABEL_MAX} characters).`);
  }
  if (!SLOT_TIME_RE.test(input.start) || !SLOT_TIME_RE.test(input.end)) {
    throw new Error('Times must be on the hour or half-hour (e.g. 08:00, 14:30).');
  }
  if (input.end <= input.start) throw new Error('End time must be after start time.');
  if (!Number.isInteger(cap) || cap < SLOT_CAPACITY_MIN || cap > SLOT_CAPACITY_MAX) {
    throw new Error(`Capacity must be a whole number ${SLOT_CAPACITY_MIN}–${SLOT_CAPACITY_MAX}.`);
  }
  if (!Number.isInteger(order) || order < 0) throw new Error('Display order must be a non-negative whole number.');
  return { slot_label: label, start_time: input.start, end_time: input.end, slot_capacity: cap, display_order: order };
}

/**
 * The maker's NEW slot rows (`new_slot_label[]` · `new_slot_start[]` · `new_slot_end[]` · `new_slot_capacity[]`). A
 * row left wholly blank is dropped; a half-filled one is refused with the sentence `addServiceTimeSlot` gives.
 */
export function parseNewSlotRows(formData: FormData): ParsedSlot[] {
  const labels = formData.getAll('new_slot_label').map(String);
  const starts = formData.getAll('new_slot_start').map(String);
  const ends = formData.getAll('new_slot_end').map(String);
  const caps = formData.getAll('new_slot_capacity').map(String);
  const out: ParsedSlot[] = [];
  for (let i = 0; i < labels.length; i++) {
    const blank = !(labels[i] ?? '').trim() && !(starts[i] ?? '') && !(ends[i] ?? '');
    if (blank) continue;
    out.push(
      checkSlot({ label: labels[i] ?? '', start: starts[i] ?? '', end: ends[i] ?? '', capRaw: caps[i] ?? '', orderRaw: String(i) }),
    );
  }
  return out;
}

/** The slots a supplier ticked to remove (`remove_slot_id[]`). Removing soft-deactivates, as `deleteServiceTimeSlot` does. */
export function parseRemovedSlotIds(formData: FormData): string[] {
  return Array.from(
    new Set(
      formData
        .getAll('remove_slot_id')
        .map(String)
        .filter((s) => /^[0-9a-f-]{36}$/i.test(s)),
    ),
  );
}

// ── Which schedule the card books on ────────────────────────────────────────

/**
 * The Schedule row's answer (`schedule_choice`): '' (unchanged) · 'own' (a schedule of its own) · a pool id (share
 * that schedule). Anything else is read as unchanged — the row never writes a value it did not offer.
 */
export function parseScheduleChoice(raw: FormDataEntryValue | null): '' | 'own' | { poolId: string } {
  if (typeof raw !== 'string' || raw.length === 0) return '';
  if (raw === 'own') return 'own';
  return /^[0-9a-f-]{36}$/i.test(raw) ? { poolId: raw } : '';
}

/**
 * Put a card on its schedule. A pool id → the card's named-calendar membership points there (the service-level
 * membership `resolvePoolIdsForService` reads first); 'own' → a fresh schedule named after the card, and the card on
 * it. Ownership is re-checked on the pool. Returns an error sentence or null.
 */
export async function assignCardSchedule(
  supabase: SupabaseClient,
  vendorProfileId: string,
  serviceId: string,
  choice: 'own' | { poolId: string },
  name: string,
): Promise<string | null> {
  let poolId: string;
  if (choice === 'own') {
    const { data, error } = await supabase
      .from('vendor_schedule_pools')
      .insert({
        vendor_profile_id: vendorProfileId,
        calendar_name: name.slice(0, 80),
        pool_label: name.slice(0, 80),
        is_vendor_created: true,
      })
      .select('pool_id')
      .maybeSingle();
    if (error || !data) {
      if (error) console.error('[supabase-error] lib/service-card-save-parts.ts · from:vendor_schedule_pools.insert', error);
      return 'Your card was saved, but its own schedule could not be made. Set it from Dates.';
    }
    poolId = (data as { pool_id: string }).pool_id;
  } else {
    const { data: pool } = await supabase
      .from('vendor_schedule_pools')
      .select('pool_id')
      .eq('pool_id', choice.poolId)
      .eq('vendor_profile_id', vendorProfileId)
      .eq('is_active', true)
      .maybeSingle();
    if (!pool) return 'Your card was saved, but that schedule is not yours any more. Pick one from Dates.';
    poolId = choice.poolId;
  }
  const { error: memErr } = await supabase
    .from('vendor_schedule_calendar_services')
    .upsert(
      { vendor_service_id: serviceId, pool_id: poolId, vendor_profile_id: vendorProfileId },
      { onConflict: 'vendor_service_id' },
    );
  if (memErr) {
    console.error('[supabase-error] lib/service-card-save-parts.ts · from:vendor_schedule_calendar_services.upsert', memErr);
    return 'Your card was saved, but its schedule could not be set. Set it from Dates.';
  }
  return null;
}
