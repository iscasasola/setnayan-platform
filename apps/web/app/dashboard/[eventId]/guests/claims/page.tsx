import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Clock, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { ROLE_LABELS, type GuestRole } from '@/lib/guests';
import { SubmitButton } from '@/app/_components/submit-button';
import { approveClaimAction, rejectClaimAction } from './actions';

export const metadata = { title: 'Guest requests' };

type Props = { params: Promise<{ eventId: string }> };

type ClaimRow = {
  claim_id: string;
  claimer_name: string;
  claimer_email: string | null;
  requested_role: GuestRole;
  target_guest_id: string | null;
  match_score: number | null;
  status: 'pending_review' | 'otp_sent';
  otp_sent_to: string | null;
  created_at: string;
};

export default async function GuestClaimsPage({ params }: Props) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // Couple-only surface.
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (!membership) redirect(`/dashboard/${eventId}`);

  const { data: claimsRaw } = await supabase
    .from('guest_claims')
    .select(
      'claim_id, claimer_name, claimer_email, requested_role, target_guest_id, match_score, status, otp_sent_to, created_at',
    )
    .eq('event_id', eventId)
    .in('status', ['pending_review', 'otp_sent'])
    .order('created_at', { ascending: false });

  const claims = (claimsRaw ?? []) as ClaimRow[];

  // Resolve matched seed-row names for display.
  const targetIds = claims.map((c) => c.target_guest_id).filter((x): x is string => !!x);
  const nameByGuestId = new Map<string, string>();
  if (targetIds.length) {
    const { data: targets } = await supabase
      .from('guests')
      .select('guest_id, first_name, last_name, display_name')
      .in('guest_id', targetIds);
    for (const t of targets ?? []) {
      nameByGuestId.set(t.guest_id, (t.display_name?.trim() || `${t.first_name} ${t.last_name}`).trim());
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href={`/dashboard/${eventId}/guests`}
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to guest list
      </Link>

      <header className="mt-3 space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-terracotta" /> Guest requests
        </h1>
        <p className="text-sm text-ink/60">
          People who opened your invite link but weren&rsquo;t an automatic match. Nobody is
          added until you confirm them — keeping your guest list private.
        </p>
      </header>

      {claims.length === 0 ? (
        <div className="mt-10 rounded-xl border border-ink/10 bg-ink/[0.02] p-8 text-center">
          <p className="text-sm text-ink/60">No pending requests right now.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {claims.map((c) => {
            const matchedName = c.target_guest_id ? nameByGuestId.get(c.target_guest_id) : null;
            const scorePct = c.match_score != null ? Math.round(c.match_score * 100) : null;
            return (
              <li key={c.claim_id} className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">{c.claimer_name}</p>
                    <p className="text-sm text-ink/60">
                      {c.claimer_email ?? 'no email on file'} · wants to join as{' '}
                      {ROLE_LABELS[c.requested_role]}
                    </p>
                  </div>
                  {c.status === 'otp_sent' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      <Clock className="h-3 w-3" /> verifying by email
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-terracotta/10 px-2.5 py-1 text-xs font-medium text-terracotta-700">
                      needs review
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm text-ink/70">
                  {matchedName ? (
                    <>
                      Looks like your guest{' '}
                      <span className="font-medium text-ink">{matchedName}</span>
                      {scorePct != null ? <span className="text-ink/50"> · {scorePct}% name match</span> : null}
                    </>
                  ) : (
                    <span className="text-ink/50">No match on your current list.</span>
                  )}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {c.target_guest_id ? (
                    <form action={approveClaimAction.bind(null, eventId)}>
                      <input type="hidden" name="claim_id" value={c.claim_id} />
                      <input type="hidden" name="mode" value="matched" />
                      <SubmitButton className="button-primary" pendingLabel="Confirming…">
                        Confirm as {matchedName ?? 'matched guest'}
                      </SubmitButton>
                    </form>
                  ) : null}

                  <form action={approveClaimAction.bind(null, eventId)}>
                    <input type="hidden" name="claim_id" value={c.claim_id} />
                    <input type="hidden" name="mode" value="new" />
                    <SubmitButton className="button-secondary inline-flex items-center gap-1.5" pendingLabel="Adding…">
                      <UserPlus className="h-4 w-4" /> Add as new guest
                    </SubmitButton>
                  </form>

                  <form action={rejectClaimAction.bind(null, eventId)}>
                    <input type="hidden" name="claim_id" value={c.claim_id} />
                    <button
                      type="submit"
                      className="rounded-md px-3 py-2 text-sm text-ink/50 hover:bg-ink/5 hover:text-ink"
                    >
                      Decline
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
