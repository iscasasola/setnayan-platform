/**
 * THE PRICING SNAPSHOT — a locked order is FROZEN.
 *
 * Pure module — no env, no clock, no I/O. Runs under `tsx --test`.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 * Once a couple locks a package, the money is settled. Nothing the vendor does
 * afterwards — raising an hourly rate, lowering an hour cap, retiring an
 * option, narrowing a pick range, deleting an option row — may change what that
 * booking costs. Neither may a change to the couple's guest count, nor an
 * operator flipping the pricing-model flag. **Only the couple's own removal
 * removes things, and a removal can only ever make the total smaller.**
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * `removeItemFromPackage` re-prices the whole booking from scratch, and before
 * this module it re-priced from LIVE vendor rows under the LIVE flag. Three
 * confirmed money defects fell out of that:
 *
 *   1. Extra hours were persisted as a QUANTITY only, so a removal re-billed
 *      already-locked hours at whatever rate the vendor happened to have now.
 *      Measured: 3h locked at ₱500 = ₱11,500; vendor edits to ₱900; couple
 *      removes an unrelated ₱1,000 line; total goes UP to ₱11,700.
 *   2. The removal re-fetches options with `.eq('is_available', true)`, so a
 *      pick whose option the vendor later retired vanished from the narrowed
 *      set and the charge silently disappeared — fail-OPEN, where the pre-diff
 *      path threw.
 *   3. Option deltas and hours are credit SPEND under the credit model (they
 *      drain the pool first) and a flat surcharge under the legacy one. A flag
 *      rollback between lock and removal therefore re-priced the same booking
 *      UPWARD — and the booking fee rides on that total.
 *
 * The fix is one idea: at lock we write down every number that decided the
 * price, and the removal re-prices FROM THAT WRITING, under the model recorded
 * in it. Live rows then contribute only STRUCTURE (which lines exist, what
 * hangs off what) — never a peso.
 *
 * This is the same freeze the sibling `credit_additions` block already had
 * ("a removal must not silently re-rate a purchase the couple already made"),
 * and the same reasoning as `orders.pax_snapshot`. Money that has been agreed
 * gets frozen; it is not looked up again.
 *
 * ── WHERE IT LIVES ──────────────────────────────────────────────────────────
 * `event_vendor_packages.customizations_json.pricing_snapshot`. No migration:
 * the column is already JSONB and already carries the sibling frozen record
 * (`credit_additions[].unit_price_centavos`).
 *
 * Money is BIGINT CENTAVOS throughout.
 */

import {
  formatCentavosPhp,
  isChoiceLine,
  type VendorPackageItemOptionRow,
  type VendorPackageItemRow,
  type VendorPackageWithItems,
} from './vendor-packages';
import { optionDeltaCentavos, pickBounds } from './package-credit';
import type { CreditAddition, CreditCatalogueEntry } from './package-credit';
import { priceCustomizedPackage } from './package-credit-adapter';
import { chargeableExtraHours, chargeableOptionIds } from './package-choice-tree';

/* ──────────────────────────────────────────────────────────────────────── */
/* The shape                                                                */
/* ──────────────────────────────────────────────────────────────────────── */

/** One option the lock actually charged for, at the price it charged. */
export type PricingSnapshotOption = {
  item_id: string;
  option_id: string;
  /** The vendor's label AT LOCK, so a later rename cannot rewrite the receipt. */
  label: string;
  /**
   * FROZEN. For a per-head option this is the already-multiplied amount at the
   * lock's own head count — which is why replay treats every snapshot option as
   * `pricing_basis: 'fixed'`. Re-multiplying it by a live pax count would be a
   * second, different price for the same agreed upgrade.
   */
  delta_centavos: number;
};

/** One line carrying extra hours, at the rate and cap that applied. */
export type PricingSnapshotHours = {
  item_id: string;
  label: string;
  hours: number;
  /** FROZEN — defect (1) above is exactly this number being looked up again. */
  rate_centavos: number;
  /** FROZEN too: a vendor lowering the cap must not silently clamp locked hours. */
  max_extra_hours: number;
};

