'use client';

import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ShieldCheck, UserCheck, X } from 'lucide-react';
import { ActionButton, EqualRow } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { inviteHost } from '@/app/dashboard/[eventId]/hosts/actions';

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

/**
 * 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 3 · 7 · 9 · 13): the RA 10173 ask RISES as the house sheet (grab handle,
 * ✕, the two foot buttons equal widths — Cancel grey, "Agree & invite" the one main) instead of a hand-drawn overlay;
 * no box inside it — what they can see and the optional permissions are two sections in grey capitals. Every word kept.
 * "Are you sure?" is right here: it shares the couple's planning information with another person (sheet rule 9).
 */
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
  const titleId = useId();

  const who = coordinatorLabel?.trim() || 'your coordinator';
  const CAP = 'text-xs font-semibold uppercase tracking-[0.06em] text-ink/70';
  const CHECK = 'mt-0.5 h-4 w-4 shrink-0 rounded border-ink/30 text-terracotta focus:ring-terracotta';

  return (
    <Sheet
      open
      onClose={onDismiss}
      labelledById={titleId}
      rise
      foot={
        <div className="px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
          <EqualRow>
            <ActionButton tone="neutral" icon={X} label="Cancel" onClick={onDismiss} />
            <ActionButton
              tone="brand"
              main
              icon={UserCheck}
              label="Agree & invite"
              onClick={() => onConfirm({ vendorLock: lockVendors, checkout: handlePayments })}
              waiting={!agreed}
            />
          </EqualRow>
        </div>
      }
    >
      <div role="alertdialog" aria-labelledby={titleId} className="space-y-3 px-4 pb-4 pt-3">
        <div className="flex items-start gap-2.5 pr-12">
          <ShieldCheck aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" strokeWidth={2} />
          <div className="space-y-1">
            <h2 id={titleId} className="text-[17px] font-semibold text-ink">
              Share your event with {who}?
            </h2>
            <p className="text-sm leading-snug text-ink/70">
              Inviting {who} as a coordinator lets them help plan on your behalf. Please confirm you agree to share this
              information under the Data Privacy Act (RA 10173).
            </p>
          </div>
        </div>

        <div className="space-y-2 text-sm text-ink">
          <p className={`mt-[18px] ${CAP}`}>They&rsquo;ll be able to see and help edit</p>
          <ul className="space-y-1.5">
            <li className="flex items-start gap-1.5">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-ink/40" />
              <span>Your <strong>guest list &amp; RSVPs</strong></span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-ink/40" />
              <span>Your <strong>seating plan</strong></span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-ink/40" />
              <span>Your <strong>schedule / run-of-show</strong></span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-ink/40" />
              <span>Your <strong>supplier chats &amp; records</strong></span>
            </li>
          </ul>
          <p className="border-t border-ink/10 pt-2 text-ink/70">
            <strong className="text-ink">Your budget and payments stay private by default</strong> — a coordinator can
            only act on money matters if you allow it below. You can remove their access anytime.
          </p>
        </div>

        <div className="space-y-1 text-sm text-ink">
          <p className={`mt-[18px] ${CAP}`}>Optional — extra permissions (both off unless you allow them)</p>
          <label className="flex min-h-11 items-start gap-2 py-1.5">
            <input
              type="checkbox"
              checked={lockVendors}
              onChange={(e) => setLockVendors(e.target.checked)}
              className={CHECK}
            />
            <span>
              <strong>Can book suppliers</strong> — {who} may book a supplier on your behalf, which commits your
              booking and starts its payment schedule.
            </span>
          </label>
          <label className="flex min-h-11 items-start gap-2 border-t border-ink/10 py-1.5">
            <input
              type="checkbox"
              checked={handlePayments}
              onChange={(e) => setHandlePayments(e.target.checked)}
              className={CHECK}
            />
            <span>
              <strong>Can handle payments</strong> — {who} may submit orders, upload payment proof, and record supplier
              payments for this event.
            </span>
          </label>
        </div>

        <label className="flex min-h-11 items-start gap-2 border-t border-ink/10 pt-3 text-sm text-ink">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className={CHECK} />
          <span>
            I agree to share my event&rsquo;s planning information (guest list, seating, schedule, and supplier chats)
            with {who} so they can coordinate on my behalf. I understand I can revoke this anytime.
          </span>
        </label>
      </div>
    </Sheet>
  );
}
