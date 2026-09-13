/**
 * event-costs — money the couple spends with NOBODY on the other side of it.
 * (BA7 · Explore_Replan_BUILD_SPEC_2026-07-27 §18.5)
 *
 * ── The defect this closes ──────────────────────────────────────────────────
 * `event_vendor_line_items.vendor_id` is `UUID NOT NULL REFERENCES
 * event_vendors(vendor_id)`. Every peso had to hang off a supplier row, so a
 * couple could not write down their first ₱ until they invented one — and
 * `/budget` said so out loud: *"No vendors yet. Add a vendor first, then come
 * back here to itemize costs."*
 *
 * The taxonomy already NAMES costs the schema could not hold. `rings`,
 * `attire`, `officiant`, `wedding_paperwork` and `travel_honeymoon` are live
 * plan groups; the page recommends a rings budget (`budget_leaf_benchmarks`
 * carries `rings` = ₱40,000 in production, measured 2026-09-03) and offered no
 * way to record buying rings. Nobody supplies you a marriage licence fee, the
 * tips you hand out on the day, or the ang pao the Chinese-tradition card on
 * that very page describes.
 *
 * ⚠ ONE HALF OF THE ORDER THAT PRODUCED THIS FILE WAS WRONG, recorded here
 * because the next session will read this and not the brief: of those five
 * groups only THREE carry a seeded benchmark (attire · officiant · rings).
 * `wedding_paperwork` and `travel_honeymoon` have no row in
 * `budget_leaf_benchmarks` at all — not a NULL, no row — so BA3's
 * `plannedFrom()` folds their Planned column to `null` ("no typical price
 * yet"), which is the truth. Re-measure with
 * `select plan_group_id, benchmark_php from budget_leaf_benchmarks;`, never
 * from this comment.
 *
 * ── TWO DOORS, and the fork is one question ────────────────────────────────
 * Owner, 2026-09-02, verbatim: *"if they add a budget it means it is
 * automatically locked. and it will automatically be on the marketplace as
 * well. then they also get a QR Code to add that vendor to the app (already
 * planned before)."*
 *
 * So one form, and the fork is whether a supplier was named:
 *
 *   · SUPPLIER NAMED   → an `event_vendors` row at `contracted` (LOCKED), which
 *                        IS the Merkado row, plus an `event_vendor_line_items`
 *                        row for the cost and an `event_vendor_payments` row
 *                        for anything already handed over, plus a claim QR
 *                        rendered from the EXISTING `/vendor/claim/[token]`
 *                        link. Nothing new is plumbed.
 *   · NO SUPPLIER      → one `event_costs` row. No Merkado row, no QR — there
 *                        is nobody to invite.
 *
 * 🔑 THAT FORK IS WHAT KEEPS THE COUNTING LAW ("one peso, one row, one
 * costKey") STRUCTURAL. A cost is in exactly one of the two homes, decided by
 * a fact about the world, never by which screen the couple used.
 *
 * ⚖ LOCKED IS NOT THE SAME AS ON-PLATFORM, and this file must not conflate
 * them. Owner: *"Adding them to their shortlist does not mean it is final, it
 * just means they are not on the app."* `marketplace_vendor_id IS NULL` says
 * they have no Setnayan account; `status >= 'contracted'` says the money is
 * real. A supplier created here is BOTH — off-platform AND final — which is
 * exactly why it gets both a locked row and an invite.
 *
 * Pure: no Supabase, no React, no clock. All amounts whole-or-decimal PHP.
 */

import { OTHER_BUCKET, bucketLabel } from './budget-truth';
import { PLAN_GROUPS, planGroupsForEventType } from './wedding-plan-groups';
import type { VendorCategory } from './vendors';

/** Matches `event_costs.label`'s CHECK, and `event_vendor_line_items.label`. */
export const EVENT_COST_LABEL_MAX = 64;
/** Matches `event_costs.note`'s CHECK. */
export const EVENT_COST_NOTE_MAX = 280;
/** Matches `event_manual_vendors.business_name` / `event_vendors.vendor_name`. */
export const SUPPLIER_NAME_MAX = 128;

/**
 * Hard ceiling on one recorded cost, mirroring `setEventBudget`'s ₱100M on the
 * target. Not a judgement about anyone's wedding — it is the guard that keeps a
 * fat-fingered paste out of NUMERIC(12,2) and out of every downstream total.
 */
export const EVENT_COST_MAX_PHP = 100_000_000;

/**
 * A category the couple can file a cost under: every plan group their event
 * type actually shows, plus `other`.
 *
 * 🔑 THE ID IS `plan_group_id`, WHICH IS THE SAME NAMESPACE AS
 * `MoneyBucket.bucketId` AND AS `budget_allocation_decisions.canonical_service`
 * (that table's own docblock says so). That is the whole reason a cost filed
 * here lands on the row BA3's ledger is already printing, instead of opening a
 * second row beside it. No join table, and none should be invented.
 */
export type CostCategoryOption = { id: string; label: string };

export function costCategoryOptions(
  eventType: string | null | undefined,
): CostCategoryOption[] {
  const groups = planGroupsForEventType(eventType).map((g) => ({
    id: g.id as string,
    label: g.label,
  }));
  groups.sort((a, b) => a.label.localeCompare(b.label));
  // `other` last, always: it is the fallback, not a peer, and a couple
  // scanning an alphabetical list should hit the real categories first.
  return [...groups, { id: OTHER_BUCKET, label: bucketLabel(OTHER_BUCKET) }];
}

const PLAN_GROUP_IDS = new Set<string>(PLAN_GROUPS.map((g) => g.id as string));

/** True for an id `event_costs.plan_group_id` may legitimately hold. */
export function isCostCategoryId(value: unknown): value is string {
  return typeof value === 'string' && (PLAN_GROUP_IDS.has(value) || value === OTHER_BUCKET);
}

