/**
 * ADAPTER — DB rows → the credit engine's structural input.
 *
 * `./package-credit` is deliberately decoupled from the row types in
 * `./vendor-packages`: it takes plain shapes so it can be tested with nothing
 * mocked. That decoupling is worth keeping, but something has to bridge it, and
 * doing the mapping inline at each call site is how the two drift apart. This
 * module is the ONE bridge.
 *
 * It is pure — no env, no clock, no I/O — so it runs under `tsx --test`.
 *
 * ⚠ Callers MUST pass rows they read from the DB. Everything here is a
 * structural re-shaping; nothing is validated as trustworthy, and no price is
 * recomputed. Hand it a client payload and you have handed the engine a client
 * payload.
 */
import {
  isRemovableItem,
  type VendorPackageItemRow,
  type VendorPackageWithItems,
} from './vendor-packages';
import type { CreditItem, CreditPackage, UnspentCreditPolicy } from './package-credit';

/**
 * The policy a package is treated as having when the column was not selected or
 * holds something unrecognised.
 *
 * 'expiring' is the DB default AND reproduces the shipped `computeCustomization`
 * math to the centavo, so defaulting here can only ever preserve today's
 * behaviour. Defaulting to 'refundable' would take money off the price on the
 * strength of a missing column — see the unresolved-semantics warning in
 * ./package-credit.
 */
export const DEFAULT_UNSPENT_CREDIT_POLICY: UnspentCreditPolicy = 'expiring';

function toCreditItem(item: VendorPackageItemRow): CreditItem {
  return {
    item_id: item.item_id,
    // The column post-dates the row type and defaults FALSE in the DB. Reading
    // a missing value as `true` would make a line unremovable and hide credit
    // the couple is entitled to; `false` is the conservative direction.
    is_required: item.is_required === true,
    is_default_included: item.is_default_included === true,
    replacement_value_centavos: item.replacement_value_centavos,
    // A line is a CHOICE iff this is non-empty, so an unfetched `options`
    // (undefined) must stay a plain line rather than becoming an empty choice.
    ...(item.options && item.options.length > 0
      ? {
          options: item.options.map((o) => ({
            option_id: o.option_id,
            price_delta_centavos: o.price_delta_centavos,
            is_default: o.is_default,
            is_available: o.is_available,
          })),
        }
      : {}),
  };
}

/** Re-shape a fetched package into the engine's input. */
export function toCreditPackage(pkg: VendorPackageWithItems): CreditPackage {
  const policy = pkg.unspent_credit_policy;
  return {
    total_price_centavos: pkg.total_price_centavos,
    consumable_budget_centavos: pkg.consumable_budget_centavos,
    is_consumable_flexible: pkg.is_consumable_flexible === true,
    unspent_credit_policy:
      policy === 'expiring' || policy === 'refundable'
        ? policy
        : DEFAULT_UNSPENT_CREDIT_POLICY,
    items: pkg.items.map(toCreditItem),
  };
}

/**
 * Narrow the host's removal list to the removals they are actually ALLOWED to
 * make, before the engine ever sees it.
 *
 * The engine fails CLOSED on a removal naming a required or never-included line
 * (`required_item_removed` / `remove_not_included`), while the shipped
 * `computeCustomization` silently ignores it. Handing the raw list straight
 * through would therefore turn a stale page — a vendor marked a line required
 * after the modal loaded — into a hard lock failure on a money action, which is
 * a regression against behaviour couples have today.
 *
 * Dropping a removal is CONSERVATIVE in exactly the direction that matters: the
 * line stays in the booking and its value never enters the credit pool, so this
 * can only ever hand out LESS credit, never more. The engine's fail-closed
 * guarantee exists to stop credit being INFLATED; this cannot inflate it.
 *
 * Everything else the engine refuses — unknown ids, duplicate picks, an
 * unchosen required choice — is left to fail closed, because those are real
 * problems that a number would paper over.
 */
export function allowedRemovals(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
): string[] {
  const requested = new Set(removedItemIds);
  return pkg.items
    .filter((item) => requested.has(item.item_id) && isRemovableItem(item))
    .map((item) => item.item_id);
}

/**
 * The choice lines that the couple MUST pick before the package can be locked.
 *
 * A required choice line has no valid unpicked state: the engine refuses to
 * apply its default (`required_choice_unselected`), by owner rule — "must pick
 * a main course" is a decision the couple has to make, and quietly defaulting
 * it hides that from them. The UI has to block rather than preselect, or the
 * modal shows a selection the server will reject.
 *
 * Only KEPT lines count: a removed line requires nothing.
 */
export function unresolvedRequiredChoices(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
  chosenOptionIds: ReadonlyArray<string>,
): string[] {
  const removed = new Set(allowedRemovals(pkg, removedItemIds));
  const chosen = new Set(chosenOptionIds);
  return pkg.items
    .filter(
      (item) =>
        item.is_required === true &&
        item.is_default_included === true &&
        !removed.has(item.item_id) &&
        (item.options?.length ?? 0) > 0 &&
        !item.options!.some((o) => chosen.has(o.option_id) && o.is_available),
    )
    .map((item) => item.item_id);
}
