import { redirect } from 'next/navigation';
import { ShieldCheck, Eye, UserCog, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/app/_components/submit-button';
import { forceEndTakeover } from './actions';

/**
 * Couple-facing "Account access" / privacy page — admin account-access model
 * Phase 3d (RA 10173 right-to-know + self-serve force-end).
 *
 * Shows the couple who from the Setnayan team has accessed their account and
 * lets them end any active takeover of it. Reads run via the couple's OWN
 * RLS-gated client — the subject-scoped policies added in
 * 20270216158910_account_privacy_subject_access.sql return only THIS couple's
 * rows. (Until that migration is applied the lists are simply empty.)
 */
function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function AccountAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ended?: string }>;
}) {
  const { ended } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: accessRows } = await supabase
    .from('admin_data_access_log')
    .select('surface, created_at')
    .order('created_at', { ascending: false })
    .limit(30);

  const { data: sessions } = await supabase
    .from('admin_takeover_sessions')
    .select('session_id, reason, started_at, ended_at, ended_by, expires_at')
    .order('started_at', { ascending: false })
    .limit(20);

  const activeSessions = (sessions ?? []).filter((s) => !s.ended_at);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <header>
        <h1 className="flex items-center gap-2 font-serif text-2xl text-ink">
          <ShieldCheck className="h-6 w-6 text-gold" strokeWidth={1.75} aria-hidden />
          Account access
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-ink/60">
          Setnayan staff read your messages only with your consent or a logged, notified visit — and
          account changes happen only with your permission or with a notice to you. Here’s the record,
          and you can end any active visit yourself.
        </p>
      </header>

      {ended === '1' ? (
        <p className="flex items-center gap-2 rounded-xl border border-success-200 bg-success-100 px-4 py-2.5 text-sm text-success-900">
          <CheckCircle2 className="h-4 w-4" strokeWidth={2} aria-hidden />
          The session was ended. No one from the team can access your account until you’re notified again.
        </p>
      ) : null}

      <section className="rounded-2xl border border-ink/10 bg-paper p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
          <UserCog className="h-4 w-4 text-mulberry" strokeWidth={1.75} aria-hidden />
          Team visits to your account
        </h2>
        {(sessions ?? []).length === 0 ? (
          <p className="text-sm text-ink/50">No one from the team has ever taken over your account.</p>
        ) : (
          <ul className="space-y-2">
            {(sessions ?? []).map((s) => {
              const active = !s.ended_at;
              return (
                <li
                  key={s.session_id}
                  className={`rounded-lg px-3 py-2.5 text-sm ${active ? 'bg-gold/10 ring-1 ring-gold/30' : 'bg-ink/[0.03]'}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-ink/80">
                      {active ? 'Active now' : `Ended ${fmt(s.ended_at)}`}
                      {!active && s.ended_by ? (
                        <span className="ml-1 text-ink/45">
                          ({s.ended_by === 'user_force_end' ? 'you ended it' : s.ended_by})
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-ink/50">started {fmt(s.started_at)}</span>
                  </div>
                  {s.reason ? <p className="mt-1 text-xs text-ink/55">Reason: {s.reason}</p> : null}
                  {active ? (
                    <form action={forceEndTakeover} className="mt-2">
                      <input type="hidden" name="session_id" value={s.session_id} />
                      <SubmitButton
                        className="inline-flex items-center gap-1 rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-cream hover:bg-ink/90 disabled:opacity-60"
                        pendingLabel="Ending…"
                      >
                        End this visit now
                      </SubmitButton>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {activeSessions.length === 0 && (sessions ?? []).length > 0 ? (
          <p className="mt-3 text-xs text-ink/45">No visit is active right now.</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-ink/10 bg-paper p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
          <Eye className="h-4 w-4 text-ink/60" strokeWidth={1.75} aria-hidden />
          When your account was viewed
        </h2>
        {(accessRows ?? []).length === 0 ? (
          <p className="text-sm text-ink/50">No recorded views.</p>
        ) : (
          <ul className="divide-y divide-ink/5">
            {(accessRows ?? []).map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="text-ink/70">A Setnayan team member opened your account</span>
                <span className="text-xs text-ink/50">{fmt(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
