'use client';

import { useState, useTransition } from 'react';
import { Send, X, Sparkles } from 'lucide-react';
import {
  sendVendorInvite,
  connectExistingVendorProfile,
  type SendInviteResult,
} from '@/lib/vendor-invite-actions';

type Props = {
  vendorId: string;
  eventId: string;
  vendorName: string;
  defaultEmail: string | null;
};

type ModalView =
  | { kind: 'closed' }
  | { kind: 'invite-form' }
  | { kind: 'connect-prompt'; vendorProfileId: string; businessName: string }
  | { kind: 'sent' }
  | { kind: 'connected'; businessName: string }
  | { kind: 'error'; message: string };

export function InviteVendorButton({
  vendorId,
  eventId,
  vendorName,
  defaultEmail,
}: Props) {
  const [view, setView] = useState<ModalView>({ kind: 'closed' });
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData();
    form.set('vendor_id', vendorId);
    form.set('event_id', eventId);
    form.set('email', email);
    startTransition(async () => {
      const result: SendInviteResult = await sendVendorInvite(form);
      if (!result.ok) {
        setView({ kind: 'error', message: result.message });
        return;
      }
      if (result.mode === 'connected') {
        setView({
          kind: 'connect-prompt',
          vendorProfileId: result.vendorProfileId,
          businessName: result.businessName,
        });
        return;
      }
      setView({ kind: 'sent' });
    });
  }

  function handleConnect() {
    if (view.kind !== 'connect-prompt') return;
    const vp = view.vendorProfileId;
    const bn = view.businessName;
    const form = new FormData();
    form.set('vendor_id', vendorId);
    form.set('event_id', eventId);
    form.set('vendor_profile_id', vp);
    startTransition(async () => {
      const result = await connectExistingVendorProfile(form);
      if (!result.ok) {
        setView({ kind: 'error', message: result.message });
        return;
      }
      setView({ kind: 'connected', businessName: bn });
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setEmail(defaultEmail ?? '');
          setView({ kind: 'invite-form' });
        }}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-terracotta hover:text-terracotta-700"
      >
        <Send className="h-3.5 w-3.5" strokeWidth={1.75} />
        Invite to Setnayan
      </button>

      {view.kind !== 'closed' ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-xl bg-cream p-6 shadow-xl ring-1 ring-ink/10">
            <header className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
                  Setnayan · Couple invite
                </p>
                <h2 className="text-lg font-semibold text-ink">
                  {view.kind === 'sent'
                    ? `Invite sent to ${vendorName}`
                    : view.kind === 'connected'
                      ? `Connected to ${view.businessName}`
                      : view.kind === 'connect-prompt'
                        ? `${view.businessName} is already on Setnayan`
                        : view.kind === 'error'
                          ? 'Something went wrong'
                          : `Invite ${vendorName} to claim their profile`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setView({ kind: 'closed' })}
                aria-label="Close"
                className="rounded-full p-1 text-ink/50 hover:bg-ink/5 hover:text-ink"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </header>

            {view.kind === 'invite-form' ? (
              <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
                <p className="text-sm text-ink/70">
                  We&rsquo;ll email them an invitation to claim a free Setnayan profile. If
                  they sign up, you can message them in-app and your records here will
                  connect to their profile automatically.
                </p>
                <label htmlFor="invite-email" className="block space-y-1">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    Email
                  </span>
                  <input
                    id="invite-email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vendor@example.ph"
                    className="input-field"
                    autoFocus
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setView({ kind: 'closed' })}
                    className="rounded-md bg-ink/5 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-mulberry px-4 py-2 text-sm font-semibold text-cream hover:bg-mulberry-700 disabled:opacity-60"
                  >
                    {pending ? 'Sending…' : 'Send invite'}
                  </button>
                </div>
              </form>
            ) : null}

            {view.kind === 'connect-prompt' ? (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-ink/75">
                  This email already runs a Setnayan vendor account as{' '}
                  <strong className="text-ink">{view.businessName}</strong>. Connect this
                  engagement to their existing profile? No new account or duplicate is
                  created — chat unlocks immediately.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setView({ kind: 'closed' })}
                    className="rounded-md bg-ink/5 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={pending}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {pending ? 'Connecting…' : 'Connect'}
                  </button>
                </div>
              </div>
            ) : null}

            {view.kind === 'sent' ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-ink/75">
                  We emailed <strong className="text-ink">{email}</strong>. They have 90
                  days to claim the link. You can revoke this invite anytime from the
                  vendor card.
                </p>
                <button
                  type="button"
                  onClick={() => setView({ kind: 'closed' })}
                  className="w-full rounded-md bg-mulberry px-4 py-2 text-sm font-semibold text-cream hover:bg-mulberry-700"
                >
                  Done
                </button>
              </div>
            ) : null}

            {view.kind === 'connected' ? (
              <div className="mt-4 space-y-3">
                <p className="inline-flex items-center gap-2 text-sm text-emerald-800">
                  <Sparkles className="h-4 w-4 text-emerald-600" strokeWidth={1.75} />
                  Connected to <strong>{view.businessName}</strong>. Chat is now unlocked.
                </p>
                <button
                  type="button"
                  onClick={() => setView({ kind: 'closed' })}
                  className="w-full rounded-md bg-mulberry px-4 py-2 text-sm font-semibold text-cream hover:bg-mulberry-700"
                >
                  Done
                </button>
              </div>
            ) : null}

            {view.kind === 'error' ? (
              <div className="mt-4 space-y-3">
                <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
                  {view.message}
                </p>
                <button
                  type="button"
                  onClick={() => setView({ kind: 'invite-form' })}
                  className="w-full rounded-md bg-mulberry px-4 py-2 text-sm font-semibold text-cream hover:bg-mulberry-700"
                >
                  Try again
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
