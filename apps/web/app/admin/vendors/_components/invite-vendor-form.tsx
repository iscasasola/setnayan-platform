'use client';

import { useState, useTransition } from 'react';
import { Check, Copy, Send } from 'lucide-react';
import {
  createAdminVendorInvite,
  type AdminInviteResult,
} from '../actions';

/**
 * Admin-side vendor-invite form (2026-05-21). Posts to
 * `createAdminVendorInvite`; on success, displays the claim URL with a
 * copy-to-clipboard button so the admin can paste it into Messenger /
 * SMS / email. No automated send in V1 — admin shares the link manually.
 */
export function InviteVendorForm() {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<
    | { kind: 'idle' }
    | { kind: 'success'; claimUrl: string }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });
  const [copied, setCopied] = useState(false);

  function copyToClipboard(text: string) {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        // Clipboard write can fail on insecure-context (http) or when the
        // browser denies permission. Surface nothing — admin can manually
        // select + copy the visible URL.
      },
    );
  }

  return (
    <section className="mb-6 rounded-xl border border-ink/10 bg-cream p-4 sm:p-5">
      <h2 className="text-base font-semibold tracking-tight text-ink">
        Invite a vendor
      </h2>
      <p className="mt-1 text-sm text-ink/65">
        Pre-create a vendor account. The vendor uses your link to sign up and
        continues filling in their profile — no setup work needed on your end.
      </p>

      <form
        className="mt-4 grid gap-3 sm:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          const fd = new FormData(event.currentTarget);
          startTransition(async () => {
            const result: AdminInviteResult = await createAdminVendorInvite(fd);
            if (result.status === 'ok') {
              setState({ kind: 'success', claimUrl: result.claimUrl });
              setCopied(false);
              (event.target as HTMLFormElement).reset();
              return;
            }
            if (result.status === 'invalid_email') {
              setState({ kind: 'error', message: 'Please enter a valid email address.' });
              return;
            }
            if (result.status === 'duplicate_pending') {
              setState({
                kind: 'error',
                message: 'There is already a pending invite for this email. Revoke it first if you need to re-send.',
              });
              return;
            }
            setState({ kind: 'error', message: result.message ?? 'Could not create invite.' });
          });
        }}
      >
        <label className="space-y-1">
          <span className="block text-xs font-medium text-ink/70">Vendor email</span>
          <input
            name="email"
            type="email"
            required
            placeholder="hello@vendorbusiness.ph"
            className="input-field"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-ink/70">Business name</span>
          <input
            name="business_name"
            type="text"
            required
            maxLength={128}
            placeholder="ABC Catering"
            className="input-field"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-ink/70">
            Service category <span className="text-ink/45">(optional)</span>
          </span>
          <input
            name="service_category"
            type="text"
            maxLength={64}
            placeholder="catering, venue, photographer …"
            className="input-field"
          />
        </label>
        <div className="sm:col-span-3">
          <button
            type="submit"
            disabled={pending}
            className="button-primary inline-flex items-center gap-2 disabled:opacity-60"
          >
            <Send aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {pending ? 'Creating invite…' : 'Create invite link'}
          </button>
        </div>
      </form>

      {state.kind === 'success' ? (
        <div className="mt-4 rounded-md border border-success-300/60 bg-success-50 p-3">
          <p className="text-sm font-medium text-success-900">
            Invite link ready — share it with the vendor.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 truncate rounded-md border border-success-200 bg-cream px-3 py-2 font-mono text-xs text-ink/80">
              {state.claimUrl}
            </code>
            <button
              type="button"
              onClick={() => copyToClipboard(state.claimUrl)}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-success-300 bg-cream px-3 py-2 text-xs font-medium text-success-900 hover:bg-success-100"
            >
              {copied ? (
                <>
                  <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  Copied
                </>
              ) : (
                <>
                  <Copy aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  Copy link
                </>
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-success-900/70">
            Expires in 90 days. The vendor signs up via this link, and a
            vendor_profiles row gets created automatically with the business
            name you entered.
          </p>
        </div>
      ) : null}

      {state.kind === 'error' ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