/**
 * The `event_vendors.category` to stamp when a supplier IS named.
 *
 * A plan group's `categories[0]` is its primary vendor category — the same
 * precedence `bucketForVendor` reads back, so the row this creates buckets
 * into the category the couple picked and not some other one. Five groups
 * (`stylist`, `live_band`, `dance_instructor`, `after_party_music`,
 * `guest_shuttle`) carry an EMPTY `categories` array on purpose: they are
 * entry-point cards whose underlying category is owned by another card. They
 * fall to `misc`, and `covers_plan_groups` — which `bucketForVendor` reads
 * FIRST — still carries the group the couple chose, so the money lands right
 * regardless.
 */
export function vendorCategoryForCostCategory(planGroupId: string): VendorCategory {
  const group = PLAN_GROUPS.find((g) => (g.id as string) === planGroupId);
  return (group?.categories[0] ?? 'misc') as VendorCategory;
}

/**
 * Parse a PHP amount the couple typed.
 *
 * Accepts what the budget setter already accepts — `₱ 40,000`, `40000`,
 * `1,500.50` — because a couple who has just used the setter above will type
 * the same way here. Returns `null` for blank, non-numeric, negative and
 * out-of-range, so the caller decides what each of those MEANS (a blank
 * `paid` is ₱0; a blank `amount` is an error).
 *
 * ⚠ A THIRD LOCAL COPY OF A MONEY PARSER, AND IT IS DELIBERATE. Two private
 * ones already exist — `budget/actions.ts` and `vendors/actions.ts` — and both
 * are trapped: a `'use server'` module may export only async functions, so
 * neither can be imported. This one lives in a PURE module precisely so it is
 * the one that can be shared and unit-tested; the honest fix for the other two
 * is to point them here, which is a refactor of files BA7 does not touch.
 */
export function parseCostAmountPhp(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const stripped = raw.replace(/[₱,\s]/g, '').trim();
  if (stripped.length === 0) return null;
  const n = Number(stripped);
  if (!Number.isFinite(n) || n < 0 || n > EVENT_COST_MAX_PHP) return null;
  return Math.round(n * 100) / 100;
}

/** `YYYY-MM-DD`, the shape a `DATE` column round-trips. */
export function isIsoDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export type CostDraft = {
  planGroupId: string;
  label: string;
  amountPhp: number;
  paidPhp: number;
  dueDate: string | null;
  note: string | null;
  /** Trimmed, or null when the couple named nobody. Drives the whole fork. */
  supplierName: string | null;
};

export type CostDraftResult =
  | { ok: true; draft: CostDraft }
  | { ok: false; error: string };

/**
 * Validate one submitted cost.
 *
 * Pure and total: every rejection is a sentence a couple can act on, and there
 * is no path that silently drops a field. Split out from the server action so
 * every branch — including the ones that are awkward to reach through a form —
 * is unit-testable without a database.
 */
export function readCostDraft(fields: {
  planGroupId: unknown;
  label: unknown;
  amountPhp: unknown;
  paidPhp: unknown;
  dueDate: unknown;
  note: unknown;
  supplierName: unknown;
}): CostDraftResult {
  if (!isCostCategoryId(fields.planGroupId)) {
    return { ok: false, error: 'Pick a category for this cost.' };
  }

  const label = typeof fields.label === 'string' ? fields.label.trim() : '';
  if (label.length === 0) {
    return { ok: false, error: 'Say what this cost was for.' };
  }
  if (label.length > EVENT_COST_LABEL_MAX) {
    return { ok: false, error: `Keep it to ${EVENT_COST_LABEL_MAX} characters or fewer.` };
  }

  const amountPhp = parseCostAmountPhp(fields.amountPhp);
  if (amountPhp === null || amountPhp <= 0) {
    return { ok: false, error: 'Enter what it cost, as a number above zero.' };
  }

  // Blank means ₱0 — "I have written this down but not paid it yet" is a
  // perfectly ordinary thing to record, and it must not be an error. A typed
  // but unparseable value IS an error: silently reading it as ₱0 would tell
  // the couple they still owe money they have already handed over.
  const paidRaw = typeof fields.paidPhp === 'string' ? fields.paidPhp.trim() : '';
  const paidPhp = paidRaw.length === 0 ? 0 : parseCostAmountPhp(paidRaw);
  if (paidPhp === null) {
    return { ok: false, error: 'Enter what you have paid so far, or leave it blank.' };
  }

  const dueRaw = typeof fields.dueDate === 'string' ? fields.dueDate.trim() : '';
  if (dueRaw.length > 0 && !isIsoDateString(dueRaw)) {
    return { ok: false, error: 'That due date is not a real date.' };
  }

  const noteRaw = typeof fields.note === 'string' ? fields.note.trim() : '';
  if (noteRaw.length > EVENT_COST_NOTE_MAX) {
    return { ok: false, error: `Keep the note to ${EVENT_COST_NOTE_MAX} characters or fewer.` };
  }

  const supplierRaw =
    typeof fields.supplierName === 'string' ? fields.supplierName.trim() : '';
  if (supplierRaw.length > SUPPLIER_NAME_MAX) {
    return { ok: false, error: `Keep the supplier name to ${SUPPLIER_NAME_MAX} characters or fewer.` };
  }

  return {
    ok: true,
    draft: {
      planGroupId: fields.planGroupId,
      label,
      amountPhp,
      paidPhp,
      dueDate: dueRaw.length > 0 ? dueRaw : null,
      note: noteRaw.length > 0 ? noteRaw : null,
      supplierName: supplierRaw.length > 0 ? supplierRaw : null,
    },
  };
}
