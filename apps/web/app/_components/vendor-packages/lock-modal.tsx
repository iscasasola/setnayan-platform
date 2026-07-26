'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Package as PackageIcon, X, Check, AlertCircle } from 'lucide-react';
import {
  chosenOptionsSurchargeCentavos,
  computeCustomization,
  formatCentavosPhp,
  isChoiceLine,
  resolveChosenOption,
  type VendorPackageItemRow,
  type VendorPackageWithItems,
} from '@/lib/vendor-packages';
import { packageCreditEnabled } from '@/lib/package-credit-flag';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { lockPackage, type LockPackageResult } from '../../dashboard/[eventId]/vendors/packages/actions';

/**
 * Customize-and-lock modal for a vendor package (owner directive
 * 2026-05-22). Live-updates the consumable pool + total locked value as
 * the host toggles items, then submits to `lockPackage` server action.
 *
 * Renders inline as a CTA button + drawer. Mobile = bottom sheet,
 * desktop = right-side drawer. Both share the same content.
 */
export function LockPackageModal({
  eventId,
  pkg,
}: {
  eventId: string;
  pkg: VendorPackageWithItems;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const defaultRemovedIds: ReadonlyArray<string> = [];
  const [removedIds, setRemovedIds] = useState<string[]>([...defaultRemovedIds]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  /**
   * CHOICE lines are gated on the credit flag, because the surcharge they can
   * add is only priced by the credit engine. With the flag OFF a choice line
   * still renders — as a plain line at its standard option — and that total is
   * CORRECT, not a degraded fallback: the DB pins the default option's
   * `price_delta_centavos` to 0. So there is no flag state in which the modal
   * can quote a price below what the vendor would charge.
   */
  const choicesEnabled = packageCreditEnabled();

  /** item_id → option_id the host picked. Only ever holds kept choice lines. */
  const [chosenByItem, setChosenByItem] = useState<Record<string, string>>({});
  const chosenOptionIds = useMemo(() => Object.values(chosenByItem), [chosenByItem]);

  const { remainingConsumableCentavos, totalLockedCentavos, removedTotalCentavos } =
    useMemo(() => computeCustomization(pkg, removedIds), [pkg, removedIds]);

  /** What the picked upgrades add. Zero when every line sits on its standard. */
  const surchargeCentavos = useMemo(
    () =>
      choicesEnabled
        ? chosenOptionsSurchargeCentavos(pkg, removedIds, chosenOptionIds)
        : 0,
    [choicesEnabled, pkg, removedIds, chosenOptionIds],
  );

  function toggle(item: VendorPackageItemRow) {
    const nowRemoved = !removedIds.includes(item.item_id);
    setRemovedIds((prev) =>
      prev.includes(item.item_id)
        ? prev.filter((id) => id !== item.item_id)
        : [...prev, item.item_id],
    );
    // Dropping a line must drop its upgrade too. The credit engine rejects an
    // option id on a removed line outright (`option_on_removed_item`), so
    // leaving it behind would turn an untick into a failed lock.
    if (nowRemoved && isChoiceLine(item)) {
      setChosenByItem((prev) => {
        if (!(item.item_id in prev)) return prev;
        const next = { ...prev };
        delete next[item.item_id];
        return next;
      });
    }
  }

  function chooseOption(itemId: string, optionId: string) {
    setChosenByItem((prev) => ({ ...prev, [itemId]: optionId }));
  }

  function close() {
    setOpen(false);
    setError(null);
  }

  useModalA11y({ open, onClose: close, containerRef: dialogRef });

  function onLock() {
    setError(null);
    startTransition(async () => {
      const result: LockPackageResult = await lockPackage(eventId, pkg.package_id, {
        removed_item_ids: removedIds,
        // Ids only. The server re-reads every price from the DB — a delta that
        // arrived from the browser must never be what the host is charged.
        ...(choicesEnabled && chosenOptionIds.length > 0
          ? { chosen_option_ids: chosenOptionIds }
          : {}),
      });
      if (result.status === 'ok' || result.status === 'already_locked') {
        setOpen(false);
        router.push(`/dashboard/${eventId}/vendors/packages/${result.bookingId}`);
        router.refresh();
        return;
      }
      if (result.status === 'not_signed_in') {
        router.push('/login');
        return;
      }
      if (result.status === 'forbidden') {
        setError("You can't lock a package on this event.");
        return;
      }
      if (result.status === 'package_not_found') {
        setError('That package is no longer available.');
        return;
      }
      if (result.status === 'package_inactive') {
        setError('That package is paused by the vendor.');
        return;
      }
      if (result.status === 'vendor_not_verified') {
        setError(
          `${result.vendorName} is completing verification and can't be booked just yet — you'll be able to lock this package once they're verified.`,
        );
        return;
      }
      setError(result.message || 'Something went wrong.');
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-terracotta bg-terracotta px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      >
        <PackageIcon aria-hidden className="h-4 w-4" strokeWidth={2} />
        Customize &amp; lock this package
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center sm:justify-end"
          onClick={close}
        >
          <div
            ref={dialogRef}
            className="flex max-h-[95vh] w-full flex-col overflow-hidden rounded-t-2xl bg-cream shadow-2xl focus:outline-none sm:m-4 sm:h-full sm:max-h-full sm:w-[480px] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="lock-package-title"
            aria-modal="true"
          >
            <header className="flex items-start justify-between gap-3 border-b border-ink/10 p-5">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                  Customize package
                </p>
                <h2
                  id="lock-package-title"
                  className="mt-0.5 text-base font-semibold text-ink sm:text-lg"
                >
                  {pkg.package_name}
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                className="-m-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                aria-label="Close"
              >
                <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              <p className="mb-4 text-xs text-ink/65">
                Uncheck anything you{'’'}d like to skip.{' '}
                {pkg.is_consumable_flexible
                  ? `That value moves into your consumable budget — you can spend it on something else with ${
                      pkg.package_name.split(' ')[0] ?? 'this vendor'
                    }.`
                  : 'Removing items reduces your total.'}
              </p>

              <ul className="space-y-2">
                {/* Same set the public card lists (package-card.tsx filters on
                    is_default_included). Listing add-ons here rendered them
                    PRE-TICKED, and unticking one refunded money the vendor
                    never charged. */}
                {pkg.items
                  .filter((i) => i.is_default_included)
                  .map((item) => {
                  const removed = removedIds.includes(item.item_id);
                  const locked = item.is_required === true;
                  return (
                    <li key={item.item_id}>
                      <label
                        className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                          locked
                            ? 'cursor-default border-ink/10 bg-cream/60'
                            : removed
                              ? 'cursor-pointer border-ink/10 bg-cream/40 opacity-60'
                              : 'cursor-pointer border-success-300/50 bg-success-50/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!removed}
                          disabled={locked}
                          onChange={() => toggle(item)}
                          aria-describedby={locked ? `req-${item.item_id}` : undefined}
                          className="mt-0.5 h-5 w-5 shrink-0 rounded border-ink/20 text-terracotta focus:ring-terracotta disabled:opacity-50"
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm ${
                              removed ? 'text-ink/50 line-through' : 'text-ink/85'
                            }`}
                          >
                            {item.service_description}
                          </p>
                          {locked ? (
                            <p
                              id={`req-${item.item_id}`}
                              className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45"
                            >
                              Always included
                            </p>
                          ) : null}
                          {!locked && item.replacement_value_centavos > 0 ? (
                            <p
                              className={`mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
                                removed ? 'text-success-700' : 'text-ink/45'
                              }`}
                            >
                              {removed
                                ? `+${formatCentavosPhp(item.replacement_value_centavos)} back to budget`
                                : `${formatCentavosPhp(item.replacement_value_centavos)} value`}
                            </p>
                          ) : null}
                        </div>
                      </label>

                      {/* CHOICE line — the vendor offered alternatives, so the
                          host picks one. Rendered OUTSIDE the parent <label>:
                          nesting a radio inside a checkbox's label makes
                          clicking the radio also toggle the checkbox. */}
                      {choicesEnabled && !removed && isChoiceLine(item) ? (
                        <fieldset className="mt-1.5 ml-8 space-y-1.5">
                          <legend className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
                            Pick one
                          </legend>
                          {(item.options ?? []).map((opt) => {
                            const active =
                              resolveChosenOption(item, chosenOptionIds)?.option_id ===
                              opt.option_id;
                            return (
                              <label
                                key={opt.option_id}
                                className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition-colors ${
                                  active
                                    ? 'border-terracotta bg-terracotta/[0.06]'
                                    : 'border-ink/10 hover:border-ink/25 hover:bg-ink/[0.02]'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`opt-${item.item_id}`}
                                  value={opt.option_id}
                                  checked={active}
                                  onChange={() =>
                                    chooseOption(item.item_id, opt.option_id)
                                  }
                                  className="mt-0.5 h-5 w-5 shrink-0 border-ink/20 text-terracotta focus:ring-terracotta"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-ink/85">
                                    {opt.option_label}
                                  </p>
                                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
                                    {opt.price_delta_centavos > 0
                                      ? `+${formatCentavosPhp(opt.price_delta_centavos)}`
                                      : 'Included'}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </fieldset>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>

            <footer className="border-t border-ink/10 bg-cream p-5">
              <dl className="mb-3 space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-ink/70">Total package</dt>
                  <dd className="font-mono text-ink">
                    {formatCentavosPhp(totalLockedCentavos + surchargeCentavos)}
                  </dd>
                </div>
                {surchargeCentavos > 0 ? (
                  <div className="flex items-center justify-between">
                    <dt className="text-ink/70">Upgrades picked</dt>
                    <dd className="font-mono text-ink/80">
                      +{formatCentavosPhp(surchargeCentavos)}
                    </dd>
                  </div>
                ) : null}
                {pkg.is_consumable_flexible &&
                (pkg.consumable_budget_centavos > 0 || removedTotalCentavos > 0) ? (
                  <div className="flex items-center justify-between">
                    <dt className="text-ink/70">Consumable budget</dt>
                    <dd className="font-mono text-success-800">
                      {formatCentavosPhp(remainingConsumableCentavos)}
                    </dd>
                  </div>
                ) : null}
                {!pkg.is_consumable_flexible && removedTotalCentavos > 0 ? (
                  <div className="flex items-center justify-between">
                    <dt className="text-ink/70">Saved</dt>
                    <dd className="font-mono text-success-800">
                      {formatCentavosPhp(removedTotalCentavos)}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {error ? (
                <p className="mb-3 flex items-start gap-2 rounded-lg border border-danger-300/50 bg-danger-50/40 px-3 py-2 text-xs text-danger-800">
                  <AlertCircle
                    aria-hidden
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    strokeWidth={2}
                  />
                  <span>{error}</span>
                </p>
              ) : null}

              <button
                type="button"
                onClick={onLock}
                disabled={isPending}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-terracotta bg-terracotta px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
                {isPending ? 'Locking…' : 'Lock this package'}
              </button>
              <p className="mt-2 text-center text-[10px] text-ink/45">
                Everything in this package will lock on your event home.
              </p>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
