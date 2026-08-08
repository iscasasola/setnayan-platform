'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package as PackageIcon,
  X,
  Check,
  AlertCircle,
  Minus,
  Plus,
  MessageCircle,
} from 'lucide-react';
import {
  computeCustomization,
  formatCentavosPhp,
  isChoiceLine,
  type VendorPackageItemOptionRow,
  type VendorPackageItemRow,
  type VendorPackageWithItems,
} from '@/lib/vendor-packages';
import { packageCreditEnabled } from '@/lib/package-credit-flag';
import { unresolvedRequiredChoices } from '@/lib/package-credit-adapter';
import {
  choiceTotals,
  extraHoursBounds,
  extraHoursOn,
  isFollowUpLine,
  isOptionSelectable,
  isPickCapReached,
  pickBounds,
  pickedOptionsOn,
  pickState,
  unfinishedChoiceLines,
  visibleLineTree,
  type ChoiceSelection,
} from '@/lib/package-choice-tree';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { buildPackagePicksSummary, buildNotSentCopy } from '@/lib/package-picks-summary';
import {
  startServiceInquiry,
  type StartServiceInquiryResult,
} from '@/app/v/[slug]/inquiry-actions';
import { lockPackage, type LockPackageResult } from '../../dashboard/[eventId]/vendors/packages/actions';

/**
 * Customize-and-lock modal for a vendor package (owner directive
 * 2026-05-22). Live-updates the consumable pool + total locked value as
 * the host toggles items, then submits to `lockPackage` server action.
 *
 * Renders inline as a CTA button + drawer. Mobile = bottom sheet,
 * desktop = right-side drawer. Both share the same content.
 *
 * ── THE CHOICE TREE (this slice) ────────────────────────────────────────────
 * The line list is no longer a flat filter. It comes from `visibleLineTree`,
 * which returns the lines the couple can currently see plus their nesting
 * depth: top-level inclusions, and beneath each picked option whatever
 * FOLLOW-UP lines that option reveals, recursively. A follow-up whose parent
 * option is not picked is not in the list at all, so it cannot be rendered,
 * picked, priced or cascaded.
 *
 * With the credit flag OFF the branching columns are not even selected, so
 * every line arrives top-level with `pick_min`/`pick_max` null and the tree
 * degenerates to exactly the flat `is_default_included` list that shipped.
 *
 * ⚠ EVERY NUMBER ON THIS SCREEN COMES FROM `choiceTotals`, which calls the same
 * `priceCustomizedPackage` the lock action calls, over the same narrowed option
 * ids (`chargeableOptionIds`) and the same narrowed hours
 * (`chargeableExtraHours`). There is no local sum.
 *
 * A follow-up pick, a second pick on a "choose 2 of 3", and an extra hour are
 * all REAL MONEY as of 2026-07-28. They were priced at exactly zero until then,
 * because `lockPackage` read its items with a select that could not see the
 * columns defining them — so this screen printed prices the server could not
 * commit. The select carries all five columns now and the credit engine resolves
 * the shapes, so what this screen adds up is what the lock charges.
 *
 * `isOptionSelectable` is still what keeps the remainder honest: anything the
 * pricer would NOT charge for is only offered when its delta is genuinely zero.
 */
/**
 * What Lock actually promises. Owner ruling 2026-07-26 — a lock becomes real
 * when the VENDOR approves payment, so the couple is told that plainly rather
 * than being left to assume the date is held.
 */
const vendorConfirmsLabel = 'Your vendor confirms once payment is approved.';

/**
 * Everything the SECONDARY action needs — "Ask the vendor about this build
 * instead" (flag: NEXT_PUBLIC_SERVICE_DETAILS_ENABLED).
 *
 * WHY IT IS A PROP AND NOT DERIVED HERE. `startServiceInquiry` opens a thread
 * against a `vendor_services` row, and a package is not one — it carries a
 * `primary_canonical_service`, not a service id. Resolving that mapping is the
 * page's job (it already holds `activeServices`); this modal must never guess
 * which service a package "is", because a wrong guess files the couple's build
 * under the wrong category on the vendor's side.
 *
 * null / absent ⇒ the secondary action does not render at all and this modal is
 * byte-identical to what ships today.
 */
