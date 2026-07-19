'use client';

import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ShieldCheck, UserCheck, X } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { inviteHost } from '../actions';

const PLANNER_ROLE = 'wedding_planner_external';

/**
 * RA 10173 consent gate on the coordinator host invite (corpus spec § 3a).
 *
 * Wraps a `<form action={inviteHost}>`. When the flag is ON *and* the
 * submission is a coordinator delegate (the "Promote your coordinator" path,
 * `forceCoordinator`, or the generic form's role === wedding_planner_external),
 * it intercepts submit, shows a data-privacy modal with an unticked checkbox,
 * and only submits — with `coordinator_consent=1` — once the couple agrees.
 *
 * Flag OFF (default) or a non-coordinator invite → passes straight through to
 * the server action, exact current behavior. Server-side enforcement in
 * `inviteHost` is the real gate; this is the UX + consent capture.
 */
export function ConsentGatedInviteForm({
  enabled,
  forceCoordinator = false,
  coordinatorLabel = null,
  className,
  children,
}: {
  enabled: boolean;
  forceCoordinator?: boolean;
  coordinatorLabel?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const bypassRef = useRef(false);
  const consentRef = useRef<HTMLInputElement>(null);
  const scopeVendorLockRef = useRef<HTMLInputElement>(null);
  const scopeCheckoutRef = useRef<HTMLInputElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [label, setLabel] = useState<string | null>(coordinatorLabel);

  function isCoordinatorSubmission(form: HTMLFormElement): boolean {
    if (forceCoordinator) return true;
    const fd = new FormData(form);
    return (
      fd.get('delegate_kind') === 'coordinator' ||
      fd.get('role_subtype') === PLANNER_ROLE
    );
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    // Second pass (after the couple agreed) — let the server action run.
    if (bypassRef.current) {
      bypassRef.current = false;
      return;
    }
    if (!enabled) return; // flag OFF → current behavior
    const form = e.currentTarget;
    if (!isCoordinatorSubmission(form)) return; // non-coordinator host → no gate
    e.preventDefault();
    if (!forceCoordinator) {
      const fd = new FormData(form);
      setLabel(
        (fd.get('display_label') as string) ||
          (fd.get('invitation_email') as string) ||
          coordinatorLabel,
      );
    }
    if (consentRef.current) consentRef.current.value = '';
    if (scopeVendorLockRef.current) scopeVendorLockRef.current.value = '';
    if (scopeCheckoutRef.current) scopeCheckoutRef.current.value = '';
    setModalOpen(true);
  }

  function confirmConsent(scopes: { vendorLock: boolean; checkout: boolean }) {
    if (consentRef.current) consentRef.current.value = '1';
    // Owner 2026-07-19 #5 — the couple's optional money-authority grants,
    // recorded into coordinator_access_consents.scopes by inviteHost.
    if (scopeVendorLockRef.current) {
      scopeVendorLockRef.current.value = scopes.vendorLock ? '1' : '';
    }
    if (scopeCheckoutRef.current) {
      scopeCheckoutRef.current.value = scopes.checkout ? '1' : '';
    }
    bypassRef.current = true;
    setModalOpen(false);
    formRef.current?.requestSubmit();
  }

  return (
    <form
      ref={formRef}
      action={inviteHost}
      onSubmit={handleSubmit}
      className={className}
    >
      {children}
      <input ref={consentRef} type="hidden" name="coordinator_consent" defaultValue="" />
      <input
        ref={scopeVendorLockRef}
        type="hidden"
        name="consent_scope_vendor_lock"
        defaultValue=""
      />
      <input
        ref={scopeCheckoutRef}
        type="hidden"
        name="consent_scope_checkout"
        defaultValue=""
      />
      {modalOpen ? (
        <ConsentModal
          coordinatorLabel={label}
          onConfirm={confirmConsent}
          onDismiss={() => setModalOpen(false)}
        />
      ) : null}
    </form>
  );
}

function ConsentModal({
  coordinatorLabel,
  onConfirm,
  onDismiss,
}: {
  coordinatorLabel: string | null;
  onConfirm: (scopes: { vendorLock: boolean; checkout: boolean }) => void;
  onDismiss: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  // Owner 2026-07-19 #5 — optional money-authority scopes, BOTH default OFF.
  const [lockVendors, setLockVendors] = useState(false);
  const [handlePayments, setHandlePayments] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open: true, onClose: onDismiss, containerRef: dialogRef });

  const who = coordinatorLabel?.trim() || 'your coordinator';

  return (
    <div
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-label={`Share your event with ${who}`}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm focus:outline-none sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-terracotta/30 bg-cream p-5 shadow-xl sm:p-6">
        <button
          type="button"
          aria-label="Close"
          onClick={onDismiss}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>

        <div className="flex items-start gap-2.5 pr-6">
          <ShieldCheck aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" strokeWidth={2} />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-ink">
              Share your event with {who}?
            </h3>
            <p className="text-xs leading-snug text-ink/65">
              Inviting {who} as a coordinator lets them help plan on your behalf.
              Please confirm you agree to share this information under the Data
              Privacy Act (RA 10173).
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2 rounded-lg border border-ink/10 bg-white/60 p-3 text-xs text-ink/85">
          <p className="font-medium text-ink/80">They&rsquo;ll be able to see and help edit:</p>
          <ul className="space-y-1.5">
            <li className="flex items-start gap-1.5">
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta" />
              <span>Your <strong>guest list &amp; RSVPs</strong></span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta" />
              <span>Your <strong>seating plan</strong></span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta" />
              <span>Your <strong>schedule / run-of-show</strong></span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta" />
              <span>Your <strong>vendor chats &amp; records</strong></span>
            </li>
          </ul>
          <p className="border-t border-ink/10 pt-2 text-ink/70">
            <strong>Your budget and payments stay private by default</strong> — a
            coordinator can only act on money matters if you allow it below. You
            can remove their access anytime.
          </p>
        </div>

        <div className="mt-3 space-y-2 rounded-lg border border-ink/10 bg-white/60 p-3 text-xs text-ink/85">
          <p className="font-medium text-ink/80">
            Optional — extra permissions (both off unless you allow them):
          </p>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={lockVendors}
              onChange={(e) => setLockVendors(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
            />
            <span>
              <strong>Can lock vendors</strong> — {who} may finalize (lock) a
              vendor on your behalf, which commits your booking and starts its
              payment schedule.
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={handlePayments}
              onChange={(e) => setHandlePayments(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
            />
            <span>
              <strong>Can handle payments</strong> — {who} may submit orders,
              upload payment proof, and record vendor deposits for this event.
            </span>
          </label>
        </div>

        <label className="mt-4 flex items-start gap-2 text-xs text-ink/85">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
          />
          <span>
            I agree to share my event&rsquo;s planning information (guest list,
            seating, schedule, and vendor chats) with {who} so they can coordinate
            on my behalf. I understand I can revoke this anytime.
          </span>
        </label>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ vendorLock: lockVendors, checkout: handlePayments })}
            disabled={!agreed}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-terracotta/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:opacity-60"
          >
            <UserCheck aria-hidden className="h-4 w-4" strokeWidth={2} />
            Agree &amp; invite
          </button>
        </div>
      </div>
    </div>
  );
}
