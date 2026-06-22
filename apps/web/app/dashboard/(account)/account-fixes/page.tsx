import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Check, ShieldCheck, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/app/_components/submit-button';
import type { AccountFixRequestRow } from '@/lib/account-fix';
import { applyAccountFix, declineAccountFix } from './actions';

export const metadata = { title: 'Account fix requests' };

// Admin account-access model — Phase 2 CORE (consent-to-fix), couple surface.
// Setnayan staff can only PROPOSE a correction to your account; nothing lands
// until you approve it here. This page lists pending proposals and the recent
// resolved ones so the couple has a durable record of what they consented to.

export default async function AccountFixesPage({
  searchParams,
}: {
  searchParams: Promise<{ applied?: string; declined?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const sp = await searchParams;

  // RLS only returns the couple's OWN fix rows (their own + event-scoped to
  // events they're a couple member of).
  const { data } = await supabase
    .from('account_fix_requests')
    .select(
      'id, target_user_id, event_id, target_table, field_key, field_label, current_value, proposed_value, requested_by, status, reason, consent_at, created_at, resolved_at',
    )
    .order('created_at', { ascending: false })
    .limit(50);

  const rows = (data ?? []) as AccountFixRequestRow[];
  const pending = rows.filter((r) => r.status === 'pending');
  const resolved = rows.filter((r) => r.status !== 'pending');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to events
      </Link>

      <header className="mb-6 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Account fix requests
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Setnayan staff can suggest a correction to your account, but{' '}
          <strong>nothing changes until you approve it</strong>. Review what they
          proposed below and decide.
        </p>
      </header>

      {sp.applied ? (
        <p className="mb-4 rounded-md bg-success-100 px-4 py-3 text-sm text-success-900">
          Done — the change has been applied to your account.
        </p>
      ) : null}
      {sp.declined ? (
        <p className="mb-4 rounded-md bg-ink/5 px-4 py-3 text-sm text-ink/70">
          Declined — nothing was changed on your account.
        </p>
      ) : null}
      {sp.error ? (
        <p className="mb-4 rounded-md bg-danger-100 px-4 py-3 text-sm text-danger-800">
          {sp.error}
        </p>
      ) : null}

      {pending.length === 0 ? (
        <div className="rounded-xl border border-ink/10 bg-white/60 px-6 py-10 text-center">
          <ShieldCheck
            aria-hidden
            className="mx-auto mb-3 h-8 w-8 text-ink/30"
            strokeWidth={1.5}
          />
          <p className="text-base font-medium text-ink/80">No requests waiting.</p>
          <p className="mx-auto mt-1 max-w-prose text-sm text-ink/55">
            If Setnayan staff ever propose a correction to your account, it will
            show up here for your approval first.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {pending.map((fix) => (
            <li
              key={fix.id}
              className="rounded-xl border border-warn-200 bg-warn-50/60 p-5"
            >
              <p className="text-sm font-semibold text-ink/85">{fix.field_label}</p>
              {fix.reason ? (
                <p className="mt-1 text-sm text-ink/65">{fix.reason}</p>
              ) : null}

              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-md bg-white/70 px-3 py-2">
                  <dt className="text-xs uppercase tracking-wide text-ink/45">
                    Current
                  </dt>
                  <dd className="mt-0.5 break-words text-ink/80">
                    {fix.current_value && fix.current_value.length > 0
                      ? fix.current_value
                      : '—'}
                  </dd>
                </div>
                <div className="rounded-md bg-white/70 px-3 py-2">
                  <dt className="text-xs uppercase tracking-wide text-ink/45">
                    Proposed
                  </dt>
                  <dd className="mt-0.5 break-words font-medium text-ink">
                    {fix.proposed_value}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-3">
                <form action={applyAccountFix}>
                  <input type="hidden" name="fix_id" value={fix.id} />
                  <SubmitButton
                    className="button-primary inline-flex items-center gap-2"
                    pendingLabel="Applying…"
                  >
                    <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
                    Approve &amp; apply
                  </SubmitButton>
                </form>
                <form action={declineAccountFix}>
                  <input type="hidden" name="fix_id" value={fix.id} />
                  <SubmitButton
                    className="button-secondary inline-flex items-center gap-2"
                    pendingLabel="Declining…"
                  >
                    <X aria-hidden className="h-4 w-4" strokeWidth={2} />
                    Decline
                  </SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {resolved.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/45">
            Recent decisions
          </h2>
          <ul className="space-y-2">
            {resolved.map((fix) => (
              <li
                key={fix.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/10 bg-white/50 px-4 py-3 text-sm"
              >
                <span className="text-ink/75">
                  <strong className="font-medium text-ink/85">
                    {fix.field_label}
                  </strong>{' '}
                  → {fix.proposed_value}
                </span>
                <span
                  className={
                    fix.status === 'applied'
                      ? 'rounded-full bg-success-100 px-2.5 py-0.5 text-xs font-medium text-success-800'
                      : fix.status === 'declined'
                        ? 'rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-medium text-ink/60'
                        : 'rounded-full bg-ink/5 px-2.5 py-0.5 text-xs font-medium text-ink/50'
                  }
                >
                  {fix.status === 'applied'
                    ? 'Applied'
                    : fix.status === 'declined'
                      ? 'Declined'
                      : 'Withdrawn'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