export type PackageAskTarget = {
  vendorProfileId: string;
  /** Hybrid-anonymity display label — never the raw business name. */
  vendorLabel: string;
  /** The active vendor_service this inquiry is filed under. */
  vendorServiceId: string;
  /** Its canonical category, for thread_service_interests scoping. */
  categoryKey: string | null;
};

/**
 * 🚨 `sent` AND `not_sent` ARE DIFFERENT OUTCOMES, and the difference is the
 * whole point of this state.
 *
 * The build message can legitimately fail to post — most commonly because the
 * vendor has not accepted yet and the couple has already used their ONE
 * pre-accept follow-up (`lib/chat-send.ts` accept-gate). The thread still
 * exists, so it is tempting to collapse that into "sent". Doing so leaves the
 * couple waiting on a quote for a build the vendor never received. `not_sent`
 * carries the reason's own sentence and says plainly that it did not go.
 */
type AskState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; threadHref: string }
  | { kind: 'not_sent'; threadHref: string; message: string }
  | { kind: 'error'; message: string };

export function LockPackageModal({
  eventId,
  pkg,
  paxCount = 0,
  ask = null,
}: {
  eventId: string;
  pkg: VendorPackageWithItems;
  /**
   * Server-resolved head count, for per-head option upgrades ("+₱150/head").
   * The lock action resolves its own with `resolveLivePax`; passing the same
   * number here is what stops the quote drifting from the charge on a per-head
   * option. Defaults to 0, which each option's `min_pax` then floors — a
   * per-head upgrade prices at its minimum rather than at nothing.
   */
  paxCount?: number;
  /**
   * The "ask instead" doorway for a couple who has customized but is not ready
   * to pay. null (the default) ⇒ not rendered.
   */
  ask?: PackageAskTarget | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const defaultRemovedIds: ReadonlyArray<string> = [];
  const [removedIds, setRemovedIds] = useState<string[]>([...defaultRemovedIds]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [askState, setAskState] = useState<AskState>({ kind: 'idle' });
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

  /**
   * item_id → the option ids picked on that line. An array rather than a single
   * id because a "choose 2 of 3" line holds more than one; a plain one-of-N line
   * simply holds at most one, so there is ONE shape instead of two to keep in
   * step.
   */
  const [selection, setSelection] = useState<ChoiceSelection>({
    picks: {},
    extraHours: {},
  });

  /** The lines the couple can see right now, with their nesting depth. */
  const tree = useMemo(
    () => visibleLineTree(pkg, removedIds, selection),
    [pkg, removedIds, selection],
  );

  const { remainingConsumableCentavos, totalLockedCentavos, removedTotalCentavos } =
    useMemo(() => computeCustomization(pkg, removedIds), [pkg, removedIds]);

  /**
   * 💰 THE ONLY NUMBER. Same function, same inputs as the lock's own commit —
   * `null` means the pricer refused, and the button blocks rather than showing
   * a substituted figure.
   */
  const totals = useMemo(
    () =>
      choiceTotals({
        pkg,
        removedItemIds: removedIds,
        selection,
        creditEnabled: choicesEnabled,
        paxCount,
      }),
    [pkg, removedIds, selection, choicesEnabled, paxCount],
  );

  /** What the picked upgrades add, as the difference actually being charged. */
  const surchargeCentavos = totals
    ? Math.max(0, totals.bookingTotalCentavos - totalLockedCentavos)
    : 0;

  function toggle(item: VendorPackageItemRow) {
    const nowRemoved = !removedIds.includes(item.item_id);
    setRemovedIds((prev) =>
      prev.includes(item.item_id)
        ? prev.filter((id) => id !== item.item_id)
        : [...prev, item.item_id],
    );
    // Dropping a line must drop its picks too. The credit engine rejects an
    // option id on a removed line outright (`option_on_removed_item`), so
    // leaving one behind would turn an untick into a failed lock. The line's
    // whole follow-up subtree stops being visible at the same moment, and its
    // picks go with it — otherwise re-ticking the line would silently restore
    // answers to questions the couple can no longer see.
    if (nowRemoved) {
      setSelection((prev) => dropSubtreePicks(pkg, prev, item.item_id));
    }
  }

  /**
   * Pick or unpick one option.
   *
   * `pick_max === 1` (every line that exists today) behaves as a radio: the new
   * pick replaces the old. A genuine pick-N line behaves as a checkbox, capped
   * at `pick_max`.
   *
   * Either way the subtree hanging off any option that just stopped being
   * picked is cleared, so a follow-up answer never survives the question that
   * revealed it.
   */
  function chooseOption(item: VendorPackageItemRow, option: VendorPackageItemOptionRow) {
    setSelection((prev) => {
      const current = prev.picks?.[item.item_id] ?? [];
      const { max } = pickBounds(item);
      const already = current.includes(option.option_id);

      let next: string[];
      if (already) {
        next = current.filter((id) => id !== option.option_id);
      } else if (max === 1) {
        next = [option.option_id];
      } else if (current.length >= max) {
        return prev; // cap reached — the option is rendered disabled anyway
      } else {
        next = [...current, option.option_id];
      }

      const dropped = current.filter((id) => !next.includes(id));
      let state: ChoiceSelection = {
        ...prev,
        picks: { ...prev.picks, [item.item_id]: next },
      };
      for (const optionId of dropped) {
        state = dropPicksUnderOption(pkg, state, optionId);
      }
      return state;
    });
  }

  function setExtraHours(item: VendorPackageItemRow, hours: number) {
    const bounds = extraHoursBounds(item);
    if (!bounds) return;
    const clamped = Math.min(Math.max(bounds.min, hours), bounds.max);
    setSelection((prev) => ({
      ...prev,
      extraHours: { ...(prev.extraHours ?? {}), [item.item_id]: clamped },
    }));
  }

  /**
   * Required choice lines still waiting on the couple. The server refuses to
   * lock while any remain (`choice_required`), so the button blocks rather than
   * letting them submit into a rejection.
   */
  const pendingRequiredChoices = useMemo(
    () =>
      choicesEnabled
        ? unresolvedRequiredChoices(
            pkg,
            removedIds,
            Object.values(selection.picks ?? {}).flat(),
          )
        : [],
    [choicesEnabled, pkg, removedIds, selection],
  );

  /**
   * 🚫 Lines below their minimum. A package with a question unanswered is an
   * UNFINISHED ORDER, never a cheaper one — the vendor priced it assuming every
   * question is answered — so this blocks the button instead of quoting less.
   */
  const unfinished = useMemo(
    () => (choicesEnabled ? unfinishedChoiceLines(pkg, removedIds, selection) : []),
    [choicesEnabled, pkg, removedIds, selection],
  );

  const blockedItemIds = useMemo(
    () => new Set([...pendingRequiredChoices, ...unfinished.map((i) => i.item_id)]),
    [pendingRequiredChoices, unfinished],
  );

  /**
   * 📝 THE BUILD, AS A MESSAGE — built from the SAME render state the footer
   * prints, never from a second computation.
   *
   * `tree` is the list on screen and `totals` is the number on screen. The
   * serializer only formats what it is handed (see the header on
   * lib/package-picks-summary.ts), so the message and the screen cannot
   * disagree about a peso — and it annotates an option only where the option
   * row above annotates it, so the message cannot invite a quote for something
   * the screen presented as free.
   */
  const picksSummary = useMemo(
    () =>
      buildPackagePicksSummary({
        packageName: pkg.package_name,
        lines: tree,
        // The WHOLE item list, unfiltered. Resolving which of them the couple
        // unticked happens inside the tested serializer — this file must never
        // hold a second local notion of which lines count (pinned by
        // lib/package-followup-not-priced.test.ts).
        allItems: pkg.items,
        removedItemIds: removedIds,
        selection,
        bookingTotalCentavos: totals?.bookingTotalCentavos ?? null,
        surchargeCentavos,
      }),
    [pkg, tree, removedIds, selection, totals, surchargeCentavos],
  );

  function close() {
    setOpen(false);
    setError(null);
    setAskState({ kind: 'idle' });
  }

  useModalA11y({ open, onClose: close, containerRef: dialogRef });

  function onLock() {
    setError(null);
    if (!totals) {
      setError('We could not price this package. Please reload and try again.');
      return;
    }
    startTransition(async () => {
      const result: LockPackageResult = await lockPackage(eventId, pkg.package_id, {
        removed_item_ids: removedIds,
        // Ids only. The server re-reads every price from the DB — a delta that
        // arrived from the browser must never be what the host is charged. It
        // also re-runs the SAME narrowing this screen priced with, so anything
        // beyond the chargeable set is dropped there exactly as it was here.
        ...(choicesEnabled && totals.chargeableOptionIds.length > 0
          ? { chosen_option_ids: [...totals.chargeableOptionIds] }
          : {}),
        // The HOUR steppers, same contract: a quantity per line, already
        // narrowed and clamped by the same function the server re-runs. The
        // rate never leaves the database.
        ...(choicesEnabled && Object.keys(totals.chargeableExtraHours).length > 0
          ? { extra_hours: { ...totals.chargeableExtraHours } }
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
      if (result.status === 'choice_required') {
        // The button blocks this, so getting here means the page is stale —
        // the vendor made a line required after it loaded. Say what to do.
        setError(
          result.itemIds.length === 1
            ? 'One of these lines now needs you to pick an option. Reload the page to see it.'
            : `${result.itemIds.length} of these lines now need you to pick an option. Reload the page to see them.`,
        );
        return;
      }
      setError(result.message || 'Something went wrong.');
    });
  }

  /**
   * "Ask the vendor about this build instead" — the doorway for a couple who
   * has customized but is not ready to pay.
   *
   * 💬 NOT A MONEY ACTION. It opens (or resumes) the ONE deduped
   * `chat_threads` row through `startServiceInquiry` — the same action the
   * public profile's Inquire composer calls, with the same
   * `UNIQUE(event_id, vendor_profile_id)` dedupe — and carries the build as a
   * display-only block in the message. Nothing is reserved, nothing is charged,
   * no capacity is consumed, and the block says the total is an estimate.
   */
  function onAsk() {
    if (!ask) return;
    setError(null);
    if (!totals) {
      setError('We could not price this package. Please reload and try again.');
      return;
    }
    setAskState({ kind: 'sending' });
    startTransition(async () => {
      const result: StartServiceInquiryResult = await startServiceInquiry({
        vendorProfileId: ask.vendorProfileId,
        // Event-scoped: this modal is always mounted for ONE event, so the
        // inquiry is filed against that event and not the couple's primary one.
        eventId,
        initialServiceId: ask.vendorServiceId,
        initialCategoryKey: ask.categoryKey,
        alsoServiceIds: [],
        requirements: { packagePicks: picksSummary },
      });
      if (result.status === 'ok') {
        setAskState({
          kind: 'sent',
          threadHref: `/dashboard/${result.eventId}/messages/${result.threadId}`,
        });
        return;
      }
      if (result.status === 'ok_build_not_sent') {
        // The thread opened but the build did NOT post. Say so, with the
        // reason's own sentence — never "your build is in the message".
        setAskState({
          kind: 'not_sent',
          threadHref: `/dashboard/${result.eventId}/messages/${result.threadId}`,
          message: buildNotSentCopy(result.reason, ask.vendorLabel, result.message),
        });
        return;
      }
      if (result.status === 'not_signed_in' || result.status === 'not_secured') {
        router.push(result.status === 'not_secured' ? '/signup' : '/login');
        return;
      }
      if (result.status === 'no_event') {
        setAskState({
          kind: 'error',
          message: 'Create your event first, then you can message this vendor.',
        });
        return;
      }
      setAskState({
        kind: 'error',
        message: result.message ?? 'Could not send that to the vendor.',
      });
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-terracotta bg-terracotta-700 px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
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
                {/* THE TREE, not a flat filter. `visibleLineTree` applies the
                    same `is_default_included` rule the flat list used to (an
                    add-on is never inside total_price_centavos, and unticking
                    one refunded money the vendor never charged), and adds the
                    follow-up walk on top: a conditional line appears only under
                    the option that reveals it, and disappears with it. */}
                {tree.map(({ item, depth }) => {
                  const removed = removedIds.includes(item.item_id);
                  const locked = item.is_required === true;
                  const followUp = isFollowUpLine(item);
                  const choice = isChoiceLine(item);
                  const bounds = pickBounds(item);
                  const state = pickState(item, selection);
                  const multi = bounds.max > 1;
                  const needsPick = blockedItemIds.has(item.item_id);
                  const hours = extraHoursBounds(item);
                  return (
                    <li
                      key={item.item_id}
                      style={depth > 0 ? { marginLeft: `${Math.min(depth, 5) * 12}px` } : undefined}
                      className={
                        depth > 0 ? 'border-l-2 border-terracotta/25 pl-3' : undefined
                      }
                    >
                      {/* A FOLLOW-UP is not a line the couple ticks — it is a
                          question raised BY the pick above it, and it has no
                          independent price. Rendering it with a checkbox would
                          invite them to "remove" something that was never
                          charged. */}
                      {followUp ? (
                        <div className="rounded-lg border border-ink/10 bg-cream/50 p-3">
                          <p className="text-sm text-ink/85">{item.service_description}</p>
                          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
                            Because of your pick above
                          </p>
                        </div>
                      ) : (
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
                      )}

                      {/* CHOICE line — the vendor offered alternatives, so the
                          host picks. Rendered OUTSIDE the parent <label>:
                          nesting an input inside a checkbox's label makes
                          clicking the option also toggle the checkbox. */}
                      {choicesEnabled && !removed && choice ? (
                        <fieldset className="mt-1.5 ml-8 space-y-1.5">
                          <legend
                            className={`mb-1 font-mono text-[10px] uppercase tracking-[0.12em] ${
                              needsPick ? 'text-terracotta' : 'text-ink/45'
                            }`}
                          >
                            {multi
                              ? /* THE LIVE COUNTER. "Choose 2 of 3" states the
                                   contract; the count states where they are. */
                                `Choose ${
                                  bounds.min === bounds.max
                                    ? bounds.min
                                    : `${bounds.min}–${bounds.max}`
                                } · ${state.counterLabel}`
                              : needsPick
                                ? 'Pick one to continue'
                                : 'Pick one'}
                          </legend>
                          {(item.options ?? []).map((opt) => {
                            const picked = pickedOptionsOn(item, selection).some(
                              (o) => o.option_id === opt.option_id,
                            );
                            // A REQUIRED choice line starts genuinely
                            // UNSELECTED. The engine refuses to apply its
                            // default (owner rule: "must pick a main course"
                            // is the couple's decision), so showing the
                            // standard as preselected would be the UI
                            // claiming a choice the server will reject.
                            const active =
                              picked ||
                              (!multi &&
                                locked !== true &&
                                (item.options ?? []).length > 0 &&
                                pickedOptionsOn(item, selection).length === 0 &&
                                opt.is_default &&
                                opt.is_available);
                            // 🚨 Inside the non-chargeable region a PRICED
                            // option is not on offer: showing it would promise
                            // an upgrade nobody is billed for.
                            const selectable = isOptionSelectable(
                              pkg,
                              removedIds,
                              item,
                              opt,
                              selection,
                              paxCount,
                            );
                            const capped = isPickCapReached(item, opt, selection);
                            const disabled = !selectable || capped;
                            return (
                              <label
                                key={opt.option_id}
                                className={`flex min-h-[44px] items-start gap-3 rounded-lg border px-3 py-2 transition-colors ${
                                  disabled
                                    ? 'cursor-not-allowed border-ink/10 opacity-55'
                                    : active
                                      ? 'cursor-pointer border-terracotta bg-terracotta/[0.06]'
                                      : 'cursor-pointer border-ink/10 hover:border-ink/25 hover:bg-ink/[0.02]'
                                }`}
                              >
                                <input
                                  type={multi ? 'checkbox' : 'radio'}
                                  name={`opt-${item.item_id}`}
                                  value={opt.option_id}
                                  checked={multi ? picked : active}
                                  disabled={disabled}
                                  onChange={() => chooseOption(item, opt)}
                                  className="mt-0.5 h-5 w-5 shrink-0 border-ink/20 text-terracotta focus:ring-terracotta disabled:opacity-50"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-ink/85">{opt.option_label}</p>
                                  {/* A ₱0 option shows NOTHING (owner 2026-07-28:
                                      "included makes it seem like this is included
                                      whether they pick it or not") — no extra cost
                                      is just a blank, the pick still decides. */}
                                  {!selectable || opt.price_delta_centavos > 0 ? (
                                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
                                      {!selectable
                                        ? 'Ask your vendor — not part of this total'
                                        : `+${formatCentavosPhp(opt.price_delta_centavos)}`}
                                    </p>
                                  ) : null}
                                </div>
                              </label>
                            );
                          })}
                        </fieldset>
                      ) : null}

                      {/* QUANTITY — extra hours on an hourly line, bounded by
                          `max_extra_hours` and CHARGED at the line's own
                          `extra_hour_centavos`. The stepper sends a quantity;
                          the server re-reads the rate and re-clamps against the
                          same bounds, so what is shown here is what is billed. */}
                      {choicesEnabled && !removed && hours ? (
                        <div className="mt-1.5 ml-8 flex items-center gap-3 rounded-lg border border-ink/10 px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-ink/85">Extra hours</p>
                            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
                              Up to {hours.max} ·{' '}
                              {formatCentavosPhp(item.extra_hour_centavos ?? 0)} per hour
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              aria-label="One hour fewer"
                              disabled={extraHoursOn(item, selection) <= hours.min}
                              onClick={() =>
                                setExtraHours(item, extraHoursOn(item, selection) - 1)
                              }
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink/70 transition-colors hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Minus aria-hidden className="h-4 w-4" strokeWidth={2} />
                            </button>
                            <span
                              aria-live="polite"
                              className="min-w-[2ch] text-center font-mono text-sm text-ink"
                            >
                              {extraHoursOn(item, selection)}
                            </span>
                            <button
                              type="button"
                              aria-label="One hour more"
                              disabled={extraHoursOn(item, selection) >= hours.max}
                              onClick={() =>
                                setExtraHours(item, extraHoursOn(item, selection) + 1)
                              }
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink/70 transition-colors hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
                            </button>
                          </div>
                        </div>
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
                    {totals ? formatCentavosPhp(totals.bookingTotalCentavos) : '—'}
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
                      {formatCentavosPhp(
                        totals
                          ? totals.remainingConsumableCentavos
                          : remainingConsumableCentavos,
                      )}
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

              {unfinished.length > 0 ? (
                /* 🚫 Not a cheaper package — an unfinished one. Said plainly,
                   because "you saved money" is exactly the wrong inference. */
                <p className="mb-3 text-center text-xs text-ink/65">
                  {unfinished.length === 1
                    ? 'One line still needs your choices'
                    : `${unfinished.length} lines still need your choices`}
                  . Answering fewer doesn{'’'}t lower the price — your vendor priced
                  this package with every choice made.
                </p>
              ) : pendingRequiredChoices.length > 0 ? (
                <p className="mb-3 text-center text-xs text-ink/65">
                  Pick an option on{' '}
                  {pendingRequiredChoices.length === 1
                    ? 'the highlighted line'
                    : `${pendingRequiredChoices.length} highlighted lines`}{' '}
                  to continue.
                </p>
              ) : null}

              <button
                type="button"
                onClick={onLock}
                disabled={isPending || blockedItemIds.size > 0 || !totals}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-terracotta bg-terracotta-700 px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
                {isPending ? 'Locking…' : 'Lock this package'}
              </button>
              {/* ⚠ TRUTHFUL BY OWNER RULING (2026-07-26): "lock will only be
                  locked when the vendor approves their payment." Locking
                  records the couple's choice and puts it on their event home;
                  it does NOT hold the date. Capacity is consumed only at
                  `deposit_paid` (owner lock 2026-06-12, vendors/actions.ts:255)
                  — until then two couples can both lock the same vendor for the
                  same day. Never imply the date is secured here, and do not
                  copy a "the date is yours" line onto the service-card Lock
                  button when it ships (§6.8). */}
              <p className="mt-2 text-center text-[10px] text-ink/45">
                This goes on your event home. {vendorConfirmsLabel}
              </p>

              {/* ── NOT READY TO PAY? ASK. ───────────────────────────────────
                  A couple who has spent five minutes customizing and then
                  hesitates has, until now, had exactly one way out of this
                  screen: a money action. This is the other one — the same
                  build, sent to the vendor as a question.

                  Gated on the SAME `blockedItemIds` / `!totals` guard as Lock,
                  and for the same reason: a package below a line's minimum is
                  an UNFINISHED order, not a cheaper one, so sending its total
                  would quote the vendor a number the finished build will not
                  match. Flag-gated via the `ask` prop — absent ⇒ nothing here
                  renders. */}
              {ask ? (
                askState.kind === 'sent' || askState.kind === 'not_sent' ? (
                  <div className="mt-4 space-y-2 border-t border-ink/10 pt-4">
                    {askState.kind === 'sent' ? (
                      <p className="text-center text-xs text-ink/70">
                        Sent to {ask.vendorLabel} — your build is in the message.
                      </p>
                    ) : (
                      /* ⚠ NOT DELIVERED. The thread exists, the build does not:
                         say which, and offer the conversation anyway so they
                         are not stranded. Never soften this into "sent". */
                      <p className="flex items-start gap-2 rounded-lg border border-warn-300/60 bg-warn-50/50 px-3 py-2 text-xs text-ink/80">
                        <AlertCircle
                          aria-hidden
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn-600"
                          strokeWidth={2}
                        />
                        <span>{askState.message}</span>
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const href = askState.threadHref;
                        setOpen(false);
                        router.push(href);
                        router.refresh();
                      }}
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-ink/15 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-ink/5"
                    >
                      <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                      {askState.kind === 'sent'
                        ? 'View the conversation'
                        : 'Open the conversation'}
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 border-t border-ink/10 pt-4">
                    <button
                      type="button"
                      onClick={onAsk}
                      disabled={isPending || blockedItemIds.size > 0 || !totals}
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-ink/15 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                      {askState.kind === 'sending'
                        ? 'Sending…'
                        : `Ask ${ask.vendorLabel} about this build instead`}
                    </button>
                    {askState.kind === 'error' ? (
                      <p className="mt-2 text-center text-xs text-danger-700">
                        {askState.message}
                      </p>
                    ) : (
                      <p className="mt-2 text-center text-[10px] text-ink/45">
                        Sends these choices as a message. Nothing is booked or paid,
                        and the total goes across as an estimate.
                      </p>
                    )}
                  </div>
                )
              ) : null}
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Subtree pruning                                                          */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Forget every pick made on the lines revealed by ONE option, and on their
 * descendants.
 *
 * A stale pick under a question the couple can no longer see is a real hazard,
 * not tidiness: `visibleLineTree` would re-reveal the whole subtree — answers
 * intact — the instant the parent option were picked again, so the couple would
 * silently re-commit choices they never revisited.
 */
function dropPicksUnderOption(
  pkg: VendorPackageWithItems,
  selection: ChoiceSelection,
  optionId: string,
): ChoiceSelection {
  let next = selection;
  for (const child of pkg.items) {
    if (child.parent_option_id !== optionId) continue;
    next = dropSubtreePicks(pkg, next, child.item_id);
  }
  return next;
}

/** Forget the picks on a line and on everything hanging beneath it. */
function dropSubtreePicks(
  pkg: VendorPackageWithItems,
  selection: ChoiceSelection,
  itemId: string,
  seen: Set<string> = new Set(),
): ChoiceSelection {
  if (seen.has(itemId)) return selection; // cycle guard — in-memory shapes only
  seen.add(itemId);

  const item = pkg.items.find((i) => i.item_id === itemId);
  const picks = { ...selection.picks };
  const extraHours = { ...(selection.extraHours ?? {}) };
  delete picks[itemId];
  delete extraHours[itemId];
  let next: ChoiceSelection = { picks, extraHours };

  for (const option of item?.options ?? []) {
    for (const child of pkg.items) {
      if (child.parent_option_id !== option.option_id) continue;
      next = dropSubtreePicks(pkg, next, child.item_id, seen);
    }
  }
  return next;
}
