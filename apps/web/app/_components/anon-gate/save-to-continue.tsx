'use client';

/**
 * SaveToContinue — the point-of-action "save your plan to continue" prompt for
 * anonymous (anon-draft) users.
 *
 * Companion to the always-on SecureAccountBanner: the banner is the calm,
 * persistent nudge across the whole dashboard; THIS is the focused prompt that
 * appears the instant an anonymous user reaches a gated action (message a
 * vendor / place an order / unlock a category). It realizes the two-choice
 * idea the gates previously could not — the older flow optimistically called
 * the server action, got `not_secured`, and hard-redirected to /signup. This
 * pre-empts that round-trip and offers BOTH paths:
 *   • Create a free account (most anon users) → /signup, which detects the anon
 *     session and attaches the email to the SAME uid — plan preserved, nothing
 *     re-entered.
 *   • Log in (the visitor already has an account, e.g. on another device).
 *
 * Framing is deliberately reassurance-first, NOT a paywall: planning is free;
 * the account just protects the work and opens the reply channel. Mirrors the
 * RequirementsModal shell — bottom-sheet on mobile (<640px), centered dialog on
 * sm+ — and the Clean Editorial palette.
 *
 * `SaveGateHint` is the matching pre-emptive inline note a caller can render
 * beside/under a gated CTA so the account step is visible BEFORE the click.
 */

import { useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { ShieldCheck, UserPlus, LogIn, X } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';

/** Which gated action triggered the prompt — drives one contextual line. */
export type SaveGateAction = 'message' | 'order' | 'unlock' | 'generic';

const ACTION_LINE: Record<SaveGateAction, string> = {
  message:
    'Save your plan to send this message — so the vendor can reply and the conversation is always here when you come back.',
  order:
    'Save your plan to place this order — so we can process your payment and keep your purchase tied to you.',
  unlock:
    'Save your plan to add this and reach the vendor. Everything you’ve planned so far stays exactly as it is.',
  generic:
    'Save your plan to continue. Everything you’ve planned so far stays exactly as it is.',
};

/** Current path → so /signup and /login return the user right back here. */
function currentNext(): string {
  if (typeof window === 'undefined') return '/dashboard';
  return encodeURIComponent(window.location.pathname + window.location.search);
}

export function SaveToContinue({
  open,
  onClose,
  action = 'generic',
}: {
  open: boolean;
  onClose: () => void;
  action?: SaveGateAction;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open, onClose, containerRef: dialogRef });

  if (!open) return null;

  const next = currentNext();

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-end justify-center focus:outline-none sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-to-continue-title"
    >
      {/* Backdrop — click dismisses. */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />

      {/* Panel */}
      <div className="relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl border border-ink/10 bg-cream shadow-[0_-30px_80px_-40px_rgba(26,26,26,0.4)] sm:max-h-[85vh] sm:w-full sm:max-w-md sm:rounded-2xl sm:shadow-[0_30px_80px_-40px_rgba(26,26,26,0.4)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full text-ink/55 hover:bg-ink/5 hover:text-ink"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>

        <div className="overflow-y-auto px-6 py-7 pb-[max(env(safe-area-inset-bottom),20px)]">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-champagne-gold/20 text-mulberry">
            <ShieldCheck aria-hidden className="h-5 w-5" strokeWidth={1.8} />
          </span>

          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
            Save your plan
          </p>
          <h2
            id="save-to-continue-title"
            className="mt-1 font-serif text-2xl leading-tight text-ink"
          >
            Create a free account to continue
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/70">{ACTION_LINE[action]}</p>

          <div className="mt-6 space-y-2.5">
            <Link
              href={`/signup?next=${next}`}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-mulberry px-5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
            >
              <UserPlus aria-hidden className="h-4 w-4" strokeWidth={1.9} />
              Create a free account
            </Link>
            <Link
              href={`/login?next=${next}`}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-5 text-sm font-medium text-ink/80 transition-colors hover:border-ink/30 hover:text-ink"
            >
              <LogIn aria-hidden className="h-4 w-4" strokeWidth={1.9} />
              I already have an account
            </Link>
          </div>

          <p className="mt-4 text-center text-xs text-ink/50">
            Free to plan — your work is saved to this device until you do.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * SaveGateHint — the pre-emptive inline note. Render it next to a gated CTA
 * (only when the viewer is anonymous) so the account step is visible before the
 * tap, not a surprise after it. Calm, reassurance-first; never a lock/paywall
 * glyph, because planning genuinely is free.
 */
export function SaveGateHint({ children }: { children?: ReactNode }) {
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs text-ink/55">
      <ShieldCheck aria-hidden className="h-3.5 w-3.5 shrink-0 text-mulberry" strokeWidth={1.8} />
      {children ?? 'Free to plan — you’ll save your account to continue.'}
    </p>
  );
}