export type PackagePricingSnapshot = {
  /** Bumped only for a breaking shape change; readers refuse anything else. */
  version: 1;
  /**
   * WHICH PRICING MODEL priced this lock. TRUE = the credit engine (deltas and
   * hours are spend against the pool); FALSE = the legacy path (they are a flat
   * surcharge). Replayed verbatim, never re-read from the live flag — that is
   * defect (3).
   */
  credit_model: boolean;
  /** The head count that resolved every per-head delta above. */
  pax_count: number;
  options: PricingSnapshotOption[];
  extra_hours: PricingSnapshotHours[];
};

export const PRICING_SNAPSHOT_VERSION = 1 as const;

/* ──────────────────────────────────────────────────────────────────────── */
/* Build — at lock                                                          */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Write down what the lock charged, from the SERVER's own narrowed sets.
 *
 * Callers must pass the narrowed `chosenOptionIds` / `extraHours` — the ones
 * that actually reached the pricer — not the browser's request. Snapshotting
 * the request would record charges that were never made.
 */
export function buildPricingSnapshot({
  pkg,
  chosenOptionIds,
  extraHours,
  paxCount,
  creditEnabled,
}: {
  pkg: VendorPackageWithItems;
  chosenOptionIds: ReadonlyArray<string>;
  extraHours: Readonly<Record<string, number>>;
  paxCount: number;
  creditEnabled: boolean;
}): PackagePricingSnapshot {
  const charged = new Set(chosenOptionIds);
  const options: PricingSnapshotOption[] = [];
  const hours: PricingSnapshotHours[] = [];

  for (const item of pkg.items ?? []) {
    for (const option of item.options ?? []) {
      if (!charged.has(option.option_id)) continue;
      options.push({
        item_id: item.item_id,
        option_id: option.option_id,
        label: option.option_label,
        // Resolved HERE, at the lock's pax — see the field doc.
        delta_centavos: optionDeltaCentavos(option, paxCount),
      });
    }

    const requested = extraHours?.[item.item_id];
    if (requested === undefined || requested <= 0) continue;
    const rate = item.extra_hour_centavos;
    const cap = item.max_extra_hours;
    // A line with no rate or no cap could not have been billed for hours, so
    // there is nothing to freeze. `chargeableExtraHours` already dropped it.
    if (rate == null || cap == null) continue;
    hours.push({
      item_id: item.item_id,
      label: item.service_description,
      hours: requested,
      rate_centavos: Number(rate),
      max_extra_hours: Number(cap),
    });
  }

  return {
    version: PRICING_SNAPSHOT_VERSION,
    credit_model: creditEnabled === true,
    pax_count: Number.isSafeInteger(paxCount) && paxCount > 0 ? paxCount : 0,
    options,
    extra_hours: hours,
  };
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Read — defensively                                                       */
/* ──────────────────────────────────────────────────────────────────────── */

const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isCentavos = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

/**
 * Parse a stored snapshot, or `null`.
 *
 * `customizations_json` is JSONB written by an older deploy, a support script,
 * or nothing at all — so every field is checked rather than cast. `null` means
 * "no usable snapshot", and callers must treat that as a REFUSAL on the money
 * path (there is nothing to freeze against) while the display surfaces simply
 * render no itemization.
 */
export function readPricingSnapshot(raw: unknown): PackagePricingSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const snap = (raw as { pricing_snapshot?: unknown }).pricing_snapshot ?? raw;
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return null;

  const s = snap as Record<string, unknown>;
  if (s.version !== PRICING_SNAPSHOT_VERSION) return null;
  if (typeof s.credit_model !== 'boolean') return null;
  if (!Array.isArray(s.options) || !Array.isArray(s.extra_hours)) return null;

  const options: PricingSnapshotOption[] = [];
  for (const o of s.options as unknown[]) {
    if (!o || typeof o !== 'object') return null;
    const r = o as Record<string, unknown>;
    if (!isId(r.item_id) || !isId(r.option_id) || !isCentavos(r.delta_centavos)) {
      return null;
    }
    options.push({
      item_id: r.item_id,
      option_id: r.option_id,
      label: typeof r.label === 'string' ? r.label : r.option_id,
      delta_centavos: r.delta_centavos,
    });
  }

  const extraHours: PricingSnapshotHours[] = [];
  for (const h of s.extra_hours as unknown[]) {
    if (!h || typeof h !== 'object') return null;
    const r = h as Record<string, unknown>;
    if (
      !isId(r.item_id) ||
      !isCentavos(r.rate_centavos) ||
      typeof r.hours !== 'number' ||
      !Number.isSafeInteger(r.hours) ||
      r.hours <= 0 ||
      typeof r.max_extra_hours !== 'number' ||
      !Number.isSafeInteger(r.max_extra_hours)
    ) {
      return null;
    }
    extraHours.push({
      item_id: r.item_id,
      label: typeof r.label === 'string' ? r.label : r.item_id,
      hours: r.hours,
      rate_centavos: r.rate_centavos,
      max_extra_hours: r.max_extra_hours,
    });
  }

  const pax = s.pax_count;
  return {
    version: PRICING_SNAPSHOT_VERSION,
    credit_model: s.credit_model,
    pax_count: typeof pax === 'number' && Number.isSafeInteger(pax) && pax > 0 ? pax : 0,
    options,
    extra_hours: extraHours,
  };
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Replay — overlay the frozen money onto live rows                         */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Return a package whose MONEY comes from the snapshot and whose STRUCTURE
 * comes from the live rows.
 *
 * Everything downstream — the narrowing, the visibility walk, the engine — then
 * runs unchanged, which is the point: there is no second re-pricing path to
 * keep in step, only a different set of numbers fed to the one that exists.
 *
 * What is overlaid, and which defect each closes:
 *   • a charged option's delta, forced `is_available` and forced `'fixed'`
 *     basis — a retired option survives (2), a re-rated one does not re-rate
 *     (1), and a per-head one is not re-multiplied by a changed guest count;
 *   • an option row that no longer exists at all is SYNTHESISED from the
 *     snapshot, so deleting the row cannot delete the charge either;
 *   • the hour rate and cap (1);
 *   • the pick bounds, so a vendor narrowing "choose 3" to "choose 1" after the
 *     fact cannot make the locked pick set refuse to re-price.
 */
export function applyPricingSnapshot(
  pkg: VendorPackageWithItems,
  snapshot: PackagePricingSnapshot,
): VendorPackageWithItems {
  const optionsByItem = new Map<string, PricingSnapshotOption[]>();
  for (const o of snapshot.options) {
    const list = optionsByItem.get(o.item_id) ?? [];
    list.push(o);
    optionsByItem.set(o.item_id, list);
  }
  const hoursByItem = new Map(snapshot.extra_hours.map((h) => [h.item_id, h]));

  return {
    ...pkg,
    items: (pkg.items ?? []).map((item) => {
      const frozenOptions = optionsByItem.get(item.item_id);
      const frozenHours = hoursByItem.get(item.item_id);
      const choice = isChoiceLine(item);
      if (!frozenOptions && !frozenHours && !choice) return item;

      const next: VendorPackageItemRow = { ...item };

      if (frozenHours) {
        next.extra_hour_centavos = frozenHours.rate_centavos;
        // `max(cap, hours)` so the locked quantity is always inside its own cap
        // even if the vendor has since lowered it below what was bought.
        next.max_extra_hours = Math.max(frozenHours.max_extra_hours, frozenHours.hours);
      }

      if (frozenOptions && frozenOptions.length > 0) {
        const live = [...(item.options ?? [])];
        const indexById = new Map(live.map((o, i) => [o.option_id, i] as const));
        for (const frozen of frozenOptions) {
          const existing =
            indexById.get(frozen.option_id) !== undefined
              ? live[indexById.get(frozen.option_id)!]!
              : undefined;
          const row: VendorPackageItemOptionRow = {
            // Keep the live row's incidental fields (display_order, is_default)
            // when it still exists; synthesise a minimal one when it does not.
            ...(existing ?? {
              option_id: frozen.option_id,
              item_id: item.item_id,
              option_label: frozen.label,
              is_default: false,
              display_order: Number.MAX_SAFE_INTEGER,
              price_delta_centavos: 0,
              is_available: true,
            }),
            option_id: frozen.option_id,
            item_id: item.item_id,
            option_label: frozen.label,
            // 💰 THE FROZEN NUMBER, and the three things that stop it moving.
            price_delta_centavos: frozen.delta_centavos,
            is_available: true,
            pricing_basis: 'fixed',
            per_pax_delta_centavos: 0,
            min_pax: 0,
          };
          const at = indexById.get(frozen.option_id);
          if (at !== undefined) live[at] = row;
          else live.push(row);
        }
        next.options = live;

        // Bounds that always admit exactly the locked pick set.
        const bounds = pickBounds(item);
        next.pick_min = Math.min(bounds.min, frozenOptions.length);
        next.pick_max = Math.max(bounds.max, frozenOptions.length);
      } else if (choice) {
        // A choice line the snapshot charged NOTHING on was priced by its own
        // default at lock, and the engine only does that for a line taking
        // exactly one. Replaying that is what stops a vendor who has since set
        // `pick_min = 2` making an untouched line refuse to re-price.
        next.pick_min = 1;
        next.pick_max = Math.max(1, pickBounds(item).max);
      }

      return next;
    }),
  };
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Re-price after a removal                                                 */
/* ──────────────────────────────────────────────────────────────────────── */

export type RepriceAfterRemovalResult =
  | {
      ok: true;
      bookingTotalCentavos: number;
      remainingConsumableCentavos: number;
      /** The picks that SURVIVED. Persist these — see `reason: 'total_increased'`. */
      chosenOptionIds: string[];
      extraHours: Record<string, number>;
      /** The snapshot narrowed to the survivors, for the NEXT removal to replay. */
      snapshot: PackagePricingSnapshot;
    }
  | { ok: false; reason: 'unpriceable' | 'total_increased' };

/**
 * Re-price a locked booking after the couple drops a line — FROM THE SNAPSHOT,
 * under the RECORDED model.
 *
 * Extracted from `removeItemFromPackage` on purpose. That server action cannot
 * be reached by a unit test, and the two previous money bugs in it were both
 * WIRING bugs (it fetched no options; it re-priced with a different pricer than
 * the lock). Keeping the composition in a pure function means the wiring itself
 * is now asserted rather than merely read — reverting the re-narrow, or the
 * frozen replay, or the persisted-set rewrite, fails a test instead of a review.
 *
 * 🚨 THE INVARIANT: A REMOVAL NEVER INCREASES THE TOTAL. Dropping a line can
 * only remove charges — its own value, its picks, its hours, and everything its
 * options revealed. Any arithmetic that comes out higher means an input moved
 * that should have been frozen, so this refuses rather than writing the bigger
 * number. The booking fee rides on that total; a silent increase is a repricing
 * of an agreed order, which is never a side effect of anything.
 */
export function repriceAfterRemoval({
  pkg,
  snapshot,
  removedItemIds,
  additions,
  catalogue,
  lockedTotalCentavos,
}: {
  pkg: VendorPackageWithItems;
  snapshot: PackagePricingSnapshot;
  removedItemIds: ReadonlyArray<string>;
  additions: ReadonlyArray<CreditAddition>;
  catalogue: ReadonlyArray<CreditCatalogueEntry>;
  lockedTotalCentavos: number;
}): RepriceAfterRemovalResult {
  const frozen = applyPricingSnapshot(pkg, snapshot);

  const lockedOptionIds = snapshot.options.map((o) => o.option_id);
  const lockedHours: Record<string, number> = {};
  for (const h of snapshot.extra_hours) lockedHours[h.item_id] = h.hours;

  // THE RE-NARROW. Dropping a line must drop what hung off it: its own picks,
  // and every follow-up its options revealed. Replaying the locked ids verbatim
  // would make a legitimate removal THROW, because the engine refuses an option
  // on a line the booking no longer contains.
  const chosenOptionIds = chargeableOptionIds(frozen, removedItemIds, lockedOptionIds);
  const extraHours = chargeableExtraHours(
    frozen,
    removedItemIds,
    lockedOptionIds,
    lockedHours,
  );

  const priced = priceCustomizedPackage({
    pkg: frozen,
    removedItemIds,
    chosenOptionIds,
    // NOT the live flag. The model that priced the lock is the model that
    // re-prices it, or the same booking costs a different amount depending on
    // when an operator happened to flip an env var.
    creditEnabled: snapshot.credit_model,
    paxCount: snapshot.pax_count,
    additions,
    catalogue,
    extraHours,
  });
  if (!priced) return { ok: false, reason: 'unpriceable' };

  if (
    Number.isSafeInteger(lockedTotalCentavos) &&
    priced.bookingTotalCentavos > lockedTotalCentavos
  ) {
    return { ok: false, reason: 'total_increased' };
  }

  const survivingOptions = new Set(chosenOptionIds);
  return {
    ok: true,
    bookingTotalCentavos: priced.bookingTotalCentavos,
    remainingConsumableCentavos: priced.remainingConsumableCentavos,
    chosenOptionIds,
    extraHours,
    snapshot: {
      ...snapshot,
      options: snapshot.options.filter((o) => survivingOptions.has(o.option_id)),
      extra_hours: snapshot.extra_hours.filter(
        (h) => extraHours[h.item_id] !== undefined,
      ),
    },
  };
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Display — what the couple and the vendor are shown after lock            */
/* ──────────────────────────────────────────────────────────────────────── */

export type SnapshotChargeLine = {
  /** Stable React key. */
  key: string;
  /** The vendor's own wording for the thing, as it was at lock. */
  label: string;
  /** "Extra hours" arithmetic, or null for a plain option upgrade. */
  detail: string | null;
  amountCentavos: number;
};

/**
 * The itemisation for every post-lock surface.
 *
 * `lockPackage` writes this record and its own comment says it "tells the
 * vendor what to deliver" — which was not true of any surface: the receipt
 * filtered follow-ups out entirely and rendered no picks or hours at all, and
 * the vendor workspace never read the keys. The couple saw a total containing
 * upgrades it did not name, and the vendor was never told about hours they owe.
 *
 * Pure and display-only: it reads the snapshot already on the booking row, so
 * no surface needs a new query to show this.
 */
export function snapshotChargeLines(
  snapshot: PackagePricingSnapshot | null,
): SnapshotChargeLine[] {
  if (!snapshot) return [];
  const lines: SnapshotChargeLine[] = [];

  for (const option of snapshot.options) {
    // A ₱0 pick is a CHOICE the vendor must honour, not a charge — it belongs
    // on the delivery list either way, so it is listed with no amount fuss.
    lines.push({
      key: `opt:${option.option_id}`,
      label: option.label,
      detail: null,
      amountCentavos: option.delta_centavos,
    });
  }

  for (const hours of snapshot.extra_hours) {
    lines.push({
      key: `hrs:${hours.item_id}`,
      label: hours.label,
      detail: `${hours.hours} extra ${hours.hours === 1 ? 'hour' : 'hours'} × ${formatCentavosPhp(
        hours.rate_centavos,
      )}`,
      amountCentavos: hours.hours * hours.rate_centavos,
    });
  }

  return lines;
}

/** What the snapshot's charges add up to. The receipt shows it as one figure. */
export function snapshotChargeTotalCentavos(
  snapshot: PackagePricingSnapshot | null,
): number {
  return snapshotChargeLines(snapshot).reduce((s, l) => s + l.amountCentavos, 0);
}
