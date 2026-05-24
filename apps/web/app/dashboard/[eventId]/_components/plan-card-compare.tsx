'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  GitCompare,
  X,
  Check,
  Clock,
  BookmarkCheck,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import type { PlanCardPick, PlanGroupId } from '@/lib/wedding-plan-groups';
import {
  deleteVendor,
  finalizeVendor,
  revertVendorToConsidering,
  type FinalizeVendorResult,
} from '../vendors/actions';

const MAX_COMPARE = 3;
const TOAST_AUTO_DISMISS_MS = 5_000;
const LOCKED_FLASH_MS = 800;

type Props = {
  eventId: string;
  groupId: PlanGroupId;
  groupLabel: string;
  /** Canonical categories that count toward this planner group. Splits the
   *  comparison into per-canonical rows for multi-canonical groups
   *  (Attire & Rings → bridal gown / suit / rings, etc.). */
  groupCategories: ReadonlyArray<VendorCategory>;
  picks: ReadonlyArray<PlanCardPick>;
};

function formatPHP(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function rawStatusLabel(raw: string | null): string {
  if (!raw) return 'Considering';
  return raw
    .split('_')
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

type LockState =
  | { kind: 'idle' }
  | { kind: 'pending'; vendorId: string }
  | {
      kind: 'conflict';
      vendorId: string;
      vendorName: string;
      existingVendorId: string;
      existingVendorName: string;
      groupLabel: string;
    }
  | {
      kind: 'just_locked';
      vendorId: string;
      vendorName: string;
    }
  | { kind: 'error'; message: string };

type ToastState =
  | { kind: 'hidden' }
  | {
      kind: 'locked';
      vendorId: string;
      vendorName: string;
      undoUntil: number;
    };

/**
 * Inline compare dialog for a single planner card. Triggered by the
 * "Compare N" button next to Search/Add. Surfaces only when the couple
 * has ≥ 2 picks in the group; per-canonical sub-rows for multi-canonical
 * groups so a bridal-gown comparison doesn't get mashed up against the
 * groom's-suit comparison.
 *
 * Native `<dialog>` element — picks up ESC + focus trap + backdrop for
 * free. Backdrop click is wired manually since the native attribute
 * (`closedby`) isn't yet stable across browsers.
 *
 * 2026-05-22 — Lock-this-vendor action shipped. Each card in the compare
 * drawer surfaces a "Lock this vendor" CTA. On confirm the server action
 * flips status to 'contracted' (first CONFIRMED_VENDOR_STATUSES entry),
 * the row re-renders via revalidatePath on the parent page (force-dynamic
 * already set), the dialog closes after a brief locked-flash state, and
 * a polite Undo toast appears for 5 seconds.
 *
 * Hard-single conflict: ceremony_venue + reception_venue + officiant
 * groups allow only one locked vendor. Second attempt opens a Switch /
 * Cancel modal — Switch reverts the existing locked vendor to
 * 'considering' AND locks the new one atomically (per server action's
 * override_existing branch). Cancel returns to the compare drawer with
 * no state change.
 */
export function PlanCardCompare({
  eventId,
  groupId,
  groupLabel,
  groupCategories,
  picks,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [, setOpen] = useState(false);
  const [lockState, setLockState] = useState<LockState>({ kind: 'idle' });
  const [toast, setToast] = useState<ToastState>({ kind: 'hidden' });
  const [isPending, startTransition] = useTransition();

  const openDialog = () => {
    setOpen(true);
    dialogRef.current?.showModal();
  };
  const closeDialog = () => {
    setOpen(false);
    dialogRef.current?.close();
    // Clear ephemeral lock state so the next open starts clean. The toast
    // outlives the dialog on purpose — Undo should reach the host even
    // after the drawer closes.
    setLockState({ kind: 'idle' });
  };

  // Keep state in sync with native dismissals (ESC, backdrop).
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const onClose = () => {
      setOpen(false);
      setLockState({ kind: 'idle' });
    };
    dlg.addEventListener('close', onClose);
    return () => dlg.removeEventListener('close', onClose);
  }, []);

  // Auto-dismiss the toast after TOAST_AUTO_DISMISS_MS.
  useEffect(() => {
    if (toast.kind !== 'locked') return;
    const remaining = toast.undoUntil - Date.now();
    if (remaining <= 0) {
      setToast({ kind: 'hidden' });
      return;
    }
    const t = setTimeout(() => setToast({ kind: 'hidden' }), remaining);
    return () => clearTimeout(t);
  }, [toast]);

  // Group picks by canonical. Order matches the PlanGroup.categories
  // array so the rendering matches the spec's expected layout.
  const byCategory: Map<VendorCategory, PlanCardPick[]> = new Map();
  for (const cat of groupCategories) byCategory.set(cat, []);
  for (const p of picks) {
    if (byCategory.has(p.category)) byCategory.get(p.category)!.push(p);
  }
  const sections = Array.from(byCategory.entries()).filter(
    ([, list]) => list.length > 0,
  );

  const performLock = (
    vendorId: string,
    vendorName: string,
    overrideExisting: boolean,
  ) => {
    setLockState({ kind: 'pending', vendorId });
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('vendor_id', vendorId);
      if (overrideExisting) fd.set('override_existing', '1');
      let result: FinalizeVendorResult;
      try {
        result = await finalizeVendor(fd);
      } catch (err) {
        setLockState({
          kind: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Something went wrong. Try again.',
        });
        return;
      }
      switch (result.status) {
        case 'ok':
        case 'already_locked':
          // ----------------------------------------------------------------
          // CLAUDE.md 2026-05-24 owner directive — Lock-from-Compare cleanup.
          //
          // Owner verbatim: "when i am at card 2 and did a compare. then i
          // locked it at compare, the 2 venues proceeded to the next card
          // which shouldn't. when you lock a venue on compare view, it
          // needs to uncompare both and keep the venue picked to lock."
          //
          // The finalizeVendor server action already soft-archives every
          // OTHER considering/shortlisted pick in the same vendor_category
          // (lines 480-498 of vendors/actions.ts · Task #26 2026-05-22).
          // Soft-archive is correct for non-Compare lock flows — host may
          // have considered other vendors without explicitly comparing
          // them and the audit trail is useful.
          //
          // From Compare specifically the host has EXPLICITLY weighed the
          // picks side-by-side and chosen one. The others are definitively
          // rejected — not "research I might revisit." Hard-delete keeps
          // the planning surface clean: Card 02 shows the locked vendor as
          // the only pick · the wizard advances cleanly · Your Plan grid
          // doesn't carry zombie considering rows that need follow-up.
          //
          // Per-canonical scope so a multi-canonical group (Attire = gown
          // + suit + shoes + entourage + parents per CLAUDE.md 2026-05-24
          // 13-item refinement bundle) doesn't lose unrelated picks when
          // the host locks one canonical's choice. Compare dialog
          // surfaces per-canonical sub-rows already (line 84 doc above);
          // we mirror that scope on cleanup.
          //
          // Fire-and-forget — if a delete fails for any sibling, the
          // primary lock has already succeeded. Surface-level cleanup
          // can self-heal next time the host opens the planning surface
          // (the soft-archive from finalize stands as fallback).
          // ----------------------------------------------------------------
          const targetPick = picks.find((p) => p.vendor_id === vendorId);
          const siblingsToDelete = targetPick
            ? picks.filter(
                (p) =>
                  p.vendor_id !== vendorId &&
                  p.category === targetPick.category,
              )
            : [];
          for (const sibling of siblingsToDelete) {
            const fd2 = new FormData();
            fd2.set('event_id', eventId);
            fd2.set('vendor_id', sibling.vendor_id);
            try {
              await deleteVendor(fd2);
            } catch {
              // Silent — see comment block above. Lock succeeded.
            }
          }
          setLockState({ kind: 'just_locked', vendorId, vendorName });
          // Show toast immediately so it persists after dialog closes.
          setToast({
            kind: 'locked',
            vendorId,
            vendorName,
            undoUntil: Date.now() + TOAST_AUTO_DISMISS_MS,
          });
          // Close the dialog after the brief locked-flash state.
          setTimeout(() => {
            closeDialog();
          }, LOCKED_FLASH_MS);
          return;
        case 'hard_single_conflict':
          setLockState({
            kind: 'conflict',
            vendorId,
            vendorName,
            existingVendorId: result.existingVendorId,
            existingVendorName: result.existingVendorName,
            groupLabel: result.groupLabel,
          });
          return;
        case 'not_signed_in':
          setLockState({
            kind: 'error',
            message: 'Sign in again to lock this vendor.',
          });
          return;
        case 'not_found':
          setLockState({
            kind: 'error',
            message: "We can't find this vendor on your event. Refresh the page.",
          });
          return;
        case 'error':
          setLockState({ kind: 'error', message: result.message });
          return;
      }
    });
  };

  const performUndo = (vendorId: string) => {
    setToast({ kind: 'hidden' });
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('vendor_id', vendorId);
      await revertVendorToConsidering(fd);
    });
  };

  const cancelConflict = () => {
    setLockState({ kind: 'idle' });
  };

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/80 transition-colors hover:border-terracotta/50 hover:text-terracotta"
      >
        <GitCompare aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Compare {picks.length}
      </button>

      <dialog
        ref={dialogRef}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeDialog();
        }}
        className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-3xl rounded-2xl border border-ink/10 bg-cream p-0 shadow-xl backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
              Compare picks
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-ink">
              {groupLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-ink/55 hover:bg-ink/5 hover:text-ink"
          >
            <X aria-hidden className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="max-h-[calc(90dvh-76px)] space-y-6 overflow-y-auto px-5 py-5">
          {lockState.kind === 'error' ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-rose-300/60 bg-rose-50/70 px-3 py-2 text-sm text-rose-900"
            >
              <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={2} />
              <p className="flex-1">{lockState.message}</p>
              <button
                type="button"
                onClick={() => setLockState({ kind: 'idle' })}
                className="shrink-0 rounded-md border border-rose-300/60 bg-cream px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-rose-900 hover:bg-rose-100"
              >
                Dismiss
              </button>
            </div>
          ) : null}

          {lockState.kind === 'conflict' ? (
            <ConflictModal
              groupLabel={lockState.groupLabel}
              existingVendorName={lockState.existingVendorName}
              newVendorName={lockState.vendorName}
              onSwitch={() =>
                performLock(lockState.vendorId, lockState.vendorName, true)
              }
              onCancel={cancelConflict}
              isPending={isPending}
            />
          ) : null}

          {sections.length === 0 ? (
            <p className="text-sm text-ink/55">No picks in this group yet.</p>
          ) : (
            sections.map(([cat, list]) => {
              const cols = list.slice(0, MAX_COMPARE);
              const colsClass =
                cols.length === 1
                  ? 'grid-cols-1'
                  : cols.length === 2
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : 'grid-cols-1 sm:grid-cols-3';
              return (
                <section key={cat} className="space-y-3">
                  <header className="flex items-baseline justify-between gap-2">
                    <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
                      {VENDOR_CATEGORY_LABEL[cat] ?? cat}
                    </h3>
                    <span className="font-mono text-[10px] text-ink/40">
                      {list.length === 1
                        ? '1 pick'
                        : list.length <= MAX_COMPARE
                          ? `${list.length} picks`
                          : `${MAX_COMPARE} of ${list.length} picks`}
                    </span>
                  </header>
                  <div className={`grid gap-3 ${colsClass}`}>
                    {cols.map((p) => {
                      const isJustLocked =
                        lockState.kind === 'just_locked' &&
                        lockState.vendorId === p.vendor_id;
                      const isPendingThis =
                        lockState.kind === 'pending' &&
                        lockState.vendorId === p.vendor_id;
                      const isLockedRow =
                        p.status === 'locked' || isJustLocked;
                      return (
                        <article
                          key={p.vendor_id}
                          className={`flex flex-col gap-2 rounded-lg border p-3 transition-colors ${
                            isJustLocked
                              ? 'border-emerald-400 bg-emerald-50'
                              : isLockedRow
                                ? 'border-emerald-300/40 bg-emerald-50/30'
                                : 'border-ink/10 bg-cream'
                          }`}
                        >
                          <header className="space-y-1">
                            <h4 className="text-sm font-semibold leading-tight text-ink">
                              {p.vendor_name}
                            </h4>
                            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                              {VENDOR_CATEGORY_LABEL[p.category] ?? p.category}
                            </p>
                          </header>
                          <p>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] ${
                                isLockedRow
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-ink/5 text-ink/65'
                              }`}
                            >
                              {isLockedRow ? (
                                <Check
                                  aria-hidden
                                  className="h-3 w-3"
                                  strokeWidth={2}
                                />
                              ) : (
                                <Clock
                                  aria-hidden
                                  className="h-3 w-3"
                                  strokeWidth={1.75}
                                />
                              )}
                              {isJustLocked
                                ? 'Locked'
                                : rawStatusLabel(p.raw_status)}
                            </span>
                          </p>
                          <dl className="space-y-1 text-xs">
                            <div className="flex justify-between gap-2">
                              <dt className="text-ink/55">Cost</dt>
                              <dd className="font-mono text-ink">
                                {formatPHP(p.total_cost_php)}
                              </dd>
                            </div>
                            {p.deposit_paid_php !== null ? (
                              <div className="flex justify-between gap-2">
                                <dt className="text-ink/55">Deposit</dt>
                                <dd className="font-mono text-ink/80">
                                  {formatPHP(p.deposit_paid_php)}
                                </dd>
                              </div>
                            ) : null}
                            {p.contact_email || p.contact_phone ? (
                              <div className="flex justify-between gap-2">
                                <dt className="text-ink/55">Contact</dt>
                                <dd className="min-w-0 text-right text-[11px] text-ink/70">
                                  {p.contact_email ? (
                                    <div className="truncate">{p.contact_email}</div>
                                  ) : null}
                                  {p.contact_phone ? <div>{p.contact_phone}</div> : null}
                                </dd>
                              </div>
                            ) : null}
                          </dl>
                          {p.notes ? (
                            <p className="line-clamp-4 rounded-md bg-ink/[0.04] px-2 py-1.5 text-[11px] leading-snug text-ink/70">
                              {p.notes}
                            </p>
                          ) : null}
                          {/* Lock CTA — hidden once vendor is locked (idle locked
                              state OR the just-locked flash). Always-disabled
                              copy reads "Locked" in the cost-row badge above. */}
                          {!isLockedRow ? (
                            <button
                              type="button"
                              onClick={() =>
                                performLock(p.vendor_id, p.vendor_name, false)
                              }
                              disabled={isPendingThis || lockState.kind === 'pending'}
                              className="mt-auto inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-md bg-terracotta px-3 py-2 text-sm font-medium text-cream transition-colors hover:bg-terracotta-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:opacity-60"
                            >
                              {isPendingThis ? (
                                <>
                                  <Loader2
                                    aria-hidden
                                    className="h-3.5 w-3.5 animate-spin"
                                    strokeWidth={2}
                                  />
                                  Locking…
                                </>
                              ) : (
                                <>
                                  <BookmarkCheck
                                    aria-hidden
                                    className="h-3.5 w-3.5"
                                    strokeWidth={2}
                                  />
                                  Lock this vendor
                                </>
                              )}
                            </button>
                          ) : null}
                          <Link
                            href={`/dashboard/${eventId}/vendors`}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-terracotta hover:underline"
                          >
                            Manage in vendor tracker →
                          </Link>
                        </article>
                      );
                    })}
                  </div>
                  {list.length > MAX_COMPARE ? (
                    <p className="font-mono text-[10px] text-ink/40">
                      Showing the first {MAX_COMPARE} of {list.length} — reorder or remove in the vendor tracker.
                    </p>
                  ) : null}
                </section>
              );
            })
          )}
        </div>
      </dialog>

      {/* Stash groupId in a hidden field-style attribute so future tooling
          can read it. Today only the server action consumes groupId via
          the category lookup, but keeping the prop wired keeps the data
          path explicit. */}
      <span data-group-id={groupId} className="sr-only" aria-hidden="true">
        {groupId}
      </span>

      {/* Undo toast — outlives the dialog so a host who clicks Lock then
          immediately rethinks can roll back without re-opening Compare.
          Lives at the bottom of the viewport with the polite "Undo" link
          per the brand-voice rule (no dev-text, no jargon). */}
      {toast.kind === 'locked' ? (
        <UndoToast
          vendorName={toast.vendorName}
          onUndo={() => performUndo(toast.vendorId)}
          onDismiss={() => setToast({ kind: 'hidden' })}
        />
      ) : null}
    </>
  );
}

function ConflictModal({
  groupLabel,
  existingVendorName,
  newVendorName,
  onSwitch,
  onCancel,
  isPending,
}: {
  groupLabel: string;
  existingVendorName: string;
  newVendorName: string;
  onSwitch: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div
      role="alertdialog"
      aria-labelledby="conflict-heading"
      aria-describedby="conflict-body"
      className="space-y-3 rounded-lg border border-amber-300/60 bg-amber-50/70 px-4 py-3"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          aria-hidden
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
          strokeWidth={2}
        />
        <div className="space-y-1">
          <h3
            id="conflict-heading"
            className="text-sm font-semibold text-amber-900"
          >
            {existingVendorName} is already locked for {groupLabel.toLowerCase()}.
          </h3>
          <p id="conflict-body" className="text-xs leading-snug text-amber-900/85">
            Only one {groupLabel.toLowerCase()} can be locked at a time. Switch to{' '}
            <strong>{newVendorName}</strong> instead? Your earlier pick stays on the
            card as a considering option.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSwitch}
          disabled={isPending}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md bg-terracotta px-3 py-2 text-sm font-medium text-cream transition-colors hover:bg-terracotta-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:opacity-60"
        >
          {isPending ? (
            <>
              <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              Switching…
            </>
          ) : (
            <>Switch to {newVendorName}</>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-amber-400/60 bg-cream px-3 py-2 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function UndoToast({
  vendorName,
  onUndo,
  onDismiss,
}: {
  vendorName: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-emerald-300/60 bg-cream px-4 py-3 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <BookmarkCheck
          aria-hidden
          className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"
          strokeWidth={2}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-ink">
            {vendorName} is locked in.
          </p>
          <p className="text-[11px] text-ink/60">
            Changed your mind?{' '}
            <button
              type="button"
              onClick={onUndo}
              className="font-medium text-terracotta underline underline-offset-2 hover:text-terracotta/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              Undo · revert to considering
            </button>
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 text-ink/45 hover:bg-ink/5 hover:text-ink/70"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
